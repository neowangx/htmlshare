import { escapeHtml } from "../convert.js";
import { renderChart } from "./chart.js";

// The A2UI static component catalog: each entry translates one abstract component (with its
// data-binding already resolved by render.js) into hand-written, sanitized, single-file HTML.
// The model only picks component types + fills structured props — it never ships raw HTML,
// except through RichText/Callout text which is run through the sanitize whitelist. This keeps
// D12/D14 (single-file, zero-JS, zero-external) and the altitude/whitelist invariants intact.

const VARIANT_TAG = { h1: "h2", h2: "h3", h3: "h4", body: "p", caption: "p" };
const CALLOUT_TONES = new Set(["info", "warning", "success", "danger"]);

function str(value) {
  return value == null ? "" : String(value);
}

function text(node, ctx) {
  const tag = VARIANT_TAG[node.variant] || "p";
  const cls = node.variant === "caption" ? ' class="hs-a2-caption"' : "";
  const content = escapeHtml(str(ctx.resolve(node.text)));
  if (!content) return "";
  return `<${tag}${cls}>${content}</${tag}>`;
}

function richText(node, ctx) {
  const html = ctx.sanitize(str(ctx.resolve(node.html ?? node.richText)));
  return html ? `<div class="hs-a2-rich">${html}</div>` : "";
}

function column(node, ctx) {
  const inner = ctx.renderChildren(node.children);
  return inner ? `<div class="hs-a2-col">${inner}</div>` : "";
}

function row(node, ctx) {
  const inner = ctx.renderChildren(node.children);
  return inner ? `<div class="hs-a2-row">${inner}</div>` : "";
}

function grid(node, ctx) {
  const inner = ctx.renderChildren(node.children);
  return inner ? `<div class="hs-a2-grid">${inner}</div>` : "";
}

function card(node, ctx) {
  const inner = ctx.renderChildren(node.children);
  return inner ? `<div class="hs-a2-card">${inner}</div>` : "";
}

function divider() {
  return `<hr class="hs-a2-divider">`;
}

function list(node, ctx) {
  const items = Array.isArray(node.items) ? node.items : [];
  const rows = items
    .map((item) => escapeHtml(str(ctx.resolve(item))))
    .filter(Boolean)
    .map((item) => `<li>${item}</li>`)
    .join("");
  if (!rows) return "";
  const tag = node.ordered ? "ol" : "ul";
  return `<${tag} class="hs-a2-list">${rows}</${tag}>`;
}

function table(node, ctx) {
  const headers = Array.isArray(node.headers) ? node.headers : [];
  const rows = Array.isArray(node.rows) ? node.rows : [];
  const head = headers.length
    ? `<thead><tr>${headers.map((h) => `<th>${escapeHtml(str(ctx.resolve(h)))}</th>`).join("")}</tr></thead>`
    : "";
  const body = rows
    .map((cells) => `<tr>${(Array.isArray(cells) ? cells : []).map((c) => `<td>${escapeHtml(str(ctx.resolve(c)))}</td>`).join("")}</tr>`)
    .join("");
  if (!head && !body) return "";
  return `<div class="hs-a2-tablewrap"><table>${head}<tbody>${body}</tbody></table></div>`;
}

function image(node, ctx) {
  const src = str(ctx.resolve(node.src)).trim();
  // Relative/file sources are resolved and embedded by the publish collector after A2UI render.
  // Reject active schemes here; the collector never attempts to read them.
  if (!src || /^(?:javascript:|vbscript:)/i.test(src)) {
    ctx.warn(`IMAGE: A2UI Image src invalid, skipped: ${src || "(empty)"}`);
    return "";
  }
  const alt = escapeHtml(str(ctx.resolve(node.alt)));
  return `<img class="hs-a2-img" src="${escapeHtml(src)}" alt="${alt}">`;
}

