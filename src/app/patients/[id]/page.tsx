"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, AudioLines, CircleCheck, FileText, Mic, Pill, Search, TriangleAlert } from "lucide-react";
import { RecordingPlayer } from "@/components/RecordingPlayer";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { getPatient, listConsultations } from "@/lib/db";
import { formatDate } from "@/lib/report";
import type { Consultation, Patient } from "@/lib/types";

export default function PatientHistoryPage() {
  const { id } = useParams<{ id: string }>();
  const [patient, setPatient] = useState<Patient | null | undefined>(undefined);
  const [visits, setVisits] = useState<Consultation[]>([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    getPatient(id).then((p) => setPatient(p ?? null));
    listConsultations(id).then((v) => {
      setVisits(v);
      setOpen(v[0]?.id ?? null);
    });
  }, [id]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return visits;
    return visits.filter((v) => JSON.stringify(v.report ?? {}).toLowerCase().includes(needle));
  }, [visits, q]);

  // Allergies from any visit — the most important thing to carry forward.
  const allergies = useMemo(
    () => [...new Set(visits.map((v) => v.report?.allergies).filter((a): a is string => !!a))],
    [visits],
  );

  if (patient === undefined) return <SiteHeader />;
  if (patient === null)
    return (
      <>
        <SiteHeader />
        <main className="flex-1 flex flex-col items-center justify-center p-10 text-center">
          <p className="font-serif text-[28px]">Patient not found on this device.</p>
          <Link href="/patients" className="btn btn-primary mt-6">All patients</Link>
        </main>
      </>
    );

  return (
    <>
      <SiteHeader />
      <main className="flex-1 paper-grain">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
          <Link href="/patients" className="inline-flex items-center gap-2 text-[15px] font-semibold text-teal hover:underline">
            <ArrowLeft size={16} /> All patients
          </Link>

          <header className="bg-card border border-line rounded-lg p-6 sm:p-8 mt-4 mb-6">
            <div className="flex flex-wrap items-center gap-5">
              <span className="w-16 h-16 rounded-full bg-teal-tint text-teal-deep font-serif text-[26px] flex items-center justify-center">
                {patient.name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("")}
              </span>
              <div className="flex-1 min-w-[200px]">
                <h1 className="font-serif text-[34px] leading-tight">{patient.name}</h1>
                <p className="text-[17px] text-ink-soft">
                  {[patient.age && `${patient.age} years`, patient.sex, patient.phone].filter(Boolean).join(" · ")}
                </p>
              </div>
              <Link href={`/consult/new?patient=${patient.id}`} className="btn btn-primary">
                <Mic size={18} /> New visit
              </Link>
            </div>
            {allergies.length > 0 && (
              <p className="mt-5 flex gap-2 items-start bg-clay-tint border border-[#f1d6c6] text-clay rounded p-3 text-[16px]">
                <TriangleAlert size={20} className="shrink-0 mt-0.5" />
                <span>
                  <strong>Allergy: </strong>
                  {allergies.join("; ")}
                </span>
              </p>
            )}
          </header>

          <label className="relative block mb-6">
            <Search size={19} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
            <input className="field pl-12 py-3.5" placeholder="Search past visits, medicines, symptoms" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>

          <h2 className="font-serif text-[24px] mb-4">
            {visits.length} {visits.length === 1 ? "visit" : "visits"}
          </h2>

          <ol className="relative border-l-2 border-line ml-3 space-y-6">
            {filtered.map((v, i) => {
              const r = v.report;
              const isOpen = open === v.id;
              return (
                <li key={v.id} className="pl-7 relative">
                  <span className={`absolute -left-[9px] top-6 w-4 h-4 rounded-full border-2 border-card ${i === 0 ? "bg-teal" : "bg-line-strong"}`} />
                  <article className="bg-card border border-line rounded-lg">
                    <button className="w-full text-left p-5 sm:p-6" onClick={() => setOpen(isOpen ? null : v.id)} aria-expanded={isOpen}>
                      <div className="flex flex-wrap items-center gap-3 mb-1">
                        <span className="text-[15px] font-semibold text-muted">{formatDate(v.createdAt, true)}</span>
                        {v.status === "signed" ? (
                          <span className="stamp text-teal"><CircleCheck size={12} /> Signed</span>
                        ) : (
                          <span className="stamp text-clay">Draft</span>
                        )}
                        {v.audio && (
                          <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-teal">
                            <AudioLines size={15} /> Recording
                          </span>
                        )}
                      </div>
                      <p className="font-serif text-[24px] leading-tight">{r?.provisional_diagnosis || r?.chief_complaints[0] || "Report not created yet"}</p>
                      <p className="text-[15px] text-ink-soft mt-1">{v.doctorName}{v.clinicName && `, ${v.clinicName}`}</p>
                      {r && r.medications.length > 0 && (
                        <p className="flex flex-wrap gap-2 mt-3">
                          {r.medications.map((m) => (
                            <span key={m.name} className="inline-flex items-center gap-1.5 text-[14px] border border-line rounded px-2 py-1 bg-paper">
                              <Pill size={14} className="text-clay" /> {m.name}
                            </span>
                          ))}
                        </p>
                      )}
                    </button>
                    {isOpen && r && (
                      <div className="border-t border-line px-5 sm:px-6 py-5 space-y-3 text-[16px]">
                        {v.audio && (
                          <div className="pb-2">
                            <p className="text-[13px] font-bold uppercase tracking-[0.08em] text-muted mb-1.5">Listen to the consultation</p>
                            <RecordingPlayer id={v.id} />
                          </div>
                        )}
                        {r.chief_complaints.length > 0 && <Line label="Complaints" text={r.chief_complaints.join("; ")} />}
                        {r.examination && <Line label="Examination" text={r.examination} />}
                        {r.advice.length > 0 && <Line label="Advice" text={r.advice.join("; ")} />}
                        {r.follow_up && <Line label="Follow-up" text={r.follow_up} />}
                        <div className="flex flex-wrap gap-3 pt-2">
                          <Link href={`/consult/${v.id}`} className="btn btn-ghost min-h-[44px]">
                            <FileText size={17} /> Open full report
                          </Link>
                          {v.status === "signed" && (
                            <Link href={`/consult/${v.id}/slip`} className="btn btn-ghost min-h-[44px]">
                              Print slip
                            </Link>
                          )}
                        </div>
                      </div>
                    )}
                    {isOpen && !r && (
                      <div className="border-t border-line px-6 py-5">
                        <Link href={`/consult/${v.id}`} className="btn btn-primary">Create the report</Link>
                      </div>
                    )}
                  </article>
                </li>
              );
            })}
            {!filtered.length && <li className="pl-7 text-muted">No visit matches &ldquo;{q}&rdquo;.</li>}
          </ol>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

function Line({ label, text }: { label: string; text: string }) {
  return (
    <p>
      <span className="text-[13px] font-bold uppercase tracking-[0.08em] text-muted mr-2">{label}</span>
      {text}
    </p>
  );
}
