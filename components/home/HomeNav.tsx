"use client";

import { useState } from "react";
import Link from "next/link";
import s from "@/app/home.module.css";

const links = [
  { href: "#problem", label: "Problem" },
  { href: "#demo", label: "Demo" },
  { href: "#capabilities", label: "Capabilities" },
  { href: "#work", label: "Work" },
  { href: "#engagements", label: "Engagements" },
];

export default function HomeNav() {
  const [open, setOpen] = useState(false);

  return (
    <div className={s.nav}>
      <div className={s.wrap}>
        <div className={s.navRow}>
          <Link href="/" className={s.brand} aria-label="Binary 1702 home">
            <span>Binary</span> 1702
          </Link>

          <nav className={s.navLinks} aria-label="Primary">
            {links.map((l) => (
              <a key={l.href} href={l.href} className={s.navLink}>
                {l.label}
              </a>
            ))}
            <a href="#assessment" className={s.navCta}>
              Request an Assessment
            </a>
          </nav>

          <button
            type="button"
            className={s.burger}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              {open ? (
                <path d="M6 6l12 12M18 6L6 18" />
              ) : (
                <path d="M4 7h16M4 12h16M4 17h16" />
              )}
            </svg>
          </button>
        </div>

        <div id="mobile-menu" className={s.mobileMenu} data-open={open}>
          {links.map((l) => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)}>
              {l.label}
            </a>
          ))}
          <a href="#assessment" onClick={() => setOpen(false)} style={{ color: "var(--accent)" }}>
            Request an Assessment
          </a>
        </div>
      </div>
    </div>
  );
}
