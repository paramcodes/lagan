import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import {
  DEFAULT_PROGRESS_THROTTLE_MS,
  type PersistProgressPayload,
  useLessonProgress,
  type UseLessonProgressOptions,
} from "./progress-hook";

interface PromiseResolvers<T> {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
}

declare global {
  interface PromiseConstructor {
    withResolvers<T>(): PromiseResolvers<T>;
  }
}

describe("useLessonProgress", () => {
  let onPersist: Mock<(payload: PersistProgressPayload) => Promise<void>>;
  let onCompleted: Mock<() => void>;
  let onError: Mock<(error: unknown) => void>;

  const createHook = (options: Partial<UseLessonProgressOptions> = {}) =>
    renderHook(
      (props: Partial<UseLessonProgressOptions>) =>
        useLessonProgress({
          lessonId: "les_1",
          courseId: "course_1",
          onPersistProgress: onPersist,
          ...props,
        }),
      { initialProps: options },
    );

  beforeEach(() => {
    vi.useFakeTimers();
    onPersist = vi.fn(async () => {});
    onCompleted = vi.fn();
    onError = vi.fn();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  describe("resume and initial state", () => {
    it("initializes with default zero position and incomplete state", () => {
      const { result } = createHook();

      expect(result.current.positionSeconds).toBe(0);
      expect(result.current.playbackSeconds).toBe(0);
      expect(result.current.completed).toBe(false);
      expect(result.current.hasPendingChanges).toBe(false);
      expect(result.current.isPersisting).toBe(false);
      expect(onPersist).not.toHaveBeenCalled();
    });

    it("resumes from initialPositionSeconds and initialCompleted", () => {
      const { result } = createHook({
        initialPositionSeconds: 142.5,
        initialCompleted: true,
        onCompleted,
      });

      expect(result.current.positionSeconds).toBe(142.5);
      expect(result.current.playbackSeconds).toBe(142.5);
      expect(result.current.completed).toBe(true);
      expect(result.current.hasPendingChanges).toBe(false);
      expect(onCompleted).not.toHaveBeenCalled();
      expect(onPersist).not.toHaveBeenCalled();
    });

    it("accepts initialPlaybackSeconds as an alias", () => {
      const { result } = createHook({ initialPlaybackSeconds: 88 });
      expect(result.current.positionSeconds).toBe(88);
      expect(result.current.playbackSeconds).toBe(88);
    });

    it("does not persist on unmount if no progress occurred since resume", () => {
      const { unmount } = createHook({ initialPositionSeconds: 50 });
      unmount();
      expect(onPersist).not.toHaveBeenCalled();
    });
  });

  describe("optimistic local updates", () => {
    it("updates positionSeconds optimistically via number input", () => {
      const { result } = createHook();
      act(() => {
        result.current.handleProgress(12.4);
      });
      expect(result.current.positionSeconds).toBe(12.4);
      expect(result.current.playbackSeconds).toBe(12.4);
      expect(result.current.hasPendingChanges).toBe(true);
    });

    it("updates positionSeconds via object input", () => {
      const { result } = createHook();
      act(() => {
        result.current.handleProgress({ currentTime: 25.5, duration: 100, percent: 0.255 });
      });
      expect(result.current.positionSeconds).toBe(25.5);

      act(() => {
        result.current.handleProgress({ positionSeconds: 30 });
      });
      expect(result.current.positionSeconds).toBe(30);
    });

    it("sanitizes invalid or negative position values", () => {
      const { result } = createHook();
      act(() => {
        result.current.handleProgress(-10);
      });
      expect(result.current.positionSeconds).toBe(0);

      act(() => {
        result.current.handleProgress(Number.NaN);
      });
      expect(result.current.positionSeconds).toBe(0);
    });
  });

  describe("throttled persistence", () => {
    it("throttles position persistence with default 5000ms delay", async () => {
      const { result } = createHook();

      act(() => {
        result.current.handleProgress(1);
      });
      expect(onPersist).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(2000);
        result.current.handleProgress(2);
      });
      expect(onPersist).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(2999);
      });
      expect(onPersist).not.toHaveBeenCalled();

      await act(async () => {
        vi.advanceTimersByTime(1);
      });

      expect(onPersist).toHaveBeenCalledTimes(1);
      expect(onPersist).toHaveBeenCalledWith({
        lessonId: "les_1",
        courseId: "course_1",
        positionSeconds: 2,
        completed: false,
      });
      expect(result.current.hasPendingChanges).toBe(false);
    });

    it("ensures the final position is never dropped when playback stops", async () => {
      const { result } = createHook({ throttleMs: 3000 });

      act(() => {
        result.current.handleProgress(1);
      });
      act(() => {
        result.current.handleProgress(2);
      });
      act(() => {
        result.current.handleProgress(3);
      });

      await act(async () => {
        vi.advanceTimersByTime(3000);
      });

      expect(onPersist).toHaveBeenCalledTimes(1);
      expect(onPersist).toHaveBeenCalledWith({
        lessonId: "les_1",
        courseId: "course_1",
        positionSeconds: 3,
        completed: false,
      });

      await act(async () => {
        vi.advanceTimersByTime(10000);
      });
      expect(onPersist).toHaveBeenCalledTimes(1);
    });

    it("persists periodically during continuous playback without starving writes", async () => {
      const { result } = createHook({ throttleMs: 2000 });

      act(() => {
        result.current.handleProgress(1);
      });
      await act(async () => {
        vi.advanceTimersByTime(2000);
      });
      expect(onPersist).toHaveBeenCalledTimes(1);
      expect(onPersist).toHaveBeenLastCalledWith(expect.objectContaining({ positionSeconds: 1 }));

      act(() => {
        result.current.handleProgress(3);
      });
      await act(async () => {
        vi.advanceTimersByTime(2000);
      });
      expect(onPersist).toHaveBeenCalledTimes(2);
      expect(onPersist).toHaveBeenLastCalledWith(expect.objectContaining({ positionSeconds: 3 }));
    });

    it("supports immediate flush option on updateProgress", async () => {
      const { result } = createHook({ throttleMs: 5000 });

      await act(async () => {
        result.current.updateProgress(45, { immediate: true });
      });

      expect(onPersist).toHaveBeenCalledTimes(1);
      expect(onPersist).toHaveBeenCalledWith({
        lessonId: "les_1",
        courseId: "course_1",
        positionSeconds: 45,
        completed: false,
      });
    });

    it("persists immediately when throttleMs is 0", async () => {
      const { result } = createHook({ throttleMs: 0 });

      await act(async () => {
        result.current.handleProgress(10);
      });

      expect(onPersist).toHaveBeenCalledTimes(1);
      expect(onPersist).toHaveBeenCalledWith(expect.objectContaining({ positionSeconds: 10 }));
    });
  });

  describe("completion and monotonicity", () => {
    it("marks complete on handleComplete() and flushes immediately", async () => {
      const { result } = createHook({
        initialPositionSeconds: 90,
        onCompleted,
      });

      await act(async () => {
        result.current.handleComplete();
      });

      expect(result.current.completed).toBe(true);
      expect(onCompleted).toHaveBeenCalledTimes(1);
      expect(onPersist).toHaveBeenCalledTimes(1);
      expect(onPersist).toHaveBeenCalledWith({
        lessonId: "les_1",
        courseId: "course_1",
        positionSeconds: 90,
        completed: true,
      });
    });

    it("marks complete on markComplete(targetPosition) and flushes immediately", async () => {
      const { result } = createHook({ onCompleted });

      await act(async () => {
        result.current.markComplete(120);
      });

      expect(result.current.positionSeconds).toBe(120);
      expect(result.current.completed).toBe(true);
      expect(onCompleted).toHaveBeenCalledTimes(1);
      expect(onPersist).toHaveBeenCalledWith({
        lessonId: "les_1",
        courseId: "course_1",
        positionSeconds: 120,
        completed: true,
      });
    });

    it("marks complete when handleProgress receives completed: true", async () => {
      const { result } = createHook({ onCompleted });

      await act(async () => {
        result.current.handleProgress({ currentTime: 50, completed: true });
      });

      expect(result.current.completed).toBe(true);
      expect(onCompleted).toHaveBeenCalledTimes(1);
      expect(onPersist).toHaveBeenCalledTimes(1);
      expect(onPersist).toHaveBeenCalledWith(
        expect.objectContaining({ positionSeconds: 50, completed: true }),
      );
    });

    it("enforces monotonic completion: once complete, cannot revert to false", async () => {
      const { result } = createHook({ onCompleted });

      await act(async () => {
        result.current.handleComplete();
      });
      expect(result.current.completed).toBe(true);

      act(() => {
        result.current.handleProgress({ currentTime: 10, completed: false });
      });
      expect(result.current.completed).toBe(true);

      act(() => {
        result.current.handleProgress(5);
      });
      expect(result.current.completed).toBe(true);

      await act(async () => {
        vi.advanceTimersByTime(DEFAULT_PROGRESS_THROTTLE_MS);
      });

      expect(onPersist).toHaveBeenLastCalledWith({
        lessonId: "les_1",
        courseId: "course_1",
        positionSeconds: 5,
        completed: true,
      });
      expect(onCompleted).toHaveBeenCalledTimes(1);
    });
  });

  describe("unmount and visibility flush", () => {
    it("flushes pending progress immediately on unmount", () => {
      const { result, unmount } = createHook();

      act(() => {
        result.current.handleProgress(33);
      });
      expect(onPersist).not.toHaveBeenCalled();

      unmount();

      expect(onPersist).toHaveBeenCalledTimes(1);
      expect(onPersist).toHaveBeenCalledWith({
        lessonId: "les_1",
        courseId: "course_1",
        positionSeconds: 33,
        completed: false,
      });
    });

    it("flushes pending progress immediately on document visibilitychange to hidden", async () => {
      const { result } = createHook();

      act(() => {
        result.current.handleProgress(55);
      });
      expect(onPersist).not.toHaveBeenCalled();

      Object.defineProperty(document, "visibilityState", {
        value: "hidden",
        configurable: true,
      });

      await act(async () => {
        document.dispatchEvent(new Event("visibilitychange"));
      });

      expect(onPersist).toHaveBeenCalledTimes(1);
      expect(onPersist).toHaveBeenCalledWith({
        lessonId: "les_1",
        courseId: "course_1",
        positionSeconds: 55,
        completed: false,
      });

      Object.defineProperty(document, "visibilityState", {
        value: "visible",
        configurable: true,
      });
    });

    it("does not flush on visibilitychange when visibilityState is visible", async () => {
      const { result } = createHook();

      act(() => {
        result.current.handleProgress(20);
      });

      Object.defineProperty(document, "visibilityState", {
        value: "visible",
        configurable: true,
      });

      await act(async () => {
        document.dispatchEvent(new Event("visibilitychange"));
      });

      expect(onPersist).not.toHaveBeenCalled();
    });

    it("flushes pending progress on window pagehide", async () => {
      const { result } = createHook();

      act(() => {
        result.current.handleProgress(77);
      });

      await act(async () => {
        window.dispatchEvent(new Event("pagehide"));
      });

      expect(onPersist).toHaveBeenCalledTimes(1);
      expect(onPersist).toHaveBeenCalledWith(expect.objectContaining({ positionSeconds: 77 }));
    });
  });

  describe("network resilience and error recovery", () => {
    it("preserves optimistic state and calls onError when persistence fails", async () => {
      const error = new Error("Network offline");
      onPersist.mockRejectedValueOnce(error);

      const { result } = createHook({
        throttleMs: 1000,
        onError,
      });

      act(() => {
        result.current.handleProgress(40);
      });

      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      expect(onPersist).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(error);
      expect(result.current.positionSeconds).toBe(40);
      expect(result.current.hasPendingChanges).toBe(true);
    });

    it("retries persistence after throttleMs and resolves when network recovers", async () => {
      const error = new Error("Gateway timeout");
      onPersist.mockRejectedValueOnce(error);

      const { result } = createHook({
        throttleMs: 1000,
        onError,
      });

      act(() => {
        result.current.handleProgress(40);
      });

      await act(async () => {
        vi.advanceTimersByTime(1000);
      });
      expect(onPersist).toHaveBeenCalledTimes(1);
      expect(result.current.hasPendingChanges).toBe(true);

      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      expect(onPersist).toHaveBeenCalledTimes(2);
      expect(onPersist).toHaveBeenLastCalledWith(expect.objectContaining({ positionSeconds: 40 }));
      expect(result.current.hasPendingChanges).toBe(false);
    });

    it("serializes concurrent persist calls without sending duplicate identical requests", async () => {
      const { promise, resolve: resolvePersist } = Promise.withResolvers<void>();
      onPersist.mockReturnValue(promise);

      const { result } = createHook({ throttleMs: 1000 });

      act(() => {
        result.current.handleProgress(10);
      });

      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(onPersist).toHaveBeenCalledTimes(1);
      expect(result.current.isPersisting).toBe(true);

      let secondFlushPromise: Promise<void> | undefined;
      act(() => {
        secondFlushPromise = result.current.flush();
      });

      expect(onPersist).toHaveBeenCalledTimes(1);

      await act(async () => {
        resolvePersist();
        await secondFlushPromise;
      });

      expect(result.current.isPersisting).toBe(false);
      expect(onPersist).toHaveBeenCalledTimes(1);
    });
  });

  describe("lesson and course navigation", () => {
    it("flushes pending progress of previous lesson and resets for new lesson", async () => {
      const { result, rerender } = createHook({
        lessonId: "les_1",
        courseId: "course_1",
        initialPositionSeconds: 0,
      });

      act(() => {
        result.current.handleProgress(15);
      });
      expect(onPersist).not.toHaveBeenCalled();

      await act(async () => {
        rerender({
          lessonId: "les_2",
          courseId: "course_1",
          initialPositionSeconds: 0,
        });
      });

      expect(onPersist).toHaveBeenCalledWith({
        lessonId: "les_1",
        courseId: "course_1",
        positionSeconds: 15,
        completed: false,
      });

      expect(result.current.positionSeconds).toBe(0);
      expect(result.current.hasPendingChanges).toBe(false);
    });
  });
});
