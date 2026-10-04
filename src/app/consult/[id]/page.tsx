"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { createContext, Suspense, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  CircleCheck,
  Copy,
  LoaderCircle,
  MessageCircle,
  PenLine,
  Plus,
  Printer,
  RefreshCw,
  Save,
  Search,
  Trash2,
  TriangleAlert,
  Undo2,
} from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { TranscriptList } from "@/components/TranscriptList";
import { AutoTextarea } from "@/components/AutoTextarea";
import { ApiError, extractReport } from "@/lib/api";
import { deleteConsultation, deleteRecording, getConsultation, getPatient, saveConsultation } from "@/lib/db";
import { RecordingPlayer, type SeekRequest } from "@/components/RecordingPlayer";
import { emptyMedication, formatDate, formatDuration, normalizeReport, reportToText } from "@/lib/report";
import { labels, type Labels } from "@/lib/i18n";
import { SAMPLE_REPORT, SAMPLE_SEGMENTS } from "@/lib/sample";
import type { Consultation, Medication, Patient, Report, ReportLanguage, ReportSection } from "@/lib/types";

export default function ReviewPage() {
  return (
    <>
      <SiteHeader />
      <Suspense fallback={null}>
        <Review />
      </Suspense>
    </>
  );
}

type Phase = "loading" | "missing" | "extracting" | "error" | "ready";

