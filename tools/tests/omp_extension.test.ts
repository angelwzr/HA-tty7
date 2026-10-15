import { afterAll, afterEach, beforeEach, expect, mock, test } from "bun:test";
import { chmodSync, closeSync, constants, mkdtempSync, openSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

let home: string;
// Bun caches OS homedir at startup. Override only that boundary; all files are real.
const realOs = { ...await import("node:os") };
mock.module("node:os", () => ({ ...realOs, homedir: () => home }));
afterAll(() => { mock.module("node:os", () => realOs); });
let old: NodeJS.ProcessEnv;
let handlers: Map<string, Function>;
let timers: Set<Function>;
let restoreInterval: typeof globalThis.setInterval;
let restoreClear: typeof globalThis.clearInterval;
const directory = () => join(home, ".local/share/ha-tty7/omp-status");
const files = () => { try { return readdirSync(directory()).filter(x => x.endsWith(".json")); } catch { return []; } };
const record = () => JSON.parse(readFileSync(join(directory(), files()[0]), "utf8"));
let idle: boolean, pending: boolean, snapshot: any, session: string;
const context = (kind = "main"): any => ({ agent: { kind }, sessionManager: { getSessionId: () => session }, isIdle: () => idle, hasPendingMessages: () => pending, getAsyncJobSnapshot: () => snapshot });
const emit = async (type: string, event: any = {}, ctx = context()) => { await handlers.get(type)?.({ type, ...event }, ctx); };
const tick = () => { for (const callback of timers) callback(); };
function holdPublicationLock(mode = "--exclusive") {
  const fd = openSync(join(directory(), ".publish.lock"), constants.O_RDWR | constants.O_CREAT | constants.O_NOFOLLOW, 0o600);
  const result = spawnSync("flock", [mode, "--nonblock", "3"], { stdio: ["ignore", "ignore", "ignore", fd], timeout: 1000 });
  if (result.status !== 0) { closeSync(fd); throw new Error("isolated flock fixture could not acquire lock"); }
  return fd;
}
beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), "ha-tty7-native-")); old = { ...process.env };
  process.env.HOME = home; process.env.TTY7 = "1"; process.env.TTY7_PANE = "%42";
  idle = true; pending = false; snapshot = null; session = "main-session";
  handlers = new Map(); timers = new Set();
  restoreInterval = globalThis.setInterval; restoreClear = globalThis.clearInterval;
  globalThis.setInterval = ((callback: Function, delay: number) => { expect(delay).toBe(2000); timers.add(callback); return { unref() {} }; }) as any;
  globalThis.clearInterval = (() => { timers.clear(); }) as any;
  const factory = (await import("../../collector/ha_tty7/omp_extension.ts")).default;
  factory({ on: (event: string, callback: Function) => handlers.set(event, callback) } as any);
});
afterEach(async () => { await emit("session_shutdown"); globalThis.setInterval = restoreInterval; globalThis.clearInterval = restoreClear; process.env = old; rmSync(home, { recursive: true, force: true }); });

