import { loadConfig, saveConfig } from "../lib/config.js";
import { AdapterError } from "./errors.js";

export const name = "cloud";
export const gate = "server";

const ERROR_BY_STATUS = {
  400: "INVALID_INPUT",
  401: "UNAUTHORIZED",
  402: "PLAN_REQUIRED",
  403: "QUOTA_EXCEEDED",
  404: "NOT_FOUND",
  410: "EXPIRED",
  428: "AUTH_PENDING",
  429: "RATE_LIMITED",
  500: "INTERNAL"
};

function normalizeBaseUrl(baseUrl) {
  return String(baseUrl || "").replace(/\/+$/, "");
}

function cloudConfig(config) {
  return (config || loadConfig()).cloud || {};
}

async function parseError(response) {
  try {
    const body = await response.json();
    return body && body.error ? body : null;
  } catch {
    return null;
  }
}

async function request(path, { method, body, config, fetchFn = fetch }) {
  const settings = cloudConfig(config);
  const baseUrl = normalizeBaseUrl(settings.baseUrl);
  const token = settings.token;
  if (!baseUrl || !token) {
    throw new AdapterError("INVALID_INPUT", "cloud.baseUrl and cloud.token are required");
  }

  let response;
  try {
    response = await fetchFn(`${baseUrl}${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`
      },
      body: body == null ? undefined : JSON.stringify(body)
    });
  } catch (error) {
    throw new AdapterError("NETWORK", `无法连接云服务 ${baseUrl}：${error.message}`, { cause: error });
  }

  if (!response.ok) {
    const errorBody = await parseError(response);
    const code = errorBody?.error || ERROR_BY_STATUS[response.status] || "INTERNAL";
    let message = errorBody?.message || `cloud request failed with ${response.status}`;
    if (code === "PLAN_REQUIRED") {
      message = `${message}；请升级计划后重试。`;
    }
    if (code === "QUOTA_EXCEEDED") {
      message = `${message}；可运行 htmlshare list 清理旧页面，或升级计划。`;
    }
    throw new AdapterError(code, message, { status: response.status });
  }

  if (response.status === 204) return null;
  return response.json();
}

export async function detect(config) {
  const settings = cloudConfig(config);
  if (!settings.baseUrl) return { available: false, reason: "cloud.baseUrl missing" };
  if (!settings.token) return { available: false, reason: "cloud.token missing" };
  return { available: true };
}

export async function publish({ html, id = null, meta = {}, config, fetchFn } = {}) {
  const body = {
    html,
    id,
    title: meta.title || "",
    expiresAt: meta.expiresAt ?? null,
    meta: {
      template: meta.template,
      style: meta.style,
      encrypted: Boolean(meta.encrypted)
    }
  };
  // Contract §6.1: PUT keeps the existing code unless a `code` field is present.
  if (!id || meta.setCode) body.code = meta.code ?? null;

  if (id) {
    const result = await request(`/api/pages/${encodeURIComponent(id)}`, { method: "PUT", body, config, fetchFn });
    const settings = cloudConfig(config);
    return { id, url: `${normalizeBaseUrl(settings.baseUrl)}/s/${id}/`, version: result.version };
  }

  return request("/api/pages", { method: "POST", body, config, fetchFn });
}

export async function setExpiry({ id, expiresAt = null, config, fetchFn } = {}) {
  if (!id) throw new AdapterError("INVALID_INPUT", "setExpiry requires id");
  await request(`/api/pages/${encodeURIComponent(id)}/meta`, { method: "PATCH", body: { expiresAt }, config, fetchFn });
}

export async function unpublish({ id, config, fetchFn } = {}) {
  if (!id) throw new AdapterError("INVALID_INPUT", "unpublish requires id");
  await request(`/api/pages/${encodeURIComponent(id)}`, { method: "DELETE", config, fetchFn });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function loginCloud({ baseUrl, configDir, stdout, stderr, fetchFn = fetch, intervalMs = null } = {}) {
  const config = loadConfig(configDir);
  const targetBaseUrl = normalizeBaseUrl(baseUrl || config.cloud?.baseUrl || "https://htmlshare.app");
  const deviceResponse = await fetchFn(`${targetBaseUrl}/api/auth/device`, { method: "POST" });
  if (!deviceResponse.ok) {
    throw new AdapterError("INTERNAL", `device login failed with ${deviceResponse.status}`, { status: deviceResponse.status });
  }
  const device = await deviceResponse.json();
  stdout?.write(`Open: ${device.verificationUrl}\n`);
  stdout?.write(`Code: ${device.userCode}\n`);

  const delay = intervalMs ?? Number(device.interval || 5) * 1000;
  while (true) {
    const tokenResponse = await fetchFn(`${targetBaseUrl}/api/auth/token`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ deviceCode: device.deviceCode })
    });
    if (tokenResponse.status === 200) {
      const body = await tokenResponse.json();
      saveConfig({ ...config, defaultTarget: "cloud", cloud: { ...(config.cloud || {}), baseUrl: targetBaseUrl, token: body.token } }, configDir);
      stdout?.write("LOGIN: cloud ready\n");
      return { baseUrl: targetBaseUrl, token: body.token };
    }
    if (tokenResponse.status === 428) {
      stderr?.write("LOGIN: waiting for activation\n");
      await sleep(delay);
      continue;
    }
    if (tokenResponse.status === 410) {
      throw new AdapterError("EXPIRED", "设备码已过期", { status: 410 });
    }
    const errorBody = await parseError(tokenResponse);
    throw new AdapterError(errorBody?.error || ERROR_BY_STATUS[tokenResponse.status] || "INTERNAL", errorBody?.message || "cloud login failed", { status: tokenResponse.status });
  }
}
