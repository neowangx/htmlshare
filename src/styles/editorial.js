export const name = "editorial";

export const css = `
:root {
  color-scheme: light dark;
  --hs-bg: #FAF9F6;
  --hs-panel: #FFFDF8;
  --hs-panel-subtle: #F5F0E8;
  --hs-ink: #201B16;
  --hs-muted: #6D6258;
  --hs-line: #DDD3C7;
  --hs-accent: #8A3B24;
  --hs-accent-ink: #FFFFFF;
  --hs-accent-soft: #F3E4DC;
  --hs-code-bg: #28231F;
  --hs-code-ink: #F8F1E8;
  --hs-shadow-card: none;
  --hs-shadow-float: 0 8px 24px rgba(32,27,22,.12);
  --hs-radius-card: 6px;
  --hs-radius-control: 6px;
  --hs-font-body: Georgia, "Songti SC", "PingFang SC", serif;
  --hs-font-code: ui-monospace, "SF Mono", Menlo, monospace;
}

@media (prefers-color-scheme: dark) {
  :root {
    --hs-bg: #17130F;
    --hs-panel: #211B16;
    --hs-panel-subtle: #2A221B;
    --hs-ink: #F2E9DD;
    --hs-muted: #C1B3A5;
    --hs-line: #43372D;
    --hs-accent: #E4A084;
    --hs-accent-ink: #251109;
    --hs-accent-soft: #3B241C;
    --hs-code-bg: #100D0A;
    --hs-code-ink: #F2E9DD;
    --hs-shadow-float: 0 8px 24px rgba(0,0,0,.32);
  }
}`;
