"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, CircleCheck, LoaderCircle, Mic, Pause, Play, PlayCircle, Square, TriangleAlert, Upload } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { Waveform } from "@/components/Waveform";
import { TranscriptList } from "@/components/TranscriptList";
import { ApiError, transcribeChunk } from "@/lib/api";
import { findPatient, getPatient, newId, saveConsultation, savePatient, saveRecording } from "@/lib/db";
import { formatDuration } from "@/lib/report";
import { SAMPLE_DURATION, SAMPLE_PATIENT, SAMPLE_SEGMENTS } from "@/lib/sample";
import type { Consultation, Patient, ReportLanguage, Segment } from "@/lib/types";
import { type AudioPiece, splitAudioFile, useRecorder } from "@/lib/useRecorder";

const PREFS_KEY = "yaad:doctor";

const LANGUAGES = ["mixed", "en", "any"];

function loadPrefs(): { doctorName: string; clinicName: string; language: string; reportLanguage: ReportLanguage } {
  const defaults = { doctorName: "", clinicName: "", language: "mixed", reportLanguage: "en" as ReportLanguage };
  try {
    const saved = { ...defaults, ...JSON.parse(localStorage.getItem(PREFS_KEY) || "{}") };
    // Earlier versions used "hinglish" / "auto" / "hi", which forced one language per visit.
    if (!LANGUAGES.includes(saved.language)) saved.language = "mixed";
    if (saved.reportLanguage !== "hi") saved.reportLanguage = "en";
    return saved;
  } catch {
    return defaults;
  }
}

export default function NewConsultationPage() {
  return (
    <>
      <SiteHeader />
      <Suspense fallback={null}>
        <NewConsultation />
      </Suspense>
    </>
  );
}

