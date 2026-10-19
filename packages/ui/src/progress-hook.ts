"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export const DEFAULT_PROGRESS_THROTTLE_MS = 5000;

type TimerHandle = number | NodeJS.Timeout;

export interface PersistProgressPayload {
  lessonId: string;
  courseId: string;
  positionSeconds: number;
  completed: boolean;
}

export interface ProgressUpdateInput {
  currentTime?: number;
  positionSeconds?: number;
  completed?: boolean;
  duration?: number;
  percent?: number;
}

export type LessonProgressInput = number | ProgressUpdateInput;

export interface UseLessonProgressOptions {
  lessonId: string;
  courseId: string;
  initialPositionSeconds?: number;
  /** Alias for initialPositionSeconds. */
  initialPlaybackSeconds?: number;
  initialCompleted?: boolean;
  onPersistProgress: (payload: PersistProgressPayload) => Promise<void> | void;
  throttleMs?: number;
  onCompleted?: () => void;
  onError?: (error: unknown) => void;
}

export interface UseLessonProgressResult {
  /** Optimistic current playback position in seconds. */
  positionSeconds: number;
  /** Alias for positionSeconds for compatibility. */
  playbackSeconds: number;
  /** Monotonic optimistic completion flag. */
  completed: boolean;
  /**
   * Updates playback position and/or completion status.
   * Throttles server persistence by default unless immediate is true.
   */
  updateProgress: (input: LessonProgressInput, options?: { immediate?: boolean }) => void;
  /** Convenience handler for LessonPlayer onProgress or direct updates. */
  handleProgress: (input: LessonProgressInput) => void;
  /** Marks the lesson complete monotonically and flushes immediately. */
  markComplete: (positionSeconds?: number) => void;
  /** Alias for markComplete matching player onComplete callback. */
  handleComplete: (positionSeconds?: number) => void;
  /** Flushes any pending unpersisted progress immediately. */
  flush: () => Promise<void>;
  /** True while a persistence request is in-flight. */
  isPersisting: boolean;
  /** True if there is a pending position or completion update waiting to be persisted. */
  hasPendingChanges: boolean;
}

