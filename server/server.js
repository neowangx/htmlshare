import http from "node:http";
import { timingSafeEqual } from "node:crypto";

import { signSession, parseCookies, verifySession } from "./lib/cookie.js";
import { verifyCode } from "./lib/code.js";
import { expiredPage, gatePage } from "./lib/pages.js";
import { createUnlockLimiter } from "./lib/ratelimit.js";
import { createPage, deletePage, expireDue, getLatestHtml, getMeta, incrementUniqueViews, isExpired, purgeDeleted, setExpiry, updatePage } from "./lib/store.js";

const COOKIE_TTL_SECONDS = 86400;
// Persistent per-page visitor marker; browsers cap durable cookies near 400 days.
const VIEW_COOKIE_MAX_AGE = 400 * 24 * 60 * 60;

// Count a page open once per browser: a first content serve (no hsv_<id> cookie yet) bumps the
// unique-visitor tally and drops the marker cookie. Refreshes by the same browser don't re-count.
// baseCookie lets the unlock path emit its session cookie alongside the marker (as an array).
function viewHeaders(req, dataDir, id, cookieSecure, baseCookie = null) {
  const cookies = parseCookies(req.headers.cookie);
  const setCookies = [];
  if (baseCookie) setCookies.push(baseCookie);
  if (!cookies[`hsv_${id}`]) {
    try { incrementUniqueViews(dataDir, id); } catch { /* analytics is best-effort, never blocks delivery */ }
    setCookies.push(`hsv_${id}=1; Path=/s/${id}; Max-Age=${VIEW_COOKIE_MAX_AGE}; HttpOnly; SameSite=Strict${cookieSecure ? "; Secure" : ""}`);
  }
  if (!setCookies.length) return {};
  return { "set-cookie": setCookies.length === 1 ? setCookies[0] : setCookies };
}

function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "x-content-type-options": "nosniff" });
  res.end(JSON.stringify(body));
}

function html(res, status, body, headers = {}) {
  res.writeHead(status, { "content-type": "text/html; charset=utf-8", "x-content-type-options": "nosniff", ...headers });
  res.end(body);
}

function error(res, status, code, message) {
  return json(res, status, { error: code, message });
}

