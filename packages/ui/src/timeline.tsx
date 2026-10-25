"use client";

import type { ReactNode } from "react";
import { cn } from "./lib/utils";

export type TimelineBlock = {
  id: string;
  startMinute: number;
  endMinute: number;
  label: string;
  content: ReactNode;
  className?: string;
  status?: "confirmed" | "pending" | "done" | "cancelled";
};
export type TimelineRange = { startMinute: number; endMinute: number };
const time = (minute: number) =>
  `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;

/** Minutos civiles de la zona mostrada. Un minuto ocupa el mismo alto en todos los bloques. */
export function Timeline({
  label,
  startMinute = 540,
  endMinute = 1140,
  blocks,
  freeRanges = [],
  nowMinute,
  onBlockClick,
  onFreeClick,
  pixelsPerMinute = 1.6,
}: {
  label: string;
  startMinute?: number;
  endMinute?: number;
  blocks: readonly TimelineBlock[];
  freeRanges?: readonly TimelineRange[];
  nowMinute?: number;
  pixelsPerMinute?: number;
  onBlockClick: (id: string) => void;
  onFreeClick: (range: TimelineRange) => void;
}) {
  const position = (start: number, end: number) => ({
    top: (Math.max(start, startMinute) - startMinute) * pixelsPerMinute,
    height:
      (Math.min(end, endMinute) - Math.max(start, startMinute)) *
      pixelsPerMinute,
  });
  const hours = Array.from(
    { length: Math.floor((endMinute - startMinute) / 60) + 1 },
    (_, i) => startMinute + i * 60,
  );
  return (
    <section
      aria-label={label}
      className="relative ml-12"
      style={{ height: (endMinute - startMinute) * pixelsPerMinute }}
    >
      {hours.map((minute) => (
        <div
          key={minute}
          aria-hidden
          className="absolute inset-x-0 border-t border-border"
          style={{ top: (minute - startMinute) * pixelsPerMinute }}
        >
          <span className="absolute -left-12 -top-2 w-10 text-right font-mono text-xs text-muted-foreground">
            {time(minute)}
          </span>
        </div>
      ))}
      <ul className="list-none">
        {freeRanges
          .filter(
            (range) =>
              range.endMinute > startMinute && range.startMinute < endMinute,
          )
          .map((range) => (
            <li key={`free-${range.startMinute}`}>
              <button
                type="button"
                aria-label={`Libre ${time(range.startMinute)}–${time(range.endMinute)}`}
                onClick={() => onFreeClick(range)}
                className="absolute inset-x-1 overflow-hidden rounded-md border border-dashed border-border bg-transparent px-3 text-left text-sm text-muted-foreground transition-colors duration-150 hover:bg-secondary"
                style={position(range.startMinute, range.endMinute)}
              >
                Libre {time(range.startMinute)}–{time(range.endMinute)}{" "}
              </button>
            </li>
          ))}
        {blocks
          .filter(
            (block) =>
              block.endMinute > startMinute && block.startMinute < endMinute,
          )
          .map((block) => (
            <li key={block.id}>
              <button
                type="button"
                aria-label={block.label}
                onClick={() => onBlockClick(block.id)}
                className={cn(
                  "absolute inset-x-1 overflow-hidden rounded-md border border-border border-l-[3px] border-l-status-confirmed bg-card px-3 text-left text-base transition-colors duration-150 hover:bg-secondary",
                  block.status === "pending" &&
                    "border-l-status-pending bg-status-pending-soft/40",
                  block.status === "done" && "border-l-status-done",
                  block.status === "cancelled" && "border-l-status-cancelled",
                  block.className,
                )}
                style={position(block.startMinute, block.endMinute)}
              >
                {block.content}
              </button>
            </li>
          ))}
      </ul>
      {nowMinute !== undefined &&
        nowMinute >= startMinute &&
        nowMinute <= endMinute && (
          <div
            role="img"
            aria-label={`Ahora ${time(nowMinute)}`}
            className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-destructive"
            style={{ top: (nowMinute - startMinute) * pixelsPerMinute }}
          >
            <span className="absolute -left-1 -top-1 size-2 rounded-md bg-destructive" />
          </div>
        )}
    </section>
  );
}
