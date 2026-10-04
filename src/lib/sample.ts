import type { Report, Segment } from "./types";

// A made-up consultation used by the demo. No real patient data.
export const SAMPLE_PATIENT = { name: "Sunita Verma", age: "46", sex: "Female", phone: "" };

const lines: [number, Segment["speaker"], string][] = [
  [0, "doctor", "Namaste Sunita ji, aaiye baithiye. Batayiye kya problem ho rahi hai?"],
  [6, "patient", "Doctor sahab, teen din se bukhar hai, raat ko zyada ho jaata hai. Aur gale mein bahut dard hai."],
  [14, "doctor", "Bukhar kitna gaya tha? Thermometer se check kiya?"],
  [18, "patient", "Kal raat 101 tha. Dolo li thi toh thoda utra."],
  [23, "doctor", "Khansi hai? Balgam aata hai?"],
  [26, "patient", "Sukhi khansi hai, balgam nahi. Bas nigalne mein dard hota hai."],
  [32, "doctor", "Koi dawai se allergy hai aapko?"],
  [35, "patient", "Haan, sulpha wali dawai se rash ho gaya tha ek baar."],
  [40, "doctor", "Theek hai, and sugar ya BP ki koi problem?"],
  [44, "patient", "BP ki goli leti hoon, Amlodipine 5, roz subah."],
  [50, "doctor", "Okay. Muh kholiye… throat is red, tonsils thode swollen hain. Temperature abhi 100.2 hai, BP 128 by 82."],
  [62, "doctor", "Chest clear hai. Yeh viral pharyngitis lag raha hai, antibiotic ki zaroorat abhi nahi hai."],
  [70, "doctor", "Paracetamol 650 lijiye, din mein teen baar, khana khaane ke baad, jab bukhar ho. Teen din tak."],
  [80, "doctor", "Aur Cetirizine 10 mg raat ko sone se pehle, paanch din."],
  [87, "doctor", "Garam paani mein namak daal ke gargle kijiye, din mein teen-chaar baar. Thanda paani aur ice cream avoid karna."],
  [96, "doctor", "Amlodipine waise hi chalu rakhiye, band mat karna."],
  [101, "doctor", "Agar saans lene mein dikkat ho, ya bukhar 103 se upar jaaye, ya teen din baad bhi na utre, toh turant aana."],
  [110, "doctor", "Ek CBC test karwa lijiye agar bukhar parso tak rahe. Paanch din baad follow-up ke liye aaiye."],
  [118, "patient", "Theek hai doctor sahab, dhanyawaad."],
];

export const SAMPLE_SEGMENTS: Segment[] = lines.map(([start, speaker, text], i) => ({
  id: i,
  start,
  end: lines[i + 1]?.[0] ?? start + 5,
  text,
  speaker,
}));

export const SAMPLE_DURATION = 123;

// Used only when the server has no GROQ_API_KEY, so the demo still works.
export const SAMPLE_REPORT: Report = {
  chief_complaints: ["Fever for 3 days, worse at night", "Sore throat with pain on swallowing", "Dry cough"],
  history_of_present_illness:
    "Fever for 3 days, higher at night, maximum recorded 101°F last night, partially relieved by Dolo. Associated sore throat with painful swallowing and dry, non-productive cough.",
  past_history: "Hypertension on Amlodipine 5 mg once daily in the morning.",
  allergies: "Sulpha drugs — caused rash.",
  vitals: [
    { name: "Temperature", value: "100.2°F" },
    { name: "Blood pressure", value: "128/82 mmHg" },
  ],
  examination: "Throat congested, tonsils mildly enlarged. Chest clear.",
  provisional_diagnosis: "Viral pharyngitis",
  investigations: ["CBC if fever persists beyond 2 days"],
  medications: [
    {
      name: "Paracetamol 650 mg",
      dose: "1 tablet",
      frequency: "Three times a day, when fever",
      timing: "After food",
      duration: "3 days",
      instructions: "",
      uncertain: false,
    },
    {
      name: "Cetirizine 10 mg",
      dose: "1 tablet",
      frequency: "Once daily",
      timing: "At bedtime",
      duration: "5 days",
      instructions: "",
      uncertain: false,
    },
    {
      name: "Amlodipine 5 mg",
      dose: "1 tablet",
      frequency: "Once daily",
      timing: "Morning",
      duration: "Continue",
      instructions: "Do not stop — existing BP medicine",
      uncertain: false,
    },
  ],
  advice: ["Warm salt-water gargles 3–4 times a day", "Avoid cold water and ice cream"],
  red_flags: ["Difficulty breathing", "Fever above 103°F", "Fever not settling after 3 days"],
  follow_up: "After 5 days",
  patient_summary:
    "You have a viral throat infection, so antibiotics are not needed right now. Take Paracetamol 650 after food when you have fever, up to three times a day, and Cetirizine at bedtime for 5 days. Keep taking your BP tablet every morning. Do warm salt-water gargles and avoid cold things. Come back right away if breathing becomes difficult or the fever goes above 103°F.",
  evidence: [
    { section: "chief_complaints", segment_ids: [1, 5] },
    { section: "history_of_present_illness", segment_ids: [1, 3, 5] },
    { section: "past_history", segment_ids: [9] },
    { section: "allergies", segment_ids: [7] },
    { section: "vitals", segment_ids: [10] },
    { section: "examination", segment_ids: [10, 11] },
    { section: "provisional_diagnosis", segment_ids: [11] },
    { section: "investigations", segment_ids: [17] },
    { section: "medications", segment_ids: [12, 13, 15] },
    { section: "advice", segment_ids: [14] },
    { section: "red_flags", segment_ids: [16] },
    { section: "follow_up", segment_ids: [17] },
  ],
};
