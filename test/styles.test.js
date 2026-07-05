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
  assert.deepEqual(list(), ["clinical", "minimal"]);
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
