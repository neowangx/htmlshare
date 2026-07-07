import sanitizeHtml from "sanitize-html";

const ALLOWED_TAGS = [
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "p",
  "ul",
  "ol",
  "li",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "pre",
  "code",
  "strong",
  "em",
  "a",
  "blockquote",
  "hr",
  "br",
  "img",
  "div",
  "span",
  "section",
  "aside",
  "details",
  "summary",
  "mark",
  "button",
  "nav"
];

const ALLOWED_CLASSES = {
  div: ["tldr", "callout", "callout-info", "callout-warn", "callout-key", "card", "cards", "tabs", "panel", "cols"],
  aside: ["keypoints"],
  details: ["collapse"],
  button: ["tab"],
  mark: ["hl"],
  span: ["hl"],
  nav: ["table-of-contents"]
};

const FAITHFUL_CLASSES = {
  ...ALLOWED_CLASSES,
  code: ["hljs", /^language-[a-z0-9_-]+$/i],
  span: ["hl", /^hljs-[a-z0-9_-]+$/i]
};

const BASE_OPTIONS = {
  allowedTags: ALLOWED_TAGS,
  // id on headings/nav so markdown-it-anchor heading ids and toc-done-right <nav> anchors
  // survive — without them every [[toc]] / heading link is a dead fragment. id carries no
  // script vector; only these structural tags get it.
  allowedAttributes: {
    a: ["href"],
    img: ["src", "alt"],
    h1: ["id"], h2: ["id"], h3: ["id"], h4: ["id"], h5: ["id"], h6: ["id"],
    nav: ["id"],
    "*": ["class"]
  },
  allowedSchemes: [],
  allowedSchemesByTag: { a: ["http", "https", "mailto"], img: ["data"] },
  allowProtocolRelative: false,
  nonTextTags: ["script", "style", "textarea", "noscript"],
  disallowedTagsMode: "discard",
  exclusiveFilter(frame) {
    return frame.tag === "img" && /^data:image\/svg/i.test(frame.attribs.src || "");
  }
};

export function sanitizeEnhanced(html) {
  if (!html) return "";
  return sanitizeHtml(html, {
    ...BASE_OPTIONS,
    allowedClasses: ALLOWED_CLASSES
  }).trim();
}

export function sanitizeFaithful(html) {
  if (!html) return "";
  return sanitizeHtml(html, {
    ...BASE_OPTIONS,
    allowedClasses: FAITHFUL_CLASSES
  }).trim();
}

export { ALLOWED_CLASSES, ALLOWED_TAGS };
