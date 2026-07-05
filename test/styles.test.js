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

test("C-14 all style and template combinations render without external resources", () => {
  const templates = ["generic", "meeting", "proposal", "tutorial", "release"];
  const sectionByTemplate = {
    generic: [{ slot: "body", html: "<p>正文内容足够长，正文内容足够长。</p>" }],
    meeting: [{ slot: "conclusions", html: "<p>结论内容足够长，结论内容足够长。</p>" }],
    proposal: [{ slot: "summary", html: "<p>摘要内容足够长，摘要内容足够长。</p>" }],
    tutorial: [{ slot: "overview", html: "<p>概览内容足够长，概览内容足够长。</p>" }],
    release: [{ slot: "highlights", html: "<p>亮点内容足够长，亮点内容足够长。</p>" }]
  };

  for (const style of list()) {
    for (const template of templates) {
      const { html, mode, validation } = composePage({
        title: `${template}-${style}`,
        faithfulHtml: "<p>原文内容足够长，原文内容足够长，原文内容足够长。</p>",
        enhanced: {
          version: 1,
          template,
          style,
          title: `${template}-${style}`,
          tldr: ["组合渲染正常"],
          sections: sectionByTemplate[template]
        }
      });
      assert.equal(mode, "dual", `${template}/${style}`);
      assert.equal(validation.ok, true, `${template}/${style}`);
      assert.doesNotMatch(html, /https?:\/\//);
      assert.doesNotMatch(html, /@import|url\(/);
      assert.match(html, new RegExp(`data-hs-style="${style}"`));
    }
  }
});
