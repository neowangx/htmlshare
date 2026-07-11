import { escapeHtml } from "./convert.js";
import { renderA2UI } from "./a2ui/render.js";
import { COMPONENT_CSS } from "./a2ui/catalog.js";
import { get as getStyle, list as listStyles } from "./styles/registry.js";

const STYLES = new Set(listStyles());

const STRUCTURE_CSS = `
* { box-sizing: border-box; }
body { margin: 0; background: var(--hs-bg); color: var(--hs-ink); font: 16px/1.65 var(--hs-font-body); }
main { width: min(960px, calc(100% - 32px)); margin: 40px auto; }
.hs-topbar { display: flex; align-items: center; justify-content: space-between; gap: 16px; border-bottom: 1px solid var(--hs-line); padding-bottom: 16px; margin-bottom: 24px; }
h1 { font-size: 28px; line-height: 1.2; margin: 0; letter-spacing: 0; }
#hs-toggle { display: inline-flex; gap: 4px; border: 1px solid var(--hs-line); border-radius: var(--hs-radius-control); padding: 4px; background: var(--hs-panel); }
#hs-toggle button { border: 0; border-radius: calc(var(--hs-radius-control) - 2px); padding: 6px 10px; background: transparent; color: var(--hs-muted); cursor: pointer; font: inherit; transition: background 120ms ease-out, color 120ms ease-out; }
#hs-toggle button[aria-pressed="true"] { background: var(--hs-accent); color: var(--hs-accent-ink); }
.hs-panel { background: var(--hs-panel); border: 1px solid var(--hs-line); border-radius: var(--hs-radius-card); padding: 24px; box-shadow: var(--hs-shadow-card); }
.hs-footer { margin-top: 22px; color: var(--hs-muted); font-size: 13px; }
table { border-collapse: collapse; width: 100%; }
th, td { border: 1px solid var(--hs-line); padding: 6px 8px; text-align: left; }
pre { overflow: auto; padding: 12px; background: var(--hs-code-bg); color: var(--hs-code-ink); border-radius: var(--hs-radius-control); }
code { font-family: var(--hs-font-code); }
.hljs-comment, .hljs-quote { color: var(--hs-muted); font-style: italic; }
.hljs-keyword, .hljs-selector-tag, .hljs-built_in, .hljs-name, .hljs-tag { color: var(--hs-accent); }
.hljs-string, .hljs-attr, .hljs-symbol, .hljs-number, .hljs-literal, .hljs-meta { color: var(--hs-code-accent, var(--hs-accent)); }
.hljs-title, .hljs-section, .hljs-type, .hljs-function .hljs-title { color: var(--hs-code-ink); font-weight: 600; }
.hljs-emphasis { font-style: italic; }
.hljs-strong { font-weight: 700; }
img { max-width: 100%; height: auto; }
details > summary { cursor: pointer; }
@media print { #hs-toggle { display: none; } details { display: block; } }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { transition: none !important; animation: none !important; } }
`;

// Reliably expand every <details> for printing: CSS can't override the UA shadow-DOM
// that hides closed <details> content, so toggle the open attribute around print.
const PRINT_JS = `
(() => {
  let opened = [];
  addEventListener("beforeprint", () => {
    opened = [...document.querySelectorAll("details:not([open])")];
    for (const el of opened) el.open = true;
  });
  addEventListener("afterprint", () => {
    for (const el of opened) el.open = false;
    opened = [];
  });
})();
`;

const TOGGLE_JS = `
(() => {
  const toggle = document.querySelector("#hs-toggle");
  if (!toggle) return;
  const enhanced = document.querySelector("#hs-enhanced");
  const faithful = document.querySelector("#hs-faithful");
  function show(view) {
    enhanced.hidden = view !== "enhanced";
    faithful.hidden = view !== "faithful";
    for (const button of toggle.querySelectorAll("button")) {
      button.setAttribute("aria-pressed", String(button.dataset.view === view));
    }
  }
  toggle.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-view]");
    if (button) show(button.dataset.view);
  });
})();
`;

function renderToggle(hasEnhanced) {
  if (!hasEnhanced) return "";
  return `<div id="hs-toggle" role="group" aria-label="视图切换"><button type="button" data-view="faithful" aria-pressed="false">原文</button><button type="button" data-view="enhanced" aria-pressed="true">增强</button></div>`;
}

// Themes are the CSS-variable layer (styles/*): normalize any unknown/auto choice to clinical
// so getStyle never throws on model- or user-supplied values.
function normalizeStyle(style) {
  return style && style !== "auto" && STYLES.has(style) ? style : "clinical";
}

// Thin wrapper kept for tests/tooling that validate an A2UI doc without composing a full page.
export function validateA2UI(input) {
  return renderA2UI(input);
}

export function composePage({ title, faithfulHtml, enhanced = null, footerBadge = true, directHtml = false, style = "clinical", styleOverride = null, codeProtected = true } = {}) {
  if (directHtml) {
    return { html: String(faithfulHtml || ""), mode: "direct", validation: { ok: false, warnings: [], errors: [] } };
  }

  const a2 = renderA2UI(enhanced);
  const hasEnhanced = a2.ok;
  const pageTitle = escapeHtml((hasEnhanced && a2.title) || title || "Untitled");
  // D5 / docs05: an explicit user --style wins over the model's theme choice in the A2UI doc.
  const chosenStyle = styleOverride && styleOverride !== "auto" ? styleOverride : (a2.theme || style);
  const pageStyle = normalizeStyle(chosenStyle);
  const styleCss = `${getStyle(pageStyle).css}\n${STRUCTURE_CSS}\n${COMPONENT_CSS}`;
  const enhancedBlock = hasEnhanced ? `<section id="hs-enhanced" class="hs-panel">${a2.html}</section>` : "";
  const faithfulHidden = hasEnhanced ? " hidden" : "";
  const footerNote = codeProtected ? " · 轻量访问码保护" : "";
  const footer = footerBadge ? `<footer class="hs-footer">made with htmlshare${footerNote}</footer>` : "";
  const script = `<script>${PRINT_JS}${hasEnhanced ? TOGGLE_JS : ""}</script>`;

  const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${pageTitle}</title>
<style>${styleCss}</style>
</head>
<body data-hs-style="${escapeHtml(pageStyle)}">
<main>
<header class="hs-topbar"><h1>${pageTitle}</h1>${renderToggle(hasEnhanced)}</header>
${enhancedBlock}
<section id="hs-faithful" class="hs-panel"${faithfulHidden}>${faithfulHtml || ""}</section>
${footer}
</main>
${script}
</body>
</html>`;

  return { html, mode: hasEnhanced ? "dual" : "faithful", validation: { ok: a2.ok, warnings: a2.warnings, errors: a2.errors } };
}

export { STYLES };
