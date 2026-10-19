import { describe, expect, it } from "vitest";
import { sanitizeHtml } from "./sanitize";

describe("sanitizeHtml", () => {
  it("keeps the markup the editor produces", () => {
    const html =
      "<h2>Intro</h2><p><strong>Bold</strong> and <em>italic</em> and <s>struck</s>.</p>" +
      "<ul><li>one</li><li>two</li></ul><blockquote><p>quoted</p></blockquote>" +
      "<pre><code>const a = 1;</code></pre><hr>";

    expect(sanitizeHtml(html)).toBe(html);
  });

  it("drops script tags and their contents", () => {
    expect(sanitizeHtml('<p>safe</p><script>alert("xss")</script>')).toBe("<p>safe</p>");
  });

  it("drops inline event handlers", () => {
    expect(sanitizeHtml('<p onclick="steal()">hi</p>')).toBe("<p>hi</p>");
    expect(sanitizeHtml('<img src="x" onerror="steal()">')).toBe("");
  });

  it("drops javascript: urls", () => {
    expect(sanitizeHtml('<a href="javascript:alert(1)">click</a>')).toBe("<a>click</a>");
  });

  it("drops tags the editor cannot produce", () => {
    expect(sanitizeHtml('<iframe src="https://evil.test"></iframe><p>text</p>')).toBe(
      "<p>text</p>",
    );
  });

  it("hardens links that open a new tab", () => {
    expect(sanitizeHtml('<a href="https://example.com" target="_blank">docs</a>')).toBe(
      '<a href="https://example.com" target="_blank" rel="noopener noreferrer">docs</a>',
    );
  });

  it("is idempotent", () => {
    const once = sanitizeHtml("<p>hi</p><script>alert(1)</script>");
    expect(sanitizeHtml(once)).toBe(once);
  });

  it("returns an empty string for empty input", () => {
    expect(sanitizeHtml("")).toBe("");
  });
});
