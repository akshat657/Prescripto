import { MODELS } from "@/lib/server/groq";

export function GET() {
  return Response.json({
    configured: Boolean(process.env.GROQ_API_KEY),
    models: { transcribe: [MODELS.transcribeAccurate, MODELS.transcribeFast], extract: MODELS.extract },
  });
}
