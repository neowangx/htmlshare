import { loadConfig } from "../lib/config.js";
import { AdapterError } from "./errors.js";

export const name = "selfhost";
export const gate = "server";

const ERROR_BY_STATUS = {
  400: "INVALID_INPUT",
  401: "UNAUTHORIZED",
  402: "PLAN_REQUIRED",
  403: "QUOTA_EXCEEDED",
  404: "NOT_FOUND",
  409: "ID_CONFLICT",
  413: "TOO_LARGE",
  429: "RATE_LIMITED",
  500: "INTERNAL"
};

function normalizeBaseUrl(baseUrl) {
  return String(baseUrl || "").replace(/\/+$/, "");
}

function resolveConfig(config) {
  return config || loadConfig();
}

function selfhostConfig(config) {
  return resolveConfig(config).selfhost || {};
}

async function parseError(response) {
  try {
    const body = await response.json();
    return body && body.error ? body : null;
  } catch {
    return null;
  }
}

async function request(path, { method, body, config }) {
  const settings = selfhostConfig(config);
  const baseUrl = normalizeBaseUrl(settings.baseUrl);
  const uploadToken = settings.uploadToken;
  if (!baseUrl || !uploadToken) {
    throw new AdapterError("INVALID_INPUT", "selfhost.baseUrl and selfhost.uploadToken are required");
  }

  let response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${uploadToken}`
      },
      body: body == null ? undefined : JSON.stringify(body)
    });
  } catch (error) {
    throw new AdapterError("NETWORK", `无法连接自托管服务端 ${baseUrl}：${error.message}`, { cause: error });
  }

  if (!response.ok) {
    const errorBody = await parseError(response);
    const code = errorBody?.error || ERROR_BY_STATUS[response.status] || "INTERNAL";
    throw new AdapterError(code, errorBody?.message || `selfhost request failed with ${response.status}`, { status: response.status });
  }

  if (response.status === 204) return null;
  return response.json();
}

export async function detect(config) {
  const settings = selfhostConfig(config);
  if (!settings.baseUrl) return { available: false, reason: "selfhost.baseUrl missing" };
  if (!settings.uploadToken) return { available: false, reason: "selfhost.uploadToken missing" };
  return { available: true };
}

export async function publish({ html, id = null, meta = {}, config } = {}) {
  const body = {
    html,
    id,
    title: meta.title || "",
    // Each publish carries the user's current expiry choice (flag/prompt/never), so send it on
    // both create and update; the server only re-applies it when the field is present.
    expiresAt: meta.expiresAt ?? null,
    meta: {
      template: meta.template,
      style: meta.style,
      encrypted: Boolean(meta.encrypted)
    }
  };
  // Contract §6.1: PUT keeps the existing code unless a `code` field is present. Only send it
  // on create, or when the caller explicitly changes the code (meta.setCode).
  if (!id || meta.setCode) body.code = meta.code ?? null;

  const path = id ? `/api/pages/${encodeURIComponent(id)}` : "/api/pages";
  const result = await request(path, { method: id ? "PUT" : "POST", body, config });
  // The share URL always comes from the configured baseUrl, never from the server's response:
  // this is the user's own host, so their config is the authority on how it should be reached
  // (www vs apex). The server derives its own base from PUBLIC_BASE, falling back to a plain
  // http:// host header — trusting that would hand out links on the wrong domain or scheme.
  const shareId = id || result.id;
  return { id: shareId, url: `${normalizeBaseUrl(selfhostConfig(config).baseUrl)}/s/${shareId}/`, version: result.version };
}

export async function setExpiry({ id, expiresAt = null, config } = {}) {
  if (!id) throw new AdapterError("INVALID_INPUT", "setExpiry requires id");
  await request(`/api/pages/${encodeURIComponent(id)}/meta`, { method: "PATCH", body: { expiresAt }, config });
}

export async function unpublish({ id, config } = {}) {
  if (!id) throw new AdapterError("INVALID_INPUT", "unpublish requires id");
  await request(`/api/pages/${encodeURIComponent(id)}`, { method: "DELETE", config });
}

// Private, owner-only stats (uniqueViews, …). Reads the authenticated /meta endpoint — the
// counter is never surfaced on the public share page, only to whoever holds the upload token.
export async function stats({ id, config } = {}) {
  if (!id) throw new AdapterError("INVALID_INPUT", "stats requires id");
  return request(`/api/pages/${encodeURIComponent(id)}/meta`, { method: "GET", config });
}
