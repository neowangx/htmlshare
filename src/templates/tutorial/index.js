import { escapeHtml } from "../../convert.js";
import { render as renderGenericTldr } from "../generic/index.js";

export const slots = ["overview", "prerequisites", "steps", "faq"];

const LABELS = {
  overview: "概览",
  prerequisites: "前置条件",
  steps: "步骤",
  faq: "FAQ"
};

export function render(sections = [], common = {}) {
  const bySlot = new Map(sections.map((section) => [section.slot, section]));
  const ordered = slots
    .map((slot) => bySlot.get(slot))
    .filter(Boolean)
    .map((section) => {
      if (section.slot === "steps") return renderSteps(section);
      if (section.slot === "faq") return renderFaq(section);
      return renderSection(section);
    })
    .join("");

  return `${renderGenericTldr([], common)}${ordered}`;
}

function renderSection(section) {
  return `<section class="hs-section" data-slot="${escapeHtml(section.slot)}"><h2>${LABELS[section.slot]}</h2>${section.html}</section>`;
}

function renderSteps(section) {
  if (/<ol[\s>]/i.test(section.html)) return renderSection(section);
  const items = extractListItems(section.html);
  if (!items.length) return renderSection(section);
  const list = items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  return `<section class="hs-section" data-slot="steps"><h2>${LABELS.steps}</h2><ol class="hs-steps">${list}</ol></section>`;
}

function renderFaq(section) {
  if (/<details[\s>]/i.test(section.html)) return renderSection(section);
  const items = extractListItems(section.html);
  if (!items.length) return renderSection(section);
  const details = items.map((item) => {
    const [question, answer] = splitFaq(item);
    return `<details class="hs-faq-item"><summary>${escapeHtml(question)}</summary><p>${escapeHtml(answer)}</p></details>`;
  }).join("");
  return `<section class="hs-section" data-slot="faq"><h2>${LABELS.faq}</h2>${details}</section>`;
}

function extractListItems(html) {
  return [...String(html).matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
    .map((match) => stripTags(match[1]))
    .filter(Boolean);
}

function stripTags(value) {
  return value.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function splitFaq(item) {
  const parts = item.split(/\s*[|｜]\s*/).map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) return [parts[0], parts.slice(1).join(" / ")];
  const colon = item.match(/^(.+?)[：:]\s*(.+)$/);
  if (colon) return [colon[1].trim(), colon[2].trim()];
  return [item, "未提供答案"];
}
