"use client";

import { useEffect, useRef, useState } from "react";

const BARS = 40;

// A pen-stroke style level meter: a rolling history of mic loudness.
export function Waveform({ level, active }: { level: number; active: boolean }) {
  const [history, setHistory] = useState<number[]>(() => Array(BARS).fill(0.04));
  const levelRef = useRef(level);
  useEffect(() => {
    levelRef.current = level;
  }, [level]);

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      const jitter = 0.75 + Math.random() * 0.5;
      setHistory((h) => [...h.slice(1), Math.max(0.04, Math.min(1, levelRef.current * jitter))]);
    }, 90);
    return () => clearInterval(id);
  }, [active]);

  return (
    <div className="h-14 mt-4 flex items-center gap-[3px]" aria-hidden="true">
      {history.map((v, i) => (
        <span
          key={i}
          className={`flex-1 rounded-full transition-[height] duration-100 ${active ? (i % 3 === 0 ? "bg-teal" : "bg-clay-bright/80") : "bg-line"}`}
          style={{ height: `${Math.round((active ? v : 0.06) * 100)}%`, minHeight: 3 }}
        />
      ))}
    </div>
  );
}
