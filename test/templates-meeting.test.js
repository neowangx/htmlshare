import assert from "node:assert/strict";
import { test } from "node:test";

import { composePage } from "../src/compose.js";
import { get } from "../src/templates/registry.js";

function meetingEnhanced(overrides = {}) {
  return {
    version: 1,
    template: "meeting",
    style: "clinical",
    title: "产品评审会纪要",
    tldr: ["确认继续推进", "预算周五前复核"],
    sections: [
      { slot: "conclusions", html: "<ul><li>继续推进官网改版。</li></ul>" },
      { slot: "actions", html: "<ul><li>Alice｜整理预算｜周五</li><li>Bob｜完成原型｜下周一</li><li>Carol｜同步客户｜未指定</li></ul>" },
      { slot: "discussion", html: "<p>团队讨论了风险、预算和发布时间。</p>" }
    ],
    ...overrides
  };
}

test("C-10 meeting slots match docs/04 section 8", () => {
  assert.deepEqual(get("meeting").slots, ["conclusions", "actions", "open_issues", "discussion"]);
});

test("C-10 meeting actions render as owner-task-due cards when there are at least three", () => {
  const { html, mode, validation } = composePage({
    title: "会议",
    faithfulHtml: "<p>原文内容足够长，原文内容足够长，原文内容足够长。</p>",
    enhanced: meetingEnhanced()
  });

  assert.equal(mode, "dual");
  assert.equal(validation.ok, true);
  assert.match(html, /class="hs-action-grid"/);
  assert.match(html, /class="hs-action-owner">Alice<\/span><p>整理预算<\/p><span class="hs-action-due">周五<\/span>/);
  assert.match(html, /data-slot="discussion"[\s\S]*<details><summary>讨论过程<\/summary>/);
});

test("C-10 meeting omits empty open_issues heading", () => {
  const { html } = composePage({
    title: "会议",
    faithfulHtml: "<p>原文内容足够长，原文内容足够长，原文内容足够长。</p>",
    enhanced: meetingEnhanced()
  });

  assert.doesNotMatch(html, /开放问题/);
});

test("C-10 meeting print CSS expands details", () => {
  const { html } = composePage({
    title: "会议",
    faithfulHtml: "<p>原文内容足够长，原文内容足够长，原文内容足够长。</p>",
    enhanced: meetingEnhanced()
  });

  // CSS alone can't reveal closed <details> (UA shadow DOM), so we assert the reliable
  // mechanism: print media rule + a beforeprint handler that opens every <details>.
  assert.match(html, /@media print[\s\S]*details\s*\{\s*display: block/);
  assert.match(html, /beforeprint[\s\S]*\.open = true/);
});
