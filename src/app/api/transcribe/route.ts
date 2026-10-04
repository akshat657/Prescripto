import { errorResponse, groqTranscribe, MODELS } from "@/lib/server/groq";
import { isTranscribeMode, WHISPER_MODES } from "@/lib/server/prompt";

export const maxDuration = 60;

// Vercel rejects request bodies over 4.5 MB. The browser sends pause-cut WAV
// pieces of at most 20 s (~640 KB), so this is only a safety net.
const MAX_BYTES = 4 * 1024 * 1024;

interface WhisperSegment {
  start: number;
  end: number;
  text: string;
  no_speech_prob?: number;
}

export async function POST(request: Request) {
  try {
    const incoming = await request.formData();
    const file = incoming.get("file");
    if (!(file instanceof File)) {
      return Response.json({ error: "No audio file received." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return Response.json(
        { error: "Audio piece is larger than 4 MB. Please record in the app or upload a shorter file." },
        { status: 413 },
      );
    }
    const offset = Number(incoming.get("offset") || 0);
    const requested = String(incoming.get("language") || "mixed");
    const modeName = isTranscribeMode(requested) ? requested : "mixed";
    const mode = WHISPER_MODES[modeName];

    let data = await transcribe(file, mode.accurate, mode.prompt, mode.language);
    if (modeName === "mixed") {
      // Only Hindi and English belong here. Short Hindi lines get detected as Urdu
      // (Arabic script) or worse; redo them with the language pinned.
      const detected = String(data.language ?? "").toLowerCase();
      if (detected && !detected.startsWith("hi") && !detected.startsWith("en")) {
        const latin = !/[^\u0000-\u007F]/.test(String(data.text ?? ""));
        data = await transcribe(file, true, mode.prompt, latin ? "en" : "hi");
      }
    }

    const raw: WhisperSegment[] = Array.isArray(data.segments) ? data.segments : [];
    const segments = raw
      // Whisper hallucinates text ("Thank you.") over silence; drop those.
      .filter((s) => s.text.trim() && (s.no_speech_prob ?? 0) < 0.8 && !isJunk(s.text))
      .map((s) => ({ start: s.start + offset, end: s.end + offset, text: s.text.trim() }));

    if (!segments.length && typeof data.text === "string" && data.text.trim() && !isJunk(data.text)) {
      segments.push({ start: offset, end: offset + (data.duration ?? 0), text: data.text.trim() });
    }

    return Response.json({ segments, language: data.language ?? null });
  } catch (err) {
    return errorResponse(err);
  }
}

function transcribe(file: File, accurate: boolean, prompt: string, language?: string) {
  const form = new FormData();
  form.append("file", file, file.name || "audio.wav");
  form.append("model", accurate ? MODELS.transcribeAccurate : MODELS.transcribeFast);
  form.append("response_format", "verbose_json");
  form.append("temperature", "0");
  if (prompt) form.append("prompt", prompt);
  if (language) form.append("language", language);
  return groqTranscribe(form);
}

// Whisper's failure mode on Hindi is runs of "?" — never real speech.
function isJunk(text: string) {
  const letters = text.replace(/[\s\p{P}]/gu, "");
  const q = (text.match(/\?/g) || []).length;
  return letters.length === 0 || q > 3 && q >= letters.length / 2;
}
