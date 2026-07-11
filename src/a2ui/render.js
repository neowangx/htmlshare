import { sanitizeEnhanced } from "../lib/sanitize.js";
import { CATALOG } from "./catalog.js";

// Render an A2UI static-subset document to a single HTML fragment. Input is a snapshot of an
// A2UI surface: a flat component list linked by id references (adjacency list), plus an optional
// dataModel that Dynamic props ({ "$path": "/pointer" }) resolve against at publish time. We
// drop A2UI's streaming envelope, interactivity and actions — this is a one-shot static render.
// Never throws: malformed input returns { ok: false } so compose can fall back to faithful (D6).

const MAX_DEPTH = 64;

function parse(input) {
  if (input == null || input === "") return null;
  if (typeof input === "string") return JSON.parse(input);
  return input;
}

function getPointer(root, pointer) {
  if (typeof pointer !== "string" || !pointer.startsWith("/")) return undefined;
  const parts = pointer.slice(1).split("/").map((part) => part.replace(/~1/g, "/").replace(/~0/g, "~"));
  let current = root;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = current[part];
  }
  return current;
}

function makeResolve(dataModel) {
  return function resolve(value) {
    if (value && typeof value === "object" && !Array.isArray(value) && typeof value.$path === "string") {
      const found = getPointer(dataModel, value.$path);
      return found == null ? "" : found;
    }
    return value;
  };
}

function isValidShape(doc) {
  return doc
    && typeof doc === "object"
    && !Array.isArray(doc)
    && (doc.protocol == null || (typeof doc.protocol === "string" && doc.protocol.startsWith("a2ui")))
    && typeof doc.root === "string"
    && Array.isArray(doc.components)
    && doc.components.length > 0;
}

// Returns { ok, html, title, theme, warnings, errors }.
export function renderA2UI(input) {
  const warnings = [];
  let doc;

  try {
    doc = parse(input);
  } catch (error) {
    return { ok: false, html: "", title: "", theme: null, warnings, errors: [`A1: ${error.message}`] };
  }

  if (doc == null) return { ok: false, html: "", title: "", theme: null, warnings, errors: ["NO_ENHANCED"] };
  if (!isValidShape(doc)) {
    return { ok: false, html: "", title: "", theme: null, warnings, errors: ["A1: A2UI doc needs root, components[], and (if present) protocol starting with a2ui"] };
  }

  const byId = new Map();
  for (const node of doc.components) {
    if (node && typeof node.id === "string" && typeof node.component === "string") byId.set(node.id, node);
  }
  if (!byId.has(doc.root)) {
    return { ok: false, html: "", title: "", theme: null, warnings, errors: [`A2: root "${doc.root}" is not a defined component`] };
  }

  const resolve = makeResolve(doc.dataModel || {});
  let depth = 0;
  let uidCounter = 0;
  const seen = new Set();

  function renderNode(id) {
    const node = byId.get(id);
    if (!node) { warnings.push(`A3: missing component reference "${id}"`); return ""; }
    if (seen.has(id)) { warnings.push(`A3: cycle at "${id}"`); return ""; }
    const fn = CATALOG.get(node.component);
    if (!fn) { warnings.push(`A4: unknown component "${node.component}"`); return ""; }
    if (depth >= MAX_DEPTH) { warnings.push("A5: max nesting depth reached"); return ""; }
    seen.add(id);
    depth += 1;
    const html = fn(node, ctx);
    depth -= 1;
    seen.delete(id);
    return html;
  }

  const ctx = {
    resolve,
    sanitize: sanitizeEnhanced,
    warn: (message) => warnings.push(message),
    uid: (prefix) => `hs-${prefix}-${uidCounter++}`,
    renderChild: renderNode,
    renderChildren: (ids) => (Array.isArray(ids) ? ids.map(renderNode).join("") : "")
  };

  const html = renderNode(doc.root);

  // A2UI mixes visual components (Chart/Image) that carry no text, so reject only a genuinely
  // empty render — measured by rendered markup, not text length.
  if (html.trim().length === 0) {
    return { ok: false, html: "", title: typeof doc.title === "string" ? doc.title : "", theme: doc.theme || null, warnings, errors: ["A6: rendered A2UI is empty"] };
  }

  return {
    ok: true,
    html,
    title: typeof doc.title === "string" ? doc.title : "",
    theme: typeof doc.theme === "string" ? doc.theme : null,
    warnings,
    errors: []
  };
}
