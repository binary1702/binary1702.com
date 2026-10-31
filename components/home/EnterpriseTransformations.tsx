"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import OceanicField from "./OceanicField";
import s from "./enterprise.module.css";

/* ------------------------------------------------------------------
   Enterprise Transformations — cinematic showcase of client work.

   Quiet. Monumental. Expensive. Confident.
   Luxury editorial design meets sophisticated technology.

   A full-viewport carousel over one shared ASCII ocean: each
   transformation is a slide; the numbers top-right (001 · 002 …) are
   the controls. Add a transformation by adding an entry to SLIDES.
   ------------------------------------------------------------------ */

/** caution: a not-yet-live slide — the ocean turns traffic-light yellow */
type Slide = { num: string; name: string; line?: string; href?: string; caution?: boolean };

const SLIDES: Slide[] = [
  { num: "001", name: "Aquatech", line: "Inventory Operations at Scale", href: "/client/aquatech" },
  // placeholder until the next engagement is ready to show; no link on purpose
  { num: "002", name: "Coming Soon", caution: true },
];

export default function EnterpriseTransformations() {
  const ref = useRef<HTMLElement>(null);
  const [live, setLive] = useState(false);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setLive(e.isIntersecting), { rootMargin: "15% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section
      ref={ref}
      id="transformations"
      aria-labelledby="transformations-title"
      aria-roledescription="carousel"
      className={`${s.section} ${live ? s.live : ""} ${SLIDES[index].caution ? s.caution : ""}`}
    >
      {/* Oceanic ASCII backdrop — deep underwater atmosphere, shared by every slide */}
      <div className={s.field}>
        <OceanicField active={live} />
      </div>
      {/* traffic-light yellow wash over the ocean while a not-yet-live slide is showing */}
      <div className={s.cautionTint} aria-hidden="true" />
      <div className={s.scrim} aria-hidden="true" />

      <div className={s.grid}>
        {/* Section label + slide controls */}
        <div className={s.sectionLabel}>
          <span className={s.labelText}>Enterprise Transformations</span>
          <div className={s.pager} role="tablist" aria-label="Transformations">
            {SLIDES.map((sl, i) => (
              <button
                key={sl.num}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-controls={`transformation-${sl.num}`}
                className={s.labelNum}
                onClick={() => setIndex(i)}
              >
                {sl.num}
              </button>
            ))}
          </div>
        </div>

        {/* The slides: a horizontal track, one full-width slide per transformation */}
        <div className={s.viewport}>
          <div className={s.track} style={{ transform: `translateX(-${index * 100}%)` }}>
            {SLIDES.map((sl, i) => {
              const current = i === index;
              return (
                <div
                  key={sl.num}
                  id={`transformation-${sl.num}`}
                  role="tabpanel"
                  aria-roledescription="slide"
                  aria-label={`${sl.num} of ${String(SLIDES.length).padStart(3, "0")}`}
                  aria-hidden={!current}
                  inert={!current}
                  className={s.slide}
                >
                  <div className={s.hero}>
                    <div className={s.heroContent}>
                      <h2 id={i === 0 ? "transformations-title" : undefined} className={s.clientName}>
                        {sl.name}
                      </h2>
                      {sl.line && (
                        <p className={s.heroStatement}>
                          <span className={s.statementLine}>{sl.line}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  <div className={s.context}>
                    {sl.href ? (
                      <Link href={sl.href} className={s.cta}>
                        Explore Case Study
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
                          <path d="M1.5 8.5L8.5 1.5M8.5 1.5H3.5M8.5 1.5V6.5" />
                        </svg>
                      </Link>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
