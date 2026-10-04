import type { ReportLanguage } from "./types";

// Labels for everything that is part of the *report* (review sheet, patient slip,
// WhatsApp text). The app's own buttons stay in English.
const EN = {
  visitReport: "Visit report",
  chief_complaints: "Chief complaints",
  history_of_present_illness: "History of present illness",
  past_history: "Past history",
  allergies: "Allergies",
  vitals: "Vitals",
  examination: "Examination",
  provisional_diagnosis: "Provisional diagnosis",
  medications: "Medicines",
  investigations: "Tests advised",
  advice: "Advice",
  red_flags: "Come back immediately if",
  follow_up: "Follow-up",
  patient_summary: "In simple words, for the patient",
  simpleWords: "In simple words",
  notMentioned: "Not mentioned in consultation",
  noMedicines: "No medicines were prescribed in the conversation.",
  patient: "Patient",
  age: "Age",
  sex: "Sex",
  allergy: "Allergy",
  diagnosis: "Diagnosis",
  complaints: "Complaints",
  findings: "Findings",
  nextVisit: "Next visit",
  medicine: "Medicine",
  dose: "Dose",
  howOften: "How often",
  when: "When",
  forHowLong: "For how long",
  for: "For",
  signedByDoctor: "Signed by doctor",
  draftNotSigned: "DRAFT — not yet signed",
  signature: "Doctor's signature",
  slipFooter:
    "Written from the consultation by Yaad and checked by the doctor. Follow your doctor's advice; call the clinic if anything is unclear.",
  visitSummary: "Visit summary",
  tests: "Tests",
  shareFooter: "Reviewed and signed by your doctor. Sent via Yaad.",
};

export type Labels = Record<keyof typeof EN, string>;

const HI: Labels = {
  visitReport: "जाँच रिपोर्ट",
  chief_complaints: "मुख्य तकलीफ़ें",
  history_of_present_illness: "बीमारी का विवरण",
  past_history: "पुरानी बीमारियाँ / इतिहास",
  allergies: "एलर्जी",
  vitals: "जाँच के आँकड़े",
  examination: "जाँच में पाया गया",
  provisional_diagnosis: "संभावित निदान",
  medications: "दवाइयाँ",
  investigations: "करवाने वाले टेस्ट",
  advice: "सलाह",
  red_flags: "तुरंत आएँ अगर",
  follow_up: "दोबारा कब आना है",
  patient_summary: "आसान शब्दों में, मरीज़ के लिए",
  simpleWords: "आसान शब्दों में",
  notMentioned: "बातचीत में नहीं बताया गया",
  noMedicines: "बातचीत में कोई दवा नहीं लिखी गई।",
  patient: "मरीज़",
  age: "उम्र",
  sex: "लिंग",
  allergy: "एलर्जी",
  diagnosis: "निदान",
  complaints: "तकलीफ़ें",
  findings: "जाँच",
  nextVisit: "अगली बार",
  medicine: "दवा",
  dose: "मात्रा",
  howOften: "कितनी बार",
  when: "कब",
  forHowLong: "कितने दिन",
  for: "कितने दिन",
  signedByDoctor: "डॉक्टर द्वारा हस्ताक्षरित",
  draftNotSigned: "ड्राफ़्ट — अभी हस्ताक्षर नहीं हुए",
  signature: "डॉक्टर के हस्ताक्षर",
  slipFooter:
    "यह रिपोर्ट बातचीत से Yaad ने लिखी है और डॉक्टर ने जाँची है। डॉक्टर की सलाह मानें; कुछ समझ न आए तो क्लिनिक में फ़ोन करें।",
  visitSummary: "जाँच का सारांश",
  tests: "टेस्ट",
  shareFooter: "आपके डॉक्टर ने जाँच कर हस्ताक्षर किए हैं। Yaad से भेजा गया।",
};

const SEX_HI: Record<string, string> = { Female: "महिला", Male: "पुरुष", Other: "अन्य" };

export function sexLabel(sex: string, lang: ReportLanguage | undefined) {
  return lang === "hi" ? (SEX_HI[sex] ?? sex) : sex;
}

export function labels(lang: ReportLanguage | undefined): Labels {
  return lang === "hi" ? HI : EN;
}
