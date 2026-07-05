export const name = "minimal";

export const css = `
:root {
  color-scheme: light dark;
  --hs-bg: #FCFCFC;
  --hs-panel: #FCFCFC;
  --hs-panel-subtle: #F4F4F4;
  --hs-ink: #171717;
  --hs-muted: #5F6368;
  --hs-line: #D9D9D9;
  --hs-accent: #1E4FD6;
  --hs-accent-ink: #FFFFFF;
  --hs-accent-soft: #EEF2FF;
  --hs-code-bg: #F3F3F3;
  --hs-code-ink: #171717;
  --hs-shadow-card: none;
  --hs-shadow-float: none;
  --hs-radius-card: 0;
  --hs-radius-control: 0;
  --hs-font-body: -apple-system, "PingFang SC", "Noto Sans SC", sans-serif;
  --hs-font-code: ui-monospace, "SF Mono", Menlo, monospace;
}

@media (prefers-color-scheme: dark) {
  :root {
    --hs-bg: #111111;
    --hs-panel: #111111;
    --hs-panel-subtle: #1B1B1B;
    --hs-ink: #EDEDED;
    --hs-muted: #B6B6B6;
    --hs-line: #343434;
    --hs-accent: #9AB6FF;
    --hs-accent-ink: #101010;
    --hs-accent-soft: #1D2740;
    --hs-code-bg: #1D1D1D;
    --hs-code-ink: #EDEDED;
  }
}`;
