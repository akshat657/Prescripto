"use client";

import type { Report, ReportLanguage, Speaker } from "./types";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public retryAfter: number | null,
  ) {
    super(message);
  }
}

async function call<T>(url: string, init: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const retry = body?.retryAfter ?? res.headers.get("retry-after");
    throw new ApiError(body?.error || `Request failed (${res.status})`, res.status, retry ? Number(retry) : null);
  }
  return body as T;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Retries rate-limited calls, waiting as long as Groq tells us to.
async function withRetry<T>(fn: () => Promise<T>, onWait?: (sec: number) => void, tries = 4): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (!(err instanceof ApiError) || err.status !== 429 || attempt >= tries - 1) throw err;
      const wait = Math.min(60, err.retryAfter ?? 5 * (attempt + 1));
      onWait?.(wait);
      await sleep(wait * 1000);
    }
  }
}

export interface RawSegment {
  start: number;
  end: number;
  text: string;
}

export function transcribeChunk(
  blob: Blob,
  opts: { offset: number; language: string; filename: string },
  onWait?: (sec: number) => void,
) {
  return withRetry(() => {
    const form = new FormData();
    form.append("file", blob, opts.filename);
    form.append("offset", String(opts.offset));
    form.append("language", opts.language);
    return call<{ segments: RawSegment[] }>("/api/transcribe", { method: "POST", body: form });
  }, onWait);
}

export function extractReport(
  segments: { id: number; text: string }[],
  reportLanguage: ReportLanguage,
  onWait?: (sec: number) => void,
) {
  return withRetry(
    () =>
      call<{ report: Report; speakers: Record<number, Speaker>; model: string }>("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ segments, reportLanguage }),
      }),
    onWait,
    3,
  );
}

export function getStatus() {
  return call<{ configured: boolean }>("/api/status", { method: "GET" });
}
