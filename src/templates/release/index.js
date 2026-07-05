import { escapeHtml } from "../../convert.js";
import { render as renderGenericTldr } from "../generic/index.js";

export const slots = ["highlights", "changes", "upgrade_notes"];

const LABELS = {
  highlights: "亮点",
  changes: "变更",
  upgrade_notes: "升级说明"
};

const GROUPS = [
  ["新增", /^(新增|add|added|feature)[:：\s-]*(.+)$/i],
  ["修复", /^(修复|fix|fixed|bugfix)[:：\s-]*(.+)$/i],
  ["破坏性", /^(破坏性|breaking|break)[:：\s-]*(.+)$/i],
  ["其他", /^(.+)$/]
];

export function render(sections = [], common = {}) {
  const bySlot = new Map(sections.map((section) => [section.slot, section]));
  const ordered = slots
    .map((slot) => bySlot.get(slot))
    .filter(Boolean)
    .map((section) => section.slot === "changes" ? renderChanges(section) : renderSection(section))
    .join("");

  return `${renderGenericTldr([], common)}${ordered}`;
}

function renderSection(section) {
  return `<section class="hs-section" data-slot="${escapeHtml(section.slot)}"><h2>${LABELS[section.slot]}</h2>${section.html}</section>`;
}

function renderChanges(section) {
  const items = extractListItems(section.html);
  if (!items.length) return renderSection(section);

  const groups = new Map(GROUPS.map(([label]) => [label, []]));
  for (const item of items) {
    const [label, text] = classify(item);
    groups.get(label).push(text);
  }

  const html = [...groups.entries()]
    .filter(([, entries]) => entries.length > 0)
    .map(([label, entries]) => `<div class="hs-change-group"><span class="hs-change-badge">${escapeHtml(label)}</span><ul>${entries.map((entry) => `<li>${escapeHtml(entry)}</li>`).join("")}</ul></div>`)
    .join("");
  return `<section class="hs-section" data-slot="changes"><h2>${LABELS.changes}</h2>${html}</section>`;
}

function extractListItems(html) {
  return [...String(html).matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
    .map((match) => stripTags(match[1]))
    .filter(Boolean);
}

function stripTags(value) {
  return value.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function classify(item) {
  for (const [label, pattern] of GROUPS) {
    const match = item.match(pattern);
    if (match) return [label, (match[2] || match[1]).trim()];
  }
  return ["其他", item];
}
