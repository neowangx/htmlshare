import { AdapterError } from "../adapters/errors.js";
import * as clinical from "./clinical.js";
import * as minimal from "./minimal.js";

const registry = new Map([
  [clinical.name, clinical],
  [minimal.name, minimal]
]);

export function list() {
  return [...registry.keys()];
}

export function get(name) {
  const style = registry.get(name);
  if (!style) {
    throw new AdapterError("INVALID_INPUT", `Unknown style "${name}". Expected one of: ${list().join(", ")}`);
  }
  return style;
}
