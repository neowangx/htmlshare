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
#hs-toc-trigger { position: fixed; z-index: 42; top: 50%; right: 0; display: inline-flex; width: 54px; min-height: 92px; padding: 12px 8px; border: 1px solid var(--hs-line); border-right: 0; border-radius: 16px 0 0 16px; background: var(--hs-panel); color: var(--hs-ink); box-shadow: var(--hs-shadow-float); cursor: pointer; font: inherit; flex-direction: column; align-items: center; justify-content: center; gap: 6px; transform: translateY(-50%); transition: opacity 160ms ease-out, transform 160ms ease-out, background 160ms ease-out; }
#hs-toc-trigger:hover { background: var(--hs-accent-soft); }
#hs-toc-trigger:focus-visible, #hs-toc-close:focus-visible, #hs-toc a:focus-visible { outline: 2px solid var(--hs-accent); outline-offset: 2px; }
.hs-toc-trigger-icon { display: grid; width: 18px; gap: 3px; }
.hs-toc-trigger-icon i { display: block; height: 2px; border-radius: 99px; background: var(--hs-accent); }
.hs-toc-trigger-label { font-size: 13px; font-weight: 700; line-height: 1; }
#hs-toc-progress { min-width: 30px; padding: 2px 5px; border-radius: 99px; background: var(--hs-accent-soft); color: var(--hs-accent); font-size: 11px; line-height: 1.3; }
body.hs-toc-open #hs-toc-trigger { opacity: 0; pointer-events: none; transform: translateY(-50%) translateX(12px); }
#hs-toc { position: fixed; z-index: 43; top: 50%; right: 18px; display: flex; width: min(320px, calc(100vw - 36px)); max-height: min(72vh, 640px); overflow: hidden; border: 1px solid var(--hs-line); border-radius: 16px; background: var(--hs-panel); box-shadow: var(--hs-shadow-float); flex-direction: column; opacity: 0; visibility: hidden; pointer-events: none; transform: translateY(-50%) translateX(18px) scale(.985); transform-origin: right center; transition: opacity 180ms ease-out, transform 180ms ease-out, visibility 0s linear 180ms; }
#hs-toc[data-open="true"] { opacity: 1; visibility: visible; pointer-events: auto; transform: translateY(-50%) translateX(0) scale(1); transition-delay: 0s; }
.hs-toc-head { display: flex; padding: 16px 16px 12px; border-bottom: 1px solid var(--hs-line); align-items: center; justify-content: space-between; gap: 12px; }
.hs-toc-title { margin: 0; color: var(--hs-ink); font-size: 14px; font-weight: 700; letter-spacing: .06em; }
#hs-toc-close { display: grid; width: 34px; height: 34px; padding: 0; border: 0; border-radius: 50%; background: var(--hs-panel-subtle); color: var(--hs-muted); cursor: pointer; font: 22px/1 var(--hs-font-body); place-items: center; }
#hs-toc-close:hover { background: var(--hs-accent-soft); color: var(--hs-accent); }
#hs-toc ol { list-style: none; margin: 0; padding: 10px; overflow-y: auto; overscroll-behavior: contain; }
#hs-toc li + li { margin-top: 2px; }
#hs-toc a { position: relative; display: block; padding: 9px 10px 9px 14px; border-radius: var(--hs-radius-control); color: var(--hs-muted); font-size: 13px; line-height: 1.45; text-decoration: none; overflow-wrap: anywhere; transition: background 120ms ease-out, color 120ms ease-out; }
#hs-toc a::before { content: ""; position: absolute; top: 10px; bottom: 10px; left: 5px; width: 2px; border-radius: 99px; background: transparent; }
#hs-toc a:hover { background: var(--hs-accent-soft); color: var(--hs-ink); }
#hs-toc a[aria-current="location"] { background: var(--hs-accent-soft); color: var(--hs-accent); font-weight: 700; }
#hs-toc a[aria-current="location"]::before { background: var(--hs-accent); }
#hs-toc .hs-toc-depth-3 a { padding-left: 24px; }
#hs-toc .hs-toc-depth-4 a { padding-left: 36px; }
#hs-toc-backdrop { display: none; position: fixed; z-index: 41; inset: 0; background: rgba(8, 13, 22, .46); opacity: 0; pointer-events: none; transition: opacity 180ms ease-out; }
.hs-enhanced-content h2, .hs-enhanced-content h3, .hs-enhanced-content h4 { scroll-margin-top: 24px; }
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
@media (max-width: 720px) {
  body.hs-toc-open { overflow: hidden; }
  #hs-toc-trigger { top: auto; right: max(14px, env(safe-area-inset-right)); bottom: max(14px, env(safe-area-inset-bottom)); width: auto; min-width: 96px; min-height: 48px; padding: 9px 12px; border-right: 1px solid var(--hs-line); border-radius: 999px; flex-direction: row; transform: none; }
  body.hs-toc-open #hs-toc-trigger { transform: translateY(12px); }
  .hs-toc-trigger-label { font-size: 14px; }
  #hs-toc { top: auto; right: 12px; bottom: max(12px, env(safe-area-inset-bottom)); left: 12px; width: auto; max-height: min(72vh, 620px); border-radius: 18px; transform: translateY(calc(100% + 24px)); transform-origin: bottom center; }
  #hs-toc[data-open="true"] { transform: translateY(0); }
  #hs-toc-backdrop { display: block; }
  #hs-toc-backdrop[data-open="true"] { opacity: 1; pointer-events: auto; }
  .hs-toc-head { padding-top: 14px; }
  #hs-toc a { min-height: 44px; padding-top: 11px; padding-bottom: 11px; font-size: 14px; }
}
@media print { #hs-toggle, #hs-toc-trigger, #hs-toc, #hs-toc-backdrop { display: none !important; } details { display: block; } }
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
    document.dispatchEvent(new Event("hs:viewchange"));
  }
  toggle.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-view]");
    if (button) show(button.dataset.view);
  });
})();
`;

const TOC_JS = `
(() => {
  const section = document.querySelector("#hs-enhanced");
  const content = section?.querySelector(".hs-enhanced-content");
  const trigger = document.querySelector("#hs-toc-trigger");
  const progress = document.querySelector("#hs-toc-progress");
  const toc = document.querySelector("#hs-toc");
  const closeButton = document.querySelector("#hs-toc-close");
  const backdrop = document.querySelector("#hs-toc-backdrop");
  const list = toc?.querySelector("ol");
  if (!section || !content || !trigger || !progress || !toc || !closeButton || !backdrop || !list) return;

  const headings = [...content.querySelectorAll("h2:not(.hs-a2-headline), h3, h4")]
    .filter((heading) => heading.textContent.trim());
  if (headings.length < 2) return;

  const usedIds = new Set(
    [...document.querySelectorAll("[id]")]
      .filter((element) => !headings.includes(element))
      .map((element) => element.id)
  );
  const links = headings.map((heading, index) => {
    let id = heading.id;
    if (!id || usedIds.has(id)) {
      const base = "hs-section-" + (index + 1);
      id = base;
      let suffix = 2;
      while (usedIds.has(id)) id = base + "-" + suffix++;
      heading.id = id;
    }
    usedIds.add(id);

    const item = document.createElement("li");
    item.className = "hs-toc-depth-" + heading.tagName.slice(1);
    const link = document.createElement("a");
    link.href = "#" + encodeURIComponent(id);
    link.textContent = heading.textContent.trim();
    item.append(link);
    list.append(item);
    link.addEventListener("click", () => {
      setOpen(false);
      requestAnimationFrame(scheduleActive);
    });
    return link;
  });

  let eligible = false;
  let open = false;
  let refreshFrame = 0;
  let activeFrame = 0;

  function setOpen(next, returnFocus = false) {
    open = Boolean(next && eligible);
    toc.dataset.open = String(open);
    toc.setAttribute("aria-hidden", String(!open));
    trigger.setAttribute("aria-expanded", String(open));
    backdrop.dataset.open = String(open);
    document.body.classList.toggle("hs-toc-open", open);
    if (open) {
      requestAnimationFrame(() => {
        if (!open) return;
        closeButton.focus({ preventScroll: true });
        links.find((link) => link.getAttribute("aria-current") === "location")?.scrollIntoView({ block: "nearest" });
      });
    } else if (returnFocus && eligible) {
      requestAnimationFrame(() => trigger.focus({ preventScroll: true }));
    }
  }

  function updateActive() {
    activeFrame = 0;
    if (!eligible) return;
    const marker = Math.min(window.innerHeight * .28, 180);
    let current = 0;
    headings.forEach((heading, index) => {
      if (heading.getBoundingClientRect().top <= marker) current = index;
    });
    links.forEach((link, index) => {
      if (index === current) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
    progress.textContent = (current + 1) + "/" + headings.length;
  }

  function scheduleActive() {
    if (!activeFrame) activeFrame = requestAnimationFrame(updateActive);
  }

  function refresh() {
    refreshFrame = 0;
    eligible = !section.hidden && content.scrollHeight > window.innerHeight * 2;
    trigger.hidden = !eligible;
    toc.hidden = !eligible;
    backdrop.hidden = !eligible;
    if (!eligible) setOpen(false);
    else updateActive();
  }
  function scheduleRefresh() {
    if (!refreshFrame) refreshFrame = requestAnimationFrame(refresh);
  }

  trigger.addEventListener("click", () => setOpen(!open));
  closeButton.addEventListener("click", () => setOpen(false, true));
  backdrop.addEventListener("click", () => setOpen(false, true));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && open) setOpen(false, true);
    if (event.key === "Tab" && open && matchMedia("(max-width: 720px)").matches) {
      const first = closeButton;
      const last = links[links.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });
  document.addEventListener("pointerdown", (event) => {
    if (open && !toc.contains(event.target) && !trigger.contains(event.target) && !backdrop.contains(event.target)) setOpen(false);
  });
  scheduleRefresh();
  addEventListener("resize", scheduleRefresh, { passive: true });
  addEventListener("scroll", scheduleActive, { passive: true });
  document.addEventListener("hs:viewchange", scheduleRefresh);
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
  const enhancedBlock = hasEnhanced ? `<section id="hs-enhanced" class="hs-panel"><div class="hs-enhanced-content">${a2.html}</div></section>` : "";
  const tocShell = hasEnhanced
    ? `<button id="hs-toc-trigger" type="button" aria-controls="hs-toc" aria-expanded="false" hidden><span class="hs-toc-trigger-icon" aria-hidden="true"><i></i><i></i><i></i></span><span class="hs-toc-trigger-label">目录</span><span id="hs-toc-progress">1/1</span></button><div id="hs-toc-backdrop" aria-hidden="true" hidden></div><nav id="hs-toc" aria-labelledby="hs-toc-title" aria-hidden="true" hidden><div class="hs-toc-head"><p id="hs-toc-title" class="hs-toc-title">文章目录</p><button id="hs-toc-close" type="button" aria-label="收起目录">×</button></div><ol></ol></nav>`
    : "";
  const faithfulHidden = hasEnhanced ? " hidden" : "";
  const footerNote = codeProtected ? " · 轻量访问码保护" : "";
  const footer = footerBadge ? `<footer class="hs-footer">made with htmlshare${footerNote}</footer>` : "";
  const script = `<script>${PRINT_JS}${hasEnhanced ? `${TOGGLE_JS}${TOC_JS}` : ""}</script>`;

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
${tocShell}
${script}
</body>
</html>`;

  return { html, mode: hasEnhanced ? "dual" : "faithful", validation: { ok: a2.ok, warnings: a2.warnings, errors: a2.errors } };
}

export { STYLES };