function hero(node, ctx) {
  const kicker = escapeHtml(str(ctx.resolve(node.kicker)));
  const headline = escapeHtml(str(ctx.resolve(node.headline)));
  const meta = escapeHtml(str(ctx.resolve(node.meta)));
  if (!headline && !kicker) return "";
  return `<header class="hs-a2-hero">`
    + (kicker ? `<p class="hs-a2-kicker">${kicker}</p>` : "")
    + (headline ? `<h2 class="hs-a2-headline">${headline}</h2>` : "")
    + (meta ? `<p class="hs-a2-herometa">${meta}</p>` : "")
    + `</header>`;
}

function statGrid(node, ctx) {
  const items = Array.isArray(node.items) ? node.items : [];
  const cells = items.map((item) => {
    const value = escapeHtml(str(ctx.resolve(item?.value)));
    const label = escapeHtml(str(ctx.resolve(item?.label)));
    if (!value && !label) return "";
    return `<div class="hs-a2-stat"><span class="hs-a2-statval">${value}</span><span class="hs-a2-statlabel">${label}</span></div>`;
  }).join("");
  return cells ? `<div class="hs-a2-statgrid">${cells}</div>` : "";
}

function callout(node, ctx) {
  const tone = CALLOUT_TONES.has(node.tone) ? node.tone : "info";
  const body = ctx.sanitize(str(ctx.resolve(node.html ?? node.text)));
  if (!body) return "";
  return `<div class="hs-a2-callout hs-a2-callout-${tone}">${body}</div>`;
}

function quote(node, ctx) {
  const body = escapeHtml(str(ctx.resolve(node.text)));
  if (!body) return "";
  const cite = escapeHtml(str(ctx.resolve(node.cite)));
  return `<blockquote class="hs-a2-quote"><p>${body}</p>${cite ? `<cite>${cite}</cite>` : ""}</blockquote>`;
}

function timeline(node, ctx) {
  const items = Array.isArray(node.items) ? node.items : [];
  const rows = items.map((item) => {
    const title = escapeHtml(str(ctx.resolve(item?.title)));
    const detail = escapeHtml(str(ctx.resolve(item?.detail)));
    const time = escapeHtml(str(ctx.resolve(item?.time)));
    if (!title && !detail) return "";
    return `<li class="hs-a2-tl-item">`
      + (time ? `<span class="hs-a2-tl-time">${time}</span>` : "")
      + (title ? `<span class="hs-a2-tl-title">${title}</span>` : "")
      + (detail ? `<span class="hs-a2-tl-detail">${detail}</span>` : "")
      + `</li>`;
  }).join("");
  return rows ? `<ul class="hs-a2-timeline">${rows}</ul>` : "";
}

export const TAB_MAX = 8;

// CSS-only tabs: radios come first so a checked radio can reveal its matching label + panel by
// nth-of-type pairing (see COMPONENT_CSS). All-radios-then-labels-then-panels keeps a single
// global rule set working for any Tabs instance. Zero JS. Beyond TAB_MAX tabs the extras still
// render but only the first TAB_MAX toggle.
function tabs(node, ctx) {
  const list = Array.isArray(node.tabs) ? node.tabs : [];
  if (!list.length) return "";
  const group = ctx.uid("tabs");
  const radios = [];
  const labels = [];
  const panels = [];
  list.forEach((tab, index) => {
    const id = `${group}-${index}`;
    const label = escapeHtml(str(ctx.resolve(tab?.label))) || `Tab ${index + 1}`;
    const checked = index === 0 ? " checked" : "";
    radios.push(`<input type="radio" name="${group}" id="${id}" class="hs-a2-tabradio"${checked}>`);
    labels.push(`<label for="${id}" class="hs-a2-tablabel">${label}</label>`);
    panels.push(`<div class="hs-a2-tabpanel">${ctx.renderChildren(tab?.children)}</div>`);
  });
  return `<div class="hs-a2-tabs">${radios.join("")}${labels.join("")}${panels.join("")}</div>`;
}

