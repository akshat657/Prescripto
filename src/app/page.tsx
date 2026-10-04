import Image from "next/image";
import Link from "next/link";
import {
  AudioLines,
  CircleCheck,
  ClipboardList,
  FileText,
  HeartHandshake,
  Languages,
  Lock,
  Mic,
  PenLine,
  ShieldCheck,
  Stethoscope,
  UserRound,
} from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { GithubIcon } from "@/components/icons";
import { site } from "@/config/site";
import { SAMPLE_PATIENT, SAMPLE_REPORT } from "@/lib/sample";

export default function Home() {
  return (
    <>
      <SiteHeader variant="landing" />
      <main className="flex-1 paper-grain">
        <Hero />
        <Numbers />
        <Story />
        <HowItWorks />
        <SampleReport />
        <BothSides />
        <Privacy />
        <FinalCta />
      </main>
      <SiteFooter />
    </>
  );
}

function Hero() {
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 pt-14 pb-20 lg:pt-24 lg:pb-28" id="top">
      <div className="grid lg:grid-cols-12 gap-14 lg:gap-16 items-center">
        <div className="lg:col-span-7">
          <span className="stamp text-clay">For Indian clinics · Hindi + English</span>
          <h1 className="font-serif text-[40px] leading-[1.12] sm:text-[54px] sm:leading-[1.08] tracking-[-0.02em] mt-6 mb-7">
            Remember everything your doctor{" "}
            <span className="ink-underline text-clay italic">told you.</span>
          </h1>
          <p className="text-[20px] leading-[1.6] text-ink-soft max-w-2xl mb-10">
            {site.name} listens quietly during the consultation and writes a clear report — so the doctor can look at the patient,
            not the paper, and the patient goes home knowing exactly what to do.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link href="/consult/new?demo=1" className="btn btn-primary min-h-[54px] px-8 text-[17px]">
              <Mic size={20} /> Try the demo
            </Link>
            <Link href="#sample" className="btn btn-ghost min-h-[54px] px-8 text-[17px]">
              <FileText size={20} className="text-teal" /> See a sample report
            </Link>
          </div>
          <ul className="flex flex-wrap gap-x-7 gap-y-3 mt-10 pt-6 border-t border-line text-[15px] font-semibold text-ink-soft">
            <li className="flex items-center gap-2">
              <ShieldCheck size={18} className="text-teal" /> Doctor approves every report
            </li>
            <li className="flex items-center gap-2">
              <Languages size={18} className="text-teal" /> Understands Hinglish
            </li>
            <li className="flex items-center gap-2">
              <Lock size={18} className="text-clay" /> Records stay on the doctor&apos;s device
            </li>
          </ul>
        </div>
        <div className="lg:col-span-5">
          <HeroSheets />
        </div>
      </div>
    </section>
  );
}