function NewConsultation() {
  const router = useRouter();
  const params = useSearchParams();
  const demo = params.get("demo") === "1";
  const patientParam = params.get("patient");

  const [doctorName, setDoctorName] = useState("");
  const [clinicName, setClinicName] = useState("");
  const [language, setLanguage] = useState("mixed");
  const [reportLanguage, setReportLanguage] = useState<ReportLanguage>("en");
  const [patient, setPatient] = useState({ name: "", age: "", sex: "", phone: "" });
  const [existingPatientId, setExistingPatientId] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [keepAudio, setKeepAudio] = useState(true);

  const [segments, setSegments] = useState<Segment[]>([]);
  const [pending, setPending] = useState(0);
  const [waitNote, setWaitNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [demoPlaying, setDemoPlaying] = useState(false);
  const [uploadName, setUploadName] = useState<string | null>(null);

  const consultationId = useRef(newId());
  const nextSegId = useRef(0);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const segmentsRef = useRef<Segment[]>([]);
  // Uploaded file, kept as-is if the doctor chose to keep audio.
  const uploadRef = useRef<File | null>(null);

  // localStorage is only readable after mount (the page is pre-rendered).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const p = loadPrefs();
    setDoctorName(p.doctorName || (demo ? "Dr. A. Mehra" : ""));
    setClinicName(p.clinicName);
    setLanguage(p.language);
    setReportLanguage(p.reportLanguage);
    if (demo) {
      setPatient(SAMPLE_PATIENT);
      setConsent(true);
    }
  }, [demo]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!patientParam) return;
    getPatient(patientParam).then((p) => {
      if (!p) return;
      setExistingPatientId(p.id);
      setPatient({ name: p.name, age: p.age, sex: p.sex, phone: p.phone });
    });
  }, [patientParam]);

  const addSegments = useCallback((raw: { start: number; end: number; text: string }[]) => {
    const fresh: Segment[] = raw.map((s) => ({ ...s, id: nextSegId.current++, speaker: "unknown" }));
    segmentsRef.current = [...segmentsRef.current, ...fresh];
    setSegments(segmentsRef.current);
  }, []);

  const enqueue = useCallback(
    (piece: AudioPiece) => {
      setPending((n) => n + 1);
      queue.current = queue.current.then(async () => {
        try {
          const { segments: got } = await transcribeChunk(
            piece.blob,
            { offset: piece.offset, language, filename: piece.filename },
            (sec) => setWaitNote(`Free-tier speed limit reached — continuing in ${sec}s…`),
          );
          setWaitNote(null);
          addSegments(got);
        } catch (err) {
          setWaitNote(null);
          setError(
            err instanceof ApiError
              ? `A part of the audio could not be transcribed: ${err.message}`
              : "A part of the audio could not be transcribed. Check your internet connection.",
          );
        } finally {
          setPending((n) => n - 1);
        }
      });
    },
    [language, addSegments],
  );

  const recorder = useRecorder(enqueue);
  const durationRef = useRef(0);

  const formReady = patient.name.trim() && doctorName.trim() && consent;
  const busy = recorder.state === "recording" || recorder.state === "paused" || demoPlaying || finishing;

  function rememberPrefs() {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ doctorName, clinicName, language, reportLanguage }));
    } catch {
      // storage unavailable — prefs are a convenience only
    }
  }

  async function startRecording() {
    setError(null);
    rememberPrefs();
    await recorder.start();
  }

  function playDemo() {
    setError(null);
    rememberPrefs();
    setDemoPlaying(true);
    segmentsRef.current = [];
    setSegments([]);
    let i = 0;
    const tick = () => {
      if (i >= SAMPLE_SEGMENTS.length) {
        nextSegId.current = SAMPLE_SEGMENTS.length;
        durationRef.current = SAMPLE_DURATION;
        setDemoPlaying(false);
        return;
      }
      // Demo keeps speaker labels so the transcript reads naturally.
      segmentsRef.current = [...segmentsRef.current, SAMPLE_SEGMENTS[i]];
      setSegments(segmentsRef.current);
      i++;
      setTimeout(tick, 420);
    };
    tick();
  }

  async function uploadFile(file: File) {
    setError(null);
    rememberPrefs();
    setUploadName(file.name);
    try {
      // Split in the browser at pauses, same as live recording, so long files
      // work and Hindi isn't cut mid-word.
      const { pieces, duration } = await splitAudioFile(file);
      if (!pieces.length) {
        setError("No speech was found in this file.");
        return;
      }
      durationRef.current = duration;
      uploadRef.current = file;
      pieces.forEach(enqueue);
    } catch {
      setError("This file could not be read. Try an MP3, M4A, WAV or WebM recording.");
    }
  }

  async function finish() {
    let audio: Blob | null = uploadRef.current;
    let pendingAudio: Promise<Blob | null> | null = null;
    if (recorder.state === "recording" || recorder.state === "paused") {
      const stopped = recorder.stop();
      durationRef.current = stopped.duration;
      pendingAudio = stopped.audio;
    }
    setFinishing(true);
    if (pendingAudio) audio = await pendingAudio;
    await queue.current;

    const segs = segmentsRef.current;
    if (!segs.length) {
      setFinishing(false);
      setError("Nothing was heard in the recording. Check the microphone and try again.");
      return;
    }

    let patientId = existingPatientId;
    if (!patientId) {
      const match = await findPatient(patient.name, patient.phone);
      patientId = match?.id ?? newId();
      if (!match) {
        const p: Patient = { id: patientId, ...patient, name: patient.name.trim(), createdAt: Date.now() };
        await savePatient(p);
      }
    }

    const c: Consultation = {
      id: consultationId.current,
      patientId,
      createdAt: Date.now(),
      durationSec: Math.round(durationRef.current),
      language,
      reportLanguage,
      doctorName: doctorName.trim(),
      clinicName: clinicName.trim(),
      consent,
      segments: segs,
      report: null,
      model: null,
      status: "draft",
      signedAt: null,
      audio: keepAudio && audio ? { mime: audio.type || "audio/webm", bytes: audio.size } : null,
    };
    if (keepAudio && audio) {
      try {
        await saveRecording({ id: c.id, blob: audio, mime: c.audio!.mime, createdAt: c.createdAt });
      } catch {
        // Storage full or blocked: keep the visit, just without audio.
        c.audio = null;
      }
    }
    await saveConsultation(c);
    router.push(`/consult/${c.id}${demo ? "?demo=1" : ""}`);
  }

  // While recording, the newest audio is still in memory, so finishing is allowed
  // before any transcript line has come back.
  const canFinish =
    !demoPlaying &&
    !finishing &&
    (segments.length > 0 || pending > 0 || recorder.state === "recording" || recorder.state === "paused");

  return (
    <main className="flex-1 paper-grain">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-6">
        <Link href="/" className="inline-flex items-center gap-2 text-[15px] font-semibold text-teal hover:underline">
          <ArrowLeft size={16} /> Back
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-4 mt-3 mb-8">
          <div>
            <h1 className="font-serif text-[36px] leading-tight">New consultation</h1>
            <p className="text-[17px] text-ink-soft">
              {demo ? "Demo mode — a sample Hinglish consultation is ready to play." : "Fill in the patient, take consent, then start."}
            </p>
          </div>
          {demo && <span className="stamp text-clay">Demo · sample data</span>}
        </div>

        <div className="grid lg:grid-cols-12 gap-6">
          {/* Left: who */}
          <section className="lg:col-span-4 space-y-6">
            <div className="bg-card border border-line rounded-lg p-6">
              <h2 className="font-serif text-[22px] mb-4">Patient</h2>
              <fieldset disabled={busy || !!existingPatientId} className="space-y-4">
                <Field label="Full name" required>
                  <input className="field" value={patient.name} onChange={(e) => setPatient({ ...patient, name: e.target.value })} placeholder="e.g. Ramesh Kumar" autoComplete="off" />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Age">
                    <input className="field tabular" inputMode="numeric" value={patient.age} onChange={(e) => setPatient({ ...patient, age: e.target.value })} placeholder="42" />
                  </Field>
                  <Field label="Sex">
                    <select className="field" value={patient.sex} onChange={(e) => setPatient({ ...patient, sex: e.target.value })}>
                      <option value="">—</option>
                      <option>Female</option>
                      <option>Male</option>
                      <option>Other</option>
                    </select>
                  </Field>
                </div>
                <Field label="WhatsApp number (optional)" hint="To send the report to the patient">
                  <input className="field tabular" inputMode="tel" value={patient.phone} onChange={(e) => setPatient({ ...patient, phone: e.target.value.replace(/[^\d+ ]/g, "") })} placeholder="98765 43210" />
                </Field>
              </fieldset>
              {existingPatientId && <p className="text-[14px] text-teal mt-3 font-semibold">Returning patient — this visit will be added to their history.</p>}
            </div>

            <div className="bg-card border border-line rounded-lg p-6">
              <h2 className="font-serif text-[22px] mb-4">Doctor</h2>
              <fieldset disabled={busy} className="space-y-4">
                <Field label="Your name (printed on the report)" required>
                  <input className="field" value={doctorName} onChange={(e) => setDoctorName(e.target.value)} placeholder="Dr. Priya Sharma" />
                </Field>
                <Field label="Clinic">
                  <input className="field" value={clinicName} onChange={(e) => setClinicName(e.target.value)} placeholder="Sharma Clinic, Pune" />
                </Field>
                <Field label="Language spoken" hint="Each sentence is written in the language it was spoken in.">
                  <select className="field" value={language} onChange={(e) => setLanguage(e.target.value)}>
                    <option value="mixed">Hindi and/or English</option>
                    <option value="en">English only</option>
                    <option value="any">Another language</option>
                  </select>
                </Field>
                <Field label="Report language" hint="The whole report and the patient's slip are written in this language.">
                  <select className="field" value={reportLanguage} onChange={(e) => setReportLanguage(e.target.value as ReportLanguage)}>
                    <option value="en">English</option>
                    <option value="hi">हिन्दी (Hindi)</option>
                  </select>
                </Field>
              </fieldset>
            </div>
          </section>

          {/* Right: record */}
          <section className="lg:col-span-8 space-y-6">
            <label
              className={`flex gap-4 items-start p-5 rounded-lg border-2 cursor-pointer transition-colors ${
                consent ? "border-teal bg-teal-tint/50" : "border-clay-bright/60 bg-card"
              }`}
            >
              <input
                type="checkbox"
                className="mt-1 w-6 h-6 accent-[#0d7276] shrink-0"
                checked={consent}
                disabled={busy}
                onChange={(e) => setConsent(e.target.checked)}
              />
              <span>
                <span className="block font-semibold text-[18px]">The patient has agreed to this conversation being recorded.</span>
                <span className="block text-[15px] text-ink-soft mt-1">
                  {keepAudio
                    ? "The recording is kept with this visit on this device, so it can be played back to confirm what was said."
                    : "The audio is used only to write this visit's report and is not saved."}
                </span>
              </span>
            </label>

            {!demo && (
              <label className="flex gap-4 items-start px-5 py-4 rounded-lg border border-line bg-card cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-1 w-6 h-6 accent-[#0d7276] shrink-0"
                  checked={keepAudio}
                  disabled={finishing}
                  onChange={(e) => setKeepAudio(e.target.checked)}
                />
                <span>
                  <span className="block font-semibold text-[17px]">Keep the recording with the visit</span>
                  <span className="block text-[15px] text-ink-soft mt-0.5">
                    The patient has agreed to it being stored. Saved only on this device, and it can be deleted later.
                  </span>
                </span>
              </label>
            )}

            <div className="bg-card border border-line rounded-lg p-6 sm:p-8">
              <RecordPanel
                demo={demo}
                state={recorder.state}
                elapsed={demo ? Math.min(SAMPLE_DURATION, (segments.at(-1)?.end ?? 0)) : recorder.elapsed}
                level={recorder.level}
                demoPlaying={demoPlaying}
                disabledReason={
                  !patient.name.trim()
                    ? "Enter the patient's name first"
                    : !doctorName.trim()
                      ? "Enter your name first"
                      : !consent
                        ? "Tick the consent box first"
                        : null
                }
                canStart={!!formReady}
                hasTranscript={segments.length > 0}
                onStart={startRecording}
                onPause={recorder.pause}
                onResume={recorder.resume}
                onPlayDemo={playDemo}
              />

              {(recorder.error || error) && (
                <p role="alert" className="mt-5 flex gap-2 text-[16px] text-clay bg-clay-tint border border-[#f1d6c6] rounded p-3">
                  <TriangleAlert size={20} className="shrink-0 mt-0.5" /> {recorder.error || error}
                </p>
              )}
              {waitNote && <p className="mt-4 text-[15px] text-muted">{waitNote}</p>}

              {!demo && recorder.state === "idle" && !segments.length && (
                <div className="mt-6 pt-5 border-t border-line flex flex-wrap items-center gap-3 text-[15px] text-ink-soft">
                  <span>Already have a recording?</span>
                  <label className={`btn btn-ghost min-h-[42px] ${formReady ? "" : "opacity-50 pointer-events-none"}`}>
                    <Upload size={17} /> Upload a recording
                    <input
                      type="file"
                      accept="audio/*"
                      className="sr-only"
                      disabled={!formReady || pending > 0}
                      onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0])}
                    />
                  </label>
                  {uploadName && <span className="text-muted">{uploadName}</span>}
                </div>
              )}
            </div>

            <div className="bg-card border border-line rounded-lg">
              <div className="flex items-center justify-between px-6 py-4 border-b border-line">
                <h2 className="font-serif text-[22px]">Live transcript</h2>
                <span className="text-[14px] text-muted flex items-center gap-2">
                  {pending > 0 && <LoaderCircle size={16} className="animate-spin text-teal" />}
                  {pending > 0 ? "Writing down…" : segments.length ? `${segments.length} lines` : ""}
                </span>
              </div>
              <div className="max-h-[440px] overflow-y-auto p-4 sm:p-6">
                {segments.length ? (
                  <TranscriptList segments={segments} autoScroll />
                ) : (
                  <p className="text-[17px] text-muted text-center py-10">
                    {recorder.state === "recording"
                      ? "Listening… lines appear at each natural pause."
                      : "What is said will appear here."}
                  </p>
                )}
              </div>
            </div>

            <div className="sticky bottom-0 z-10 -mx-4 sm:mx-0 bg-card/95 border-t sm:border border-line sm:rounded-lg px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <p className="text-[15px] text-ink-soft">
                {finishing
                  ? pending > 0
                    ? "Finishing the last part of the transcript…"
                    : "Saving…"
                  : "When the consultation is over, finish to create the report."}
              </p>
              <button className="btn btn-primary min-h-[52px] px-7" disabled={!canFinish} onClick={finish}>
                {finishing ? <LoaderCircle size={18} className="animate-spin" /> : <CircleCheck size={18} />}
                Finish &amp; create report
              </button>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[15px] font-semibold text-ink-soft mb-1.5">
        {label}
        {required && <span className="text-clay"> *</span>}
      </span>
      {children}
      {hint && <span className="block text-[13px] text-muted mt-1">{hint}</span>}
    </label>
  );
}

