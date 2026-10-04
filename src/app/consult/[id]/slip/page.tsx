"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Printer } from "lucide-react";
import { getConsultation, getPatient } from "@/lib/db";
import { formatDate } from "@/lib/report";
import type { Consultation, Patient } from "@/lib/types";
import { labels, sexLabel } from "@/lib/i18n";

// A print-ready A4 slip the patient takes home. "Save as PDF" in the print
// dialog gives the PDF — no PDF library needed.
export default function SlipPage() {
  const { id } = useParams<{ id: string }>();
  const [c, setC] = useState<Consultation | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    (async () => {
      const consult = await getConsultation(id);
      if (!consult?.report) return setMissing(true);
      setC(consult);
      setPatient((await getPatient(consult.patientId)) ?? null);
    })();
  }, [id]);

  if (missing)
    return (
      <main className="flex-1 flex items-center justify-center p-10 text-center">
        <p className="font-serif text-[26px]">This report isn&apos;t on this device.</p>
      </main>
    );
  if (!c?.report) return null;
  const r = c.report;
  const L = labels(c.reportLanguage);

  return (
    <main className="flex-1 bg-linen print:bg-white py-8 print:py-0" lang={c.reportLanguage === "hi" ? "hi" : "en"}>
      <div className="no-print max-w-[820px] mx-auto px-4 mb-5 flex justify-between items-center">
        <Link href={`/consult/${c.id}`} className="inline-flex items-center gap-2 text-[15px] font-semibold text-teal hover:underline">
          <ArrowLeft size={16} /> Back to report
        </Link>
        <button className="btn btn-primary" onClick={() => window.print()}>
          <Printer size={18} /> Print or save as PDF
        </button>
      </div>

      <article className="print-sheet max-w-[820px] mx-auto bg-card border border-line rounded-lg p-8 sm:p-12 sheet-shadow">
        <header className="flex justify-between items-start gap-6 border-b-2 border-ink pb-5">
          <div>
            <p className="font-serif text-[30px] leading-tight">{c.clinicName || c.doctorName}</p>
            {c.clinicName && <p className="text-[16px] text-ink-soft">{c.doctorName}</p>}
          </div>
          <div className="text-right text-[15px]">
            <p className="font-semibold">{formatDate(c.createdAt, true)}</p>
            {c.status === "signed" ? (
              <p className="text-teal font-semibold">{L.signedByDoctor}</p>
            ) : (
              <p className="text-clay font-semibold">{L.draftNotSigned}</p>
            )}
          </div>
        </header>

        <section className="py-4 border-b border-line flex flex-wrap gap-x-8 gap-y-1 text-[16px]">
          <p>
            <span className="text-muted">{L.patient}: </span>
            <strong>{patient?.name}</strong>
          </p>
          {patient?.age && (
            <p>
              <span className="text-muted">{L.age}: </span>
              {patient.age}
            </p>
          )}
          {patient?.sex && (
            <p>
              <span className="text-muted">{L.sex}: </span>
              {sexLabel(patient.sex, c.reportLanguage)}
            </p>
          )}
          {r.allergies && (
            <p className="text-clay font-semibold">
              <span>{L.allergy}: </span>
              {r.allergies}
            </p>
          )}
        </section>

        {r.patient_summary && (
          <section className="my-6 p-5 bg-sage rounded border border-[#d5e5dc] print:border-ink/20">
            <h2 className="text-[13px] font-bold uppercase tracking-[0.1em] text-teal mb-1">{L.simpleWords}</h2>
            <p className="font-serif text-[19px] leading-relaxed">{r.patient_summary}</p>
          </section>
        )}

        <Block title={L.diagnosis}>{r.provisional_diagnosis && <p className="font-semibold text-[18px]">{r.provisional_diagnosis}</p>}</Block>
        <Block title={L.complaints}>{r.chief_complaints.length > 0 && <Bullets items={r.chief_complaints} />}</Block>
        <Block title={L.findings}>
          {(r.vitals.length > 0 || r.examination) && (
            <>
              {r.vitals.length > 0 && (
                <p className="tabular">{r.vitals.map((v) => `${v.name}: ${v.value}`).join("  ·  ")}</p>
              )}
              {r.examination && <p>{r.examination}</p>}
            </>
          )}
        </Block>

        <Block title={L.medications}>
          {r.medications.length > 0 && (
            <table className="w-full text-[16px] border-collapse">
              <thead>
                <tr className="text-left text-[13px] text-muted border-b border-line">
                  <th className="py-2 pr-3 font-semibold">#</th>
                  <th className="py-2 pr-3 font-semibold">{L.medicine}</th>
                  <th className="py-2 pr-3 font-semibold">{L.dose}</th>
                  <th className="py-2 pr-3 font-semibold">{L.howOften}</th>
                  <th className="py-2 pr-3 font-semibold">{L.when}</th>
                  <th className="py-2 font-semibold">{L.for}</th>
                </tr>
              </thead>
              <tbody>
                {r.medications.map((m, i) => (
                  <tr key={i} className="border-b border-line align-top">
                    <td className="py-2.5 pr-3 tabular">{i + 1}</td>
                    <td className="py-2.5 pr-3">
                      <strong>{m.name}</strong>
                      {m.instructions && <span className="block text-[14px] text-ink-soft">{m.instructions}</span>}
                    </td>
                    <td className="py-2.5 pr-3">{m.dose}</td>
                    <td className="py-2.5 pr-3">{m.frequency}</td>
                    <td className="py-2.5 pr-3">{m.timing}</td>
                    <td className="py-2.5">{m.duration}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Block>

        <Block title={L.investigations}>{r.investigations.length > 0 && <Bullets items={r.investigations} />}</Block>
        <Block title={L.advice}>{r.advice.length > 0 && <Bullets items={r.advice} />}</Block>

        {r.red_flags.length > 0 && (
          <section className="my-6 p-5 border-2 border-clay-bright rounded">
            <h2 className="text-[13px] font-bold uppercase tracking-[0.1em] text-clay mb-1">{L.red_flags}</h2>
            <Bullets items={r.red_flags} />
          </section>
        )}

        <Block title={L.nextVisit}>{r.follow_up && <p className="font-semibold">{r.follow_up}</p>}</Block>

        <footer className="mt-12 pt-5 border-t border-line flex justify-between items-end gap-6">
          <p className="text-[13px] text-muted max-w-sm">
            {L.slipFooter}
          </p>
          <div className="text-right">
            <p className="font-hand text-[36px] leading-none text-teal">{c.doctorName}</p>
            <p className="text-[13px] text-muted border-t border-ink/40 mt-1 pt-1">{L.signature}</p>
          </div>
        </footer>
      </article>
    </main>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  // Sections with nothing in them are left out of the patient's slip.
  if (!children) return null;
  return (
    <section className="py-3.5 border-b border-line last:border-0 grid sm:grid-cols-[150px_1fr] print:grid-cols-[150px_1fr] gap-1 sm:gap-5 text-[16px]">
      <h2 className="text-[13px] font-bold uppercase tracking-[0.1em] text-muted pt-1">{title}</h2>
      <div className="space-y-1">{children}</div>
    </section>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="list-disc pl-5 space-y-0.5">
      {items.map((t, i) => (
        <li key={i}>{t}</li>
      ))}
    </ul>
  );
}
