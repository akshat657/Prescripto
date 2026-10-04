import Link from "next/link";
import { site } from "@/config/site";

export function SiteFooter() {
  return (
    <footer className="no-print border-t border-line bg-card">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-10 flex flex-col md:flex-row justify-between gap-6">
        <div className="max-w-xl">
          <p className="font-serif text-2xl">{site.name}</p>
          <p className="text-[16px] text-ink-soft mt-1">
            Made with care in India by{" "}
            <a href={site.creator.portfolio} target="_blank" rel="noopener noreferrer" className="font-semibold text-teal hover:underline">
              {site.creator.name}
            </a>
            .
          </p>
          <p className="text-[14px] text-muted mt-3">
            Yaad is a documentation aid, not a medical device. Every report is reviewed and signed by the doctor. Always follow
            your doctor&apos;s advice.
          </p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-[15px] font-semibold text-ink-soft md:justify-end md:items-start" aria-label="Footer">
          <Link href="/consult/new" className="hover:text-teal">New consultation</Link>
          <Link href="/patients" className="hover:text-teal">Patients</Link>
          <Link href="/#privacy" className="hover:text-teal">Privacy</Link>
          <a href={site.creator.repo} target="_blank" rel="noopener noreferrer" className="hover:text-teal">GitHub</a>
          <a href={site.creator.portfolio} target="_blank" rel="noopener noreferrer" className="hover:text-teal">Portfolio</a>
        </nav>
      </div>
    </footer>
  );
}
