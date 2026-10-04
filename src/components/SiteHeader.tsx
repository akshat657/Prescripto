"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ExternalLink, Menu, NotebookPen, X } from "lucide-react";
import { GithubIcon } from "./icons";
import { site } from "@/config/site";

const appLinks = [
  { href: "/consult/new", label: "New consultation" },
  { href: "/patients", label: "Patients" },
];

const landingLinks = [
  { href: "/#how", label: "How it works" },
  { href: "/#why", label: "Why I built this" },
  { href: "/#privacy", label: "Privacy" },
];

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-3 group" aria-label={`${site.name} home`}>
      <span className="w-10 h-10 rounded border border-line bg-paper flex items-center justify-center text-teal">
        <NotebookPen size={20} strokeWidth={1.8} />
      </span>
      <span className="font-serif text-[28px] leading-none tracking-tight text-ink group-hover:text-teal transition-colors">
        {site.name}
      </span>
    </Link>
  );
}

export function CreatorAvatar({ size = 44 }: { size?: number }) {
  return (
    <a
      href={site.creator.portfolio}
      target="_blank"
      rel="noopener noreferrer"
      title={`${site.creator.name} — built this`}
      className="relative block rounded-full overflow-hidden ring-[3px] ring-teal ring-offset-2 ring-offset-card shrink-0"
      style={{ width: size, height: size }}
    >
      <Image src={site.creator.photo} alt={`${site.creator.name}, creator of ${site.name}`} fill sizes="88px" className="object-cover" />
    </a>
  );
}

export function SiteHeader({ variant = "app" }: { variant?: "landing" | "app" }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const links = variant === "landing" ? landingLinks : appLinks;

  return (
    <header className="no-print sticky top-0 z-40 bg-card/95 backdrop-blur-[2px] border-b border-line">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 h-[72px] flex items-center justify-between gap-4">
        <Logo />

        <nav className="hidden md:flex items-center gap-8" aria-label="Main">
          {links.map((l) => {
            const active = pathname === l.href || (l.href !== "/" && !l.href.includes("#") && pathname.startsWith(l.href));
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`text-[15px] font-semibold pb-1 border-b-2 transition-colors ${
                  active ? "border-teal text-teal" : "border-transparent text-ink-soft hover:text-ink"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
          {variant === "landing" && (
            <Link href="/consult/new?demo=1" className="btn btn-primary min-h-[42px] text-[15px] px-4">
              Try the demo
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-3">
          <a
            href={site.creator.github}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex items-center gap-1.5 h-11 px-3 border border-line rounded text-[15px] font-semibold hover:bg-linen transition-colors"
          >
            <GithubIcon size={17} /> GitHub
          </a>
          <a
            href={site.creator.portfolio}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden lg:inline-flex items-center gap-1.5 h-11 px-3 border border-line rounded text-[15px] font-semibold hover:bg-linen transition-colors"
          >
            <ExternalLink size={16} /> Portfolio
          </a>
          <CreatorAvatar />
          <button
            className="md:hidden w-11 h-11 flex items-center justify-center border border-line rounded"
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {open && (
        <nav className="md:hidden border-t border-line bg-card px-4 py-3 flex flex-col" aria-label="Mobile">
          {[...links, ...(variant === "landing" ? appLinks : [])].map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="py-3 text-[17px] font-semibold border-b border-line last:border-0">
              {l.label}
            </Link>
          ))}
          <div className="flex gap-3 pt-3">
            <a href={site.creator.github} target="_blank" rel="noopener noreferrer" className="btn btn-ghost flex-1">
              <GithubIcon size={17} /> GitHub
            </a>
            <a href={site.creator.portfolio} target="_blank" rel="noopener noreferrer" className="btn btn-ghost flex-1">
              <ExternalLink size={16} /> Portfolio
            </a>
          </div>
        </nav>
      )}
    </header>
  );
}
