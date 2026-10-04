"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Mic, Search } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { listConsultations, listPatients } from "@/lib/db";
import { formatDate } from "@/lib/report";
import type { Consultation, Patient } from "@/lib/types";

export default function PatientsPage() {
  const [patients, setPatients] = useState<Patient[] | null>(null);
  const [visits, setVisits] = useState<Consultation[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    Promise.all([listPatients(), listConsultations()]).then(([p, c]) => {
      setPatients(p);
      setVisits(c);
    });
  }, []);

  const rows = useMemo(() => {
    if (!patients) return [];
    const needle = q.trim().toLowerCase();
    return patients
      .map((p) => {
        const mine = visits.filter((v) => v.patientId === p.id);
        return { p, count: mine.length, last: mine[0], drafts: mine.filter((v) => v.status !== "signed").length };
      })
      .filter(({ p, last }) => {
        if (!needle) return true;
        const hay = [p.name, p.phone, last?.report?.provisional_diagnosis, ...(last?.report?.medications.map((m) => m.name) ?? [])]
          .join(" ")
          .toLowerCase();
        return hay.includes(needle);
      })
      .sort((a, b) => (b.last?.createdAt ?? b.p.createdAt) - (a.last?.createdAt ?? a.p.createdAt));
  }, [patients, visits, q]);

  return (
    <>
      <SiteHeader />
      <main className="flex-1 paper-grain">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
          <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
            <div>
              <h1 className="font-serif text-[40px] leading-tight">Patients</h1>
              <p className="text-[17px] text-ink-soft">Saved on this device only.</p>
            </div>
            <Link href="/consult/new" className="btn btn-primary">
              <Mic size={18} /> New consultation
            </Link>
          </div>

          <label className="relative block mb-6">
            <Search size={19} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
            <input className="field pl-12 py-3.5 text-[18px]" placeholder="Search by name, phone, diagnosis or medicine" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>

          {patients === null ? null : !patients.length ? (
            <div className="bg-card border border-dashed border-line-strong rounded-lg p-12 text-center">
              <p className="font-serif text-[26px]">No patients yet.</p>
              <p className="text-ink-soft mt-2 mb-6">Record a consultation, or try the demo to see how it works.</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link href="/consult/new?demo=1" className="btn btn-primary">Try the demo</Link>
                <Link href="/consult/new" className="btn btn-ghost">Record a consultation</Link>
              </div>
            </div>
          ) : (
            <ul className="bg-card border border-line rounded-lg divide-y divide-line">
              {rows.map(({ p, count, last, drafts }) => (
                <li key={p.id}>
                  <Link href={`/patients/${p.id}`} className="flex items-center gap-4 px-5 py-4 hover:bg-linen/60 transition-colors">
                    <span className="w-12 h-12 rounded-full bg-teal-tint text-teal-deep font-serif text-[20px] flex items-center justify-center shrink-0">
                      {initials(p.name)}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block font-semibold text-[18px] truncate">{p.name}</span>
                      <span className="block text-[15px] text-ink-soft truncate">
                        {[p.age && `${p.age} yrs`, p.sex, last?.report?.provisional_diagnosis].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <span className="hidden sm:block text-right text-[14px] text-muted">
                      <span className="block">{count} {count === 1 ? "visit" : "visits"}</span>
                      {last && <span className="block">Last: {formatDate(last.createdAt)}</span>}
                    </span>
                    {drafts > 0 && <span className="stamp text-clay">{drafts} draft</span>}
                    <ChevronRight size={20} className="text-muted" />
                  </Link>
                </li>
              ))}
              {!rows.length && <li className="px-5 py-8 text-center text-muted">No match for &ldquo;{q}&rdquo;.</li>}
            </ul>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}
