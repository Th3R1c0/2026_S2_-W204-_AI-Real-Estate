"use client";

import { useCallback, useId, useRef, type KeyboardEvent } from "react";

export type RangeSliderProps = {
  /** Visible label text, e.g. "Price range". */
  label: string;
  min: number;
  max: number;
  step?: number;
  /** Current low and high thumbs. `max` equals the maximum value = no upper bound. */
  value: [number, number];
  /** Called only on commit (pointer release / key press), not on every drag frame. */
  onChange: (value: [number, number]) => void;
  formatValue: (value: number) => string;
  /** Accessible name for the lower thumb, e.g. "Minimum price". */
  lowLabel?: string;
  /** Accessible name for the upper thumb, e.g. "Maximum price". */
  highLabel?: string;
  className?: string;
};

/**
 * Double-ended slider following the W3C ARIA APG multi-thumb slider pattern:
 * two focusable thumbs in a group with role="slider", aria-valuemin/max/now/text,
 * arrow keys, Home/End and Page Up/Down.
 * https://www.w3.org/WAI/ARIA/apg/patterns/slider-multithumb/
 */
export default function RangeSlider({
  label,
  min,
  max,
  step = 1,
  value,
  onChange,
  formatValue,
  lowLabel,
  highLabel,
  className,
}: RangeSliderProps) {
  const id = useId();
  const trackRef = useRef<HTMLDivElement>(null);
  const lowRef = useRef<HTMLDivElement>(null);
  const highRef = useRef<HTMLDivElement>(null);
  const [low, high] = value;
  const span = Math.max(1, max - min);
  const lowPct = ((low - min) / span) * 100;
  const highPct = ((high - min) / span) * 100;

  const clamp = useCallback(
    (next: number) => Math.min(max, Math.max(min, next)),
    [min, max],
  );
  const round = useCallback(
    (next: number) => clamp(Math.round(next / step) * step),
    [clamp, step],
  );

  const commit = useCallback(
    (thumb: 0 | 1, next: number) => {
      const snapped = round(next);
      // Thumbs may meet but never cross over.
      if (thumb === 0) onChange([Math.min(snapped, high), high]);
      else onChange([low, Math.max(snapped, low)]);
    },
    [high, low, onChange, round],
  );

  const beginDrag = useCallback(
    (thumb: 0 | 1) => (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      (thumb === 0 ? lowRef : highRef).current?.focus();
      const track = trackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      const update = (clientX: number) => {
        const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
        commit(thumb, min + ratio * span);
      };
      update(event.clientX);
      const move = (moveEvent: PointerEvent) => update(moveEvent.clientX);
      const stop = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", stop);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", stop);
    },
    [commit, min, span],
  );

  const onKeyDown =
    (thumb: 0 | 1) => (event: KeyboardEvent<HTMLDivElement>) => {
      const current = thumb === 0 ? low : high;
      const big = Math.max(step, Math.round(span / 10 / step) * step);
      let next: number | undefined;
      switch (event.key) {
        case "ArrowRight":
        case "ArrowUp":
          next = current + step;
          break;
        case "ArrowLeft":
        case "ArrowDown":
          next = current - step;
          break;
        case "PageUp":
          next = current + big;
          break;
        case "PageDown":
          next = current - big;
          break;
        case "Home":
          next = min;
          break;
        case "End":
          next = max;
          break;
        default:
          return;
      }
      event.preventDefault();
      commit(thumb, next);
    };

  const thumbProps = (thumb: 0 | 1) => {
    const current = thumb === 0 ? low : high;
    return {
      role: "slider" as const,
      tabIndex: 0,
      "aria-valuemin": min,
      "aria-valuemax": thumb === 0 ? high : max,
      "aria-valuenow": current,
      "aria-valuetext": formatValue(current),
      "aria-label": thumb === 0 ? lowLabel ?? `Minimum ${label}` : highLabel ?? `Maximum ${label}`,
      "aria-controls": `${id}-track`,
      onKeyDown: onKeyDown(thumb),
      onPointerDown: beginDrag(thumb),
    };
  };

  return (
    <div className={`range-slider ${className ?? ""}`.trim()}>
      <div className="range-slider-header">
        <span className="range-slider-label">
          {label}
          <span className="range-slider-values">
            {formatValue(low)} – {high >= max ? "Any" : formatValue(high)}
          </span>
        </span>
      </div>
      <div
        className="range-slider-track"
        id={`${id}-track`}
        ref={trackRef}
        onPointerDown={(event) => {
          // Clicking the track moves the nearest thumb.
          const lowDistance = Math.abs(lowPct - ((event.nativeEvent.offsetX / (trackRef.current?.offsetWidth || 1)) * 100));
          const highDistance = Math.abs(highPct - ((event.nativeEvent.offsetX / (trackRef.current?.offsetWidth || 1)) * 100));
          beginDrag(lowDistance <= highDistance ? 0 : 1)(event);
        }}
      >
        <div className="range-slider-rail" />
        <div
          className="range-slider-fill"
          style={{ left: `${lowPct}%`, width: `${Math.max(0, highPct - lowPct)}%` }}
        />
        <div
          {...thumbProps(0)}
          className="range-slider-thumb"
          ref={lowRef}
          style={{ left: `${lowPct}%` }}
        />
        <div
          {...thumbProps(1)}
          className="range-slider-thumb"
          ref={highRef}
          style={{ left: `${highPct}%` }}
        />
      </div>
    </div>
  );
}
