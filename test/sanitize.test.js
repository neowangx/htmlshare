import assert from "node:assert/strict";
import { test } from "node:test";

import { sanitizeEnhanced } from "../src/lib/sanitize.js";

test("keeps whitelisted components and classes", () => {
  const out = sanitizeEnhanced('<div class="tldr">摘要</div><div class="callout callout-key">重点</div><details class="collapse"><summary>更多</summary>细节</details><mark class="hl">关键</mark>');
  assert.match(out, /class="tldr"/);
  assert.match(out, /callout-key/);
  assert.match(out, /<details class="collapse">/);
  assert.match(out, /<mark class="hl">/);
});

test("strips script, style, style-attr, on* and external img src", () => {
  const out = sanitizeEnhanced('<div class="card" style="color:red" onclick="x()">hi<script>alert(1)</script><style>.a{}</style><img src="http://evil/x.png"></div>');
  assert.doesNotMatch(out, /<script/i);
  assert.doesNotMatch(out, /<style/i);
  assert.doesNotMatch(out, /style=/i);
  assert.doesNotMatch(out, /onclick/i);
  assert.doesNotMatch(out, /src="http/i);
  assert.match(out, /class="card"/);
  assert.match(out, /hi/);
});

test("drops disallowed class values but keeps tag", () => {
  const out = sanitizeEnhanced('<div class="evil-hack">x</div>');
  assert.match(out, /<div>x<\/div>/);
});

test("empty / all-stripped returns empty string", () => {
  assert.equal(sanitizeEnhanced("<script>bad</script>"), "");
});

test("blocks javascript: scheme in anchor href", () => {
  const out = sanitizeEnhanced('<a href="javascript:alert(1)">x</a>');
  assert.doesNotMatch(out, /javascript:/i);
});

test("keeps https: scheme in external links", () => {
  const out = sanitizeEnhanced('<a href="https://example.com">x</a>');
  assert.match(out, /href="https:\/\/example\.com"/);
});

test("blocks SVG data-URI images", () => {
  const out = sanitizeEnhanced('<img src="data:image/svg+xml,<svg onload=alert(1)>">');
  assert.doesNotMatch(out, /<img/i);
});

test("keeps raster data-URI images (png/jpeg/gif/webp)", () => {
  const out = sanitizeEnhanced('<img src="data:image/png;base64,iVBORw0K">');
  assert.match(out, /src="data:image\/png/);
});

test("blocks protocol-relative URLs in img src and anchor href", () => {
  const out = sanitizeEnhanced('<img src="//cdn.evil/x.gif"><a href="//evil/p">x</a>');
  assert.doesNotMatch(out, /\/\/cdn\.evil/);
  assert.doesNotMatch(out, /href="\/\/evil/);
});