function Review() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const demo = useSearchParams().get("demo") === "1";

  const [c, setC] = useState<Consultation | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [waitNote, setWaitNote] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [focus, setFocus] = useState<ReportSection | null>(null);
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const [seek, setSeek] = useState<SeekRequest | null>(null);
  const [playTime, setPlayTime] = useState(0);
  const started = useRef(false);

  const runExtraction = useCallback(
    async (consult: Consultation) => {
      setPhase("extracting");
      setError(null);
      try {
        const res = await extractReport(
          consult.segments.map((s) => ({ id: s.id, text: s.text })),
          consult.reportLanguage ?? "en",
          (sec) => setWaitNote(`The free tier allows a few reports per minute — trying again in ${sec}s…`),
        );
        setWaitNote(null);
        const report = normalizeReport(res.report);
        const segments = consult.segments.map((s) => ({ ...s, speaker: res.speakers[s.id] ?? s.speaker }));
        const next: Consultation = { ...consult, segments, report, model: res.model };
        await saveConsultation(next);
        setC(next);
        setPhase("ready");
      } catch (err) {
        setWaitNote(null);
        const isSample = consult.segments.length === SAMPLE_SEGMENTS.length && consult.segments[0]?.text === SAMPLE_SEGMENTS[0].text;
        // Without a server key the demo still shows what a report looks like.
        if (err instanceof ApiError && err.status === 503 && isSample) {
          const next: Consultation = { ...consult, report: structuredClone(SAMPLE_REPORT), model: "sample (no API key)" };
          await saveConsultation(next);
          setC(next);
          setNotice("The server has no Groq API key yet, so this is the pre-written sample report. Add GROQ_API_KEY to generate real ones.");
          setPhase("ready");
          return;
        }
        setError(err instanceof Error ? err.message : "Could not create the report.");
        setPhase("error");
      }
    },
    [],
  );

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      const consult = await getConsultation(id);
      if (!consult) return setPhase("missing");
      setC(consult);
      setPatient((await getPatient(consult.patientId)) ?? null);
      if (consult.report) setPhase("ready");
      else runExtraction(consult);
    })();
  }, [id, runExtraction]);

  // Warn before leaving with unsaved edits.
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const highlight = useMemo(() => {
    const ids = new Set<number>();
    if (c?.report && focus) c.report.evidence.filter((e) => e.section === focus).forEach((e) => e.segment_ids.forEach((i) => ids.add(i)));
    if (c && query.trim().length > 1) {
      const q = query.trim().toLowerCase();
      c.segments.forEach((s) => s.text.toLowerCase().includes(q) && ids.add(s.id));
    }
    return ids;
  }, [c, focus, query]);

  // The transcript line being heard right now while the recording plays.
  const playingId = useMemo(() => {
    if (!c?.audio || playTime <= 0) return null;
    let id: number | null = null;
    for (const s of c.segments) {
      if (s.start <= playTime + 0.05) id = s.id;
      else break;
    }
    return id;
  }, [c, playTime]);

  if (phase === "loading") return <Centered><LoaderCircle className="animate-spin text-teal" size={32} /></Centered>;
  if (phase === "missing" || !c)
    return (
      <Centered>
        <p className="font-serif text-[28px]">This consultation isn&apos;t on this device.</p>
        <p className="text-ink-soft mt-2">Reports are saved in the browser they were made in.</p>
        <Link href="/patients" className="btn btn-primary mt-6">See all patients</Link>
      </Centered>
    );

  const signed = c.status === "signed";
  const L = labels(c.reportLanguage);
  const report = c.report;
  const uncertainLeft = report?.medications.filter((m) => m.uncertain).length ?? 0;

  function update(patch: Partial<Report>) {
    setC((prev) => (prev && prev.report ? { ...prev, report: { ...prev.report, ...patch } } : prev));
    setDirty(true);
  }

  async function save(next?: Partial<Consultation>) {
    if (!c) return;
    const merged = { ...c, ...next, report: c.report ? cleanReport(c.report) : null };
    await saveConsultation(merged);
    setC(merged);
    setDirty(false);
  }

  async function sign() {
    if (uncertainLeft) return;
    await save({ status: "signed", signedAt: Date.now() });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function unsign() {
    await save({ status: "draft", signedAt: null });
  }

  async function switchLanguage(lang: ReportLanguage) {
    if (!c || (c.reportLanguage ?? "en") === lang) return;
    if (dirty && !confirm("Rewriting the report in another language will replace your edits. Continue?")) return;
    setDirty(false);
    runExtraction({ ...c, report: null, reportLanguage: lang });
  }

  async function regenerate() {
    if (!c) return;
    if (dirty && !confirm("Regenerating will replace your edits. Continue?")) return;
    setDirty(false);
    runExtraction({ ...c, report: null });
  }

  async function discard() {
    if (!c || !confirm("Delete this consultation and its report? This cannot be undone.")) return;
    await deleteConsultation(c.id);
    router.push(patient ? `/patients/${patient.id}` : "/patients");
  }

  const shareText = report && patient ? reportToText(cleanReport(report), { patient: patient.name, doctor: c.doctorName, clinic: c.clinicName, date: c.createdAt, language: c.reportLanguage }) : "";
  const phone = patient?.phone.replace(/\D/g, "") ?? "";
  const waNumber = phone.length === 10 ? `91${phone}` : phone;
  const waHref = `https://wa.me/${waNumber}?text=${encodeURIComponent(shareText)}`;

  return (
    <main className="flex-1 paper-grain">
      {/* Patient bar */}
      <div className="bg-linen border-b border-line">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-4 flex flex-wrap items-center gap-x-6 gap-y-2">
          <Link href={patient ? `/patients/${patient.id}` : "/patients"} className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-teal hover:underline">
            <ArrowLeft size={16} /> {patient ? "Patient history" : "Patients"}
          </Link>
          <p className="font-serif text-[26px] leading-tight">{patient?.name ?? "Patient"}</p>
          <p className="text-[16px] text-ink-soft">
            {[patient?.age && `${patient.age} yrs`, patient?.sex].filter(Boolean).join(" · ")}
          </p>
          <p className="text-[15px] text-muted">
            {formatDate(c.createdAt, true)} · {formatDuration(c.durationSec)} min · {c.doctorName}
          </p>
          <span className={`stamp ml-auto ${signed ? "text-teal" : "text-clay"}`}>
            {signed ? <><CircleCheck size={13} /> Signed {c.signedAt && formatDate(c.signedAt)}</> : "Draft — needs review"}
          </span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-6">
        {notice && <Banner tone="info">{notice}</Banner>}
        {demo && phase === "ready" && !signed && !notice && (
          <Banner tone="info">This is the demo. Try editing a line, click a section&apos;s &ldquo;Show source&rdquo;, then sign it.</Banner>
        )}

        <div className="grid lg:grid-cols-12 gap-6">
          {/* Transcript */}
          <section className="lg:col-span-5 bg-card border border-line rounded-lg flex flex-col lg:sticky lg:top-[88px] lg:max-h-[calc(100vh-110px)]">
            <div className="px-5 py-4 border-b border-line">
              <h2 className="font-serif text-[22px]">What was said</h2>
              {c.audio && (
                <div className="mt-3">
                  <RecordingPlayer
                    id={c.id}
                    seek={seek}
                    onTime={setPlayTime}
                    onDelete={async () => {
                      if (!confirm("Delete the audio recording of this visit? The transcript and report stay.")) return;
                      await deleteRecording(c.id);
                      await save({ audio: null });
                    }}
                  />
                  <p className="text-[13px] text-muted mt-1.5">Tap a line&apos;s time to hear that moment.</p>
                </div>
              )}
              <label className="relative block mt-3">
                <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input className="field pl-10 py-2.5 text-[16px]" placeholder="Search the transcript" value={query} onChange={(e) => setQuery(e.target.value)} />
              </label>
              {focus && (
                <button className="mt-3 text-[14px] font-semibold text-teal hover:underline" onClick={() => setFocus(null)}>
                  Clear highlight
                </button>
              )}
            </div>
            <div className="overflow-y-auto p-4 sm:p-5">
              <TranscriptList
                segments={c.segments}
                highlight={highlight}
                playingId={playingId}
                onPlay={c.audio ? (s) => setSeek({ time: s.start, nonce: Date.now() }) : undefined}
              />
            </div>
          </section>

          {/* Report */}
          <section className="lg:col-span-7">
            {phase === "extracting" && (
              <div className="bg-card border border-line rounded-lg p-10 text-center">
                <LoaderCircle className="animate-spin text-teal mx-auto" size={34} />
                <p className="font-serif text-[26px] mt-4">Writing the report…</p>
                <p className="text-ink-soft mt-1">Sorting complaints, findings and medicines. This takes a few seconds.</p>
                {waitNote && <p className="text-[15px] text-muted mt-4">{waitNote}</p>}
              </div>
            )}

            {phase === "error" && (
              <div className="bg-card border border-line rounded-lg p-8">
                <Banner tone="warn">{error}</Banner>
                <p className="text-ink-soft">The transcript is saved, so nothing is lost. You can try again now or in a minute.</p>
                <button className="btn btn-primary mt-5" onClick={() => runExtraction(c)}>
                  <RefreshCw size={18} /> Try again
                </button>
              </div>
            )}

            {phase === "ready" && report && (
              <div className="bg-card border border-line rounded-lg sheet-shadow" lang={c.reportLanguage === "hi" ? "hi" : "en"}>
                <div className="px-6 sm:px-8 pt-6 pb-4 border-b border-line">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="font-serif text-[26px]">{L.visitReport}</h2>
                    <div className="inline-flex rounded border border-line overflow-hidden text-[14px] font-semibold" role="group" aria-label="Report language">
                      {(["en", "hi"] as const).map((lang) => (
                        <button
                          key={lang}
                          type="button"
                          disabled={signed}
                          onClick={() => switchLanguage(lang)}
                          aria-pressed={(c.reportLanguage ?? "en") === lang}
                          className={`px-3.5 min-h-[38px] ${(c.reportLanguage ?? "en") === lang ? "bg-teal text-white" : "bg-card text-ink-soft hover:bg-linen"} disabled:cursor-not-allowed`}
                        >
                          {lang === "en" ? "English" : "हिन्दी"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className="text-[15px] text-muted">
                    {signed ? "Signed. Unlock to make changes." : "Check every section. Click any text to change it. Empty means it wasn't discussed."}
                  </p>
                </div>

                {uncertainLeft > 0 && !signed && (
                  <div className="mx-6 sm:mx-8 mt-5">
                    <Banner tone="warn">
                      {uncertainLeft === 1 ? "1 medicine needs" : `${uncertainLeft} medicines need`} checking — the name or dose wasn&apos;t clear in the audio.
                    </Banner>
                  </div>
                )}

                <LabelsCtx.Provider value={L}>
                <ReadOnly.Provider value={signed}>
                <div className="px-6 sm:px-8 py-2 divide-y divide-line">
                  <Section title={L.chief_complaints} id="chief_complaints" focus={focus} setFocus={setFocus} report={report}>
                    <ListField value={report.chief_complaints} onChange={(v) => update({ chief_complaints: v })} />
                  </Section>
                  <Section title={L.history_of_present_illness} id="history_of_present_illness" focus={focus} setFocus={setFocus} report={report}>
                    <TextField value={report.history_of_present_illness} onChange={(v) => update({ history_of_present_illness: v })} />
                  </Section>
                  <div className="grid sm:grid-cols-2 gap-x-6">
                    <Section title={L.past_history} id="past_history" focus={focus} setFocus={setFocus} report={report}>
                      <TextField value={report.past_history} onChange={(v) => update({ past_history: v })} />
                    </Section>
                    <Section title={L.allergies} id="allergies" focus={focus} setFocus={setFocus} report={report} tone={report.allergies ? "clay" : undefined}>
                      <TextField value={report.allergies} onChange={(v) => update({ allergies: v })} />
                    </Section>
                  </div>
                  <Section title={L.vitals} id="vitals" focus={focus} setFocus={setFocus} report={report}>
                    <VitalsField value={report.vitals} onChange={(v) => update({ vitals: v })} />
                  </Section>
                  <Section title={L.examination} id="examination" focus={focus} setFocus={setFocus} report={report}>
                    <TextField value={report.examination} onChange={(v) => update({ examination: v })} />
                  </Section>
                  <Section title={L.provisional_diagnosis} id="provisional_diagnosis" focus={focus} setFocus={setFocus} report={report}>
                    <TextField value={report.provisional_diagnosis} onChange={(v) => update({ provisional_diagnosis: v })} className="font-semibold" />
                  </Section>
                  <Section title={L.medications} id="medications" focus={focus} setFocus={setFocus} report={report}>
                    <MedicationsField value={report.medications} onChange={(v) => update({ medications: v })} readOnly={signed} />
                  </Section>
                  <Section title={L.investigations} id="investigations" focus={focus} setFocus={setFocus} report={report}>
                    <ListField value={report.investigations} onChange={(v) => update({ investigations: v })} />
                  </Section>
                  <Section title={L.advice} id="advice" focus={focus} setFocus={setFocus} report={report}>
                    <ListField value={report.advice} onChange={(v) => update({ advice: v })} />
                  </Section>
                  <Section title={L.red_flags} id="red_flags" focus={focus} setFocus={setFocus} report={report} tone="clay">
                    <ListField value={report.red_flags} onChange={(v) => update({ red_flags: v })} />
                  </Section>
                  <Section title={L.follow_up} id="follow_up" focus={focus} setFocus={setFocus} report={report}>
                    <TextField value={report.follow_up} onChange={(v) => update({ follow_up: v })} />
                  </Section>
                  <div className="py-5">
                    <p className="text-[13px] font-bold uppercase tracking-[0.1em] text-teal mb-2">{L.patient_summary}</p>
                    <TextField value={report.patient_summary} onChange={(v) => update({ patient_summary: v })} className="bg-sage/60 font-serif text-[19px]" />
                  </div>
                </div>
                </ReadOnly.Provider>
                </LabelsCtx.Provider>

                {c.model && <p className="px-6 sm:px-8 pb-5 text-[13px] text-muted">Draft written by {c.model}. Checked and signed by {c.doctorName}.</p>}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Action bar */}
      {phase === "ready" && report && (
        <div className="no-print sticky bottom-0 z-20 bg-card/95 border-t border-line">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-3 flex flex-wrap items-center gap-3">
            {!signed ? (
              <>
                <button className="btn btn-ghost" onClick={discard} title="Delete consultation">
                  <Trash2 size={18} /> <span className="hidden sm:inline">Delete</span>
                </button>
                <button className="btn btn-ghost" onClick={regenerate}>
                  <RefreshCw size={18} /> <span className="hidden sm:inline">Rewrite</span>
                </button>
                <div className="flex-1" />
                <button className="btn btn-ghost" onClick={() => save()} disabled={!dirty}>
                  <Save size={18} /> {dirty ? "Save draft" : "Saved"}
                </button>
                <button className="btn btn-primary min-h-[52px] px-7" onClick={sign} disabled={uncertainLeft > 0} title={uncertainLeft ? "Check the highlighted medicines first" : undefined}>
                  <PenLine size={18} /> Approve &amp; sign
                </button>
              </>
            ) : (
              <>
                <button className="btn btn-ghost" onClick={unsign}>
                  <Undo2 size={18} /> Unlock to edit
                </button>
                <div className="flex-1" />
                <button
                  className="btn btn-ghost"
                  onClick={async () => {
                    await navigator.clipboard.writeText(shareText);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                >
                  <Copy size={18} /> {copied ? "Copied" : "Copy text"}
                </button>
                <a className="btn btn-ghost" href={waHref} target="_blank" rel="noopener noreferrer">
                  <MessageCircle size={18} /> WhatsApp
                </a>
                <Link className="btn btn-primary min-h-[52px] px-7" href={`/consult/${c.id}/slip`}>
                  <Printer size={18} /> Print / PDF
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

// Drop blank lines/rows left over from editing.
function cleanReport(r: Report): Report {
  const list = (l: string[]) => l.map((s) => s.trim()).filter(Boolean);
  return {
    ...r,
    chief_complaints: list(r.chief_complaints),
    investigations: list(r.investigations),
    advice: list(r.advice),
    red_flags: list(r.red_flags),
    vitals: r.vitals.filter((v) => v.name.trim() || v.value.trim()),
    medications: r.medications.filter((m) => m.name.trim()),
  };
}

function Centered({ children }: { children: React.ReactNode }) {
  return <main className="flex-1 flex flex-col items-center justify-center text-center px-6 py-24">{children}</main>;
}

function Banner({ tone, children }: { tone: "warn" | "info"; children: React.ReactNode }) {
  return (
    <p
      role={tone === "warn" ? "alert" : "status"}
      className={`flex gap-2.5 items-start rounded p-3.5 mb-5 text-[16px] border ${
        tone === "warn" ? "bg-clay-tint border-[#f1d6c6] text-clay" : "bg-teal-tint border-[#c9e0de] text-teal-deep"
      }`}
    >
      {tone === "warn" && <TriangleAlert size={20} className="shrink-0 mt-0.5" />}
      <span>{children}</span>
    </p>
  );
}

function Section({
  title,
  id,
  focus,
  setFocus,
  report,
  tone,
  children,
}: {
  title: string;
  id: ReportSection;
  focus: ReportSection | null;
  setFocus: (s: ReportSection | null) => void;
  report: Report;
  tone?: "clay";
  children: React.ReactNode;
}) {
  const hasEvidence = report.evidence.some((e) => e.section === id && e.segment_ids.length);
  const active = focus === id;
  return (
    <div className={`py-5 ${active ? "bg-[#fffbea] -mx-6 sm:-mx-8 px-6 sm:px-8" : ""}`}>
      <div className="flex items-center justify-between gap-3 mb-2">
        <h3 className={`text-[13px] font-bold uppercase tracking-[0.1em] ${tone === "clay" ? "text-clay" : "text-muted"}`}>{title}</h3>
        {hasEvidence && (
          <button
            type="button"
            className="text-[13px] font-semibold text-teal hover:underline"
            onClick={() => setFocus(active ? null : id)}
          >
            {active ? "Hide source" : "Show source"}
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

// Report labels in the report's language, for the field components below.
const LabelsCtx = createContext<Labels>(labels("en"));

// True once signed: fields become read-only but "Show source" keeps working.
const ReadOnly = createContext(false);

function TextField({ value, onChange, className = "" }: { value: string; onChange: (v: string) => void; className?: string }) {
  const readOnly = useContext(ReadOnly);
  const L = useContext(LabelsCtx);
  return (
    <AutoTextarea
      readOnly={readOnly}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={L.notMentioned}
      className={`border-transparent read-only:hover:border-transparent hover:border-line bg-transparent px-2 -mx-2 py-1.5 text-[17px] placeholder:italic ${className}`}
    />
  );
}

function ListField({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const readOnly = useContext(ReadOnly);
  const L = useContext(LabelsCtx);
  return (
    <div>
      <AutoTextarea
        readOnly={readOnly}
        value={value.join("\n")}
        onChange={(e) => onChange(e.target.value.split("\n"))}
        placeholder={L.notMentioned}
        className="border-transparent read-only:hover:border-transparent hover:border-line bg-transparent px-2 -mx-2 py-1.5 text-[17px] placeholder:italic"
      />
    </div>
  );
}

function VitalsField({ value, onChange }: { value: Report["vitals"]; onChange: (v: Report["vitals"]) => void }) {
  const readOnly = useContext(ReadOnly);
  const L = useContext(LabelsCtx);
  if (!value.length && readOnly) return <span className="italic text-muted text-[17px]">{L.notMentioned}</span>;
  if (!value.length)
    return (
      <div className="flex items-center gap-3">
        <span className="italic text-muted text-[17px]">{L.notMentioned}</span>
        <button type="button" className="text-[14px] font-semibold text-teal hover:underline" onClick={() => onChange([{ name: "", value: "" }])}>
          + Add
        </button>
      </div>
    );
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {value.map((v, i) => (
        <div key={i} className="border border-line rounded bg-paper p-3">
          <input
            readOnly={readOnly}
            className="w-full bg-transparent text-[13px] text-muted font-semibold focus:outline-none"
            value={v.name}
            placeholder="Name"
            onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
          />
          <input
            readOnly={readOnly}
            className="w-full bg-transparent font-serif text-[22px] tabular focus:outline-none"
            value={v.value}
            placeholder="Value"
            onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))}
          />
        </div>
      ))}
      {!readOnly && (
        <button type="button" className="border border-dashed border-line-strong rounded text-[14px] font-semibold text-teal min-h-[72px]" onClick={() => onChange([...value, { name: "", value: "" }])}>
          + Add vital
        </button>
      )}
    </div>
  );
}

function MedicationsField({ value, onChange, readOnly }: { value: Medication[]; onChange: (v: Medication[]) => void; readOnly: boolean }) {
  const L = useContext(LabelsCtx);
  const set = (i: number, patch: Partial<Medication>) => onChange(value.map((m, j) => (j === i ? { ...m, ...patch } : m)));
  return (
    <div className="space-y-3">
      {!value.length && <p className="italic text-muted text-[17px]">{L.noMedicines}</p>}
      {value.map((m, i) => (
        <div key={i} className={`border rounded p-4 ${m.uncertain ? "border-clay-bright bg-clay-tint/70" : "border-line bg-paper"}`}>
          <div className="flex items-start gap-3">
            <span className="w-8 h-8 rounded-full bg-clay-tint text-clay text-[14px] font-bold flex items-center justify-center shrink-0 mt-1">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <input
                readOnly={readOnly}
                className="w-full bg-transparent font-semibold text-[18px] focus:outline-none border-b border-transparent focus:border-teal py-1"
                value={m.name}
                placeholder="Medicine name and strength"
                onChange={(e) => set(i, { name: e.target.value })}
              />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                {(
                  [
                    ["dose", L.dose],
                    ["frequency", L.howOften],
                    ["timing", L.when],
                    ["duration", L.forHowLong],
                  ] as const
                ).map(([k, label]) => (
                  <label key={k} className="block">
                    <span className="block text-[12px] font-semibold text-muted">{label}</span>
                    <input
                      readOnly={readOnly}
                      className="w-full bg-card border border-line rounded px-2 py-1.5 text-[15px] focus:outline-none focus:border-teal"
                      value={m[k]}
                      placeholder="—"
                      onChange={(e) => set(i, { [k]: e.target.value })}
                    />
                  </label>
                ))}
              </div>
              <input
                readOnly={readOnly}
                className="w-full bg-transparent text-[15px] text-ink-soft mt-2 focus:outline-none border-b border-transparent focus:border-teal py-1"
                value={m.instructions}
                placeholder="Special instructions (optional)"
                onChange={(e) => set(i, { instructions: e.target.value })}
              />
              {m.uncertain && !readOnly && (
                <div className="flex flex-wrap items-center gap-3 mt-3">
                  <span className="stamp text-clay">Please check</span>
                  <button type="button" className="btn btn-ghost min-h-[40px] text-[14px] px-3" onClick={() => set(i, { uncertain: false })}>
                    <CircleCheck size={16} className="text-teal" /> Looks right
                  </button>
                </div>
              )}
            </div>
            {!readOnly && (
              <button type="button" aria-label={`Remove ${m.name || "medicine"}`} className="w-10 h-10 flex items-center justify-center text-muted hover:text-clay" onClick={() => onChange(value.filter((_, j) => j !== i))}>
                <Trash2 size={18} />
              </button>
            )}
          </div>
        </div>
      ))}
      {!readOnly && (
        <button type="button" className="btn btn-ghost min-h-[44px]" onClick={() => onChange([...value, emptyMedication()])}>
          <Plus size={17} /> Add medicine
        </button>
      )}
    </div>
  );
}
