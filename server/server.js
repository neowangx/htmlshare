import http from "node:http";

import { signSession, parseCookies, verifySession } from "./lib/cookie.js";
import { verifyCode } from "./lib/code.js";
import { gatePage } from "./lib/pages.js";
import { createUnlockLimiter } from "./lib/ratelimit.js";
import { createPage, getLatestHtml, getMeta } from "./lib/store.js";

const COOKIE_TTL_SECONDS = 86400;

function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function html(res, status, body, headers = {}) {
  res.writeHead(status, { "content-type": "text/html; charset=utf-8", ...headers });
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
  return (req.headers.authorization || "") === `Bearer ${token}`;
}

export function createServer(options = {}) {
  const dataDir = options.dataDir || process.env.DATA_DIR || "./data";
  const token = options.token ?? process.env.UPLOAD_TOKEN;
  const publicBase = (options.publicBase || process.env.PUBLIC_BASE || "").replace(/\/+$/, "");
  const secret = options.secret || process.env.SESSION_SECRET || "htmlshare-dev-secret";
  const maxPageBytes = Number(options.maxPageBytes || process.env.MAX_PAGE_MB || 20) * 1024 * 1024;
  const unlockLimit = Number(options.unlockRateLimit || process.env.UNLOCK_RATE_LIMIT || 5);
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
          throw createError;
        }
      }

      const pageMatch = url.pathname.match(/^\/s\/([a-z0-9]{6})\/?$/);
      if (req.method === "GET" && pageMatch) {
        const id = pageMatch[1];
        const meta = getMeta(dataDir, id);
        if (!meta || meta.deletedAt) return html(res, 404, "<h1>404</h1>");
        if (!meta.codeHash) return html(res, 200, getLatestHtml(dataDir, id));
        const cookies = parseCookies(req.headers.cookie);
        if (verifySession(secret, cookies[`hs_${id}`], id)) return html(res, 200, getLatestHtml(dataDir, id));
        return html(res, 200, gatePage(id));
      }

      const unlockMatch = url.pathname.match(/^\/s\/([a-z0-9]{6})\/unlock$/);
      if (req.method === "POST" && unlockMatch) {
        const id = unlockMatch[1];
        const meta = getMeta(dataDir, id);
        if (!meta || meta.deletedAt) return error(res, 404, "NOT_FOUND", "id 不存在或已撤回");
        const limitKey = `${req.socket.remoteAddress || "unknown"}:${id}`;
        const gate = limiter.check(limitKey);
        if (!gate.allowed) return error(res, 429, "RATE_LIMITED", "解锁尝试过频");
        const code = await readUnlockCode(req);
        if (!verifyCode(code, meta.codeHash)) {
          limiter.fail(limitKey);
          return error(res, 403, "INVALID_INPUT", "访问码不正确");
        }
        limiter.reset(limitKey);
        const session = signSession(secret, { id, exp: Date.now() + COOKIE_TTL_SECONDS * 1000 });
        return html(res, 200, getLatestHtml(dataDir, id), {
          "set-cookie": `hs_${id}=${encodeURIComponent(session)}; Path=/s/${id}; HttpOnly; SameSite=Strict; Max-Age=${COOKIE_TTL_SECONDS}`
        });
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
  const server = createServer();
  server.listen(port, () => {
    const address = server.address();
    const actualPort = typeof address === "object" ? address.port : port;
    console.log(`htmlshare-server listening on :${actualPort}`);
  });
}