// Pair the nth checked radio with the nth label (highlight) and nth panel (reveal). One rule
// set covers every Tabs on the page because radios/labels/panels are grouped by element type.
const TAB_CSS = Array.from({ length: TAB_MAX }, (_, i) => {
  const k = i + 1;
  return `.hs-a2-tabradio:nth-of-type(${k}):checked ~ .hs-a2-tablabel:nth-of-type(${k}){color:var(--hs-accent);border-bottom-color:var(--hs-accent)}`
    + `.hs-a2-tabradio:nth-of-type(${k}):checked ~ .hs-a2-tabpanel:nth-of-type(${k}){display:block}`;
}).join("\n");

function chart(node, ctx) {
  try {
    return renderChart({ kind: node.kind, series: node.series, title: str(ctx.resolve(node.title)) }).svg;
  } catch (error) {
    // Degrade to a table so the data is never lost (D6-style honest fallback).
    ctx.warn(`CHART: degraded to table (${error.message})`);
    const series = Array.isArray(node.series) ? node.series : [];
    return table({ headers: ["项", "值"], rows: series.map((p) => [p?.label, p?.value]) }, ctx);
  }
}

function button(node, ctx) {
  const label = escapeHtml(str(ctx.resolve(node.text ?? node.label)));
  if (!label) return "";
  const href = str(ctx.resolve(node.href ?? node.url)).trim();
  if (/^(?:https?:|mailto:)/i.test(href)) {
    return `<a class="hs-a2-button" href="${escapeHtml(href)}">${label}</a>`;
  }
  // No safe action target on a static page — degrade to a plain styled chip.
  return `<span class="hs-a2-button hs-a2-button-static">${label}</span>`;
}

function media(node, ctx) {
  const src = str(ctx.resolve(node.src)).trim();
  const label = escapeHtml(str(ctx.resolve(node.title)) || node.component);
  if (!src || /^(?:javascript:|vbscript:)/i.test(src)) {
    ctx.warn(`MEDIA: ${node.component} has no safe source`);
    return "";
  }
  if (/^(?:Audio|AudioPlayer)$/i.test(node.component)) {
    return `<figure class="hs-a2-media"><figcaption>${label}</figcaption><audio controls preload="metadata" src="${escapeHtml(src)}"></audio></figure>`;
  }
  if (/^(?:Video|VideoPlayer)$/i.test(node.component)) {
    return `<figure class="hs-a2-media"><figcaption>${label}</figcaption><video controls playsinline preload="metadata" src="${escapeHtml(src)}"></video></figure>`;
  }
  // Lottie still needs a JS runtime, so preserve its local/remote payload as a usable file link.
  return `<p class="hs-a2-media"><a href="${escapeHtml(src)}">▶ ${label}</a></p>`;
}

export const CATALOG = new Map([
  ["Text", text], ["RichText", richText],
  ["Column", column], ["Row", row], ["Grid", grid], ["Card", card],
  ["Divider", divider], ["List", list], ["Table", table], ["Image", image],
  ["Hero", hero], ["StatGrid", statGrid], ["Callout", callout], ["Quote", quote],
  ["Timeline", timeline], ["Tabs", tabs], ["Chart", chart], ["Button", button],
  ["Audio", media], ["AudioPlayer", media], ["Video", media], ["VideoPlayer", media], ["Lottie", media]
]);

export const COMPONENT_TYPES = [...CATALOG.keys()];

