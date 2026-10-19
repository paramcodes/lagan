import type { MuxPlayerProps } from "@mux/mux-player-react";
import { act, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { LessonPlayerProps } from "./player";
import { LessonPlayer } from "./player";

const mock = vi.hoisted(() => ({ calls: [] as Partial<MuxPlayerProps>[] }));

vi.mock("@mux/mux-player-react", async () => {
  const { createElement } = await import("react");
  return {
    default: (props: Partial<MuxPlayerProps>) => {
      mock.calls.push(props);
      return createElement("div", { "data-testid": "mux-player" });
    },
  };
});

type MuxTimeUpdateEvent = Parameters<NonNullable<MuxPlayerProps["onTimeUpdate"]>>[0];

function renderPlayer(props: LessonPlayerProps): Partial<MuxPlayerProps> {
  mock.calls.length = 0;
  render(<LessonPlayer {...props} />);
  const latest = mock.calls.at(-1);
  if (!latest) throw new Error("MuxPlayer was not rendered");
  return latest;
}

function timeUpdate(props: Partial<MuxPlayerProps>, currentTime: number, duration: number) {
  const event = { target: { currentTime, duration } } as unknown as MuxTimeUpdateEvent;
  act(() => {
    props.onTimeUpdate?.(event);
  });
}

describe("LessonPlayer", () => {
  it("passes the playback id, title and resume position to Mux", () => {
    const props = renderPlayer({
      playbackId: "playback_1",
      startTime: 42.5,
      title: "Intro to vectors",
    });

    expect(props.playbackId).toBe("playback_1");
    expect(props.title).toBe("Intro to vectors");
    expect(props.startTime).toBe(42.5);
    expect(props.disablePseudoEnded).toBe(true);
  });

  it("themes the player with design tokens", () => {
    const style = renderPlayer({ playbackId: "playback_1" }).style;

    expect(style?.["--media-accent-color"]).toBe("var(--color-accent)");
    expect(style?.["--media-secondary-color"]).toBe("var(--color-brand)");
    expect(style?.["--media-font-family"]).toBe("var(--font-sans)");
  });

  it("lets callers override token values", () => {
    const style = renderPlayer({
      playbackId: "playback_1",
      accentColor: "var(--color-chalk)",
      themeTokens: { "--media-range-thumb-background": "var(--color-due)" },
    }).style;

    expect(style?.["--media-accent-color"]).toBe("var(--color-chalk)");
    expect(style?.["--media-range-thumb-background"]).toBe("var(--color-due)");
  });

  it("rounds the player frame with the panel radius token", () => {
    const { container } = render(<LessonPlayer playbackId="playback_1" />);
    const frame = container.firstElementChild as HTMLElement;

    expect(frame.style.borderRadius).toBe("var(--radius-panel)");
    expect(frame.style.overflow).toBe("hidden");
  });

  it("keeps Mux hotkeys and captions at their enabled defaults", () => {
    const props = renderPlayer({ playbackId: "playback_1" });

    expect(props.nohotkeys).toBeUndefined();
    expect(props.defaultHiddenCaptions).toBeUndefined();
  });

  it("reports progress once per whole second with the watched fraction", () => {
    const onProgress = vi.fn();
    const props = renderPlayer({ playbackId: "playback_1", onProgress });

    timeUpdate(props, 0.25, 100);
    timeUpdate(props, 0.75, 100);
    timeUpdate(props, 2, 100);
    timeUpdate(props, 25, 100);

    expect(onProgress.mock.calls).toEqual([
      [{ currentTime: 0.25, duration: 100, percent: 0.0025 }],
      [{ currentTime: 2, duration: 100, percent: 0.02 }],
      [{ currentTime: 25, duration: 100, percent: 0.25 }],
    ]);
  });

  it("reports percent as 0 while the duration is unknown", () => {
    const onProgress = vi.fn();
    const props = renderPlayer({ playbackId: "stream_1", onProgress });

    timeUpdate(props, 3, Number.POSITIVE_INFINITY);

    expect(onProgress).toHaveBeenCalledWith({
      currentTime: 3,
      duration: Number.POSITIVE_INFINITY,
      percent: 0,
    });
  });

  it("signals completion when playback ends", () => {
    const onComplete = vi.fn();
    const props = renderPlayer({ playbackId: "playback_1", onComplete });

    act(() => {
      props.onEnded?.({} as unknown as MuxTimeUpdateEvent);
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
