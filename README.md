# Yaad — remember everything your doctor told you

Yaad listens to a doctor–patient consultation (Hindi, English or Hinglish), transcribes it, and drafts a structured visit
report. The doctor reviews, edits and signs it; the patient gets a clear slip to take home (print / PDF / WhatsApp).

## How it works

```
Browser mic ──30 s audio pieces──▶ /api/transcribe ──▶ Groq whisper-large-v3-turbo
                                                         │
             live transcript ◀───────────────────────────┘
Finish ──▶ /api/extract ──▶ Groq openai/gpt-oss-120b (falls back to gpt-oss-20b on 429)
             │   strict JSON schema: complaints, history, vitals, exam, diagnosis,
             │   medicines (+ "uncertain" flag), tests, advice, red flags, follow-up,
             │   patient summary, speaker labels, evidence (segment ids per section)
             ▼
Review screen ──▶ doctor edits ──▶ Approve & sign ──▶ slip / WhatsApp
```

- **Records are stored in the browser (IndexedDB)**, on the doctor's device. The server keeps nothing, so it runs on free
  Vercel/Render with no database. `src/lib/db.ts` is the only storage module, so you can swap it for Supabase later.
- Audio is recorded in standalone 30-second pieces. This keeps every upload under Vercel's 4.5 MB request limit and Groq's
  20 requests/minute, and lets the transcript appear while the doctor is still talking.
- Rate limits (free tier): Whisper 7,200 audio-seconds/hour; gpt-oss 8K tokens/minute. One report request has to fit
  inside 8K tokens including its output, which is roughly 12–15 minutes of conversation. 429 responses are retried
  automatically after the `retry-after` delay.
- **Languages:** the transcript keeps every sentence in the language it was spoken in: English, Hindi (Devanagari)
  or mixed ("मुझे कल से chest pain है"). Audio is cut at short pauses so each piece holds one turn, transcribed by
  `whisper-large-v3` with auto-detect and a mixed-script example prompt. Pieces detected as anything other than Hindi or
  English (short Hindi is often detected as Urdu) are redone with the language pinned. The **report language** (English or
  हिन्दी) is chosen per visit and can be switched on the review screen. In Hindi reports, medicine names, units and test
  names stay in English as on Indian prescriptions; the model writes {{M1}} placeholders that the server fills with the
  exact names, so drug names are never transliterated.
- **Recordings:** with the patient's consent ("Keep the recording", on by default), a compressed copy of the whole visit
  (Opus, about 210 KB a minute) is saved with it in IndexedDB. On the review screen, tapping a transcript line's time plays
  that moment, so the doctor can confirm unclear words. Recordings can be downloaded, or deleted while keeping the report.
- If a medicine name or dose is unclear, the model marks it `uncertain`, and the doctor can't sign until each one is confirmed.
- Without `GROQ_API_KEY` the demo (`/consult/new?demo=1`) still works using a pre-written sample report.

## Run locally

```bash
cp .env.example .env.local   # paste your Groq key
npm install
npm run dev                  # http://localhost:3000
```

Microphone access needs `localhost` or HTTPS.

## Personalise

Edit `src/config/site.ts` for your name, GitHub and portfolio links. Replace `public/creator.png` with a different photo.

## Deploy

**Vercel:** import the repo, add the `GROQ_API_KEY` environment variable, deploy. Nothing else to configure.

**Render:** create a new Web Service from the repo.
Build command `npm install && npm run build`, start command `npm start`, env var `GROQ_API_KEY`.

## Before real patients

This version is for demos and consented test recordings. Groq's free tier is not a data-protected service for health
data. For real use (DPDP Act 2023), you need informed consent (already enforced in the UI), a paid or self-hosted model
tier, and authentication. As things stand, anyone who opens a public deployment uses your Groq quota.
