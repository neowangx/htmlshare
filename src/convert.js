import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, extname, resolve } from "node:path";

import MarkdownIt from "markdown-it";
import anchor from "markdown-it-anchor";
import highlightjs from "markdown-it-highlightjs";
import toc from "markdown-it-toc-done-right";

import { sanitizeFaithful } from "./lib/sanitize.js";

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

// D12: output must be self-contained. Inline local images referenced by relative path as
// data: URIs; leave remote/data URIs alone; warn (and keep as a link) when a file is missing
// or exceeds the per-image cap so the page never silently ships a broken/huge asset.
const MAX_INLINE_IMAGE_BYTES = 2 * 1024 * 1024;
const IMAGE_MIME = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp"
};

// The `src` attribute may be single- or double-quoted: markdown-it emits double quotes, but
// hand-authored HTML (direct-upload path) uses either — capture the quote char and reuse it.
export function inlineLocalImages(html, baseDir, warnings) {
  if (!baseDir) return html;
  return html.replace(/<img\b[^>]*?\bsrc=(["'])([^"']*)\1[^>]*>/gi, (tag, quote, src) => {
    if (!src || /^(?:https?:|data:|mailto:|\/\/)/i.test(src)) return tag;
    let relative;
    try {
      relative = decodeURI(src.split(/[?#]/)[0]);
    } catch {
      return tag;
    }
    const abs = resolve(baseDir, relative);
    const ext = extname(abs).toLowerCase();
    const mime = IMAGE_MIME[ext];
    if (!mime) {
      warnings.push(`IMAGE: unsupported type left as link: ${src}`);
      return tag;
    }
    if (!existsSync(abs)) {
      warnings.push(`IMAGE: file not found, left as link: ${src}`);
      return tag;
    }
    const bytes = readFileSync(abs);
    if (bytes.length > MAX_INLINE_IMAGE_BYTES) {
      warnings.push(`IMAGE: ${(bytes.length / 1024 / 1024).toFixed(1)}MB exceeds ${MAX_INLINE_IMAGE_BYTES / 1024 / 1024}MB, left as link: ${src}`);
      return tag;
    }
    const dataUri = `data:${mime};base64,${bytes.toString("base64")}`;
    return tag.replace(`src=${quote}${src}${quote}`, `src=${quote}${dataUri}${quote}`);
  });
}

export function convertFaithful(md, fallbackTitle = "Untitled", { baseDir = null } = {}) {
  const source = String(md ?? "");
  const headings = extractHeadings(source);
  const warnings = [];
  const html = inlineLocalImages(sanitizeFaithful(buildMarkdown().render(source)), baseDir, warnings);

  return {
    html,
    title: headings.find((item) => item.level === 1)?.text || fallbackTitle,
    headings,
    warnings
  };
}

export function convertFile(mdPath) {
  const md = readFileSync(mdPath, "utf8");
  return convertFaithful(md, basename(mdPath, extname(mdPath)), { baseDir: dirname(mdPath) });
}
