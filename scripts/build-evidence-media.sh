#!/usr/bin/env bash
# Converts the recorded Playwright journey videos into README-friendly assets:
# an H.264 MP4 for embedding and an optimised GIF for inline playback.
set -euo pipefail

cd "$(dirname "$0")/.."
VIDEO_DIR="docs/evidence/.video"
OUT_DIR="docs/evidence"
GIF_WIDTH=900

for webm in "$VIDEO_DIR"/*.webm; do
  [ -e "$webm" ] || continue
  slug="$(basename "$webm" .webm)"
  echo "Converting $webm -> $slug"
  ffmpeg -v error -y -i "$webm" -c:v libx264 -pix_fmt yuv420p -crf 24 -movflags +faststart \
    "$OUT_DIR/$slug.mp4"
  ffmpeg -v error -y -i "$webm" -vf "fps=10,scale=$GIF_WIDTH:-1:flags=lanczos,palettegen=stats_mode=diff" \
    "$OUT_DIR/$slug-palette.png"
  ffmpeg -v error -y -i "$webm" -i "$OUT_DIR/$slug-palette.png" \
    -lavfi "fps=10,scale=$GIF_WIDTH:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=3" \
    "$OUT_DIR/$slug.gif"
  rm -f "$OUT_DIR/$slug-palette.png"
done

rm -rf "$VIDEO_DIR"
ls -la "$OUT_DIR"/*.mp4 "$OUT_DIR"/*.gif