export const COMPONENT_CSS = `
.hs-a2-col { display: flex; flex-direction: column; gap: 16px; }
.hs-a2-row { display: flex; flex-wrap: wrap; gap: 16px; }
.hs-a2-row > * { flex: 1 1 200px; }
.hs-a2-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; }
.hs-a2-card { border: 1px solid var(--hs-line); border-radius: var(--hs-radius-card); padding: 16px; background: var(--hs-panel-subtle); }
.hs-a2-caption { color: var(--hs-muted); font-size: 13px; }
.hs-a2-rich > :first-child { margin-top: 0; }
.hs-a2-rich > :last-child { margin-bottom: 0; }
.hs-a2-divider { border: 0; border-top: 1px solid var(--hs-line); margin: 4px 0; }
.hs-a2-list { margin: 0; padding-left: 20px; }
.hs-a2-list li + li { margin-top: 6px; }
.hs-a2-tablewrap { overflow-x: auto; }
.hs-a2-img { display: block; max-width: 100%; height: auto; border-radius: var(--hs-radius-control); }
.hs-a2-hero { padding: 8px 0 4px; }
.hs-a2-kicker { margin: 0 0 6px; color: var(--hs-accent); font-size: 13px; letter-spacing: .08em; text-transform: uppercase; }
.hs-a2-headline { margin: 0; font-size: 24px; line-height: 1.25; }
.hs-a2-herometa { margin: 8px 0 0; color: var(--hs-muted); font-size: 13px; }
.hs-a2-statgrid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; }
.hs-a2-stat { border: 1px solid var(--hs-line); border-radius: var(--hs-radius-card); padding: 14px; background: var(--hs-panel-subtle); text-align: center; }
.hs-a2-statval { display: block; font-size: 26px; font-weight: 700; color: var(--hs-ink); }
.hs-a2-statlabel { display: block; margin-top: 4px; color: var(--hs-muted); font-size: 13px; }
.hs-a2-callout { padding: 14px 16px; border-left: 4px solid var(--hs-accent); background: var(--hs-accent-soft); border-radius: 0 var(--hs-radius-control) var(--hs-radius-control) 0; }
.hs-a2-callout > :first-child { margin-top: 0; } .hs-a2-callout > :last-child { margin-bottom: 0; }
.hs-a2-callout-warning { border-left-color: #C88A00; background: color-mix(in srgb, #C88A00 12%, var(--hs-panel)); }
.hs-a2-callout-success { border-left-color: #1F9D57; background: color-mix(in srgb, #1F9D57 12%, var(--hs-panel)); }
.hs-a2-callout-danger { border-left-color: var(--hs-danger, #C23934); background: color-mix(in srgb, #C23934 12%, var(--hs-panel)); }
.hs-a2-quote { margin: 0; padding: 8px 0 8px 16px; border-left: 3px solid var(--hs-line); color: var(--hs-ink); }
.hs-a2-quote p { margin: 0; font-style: italic; } .hs-a2-quote cite { display: block; margin-top: 6px; color: var(--hs-muted); font-size: 13px; font-style: normal; }
.hs-a2-timeline { list-style: none; margin: 0; padding: 0; }
.hs-a2-tl-item { position: relative; padding: 0 0 14px 18px; border-left: 2px solid var(--hs-line); }
.hs-a2-tl-item::before { content: ""; position: absolute; left: -5px; top: 4px; width: 8px; height: 8px; border-radius: 50%; background: var(--hs-accent); }
.hs-a2-tl-time { display: block; color: var(--hs-muted); font-size: 12px; }
.hs-a2-tl-title { display: block; font-weight: 600; }
.hs-a2-tl-detail { display: block; color: var(--hs-muted); font-size: 14px; }
.hs-a2-tabs { display: flex; flex-wrap: wrap; border: 1px solid var(--hs-line); border-radius: var(--hs-radius-card); overflow: hidden; }
.hs-a2-tabradio { position: absolute; width: 0; height: 0; opacity: 0; pointer-events: none; }
.hs-a2-tablabel { order: 1; padding: 10px 14px; cursor: pointer; color: var(--hs-muted); border-bottom: 2px solid transparent; }
.hs-a2-tabpanel { order: 2; display: none; width: 100%; padding: 16px; border-top: 1px solid var(--hs-line); }
${TAB_CSS}
.hs-a2-button { display: inline-flex; align-items: center; padding: 8px 14px; border-radius: var(--hs-radius-control); background: var(--hs-accent); color: var(--hs-accent-ink); text-decoration: none; font-size: 14px; }
.hs-a2-button-static { background: var(--hs-panel-subtle); color: var(--hs-muted); border: 1px solid var(--hs-line); }
.hs-a2-media a { color: var(--hs-accent); }
.hs-a2-media audio, .hs-a2-media video { display: block; width: 100%; max-width: 100%; margin-top: 8px; }
.hs-chart { display: block; width: 100%; height: auto; max-width: 640px; margin: 4px 0; }
`;