function RecordPanel(props: {
  demo: boolean;
  state: string;
  elapsed: number;
  level: number;
  demoPlaying: boolean;
  disabledReason: string | null;
  canStart: boolean;
  hasTranscript: boolean;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onPlayDemo: () => void;
}) {
  const { demo, state, elapsed, level, demoPlaying, disabledReason, canStart } = props;
  const recording = state === "recording";
  const paused = state === "paused";

  return (
    <div className="flex flex-col sm:flex-row items-center gap-8">
      {demo ? (
        <button
          onClick={props.onPlayDemo}
          disabled={!canStart || demoPlaying}
          className={`w-[120px] h-[120px] rounded-full flex flex-col items-center justify-center text-white font-semibold text-[15px] shrink-0 border-4 transition-colors disabled:opacity-50 ${
            demoPlaying ? "bg-clay-bright border-[#f3c0ae] recording-pulse" : "bg-teal border-teal-tint hover:bg-teal-deep"
          }`}
          aria-label="Play sample consultation"
        >
          <PlayCircle size={36} strokeWidth={1.6} />
          {props.hasTranscript && !demoPlaying ? "Replay" : demoPlaying ? "Playing" : "Play"}
        </button>
      ) : state === "idle" || state === "stopped" ? (
        <button
          onClick={props.onStart}
          disabled={!canStart || state === "stopped"}
          className="w-[120px] h-[120px] rounded-full bg-teal hover:bg-teal-deep border-4 border-teal-tint flex flex-col items-center justify-center text-white font-semibold text-[15px] shrink-0 disabled:opacity-50 transition-colors"
          aria-label="Start recording"
        >
          <Mic size={36} strokeWidth={1.6} />
          Start
        </button>
      ) : (
        <button
          onClick={recording ? props.onPause : props.onResume}
          className={`w-[120px] h-[120px] rounded-full flex flex-col items-center justify-center text-white font-semibold text-[15px] shrink-0 border-4 transition-colors ${
            recording ? "bg-clay-bright border-[#f3c0ae] recording-pulse" : "bg-teal border-teal-tint"
          }`}
          aria-label={recording ? "Pause recording" : "Resume recording"}
        >
          {recording ? <Pause size={34} /> : <Play size={34} />}
          {recording ? "Pause" : "Resume"}
        </button>
      )}

      <div className="flex-1 w-full">
        <div className="flex items-center gap-3 mb-2">
          {recording || demoPlaying ? (
            <span className="stamp text-clay">
              <span className="w-2 h-2 rounded-full bg-clay-bright" /> {demoPlaying ? "Playing sample" : "Recording"}
            </span>
          ) : paused ? (
            <span className="stamp text-muted">Paused</span>
          ) : state === "stopped" ? (
            <span className="stamp text-teal">
              <Square size={10} /> Stopped
            </span>
          ) : (
            <span className="stamp text-muted">Ready</span>
          )}
        </div>
        <p className="font-serif text-[52px] leading-none tabular">{formatDuration(elapsed)}</p>
        <Waveform level={demoPlaying ? 0.5 : level} active={recording || demoPlaying} />
        <p className="text-[15px] text-muted mt-2">
          {disabledReason && (state === "idle" || demo)
            ? disabledReason
            : demo
              ? "Plays a 2-minute fever & sore-throat consultation as if it were live."
              : recording
                ? "Speak normally. Pause any time; the patient can see the screen."
                : paused
                  ? "Recording paused. Resume, or finish below."
                  : "Tap Start when the patient is seated."}
        </p>
      </div>
    </div>
  );
}
