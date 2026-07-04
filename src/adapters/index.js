import * as selfhost from "./selfhost.js";
import * as vercel from "./vercel.js";
import * as cloudflare from "./cloudflare.js";
import * as cloud from "./cloud.js";
import { AdapterError } from "./errors.js";

const registry = new Map();

export function register(adapter) {
  if (!adapter || !adapter.name) throw new AdapterError("INVALID_INPUT", "Adapter requires a name");
  registry.set(adapter.name, adapter);
  return adapter;
}

export function getAdapter(name) {
  const adapter = registry.get(name);
  if (!adapter) throw new AdapterError("INVALID_INPUT", `Unknown adapter: ${name}`);
  return adapter;
}

export function listAdapters() {
  return [...registry.keys()];
}

register(selfhost);
register(cloud);
register(vercel);
register(cloudflare);

export { AdapterError };
