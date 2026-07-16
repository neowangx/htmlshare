import { readFileSync } from "node:fs";
import { basename, dirname, extname } from "node:path";

import MarkdownIt from "markdown-it";
import anchor from "markdown-it-anchor";
import highlightjs from "markdown-it-highlightjs";
import toc from "markdown-it-toc-done-right";

import { sanitizeFaithful } from "./lib/sanitize.js";
import { embedLocalAssets } from "./assets.js";

function buildMarkdown() {
  return new MarkdownIt({ html: true, linkify: true, typographer: false })
    .use(anchor, { permalink: false })
    .use(toc, { level: [2, 3] })
    .use(highlightjs, { inline: true });
}

function plainTextFromInlineToken(token) {
  return token.children
    ? token.children.filter((child) => child.type === "text" || child.type === "code_inline").map((child) => child.content).join("")
    : token.content;
}

function slugifyHeading(text) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^\p{L}\p{N}-]+/gu, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function extractHeadings(md) {
  const tokens = buildMarkdown().parse(md, {});
  const seen = new Map();
  const headings = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.type !== "heading_open") continue;

    const inline = tokens[index + 1];
    const text = inline && inline.type === "inline" ? plainTextFromInlineToken(inline).trim() : "";
    if (!text) continue;

    const baseSlug = slugifyHeading(text) || "section";
    const seenCount = seen.get(baseSlug) || 0;
    seen.set(baseSlug, seenCount + 1);

    headings.push({
      level: Number.parseInt(token.tag.slice(1), 10),
      text,
      slug: seenCount === 0 ? baseSlug : `${baseSlug}-${seenCount + 1}`
    });
  }

  return headings;
}

export function extractTitle(md, fallbackTitle = "Untitled") {
  const heading = extractHeadings(md).find((item) => item.level === 1);
  return heading ? heading.text : fallbackTitle;
}

export function escapeHtml(value) {
  return value.replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" })[char]);
}

// Compatibility export for integrations that used the old image-only helper. D20 now embeds
// every supported local resource; non-strict mode retains the old warning-and-continue behavior.
export function inlineLocalImages(html, baseDir, warnings) {
  const result = embedLocalAssets(html, baseDir);
  warnings?.push(...result.warnings);
  return result.html;
}

export function convertFaithful(md, fallbackTitle = "Untitled", { baseDir = null, strictAssets = false } = {}) {
  const source = String(md ?? "");
  const headings = extractHeadings(source);
  const warnings = [];
  // Embed before sanitizing: file:// is intentionally not an allowed output scheme, while the
  // resulting data URI is. This also lets raw Markdown HTML audio/video survive as self-contained
  // media without ever exposing a local path.
  const embedded = embedLocalAssets(buildMarkdown().render(source), baseDir, { strict: strictAssets });
  warnings.push(...embedded.warnings);
  const html = sanitizeFaithful(embedded.html);

  return {
    html,
    title: headings.find((item) => item.level === 1)?.text || fallbackTitle,
    headings,
    warnings,
    assets: embedded.assets
  };
}

export function convertFile(mdPath, options = {}) {
  const md = readFileSync(mdPath, "utf8");
  return convertFaithful(md, basename(mdPath, extname(mdPath)), { baseDir: dirname(mdPath), ...options });
}
