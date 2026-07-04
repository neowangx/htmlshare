import { loadConfig } from "../lib/config.js";
import { AdapterError } from "./index.js";

export const name = "selfhost";

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

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${uploadToken}`
    },
    body: body == null ? undefined : JSON.stringify(body)
  });

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
    code: meta.code ?? null,
    title: meta.title || "",
    meta: {
      template: meta.template,
      style: meta.style,
      encrypted: Boolean(meta.encrypted)
    }
  };

  if (id) {
    const result = await request(`/api/pages/${encodeURIComponent(id)}`, { method: "PUT", body, config });
    const settings = selfhostConfig(config);
    return { id, url: `${normalizeBaseUrl(settings.baseUrl)}/s/${id}/`, version: result.version };
  }

  return request("/api/pages", { method: "POST", body, config });
}

export async function unpublish({ id, config } = {}) {
  if (!id) throw new AdapterError("INVALID_INPUT", "unpublish requires id");
  await request(`/api/pages/${encodeURIComponent(id)}`, { method: "DELETE", config });
}
