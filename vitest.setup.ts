import "@testing-library/jest-dom/vitest";

/**
 * jsdom implements neither `Range.getClientRects` nor `Range.getBoundingClientRect`.
 * ProseMirror calls both when it scrolls the selection into view, so a TipTap
 * toolbar click throws from a `requestAnimationFrame` callback that no test can
 * await. Zero rects are enough: the scroll path only reads geometry.
 */
const zeroRect = (): DOMRect =>
  ({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: 0,
    height: 0,
    toJSON: () => ({}),
  }) as DOMRect;

if (typeof Range !== "undefined") {
  if (!Range.prototype.getClientRects) {
    Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
  }

  if (!Range.prototype.getBoundingClientRect) {
    Range.prototype.getBoundingClientRect = zeroRect;
  }
}