export function useLessonProgress({
  lessonId,
  courseId,
  initialPositionSeconds,
  initialPlaybackSeconds,
  initialCompleted = false,
  onPersistProgress,
  throttleMs = DEFAULT_PROGRESS_THROTTLE_MS,
  onCompleted,
  onError,
}: UseLessonProgressOptions): UseLessonProgressResult {
  const resolvedInitialPosition = initialPositionSeconds ?? initialPlaybackSeconds ?? 0;
  const initialPositionSanitized =
    typeof resolvedInitialPosition === "number" &&
    Number.isFinite(resolvedInitialPosition) &&
    resolvedInitialPosition > 0
      ? resolvedInitialPosition
      : 0;
  const initialCompletedNormalized = Boolean(initialCompleted);

  const [positionSeconds, setPositionSeconds] = useState<number>(initialPositionSanitized);
  const [completed, setCompleted] = useState<boolean>(initialCompletedNormalized);
  const [isPersisting, setIsPersisting] = useState<boolean>(false);
  const [hasPendingChanges, setHasPendingChanges] = useState<boolean>(false);

  // Synchronous tracking refs
  const latestStateRef = useRef<{ positionSeconds: number; completed: boolean }>({
    positionSeconds: initialPositionSanitized,
    completed: initialCompletedNormalized,
  });
  const lastPersistedRef = useRef<{
    positionSeconds: number;
    completed: boolean;
  }>({
    positionSeconds: initialPositionSanitized,
    completed: initialCompletedNormalized,
  });

  const timerRef = useRef<TimerHandle | null>(null);
  const retryTimerRef = useRef<TimerHandle | null>(null);
  const activePromiseRef = useRef<Promise<void> | null>(null);
  const inFlightPayloadRef = useRef<PersistProgressPayload | null>(null);

  const onPersistProgressRef = useRef(onPersistProgress);
  const onCompletedRef = useRef(onCompleted);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onPersistProgressRef.current = onPersistProgress;
    onCompletedRef.current = onCompleted;
    onErrorRef.current = onError;
  }, [onPersistProgress, onCompleted, onError]);

  const activeLessonRef = useRef({ lessonId, courseId });

  const flush = useCallback(
    async (options?: {
      forceImmediate?: boolean;
      targetLessonId?: string;
      targetCourseId?: string;
    }): Promise<void> => {
      // Clear timers since we are running a persist now
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }

      // If already in flight and not forcing immediate delivery, wait for the active promise
      if (activePromiseRef.current && !options?.forceImmediate) {
        try {
          await activePromiseRef.current;
        } catch {
          // Handled by the active promise
        }
      }

      const latest = latestStateRef.current;
      const last = lastPersistedRef.current;

      const isDifferentFromLastPersisted =
        latest.positionSeconds !== last.positionSeconds || latest.completed !== last.completed;

      // If forceImmediate, prevent sending duplicate identical payload if currently in flight
      const isDifferentFromInFlight =
        !inFlightPayloadRef.current ||
        latest.positionSeconds !== inFlightPayloadRef.current.positionSeconds ||
        latest.completed !== inFlightPayloadRef.current.completed;

      if (!isDifferentFromLastPersisted || (!isDifferentFromInFlight && options?.forceImmediate)) {
        setHasPendingChanges(false);
        return;
      }

      const payload: PersistProgressPayload = {
        lessonId: options?.targetLessonId ?? activeLessonRef.current.lessonId,
        courseId: options?.targetCourseId ?? activeLessonRef.current.courseId,
        positionSeconds: latest.positionSeconds,
        completed: latest.completed,
      };

      inFlightPayloadRef.current = payload;
      setIsPersisting(true);

      const promise = (async () => {
        try {
          await onPersistProgressRef.current(payload);
          lastPersistedRef.current = {
            positionSeconds: payload.positionSeconds,
            completed: payload.completed,
          };
          if (
            latestStateRef.current.positionSeconds === payload.positionSeconds &&
            latestStateRef.current.completed === payload.completed
          ) {
            setHasPendingChanges(false);
          }
        } catch (err) {
          onErrorRef.current?.(err);
          setHasPendingChanges(true);
          if (!options?.forceImmediate && throttleMs > 0) {
            retryTimerRef.current = setTimeout(() => {
              retryTimerRef.current = null;
              void flush();
            }, throttleMs);
          }
        } finally {
          setIsPersisting(false);
          inFlightPayloadRef.current = null;
          activePromiseRef.current = null;
        }
      })();

      activePromiseRef.current = promise;
      return promise;
    },
    [throttleMs],
  );

  const updateProgress = useCallback(
    (input: LessonProgressInput, options?: { immediate?: boolean }): void => {
      let candidatePos: number | undefined;
      let explicitCompleted = false;

      if (typeof input === "number") {
        candidatePos = input;
      } else if (input && typeof input === "object") {
        candidatePos = input.positionSeconds ?? input.currentTime;
        if (input.completed === true) {
          explicitCompleted = true;
        }
      }

      let newPosition = latestStateRef.current.positionSeconds;
      if (
        typeof candidatePos === "number" &&
        !Number.isNaN(candidatePos) &&
        Number.isFinite(candidatePos)
      ) {
        newPosition = Math.max(0, candidatePos);
      }

      // Monotonic completion
      const alreadyCompleted = latestStateRef.current.completed;
      const nextCompleted = alreadyCompleted || explicitCompleted;
      const completionJustHappened = !alreadyCompleted && nextCompleted;

      latestStateRef.current = {
        positionSeconds: newPosition,
        completed: nextCompleted,
      };

      setPositionSeconds((prev) => (prev === newPosition ? prev : newPosition));
      if (completionJustHappened) {
        setCompleted(true);
        onCompletedRef.current?.();
      }

      const last = lastPersistedRef.current;
      const isPending = newPosition !== last.positionSeconds || nextCompleted !== last.completed;

      setHasPendingChanges(isPending);

      if (!isPending) return;

      // Immediate flush when requested, on completion, or if throttleMs <= 0
      if (options?.immediate || completionJustHappened || throttleMs <= 0) {
        void flush({ forceImmediate: true });
        return;
      }

      // Throttle: schedule timer if not already running
      if (!timerRef.current) {
        timerRef.current = setTimeout(() => {
          timerRef.current = null;
          void flush();
        }, throttleMs);
      }
    },
    [throttleMs, flush],
  );

  const markComplete = useCallback(
    (targetPositionSeconds?: number): void => {
      const pos =
        typeof targetPositionSeconds === "number" &&
        !Number.isNaN(targetPositionSeconds) &&
        Number.isFinite(targetPositionSeconds)
          ? Math.max(0, targetPositionSeconds)
          : latestStateRef.current.positionSeconds;

      updateProgress({ positionSeconds: pos, completed: true }, { immediate: true });
    },
    [updateProgress],
  );

  // Lesson/Course identity change
  const currentKey = `${courseId}:${lessonId}`;
  const previousKeyRef = useRef(currentKey);

  useEffect(() => {
    if (previousKeyRef.current !== currentKey) {
      const prevLesson = activeLessonRef.current;
      void flush({
        forceImmediate: true,
        targetLessonId: prevLesson.lessonId,
        targetCourseId: prevLesson.courseId,
      });

      previousKeyRef.current = currentKey;
      activeLessonRef.current = { lessonId, courseId };
      const initialPos = initialPositionSeconds ?? initialPlaybackSeconds ?? 0;
      const initialComp = Boolean(initialCompleted);

      latestStateRef.current = {
        positionSeconds: initialPos,
        completed: initialComp,
      };
      lastPersistedRef.current = {
        positionSeconds: initialPos,
        completed: initialComp,
      };
      setPositionSeconds(initialPos);
      setCompleted(initialComp);
      setHasPendingChanges(false);
    }
  }, [
    currentKey,
    lessonId,
    courseId,
    initialPositionSeconds,
    initialPlaybackSeconds,
    initialCompleted,
    flush,
  ]);

  // Flush on visibilitychange (hidden), pagehide, and beforeunload
  useEffect(() => {
    if (typeof document === "undefined") return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        void flush({ forceImmediate: true });
      }
    };

    const handlePageHide = () => {
      void flush({ forceImmediate: true });
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    if (typeof window !== "undefined") {
      window.addEventListener("pagehide", handlePageHide);
      window.addEventListener("beforeunload", handlePageHide);
    }

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (typeof window !== "undefined") {
        window.removeEventListener("pagehide", handlePageHide);
        window.removeEventListener("beforeunload", handlePageHide);
      }
    };
  }, [flush]);

  // Flush on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      void flush({ forceImmediate: true });
    };
  }, [flush]);

  return {
    positionSeconds,
    playbackSeconds: positionSeconds,
    completed,
    updateProgress,
    handleProgress: updateProgress,
    markComplete,
    handleComplete: markComplete,
    flush,
    isPersisting,
    hasPendingChanges,
  };
}
