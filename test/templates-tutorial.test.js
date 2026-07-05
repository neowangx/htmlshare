import assert from "node:assert/strict";
import { test } from "node:test";

import { composePage } from "../src/compose.js";
import { get } from "../src/templates/registry.js";

function tutorialEnhanced(overrides = {}) {
  return {
    version: 1,
    template: "tutorial",
    style: "clinical",
    title: "部署教程",
    tldr: ["准备账号", "按步骤部署"],
    sections: [
      { slot: "overview", html: "<p>本教程说明如何发布一个静态页面。</p>" },
      { slot: "prerequisites", html: "<ul><li>Node.js 20</li><li>已登录平台账号</li></ul>" },
      { slot: "steps", html: "<ul><li>安装依赖</li><li>运行发布命令</li><li>检查分享链接</li></ul>" },
      { slot: "faq", html: "<ul><li>发布失败怎么办｜重新登录目标平台后重试</li><li>链接会变化吗｜同一源文件不会变化</li></ul>" }
    ],
    ...overrides
  };
}

test("C-12 tutorial slots match docs/04 section 8", () => {
  assert.deepEqual(get("tutorial").slots, ["overview", "prerequisites", "steps", "faq"]);
});

test("C-12 tutorial steps are rendered as ordered list preserving order", () => {
  const { html, mode, validation } = composePage({
    title: "教程",
    faithfulHtml: "<p>原文内容足够长，原文内容足够长，原文内容足够长。</p>",
    enhanced: tutorialEnhanced()
  });

  assert.equal(mode, "dual");
  assert.equal(validation.ok, true);
  assert.match(html, /<ol class="hs-steps"><li>安装依赖<\/li><li>运行发布命令<\/li><li>检查分享链接<\/li><\/ol>/);
  assert.ok(html.indexOf("安装依赖") < html.indexOf("运行发布命令"));
  assert.ok(html.indexOf("运行发布命令") < html.indexOf("检查分享链接"));
});

test("C-12 tutorial FAQ renders as details", () => {
  const { html } = composePage({
    title: "教程",
    faithfulHtml: "<p>原文内容足够长，原文内容足够长，原文内容足够长。</p>",
    enhanced: tutorialEnhanced()
  });

  assert.match(html, /<details class="hs-faq-item"><summary>发布失败怎么办<\/summary><p>重新登录目标平台后重试<\/p><\/details>/);
});

test("C-12 tutorial keeps code blocks in steps", () => {
  const { html } = composePage({
    title: "教程",
    faithfulHtml: "<p>原文内容足够长，原文内容足够长，原文内容足够长。</p>",
    enhanced: tutorialEnhanced({
      sections: [
        { slot: "overview", html: "<p>概览内容足够长，概览内容足够长。</p>" },
        { slot: "steps", html: "<ol><li>运行 <code>npm test</code><pre><code>npm test</code></pre></li></ol>" }
      ]
    })
  });

  assert.match(html, /<pre><code>npm test<\/code><\/pre>/);
});
