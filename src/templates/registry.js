import * as generic from "./generic/index.js";
import * as meeting from "./meeting/index.js";
import * as proposal from "./proposal/index.js";
import * as tutorial from "./tutorial/index.js";
import * as release from "./release/index.js";
import { AdapterError } from "../adapters/errors.js";

export const TEMPLATE_SLOTS = Object.freeze({
  generic: ["body"],
  meeting: ["conclusions", "actions", "open_issues", "discussion"],
  proposal: ["summary", "problem", "solution", "plan", "risks"],
  tutorial: ["overview", "prerequisites", "steps", "faq"],
  release: ["highlights", "changes", "upgrade_notes"]
});

const templateNames = Object.freeze(Object.keys(TEMPLATE_SLOTS));

function sectionTemplate(name) {
  return {
    name,
    slots: TEMPLATE_SLOTS[name],
    render: generic.render
  };
}

const registry = new Map(templateNames.map((name) => [
  name,
  name === "generic"
    ? { name, slots: generic.slots, render: generic.render }
    : name === "meeting"
      ? { name, slots: meeting.slots, render: meeting.render }
      : name === "proposal"
        ? { name, slots: proposal.slots, render: proposal.render }
        : name === "tutorial"
          ? { name, slots: tutorial.slots, render: tutorial.render }
          : name === "release"
            ? { name, slots: release.slots, render: release.render }
            : sectionTemplate(name)
]));

export function list() {
  return [...templateNames];
}

export function get(name) {
  const template = registry.get(name);
  if (!template) {
    throw new AdapterError("INVALID_INPUT", `Unknown template "${name}". Expected one of: ${templateNames.join(", ")}`);
  }
  return template;
}
