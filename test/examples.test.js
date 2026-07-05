import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, normalize } from "node:path";
import { test } from "node:test";

const repoRoot = new URL("..", import.meta.url).pathname;
const examplesDir = join(repoRoot, "examples");

function links(markdown) {
  return [...markdown.matchAll(/\[[^\]]+\]\((?!https?:|mailto:|#)([^)]+)\)/g)].map((match) => match[1]);
}

test("G-03 example builder is deterministic", () => {
  const before = new Map();
  for (const file of [
    "source/meeting.md",
    "source/tutorial.md",
    "source/essay.md",
    "html/meeting-clinical.html",
    "html/tutorial-darktech.html",
    "html/essay-minimal.html",
    "html/essay-editorial.html",
    "README.md"
  ]) {
    before.set(file, readFileSync(join(examplesDir, file), "utf8"));
  }

  execFileSync(process.execPath, [join(repoRoot, "scripts", "build-examples.js")], { cwd: repoRoot });

  for (const [file, content] of before) {
    assert.equal(readFileSync(join(examplesDir, file), "utf8"), content, file);
  }
});

test("G-03 rendered examples are self-contained and cover four styles", () => {
  const expected = [
    ["html/meeting-clinical.html", "clinical"],
    ["html/tutorial-darktech.html", "darktech"],
    ["html/essay-minimal.html", "minimal"],
    ["html/essay-editorial.html", "editorial"]
  ];

  for (const [file, style] of expected) {
    const html = readFileSync(join(examplesDir, file), "utf8");
    assert.match(html, new RegExp(`data-hs-style="${style}"`));
    assert.doesNotMatch(html, /\s(?:src|href)=["']https?:\/\//i);
    assert.doesNotMatch(html, /@import|url\(/);
    assert.match(html, /<meta name="robots" content="noindex">/);
    assert.match(html, /id="hs-toggle"/);
  }
});

test("G-03 examples README links are reachable", () => {
  const readmePath = join(examplesDir, "README.md");
  const readme = readFileSync(readmePath, "utf8");
  for (const link of links(readme)) {
    const target = normalize(join(dirname(readmePath), link.split("#")[0]));
    assert.ok(target.startsWith(examplesDir), `link escapes examples: ${link}`);
    assert.equal(existsSync(target), true, `missing examples link: ${link}`);
  }
});
