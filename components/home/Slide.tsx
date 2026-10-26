"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import CanopyField from "./CanopyField";
import GenerativeCanvas from "@/components/lab/GenerativeCanvas";
import { LorenzSystem, CanopySystem, ReactionSystem, OrganismSystem, type GenerativeSystem } from "@/lib/generative";

const SYSTEMS = {
  chaos: () => new LorenzSystem(),
  canopy: () => new CanopySystem(),
  emergence: () => new ReactionSystem(),
  organism: () => new OrganismSystem(),
} as const;
export type SystemKey = keyof typeof SYSTEMS;

/* ------------------------------------------------------------------
   Slide — one beat of the story as one full-viewport composition.
   A photo-derived ASCII field (same renderer as the opening) with the
   type set into it. The field runs only while the slide is on screen.
   Type is deliberately limited: a mono index, one serif line, and an
   optional mono subline. Nothing else.
   ------------------------------------------------------------------ */

const mono = "ui-monospace, 'SF Mono', Menlo, monospace";
const serif = "'Playfair Display', Georgia, serif";

type Props = {
  id: string;
  index: string;          // "01"
  label: string;          // "The problem"
  src?: string;           // a photo to derive from, e.g. /network.jpg …
  system?: SystemKey;     // … or a generative system from lib/generative, by key
  cycle?: boolean;
  cell?: number;
  line: ReactNode;        // the one serif sentence
  sub?: ReactNode;        // optional mono subline
  align?: "center" | "left";
  children?: ReactNode;   // anything else that must sit in the slide (a CTA, a form) — use sparingly
};

export default function Slide({ id, index, label, src, system, cycle = false, cell, line, sub, align = "left", children }: Props) {
  const ref = useRef<HTMLElement>(null);
  const [onScreen, setOnScreen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting), { rootMargin: "20% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const left = align === "left";
  const sys = useMemo<GenerativeSystem | null>(() => (system ? SYSTEMS[system]() : null), [system]);

  return (
    <section
      ref={ref}
      id={id}
      aria-labelledby={`${id}-line`}
      style={{ position: "relative", minHeight: "100dvh", background: "#000", color: "#F2EFE7", overflow: "hidden", zIndex: 1 }}
    >
      <div style={{ position: "absolute", inset: 0 }}>
        {sys ? <GenerativeCanvas system={sys} paused={!onScreen} /> : <CanopyField src={src ?? "/canopy.jpg"} active={onScreen} cycle={cycle} cell={cell} />}
      </div>

      {/* a floor of dark for the type to stand on */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: left
            ? "linear-gradient(to top, rgba(0,0,0,.92) 0%, rgba(0,0,0,.55) 32%, rgba(0,0,0,0) 62%)"
            : "radial-gradient(ellipse 60% 50% at 50% 55%, rgba(0,0,0,.9) 0%, rgba(0,0,0,.5) 55%, rgba(0,0,0,0) 80%)",
        }}
      />

      <div
        style={{
          position: "absolute", inset: 0, display: "grid", alignContent: left ? "end" : "center", justifyItems: left ? "start" : "center",
          padding: left ? "0 clamp(24px, 6vw, 96px) clamp(56px, 9vh, 110px)" : "0 24px", textAlign: left ? "left" : "center", gap: 18,
        }}
      >
        <div style={{ fontFamily: mono, fontSize: 11, letterSpacing: ".4em", textTransform: "uppercase", color: "rgba(242,239,231,.55)" }}>
          {index} <span style={{ margin: "0 10px", color: "rgba(242,239,231,.3)" }}>/</span> {label}
        </div>
        <h2
          id={`${id}-line`}
          style={{
            margin: 0, fontFamily: serif, fontWeight: 400, fontSize: "clamp(2rem, 4.6vw, 4.2rem)", lineHeight: 1.06, letterSpacing: "-0.015em",
            maxWidth: "16ch", textWrap: "balance", textShadow: "0 0 30px rgba(0,0,0,.95), 0 0 90px rgba(0,0,0,.9)",
          }}
        >
          {line}
        </h2>
        {sub && (
          <div style={{ fontFamily: mono, fontSize: 12, letterSpacing: ".18em", lineHeight: 1.8, color: "rgba(242,239,231,.6)", maxWidth: "66ch" }}>
            {sub}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}
