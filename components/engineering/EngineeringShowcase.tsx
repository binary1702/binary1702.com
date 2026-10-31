"use client";

import { useEffect, useRef, useState } from "react";
import s from "./engineering.module.css";
import CanopyField from "@/components/home/CanopyField";
import ProjectSelector from "./ProjectSelector";
import ExhibitStage from "./ExhibitStage";
import type { Project } from "@/lib/projects";

/* ------------------------------------------------------------------
   Section 03 — Selected Work.
   Left: the index and the minimal record. Right: the exhibit — an
   instrument that shows the selected application's underlying
   system. The chapter's ASCII field stays beneath, dimmed. Motion
   runs only while the section is on screen (.live).
   ------------------------------------------------------------------ */

export default function EngineeringShowcase({ projects, src }: { projects: Project[]; src: string }) {
  const ref = useRef<HTMLElement>(null);
  const [live, setLive] = useState(false);
  const [sel, setSel] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const p = projects[sel];

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setLive(e.isIntersecting), { rootMargin: "15% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const choose = (i: number) => {
    if (i === sel) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setSel(i); return; }
    setLeaving(true);
    window.setTimeout(() => { setSel(i); setLeaving(false); }, 200);
  };

  return (
    <section ref={ref} id="engineering" aria-labelledby="engineering-line" className={`${s.section} ${live ? s.live : ""}`}>
      <div className={s.field}><CanopyField src={src} active={live} cycle={false} saturation={1.15} /></div>
      <div className={s.scrim} aria-hidden="true" />

      <div className={s.grid}>
        <div className={s.left}>
          <div className={s.index}>
            <h2 id="engineering-line" className={s.h2}>Selected Works</h2>
            <ProjectSelector projects={projects} selected={sel} onSelect={choose} />
          </div>

          <div className={s.info} aria-live="polite">
            <div className={s.infoTop}>
              {p.url ? (
                <a href={p.url} target="_blank" rel="noopener noreferrer" className={s.enterLink}>Enter System →</a>
              ) : (
                <span className={s.enterDisabled}>Not yet published</span>
              )}
              <p className={s.inquiry}>{p.inquiry}</p>
            </div>
            <div className={s.infoBottom}>
              <div className={s.infoMid}>
                <div>
                  <p className={s.k}>Engineering</p>
                  <ul className={s.narrCaps}>
                    {p.instruments.map((c) => <li key={c}>{c}</li>)}
                  </ul>
                </div>
                <div>
                  <p className={s.k}>Technology</p>
                  <ul className={`${s.narrCaps} ${s.tech}`}>
                    {p.technology.map((c) => <li key={c}>{c}</li>)}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        <ExhibitStage project={p} leaving={leaving} />
      </div>
    </section>
  );
}
