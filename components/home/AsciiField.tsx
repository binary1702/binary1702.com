"use client";

import { useEffect, useRef } from "react";

/* ------------------------------------------------------------------
   AsciiField — a quiet drifting field of characters behind the hero.
   Characters start scattered (noise) and settle toward a grid over
   time: complexity resolving into structure. Canvas, no deps, pauses
   when off-screen or when the visitor prefers reduced motion.
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

    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      ctx.font = "12px 'Archivo Narrow', system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (const p of pts) {
        if (!reduce) {
          // ease toward the grid, with a slow breathing drift
          p.x += (p.gx - p.x) * p.s;
          p.y += (p.gy - p.y) * p.s;
          const d = Math.sin(t * 0.0004 + p.gx * 0.01 + p.gy * 0.013) * 2;
          ctx.globalAlpha = p.a + Math.sin(t * 0.001 + p.gx) * 0.03;
          ctx.fillStyle = "#F2EFE7";
          ctx.fillText(p.ch, p.x + d, p.y);
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

    const io = new IntersectionObserver(([e]) => {
      running = e.isIntersecting;
      if (running && !reduce) { cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); }
    });
    io.observe(canvas);

    const onResize = () => { seed(); if (reduce) draw(0); };
    window.addEventListener("resize", onResize);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        maskImage: "radial-gradient(ellipse 70% 80% at 65% 45%, #000 20%, transparent 75%)",
        WebkitMaskImage: "radial-gradient(ellipse 70% 80% at 65% 45%, #000 20%, transparent 75%)",
      }}
    />
  );
}
