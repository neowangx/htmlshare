import { escapeHtml } from "../../convert.js";
import { render as renderGenericTldr } from "../generic/index.js";

export const slots = ["conclusions", "actions", "open_issues", "discussion"];

const LABELS = {
  conclusions: "结论",
  actions: "行动项",
  open_issues: "开放问题",
  discussion: "讨论过程"
};

export function render(sections = [], common = {}) {
  const bySlot = new Map(sections.map((section) => [section.slot, section]));
  const ordered = slots
    .map((slot) => bySlot.get(slot))
    .filter(Boolean)
    .map((section) => renderSection(section))
    .join("");

  return `${renderGenericTldr([], common)}${ordered}`;
}

function renderSection(section) {
  if (section.slot === "actions") return renderActions(section);
  if (section.slot === "discussion") return renderDiscussion(section);
  return `<section class="hs-section" data-slot="${escapeHtml(section.slot)}"><h2>${LABELS[section.slot]}</h2>${section.html}</section>`;
}

function renderActions(section) {
  const items = extractListItems(section.html);
  if (items.length < 3) {
    return `<section class="hs-section" data-slot="actions"><h2>${LABELS.actions}</h2>${section.html}</section>`;
  }

  const cards = items.map((item) => {
    const [owner, task, due] = splitAction(item);
    return `<article class="hs-action-card"><span class="hs-action-owner">${escapeHtml(owner)}</span><p>${escapeHtml(task)}</p><span class="hs-action-due">${escapeHtml(due)}</span></article>`;
  }).join("");

  return `<section class="hs-section" data-slot="actions"><h2>${LABELS.actions}</h2><div class="hs-action-grid">${cards}</div></section>`;
}

function renderDiscussion(section) {
  const html = /<details[\s>]/i.test(section.html)
    ? section.html
    : `<details><summary>${LABELS.discussion}</summary>${section.html}</details>`;
  return `<section class="hs-section" data-slot="discussion"><h2>${LABELS.discussion}</h2>${html}</section>`;
}

function extractListItems(html) {
  return [...String(html).matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
    .map((match) => stripTags(match[1]))
    .filter(Boolean);
}

function stripTags(value) {
  return value.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function splitAction(item) {
  const parts = item.split(/\s*[|｜]\s*/).map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 3) return [parts[0], parts.slice(1, -1).join(" / "), parts.at(-1)];
  if (parts.length === 2) return [parts[0], parts[1], "未指定"];
  return ["未指定", item, "未指定"];
}
