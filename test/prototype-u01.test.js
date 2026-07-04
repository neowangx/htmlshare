import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = new URL("..", import.meta.url).pathname;
const sampleDir = join(root, "prototype", "u01");
const samples = ["clinical", "minimal", "editorial", "darktech"];

function readSample(name) {
  return readFileSync(join(sampleDir, `${name}.html`), "utf8");
}

function luminance(hex) {
  const values = hex.match(/[0-9a-f]{2}/gi).map((part) => {
    const channel = Number.parseInt(part, 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2];
}

function contrast(a, b) {
  const high = Math.max(luminance(a), luminance(b));
  const low = Math.min(luminance(a), luminance(b));
  return (high + 0.05) / (low + 0.05);
}

function tokenValue(html, token) {
  const match = html.match(new RegExp(`${token}:\\s*(#[0-9A-Fa-f]{6})`));
  assert.ok(match, `${token} should be declared`);
  return match[1];
}

test("U-01 includes four style samples", () => {
  for (const sample of samples) {
    const html = readSample(sample);
    assert.match(html, new RegExp(`data-theme="${sample}"`));
    assert.match(html, /<meta name="robots" content="noindex">/);
  }
});

test("U-01 samples have zero external resources", () => {
  for (const sample of samples) {
    const html = readSample(sample);
    assert.doesNotMatch(html, /(?:src|href)=["']https?:\/\//i);
    assert.doesNotMatch(html, /@import|url\(/i);
  }
});

test("U-01 sample styles use hs tokens for colors", () => {
  for (const sample of samples) {
    const html = readSample(sample);
    const hexLines = html.split("\n").filter((line) => /#[0-9A-Fa-f]{3,8}/.test(line));
    assert.ok(hexLines.length > 0);
    assert.ok(hexLines.every((line) => line.trim().startsWith("--hs-")), `${sample} has naked color values`);
  }
});

test("U-01 samples avoid forbidden AI-slop patterns", () => {
  for (const sample of samples) {
    const html = readSample(sample);
    assert.doesNotMatch(html, /linear-gradient|radial-gradient|backdrop-filter|glass/i);
    assert.doesNotMatch(html, /emoji/i);
  }

  const dark = readSample("darktech");
  assert.doesNotMatch(tokenValue(dark, "--hs-bg"), /^#000(?:000)?$/i);
  assert.doesNotMatch(tokenValue(dark, "--hs-text"), /^#fff(?:fff)?$/i);
});

test("U-01 text contrast passes 4.5:1 for all themes", () => {
  for (const sample of samples) {
    const html = readSample(sample);
    const bg = tokenValue(html, "--hs-bg");
    const surface = tokenValue(html, "--hs-surface");
    const text = tokenValue(html, "--hs-text");
    const muted = tokenValue(html, "--hs-muted");
    const codeBg = tokenValue(html, "--hs-code-bg");
    const codeText = tokenValue(html, "--hs-code-text");

    assert.ok(contrast(text, bg) >= 4.5, `${sample} text/bg contrast`);
    assert.ok(contrast(text, surface) >= 4.5, `${sample} text/surface contrast`);
    assert.ok(contrast(muted, bg) >= 4.5, `${sample} muted/bg contrast`);
    assert.ok(contrast(codeText, codeBg) >= 4.5, `${sample} code contrast`);
  }
});

test("U-01 samples include required component states", () => {
  for (const sample of samples) {
    const html = readSample(sample);
    assert.match(html, /class="panel tldr"/);
    assert.match(html, /class="toggle"/);
    assert.match(html, /<details open>/);
    assert.match(html, /<pre><code>/);
    assert.match(html, /<table>/);
    assert.match(html, /class="card-grid"/);
    assert.match(html, /prefers-reduced-motion/);
  }
});
