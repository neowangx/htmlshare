import * as generic from "./generic/index.js";
import * as meeting from "./meeting/index.js";
import * as proposal from "./proposal/index.js";
import * as tutorial from "./tutorial/index.js";
import * as release from "./release/index.js";
import { AppError } from "../lib/errors.js";

export const TEMPLATE_SLOTS = Object.freeze({
  generic: ["body"],
  meeting: ["conclusions", "actions", "open_issues", "discussion"],
  proposal: ["summary", "problem", "solution", "plan", "risks"],
  tutorial: ["overview", "prerequisites", "steps", "faq"],
  release: ["highlights", "changes", "upgrade_notes"]
});

const templateNames = Object.freeze(Object.keys(TEMPLATE_SLOTS));

const modules = { generic, meeting, proposal, tutorial, release };

const registry = new Map(templateNames.map((name) => {
  const mod = modules[name];
  return [name, { name, slots: mod.slots, render: mod.render }];
}));

export function list() {
  return [...templateNames];
}

export function get(name) {
  const template = registry.get(name);
  if (!template) {
    throw new AppError("INVALID_INPUT", `Unknown template "${name}". Expected one of: ${templateNames.join(", ")}`);
  }
  return template;
}
