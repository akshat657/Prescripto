import "server-only";

const GROQ_BASE = "https://api.groq.com/openai/v1";

export const MODELS = {
  // large-v3 is noticeably better on Hindi (Groq: 10.3% vs 12% WER overall);
  // turbo is kept for English-only where its speed and lower cost win.
  transcribeAccurate: process.env.GROQ_TRANSCRIBE_MODEL || "whisper-large-v3",
  transcribeFast: process.env.GROQ_TRANSCRIBE_FAST_MODEL || "whisper-large-v3-turbo",
  // Primary extractor, then fallback when the primary is rate-limited.
  // Each Groq model has its own free-tier quota, so falling back buys headroom.
  extract: (process.env.GROQ_EXTRACT_MODELS || "openai/gpt-oss-120b,openai/gpt-oss-20b")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean),
};

export class GroqError extends Error {
  constructor(
    message: string,
    public status: number,
    public retryAfter: number | null = null,
    public failedGeneration: string | null = null,
  ) {
    super(message);
  }
}

export function apiKey(): string {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new GroqError("GROQ_API_KEY is not set on the server.", 503);
  return key;
}

async function toGroqError(res: Response): Promise<GroqError> {
  const retry = res.headers.get("retry-after");
  let message = `Groq request failed (${res.status})`;
  let failed: string | null = null;
  try {
    const body = await res.json();
    if (body?.error?.message) message = body.error.message;
    if (typeof body?.error?.failed_generation === "string") failed = body.error.failed_generation;
  } catch {
    // non-JSON error body
  }
  return new GroqError(message, res.status, retry ? Number(retry) : null, failed);
}

export async function groqTranscribe(form: FormData) {
  const res = await fetch(`${GROQ_BASE}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey()}` },
    body: form,
  });
  if (!res.ok) throw await toGroqError(res);
  return res.json();
}

export async function groqChat(body: Record<string, unknown>) {
  const res = await fetch(`${GROQ_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await toGroqError(res);
  return res.json();
}

export function errorResponse(err: unknown) {
  if (err instanceof GroqError) {
    const headers: Record<string, string> = {};
    if (err.retryAfter != null) headers["retry-after"] = String(err.retryAfter);
    return Response.json(
      { error: err.message, retryAfter: err.retryAfter },
      { status: err.status, headers },
    );
  }
  console.error(err);
  return Response.json({ error: "Unexpected server error." }, { status: 500 });
}
