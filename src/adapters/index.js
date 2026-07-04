import * as selfhost from "./selfhost.js";

export class AdapterError extends Error {
  constructor(code, message, options = {}) {
    super(message || code);
    this.name = "AdapterError";
    this.code = code;
    this.status = options.status;
    this.cause = options.cause;
  }
}

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