// The messy paper slip behind, the clean report in front.
function HeroSheets() {
  return (
    <div className="relative max-w-md mx-auto lg:mx-0 pt-6 pl-6 sm:pl-10">
      <div
        aria-hidden="true"
        className="absolute left-0 top-0 w-[62%] bg-[#fffdf6] border border-line rounded p-4 -rotate-6 sheet-shadow"
      >
        <p className="font-hand text-[26px] leading-[1.05] text-[#3b4a7a]">
          Rx
          <br />
          Tab PCM 650 1-1-1 x3d
          <br />
          Tab Cetz 10 HS x5
          <br />
          gargle SOS..
        </p>
        <svg viewBox="0 0 160 30" className="w-full mt-1 text-[#3b4a7a]" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M4 18c14-14 22 10 34-2s18 8 30-4 20 10 34 0 22 6 40-6" strokeLinecap="round" />
        </svg>
      </div>

      <div className="relative bg-card border border-line rounded-lg p-6 sm:p-7 sheet-shadow rotate-[1.2deg]">
        <div className="flex justify-between items-start border-b border-line pb-4 mb-4">
          <div>
            <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-teal">Visit report</p>
            <p className="font-serif text-[22px] leading-tight mt-0.5">{SAMPLE_PATIENT.name}</p>
            <p className="text-[14px] text-muted">46 · Female · Today</p>
          </div>
          <span className="stamp text-teal">
            <CircleCheck size={13} /> Signed
          </span>
        </div>
        <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-muted mb-1">Diagnosis</p>
        <p className="text-[17px] mb-4 pl-3 border-l-2 border-teal">{SAMPLE_REPORT.provisional_diagnosis}</p>
        <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-muted mb-2">Medicines</p>
        <ul className="space-y-2 mb-4">
          {SAMPLE_REPORT.medications.slice(0, 2).map((m, i) => (
            <li key={m.name} className="flex items-center justify-between gap-3 p-2.5 border border-line rounded">
              <span className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-full bg-clay-tint text-clay text-[13px] font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                <span>
                  <span className="block font-semibold text-[15px] leading-tight">{m.name}</span>
                  <span className="block text-[13px] text-ink-soft">
                    {m.frequency} · {m.timing}
                  </span>
                </span>
              </span>
              <span className="text-[12px] font-semibold text-teal border border-line rounded px-2 py-1 tabular">{m.duration}</span>
            </li>
          ))}
        </ul>
        <div className="bg-clay-tint/60 border border-[#f1d6c6] rounded p-3 text-[14px]">
          <span className="font-bold text-clay">Come back if: </span>
          {SAMPLE_REPORT.red_flags.slice(0, 2).join(" · ").toLowerCase()}
        </div>
        <div className="flex items-end justify-between mt-5 pt-4 border-t border-line">
          <div>
            <p className="font-hand text-[30px] leading-none text-teal -rotate-2">Dr. A. Mehra</p>
            <p className="text-[12px] text-muted mt-1">Reviewed &amp; signed</p>
          </div>
          <Stethoscope size={30} strokeWidth={1.2} className="text-line-strong" />
        </div>
      </div>
    </div>
  );
}

