import { errorResponse, GroqError, groqChat, MODELS } from "@/lib/server/groq";
import { REPORT_SCHEMA, systemPrompt } from "@/lib/server/prompt";
import type { ReportLanguage } from "@/lib/types";

export const maxDuration = 60;

// Free tier for gpt-oss models is 8K tokens/minute *including* the completion
// budget, so a single request must fit under that.
const TPM_LIMIT = 8000;
const SAFETY = 300;
const MIN_OUTPUT = 1800;
const MAX_OUTPUT = 4096;
const MEDIUM_EFFORT_MIN_OUTPUT = 3500;

interface InSegment {
  id: number;
  text: string;
}

// Rough token estimate. Devanagari tokenizes far worse than Latin script.
function estimateTokens(text: string) {
  const devanagari = (text.match(/[ऀ-ॿ]/g) || []).length;
  return Math.ceil((text.length - devanagari) / 3.6 + devanagari / 1.2);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const segments: InSegment[] = Array.isArray(body.segments) ? body.segments : [];
    const language: ReportLanguage = body.reportLanguage === "hi" ? "hi" : "en";
    const system = systemPrompt(language);
    if (!segments.length) {
      return Response.json({ error: "The transcript is empty." }, { status: 400 });
    }

    const transcript = segments.map((s) => `[${s.id}] ${String(s.text).trim()}`).join("\n");
    const userMessage = `Consultation transcript:\n\n${transcript}`;
    const inputTokens =
      estimateTokens(system) + estimateTokens(JSON.stringify(REPORT_SCHEMA)) + estimateTokens(userMessage);
    const outputBudget = Math.min(MAX_OUTPUT, TPM_LIMIT - SAFETY - inputTokens);
    if (outputBudget < MIN_OUTPUT) {
      return Response.json(
        {
          error:
            "This consultation is too long for the free Groq tier (about 12–15 minutes of talk fits). Remove small talk from the transcript or split it into two visits.",
        },
        { status: 413 },
      );
    }

    const messages = [
      { role: "system", content: system },
      { role: "user", content: userMessage },
    ];

    let lastError: unknown = null;
    for (const model of MODELS.extract) {
      try {
        const data = await callModel(model, messages, outputBudget);
        return Response.json({ ...data, report: fillMedicineNames(data.report), model });
      } catch (err) {
        lastError = err;
        // Try the next model only when this one is out of quota.
        if (err instanceof GroqError && (err.status === 429 || err.status === 413)) continue;
        throw err;
      }
    }
    throw lastError;
  } catch (err) {
    return errorResponse(err);
  }
}

async function callModel(model: string, messages: unknown[], maxTokens: number) {
  const base = {
    model,
    messages,
    temperature: 0.1,
    max_completion_tokens: maxTokens,
    // Measured on Hinglish transcripts: "medium" stopped invented details and
    // flagged misheard drug names more reliably, but spends ~1.5K more tokens
    // thinking. Use it whenever the 8K tokens/minute budget leaves room.
    reasoning_effort: maxTokens >= MEDIUM_EFFORT_MIN_OUTPUT ? "medium" : "low",
  };
  let content: string;
  try {
    const completion = await groqChat({
      ...base,
      response_format: {
        type: "json_schema",
        json_schema: { name: "visit_note", strict: true, schema: REPORT_SCHEMA },
      },
    });
    content = completion?.choices?.[0]?.message?.content ?? "";
  } catch (err) {
    if (!(err instanceof GroqError && err.status === 400)) throw err;
    // Groq checks the schema after generating and returns the full output in
    // `failed_generation` when one detail is off. That output is still far
    // better than a schema-less retry, and normalizeReport cleans it up.
    if (err.failedGeneration && isJson(err.failedGeneration)) {
      content = err.failedGeneration;
    } else {
      const completion = await groqChat({ ...base, response_format: { type: "json_object" } });
      content = completion?.choices?.[0]?.message?.content ?? "";
    }
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new GroqError("The model returned an unreadable report. Please try again.", 502);
  }
  const { speaker_labels, ...report } = parsed;
  return { report, speakers: parseSpeakers(String(speaker_labels ?? "")) };
}

// The Hindi prompt has the model write {{M1}} instead of a medicine name in free
// text, because it kept transliterating names into garbled Devanagari
// ("एएम्लोडिपिन"). Swap in the exact English name from the medicines list.
function fillMedicineNames(report: Record<string, unknown>) {
  const meds = Array.isArray(report.medications) ? report.medications : [];
  const nameOf = (n: number) => {
    const m = meds[n - 1] as { name?: unknown } | undefined;
    return typeof m?.name === "string" && m.name.trim() ? m.name.trim() : "";
  };
  const fill = (v: unknown): unknown => {
    if (typeof v === "string") return v.replace(/\{\{\s*M(\d+)\s*\}\}/gi, (_, n) => nameOf(Number(n)) || "(medicine)");
    if (Array.isArray(v)) return v.map(fill);
    return v;
  };
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(report)) out[k] = k === "medications" || k === "evidence" ? v : fill(v);
  return out;
}

function isJson(text: string) {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

function parseSpeakers(labels: string) {
  const map: Record<number, "doctor" | "patient" | "other"> = {};
  for (const m of labels.matchAll(/(\d+)\s*([DPO])/gi)) {
    const role = m[2].toUpperCase();
    map[Number(m[1])] = role === "D" ? "doctor" : role === "P" ? "patient" : "other";
  }
  return map;
}
