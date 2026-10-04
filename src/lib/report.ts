import { labels } from "./i18n";
import { emptyReport, type Medication, type Report, type ReportLanguage, type ReportSection } from "./types";

const SECTIONS = new Set<string>([
  "chief_complaints",
  "history_of_present_illness",
  "past_history",
  "allergies",
  "vitals",
  "examination",
  "provisional_diagnosis",
  "investigations",
  "medications",
  "advice",
  "red_flags",
  "follow_up",
]);

const asStr = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const asList = (v: unknown) =>
  Array.isArray(v) ? v.map(asStr).filter(Boolean) : typeof v === "string" && v.trim() ? [v.trim()] : [];

// The model output is untrusted: coerce it into a complete Report so the UI
// never crashes on a missing field (JSON-mode fallback has no schema).
export function normalizeReport(raw: unknown): Report {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const base = emptyReport();
  return {
    ...base,
    chief_complaints: asList(r.chief_complaints),
    history_of_present_illness: asStr(r.history_of_present_illness),
    past_history: asStr(r.past_history),
    allergies: asStr(r.allergies),
    vitals: Array.isArray(r.vitals)
      ? r.vitals
          .map((v) => ({ name: asStr(v?.name), value: asStr(v?.value) }))
          .filter((v) => v.name || v.value)
      : [],
    examination: asStr(r.examination),
    provisional_diagnosis: asStr(r.provisional_diagnosis),
    investigations: asList(r.investigations),
    medications: Array.isArray(r.medications)
      ? r.medications
          .map(
            (m): Medication => ({
              name: asStr(m?.name),
              dose: asStr(m?.dose),
              frequency: asStr(m?.frequency),
              timing: asStr(m?.timing),
              duration: asStr(m?.duration),
              instructions: asStr(m?.instructions),
              uncertain: Boolean(m?.uncertain),
            }),
          )
          .filter((m) => m.name)
      : [],
    advice: asList(r.advice),
    red_flags: asList(r.red_flags),
    follow_up: asStr(r.follow_up),
    patient_summary: asStr(r.patient_summary),
    evidence: Array.isArray(r.evidence)
      ? r.evidence
          .filter((e) => e && SECTIONS.has(e.section))
          .map((e) => ({
            section: e.section as ReportSection,
            segment_ids: Array.isArray(e.segment_ids) ? e.segment_ids.map(Number).filter(Number.isFinite) : [],
          }))
      : [],
  };
}

export function emptyMedication(): Medication {
  return { name: "", dose: "", frequency: "", timing: "", duration: "", instructions: "", uncertain: false };
}

export function formatDuration(sec: number) {
  const s = Math.max(0, Math.round(sec));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function formatDate(ts: number, withTime = false) {
  return new Date(ts).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
  });
}

// Plain-text version of the report for WhatsApp / clipboard sharing.
export function reportToText(
  report: Report,
  meta: { patient: string; doctor: string; clinic: string; date: number; language?: ReportLanguage },
) {
  const L = labels(meta.language);
  const lines: string[] = [];
  lines.push(`*${L.visitSummary} — ${meta.patient}*`);
  lines.push(`${meta.doctor}${meta.clinic ? `, ${meta.clinic}` : ""} · ${formatDate(meta.date)}`);
  lines.push("");
  if (report.provisional_diagnosis) lines.push(`*${L.diagnosis}:* ${report.provisional_diagnosis}`);
  if (report.medications.length) {
    lines.push("", `*${L.medications}*`);
    report.medications.forEach((m, i) => {
      const parts = [m.dose, m.frequency, m.timing, m.duration].filter(Boolean);
      lines.push(`${i + 1}. ${m.name}${parts.length ? ` — ${parts.join(", ")}` : ""}`);
      if (m.instructions) lines.push(`   ${m.instructions}`);
    });
  }
  if (report.advice.length) {
    lines.push("", `*${L.advice}*`);
    report.advice.forEach((a) => lines.push(`• ${a}`));
  }
  if (report.red_flags.length) {
    lines.push("", `*${L.red_flags}*`);
    report.red_flags.forEach((a) => lines.push(`• ${a}`));
  }
  if (report.investigations.length) lines.push("", `*${L.tests}:* ${report.investigations.join(", ")}`);
  if (report.follow_up) lines.push("", `*${L.follow_up}:* ${report.follow_up}`);
  lines.push("", `_${L.shareFooter}_`);
  return lines.join("\n");
}
