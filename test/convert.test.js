import assert from "node:assert/strict";
import { test } from "node:test";

import { convertFaithful } from "../src/convert.js";

test("convertFaithful renders markdown body with table and code highlight", () => {
  const { html } = convertFaithful("# 标题\n\n```js\nconst a=1;\n```\n\n| a | b |\n|---|---|\n| 1 | 2 |\n", "fb");
  assert.match(html, /<table>/);
  assert.match(html, /hljs/);
  assert.doesNotMatch(html, /href="https?:\/\//);
});

test("convertFaithful extracts title from first h1, else fallback", () => {
  assert.equal(convertFaithful("# 我的报告\n内容", "fb").title, "我的报告");
  assert.equal(convertFaithful("没有标题", "fb").title, "fb");
});

test("convertFaithful returns structured headings", () => {
  const { headings } = convertFaithful("# One\n\n## Two\n\n### Two", "fb");
  assert.deepEqual(headings, [
    { level: 1, text: "One", slug: "one" },
    { level: 2, text: "Two", slug: "two" },
    { level: 3, text: "Two", slug: "two-2" }
  ]);
});

test("convertFaithful strips script tags from markdown HTML", () => {
  const { html } = convertFaithful("# Safe\n\n<script>alert(1)</script>\n\nText", "fb");
  assert.doesNotMatch(html, /<script/i);
  assert.doesNotMatch(html, /alert\(1\)/);
  assert.match(html, /Text/);
});

test("convertFaithful is byte deterministic for the same input", () => {
  const input = "# Stable\n\n- a\n- b\n\n```js\nconst x = 1;\n```";
  const first = convertFaithful(input, "fb");
  const second = convertFaithful(input, "fb");
  assert.equal(first.html, second.html);
  assert.deepEqual(first, second);
});
