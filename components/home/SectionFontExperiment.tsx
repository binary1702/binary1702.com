"use client";

import { useState, useEffect } from "react";

/* ------------------------------------------------------------------
   SectionFontExperiment — Toggle between 1980s retro fonts.

   Press 1-5 to switch fonts, H to hide panel.

   1. DotGothic16    - VHS/video overlay (VCR OSD alternative)
   2. IBM Plex Mono  - Classic IBM corporate computing
   3. VT323          - Vintage CRT terminals
   4. Press Start 2P - 1980s arcade typography
   5. Special Elite  - Machine/typewriter (OCR-A alternative)
   ------------------------------------------------------------------ */

const FONTS = [
  { name: "DotGothic16", family: "'DotGothic16', monospace", weight: 400, spacing: "0.04em", desc: "VHS overlay / 1980s video" },
  { name: "IBM Plex Mono", family: "'IBM Plex Mono', monospace", weight: 500, spacing: "0.06em", desc: "Classic IBM computing" },
  { name: "VT323", family: "'VT323', monospace", weight: 400, spacing: "0.08em", desc: "Vintage CRT terminal" },
  { name: "Press Start 2P", family: "'Press Start 2P', monospace", weight: 400, spacing: "0.02em", desc: "1980s arcade" },
  { name: "Special Elite", family: "'Special Elite', monospace", weight: 400, spacing: "0.04em", desc: "Machine typewriter" },
];

export default function SectionFontExperiment() {
  const [current, setCurrent] = useState(2); // Default to VT323 (winner)
  const [show, setShow] = useState(true);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key >= "1" && e.key <= "5") setCurrent(parseInt(e.key) - 1);
      if (e.key === "h" || e.key === "H") setShow((s) => !s);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  // Apply the font to CSS custom property
  useEffect(() => {
    const f = FONTS[current];
    document.documentElement.style.setProperty("--tech-font", f.family);
    document.documentElement.style.setProperty("--tech-weight", String(f.weight));
    document.documentElement.style.setProperty("--tech-spacing", f.spacing);
  }, [current]);

  const mono = "ui-monospace, 'SF Mono', Menlo, monospace";

  return (
    <div
      style={{
        position: "fixed",
        top: 20,
        right: 20,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        gap: 6,
        opacity: show ? 1 : 0,
        pointerEvents: show ? "auto" : "none",
        transition: "opacity 0.3s ease",
        maxWidth: 320,
      }}
    >
      <div
        style={{
          fontFamily: mono,
          fontSize: 10,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "rgba(242,239,231,0.5)",
          marginBottom: 4,
        }}
      >
        1980s Font (1-5 / H to hide)
      </div>
      {FONTS.map((f, i) => (
        <button
          key={f.name}
          onClick={() => setCurrent(i)}
          style={{
            padding: "12px 14px",
            background: current === i ? "rgba(185,174,230,0.25)" : "rgba(0,0,0,0.75)",
            border: current === i ? "1px solid rgba(185,174,230,0.6)" : "1px solid rgba(242,239,231,0.2)",
            borderRadius: 4,
            color: current === i ? "#B9AEE6" : "rgba(242,239,231,0.7)",
            cursor: "pointer",
            textAlign: "left",
            transition: "all 0.2s ease",
          }}
        >
          {/* Font name in its own typeface */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ fontFamily: mono, fontSize: 10, opacity: 0.5 }}>{i + 1}</span>
            <strong
              style={{
                fontFamily: f.family,
                fontWeight: f.weight,
                letterSpacing: f.spacing,
                fontSize: f.name === "Press Start 2P" ? 10 : 13,
              }}
            >
              {f.name}
            </strong>
          </div>
          {/* Preview text in this font */}
          <div
            style={{
              fontFamily: f.family,
              fontWeight: f.weight,
              letterSpacing: f.spacing,
              fontSize: f.name === "Press Start 2P" ? 7 : 10,
              lineHeight: 1.6,
              color: current === i ? "rgba(242,239,231,0.9)" : "rgba(242,239,231,0.55)",
              textTransform: "uppercase",
            }}
          >
            <div>BINARY 1702 / SYSTEM ONLINE</div>
            <div>PROJECT 001 — AQUATECH</div>
            <div>EST. 2026</div>
          </div>
          {/* Description */}
          <span
            style={{
              display: "block",
              fontFamily: mono,
              fontSize: 9,
              opacity: 0.5,
              marginTop: 6,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            {f.desc}
          </span>
        </button>
      ))}
    </div>
  );
}
