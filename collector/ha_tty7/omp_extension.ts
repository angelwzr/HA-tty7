// Managed by HA-tty7. Public OMP 18.12.5 lifecycle only; no HA credentials.
import type { ExtensionAPI, ExtensionContext } from "@oh-my-pi/pi-coding-agent";
import { randomUUID } from "node:crypto";
import { closeSync, constants, fstatSync, fsyncSync, lstatSync, mkdirSync, openSync, opendirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, parse, resolve } from "node:path";
import { spawnSync } from "node:child_process";

type Status = "idle" | "working" | "waiting" | "done" | "unknown";
type Outcome = "completed" | "failed" | "cancelled";
type Event = { type?: string; messages?: unknown; willContinue?: unknown; awaitingAsyncWork?: unknown; willRetry?: unknown; aborted?: unknown; success?: unknown; toolCallId?: unknown; toolName?: unknown; sessionId?: unknown };
type PublicContext = Pick<ExtensionContext, "agent"> & Partial<Pick<ExtensionContext, "model" | "isIdle" | "hasPendingMessages" | "getAsyncJobSnapshot">> & { sessionId: () => string };
interface NativeRecord {
  schema_version: 1;
  reporter_id: string;
  pane_id: number;
  session_id: string;
  updated_at_ms: number;
  status: Status;
  run_id: string | null;
  background_jobs: number;
  outcome?: Outcome | null;
  input_id?: string | null;
  health: "ready" | "unsupported";
  model?: string | null;
  effort?: string | null;
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const uid = () => process.getuid!();
const safeInteger = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;

function identifierScalar(value: unknown, limit = 128): value is string {
  if (typeof value !== "string" || value.length > limit * 2 || !value.length) return false;
  let count = 0;
  for (let index = 0; index < value.length; index++) {
    const point = value.codePointAt(index)!;
    if (++count > limit || (point >= 0xd800 && point <= 0xdfff)) return false;
    if (point > 0xffff) index++;
  }
  return true;
}

function metadataScalar(value: unknown): value is string {
  return identifierScalar(value) && !!value.trim();
}

function terminalOutcome(messages: unknown): Outcome | null {
  try {
    if (!Array.isArray(messages) || !messages.length) return null;
    // Only the final public envelope can prove a terminal turn; never scan history.
    const message = messages[messages.length - 1];
    if (!message || typeof message !== "object" || message.role !== "assistant") return null;
    const reason = message.stopReason;
    return reason === "stop" ? "completed" : reason === "error" ? "failed" : reason === "aborted" ? "cancelled" : null;
  } catch { return null; }
}

function withPublicationLock(directory: string, mode: "--shared" | "--exclusive", mutation: () => void): void {
  // Persistent inode shared with the collector. Every operation opens a new OFD.
  const fd = openSync(join(directory, ".publish.lock"), constants.O_RDWR | constants.O_CREAT | constants.O_NOFOLLOW | constants.O_NONBLOCK, 0o600);
  try {
    const info = fstatSync(fd);
    if (!info.isFile() || info.uid !== uid() || (info.mode & 0o7777) !== 0o600 || info.nlink !== 1) return;
    const lock = spawnSync("flock", [mode, "--nonblock", "3"], { stdio: ["ignore", "ignore", "ignore", fd], timeout: 1000 });
    // flock's child shares this open description; closing the retained FD releases it.
    if (lock.status === 0) mutation();
  } finally { closeSync(fd); }
}

function recordState(path: string): "present" | "missing" | "unsafe" {
  try { return ownedRecord(path) ? "present" : "unsafe"; }
  catch (error: unknown) { if (error instanceof Error && "code" in error && error.code === "ENOENT") return "missing"; throw error; }
}

function ensureDirectory(path: string, privateDirectory = false): void {
  try { mkdirSync(path, { mode: 0o700 }); } catch (error: unknown) { if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) throw error; }
  const info = lstatSync(path);
  if (!info.isDirectory() || info.uid !== uid() || (privateDirectory ? (info.mode & 0o7777) !== 0o700 : (info.mode & 0o022) !== 0)) throw new Error("Unsafe directory");
}

