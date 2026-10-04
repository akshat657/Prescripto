export type Speaker = "doctor" | "patient" | "other" | "unknown";

export interface Segment {
  id: number;
  start: number; // seconds from start of consultation
  end: number;
  text: string;
  speaker: Speaker;
}

export interface Medication {
  name: string;
  dose: string;
  frequency: string;
  timing: string; // before / after food, bedtime …
  duration: string;
  instructions: string;
  uncertain: boolean; // model is unsure of the spelling / dose — doctor must check
}

export interface Vital {
  name: string;
  value: string;
}

export interface Evidence {
  section: ReportSection;
  segment_ids: number[];
}

export interface Report {
  chief_complaints: string[];
  history_of_present_illness: string;
  past_history: string;
  allergies: string;
  vitals: Vital[];
  examination: string;
  provisional_diagnosis: string;
  investigations: string[];
  medications: Medication[];
  advice: string[];
  red_flags: string[];
  follow_up: string;
  patient_summary: string;
  evidence: Evidence[];
}

export type ReportSection =
  | "chief_complaints"
  | "history_of_present_illness"
  | "past_history"
  | "allergies"
  | "vitals"
  | "examination"
  | "provisional_diagnosis"
  | "investigations"
  | "medications"
  | "advice"
  | "red_flags"
  | "follow_up";

export interface Patient {
  id: string;
  name: string;
  age: string;
  sex: string;
  phone: string;
  createdAt: number;
}

// Language the report is written in, whatever mix was spoken.
export type ReportLanguage = "en" | "hi";

export type ConsultationStatus = "recording" | "draft" | "signed";

export interface Consultation {
  id: string;
  patientId: string;
  createdAt: number;
  durationSec: number;
  language: string;
  doctorName: string;
  clinicName: string;
  consent: boolean;
  segments: Segment[];
  report: Report | null;
  model: string | null;
  status: ConsultationStatus;
  signedAt: number | null;
  // Set when the audio was kept (the blob lives in the "recordings" store).
  // Optional: visits saved before recordings existed don't have it.
  audio?: { mime: string; bytes: number } | null;
  reportLanguage?: ReportLanguage; // missing on older visits = English
}

export interface Recording {
  id: string; // same as the consultation id
  blob: Blob;
  mime: string;
  createdAt: number;
}

export function emptyReport(): Report {
  return {
    chief_complaints: [],
    history_of_present_illness: "",
    past_history: "",
    allergies: "",
    vitals: [],
    examination: "",
    provisional_diagnosis: "",
    investigations: [],
    medications: [],
    advice: [],
    red_flags: [],
    follow_up: "",
    patient_summary: "",
    evidence: [],
  };
}
