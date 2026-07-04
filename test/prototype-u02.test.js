import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = new URL("..", import.meta.url).pathname;
const prototypeRoot = join(root, "prototype");
const pages = [
  "01-generic-clinical", "02-generic-minimal", "03-generic-editorial", "04-generic-darktech",
  "05-meeting-clinical", "06-proposal-clinical", "07-tutorial-clinical", "08-release-clinical",
  "09-meeting-empty-slot", "10-toggle-demo", "11-gate-server", "12-gate-static",
  "13-extreme-data", "14-adaptive-theme"
];

function readPage(id) {
  return readFileSync(join(prototypeRoot, "pages", `${id}.html`), "utf8");
}

function hexLines(html) {
  return html.split("\n").filter((line) => /#[0-9A-Fa-f]{6}/.test(line));
}

test("U-02 index links all 14 required prototype pages", () => {
  const index = readFileSync(join(prototypeRoot, "index.html"), "utf8");
  for (const page of pages) {
    assert.match(index, new RegExp(`pages/${page}\\.html`));
  }
});

test("U-02 pages are static, noindex, and have zero external resources", () => {
  for (const page of pages) {
    const html = readPage(page);
    assert.match(html, /<meta name="robots" content="noindex">/);
    assert.doesNotMatch(html, /(?:src|href)=["']https?:\/\//i);
    assert.doesNotMatch(html, /@import|url\(/i);
  }
});

test("U-02 pages keep colors inside hs token declarations or inline token overrides", () => {
  for (const page of pages) {
    const lines = hexLines(readPage(page));
    assert.ok(lines.length > 0, `${page} should declare token colors`);
    assert.ok(lines.every((line) => line.includes("--hs-")), `${page} has naked color line`);
  }
});

test("U-02 pages avoid negative-list visual patterns", () => {
  for (const page of pages) {
    const html = readPage(page);
    assert.doesNotMatch(html, /linear-gradient|radial-gradient|backdrop-filter|glass/i);
    assert.doesNotMatch(html, /emoji/i);
  }
  const dark = readPage("04-generic-darktech");
  assert.doesNotMatch(dark, /--hs-bg:#000(?:000)?/i);
  assert.doesNotMatch(dark, /--hs-text:#fff(?:fff)?/i);
});

test("U-02 covers required interactive and edge states", () => {
  assert.match(readPage("10-toggle-demo"), /data-view="faithful"/);
  assert.match(readPage("10-toggle-demo"), /id="enhanced"/);
  assert.match(readPage("11-gate-server"), /限速/);
  assert.match(readPage("11-gate-server"), /访问码不正确/);
  assert.match(readPage("12-gate-static"), /解密中/);
  assert.match(readPage("12-gate-static"), /无法解密/);
  assert.match(readPage("13-extreme-data"), /Row 200/);
  assert.match(readPage("14-adaptive-theme"), /深色演示/);
});

test("U-02 pages include reduced-motion and print affordances where relevant", () => {
  for (const page of pages) {
    const html = readPage(page);
    assert.match(html, /prefers-reduced-motion/);
    if (!page.includes("gate")) assert.match(html, /@media print/);
  }
});