function statusDirectory(): string {
  const home = resolve(homedir());
  let parent = dirname(home);
  while (true) {
    const info = lstatSync(parent);
    if (!info.isDirectory() || ![0, uid()].includes(info.uid) || ((info.mode & 0o022) && !(info.mode & 0o1000))) throw new Error("Unsafe ancestry");
    if (parent === parse(parent).root) break;
    parent = dirname(parent);
  }
  ensureDirectory(home);
  let directory = home;
  for (const component of [".local", "share", "ha-tty7", "omp-status"]) {
    directory = join(directory, component);
    ensureDirectory(directory, component === "ha-tty7" || component === "omp-status");
  }
  return directory;
}

function ownedRecord(path: string): boolean {
  const info = lstatSync(path);
  return info.isFile() && info.uid === uid() && (info.mode & 0o7777) === 0o600 && info.nlink === 1 && info.size <= 4096;
}

function generatedRecord(record: unknown, id: string): record is NativeRecord {
  if (!record || typeof record !== "object" || Array.isArray(record) ||
      !("schema_version" in record) || !("reporter_id" in record) || !("pane_id" in record) ||
      !("session_id" in record) || !("updated_at_ms" in record) || !("status" in record) ||
      !("run_id" in record) || !("background_jobs" in record) || !("health" in record)) return false;
  return Object.keys(record).length === 9 + ("model" in record ? 1 : 0) + ("effort" in record ? 1 : 0) + ("outcome" in record ? 1 : 0) + ("input_id" in record ? 1 : 0) &&
    record.schema_version === 1 && record.reporter_id === id &&
    safeInteger(record.pane_id) && record.pane_id > 0 &&
    typeof record.session_id === "string" && record.session_id.length > 0 && record.session_id.length <= 128 &&
    safeInteger(record.updated_at_ms) && safeInteger(record.background_jobs) &&
    typeof record.status === "string" && ["idle", "working", "waiting", "done", "unknown"].includes(record.status) &&
    (record.health === "ready" || record.health === "unsupported") &&
    (!("model" in record) || record.model === null || metadataScalar(record.model)) &&
    (!("effort" in record) || record.effort === null || metadataScalar(record.effort)) &&
    (!("outcome" in record) || record.outcome === null ||
      (["completed", "failed", "cancelled"].includes(record.outcome as string) &&
       record.health === "ready" && record.status === "done" && record.run_id !== null &&
       record.background_jobs === 0 && (!("input_id" in record) || record.input_id === null))) &&
    (!("input_id" in record) || record.input_id === null ||
      (identifierScalar(record.input_id) && record.health === "ready" &&
       record.status === "waiting" && record.run_id !== null &&
       (!("outcome" in record) || record.outcome === null))) &&
    (record.run_id === null || (typeof record.run_id === "string" && record.run_id.length > 0 && record.run_id.length <= 128));
}

function availableSlot(directory: string): boolean {
  let count = 0;
  const entries = opendirSync(directory);
  try {
    for (let entry = entries.readSync(); entry; entry = entries.readSync()) {
      if (!entry.name.endsWith(".json")) continue;
      const id = entry.name.slice(0, -5);
      const path = join(directory, entry.name);
      // Only old, owned generated records may be pruned. Never follow links.
      if (UUID.test(id) && ownedRecord(path)) {
        const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
        try {
          const info = fstatSync(fd);
          if (info.size <= 4096 && info.nlink === 1 && info.uid === uid() && info.isFile() && (info.mode & 0o7777) === 0o600) {
            const record: unknown = JSON.parse(readFileSync(fd, "utf8"));
            const current = lstatSync(path);
            if (generatedRecord(record, id) && Date.now() - record.updated_at_ms >= 60000 && Date.now() - info.mtimeMs >= 60000 &&
                current.ino === info.ino && current.dev === info.dev && current.mtimeMs === info.mtimeMs && current.size === info.size) {
              unlinkSync(path);
              continue;
            }
          }
        } catch { /* Unreadable or invalid records are not ours to remove. */ }
        finally { closeSync(fd); }
      }
      if (++count >= 256) return false;
    }
  } finally { entries.closeSync(); }
  return true;
}

