// Shared list helpers for structured templates. Section HTML is already sanitized by
// compose's validateEnhanced, so inline formatting (<code>, <a>, <strong>) is safe to keep
// when reflowing <li> content into cards/steps — we must NOT strip it (docs05: code/links
// preserved verbatim).

export function listItemsHtml(html) {
  return [...String(html).matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
    .map((match) => match[1].replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

export function textOf(html) {
  return String(html).replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

// Split an item on the documented "｜" (or ASCII "|") column delimiter, keeping each cell
// as (sanitized) HTML. Falls back to whole-item when the agent didn't use the delimiter.
export function splitColumns(itemHtml) {
  return String(itemHtml).split(/\s*[|｜]\s*/).map((part) => part.trim()).filter(Boolean);
}
