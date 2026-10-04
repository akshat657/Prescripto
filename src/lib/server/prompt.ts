import "server-only";
import type { ReportLanguage } from "@/lib/types";

const BASE_PROMPT = `You are a careful medical scribe for an Indian outpatient clinic.
You receive a transcript of a doctor–patient consultation, split into numbered segments like "[12] text".
Each line is written in the language it was spoken in: English, Hindi (Devanagari), or a mix ("मुझे कल से chest pain है").
English words inside Hindi lines are sometimes spelled phonetically in Devanagari, imperfectly
(e.g. "पैरासीटमॉल" = Paracetamol, "डोलो" = Dolo 650, "सेटे रिजीन" = Cetirizine, "मिली ग्राम" = mg, "बीपी" = BP).
Numbers may be written as Hindi words ("एक सौ एक" = 101).

{LANGUAGE}

STRICT RULES
1. Only use what is actually said in the transcript. Never invent symptoms, findings, doses, durations or diagnoses.
   Never add negatives that were not said (e.g. do not write "no other medications" or "no fever" unless someone said so).
2. If something was not said, leave the string empty "" or the list empty []. Empty is correct and expected.
3. Medicines: "name" is always the standard English name and strength (e.g. "Cetirizine 10 mg", "Dolo 650") in Latin script,
   whatever the report language. When the transcript spelling is phonetic or garbled and you mapped it to a real medicine,
   set "uncertain": true so the doctor confirms it. Also set "uncertain": true if the dose or frequency is unclear.
   Medicines the patient already takes or took before the visit belong in history, not in "medications", unless the doctor
   tells them to continue. Medicines given once in the clinic (e.g. a nebulization or injection) go in "examination", not
   "medications". Never output a name that is not a real medicine; if you cannot tell what it is, copy it as heard and set uncertain.
4. Frequency: plain Indian prescription style when stated (e.g. "1-0-1", "once daily", "SOS / only when needed").
5. Timing: before food / after food / bedtime, etc. only if said.
6. "advice" = lifestyle / diet / care instructions the doctor actually gave — no generic filler like "take medicines as directed". "red_flags" = "come back immediately if…" warnings the doctor gave.
7. "patient_summary": 3–5 short, warm sentences in very simple words for the patient to read at home — what is wrong, what to take, what to avoid, when to return. Only from the transcript.
8. "speaker_labels": label EVERY segment from context as one space-separated string of "<id><letter>", where D = doctor, P = patient, O = other (attendant/family). Example: "0D 1P 2P 3D".
9. "evidence": for each section you filled (use the exact field names above), list the segment ids that support it.
10. Refer to the person as "the patient" (Hindi: "मरीज़") — never guess gender.
Return only JSON matching the schema.`;

const LANGUAGE_RULES: Record<ReportLanguage, string> = {
  en: "Write every text value of the report in clear, simple English, translating anything said in Hindi.",
  hi: `Write every text value of the report in simple, everyday Hindi in Devanagari script — the Hindi a patient speaks,
not formal/Sanskritised Hindi. Translate anything said in English.
Keep these in English (Latin script) because that is how they appear on Indian prescriptions and medicine strips:
medicine names and strengths, units (mg, ml, °F, mmHg, %), test names (CBC, ECG, X-ray, HbA1c), and readings like "BP 128/82".
In every text field other than "medications" (e.g. "patient_summary", "advice", "history_of_present_illness"), refer
to a medicine from the "medications" list ONLY as a placeholder {{M1}}, {{M2}} … — its position in that list. The
placeholder stands for the medicine's name and strength, so do not repeat the strength after it.
Example patient_summary: "{{M1}} रात को खाने के बाद लें और {{M2}} सुबह जारी रखें।"
The medicine fields other than "name" ARE written in Hindi: "frequency" like "दिन में एक बार" / "दिन में दो बार (सुबह-शाम)" /
"सिर्फ़ ज़रूरत पड़ने पर", "timing" like "खाने के बाद" / "रात को सोने से पहले", "duration" like "5 दिन" / "1 महीना" / "जारी रखें".
Example medicine: name "Paracetamol 650 mg", frequency "दिन में तीन बार", timing "खाने के बाद", duration "3 दिन".`,
};

export function systemPrompt(language: ReportLanguage) {
  return BASE_PROMPT.replace("{LANGUAGE}", LANGUAGE_RULES[language]);
}

const str = { type: "string" };
const strList = { type: "array", items: str };

function obj(properties: Record<string, unknown>) {
  return {
    type: "object",
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
  };
}

export const REPORT_SCHEMA = obj({
  chief_complaints: strList,
  history_of_present_illness: str,
  past_history: str,
  allergies: str,
  vitals: { type: "array", items: obj({ name: str, value: str }) },
  examination: str,
  provisional_diagnosis: str,
  investigations: strList,
  medications: {
    type: "array",
    items: obj({
      name: str,
      dose: str,
      frequency: str,
      timing: str,
      duration: str,
      instructions: str,
      uncertain: { type: "boolean" },
    }),
  },
  advice: strList,
  red_flags: strList,
  follow_up: str,
  patient_summary: str,
  // Compact on purpose: a per-segment object array costs ~4x the output tokens,
  // and the free tier only allows 8K tokens per minute.
  speaker_labels: str,
  evidence: {
    type: "array",
    items: obj({
      // Not an enum: Groq validates strict schemas *after* generation and rejects
      // the whole report over one extra section name. Unknown ones are dropped in
      // normalizeReport instead.
      section: str,
      segment_ids: { type: "array", items: { type: "integer" } },
    }),
  },
});

// What we measured on Groq (whisper-large-v3 vs turbo, Hindi / English / mixed clips):
// - Each piece gets ONE language. Locking it to Hindi wrote English sentences as
//   Devanagari gibberish or dropped them; an English prompt made Hindi "translate".
// - Auto-detect + this mixed-script example prompt on large-v3 gave the most
//   faithful text: Hindi in Devanagari, English in English, and code-mixed
//   sentences like "मुझे कल से Chest Pain है" with drug names spelled correctly.
// - turbo with any Hindi prompt produced "??? ???" junk; prompts containing "?"
//   or only Devanagari did too. Keep this prompt as is.
// - Short Hindi pieces are sometimes detected as Urdu (Arabic script) or even
//   Korean; the route re-runs those with an explicit language.
export const MIXED_PROMPT =
  "डॉक्टर साहब, मुझे दो दिन से fever और headache है। आपका BP normal है, Paracetamol 650 mg दिन में दो बार लीजिए।";

export type TranscribeMode = "mixed" | "en" | "any";

export const WHISPER_MODES: Record<TranscribeMode, { language?: string; accurate: boolean; prompt: string }> = {
  // Hindi and/or English, written as spoken. The default.
  mixed: { accurate: true, prompt: MIXED_PROMPT },
  en: {
    language: "en",
    accurate: false,
    prompt:
      "Doctor and patient consultation at an Indian clinic. Paracetamol, Pantoprazole, Azithromycin, Amoxicillin, " +
      "Metformin, Amlodipine, Telmisartan, Atorvastatin, Cetirizine, Montelukast, Dolo 650, Pan-D, ORS, BP, CBC, HbA1c.",
  },
  // Any other language: no prompt, so nothing biases detection.
  any: { accurate: true, prompt: "" },
};

export function isTranscribeMode(v: string): v is TranscribeMode {
  return v in WHISPER_MODES;
}
