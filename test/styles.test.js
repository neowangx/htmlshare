import assert from "node:assert/strict";
import { test } from "node:test";

import { composePage } from "../src/compose.js";
import { get, list } from "../src/styles/registry.js";

function hexToRgb(hex) {
  const value = hex.replace("#", "");
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16)
  ];
}

function luminance(hex) {
  return hexToRgb(hex).map((component) => {
    const channel = component / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  }).reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
}

function contrast(a, b) {
  const lighter = Math.max(luminance(a), luminance(b));
  const darker = Math.min(luminance(a), luminance(b));
  return (lighter + 0.05) / (darker + 0.05);
}

function token(css, name, dark = false) {
  const source = dark ? css.match(/@media \(prefers-color-scheme: dark\) \{[\s\S]*?\n\}/)?.[0] || "" : css.split("@media")[0];
  return source.match(new RegExp(`${name}:\\s*(#[0-9A-Fa-f]{6})`))?.[1];
}

test("C-06 style registry exposes clinical and minimal", () => {
  assert.ok(list().includes("clinical"));
  assert.ok(list().includes("minimal"));
});

test("C-06 unknown style error lists legal enum values", () => {
  assert.throws(
    () => get("neon"),
    (error) => {
      assert.equal(error.code, "INVALID_INPUT");
      assert.match(error.message, /clinical/);
      assert.match(error.message, /minimal/);
      return true;
    }
  );
});

test("C-06 clinical and minimal body contrast passes 4.5 in light and dark", () => {
  for (const name of ["clinical", "minimal"]) {
    const css = get(name).css;
    assert.ok(contrast(token(css, "--hs-ink"), token(css, "--hs-bg")) >= 4.5, `${name} light contrast`);
    assert.ok(contrast(token(css, "--hs-ink", true), token(css, "--hs-bg", true)) >= 4.5, `${name} dark contrast`);
  }
});

test("C-06 styles are inline and use hs tokens with reduced motion", () => {
  for (const name of ["clinical", "minimal"]) {
    const { html } = composePage({ title: "Style", faithfulHtml: "<p>正文</p>", style: name });
    assert.match(html, new RegExp(`data-hs-style="${name}"`));
    assert.match(html, /--hs-bg:/);
    assert.match(html, /prefers-color-scheme: dark/);
    assert.match(html, /prefers-reduced-motion: reduce/);
    assert.doesNotMatch(html, /https?:\/\//);
    assert.doesNotMatch(html, /@import|url\(/);
  }
});

test("C-06 minimal style changes the rendered page tokens", () => {
  const { html } = composePage({ title: "Minimal", faithfulHtml: "<p>正文</p>", style: "minimal" });
  assert.match(html, /--hs-bg: #FCFCFC;/);
  assert.match(html, /--hs-shadow-card: none;/);
});

test("C-14 style registry exposes editorial and darktech", () => {
  assert.deepEqual(list(), ["clinical", "minimal", "editorial", "darktech"]);
});

test("C-14 editorial and darktech body contrast passes 4.5", () => {
  const editorial = get("editorial").css;
  assert.ok(contrast(token(editorial, "--hs-ink"), token(editorial, "--hs-bg")) >= 4.5, "editorial light contrast");
  assert.ok(contrast(token(editorial, "--hs-ink", true), token(editorial, "--hs-bg", true)) >= 4.5, "editorial dark contrast");

  const darktech = get("darktech").css;
  assert.ok(contrast(token(darktech, "--hs-ink"), token(darktech, "--hs-bg")) >= 4.5, "darktech contrast");
  assert.match(composePage({ title: "Dark", faithfulHtml: "<p>正文</p>", style: "darktech" }).html, /color-scheme: dark;/);
});

test("C-14 all styles render A2UI content without external resources", () => {
  const componentSets = [
    [{ id: "c0", component: "Column", children: ["a", "b"] }, { id: "a", component: "Hero", headline: "标题足够长的一个标题" }, { id: "b", component: "RichText", html: "<p>正文内容足够长，正文内容足够长，正文内容足够长。</p>" }],
    [{ id: "c0", component: "StatGrid", items: [{ value: "92%", label: "完成率内容足够长" }, { value: "3", label: "风险项内容足够长" }] }],
    [{ id: "c0", component: "Chart", kind: "bar", series: [{ label: "A", value: 12 }, { label: "B", value: 8 }] }]
  ];

  for (const style of list()) {
    for (const components of componentSets) {
      const { html, mode, validation } = composePage({
        title: `doc-${style}`,
        faithfulHtml: "<p>原文内容足够长，原文内容足够长，原文内容足够长。</p>",
        enhanced: { protocol: "a2ui/0.9-static", theme: style, title: `doc-${style}`, root: "c0", components }
      });
      assert.equal(mode, "dual", `${style}`);
      assert.equal(validation.ok, true, `${style}`);
      assert.doesNotMatch(html, /https?:\/\//);
      assert.doesNotMatch(html, /@import|url\(/);
      assert.match(html, new RegExp(`data-hs-style="${style}"`));
    }
  }
});
