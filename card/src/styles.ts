import { css } from 'lit';

// Visual reference: tty7 8c5ea523, src/ui/presets.rs and tab_sidebar.rs.
// Independently written CSS; no upstream logos, fonts, artwork, or source code copied.
// Neutral default pair / 3% rail tint and blue, green, amber roles follow the reference.
export const cardStyles = css`
  :host {
    display: block; min-width: 0;
    font-family: var(--ha-font-family-body, system-ui, sans-serif); font-size: 14px;
  }
  :host(:not([appearance='home-assistant'])) {
    color-scheme: light;
    --tty-bg: #fcfcfb; --tty-ink: #1c1c1e; --tty-rail: #f5f5f3;
    --tty-muted: #626267; --tty-line: #c5c5c4; --tty-hover: #ededec;
    --tty-blue: #1f6bf0; --tty-green: #2f8a52; --tty-amber: #b7791f; --tty-red: #c43c43;
  }
  :host([dark]:not([appearance='home-assistant'])) {
    color-scheme: dark; --tty-bg: #18181a; --tty-ink: #ececed; --tty-rail: #1e1e20;
    --tty-muted: #aaaab0; --tty-line: #505055; --tty-hover: #2b2b2e;
    --tty-blue: #78a8f5; --tty-green: #4cc27a; --tty-amber: #e0a345; --tty-red: #f07878;
  }
  :host([appearance='home-assistant']) {
    color-scheme: inherit;
    --tty-ink: var(--primary-text-color); --tty-muted: var(--secondary-text-color);
    --tty-rail: transparent; --tty-line: var(--divider-color);
    --tty-hover: var(--secondary-background-color);
    --tty-blue: var(--primary-color); --tty-green: var(--success-color);
    --tty-amber: var(--warning-color); --tty-red: var(--error-color);
  }
  * { box-sizing: border-box; }
  [hidden] { display: none !important; }
  ha-card { display: block; overflow: hidden; }
  :host(:not([appearance='home-assistant'])) ha-card {
    background: var(--tty-bg); color: var(--tty-ink);
    border: 1px solid var(--tty-line); border-radius: var(--ha-card-border-radius, 12px);
  }
  header { display: flex; align-items: center; justify-content: space-between; gap: 12px;
    padding: 12px 14px; border-bottom: 1px solid var(--tty-line); }
  h1 { margin: 0; min-width: 0; overflow-wrap: anywhere; font-size: 16px; font-weight: 600; letter-spacing: -.02em; }
  .brand { font-family: ui-monospace, 'Cascadia Code', 'DejaVu Sans Mono', monospace; font-weight: 700; }
  label { display: grid; gap: 3px; min-width: 0; max-width: 52%; color: var(--tty-muted); font-size: 12px; }
  select { max-width: 100%; min-width: 0; min-height: 44px; padding: 7px; font: inherit;
    color: var(--tty-ink); background: var(--tty-rail); border: 1px solid var(--tty-line); border-radius: 5px; }
  section { min-width: 0; }
  section + section { border-top: 1px solid var(--tty-line); }
  .host-head { padding: 12px 14px 8px; background: var(--tty-rail); }
  .host-title { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 6px 12px; }
  h2 { font-size: 13px; font-weight: 600; margin: 0; overflow-wrap: anywhere; }
  .host-state { font-size: 12px; font-weight: 600; }
  .host-state[data-state='error'], .host-state[data-state='malformed'] { color: var(--tty-red); }
  .receipt { color: var(--tty-muted); margin: 5px 0 0; font-size: 12px; overflow-wrap: anywhere; }
  .notice { margin: 0; padding: 9px 14px; font-size: 12px; color: var(--tty-muted); background: var(--tty-rail); overflow-wrap: anywhere; }
  ul { padding: 4px 6px 8px; margin: 0; list-style: none; }
  li { min-width: 0; border-radius: 5px; }
  .agent-row { display: grid; width: 100%; grid-template-columns: 26px minmax(0, 1fr) auto 12px;
    align-items: center; gap: 9px; min-height: 58px; padding: 8px;
    border: 0; border-radius: 5px; text-align: left; color: var(--tty-ink); background: transparent; cursor: pointer; font: inherit; }
  .agent-row:hover, .agent-row[aria-expanded='true'] { background: var(--tty-hover); }
  button:focus-visible, select:focus-visible { outline: 2px solid var(--tty-blue); outline-offset: -2px; }
  .agent-icon { width: 24px; height: 24px; border: 1px solid var(--tty-line); border-radius: 6px;
    display: grid; place-items: center; background: var(--tty-rail); color: var(--tty-muted); }
  svg { width: 16px; height: 16px; }
  .agent-copy { min-width: 0; display: grid; gap: 3px; }
  .agent-name { font-size: 14px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .identity { font-size: 12px; color: var(--tty-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    font-variant-numeric: tabular-nums; }
  .status { display: inline-flex; gap: 5px; align-items: center; font-size: 12px; white-space: nowrap; }
  .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--tty-muted); flex-shrink: 0; }
  .status[data-status='working'] .dot { background: var(--tty-blue); }
  .status[data-status='waiting'] .dot { background: var(--tty-amber); }
  .status[data-status='done'] .dot { background: var(--tty-green); }
  .status[data-status='idle'] .dot { background: transparent; border: 1px solid var(--tty-muted); }
  .chevron { color: var(--tty-muted); font-size: 16px; }
  .last-known .agent-row { border-left: 2px solid var(--tty-line); }
  dl { display: grid; grid-template-columns: minmax(80px, 1fr) minmax(0, 2fr); gap: 8px 12px;
    margin: 0 8px 8px; padding: 12px; border-left: 2px solid var(--tty-blue); background: var(--tty-rail); font-size: 12px; }
  dt { color: var(--tty-muted); }
  dd { margin: 0; min-width: 0; overflow-wrap: anywhere; white-space: pre-wrap;
    font-family: ui-monospace, 'Cascadia Code', 'DejaVu Sans Mono', monospace; }
  .configuration { margin: 0; padding: 16px; line-height: 1.5; }
  .metadata { color: var(--tty-muted); font-size: 12px; overflow-wrap: anywhere; min-width: 0; }
  .summary, .filtered-count { color: var(--tty-muted); font-size: 12px; margin: 6px 0 0; font-variant-numeric: tabular-nums; }
  .group-head { display: flex; flex-wrap: wrap; gap: 4px 10px; padding: 9px 8px 5px; font-size: 12px; color: var(--tty-muted); overflow-wrap: anywhere; }
  .group-head h3 { flex-basis: 100%; min-width: 0; margin: 0; font-size: 13px; font-weight: 600; color: var(--tty-ink); }
  .workspace-title { margin: 10px 14px 0; font-size: 13px; font-weight: 600; overflow-wrap: anywhere; }
  .tab-group + .tab-group { border-top: 1px solid var(--tty-line); }
  .source { padding: 8px 14px 12px; color: var(--tty-muted); font-size: 12px; }
  .source summary { min-height: 44px; display: list-item; align-content: center; cursor: pointer; }
  .source summary:focus-visible { outline: 2px solid var(--tty-blue); }
  .source dl { margin: 0; }
  .inventory-panes { padding-top: 0; }
  @media (max-width: 380px) {
    header { padding: 10px; gap: 8px; }
    .host-head { padding: 10px; }
    .agent-row { gap: 6px; grid-template-columns: 24px minmax(0, 1fr) auto 10px; }
    dl { padding: 10px; gap: 8px; }
  }
  @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; transition: none !important; } }
`;
