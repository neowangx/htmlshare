import { escapeHtml } from "./convert.js";
import { sanitizeEnhanced } from "./lib/sanitize.js";
import { get as getTemplate, TEMPLATE_SLOTS } from "./templates/registry.js";
import { get as getStyle, list as listStyles } from "./styles/registry.js";

const TEMPLATES = TEMPLATE_SLOTS;

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
.hs-tldr { margin: 0 0 20px; padding: 16px 18px; border-left: 4px solid var(--hs-accent); background: var(--hs-accent-soft); }
.hs-tldr h2, .hs-section h2 { font-size: 16px; margin: 0 0 10px; letter-spacing: 0; }
.hs-tldr ul { margin: 0; padding-left: 20px; }
.hs-section + .hs-section { margin-top: 20px; padding-top: 20px; border-top: 1px solid var(--hs-line); }
.hs-footer { margin-top: 22px; color: var(--hs-muted); font-size: 13px; }
table { border-collapse: collapse; width: 100%; }
th, td { border: 1px solid var(--hs-line); padding: 6px 8px; }
pre { overflow: auto; padding: 12px; background: var(--hs-code-bg); color: var(--hs-code-ink); border-radius: var(--hs-radius-control); }
code { font-family: var(--hs-font-code); }
.hljs-comment, .hljs-quote { color: var(--hs-muted); font-style: italic; }
.hljs-keyword, .hljs-selector-tag, .hljs-built_in, .hljs-name, .hljs-tag { color: var(--hs-accent); }
.hljs-string, .hljs-attr, .hljs-symbol, .hljs-number, .hljs-literal, .hljs-meta { color: var(--hs-code-accent, var(--hs-accent)); }
.hljs-title, .hljs-section, .hljs-type, .hljs-function .hljs-title { color: var(--hs-code-ink); font-weight: 600; }
.hljs-emphasis { font-style: italic; }
.hljs-strong { font-weight: 700; }
img { max-width: 100%; height: auto; }
.hs-action-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; }
.hs-action-card { border: 1px solid var(--hs-line); border-radius: var(--hs-radius-card); padding: 14px; background: var(--hs-panel-subtle); }
.hs-action-card p { margin: 10px 0; }
.hs-action-owner, .hs-action-due { display: inline-flex; color: var(--hs-muted); font-size: 13px; }
.hs-action-owner { border: 1px solid var(--hs-line); border-radius: 999px; padding: 2px 8px; }
.hs-steps li + li { margin-top: 8px; }
.hs-faq-item + .hs-faq-item { margin-top: 10px; }
.hs-change-group + .hs-change-group { margin-top: 14px; }
.hs-change-badge { display: inline-flex; border: 1px solid var(--hs-line); border-radius: 999px; padding: 2px 8px; color: var(--hs-muted); font-size: 13px; }
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

function parseEnhanced(input) {
  if (input == null || input === "") return null;
  if (typeof input === "string") return JSON.parse(input);
  return input;
}

function textLength(html) {
  return String(html || "").replace(/<[^>]*>/g, "").replace(/\s+/g, "").length;
}

function validateShape(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return value.version === 1
    && typeof value.template === "string"
    && typeof value.style === "string"
    && typeof value.title === "string"
    && Array.isArray(value.tldr)
    && Array.isArray(value.sections);
}

function normalizeTldr(items) {
  return items
    .filter((item) => typeof item === "string" && item.trim().length > 0)
    .slice(0, 5)
    .map((item) => ([...item].length > 80 ? [...item].slice(0, 80).join("") : item));
}

// C4: honor an explicit user --template by re-filtering the agent's sections against the
// forced template's slot set (same rule as V3). Sections whose slot the new template can't
// place are dropped with a warning rather than silently mis-rendered.
function remapTemplate(enhanced, template, warnings) {
  const allowed = new Set(TEMPLATES[template]);
  const sections = enhanced.sections.filter((section) => {
    if (allowed.has(section.slot)) return true;
    warnings.push(`V3: dropped section "${section.slot}" not valid for overridden template "${template}"`);
    return false;
  });
  return { ...enhanced, template, sections };
}

