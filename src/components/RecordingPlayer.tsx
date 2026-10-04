"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Trash2 } from "lucide-react";
import { getRecording } from "@/lib/db";

export interface SeekRequest {
  time: number;
  nonce: number; // bump to re-seek to the same time
}

export function RecordingPlayer({
  id,
  seek,
  onTime,
  onDelete,
  compact,
}: {
  id: string;
  seek?: SeekRequest | null;
  onTime?: (sec: number) => void;
  onDelete?: () => void;
  compact?: boolean;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [mime, setMime] = useState("audio/webm");
  const [missing, setMissing] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const fixing = useRef(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    getRecording(id).then((r) => {
      if (!r) return setMissing(true);
      objectUrl = URL.createObjectURL(r.blob);
      setMime(r.mime);
      setUrl(objectUrl);
    });
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el || !seek) return;
    el.currentTime = Math.max(0, seek.time - 0.3);
    el.play().catch(() => {});
  }, [seek]);

  if (missing) return null;
  if (!url) return <div className="h-[54px]" />;

  const ext = mime.includes("mp4") ? "m4a" : mime.includes("ogg") ? "ogg" : mime.includes("wav") ? "wav" : "webm";

  return (
    <div className={`flex items-center gap-2 ${compact ? "" : "bg-paper border border-line rounded p-2"}`}>
      <audio
        ref={audioRef}
        src={url}
        controls
        preload="metadata"
        className="flex-1 min-w-0 h-[44px]"
        aria-label="Consultation recording"
        // Recorder WebM has no duration header, so Chrome shows "Infinity" and
        // can't seek. Jumping far ahead once makes it scan and learn the length.
        onLoadedMetadata={(e) => {
          const el = e.currentTarget;
          if (el.duration === Infinity || Number.isNaN(el.duration)) {
            fixing.current = true;
            el.currentTime = 1e7;
          }
        }}
        onDurationChange={(e) => {
          const el = e.currentTarget;
          if (fixing.current && Number.isFinite(el.duration)) {
            fixing.current = false;
            el.currentTime = 0;
          }
        }}
        onTimeUpdate={(e) => !fixing.current && onTime?.(e.currentTarget.currentTime)}
      />
      <a
        href={url}
        download={`consultation-${id.slice(0, 8)}.${ext}`}
        className="w-11 h-11 flex items-center justify-center rounded border border-line bg-card hover:bg-linen shrink-0"
        title="Download recording"
        aria-label="Download recording"
      >
        <Download size={18} />
      </a>
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="w-11 h-11 flex items-center justify-center rounded border border-line bg-card hover:text-clay shrink-0"
          title="Delete recording"
          aria-label="Delete recording"
        >
          <Trash2 size={18} />
        </button>
      )}
    </div>
  );
}
