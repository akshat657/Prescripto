"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { encodeWav, PauseChunker } from "./audio/chunker";

// We capture raw samples (not MediaRecorder) so pieces can be cut at natural
// pauses — see audio/chunker.ts for why fixed-length cuts broke Hindi.

export interface AudioPiece {
  blob: Blob;
  offset: number; // seconds of consultation before this piece
  filename: string;
}

export type RecorderState = "idle" | "recording" | "paused" | "stopped";

// Batches the 128-sample render quanta into ~43 ms messages.
const WORKLET = `
class Capture extends AudioWorkletProcessor {
  constructor() { super(); this.buf = new Float32Array(2048); this.n = 0; }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch) {
      for (let i = 0; i < ch.length; i++) {
        this.buf[this.n++] = ch[i];
        if (this.n === this.buf.length) { this.port.postMessage(this.buf.slice(0)); this.n = 0; }
      }
    }
    return true;
  }
}
registerProcessor("yaad-capture", Capture);
`;

// The kept copy is compressed (Opus ≈ 240 KB/min) — the 16 kHz WAV pieces used
// for transcription would be ~2 MB/min.
function pickMime() {
  const options = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  if (typeof MediaRecorder === "undefined") return null;
  return options.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
}

export function toPiece(pcm: Int16Array, offset: number): AudioPiece {
  return {
    blob: new Blob([encodeWav(pcm)], { type: "audio/wav" }),
    offset,
    filename: `piece-${Math.round(offset * 10)}.wav`,
  };
}

export function useRecorder(onPiece: (piece: AudioPiece) => void) {
  const [state, setState] = useState<RecorderState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const chunkerRef = useRef<PauseChunker | null>(null);
  const pausedRef = useRef(false);
  const keepRef = useRef<MediaRecorder | null>(null);
  const keepParts = useRef<Blob[]>([]);
  const onPieceRef = useRef(onPiece);
  useEffect(() => {
    onPieceRef.current = onPiece;
  }, [onPiece]);

  const cleanup = useCallback(() => {
    ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setLevel(0);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
      });
      streamRef.current = stream;
      const ctx = new AudioContext();
      ctxRef.current = ctx;
      const url = URL.createObjectURL(new Blob([WORKLET], { type: "application/javascript" }));
      await ctx.audioWorklet.addModule(url);
      URL.revokeObjectURL(url);

      const node = new AudioWorkletNode(ctx, "yaad-capture");
      const chunker = new PauseChunker(ctx.sampleRate, (pcm, offset) => onPieceRef.current(toPiece(pcm, offset)));
      node.port.onmessage = (e: MessageEvent<Float32Array>) => {
        if (pausedRef.current) return;
        setLevel(chunker.push(e.data));
        setElapsed(chunker.elapsedSec);
      };
      // The node must reach the destination to keep running; it outputs silence.
      ctx.createMediaStreamSource(stream).connect(node).connect(ctx.destination);

      // Full-length copy for re-listening. Paused stretches are left out of both
      // this and the chunker's clock, so transcript timestamps match playback.
      keepParts.current = [];
      keepRef.current = null;
      const mime = pickMime();
      if (mime !== null) {
        try {
          const keep = new MediaRecorder(stream, { ...(mime ? { mimeType: mime } : {}), audioBitsPerSecond: 32000 });
          keep.ondataavailable = (e) => {
            if (e.data.size) keepParts.current.push(e.data);
          };
          keep.start(1000);
          keepRef.current = keep;
        } catch {
          // Recording still works without a kept copy.
        }
      }

      chunkerRef.current = chunker;
      pausedRef.current = false;
      setState("recording");
    } catch (err) {
      cleanup();
      setError(
        err instanceof DOMException && (err.name === "NotAllowedError" || err.name === "SecurityError")
          ? "Microphone access was blocked. Allow the microphone in your browser's address bar and try again."
          : "Could not start the microphone. Check that one is connected and not used by another app.",
      );
    }
  }, [cleanup]);

  const pause = useCallback(() => {
    pausedRef.current = true;
    if (keepRef.current?.state === "recording") keepRef.current.pause();
    chunkerRef.current?.flush();
    setLevel(0);
    setState("paused");
  }, []);

  const resume = useCallback(() => {
    pausedRef.current = false;
    if (keepRef.current?.state === "paused") keepRef.current.resume();
    setState("recording");
  }, []);

  /** Stops everything. `audio` resolves to the kept recording (or null if none). */
  const stop = useCallback(() => {
    pausedRef.current = true;
    const chunker = chunkerRef.current;
    chunker?.flush();

    const keep = keepRef.current;
    keepRef.current = null;
    const audio = new Promise<Blob | null>((resolve) => {
      if (!keep || keep.state === "inactive") return resolve(null);
      keep.onstop = () => {
        const parts = keepParts.current;
        resolve(parts.length ? new Blob(parts, { type: keep.mimeType || parts[0].type }) : null);
      };
      keep.stop(); // before the tracks stop, so the final chunk is flushed
    });

    cleanup();
    const duration = chunker?.elapsedSec ?? 0;
    setElapsed(duration);
    setState("stopped");
    return { duration, audio };
  }, [cleanup]);

  useEffect(
    () => () => {
      const keep = keepRef.current;
      if (keep && keep.state !== "inactive") {
        keep.ondataavailable = null;
        keep.stop();
      }
      cleanup();
    },
    [cleanup],
  );

  return { state, elapsed, level, error, start, pause, resume, stop };
}

/** Decode an uploaded recording and cut it at pauses, like live audio. */
export async function splitAudioFile(file: File): Promise<{ pieces: AudioPiece[]; duration: number }> {
  const ctx = new AudioContext();
  try {
    const audio = await ctx.decodeAudioData(await file.arrayBuffer());
    // Mix to mono.
    const mono = new Float32Array(audio.length);
    for (let c = 0; c < audio.numberOfChannels; c++) {
      const data = audio.getChannelData(c);
      for (let i = 0; i < data.length; i++) mono[i] += data[i] / audio.numberOfChannels;
    }
    const pieces: AudioPiece[] = [];
    const chunker = new PauseChunker(audio.sampleRate, (pcm, offset) => pieces.push(toPiece(pcm, offset)));
    for (let i = 0; i < mono.length; i += 4096) chunker.push(mono.subarray(i, i + 4096));
    chunker.flush();
    return { pieces, duration: audio.duration };
  } finally {
    ctx.close().catch(() => {});
  }
}
