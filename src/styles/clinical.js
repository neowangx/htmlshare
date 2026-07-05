export const name = "clinical";

export const css = `
:root {
  color-scheme: light dark;
  --hs-bg: #F7F8FA;
  --hs-panel: #FFFFFF;
  --hs-panel-subtle: #FBFCFD;
  --hs-ink: #1A2233;
  --hs-muted: #5A6472;
  --hs-line: #DFE5EE;
  --hs-accent: #2456D6;
  --hs-accent-ink: #FFFFFF;
  --hs-accent-soft: #EAF0FF;
  --hs-code-bg: #111827;
  --hs-code-ink: #F9FAFB;
  --hs-shadow-card: 0 1px 3px rgba(16,24,40,.07);
  --hs-shadow-float: 0 8px 24px rgba(16,24,40,.12);
  --hs-radius-card: 10px;
  --hs-radius-control: 8px;
  --hs-font-body: -apple-system, "PingFang SC", "Noto Sans SC", sans-serif;
  --hs-font-code: ui-monospace, "SF Mono", Menlo, monospace;
}

@media (prefers-color-scheme: dark) {
  :root {
    --hs-bg: #10151C;
    --hs-panel: #171E27;
    --hs-panel-subtle: #121922;
    --hs-ink: #E8EEF7;
    --hs-muted: #A8B3C1;
    --hs-line: #2B3542;
    --hs-accent: #7AA2FF;
    --hs-accent-ink: #07111F;
    --hs-accent-soft: #1B2B4D;
    --hs-code-bg: #0B1017;
    --hs-code-ink: #E8EEF7;
    --hs-shadow-card: 0 1px 3px rgba(0,0,0,.28);
    --hs-shadow-float: 0 8px 24px rgba(0,0,0,.35);
  }
}`;
