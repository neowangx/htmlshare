import assert from "node:assert/strict";
import { test } from "node:test";

import { composePage } from "../src/compose.js";
import { get, list } from "../src/templates/registry.js";

test("C-05 generic template slots match docs/04 section 8", () => {
  assert.deepEqual(get("generic").slots, ["body"]);
});

test("C-05 unknown template error lists all legal enum values", () => {
  assert.throws(
    () => get("minutes"),
    (error) => {
      assert.equal(error.code, "INVALID_INPUT");
      for (const name of ["generic", "meeting", "proposal", "tutorial", "release"]) {
        assert.match(error.message, new RegExp(name));
      }
      return true;
    }
  );
});

test("C-05 template registry exposes docs/04 template names in order", () => {
  assert.deepEqual(list(), ["generic", "meeting", "proposal", "tutorial", "release"]);
});

test("C-05 generic render snapshot is deterministic", () => {
  const template = get("generic");
  const html = template.render([
    { slot: "body", html: "<p>这是正文。</p><details><summary>背景</summary><p>补充信息。</p></details>" }
  ], {
    title: "通用文档",
    tldr: ["先读这一条", "再看正文"]
  });

  assert.equal(html, '<div class="hs-tldr"><h2>TL;DR</h2><ul><li>先读这一条</li><li>再看正文</li></ul></div><section class="hs-section" data-slot="body"><h2>正文</h2><p>这是正文。</p><details><summary>背景</summary><p>补充信息。</p></details></section>');
});

test("C-05 composePage renders generic enhanced content through template registry", () => {
  const { html, mode, validation } = composePage({
    title: "原文标题",
    faithfulHtml: "<p>原文内容足够长，原文内容足够长，原文内容足够长。</p>",
    enhanced: {
      version: 1,
      template: "generic",
      style: "clinical",
      title: "通用文档",
      tldr: ["重点一", "重点二"],
      sections: [
        { slot: "body", html: "<p>增强正文内容足够长，增强正文内容足够长。</p>" }
      ]
    }
  });

  assert.equal(mode, "dual");
  assert.equal(validation.ok, true);
  assert.match(html, /<title>通用文档<\/title>/);
  assert.match(html, /data-slot="body"><h2>正文<\/h2>/);
  assert.match(html, /<div class="hs-tldr"><h2>TL;DR<\/h2>/);
});
