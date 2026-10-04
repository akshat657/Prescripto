// Pinged by the GitHub Actions keep-alive job (.github/workflows/keep-alive.yml).
// Deliberately does no Groq call, so pings never use API quota.
export function GET() {
  return Response.json(
    { ok: true, groqConfigured: Boolean(process.env.GROQ_API_KEY), time: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
