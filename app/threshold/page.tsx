"use client";

import type { CSSProperties, MouseEvent } from "react";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import LivingThreshold from "@/components/LivingThreshold";
import { useAudioContext } from "@/components/AudioProvider";

/* ------------------------------------------------------------------
   Threshold.

   The homepage is the artwork. There is no gate: the visitor arrives
   inside a living computational ecosystem (see lib/ecosystem) and the
   type and navigation sit lightly on top of it. Showcase still routes
   into the cinematic site and marks the session entered so its audio
   can begin on the click gesture, exactly as before.
   ------------------------------------------------------------------ */

const serif = "'Playfair Display', Georgia, serif";
const sans = "'Archivo Narrow', system-ui, sans-serif";

const navLink: CSSProperties = {
  background: "none",
  border: 0,
  padding: "8px 2px",
  margin: 0,
  cursor: "pointer",
  fontFamily: sans,
  fontSize: 11,
  letterSpacing: "0.32em",
  textTransform: "uppercase",
  textDecoration: "none",
  color: "rgba(242, 239, 231, 0.42)",
  transition: "color 0.4s ease",
};

const linkIn = (e: MouseEvent<HTMLElement>) => {
  e.currentTarget.style.color = "rgba(242, 239, 231, 0.9)";
};
const linkOut = (e: MouseEvent<HTMLElement>) => {
  e.currentTarget.style.color = "rgba(242, 239, 231, 0.42)";
};

export default function ThresholdPage() {
  const router = useRouter();
  const { enter } = useAudioContext();
  const [revealed, setRevealed] = useState(false);

  // Type arrives after the rain has had a moment to itself.
  useEffect(() => {
    const t = window.setTimeout(() => setRevealed(true), 900);
    return () => window.clearTimeout(t);
  }, []);

  const handleShowcase = useCallback(() => {
    enter();
    router.push("/showcase");
  }, [enter, router]);

  const fade = (delay: number): CSSProperties => ({
    opacity: revealed ? 1 : 0,
    transform: revealed ? "translateY(0)" : "translateY(6px)",
    transition: `opacity 2.4s ease ${delay}s, transform 2.4s ease ${delay}s`,
  });

  return (
    <main
      style={{
        position: "relative",
        background: "#000",
        height: "100dvh",
        overflow: "hidden",
        color: "#F2EFE7",
      }}
    >
      <LivingThreshold />

      {/* Title — the only words on the page. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 18,
          padding: "0 24px",
          textAlign: "center",
          pointerEvents: "none",
          transform: "translateY(-6vh)",
        }}
      >
        <h1
          style={{
            ...fade(0),
            margin: 0,
            fontFamily: sans,
            fontWeight: 600,
            fontSize: "clamp(1.4rem, 3.2vw, 2.2rem)",
            letterSpacing: "0.34em",
            textTransform: "uppercase",
            textIndent: "0.34em", // optically centre the tracked text
            textShadow: "0 0 24px rgba(0,0,0,0.9)",
          }}
        >
          <span style={{ color: "#8C7EC4" }}>Binary</span>
          <span style={{ color: "#F2EFE7" }}> 1702</span>
        </h1>
        <p
          style={{
            ...fade(0.9),
            margin: 0,
            fontFamily: serif,
            fontStyle: "italic",
            fontWeight: 400,
            fontSize: "clamp(1rem, 1.6vw, 1.25rem)",
            letterSpacing: "0.02em",
            color: "rgba(242, 239, 231, 0.62)",
            textShadow: "0 0 18px rgba(0,0,0,0.9)",
          }}
        >
          An Exploration of the Unknown.
        </p>
      </div>

      {/* Navigation — present, quiet. */}
      <nav
        aria-label="Primary"
        style={{
          ...fade(1.8),
          position: "absolute",
          left: 0,
          right: 0,
          bottom: "max(22px, env(safe-area-inset-bottom))",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: "clamp(18px, 4vw, 40px)",
        }}
      >
        <Link href="/experiments" style={navLink} onMouseEnter={linkIn} onMouseLeave={linkOut}>
          Experiments
        </Link>
        <button type="button" onClick={handleShowcase} style={navLink} onMouseEnter={linkIn} onMouseLeave={linkOut}>
          Showcase
        </button>
        <a href="https://portal.binary1702.com" style={navLink} onMouseEnter={linkIn} onMouseLeave={linkOut}>
          Login
        </a>
      </nav>
    </main>
  );
}
