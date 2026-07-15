import assert from "node:assert/strict";
import { test } from "node:test";

import { composePage, validateA2UI } from "../src/compose.js";
import { convertFaithful } from "../src/convert.js";

const source = `# 产品评审会纪要

今天确认 Q3 主打 X 功能，预算本周五前由 CFO 审批。

## 结论

- Q3 主打 X 功能
- 保留轻量访问码
`;

function validDoc(overrides = {}) {
  return {
    protocol: "a2ui/0.9-static",
    theme: "clinical",
    title: "产品评审会纪要",
    root: "c0",
    dataModel: { rate: "92%" },
    components: [
      { id: "c0", component: "Column", children: ["hero", "stat", "note"] },
      { id: "hero", component: "Hero", kicker: "产品评审", headline: "Q3 评审结论", meta: "2026-07-11" },
      { id: "stat", component: "StatGrid", items: [{ value: { $path: "/rate" }, label: "完成率" }] },
      { id: "note", component: "RichText", html: "<p>保留轻量访问码，并对照原文。</p>" }
    ],
    ...overrides
  };
}

test("composePage renders dual mode with toggle and exact faithful html", () => {
  const faithful = convertFaithful(source, "fb");
  const { html, mode, validation } = composePage({ title: faithful.title, faithfulHtml: faithful.html, enhanced: validDoc() });

  assert.equal(mode, "dual");
  assert.equal(validation.ok, true);
  assert.match(html, /<meta name="robots" content="noindex">/);
  assert.match(html, /id="hs-toggle"/);
  assert.match(html, /id="hs-enhanced"/);
  assert.match(html, /<nav id="hs-toc"[^>]* hidden>/);
  assert.match(html, /class="hs-enhanced-content"/);
  assert.match(html, new RegExp(`<section id="hs-faithful" class="hs-panel" hidden>${faithful.html.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}<\\/section>`));
  assert.doesNotMatch(html, /https?:\/\//);
});

test("long enhanced content ships viewport-aware clickable TOC behavior", () => {
  const { html } = composePage({
    title: "长文",
    faithfulHtml: "<p>原文</p>",
    enhanced: validDoc({
      components: [
        { id: "c0", component: "Column", children: ["intro", "one", "body1", "two", "body2"] },
        { id: "intro", component: "Hero", headline: "长文标题" },
        { id: "one", component: "Text", variant: "h1", text: "第一章" },
        { id: "body1", component: "RichText", html: "<p>第一章正文</p>" },
        { id: "two", component: "Text", variant: "h1", text: "第二章" },
        { id: "body2", component: "RichText", html: "<p>第二章正文</p>" }
      ]
    })
  });

  assert.match(html, /content\.scrollHeight > window\.innerHeight \* 2/);
  assert.match(html, /h2:not\(\.hs-a2-headline\), h3, h4/);
  assert.match(html, /link\.href = "#" \+ encodeURIComponent\(id\)/);
  assert.match(html, /section\.classList\.toggle\("hs-has-toc", show\)/);
  assert.match(html, /@media \(max-width: 720px\)/);

  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
  assert.equal(scripts.length, 1);
  assert.doesNotThrow(() => new Function(scripts[0]));
});

test("data binding resolves $path against the dataModel", () => {
  const { html } = composePage({ title: "t", faithfulHtml: "<p>x</p>", enhanced: validDoc() });
  assert.match(html, /92%/);
  assert.match(html, /hs-a2-hero/);
});

test("composePage without enhanced input renders faithful-only page without toggle", () => {
  const faithful = convertFaithful(source, "fb");
  const { html, mode } = composePage({ title: faithful.title, faithfulHtml: faithful.html });

  assert.equal(mode, "faithful");
  assert.doesNotMatch(html, /id="hs-toggle"/);
  assert.doesNotMatch(html, /id="hs-enhanced"/);
  assert.doesNotMatch(html, /id="hs-toc"/);
  assert.match(html, /id="hs-faithful"/);
});

test("composePage directHtml returns html unchanged for encryption callers", () => {
  const html = "<!doctype html><html><body><h1>Raw</h1></body></html>";
  assert.equal(composePage({ faithfulHtml: html, directHtml: true }).html, html);
});

test("style override wins over the A2UI doc theme", () => {
  const { html } = composePage({ title: "t", faithfulHtml: "<p>x</p>", enhanced: validDoc({ theme: "clinical" }), styleOverride: "darktech" });
  assert.match(html, /data-hs-style="darktech"/);
});

test("A1 rejects invalid JSON and malformed docs (falls back to faithful)", () => {
  assert.equal(validateA2UI("{ nope").ok, false);
  assert.equal(validateA2UI({ theme: "clinical" }).ok, false); // no root/components
  const page = composePage({ title: "t", faithfulHtml: "<p>正文</p>", enhanced: "{ broken" });
  assert.equal(page.mode, "faithful");
});

test("A2 rejects a root that is not a defined component", () => {
  const result = validateA2UI(validDoc({ root: "ghost" }));
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /A2/);
});

test("A3 warns on a missing child reference but still renders siblings", () => {
  const result = validateA2UI(validDoc({
    components: [
      { id: "c0", component: "Column", children: ["real", "ghost"] },
      { id: "real", component: "Text", variant: "body", text: "在场" }
    ]
  }));
  assert.equal(result.ok, true);
  assert.match(result.html, /在场/);
  assert.match(result.warnings.join("\n"), /A3/);
});

test("A4 skips unknown components with a warning", () => {
  const result = validateA2UI(validDoc({
    components: [
      { id: "c0", component: "Column", children: ["ok", "weird"] },
      { id: "ok", component: "Text", variant: "body", text: "正常" },
      { id: "weird", component: "QuantumBlaster", text: "??" }
    ]
  }));
  assert.equal(result.ok, true);
  assert.match(result.warnings.join("\n"), /A4/);
  assert.doesNotMatch(result.html, /QuantumBlaster/);
});

test("RichText and Callout sanitize script and event handlers", () => {
  const result = validateA2UI(validDoc({
    components: [
      { id: "c0", component: "Column", children: ["r", "c"] },
      { id: "r", component: "RichText", html: '<p onclick="x()">keep</p><script>alert(1)</script>' },
      { id: "c", component: "Callout", tone: "danger", html: '<b>warn</b><img src="x" onerror="y()">' }
    ]
  }));
  assert.equal(result.ok, true);
  assert.doesNotMatch(result.html, /script|onclick|onerror|alert/i);
  assert.match(result.html, /keep/);
  assert.match(result.html, /hs-a2-callout-danger/);
});

test("A6 empty render falls back", () => {
  const result = validateA2UI({ protocol: "a2ui/0.9-static", root: "c0", components: [{ id: "c0", component: "Column", children: [] }] });
  assert.equal(result.ok, false);
});
