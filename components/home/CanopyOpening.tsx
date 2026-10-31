"use client";

import { useEffect, useRef, useState } from "react";
import CanopyField from "./CanopyField";

/* ------------------------------------------------------------------
   CanopyOpening — the door.

   A fixed, full-viewport layer: the living canopy with the wordmark
   and the one statement in its clearing. The page beneath starts one
   viewport down. Scrolling the first screen draws the canopy away
   like a curtain (opacity 1 → 0, the words lifting a little faster
   than the page); once gone it is removed from hit-testing. No pin,
   no scrub library — scroll stays scroll, on every device.
   ------------------------------------------------------------------ */

const techFont = "var(--tech-font, 'VT323'), monospace";
const imperial = "'Cinzel', 'Times New Roman', serif";

export default function CanopyOpening() {
  const ref = useRef<HTMLDivElement>(null);
  const words = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const el = ref.current, w = words.current;
    if (!el || !w) return;
    const t = window.setTimeout(() => setReady(true), 300);
    document.documentElement.dataset.snap = "y";
    let raf = 0;
    const update = () => {
      const vh = window.innerHeight;
      const p = Math.min(1, Math.max(0, window.scrollY / (vh * 0.85)));
      const o = 1 - p * p; // ease: holds, then lets go
      el.style.opacity = o.toFixed(3);
      el.style.visibility = p >= 1 ? "hidden" : "visible";
      setGone(p >= 1);
      w.style.transform = `translate3d(0, ${(-window.scrollY * 0.35).toFixed(1)}px, 0)`;
      raf = 0;
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => { delete document.documentElement.dataset.snap; window.clearTimeout(t); cancelAnimationFrame(raf); window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); };
  }, []);

  return (
    <div ref={ref} aria-label="Binary 1702 — Building the Eighth Wonder of the World" style={{ position: "fixed", inset: 0, zIndex: 60, background: "#000", color: "#F2EFE7", overflow: "hidden" }}>
      <CanopyField active={!gone} />

      <div
        ref={words}
        style={{
          position: "absolute", inset: 0, display: "grid", placeContent: "center", justifyItems: "center", gap: 18,
          textAlign: "center", padding: "0 24px", pointerEvents: "none", willChange: "transform",
        }}
      >
        <div
          aria-hidden="true"
          style={{
            position: "absolute", left: "50%", top: "50%", width: "min(96vw, 1000px)", height: "60vh", transform: "translate(-50%, -50%)",
            background: "radial-gradient(ellipse at center, rgba(0,0,0,.94) 0%, rgba(0,0,0,.82) 34%, rgba(0,0,0,.45) 58%, rgba(0,0,0,0) 74%)",
          }}
        />
        <div
          style={{
            position: "relative", fontFamily: techFont, fontWeight: 500, fontSize: "clamp(11px, 1vw, 13px)", letterSpacing: ".46em",
            textTransform: "uppercase", textIndent: ".46em", color: "rgba(242,239,231,.72)", textShadow: "0 0 20px rgba(0,0,0,1)",
            opacity: ready ? 1 : 0, transition: "opacity 2.4s ease .6s",
          }}
        >
          <span style={{ color: "#B9AEE6" }}>Binary</span> 1702
        </div>

        {/* Imperial Typography — Monumental Cinzel */}
        <h1
          style={{
            position: "relative",
            margin: 0,
            textAlign: "center",
            maxWidth: "18ch",
            textWrap: "balance",
            textShadow: "0 1px 0 rgba(0,0,0,.6), 0 0 30px rgba(0,0,0,.95), 0 0 100px rgba(0,0,0,.9)",
            opacity: ready ? 1 : 0,
            transform: ready ? "none" : "translateY(8px)",
            transition: "opacity 2.6s ease 1.4s, transform 2.6s ease 1.4s",
          }}
        >
          <span style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
            {/* BUILDING THE */}
            <span style={{
              fontFamily: imperial,
              fontWeight: 500,
              fontSize: "clamp(1rem, 2.2vw, 1.8rem)",
              lineHeight: 1.1,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "rgba(242,239,231,0.65)",
              marginBottom: "0.3em",
            }}>
              Building the
            </span>

            {/* EIGHTH WONDER — THE MONUMENT */}
            <span style={{
              fontFamily: imperial,
              fontWeight: 700,
              fontSize: "clamp(3rem, 9vw, 8rem)",
              lineHeight: 0.9,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "#F2EFE7",
              textShadow: `
                0 0 60px rgba(185,174,230,0.3),
                0 0 120px rgba(185,174,230,0.15),
                0 2px 0 rgba(0,0,0,.8)
              `,
              marginBottom: "0.25em",
            }}>
              Eighth Wonder
            </span>

            {/* OF THE WORLD */}
            <span style={{
              fontFamily: imperial,
              fontWeight: 500,
              fontSize: "clamp(1.2rem, 2.8vw, 2.2rem)",
              lineHeight: 1.1,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "rgba(242,239,231,0.65)",
            }}>
              of the World.
            </span>
          </span>
        </h1>
      </div>

      <div
        aria-hidden="true"
        style={{
          position: "absolute", left: 0, right: 0, bottom: "max(26px, env(safe-area-inset-bottom))", textAlign: "center",
          fontFamily: techFont, fontSize: 10, letterSpacing: ".34em", textTransform: "uppercase", color: "rgba(242,239,231,.32)",
          opacity: ready ? 1 : 0, transition: "opacity 2s ease 4s", pointerEvents: "none",
        }}
      >
        Scroll
      </div>
    </div>
  );
}