async function readBody(req, limitBytes) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > limitBytes) {
      const error = new Error("too large");
      error.code = "TOO_LARGE";
      throw error;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function readJson(req, limitBytes) {
  const body = await readBody(req, limitBytes);
  if (!body) return {};
  return JSON.parse(body);
}

async function readUnlockCode(req) {
  const contentType = req.headers["content-type"] || "";
  const raw = await readBody(req, 4096);
  if (contentType.includes("application/json")) {
    return JSON.parse(raw || "{}").code || "";
  }
  return new URLSearchParams(raw).get("code") || "";
}

function authorized(req, token) {
  const provided = req.headers.authorization || "";
  const expected = `Bearer ${token}`;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  // Constant-time compare so the upload token can't be recovered by timing (S3).
  return a.length === b.length && timingSafeEqual(a, b);
}

function clientIp(req, trustProxy) {
  if (trustProxy) {
    const forwarded = req.headers["x-forwarded-for"];
    if (forwarded) return String(forwarded).split(",")[0].trim();
  }
  return req.socket.remoteAddress || "unknown";
}

export function createServer(options = {}) {
  const dataDir = options.dataDir || process.env.DATA_DIR || "./data";
  const token = options.token ?? process.env.UPLOAD_TOKEN;
  const publicBase = (options.publicBase || process.env.PUBLIC_BASE || "").replace(/\/+$/, "");
  const secret = options.secret || process.env.SESSION_SECRET;
  if (!secret) {
    // No public default: a shared default secret lets anyone forge a session cookie and
    // bypass the access-code gate on every deployment (B3).
    throw new Error("SESSION_SECRET is required");
  }
  const maxPageBytes = options.maxPageBytes ?? (Number(process.env.MAX_PAGE_MB || 20) * 1024 * 1024);
  const unlockLimit = Number(options.unlockRateLimit || process.env.UNLOCK_RATE_LIMIT || 5);
  const retainVersions = Number(options.retainVersions || process.env.RETAIN_VERSIONS || 20);
  const trustProxy = options.trustProxy ?? (process.env.TRUST_PROXY === "1" || process.env.TRUST_PROXY === "true");
  const cookieSecure = options.cookieSecure ?? (process.env.COOKIE_SECURE === "1" || process.env.COOKIE_SECURE === "true");
  const limiter = createUnlockLimiter({ max: unlockLimit, now: options.now });

  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");
      if (req.method === "GET" && url.pathname === "/healthz") return json(res, 200, { ok: true });

      if (req.method === "POST" && url.pathname === "/api/pages") {
        if (!authorized(req, token)) return error(res, 401, "UNAUTHORIZED", "token 缺失或无效");
        let body;
        try {
          body = await readJson(req, maxPageBytes);
        } catch (readError) {
          if (readError.code === "TOO_LARGE") return error(res, 413, "TOO_LARGE", "页面体积超限");
          return error(res, 400, "INVALID_INPUT", "请求体不是合法 JSON");
        }
        if (!body.html || typeof body.html !== "string") return error(res, 400, "INVALID_INPUT", "html 必填");
        try {
          const meta = createPage(dataDir, body);
          const base = publicBase || `http://${req.headers.host}`;
          return json(res, 201, { id: meta.id, url: `${base}/s/${meta.id}/`, version: meta.version });
        } catch (createError) {
          if (createError.code === "ID_CONFLICT") return error(res, 409, "ID_CONFLICT", "id 已存在");
          if (createError.code === "INVALID_INPUT") return error(res, 400, "INVALID_INPUT", "id 格式非法");
          throw createError;
        }
      }

      const apiPageMatch = url.pathname.match(/^\/api\/pages\/([a-z0-9]{6})(?:\/meta)?$/);
      if (apiPageMatch && !authorized(req, token)) return error(res, 401, "UNAUTHORIZED", "token 缺失或无效");

      if (req.method === "PUT" && apiPageMatch && !url.pathname.endsWith("/meta")) {
        let body;
        try {
          body = await readJson(req, maxPageBytes);
        } catch (readError) {
          if (readError.code === "TOO_LARGE") return error(res, 413, "TOO_LARGE", "页面体积超限");
          return error(res, 400, "INVALID_INPUT", "请求体不是合法 JSON");
        }
        if (!body.html || typeof body.html !== "string") return error(res, 400, "INVALID_INPUT", "html 必填");
        let meta;
        try {
          meta = updatePage(dataDir, apiPageMatch[1], body, { retainVersions });
        } catch (updateError) {
          if (updateError.code === "INVALID_INPUT") return error(res, 400, "INVALID_INPUT", "expiresAt 格式非法");
          throw updateError;
        }
        if (!meta) return error(res, 404, "NOT_FOUND", "id 不存在或已撤回");
        return json(res, 200, { version: meta.version });
      }

      if (req.method === "DELETE" && apiPageMatch && !url.pathname.endsWith("/meta")) {
        const meta = deletePage(dataDir, apiPageMatch[1]);
        if (!meta) return error(res, 404, "NOT_FOUND", "id 不存在或已撤回");
        res.writeHead(204);
        return res.end();
      }

      if (req.method === "PATCH" && apiPageMatch && url.pathname.endsWith("/meta")) {
        let body;
        try {
          body = await readJson(req, 4096);
        } catch {
          return error(res, 400, "INVALID_INPUT", "请求体不是合法 JSON");
        }
        try {
          const meta = setExpiry(dataDir, apiPageMatch[1], body.expiresAt ?? null);
          if (!meta) return error(res, 404, "NOT_FOUND", "id 不存在或已撤回");
          return json(res, 200, { id: meta.id, expiresAt: meta.expiresAt });
        } catch (patchError) {
          if (patchError.code === "INVALID_INPUT") return error(res, 400, "INVALID_INPUT", "expiresAt 格式非法");
          throw patchError;
        }
      }

      if (req.method === "GET" && apiPageMatch && url.pathname.endsWith("/meta")) {
        const meta = getMeta(dataDir, apiPageMatch[1]);
        if (!meta || meta.deletedAt) return error(res, 404, "NOT_FOUND", "id 不存在或已撤回");
        // Lazily reap on access so an expired page can't be read via its API either.
        if (isExpired(meta)) { deletePage(dataDir, meta.id, { now: meta.expiresAt }); return error(res, 410, "EXPIRED", "分享已过期"); }
        return json(res, 200, {
          id: meta.id,
          title: meta.title,
          version: meta.version,
          createdAt: meta.createdAt,
          updatedAt: meta.updatedAt,
          expiresAt: meta.expiresAt || null,
          hasCode: Boolean(meta.codeHash),
          uniqueViews: meta.uniqueViews || 0
        });
      }

      const pageMatch = url.pathname.match(/^\/s\/([a-z0-9]{6})\/?$/);
      if (req.method === "GET" && pageMatch) {
        const id = pageMatch[1];
        const meta = getMeta(dataDir, id);
        if (!meta || meta.deletedAt) return html(res, 404, "<h1>404</h1>");
        if (isExpired(meta)) { deletePage(dataDir, id, { now: meta.expiresAt }); return html(res, 410, expiredPage()); }
        if (!meta.codeHash) return html(res, 200, getLatestHtml(dataDir, id), viewHeaders(req, dataDir, id, cookieSecure));
        const cookies = parseCookies(req.headers.cookie);
        if (verifySession(secret, cookies[`hs_${id}`], id)) return html(res, 200, getLatestHtml(dataDir, id), viewHeaders(req, dataDir, id, cookieSecure));
        return html(res, 200, gatePage(id));
      }

      const unlockMatch = url.pathname.match(/^\/s\/([a-z0-9]{6})\/unlock$/);
      if (req.method === "POST" && unlockMatch) {
        const id = unlockMatch[1];
        const meta = getMeta(dataDir, id);
        if (!meta || meta.deletedAt) return error(res, 404, "NOT_FOUND", "id 不存在或已撤回");
        if (isExpired(meta)) { deletePage(dataDir, id, { now: meta.expiresAt }); return error(res, 410, "EXPIRED", "分享已过期"); }
        const limitKey = `${clientIp(req, trustProxy)}:${id}`;
        const gate = limiter.check(limitKey);
        if (!gate.allowed) return error(res, 429, "RATE_LIMITED", "解锁尝试过频");
        const code = await readUnlockCode(req);
        if (!verifyCode(code, meta.codeHash)) {
          limiter.fail(limitKey);
          return error(res, 403, "INVALID_INPUT", "访问码不正确");
        }
        limiter.reset(limitKey);
        const session = signSession(secret, { id, exp: Date.now() + COOKIE_TTL_SECONDS * 1000 });
        const cookie = `hs_${id}=${encodeURIComponent(session)}; Path=/s/${id}; HttpOnly; SameSite=Strict; Max-Age=${COOKIE_TTL_SECONDS}${cookieSecure ? "; Secure" : ""}`;
        return html(res, 200, getLatestHtml(dataDir, id), viewHeaders(req, dataDir, id, cookieSecure, cookie));
      }

      return error(res, 404, "NOT_FOUND", "资源不存在");
    } catch (serverError) {
      return error(res, 500, "INTERNAL", "服务端错误");
    }
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT || 8090);
  if (!process.env.UPLOAD_TOKEN) {
    console.error("UPLOAD_TOKEN is required");
    process.exit(1);
  }
  if (!process.env.SESSION_SECRET) {
    console.error("SESSION_SECRET is required");
    process.exit(1);
  }
  const dataDir = process.env.DATA_DIR || "./data";
  const server = createServer();
  // Soft-delete pages past their deadline, then physically remove anything past the grace
  // window. Runs once at startup, then daily, so unvisited expired pages are still reaped.
  const sweep = () => {
    try { expireDue(dataDir); purgeDeleted(dataDir); } catch { /* logged by next sweep */ }
  };
  sweep();
  const sweepTimer = setInterval(sweep, 24 * 60 * 60 * 1000);
  sweepTimer.unref?.();
  server.listen(port, () => {
    const address = server.address();
    const actualPort = typeof address === "object" ? address.port : port;
    console.log(`htmlshare-server listening on :${actualPort}`);
  });
}
