import { AppError } from "../lib/errors.js";
import * as clinical from "./clinical.js";
import * as minimal from "./minimal.js";
import * as editorial from "./editorial.js";
import * as darktech from "./darktech.js";

const registry = new Map([
  [clinical.name, clinical],
  [minimal.name, minimal],
  [editorial.name, editorial],
  [darktech.name, darktech]
]);

export function list() {
  return [...registry.keys()];
}

export function get(name) {
  const style = registry.get(name);
  if (!style) {
    throw new AppError("INVALID_INPUT", `Unknown style "${name}". Expected one of: ${list().join(", ")}`);
  }
  return style;
}
