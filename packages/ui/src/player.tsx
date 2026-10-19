"use client";

import type { MuxPlayerCSSProperties, MuxPlayerProps } from "@mux/mux-player-react";
import MuxPlayer from "@mux/mux-player-react";
import { useEffect, useRef } from "react";

/** One report per whole second: `timeupdate` fires about four times a second. */
const PROGRESS_STEP_SECONDS = 1;

const THEME_TOKENS: MuxPlayerCSSProperties = {
  "--media-primary-color": "var(--color-surface)",
  "--media-secondary-color": "var(--color-brand)",
  "--media-accent-color": "var(--color-accent)",
  "--media-range-bar-color": "var(--color-accent)",
  "--media-font-family": "var(--font-sans)",
};

export interface PlaybackProgress {
  /** Seconds played, absolute in the asset. */
  currentTime: number;
  /** Total length in seconds, 0 while unknown. */
  duration: number;
  /** `currentTime / duration` clamped to 0..1, 0 while unknown. */
  percent: number;
}

export interface LessonPlayerProps {
  /** Mux playback id for the lesson asset. */
  playbackId: string;
  /** Seconds to resume from, e.g. a stored position. */
  startTime?: number | undefined;
  title?: string | undefined;
  /** Fires at most once per whole second of playback, including after a seek. */
  onProgress?: ((progress: PlaybackProgress) => void) | undefined;
  onComplete?: (() => void) | undefined;
  /** Overrides `--media-accent-color`. Defaults to the accent design token. */
  accentColor?: string | undefined;
  /** Extra Mux CSS custom properties; each key overrides the token default. */
  themeTokens?: MuxPlayerCSSProperties | undefined;
  poster?: string | undefined;
  autoPlay?: MuxPlayerProps["autoPlay"];
  /** Extra classes for the frame that wraps the player. */
  className?: string | undefined;
}

type TimeUpdateEvent = Parameters<NonNullable<MuxPlayerProps["onTimeUpdate"]>>[0];

interface MediaState {
  currentTime?: number;
  duration?: number;
}

function readProgress(event: TimeUpdateEvent): PlaybackProgress {
  const target = event.target as MediaState | null;
  const currentTime = target?.currentTime ?? 0;
  const duration = target?.duration ?? 0;

  return {
    currentTime,
    duration,
    percent: duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0,
  };
}

export function LessonPlayer({
  playbackId,
  startTime,
  title,
  onProgress,
  onComplete,
  accentColor,
  themeTokens,
  poster,
  autoPlay,
  className,
}: LessonPlayerProps) {
  const onProgressRef = useRef(onProgress);
  const onCompleteRef = useRef(onComplete);
  const lastReportedSecond = useRef(Number.NEGATIVE_INFINITY);

  useEffect(() => {
    onProgressRef.current = onProgress;
    onCompleteRef.current = onComplete;
  }, [onProgress, onComplete]);

  const handleTimeUpdate = (event: TimeUpdateEvent) => {
    const progress = readProgress(event);
    const second = Math.floor(progress.currentTime / PROGRESS_STEP_SECONDS);
    if (second === lastReportedSecond.current) return;
    lastReportedSecond.current = second;
    onProgressRef.current?.(progress);
  };

  const style: MuxPlayerCSSProperties = {
    ...THEME_TOKENS,
    ...(accentColor ? { "--media-accent-color": accentColor } : {}),
    ...themeTokens,
  };

  const optionalProps = {
    ...(title ? { title, metadataVideoTitle: title } : {}),
    ...(poster ? { poster } : {}),
    ...(autoPlay === undefined ? {} : { autoPlay }),
  };

  return (
    // Mux Player exposes no radius custom property, so Mux documents rounding via a wrapper.
    <div
      className={className}
      style={{ borderRadius: "var(--radius-panel)", overflow: "hidden", display: "flex" }}
    >
      <MuxPlayer
        playbackId={playbackId}
        startTime={startTime ?? 0}
        style={style}
        // Completion marks a lesson done, so a seek to the end must not count.
        disablePseudoEnded
        onTimeUpdate={handleTimeUpdate}
        onEnded={() => onCompleteRef.current?.()}
        {...optionalProps}
      />
    </div>
  );
}
