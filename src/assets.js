import { existsSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { extname, isAbsolute, resolve } from "node:path";

import { AppError } from "./lib/errors.js";

export const MAX_LOCAL_ASSET_BYTES = 100 * 1024 * 1024;

const MIME_TYPES = new Map(Object.entries({
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif",
  ".webp": "image/webp", ".avif": "image/avif", ".svg": "image/svg+xml", ".ico": "image/x-icon",
  ".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".aac": "audio/aac", ".wav": "audio/wav",
  ".ogg": "audio/ogg", ".oga": "audio/ogg", ".flac": "audio/flac",
  ".mp4": "video/mp4", ".m4v": "video/mp4", ".webm": "video/webm", ".ogv": "video/ogg",
  ".mov": "video/quicktime",
  ".vtt": "text/vtt", ".pdf": "application/pdf", ".json": "application/json", ".txt": "text/plain",
  ".csv": "text/csv", ".zip": "application/zip", ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation"
}));

function isRemoteOrPageUrl(value) {
  return !value
    || value.startsWith("#")
    || value.startsWith("/")
    || value.startsWith("//")
    || /^(?:https?:|data:|blob:|mailto:|tel:|javascript:)/i.test(value);
}

function localPath(value, baseDir) {
  const clean = value.split(/[?#]/, 1)[0];
  try {
    if (/^file:/i.test(clean)) return fileURLToPath(clean);
    const decoded = decodeURIComponent(clean);
    return isAbsolute(decoded) ? decoded : resolve(baseDir, decoded);
  } catch (error) {
    throw new AppError("INVALID_INPUT", `本地资源路径无法解析：${value}`, { cause: error });
  }
}

function mimeFor(path) {
  return MIME_TYPES.get(extname(path).toLowerCase()) || "application/octet-stream";
}

function roleError(role, mime, ref) {
  if ((role === "img:src" || role === "video:poster") && (!mime.startsWith("image/") || mime === "image/svg+xml")) {
    return `该图片格式不能安全嵌入：${ref}`;
  }
  if (role === "audio:src" && !mime.startsWith("audio/")) return `音频格式无法识别：${ref}`;
  if (role === "video:src" && !mime.startsWith("video/")) return `视频格式无法识别：${ref}`;
  return null;
}

function replaceAttribute(tag, tagName, state) {
  const allowed = tagName === "a" ? new Set(["href"])
    : tagName === "video" ? new Set(["src", "poster"])
      : new Set(["src"]);
  return tag.replace(/\b(src|href|poster)\s*=\s*(?:(["'])([^"']*)\2|([^\s>]+))/gi,
    (attribute, name, quote, quotedValue, bareValue) => {
      if (!allowed.has(name.toLowerCase())) return attribute;
      const value = quote ? quotedValue : bareValue;
      const embedded = state.embed(value, `${tagName}:${name.toLowerCase()}`);
      return embedded === value ? attribute : `${name}=${quote || "\""}${embedded}${quote || "\""}`;
    });
}

function replaceCssUrls(css, embed) {
  return css.replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/gi, (whole, quote, value) => {
    const embedded = embed(value);
    return embedded === value ? whole : `url(${quote}${embedded}${quote})`;
  });
}

/**
 * Turn local file references into data URIs so the adapter still publishes one atomic HTML
 * object. Remote/page URLs remain untouched. In strict mode a recognized local reference must
 * be readable; publishing a known broken page is an input error (D20).
 */
export function embedLocalAssets(html, baseDir, { strict = false, maxBytes = MAX_LOCAL_ASSET_BYTES } = {}) {
  if (!baseDir) return { html: String(html ?? ""), assets: [], warnings: [] };
  const warnings = [];
  const assets = [];
  const cache = new Map();
  let totalBytes = 0;

  function fail(message) {
    if (strict) throw new AppError("INVALID_INPUT", message);
    warnings.push(`ASSET: ${message}`);
    return null;
  }

  function embed(value, role = "file") {
    const ref = String(value || "").trim();
    if (isRemoteOrPageUrl(ref)) return value;
    const abs = localPath(ref, baseDir);
    const mime = mimeFor(abs);
    const invalidRole = roleError(role, mime, ref);
    if (invalidRole) return fail(invalidRole) ?? value;
    if (cache.has(abs)) return cache.get(abs);
    if (!existsSync(abs)) return fail(`本地资源不存在：${ref}`) ?? value;
    let stat;
    try { stat = statSync(abs); } catch { return fail(`本地资源不可读：${ref}`) ?? value; }
    if (!stat.isFile()) return fail(`本地资源不是普通文件：${ref}`) ?? value;
    if (totalBytes + stat.size > maxBytes) {
      return fail(`本地资源原始总量超过 ${Math.round(maxBytes / 1024 / 1024)}MB：${ref}`) ?? value;
    }
    let bytes;
    try { bytes = readFileSync(abs); } catch { return fail(`本地资源不可读：${ref}`) ?? value; }
    totalBytes += bytes.length;
    const uri = `data:${mime};base64,${bytes.toString("base64")}`;
    cache.set(abs, uri);
    assets.push({ path: abs, size: stat.size, mtimeMs: stat.mtimeMs, mime });
    return uri;
  }

  let output = String(html ?? "").replace(/<(img|audio|video|source|track|a)\b[^>]*>/gi,
    (tag, tagName) => replaceAttribute(tag, tagName.toLowerCase(), { embed }));
  // Restrict CSS URL rewriting to CSS contexts; scanning the whole document would mistake a
  // JavaScript string such as "url(local)" for a publication dependency.
  output = output.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi,
    (whole, css) => whole.replace(css, replaceCssUrls(css, embed)));
  output = output.replace(/\bstyle\s*=\s*(["'])([\s\S]*?)\1/gi,
    (whole, quote, css) => `style=${quote}${replaceCssUrls(css, embed)}${quote}`);

  return { html: output, assets, warnings };
}

export function assetDependenciesValid(dependencies) {
  if (!Array.isArray(dependencies)) return true;
  return dependencies.every((item) => {
    try {
      const stat = statSync(item.path);
      return stat.isFile() && stat.size === item.size && stat.mtimeMs === item.mtimeMs;
    } catch {
      return false;
    }
  });
}
