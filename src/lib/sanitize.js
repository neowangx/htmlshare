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
  "audio",
  "video",
  "source",
  "track",
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
    a: ["href", "download"],
    img: ["src", "alt", "loading"],
    audio: ["src", "controls", "autoplay", "loop", "muted", "preload"],
    video: ["src", "poster", "controls", "autoplay", "loop", "muted", "preload", "playsinline", "width", "height"],
    source: ["src", "type", "media"],
    track: ["src", "kind", "srclang", "label", "default"],
    h1: ["id"], h2: ["id"], h3: ["id"], h4: ["id"], h5: ["id"], h6: ["id"],
    nav: ["id"],
    "*": ["class"]
  },
  allowedSchemes: [],
  allowedSchemesByTag: {
    a: ["http", "https", "mailto", "data"],
    img: ["data"], audio: ["data"], video: ["data"], source: ["data"], track: ["data"]
  },
  allowProtocolRelative: false,
  nonTextTags: ["script", "style", "textarea", "noscript"],
  disallowedTagsMode: "discard",
  // SVG stays blocked in sanitized prose: an SVG document can carry active/external content.
  // A local SVG used as an image is rejected by the strict collector with a clear input error.
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
