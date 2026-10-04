"use client";

import { useEffect, useRef } from "react";
import { Play } from "lucide-react";
import { formatDuration } from "@/lib/report";
import type { Segment } from "@/lib/types";

const LABEL: Record<Segment["speaker"], string> = {
  doctor: "Doctor",
  patient: "Patient",
  other: "Attendant",
  unknown: "",
};

const STYLE: Record<Segment["speaker"], string> = {
  doctor: "border-teal",
  patient: "border-clay-bright bg-peach/60",
  other: "border-line-strong bg-linen/60",
  unknown: "border-line",
};

export function TranscriptList({
  segments,
  highlight,
  autoScroll,
  playingId,
  onPlay,
}: {
  segments: Segment[];
  highlight?: Set<number>;
  autoScroll?: boolean;
  playingId?: number | null; // line currently heard in the recording
  onPlay?: (s: Segment) => void; // set when a recording exists
}) {
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    if (autoScroll) listRef.current?.lastElementChild?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [segments.length, autoScroll]);

  useEffect(() => {
    if (!highlight?.size) return;
    listRef.current?.querySelector("[data-lit='true']")?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [highlight]);

  return (
    <ol ref={listRef} className="space-y-3">
      {segments.map((s) => {
        const lit = highlight?.has(s.id) ?? false;
        const playing = playingId === s.id;
        return (
          <li
            key={s.id}
            data-lit={lit}
            className={`border-l-[3px] pl-4 pr-3 py-2 rounded-r transition-colors ${
              playing ? "bg-teal-tint border-teal ring-1 ring-teal/30" : lit ? "bg-[#fff4cc] border-[#d9a400]" : STYLE[s.speaker]
            }`}
          >
            <div className="flex items-center justify-between gap-3 mb-0.5">
              <span className={`text-[13px] font-bold uppercase tracking-[0.08em] ${s.speaker === "patient" ? "text-clay" : "text-teal"}`}>
                {LABEL[s.speaker]}
              </span>
              {onPlay ? (
                <button
                  type="button"
                  onClick={() => onPlay(s)}
                  className="inline-flex items-center gap-1 text-[13px] font-semibold text-teal tabular rounded px-1.5 py-0.5 -mr-1.5 hover:bg-teal-tint"
                  aria-label={`Play from ${formatDuration(s.start)}`}
                  title="Hear this part"
                >
                  <Play size={12} fill="currentColor" /> {formatDuration(s.start)}
                </button>
              ) : (
                <span className="text-[13px] text-muted tabular">{formatDuration(s.start)}</span>
              )}
            </div>
            <p className="text-[17px] leading-relaxed">{s.text}</p>
          </li>
        );
      })}
    </ol>
  );
}
