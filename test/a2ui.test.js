import assert from "node:assert/strict";
import { test } from "node:test";

import { renderA2UI } from "../src/a2ui/render.js";
import { renderChart, MAX_POINTS } from "../src/a2ui/chart.js";

function doc(components, extra = {}) {
  return { protocol: "a2ui/0.9-static", root: "c0", components, ...extra };
}

test("renders a nested component tree via id references", () => {
  const result = renderA2UI(doc([
    { id: "c0", component: "Column", children: ["a", "b"] },
    { id: "a", component: "Text", variant: "h2", text: "标题" },
    { id: "b", component: "RichText", html: "<p>正文</p>" }
  ]));
  assert.equal(result.ok, true);
  assert.match(result.html, /<h3>标题<\/h3>/);
  assert.match(result.html, /hs-a2-rich/);
});

test("resolves $path data bindings against the dataModel", () => {
  const result = renderA2UI(doc(
    [
      { id: "c0", component: "StatGrid", items: [{ value: { $path: "/n" }, label: { $path: "/l" } }] }
    ],
    { dataModel: { n: "42", l: "计数" } }
  ));
  assert.match(result.html, /42/);
  assert.match(result.html, /计数/);
});

test("rejects malformed docs and empty renders", () => {
  assert.equal(renderA2UI("{bad json").ok, false);
  assert.equal(renderA2UI({ root: "c0" }).ok, false); // no components
  assert.equal(renderA2UI(doc([{ id: "c0", component: "Column", children: [] }])).ok, false); // empty
  assert.equal(renderA2UI(doc([{ id: "x", component: "Text", text: "hi" }])).ok, false); // root undefined
});

test("skips unknown components and dangling references with warnings", () => {
  const result = renderA2UI(doc([
    { id: "c0", component: "Column", children: ["ok", "ghost", "weird"] },
    { id: "ok", component: "Text", text: "在" },
    { id: "weird", component: "Nope", text: "x" }
  ]));
  assert.equal(result.ok, true);
  assert.match(result.warnings.join("|"), /A3/); // ghost missing
  assert.match(result.warnings.join("|"), /A4/); // Nope unknown
  assert.doesNotMatch(result.html, /Nope/);
});

test("guards against reference cycles", () => {
  const result = renderA2UI(doc([
    { id: "c0", component: "Column", children: ["c1"] },
    { id: "c1", component: "Column", children: ["c0", "leaf"] },
    { id: "leaf", component: "Text", text: "叶子" }
  ]));
  assert.equal(result.ok, true);
  assert.match(result.warnings.join("|"), /cycle/);
  assert.match(result.html, /叶子/);
});

test("Tabs render CSS-only with the first tab pre-checked", () => {
  const result = renderA2UI(doc([
    { id: "c0", component: "Tabs", tabs: [
      { label: "A", children: ["ta"] },
      { label: "B", children: ["tb"] }
    ] },
    { id: "ta", component: "Text", text: "甲" },
    { id: "tb", component: "Text", text: "乙" }
  ]));
  assert.match(result.html, /type="radio"[^>]*checked/);
  assert.equal((result.html.match(/hs-a2-tabpanel/g) || []).length, 2);
  assert.doesNotMatch(result.html, /<script/);
});

test("Image preserves remote and local sources for the publication collector", () => {
  const remote = renderA2UI(doc([{ id: "c0", component: "Image", src: "https://x/y.png", alt: "ok" }]));
  assert.match(remote.html, /<img/);
  const local = renderA2UI(doc([{ id: "c0", component: "Column", children: ["t", "i"] }, { id: "t", component: "Text", text: "x" }, { id: "i", component: "Image", src: "./local.png" }]));
  assert.equal(local.warnings.length, 0);
  assert.match(local.html, /src="\.\/local\.png"/);
});

test("Button degrades to a static chip without a URL", () => {
  const link = renderA2UI(doc([{ id: "c0", component: "Button", text: "打开", href: "https://x" }]));
  assert.match(link.html, /<a class="hs-a2-button" href="https:\/\/x"/);
  const chip = renderA2UI(doc([{ id: "c0", component: "Button", text: "无链接" }]));
  assert.match(chip.html, /hs-a2-button-static/);
});

test("renderChart produces inline SVG for each kind", () => {
  for (const kind of ["bar", "line", "pie"]) {
    const { svg } = renderChart({ kind, series: [{ label: "A", value: 3 }, { label: "B", value: 5 }] });
    assert.match(svg, /^<svg class="hs-chart"/);
    assert.doesNotMatch(svg, /https?:\/\//);
  }
});

test("renderChart throws on empty or oversized data (caller degrades to table)", () => {
  assert.throws(() => renderChart({ kind: "bar", series: [] }));
  const many = Array.from({ length: MAX_POINTS + 1 }, (_, i) => ({ label: String(i), value: i }));
  assert.throws(() => renderChart({ kind: "bar", series: many }));
});

test("Chart component degrades to a table when data is unusable", () => {
  const result = renderA2UI(doc([{ id: "c0", component: "Chart", kind: "bar", series: [{ label: "只有标签" }] }]));
  assert.equal(result.ok, true);
  assert.match(result.warnings.join("|"), /CHART: degraded/);
  assert.match(result.html, /<table>/);
});