export function validateEnhanced(input, faithfulHtml = "") {
  const warnings = [];
  const errors = [];
  let parsed;

  try {
    parsed = parseEnhanced(input);
  } catch (error) {
    return { ok: false, enhanced: null, warnings, errors: [`V1: ${error.message}`] };
  }

  if (parsed == null) {
    return { ok: false, enhanced: null, warnings, errors: ["NO_ENHANCED"] };
  }

  if (!validateShape(parsed)) {
    return { ok: false, enhanced: null, warnings, errors: ["V1: enhanced.json must include version=1, template, style, title, tldr, sections"] };
  }

  if (!Object.hasOwn(TEMPLATES, parsed.template) || !STYLES.has(parsed.style)) {
    return { ok: false, enhanced: null, warnings, errors: ["V2: invalid template or style"] };
  }

  const allowedSlots = new Set(TEMPLATES[parsed.template]);
  const sections = [];

  for (const section of parsed.sections) {
    if (!section || !allowedSlots.has(section.slot)) {
      warnings.push("V3: dropped invalid section slot");
      continue;
    }

    const html = sanitizeEnhanced(String(section.html || ""));
    if (!html) {
      warnings.push("V4: dropped empty sanitized section");
      continue;
    }

    sections.push({ slot: section.slot, html });
  }

  const tldr = normalizeTldr(parsed.tldr);
  if (tldr.length !== parsed.tldr.length || parsed.tldr.some((item) => typeof item === "string" && item.length > 80)) {
    warnings.push("V5: normalized tldr length or item size");
  }

  if (tldr.length === 0 || sections.length === 0) {
    return { ok: false, enhanced: null, warnings, errors: ["V1: enhanced content is empty after validation"] };
  }

  const enhanced = { ...parsed, tldr, sections };
  const enhancedLength = textLength(renderEnhancedBody(enhanced));
  const faithfulLength = textLength(faithfulHtml);
  if (faithfulLength > 0 && enhancedLength < faithfulLength * 0.3) {
    warnings.push("V6: enhanced content is shorter than 30% of faithful content");
    return { ok: false, enhanced: null, warnings, errors: ["V6: enhanced content too short"] };
  }

  return { ok: true, enhanced, warnings, errors };
}

function renderEnhancedBody(enhanced) {
  const template = getTemplate(enhanced.template);
  return template.render(enhanced.sections, {
    title: enhanced.title,
    tldr: enhanced.tldr,
    template: enhanced.template,
    style: enhanced.style
  });
}

function renderToggle(hasEnhanced) {
  if (!hasEnhanced) return "";
  return `<div id="hs-toggle" role="group" aria-label="视图切换"><button type="button" data-view="faithful" aria-pressed="false">原文</button><button type="button" data-view="enhanced" aria-pressed="true">增强</button></div>`;
}

function normalizeStyle(style) {
  return style && style !== "auto" ? style : "clinical";
}

export function composePage({ title, faithfulHtml, enhanced = null, footerBadge = true, directHtml = false, style = "clinical", styleOverride = null, templateOverride = null, codeProtected = true } = {}) {
  if (directHtml) {
    return { html: String(faithfulHtml || ""), mode: "direct", validation: { ok: false, warnings: [], errors: [] } };
  }

  const validation = validateEnhanced(enhanced, faithfulHtml);
  let hasEnhanced = validation.ok;
  // D5 / docs05 §3: an explicit user --template/--style wins unconditionally over the
  // agent-chosen values embedded in enhanced.json.
  if (hasEnhanced && templateOverride && templateOverride !== "auto") {
    if (Object.hasOwn(TEMPLATES, templateOverride)) {
      validation.enhanced = remapTemplate(validation.enhanced, templateOverride, validation.warnings);
      hasEnhanced = validation.enhanced.sections.length > 0;
    }
  }
  const pageTitle = escapeHtml((hasEnhanced ? validation.enhanced.title : title) || "Untitled");
  const enhancedStyle = hasEnhanced ? validation.enhanced.style : style;
  const chosenStyle = styleOverride && styleOverride !== "auto" ? styleOverride : enhancedStyle;
  const pageStyle = normalizeStyle(chosenStyle);
  const styleCss = `${getStyle(pageStyle).css}\n${STRUCTURE_CSS}`;
  const enhancedBlock = hasEnhanced ? `<section id="hs-enhanced" class="hs-panel">${renderEnhancedBody(validation.enhanced)}</section>` : "";
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

  return { html, mode: hasEnhanced ? "dual" : "faithful", validation };
}

export { TEMPLATES, STYLES };
