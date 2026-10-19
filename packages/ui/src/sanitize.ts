import DOMPurify from "isomorphic-dompurify";

/**
 * Every tag the TipTap StarterKit editor in `editor.tsx` can produce.
 * Keep this list in sync with the extensions enabled there: content that the
 * editor cannot author has no business surviving sanitization.
 */
const EDITOR_TAGS = [
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ul",
  "ol",
  "li",
  "blockquote",
  "pre",
  "code",
  "hr",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "a",
];

const EDITOR_ATTRIBUTES = ["href", "target", "rel"];

let linkHookRegistered = false;

/**
 * `rel="noopener noreferrer"` on every `target="_blank"` link. Without it a
 * link in lesson body copy can reach back into the app through `window.opener`.
 */
function registerLinkHook(): void {
  if (linkHookRegistered) return;
  linkHookRegistered = true;
  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    if (node.nodeName === "A" && node.getAttribute("target") === "_blank") {
      node.setAttribute("rel", "noopener noreferrer");
    }
  });
}

/**
 * Sanitize untrusted HTML — lesson bodies, author profiles, anything an
 * author typed — before it reaches `dangerouslySetInnerHTML` or the database.
 *
 * Strips scripts, event handlers, `javascript:` URLs, inline styles, and every
 * tag the editor cannot produce. Idempotent: sanitizing sanitized HTML returns
 * the same string, so it is safe to run on read as well as on write.
 */
export function sanitizeHtml(dirty: string): string {
  if (!dirty) return "";
  registerLinkHook();
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: EDITOR_TAGS,
    ALLOWED_ATTR: EDITOR_ATTRIBUTES,
    ALLOW_DATA_ATTR: false,
  });
}