test("factory and all child callbacks do no filesystem IO and cannot overwrite main", async () => {
  expect(files()).toEqual([]); expect(timers.size).toBe(0);
  await emit("session_start", {}, context("sub")); expect(files()).toEqual([]);
  await emit("session_start"); const first = record();
  for (const name of handlers.keys()) await emit(name, { willContinue: false, toolName: "ask", toolCallId: "private-child" }, context("sub"));
  expect(record()).toEqual(first); expect(timers.size).toBe(1);
});
test("initial idle is not completion and unavailable API is unsupported", async () => {
  await emit("session_start"); expect(record().status).toBe("idle"); expect(record().run_id).toBeNull();
  const ctx = context(); delete ctx.getAsyncJobSnapshot;
  await emit("agent_end", {}, ctx); expect(record().status).toBe("unknown"); expect(record().health).toBe("unsupported");
});
test("continuations owner jobs and pending delivery preserve one run until actually settled", async () => {
  await emit("session_start"); idle = false; await emit("agent_start"); const run = record().run_id;
  idle = true; await emit("agent_end", { willContinue: true }); tick(); expect(record().status).toBe("working");
  snapshot = { running: [{ label: "PRIVATE", command: "SECRET" }], delivery: { queued: 0, delivering: false, pendingJobIds: [] } };
  await emit("agent_start"); await emit("agent_end"); expect(record().background_jobs).toBe(1); expect(record().run_id).toBe(run);
  snapshot = { running: [], delivery: { queued: 1, delivering: true, pendingJobIds: ["PRIVATE"] } }; tick(); expect(record().status).toBe("working");
  snapshot.delivery = { queued: 0, delivering: false, pendingJobIds: [] }; pending = true; tick(); expect(record().status).toBe("working");
  pending = false; tick(); expect(record().status).toBe("done"); expect(record().run_id).toBe(run);
  idle = false; await emit("agent_start"); expect(record().run_id).not.toBe(run);
});
test("per-call ask and approval waits survive unrelated tool completion", async () => {
  idle = false; await emit("agent_start");
  await emit("tool_execution_start", { toolName: "ask", toolCallId: "one", args: { secret: "NEVER_EXPORT" } });
  await emit("tool_approval_requested", { sessionId: session, toolCallId: "two", reason: "PRIVATE_REASON" });
  await emit("tool_execution_end", { toolCallId: "other", result: "PRIVATE_RESULT" }); expect(record().status).toBe("waiting");
  await emit("tool_execution_end", { toolCallId: "one" }); expect(record().status).toBe("waiting");
  await emit("tool_approval_resolved", { sessionId: session, toolCallId: "two" }); expect(record().status).toBe("working");
  const text = readFileSync(join(directory(), files()[0]), "utf8"); expect(text).not.toMatch(/NEVER_EXPORT|PRIVATE|args|result|reason|command/);
  expect(Object.keys(record()).sort()).toEqual(["schema_version", "reporter_id", "pane_id", "session_id", "updated_at_ms", "status", "run_id", "background_jobs", "health"].sort());
  expect(statSync(directory()).mode & 0o777).toBe(0o700); expect(statSync(join(directory(), files()[0])).mode & 0o777).toBe(0o600);
});
test("retry and compaction cancellation clear continuation without sticking working", async () => {
  idle = false; await emit("agent_start"); await emit("auto_retry_start"); idle = true;
  await emit("agent_end", { willContinue: true }); await emit("auto_retry_end", { success: false }); tick(); expect(record().status).toBe("done");
  idle = false; await emit("agent_start"); await emit("auto_compaction_start"); idle = true;
  await emit("agent_end", { willContinue: true }); await emit("auto_compaction_end", { aborted: true, willRetry: false }); tick(); expect(record().status).toBe("done");
});
test("switch resets state removes previous record and stale context cannot fabricate done", async () => {
  idle = false; await emit("agent_start"); const previous = files()[0];
  session = "new-session"; idle = true; await emit("session_switch"); expect(files()).toHaveLength(1); expect(files()[0]).not.toBe(previous); expect(record().status).toBe("idle");
  session = "unannounced-switch"; tick(); expect(files()).toEqual([]);
  await emit("session_start"); expect(record().status).toBe("idle"); await emit("session_shutdown"); expect(files()).toEqual([]); expect(timers.size).toBe(0);
});
test("unsafe status directory never follows symlink or repairs public permissions", async () => {
  await emit("session_start"); await emit("session_shutdown"); chmodSync(directory(), 0o755);
  await emit("session_start"); expect(files()).toEqual([]); expect(statSync(directory()).mode & 0o777).toBe(0o755);
  rmSync(directory(), { recursive: true }); symlinkSync(home, directory()); await emit("session_start"); expect(readdirSync(home).filter(x => x.endsWith(".json"))).toEqual([]);
});
test("outside tty7 produces no reporter", async () => { delete process.env.TTY7; await emit("session_start"); expect(files()).toEqual([]); expect(timers.size).toBe(0); });
test("heartbeat samples safely without leaking getters or creating unsupported done", async () => {
  const ctx = context();
  ctx.getAsyncJobSnapshot = () => { throw new Error("PRIVATE_DIAGNOSTIC"); };
  await emit("session_start", {}, ctx); tick();
  expect(record().health).toBe("unsupported"); expect(record().status).toBe("unknown"); expect(record().run_id).toBeNull();
  expect(readFileSync(join(directory(), files()[0]), "utf8")).not.toContain("PRIVATE_DIAGNOSTIC");
});
test("initial busy public context is observed but no history is inspected", async () => {
  idle = false;
  const ctx = context();
  Object.defineProperty(ctx.sessionManager, "getEntries", { get() { throw new Error("private history accessed"); } });
  await emit("session_start", {}, ctx); expect(record().status).toBe("working"); expect(record().run_id).not.toBeNull();
  idle = true; tick(); expect(record().status).toBe("done");
});
test("directory cap does not create an extra live record", async () => {
  await emit("session_start"); const fixture = record(); await emit("session_shutdown");
  for (let i = 0; i < 256; i++) {
    const id = randomUUID();
    writeFileSync(join(directory(), `${id}.json`), JSON.stringify({ ...fixture, reporter_id: id }), { mode: 0o600 });
  }
  await emit("session_start"); expect(files()).toHaveLength(256);
});
test("pruning removes only old valid generated records and preserves custom files", async () => {
  await emit("session_start"); const fixture = record(); await emit("session_shutdown");
  const oldId = randomUUID(); const invalidId = randomUUID(); const oldTime = new Date(Date.now() - 65000);
  const oldFile = join(directory(), `${oldId}.json`); const invalidFile = join(directory(), `${invalidId}.json`);
  writeFileSync(oldFile, JSON.stringify({ ...fixture, reporter_id: oldId, updated_at_ms: oldTime.getTime() }), { mode: 0o600 });
  writeFileSync(invalidFile, JSON.stringify({ schema_version: 1, reporter_id: invalidId, updated_at_ms: oldTime.getTime(), private: "custom" }), { mode: 0o600 });
  utimesSync(oldFile, oldTime, oldTime); utimesSync(invalidFile, oldTime, oldTime);
  await emit("session_start"); expect(files()).not.toContain(`${oldId}.json`); expect(files()).toContain(`${invalidId}.json`);
});
test("public session branch replaces main identity immediately", async () => {
  idle = false; await emit("agent_start"); const previous = files()[0];
  session = "branched-main"; idle = true; await emit("session_branch", { reason: "edit" });
  expect(files()).toHaveLength(1); expect(files()[0]).not.toBe(previous);
  expect(record().session_id).toBe("branched-main"); expect(record().status).toBe("idle"); expect(record().run_id).toBeNull();
});
test("contended publication and shutdown leave a paused writer record unchanged", async () => {
  await emit("session_start");
  const path = join(directory(), files()[0]); const original = readFileSync(path, "utf8");
  const fd = holdPublicationLock(); const lockInode = statSync(join(directory(), ".publish.lock")).ino;
  try {
    idle = false; await emit("agent_start"); tick();
    expect(readFileSync(path, "utf8")).toBe(original);
    await emit("session_shutdown");
    expect(readFileSync(path, "utf8")).toBe(original);
    expect(statSync(join(directory(), ".publish.lock")).ino).toBe(lockInode);
  } finally { closeSync(fd); }
});
test("startup pruning waits for paused writer then atomically publishes after release", async () => {
  await emit("session_start"); const fixture = record(); await emit("session_shutdown");
  const id = randomUUID(); const oldTime = new Date(Date.now() - 65000); const path = join(directory(), `${id}.json`);
  writeFileSync(path, JSON.stringify({ ...fixture, reporter_id: id, updated_at_ms: oldTime.getTime() }), { mode: 0o600 });
  utimesSync(path, oldTime, oldTime);
  const original = readFileSync(path, "utf8"); const fd = holdPublicationLock();
  try {
    await emit("session_start");
    expect(files()).toEqual([`${id}.json`]); expect(readFileSync(path, "utf8")).toBe(original);
  } finally { closeSync(fd); }
  tick();
  expect(files()).toHaveLength(1); expect(files()).not.toContain(`${id}.json`); expect(record().health).toBe("ready");
  expect(statSync(join(directory(), ".publish.lock")).mode & 0o7777).toBe(0o600);
});
test("paused shared writer does not block another reporter heartbeat", async () => {
  await emit("session_start"); const run = record().run_id;
  const fd = holdPublicationLock("--shared");
  try {
    idle = false; await emit("agent_start"); tick();
    expect(record().status).toBe("working"); expect(record().run_id).not.toBe(run);
  } finally { closeSync(fd); }
});
test("pruned writer path must reacquire exclusive before capacity check and republish", async () => {
  await emit("session_start"); const fixture = record(); const originalName = files()[0];
  rmSync(join(directory(), originalName));
  for (let i = 0; i < 256; i++) {
    const id = randomUUID(); writeFileSync(join(directory(), `${id}.json`), JSON.stringify({ ...fixture, reporter_id: id }), { mode: 0o600 });
  }
  const fd = holdPublicationLock("--shared");
  try { tick(); expect(files()).toHaveLength(256); expect(files()).not.toContain(originalName); }
  finally { closeSync(fd); }
  tick(); expect(files()).toHaveLength(256); expect(files()).not.toContain(originalName);
});
test("symlinked persistent lock is refused without touching its target", async () => {
  await emit("session_start"); await emit("session_shutdown");
  const lock = join(directory(), ".publish.lock"); rmSync(lock, { force: true });
  const target = join(home, "unrelated-lock-target"); writeFileSync(target, "untouched", { mode: 0o600 });
  symlinkSync(target, lock); await emit("session_start"); tick();
  expect(files()).toEqual([]); expect(readFileSync(target, "utf8")).toBe("untouched");
});
