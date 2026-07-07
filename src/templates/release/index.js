import { escapeHtml } from "../../convert.js";
import { render as renderGenericTldr } from "../generic/index.js";
import { listItemsHtml, textOf } from "../util.js";

export const slots = ["highlights", "changes", "upgrade_notes"];

const LABELS = {
  highlights: "亮点",
  changes: "变更",
  upgrade_notes: "升级说明"
};

// Only treat a leading word as a category label when a real separator (colon / dash /
// space) follows it — otherwise "修复了登录问题" would be truncated to "了登录问题".
// Longer English keywords precede their prefixes so "fixed" wins over "fix".
const SEP = "(?:\\s*[:：]\\s*|[\\s\\-]+)";
const GROUPS = [
  ["新增", new RegExp(`^(新增|added|add|feature)${SEP}(.+)$`, "i")],
  ["修复", new RegExp(`^(修复|fixed|fix|bugfix)${SEP}(.+)$`, "i")],
  ["破坏性", new RegExp(`^(破坏性|breaking|break)${SEP}(.+)$`, "i")],
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
    const [label, html] = classify(item);
    groups.get(label).push(html);
  }

  const html = [...groups.entries()]
    .filter(([, entries]) => entries.length > 0)
    .map(([label, entries]) => `<div class="hs-change-group"><span class="hs-change-badge">${escapeHtml(label)}</span><ul>${entries.map((entry) => `<li>${entry}</li>`).join("")}</ul></div>`)
    .join("");
  return `<section class="hs-section" data-slot="changes"><h2>${LABELS.changes}</h2>${html}</section>`;
}

function extractListItems(html) {
  return listItemsHtml(html);
}

// Classify by the item's text prefix, but keep the (sanitized) HTML for display — inline
// code/links in a changelog line survive. When a label is matched, strip only the leading
// label+separator text from the HTML.
function classify(itemHtml) {
  const text = textOf(itemHtml);
  for (const [label, pattern] of GROUPS) {
    if (label === "其他") break;
    if (pattern.test(text)) {
      return [label, itemHtml.replace(pattern, "$2").trim()];
    }
  }
  return ["其他", itemHtml];
}