export default function haTty7Status(pi: ExtensionAPI): void {
  // Factories are also loaded for children. Only real main callbacks may do IO.
  let context: PublicContext | undefined;
  let reporter: { id: string; session: string; pane: number; directory: string } | undefined;
  let timer: NodeJS.Timeout | undefined;
  let run: string | null = null;
  let settled = false;
  let continuation = false;
  let retry = false;
  let compacting = false;
  let active = false;
  let terminal: Outcome | null = null;
  let retryUnproven = false;
  let inputId: string | null = null;
  let inputKey: string | null = null;
  const asks = new Set<string>();
  const approvals = new Set<string>();
  // Public tool_call carries the real agent identity; approval callbacks may not.
  const ownedCalls = new Map<string, string>();

  function dispose(): void {
    clearInterval(timer);
    timer = undefined;
    if (reporter) {
      try {
        if (statusDirectory() === reporter.directory) {
          const owner = reporter;
          withPublicationLock(owner.directory, "--shared", () => {
            const path = join(owner.directory, `${owner.id}.json`);
            if (recordState(path) === "present") unlinkSync(path);
          });
        }
      } catch { /* No unsafe cleanup fallback. Stale records expire at the reader. */ }
    }
    context = undefined;
    reporter = undefined;
    run = null; settled = false; continuation = false; retry = false; compacting = false;
    asks.clear(); approvals.clear(); ownedCalls.clear();
    terminal = null; retryUnproven = false; inputId = null; inputKey = null;
    active = false;
  }

  function busy(): void {
    if (run === null || settled) {
      run = randomUUID();
      terminal = null; retryUnproven = false; inputId = null; inputKey = null;
    }
    settled = false;
  }

  function request(key: string): void {
    busy();
    terminal = null;
    if (inputKey !== key) { inputKey = key; inputId = randomUUID(); }
  }


  function sample(): void {
    if (!reporter || !context) return;
    let status: Status = "unknown";
    let health: "ready" | "unsupported" = "unsupported";
    let jobs = 0;
    try {
      if (context.agent?.kind !== "main" || context.sessionId() !== reporter.session) { dispose(); return; }
      if (typeof context.isIdle !== "function" || typeof context.hasPendingMessages !== "function" || typeof context.getAsyncJobSnapshot !== "function") throw new Error("Unsupported host");
      const idle = context.isIdle();
      const pending = context.hasPendingMessages();
      if (typeof idle !== "boolean" || typeof pending !== "boolean") throw new Error("Unsupported host");
      const snapshot = context.getAsyncJobSnapshot();
      let delivery = false;
      if (snapshot !== null) {
        if (!snapshot || !Array.isArray(snapshot.running) || !snapshot.delivery || !safeInteger(snapshot.delivery.queued) || typeof snapshot.delivery.delivering !== "boolean" || !Array.isArray(snapshot.delivery.pendingJobIds)) throw new Error("Unsupported snapshot");
        jobs = snapshot.running.length;
        delivery = snapshot.delivery.queued > 0 || snapshot.delivery.delivering || snapshot.delivery.pendingJobIds.length > 0;
      }
      if (active || !idle || pending || jobs > 0 || delivery || continuation || retry || compacting || asks.size || approvals.size) {
        busy();
        status = asks.size || approvals.size ? "waiting" : "working";
      } else {
        status = run === null ? "idle" : "done";
        settled = run !== null;
      }
      health = "ready";
    } catch { jobs = 0; terminal = null; }
    let model: string | null = null;
    let effort: string | null = null;
    try {
      const current = context.model;
      if (current) {
        const provider = current.provider;
        const id = current.id;
        if (metadataScalar(provider) && metadataScalar(id)) {
          const identity = `${provider}/${id}`;
          if (metadataScalar(identity)) model = identity;
        }
      }
    } catch { /* Metadata must not alter lifecycle health or run identity. */ }
    try {
      const current = pi.getThinkingLevel();
      if (metadataScalar(current)) effort = current;
    } catch { /* Independent optional public metadata. */ }
    const record = {
      schema_version: 1, reporter_id: reporter.id, pane_id: reporter.pane,
      session_id: reporter.session, updated_at_ms: Date.now(), status,
      run_id: health === "ready" ? run : null, background_jobs: jobs, health,
      model, effort,
      outcome: health === "ready" && status === "done" ? terminal : null,
      input_id: health === "ready" && status === "waiting" ? inputId : null,
    };
    try {
      const owner = reporter;
      if (statusDirectory() !== owner.directory) return;
      const path = join(owner.directory, `${owner.id}.json`);
      const publish = () => {
        let temporary: string | undefined = join(owner.directory, `.${owner.id}-${randomUUID()}.tmp`);
        try {
          const fd = openSync(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
          try { writeFileSync(fd, JSON.stringify(record)); fsyncSync(fd); } finally { closeSync(fd); }
          renameSync(temporary, path);
          temporary = undefined;
        } finally { if (temporary) { try { unlinkSync(temporary); } catch { /* Only our exclusive temporary. */ } } }
      };
      let initial = false;
      withPublicationLock(owner.directory, "--shared", () => {
        const state = recordState(path);
        if (state === "present") publish();
        else initial = state === "missing";
      });
      if (initial) {
        // A pruned/first publication must recheck capacity under a distinct EX lock.
        // Never upgrade or publish in the unlocked gap between the two acquisitions.
        withPublicationLock(owner.directory, "--exclusive", () => {
          const state = recordState(path);
          if (state === "unsafe") return;
          if (state === "missing" && !availableSlot(owner.directory)) return;
          publish();
        });
      }
    } catch { /* Local reporting must not interfere with the agent or expose errors. */ }
  }

  function handle(type: string, event: Event, ctx: ExtensionContext): void {
    if (ctx.agent?.kind !== "main") return;
    if (type === "session_shutdown") { dispose(); return; }
    const paneText = (process.env.TTY7_PANE ?? "").replace(/^%/, "");
    const pane = Number(paneText);
    if (!process.env.TTY7 || !/^[0-9]+$/.test(paneText) || !safeInteger(pane) || pane <= 0) { dispose(); return; }
    let session: string;
    try { session = ctx.sessionManager.getSessionId(); } catch { dispose(); return; }
    if (typeof session !== "string" || !session.length || session.length > 128) { dispose(); return; }
    if (event.sessionId !== undefined && event.sessionId !== session) return;
    if (type === "session_switch" || type === "session_branch" || (reporter && (reporter.session !== session || reporter.pane !== pane))) dispose();
    if (!reporter) {
      try {
        const directory = statusDirectory();
        reporter = { id: randomUUID(), session, pane, directory };
      } catch { return; }
    }
    // Cache only the scalar-observation facade, never event args/results/messages.
    context = {
      agent: ctx.agent,
      get model() { return ctx.model; },
      sessionId: () => ctx.sessionManager.getSessionId(),
      isIdle: typeof ctx.isIdle === "function" ? ctx.isIdle.bind(ctx) : undefined,
      hasPendingMessages: typeof ctx.hasPendingMessages === "function" ? ctx.hasPendingMessages.bind(ctx) : undefined,
      getAsyncJobSnapshot: typeof ctx.getAsyncJobSnapshot === "function" ? ctx.getAsyncJobSnapshot.bind(ctx) : undefined,
    };
    switch (type) {
      case "agent_start":
        busy(); active = true; terminal = null; retryUnproven = false;
        continuation = false; asks.clear(); approvals.clear(); ownedCalls.clear(); inputId = null; inputKey = null; break;
      case "agent_end": {
        active = false;
        const valid = (event.willContinue === undefined || typeof event.willContinue === "boolean") &&
          (event.awaitingAsyncWork === undefined || typeof event.awaitingAsyncWork === "boolean");
        continuation = !valid || event.willContinue === true || event.awaitingAsyncWork === true;
        const outcome = valid && !continuation ? terminalOutcome(event.messages) : null;
        if (terminal !== "cancelled") terminal = retryUnproven && outcome !== "cancelled" ? null : outcome;
        asks.clear(); approvals.clear(); ownedCalls.clear(); break;
      }
      case "auto_retry_start": busy(); terminal = null; retry = true; break;
      case "auto_retry_end":
        retry = false;
        if (event.success !== true) {
          // Public success:false conflates cancellation and failure; error text is off limits.
          retryUnproven = true;
          if (terminal !== "cancelled") terminal = null;
          continuation = false; asks.clear(); approvals.clear();
        }
        break;
      case "auto_compaction_start": busy(); terminal = null; compacting = true; break;
      case "auto_compaction_end":
        compacting = false;
        continuation = event.willRetry !== false && event.aborted !== true;
        if (event.aborted === true) { continuation = false; terminal = "cancelled"; }
        break;
      case "tool_call":
        if (identifierScalar(event.toolCallId, 4096) && metadataScalar(event.toolName) && ownedCalls.size < 256) {
          ownedCalls.set(event.toolCallId, event.toolName);
        }
        return;
      case "tool_execution_start":
        if (event.toolName === "ask" && identifierScalar(event.toolCallId, 4096) && ownedCalls.get(event.toolCallId) === "ask") {
          const key = `ask:${event.toolCallId}`; request(key); asks.add(key);
        }
        break;
      case "tool_execution_end":
        if (identifierScalar(event.toolCallId, 4096)) {
          asks.delete(`ask:${event.toolCallId}`); approvals.delete(`approval:${event.toolCallId}`);
          ownedCalls.delete(event.toolCallId);
        }
        break;
      case "tool_approval_requested":
        if (event.sessionId === session && identifierScalar(event.toolCallId, 4096)
            && event.toolName !== undefined && ownedCalls.get(event.toolCallId) === event.toolName) {
          const key = `approval:${event.toolCallId}`; request(key); approvals.add(key);
        }
        break;
      case "tool_approval_resolved":
        if (event.sessionId === session && identifierScalar(event.toolCallId, 4096)
            && event.toolName !== undefined && ownedCalls.get(event.toolCallId) === event.toolName) {
          approvals.delete(`approval:${event.toolCallId}`);
        }
        break;
    }
    sample();
    if (reporter && timer === undefined) {
      timer = setInterval(sample, 2000);
      timer.unref?.();
    }
  }

  pi.on("session_start", (event, ctx) => handle("session_start", event, ctx));
  pi.on("session_switch", (event, ctx) => handle("session_switch", event, ctx));
  pi.on("session_branch", (event, ctx) => handle("session_branch", event, ctx));
  pi.on("session_shutdown", (event, ctx) => handle("session_shutdown", event, ctx));
  pi.on("agent_start", (event, ctx) => handle("agent_start", event, ctx));
  pi.on("agent_end", (event, ctx) => handle("agent_end", event, ctx));
  pi.on("auto_retry_start", (event, ctx) => handle("auto_retry_start", event, ctx));
  pi.on("auto_retry_end", (event, ctx) => handle("auto_retry_end", event, ctx));
  pi.on("auto_compaction_start", (event, ctx) => handle("auto_compaction_start", event, ctx));
  pi.on("auto_compaction_end", (event, ctx) => handle("auto_compaction_end", event, ctx));
  pi.on("tool_call", (event, ctx) => handle("tool_call", event, ctx));
  pi.on("tool_execution_start", (event, ctx) => handle("tool_execution_start", event, ctx));
  pi.on("tool_execution_end", (event, ctx) => handle("tool_execution_end", event, ctx));
  pi.on("tool_approval_requested", (event, ctx) => handle("tool_approval_requested", event, ctx));
  pi.on("tool_approval_resolved", (event, ctx) => handle("tool_approval_resolved", event, ctx));
}
