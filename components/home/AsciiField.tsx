"use client";

import { useEffect, useRef } from "react";

/* ------------------------------------------------------------------
   AsciiField — a quiet drifting field of characters behind the page.
   Fixed to the viewport, so it persists under every section. Each
   character wanders slowly around its home cell and never fully
   settles: the page is always faintly alive. Canvas, no deps; static
   when the visitor prefers reduced motion.
   ------------------------------------------------------------------ */

const GLYPHS = "·:+-=|/\\_01[]{}<>";

export default function AsciiField() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let running = true;
    let w = 0, h = 0, dpr = 1;

    type P = { gx: number; gy: number; x: number; y: number; ch: string; a: number; s: number };
    let pts: P[] = [];
    const cell = 34;

    const seed = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      pts = [];
      for (let y = cell / 2; y < h; y += cell) {
        for (let x = cell / 2; x < w; x += cell) {
          if (Math.random() < 0.55) continue; // sparse
          pts.push({
            gx: x, gy: y,
            x: x + (Math.random() - 0.5) * 140,
            y: y + (Math.random() - 0.5) * 140,
            ch: GLYPHS[(Math.random() * GLYPHS.length) | 0],
            a: 0.05 + Math.random() * 0.14,
            s: 0.004 + Math.random() * 0.01,
          });
        }
      }
    };

    let lastT = 0;
    const draw = (t: number) => {
      const dt = lastT ? Math.min(0.05, (t - lastT) / 1000) : 0;
      lastT = t;
      ctx.clearRect(0, 0, w, h);
      ctx.font = "12px 'Archivo Narrow', system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (const p of pts) {
        if (!reduce) {
          // always moving: a slow upward current that wraps, plus a local wander on each glyph's own phase
          p.gy -= dt * 24 * (0.7 + p.s * 30);
          if (p.gy < -cell) { p.gy += h + cell * 2; p.gx = Math.random() * w; }
          const wx = Math.sin(t * 0.0011 * (0.6 + p.s * 40) + p.gx * 0.011) * 10;
          const wy = Math.cos(t * 0.0009 * (0.6 + p.s * 40) + p.gy * 0.013) * 6;
          p.x = p.gx + wx;
          p.y = p.gy + wy;
          ctx.globalAlpha = p.a + Math.sin(t * 0.0014 + p.gx) * 0.04;
          ctx.fillStyle = "#F2EFE7";
          ctx.fillText(p.ch, p.x, p.y);
        } else {
          ctx.globalAlpha = p.a;
          ctx.fillStyle = "#F2EFE7";
          ctx.fillText(p.ch, p.gx, p.gy);
        }
      }
      ctx.globalAlpha = 1;
      if (running && !reduce) raf = requestAnimationFrame(draw);
    };

    seed();
    draw(0);

    const onVis = () => {
      running = document.visibilityState === "visible";
      if (running && !reduce) { cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); }
    };
    document.addEventListener("visibilitychange", onVis);

    const onResize = () => { seed(); if (reduce) draw(0); };
    window.addEventListener("resize", onResize);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 0,
        maskImage: "radial-gradient(ellipse 85% 85% at 50% 50%, #000 40%, transparent 100%)",
        WebkitMaskImage: "radial-gradient(ellipse 85% 85% at 50% 50%, #000 40%, transparent 100%)",
      }}
    />
  );
}
