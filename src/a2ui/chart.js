import { escapeHtml } from "../convert.js";

// Static data-viz: render an A2UI Chart to a self-contained inline <svg> at publish time — no
// JS, no external requests, printable. Colours come from the active theme's CSS variables
// (var(--hs-accent) etc.) which resolve because the SVG lives in the page DOM.
// Series shape: [{ label, value }]. Supported kinds: bar | line | pie. Anything unusable
// degrades to a plain table via the caller (we throw so render.js can catch and fall back).

const W = 640;
const H = 280;
const PAD = { top: 16, right: 16, bottom: 34, left: 40 };
const PIE_PALETTE = ["--hs-accent", "--hs-accent-soft", "--hs-muted", "--hs-line", "--hs-ink"];

export const MAX_POINTS = 24;

function coerceSeries(series) {
  if (!Array.isArray(series)) return [];
  return series
    .map((point) => ({ label: String(point?.label ?? ""), value: Number(point?.value) }))
    .filter((point) => Number.isFinite(point.value));
}

function svgOpen(titleText) {
  // Inline SVG in HTML needs no xmlns; omitting it keeps the page free of any http(s) URL so
  // "zero external resource" checks stay simple and true.
  const title = titleText ? `<title>${escapeHtml(titleText)}</title>` : "";
  return `<svg class="hs-chart" viewBox="0 0 ${W} ${H}" role="img" preserveAspectRatio="xMidYMid meet">${title}`;
}

function niceMax(value) {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  return Math.ceil(value / magnitude) * magnitude;
}

function barChart(points, title) {
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const max = niceMax(Math.max(...points.map((p) => p.value), 0));
  const slot = plotW / points.length;
  const barW = Math.max(4, slot * 0.62);
  const baseY = PAD.top + plotH;
  const bars = points.map((point, index) => {
    const barH = max === 0 ? 0 : (point.value / max) * plotH;
    const x = PAD.left + slot * index + (slot - barW) / 2;
    const y = baseY - barH;
    const label = escapeHtml(point.label);
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${barH.toFixed(1)}" fill="var(--hs-accent)" rx="2"></rect>`
      + `<text x="${(x + barW / 2).toFixed(1)}" y="${(baseY + 16).toFixed(1)}" text-anchor="middle" font-size="11" fill="var(--hs-muted)">${label}</text>`;
  }).join("");
  const axis = `<line x1="${PAD.left}" y1="${baseY}" x2="${W - PAD.right}" y2="${baseY}" stroke="var(--hs-line)"></line>`;
  return `${svgOpen(title)}${axis}${bars}</svg>`;
}

function lineChart(points, title) {
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const max = niceMax(Math.max(...points.map((p) => p.value), 0));
  const baseY = PAD.top + plotH;
  const step = points.length > 1 ? plotW / (points.length - 1) : 0;
  const coords = points.map((point, index) => {
    const x = PAD.left + step * index;
    const y = max === 0 ? baseY : baseY - (point.value / max) * plotH;
    return { x, y, label: point.label };
  });
  const path = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(" ");
  const dots = coords.map((c) => `<circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="3" fill="var(--hs-accent)"></circle>`).join("");
  const labels = coords.map((c) => `<text x="${c.x.toFixed(1)}" y="${(baseY + 16).toFixed(1)}" text-anchor="middle" font-size="11" fill="var(--hs-muted)">${escapeHtml(c.label)}</text>`).join("");
  const axis = `<line x1="${PAD.left}" y1="${baseY}" x2="${W - PAD.right}" y2="${baseY}" stroke="var(--hs-line)"></line>`;
  return `${svgOpen(title)}${axis}<path d="${path}" fill="none" stroke="var(--hs-accent)" stroke-width="2"></path>${dots}${labels}</svg>`;
}

function pieChart(points, title) {
  const total = points.reduce((sum, point) => sum + Math.max(0, point.value), 0);
  if (total <= 0) throw new Error("pie chart needs a positive total");
  const cx = PAD.left + 90;
  const cy = H / 2;
  const r = Math.min(cy - PAD.top, 110);
  let angle = -Math.PI / 2;
  const slices = points.map((point, index) => {
    const fraction = Math.max(0, point.value) / total;
    const next = angle + fraction * Math.PI * 2;
    const large = fraction > 0.5 ? 1 : 0;
    const x1 = cx + r * Math.cos(angle);
    const y1 = cy + r * Math.sin(angle);
    const x2 = cx + r * Math.cos(next);
    const y2 = cy + r * Math.sin(next);
    angle = next;
    const fill = `var(${PIE_PALETTE[index % PIE_PALETTE.length]})`;
    // A full single slice can't be drawn as an arc (start==end); use a circle instead.
    const path = fraction >= 0.999
      ? `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"></circle>`
      : `<path d="M${cx} ${cy} L${x1.toFixed(1)} ${y1.toFixed(1)} A${r} ${r} 0 ${large} 1 ${x2.toFixed(1)} ${y2.toFixed(1)} Z" fill="${fill}" stroke="var(--hs-panel)" stroke-width="1"></path>`;
    return path;
  }).join("");
  const legend = points.map((point, index) => {
    const y = PAD.top + index * 22;
    const fill = `var(${PIE_PALETTE[index % PIE_PALETTE.length]})`;
    const pct = Math.round((Math.max(0, point.value) / total) * 100);
    return `<rect x="${cx + r + 24}" y="${y}" width="12" height="12" fill="${fill}"></rect>`
      + `<text x="${cx + r + 42}" y="${y + 11}" font-size="12" fill="var(--hs-ink)">${escapeHtml(point.label)} · ${pct}%</text>`;
  }).join("");
  return `${svgOpen(title)}${slices}${legend}</svg>`;
}

// Returns { svg } or throws — render.js catches and degrades to a table.
export function renderChart({ kind = "bar", series, title = "" } = {}) {
  const points = coerceSeries(series);
  if (!points.length) throw new Error("chart has no numeric data points");
  if (points.length > MAX_POINTS) throw new Error(`chart exceeds ${MAX_POINTS} points`);
  if (kind === "line") return { svg: lineChart(points, title) };
  if (kind === "pie") return { svg: pieChart(points, title) };
  return { svg: barChart(points, title) };
}