function Numbers() {
  const items = [
    { n: "60–100", t: "patients a busy doctor can see in a day", c: "text-teal" },
    { n: "1", t: "small slip of paper to remember it all", c: "text-clay" },
    { n: "0", t: "records of what was actually said, once you leave the room", c: "text-teal" },
  ];
  return (
    <section className="border-y border-line bg-card">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-12 grid md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-line">
        {items.map((i) => (
          <div key={i.n} className="py-6 md:py-0 md:px-10 first:md:pl-0">
            <p className={`font-serif text-[52px] leading-none ${i.c}`}>{i.n}</p>
            <p className="text-[18px] text-ink-soft mt-3 max-w-xs">{i.t}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Story() {
  return (
    <section id="why" className="bg-peach border-b border-line scroll-mt-20">
      <div className="max-w-[760px] mx-auto px-4 sm:px-6 py-20 lg:py-28">
        <article className="stationery bg-card rounded p-7 sm:p-12 lg:p-14">
          <header className="flex items-center gap-5 border-b border-line pb-7 mb-9">
            <div className="relative w-20 h-20 rounded-full overflow-hidden ring-[3px] ring-teal ring-offset-2 ring-offset-card shrink-0">
              <Image src={site.creator.photo} alt={site.creator.name} fill sizes="160px" className="object-cover" />
            </div>
            <div>
              <p className="text-[13px] font-bold uppercase tracking-[0.12em] text-clay">A personal note</p>
              <h2 className="font-serif text-[34px] leading-tight">Why I built this</h2>
            </div>
          </header>

          <div className="space-y-6 text-[19px] leading-[1.75] text-ink">
            <p>
              A few days ago, I sat in a doctor&apos;s clinic. He listened, examined me, and explained what was wrong and what I needed
              to do. I nodded. I understood. I walked out feeling taken care of.
            </p>
            <p className="font-serif text-[24px] leading-snug">Two days later, I couldn&apos;t remember half of it.</p>
            <p className="text-ink-soft italic">
              Was it twice a day or three times? Before food or after? What was that one thing he told me to avoid?
            </p>
            <p>
              All I had was a prescription slip with a few medicine names scribbled on it. Everything else — the reasons, the
              warnings, the <em>&ldquo;come back if this happens&rdquo;</em> — was gone.
            </p>
            <p>
              And it isn&apos;t just me. Months later the same problem comes back, and we sit in front of the doctor again, trying to
              remember what they told us last time. Nobody has it written down.
            </p>
            <p>
              In India, a doctor may see 60, 80, sometimes 100 patients in a day. They simply cannot write everything down. So the
              most important part of the visit — the conversation — disappears the moment we leave the room.
            </p>

            <blockquote className="my-10 pl-6 border-l-4 border-clay-bright py-1">
              <p className="font-serif italic text-[28px] leading-snug">
                &ldquo;The doctor remembered to tell me. I just had no way to remember it.&rdquo;
              </p>
            </blockquote>

            <p>
              So I built <strong className="font-semibold">{site.name}</strong> — Hindi for <em>memory</em>. It listens quietly
              during the consultation and turns it into a clear, organised report. The doctor checks it and signs it. The patient
              takes it home. Nothing important gets lost.
            </p>
            <p className="font-serif text-[23px] leading-snug">
              The doctor gets to look at the patient instead of the paper. And the patient gets to remember.
            </p>
          </div>

          <footer className="mt-12 pt-8 border-t border-line flex flex-col sm:flex-row sm:items-end justify-between gap-6">
            <div>
              <p className="font-hand text-[44px] leading-none text-teal -rotate-2">— {site.creator.name}</p>
              <p className="text-[15px] text-muted mt-2">{site.creator.role}</p>
            </div>
            <div className="flex gap-3">
              <a href={site.creator.github} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">
                <GithubIcon size={17} /> GitHub
              </a>
              <a href={site.creator.portfolio} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">
                Portfolio
              </a>
            </div>
          </footer>
        </article>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { icon: Mic, title: "Record", body: "The doctor taps one big button, with the patient's consent. Then just talk — normally." },
    { icon: AudioLines, title: "Transcribe", body: "Speech turns into text as you talk, in Hindi, English or a mix of both." },
    { icon: ClipboardList, title: "Organise", body: "Complaints, findings, diagnosis and medicines are sorted into a clean report." },
    { icon: PenLine, title: "Review & sign", body: "The doctor checks every line, fixes anything, and signs. Only then is it final." },
  ];
  return (
    <section id="how" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-20 lg:py-28 scroll-mt-20">
      <div className="max-w-2xl mb-14">
        <span className="stamp text-teal">How it works</span>
        <h2 className="font-serif text-[38px] sm:text-[44px] leading-tight mt-4">Four steps. No training needed.</h2>
        <p className="text-[19px] text-ink-soft mt-3">Works on the laptop, tablet or phone already on the doctor&apos;s desk.</p>
      </div>
      <ol className="relative grid md:grid-cols-4 gap-6">
        <svg
          aria-hidden="true"
          className="hidden md:block absolute top-[34px] left-[8%] w-[84%] h-6 text-line-strong"
          viewBox="0 0 800 24"
          preserveAspectRatio="none"
          fill="none"
        >
          <path d="M0 12 C 100 2, 160 22, 266 12 S 430 2, 533 12 S 700 22, 800 12" stroke="currentColor" strokeWidth="2" strokeDasharray="2 9" strokeLinecap="round" />
        </svg>
        {steps.map((s, i) => (
          <li key={s.title} className="relative">
            <div className="w-[68px] h-[68px] rounded-full bg-card border border-line flex items-center justify-center text-teal mb-5 relative">
              <s.icon size={28} strokeWidth={1.6} />
              <span className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-clay-bright text-white text-[13px] font-bold flex items-center justify-center">
                {i + 1}
              </span>
            </div>
            <h3 className="font-serif text-[26px] mb-2">{s.title}</h3>
            <p className="text-[17px] text-ink-soft">{s.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid sm:grid-cols-[190px_1fr] gap-1 sm:gap-6 py-4 border-b border-line last:border-0">
      <p className="text-[13px] font-bold uppercase tracking-[0.1em] text-muted pt-1">{label}</p>
      <div className="text-[17px]">{children}</div>
    </div>
  );
}

function SampleReport() {
  const r = SAMPLE_REPORT;
  return (
    <section id="sample" className="bg-sage border-y border-line scroll-mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-20 lg:py-28 grid lg:grid-cols-12 gap-12">
        <div className="lg:col-span-4">
          <span className="stamp text-teal">Sample report</span>
          <h2 className="font-serif text-[38px] leading-tight mt-4">What the patient takes home.</h2>
          <p className="text-[19px] text-ink-soft mt-4">
            Made from a 2-minute Hinglish consultation. Every line can be traced back to what was said.
          </p>
          <p className="text-[19px] text-ink-soft mt-4">
            If the doctor didn&apos;t say it, it says <span className="italic text-muted">&ldquo;Not mentioned&rdquo;</span>. {site.name}{" "}
            never fills in the blanks itself.
          </p>
          <Link href="/consult/new?demo=1" className="btn btn-primary mt-8">
            Try it with this consultation
          </Link>
        </div>
        <div className="lg:col-span-8 bg-card border border-line rounded-lg p-6 sm:p-9 sheet-shadow relative">
          <span className="stamp text-teal absolute top-6 right-6 rotate-3">
            <CircleCheck size={13} /> Doctor verified
          </span>
          <p className="text-[13px] font-bold uppercase tracking-[0.12em] text-teal">Visit report</p>
          <p className="font-serif text-[30px] leading-tight mt-1">{SAMPLE_PATIENT.name}</p>
          <p className="text-[16px] text-muted mb-6">46 years · Female</p>
          <Row label="Complaints">
            <ul className="list-disc pl-5 space-y-1">
              {r.chief_complaints.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </Row>
          <Row label="Examination">{r.examination}</Row>
          <Row label="Diagnosis">
            <span className="font-semibold">{r.provisional_diagnosis}</span>
          </Row>
          <Row label="Medicines">
            <div className="overflow-x-auto">
              <table className="w-full text-[16px] min-w-[460px]">
                <thead>
                  <tr className="text-left text-[13px] text-muted">
                    <th className="font-semibold pb-2">Medicine</th>
                    <th className="font-semibold pb-2">How often</th>
                    <th className="font-semibold pb-2">When</th>
                    <th className="font-semibold pb-2">For</th>
                  </tr>
                </thead>
                <tbody>
                  {r.medications.map((m) => (
                    <tr key={m.name} className="border-t border-line">
                      <td className="py-2 font-semibold pr-3">{m.name}</td>
                      <td className="py-2 pr-3">{m.frequency}</td>
                      <td className="py-2 pr-3">{m.timing}</td>
                      <td className="py-2">{m.duration}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Row>
          <Row label="Advice">
            <ul className="list-disc pl-5 space-y-1">
              {r.advice.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </Row>
          <Row label="Past illnesses">
            <span className="italic text-muted">Not mentioned</span>
          </Row>
          <Row label="Follow-up">{r.follow_up}</Row>
        </div>
      </div>
    </section>
  );
}

function BothSides() {
  const cols = [
    {
      icon: Stethoscope,
      tint: "text-teal",
      kicker: "For doctors",
      title: "Less writing. More looking up.",
      points: [
        ["Eye contact, not pen contact", "Talk to the patient the whole time. The note writes itself."],
        ["Complete notes", "Complaints, findings, medicines and advice — nothing skipped when the queue is long."],
        ["You stay in control", "Edit anything. Nothing is final until you sign it."],
      ],
    },
    {
      icon: HeartHandshake,
      tint: "text-clay",
      kicker: "For patients",
      title: "Go home knowing what to do.",
      points: [
        ["A report you can read", "Clear print, plain words — easy for parents and grandparents too."],
        ["No more forgetting", "Which medicine, how often, before or after food — all written down."],
        ["Ready for next time", "Your past visits are there when the same problem comes back."],
      ],
    },
  ];
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-20 lg:py-28">
      <h2 className="font-serif text-[38px] sm:text-[44px] leading-tight text-center mb-14">Built for both sides of the table</h2>
      <div className="grid md:grid-cols-2 gap-8">
        {cols.map((c) => (
          <div key={c.kicker} className="bg-card border border-line rounded-lg p-7 sm:p-10">
            <div className="flex items-center gap-4 mb-7">
              <span className={`w-12 h-12 rounded border border-line bg-paper flex items-center justify-center ${c.tint}`}>
                <c.icon size={24} strokeWidth={1.6} />
              </span>
              <div>
                <p className={`text-[13px] font-bold uppercase tracking-[0.12em] ${c.tint}`}>{c.kicker}</p>
                <h3 className="font-serif text-[26px] leading-tight">{c.title}</h3>
              </div>
            </div>
            <ul className="space-y-5">
              {c.points.map(([t, b]) => (
                <li key={t} className="flex gap-3">
                  <CircleCheck size={22} className={`${c.tint} shrink-0 mt-0.5`} />
                  <span className="text-[17px]">
                    <strong className="font-semibold">{t}.</strong> <span className="text-ink-soft">{b}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function Privacy() {
  const items = [
    { icon: UserRound, t: "Consent first", b: "Recording only starts after the doctor confirms the patient has agreed." },
    { icon: PenLine, t: "Doctor signs every report", b: "Yaad writes a draft. The doctor decides what is true." },
    {
      icon: Lock,
      t: "Stays on this device",
      b: "Reports — and the recording, if the patient agrees — are saved in the doctor's own browser, not on our server.",
    },
  ];
  return (
    <section id="privacy" className="max-w-4xl mx-auto px-4 sm:px-6 pb-20 lg:pb-28 scroll-mt-24">
      <div className="border-2 border-dashed border-line-strong bg-card rounded-lg p-7 sm:p-12">
        <div className="flex items-center gap-5 mb-6">
          <span className="w-14 h-14 rounded border border-teal text-teal flex items-center justify-center shrink-0">
            <ShieldCheck size={28} strokeWidth={1.6} />
          </span>
          <h2 className="font-serif text-[32px] leading-tight">Health conversations are private.</h2>
        </div>
        <div className="grid sm:grid-cols-3 gap-7 pt-6 border-t border-line">
          {items.map((i) => (
            <div key={i.t}>
              <i.icon size={22} className="text-teal mb-2" />
              <p className="font-semibold text-[17px] mb-1">{i.t}</p>
              <p className="text-[16px] text-ink-soft">{i.b}</p>
            </div>
          ))}
        </div>
        <p className="text-[14px] text-muted mt-8">
          Audio and transcript are sent to the speech and language models only to create the report. This free version is meant for
          demos and consented test recordings — please don&apos;t use it for real patients yet.
        </p>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="border-t border-line bg-card">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-20 text-center">
        <h2 className="font-serif text-[40px] sm:text-[46px] leading-tight">Hear it for yourself.</h2>
        <p className="text-[20px] text-ink-soft mt-4 mb-10">
          Run a sample Hinglish consultation through {site.name} and see the report it writes. Takes under a minute.
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <Link href="/consult/new?demo=1" className="btn btn-primary min-h-[56px] px-10 text-[17px]">
            <Mic size={20} /> Try the demo
          </Link>
          <Link href="/consult/new" className="btn btn-ghost min-h-[56px] px-8 text-[17px]">
            Record a real consultation
          </Link>
        </div>
      </div>
    </section>
  );
}
