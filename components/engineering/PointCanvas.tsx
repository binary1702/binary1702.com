"use client";

import { useEffect, useRef } from "react";
import type { PointCloudSystem } from "@/lib/generative";

/* ------------------------------------------------------------------
   PointCanvas — draws a PointCloudSystem as real points (not glyphs).
   Each point: colour by part, brightness by depth, size by depth. The
   hovered structure is drawn last and brighter. Same simulation as
   the ASCII path; only the rasterisation differs.
   ------------------------------------------------------------------ */

export const REGION_COLORS: [number, number, number][] = [
  [226, 190, 110], // brain — gold
  [214, 130, 190], // spinal cord — pink
  [232, 170, 92],  // head & neck — amber
  [104, 160, 230], // arms — blue
  [200, 120, 150], // trunk — mauve
  [120, 190, 120], // legs — green
];
export const REGION_HEX = REGION_COLORS.map(([r, g, b]) => `rgb(${r},${g},${b})`);

export default function PointCanvas({ system, paused }: { system: PointCloudSystem; paused: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const pausedRef = useRef(paused); pausedRef.current = paused;

  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true }); if (!ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0, last = performance.now(), t = 0, fade = 0, W = 0, H = 0, dpr = 1;
    const pointer = { x: NaN, y: NaN, vx: 0, vy: 0, down: false };
    // the system thinks in a character grid; we give it a fine one so projection is smooth
    const CW = 2, CH = 2 * 1.55;

    const fit = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = canvas.clientWidth; H = canvas.clientHeight;
      canvas.width = W * dpr; canvas.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      system.resize(Math.max(1, Math.floor(W / CW)), Math.max(1, Math.floor(H / CH)));
    };
    fit();

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      const n = system.points, hov = system.hovered, focus = system.focus;
      for (let k = 0; k < n; k++) {
        const gx = system.sx[k], gy = system.sy[k];
        if (gx < 0 || gy < 0) continue;
        const x = gx * CW, y = gy * CH;
        const near = system.near[k];
        const reg = system.ri[k];
        const lit = focus < 0 || reg === focus;
        const c = REGION_COLORS[reg];
        const a = (lit ? 0.28 + 0.5 * near : 0.06 + 0.06 * near) * fade;
        const r = lit ? 0.8 + 1.1 * near : 0.6 + 0.4 * near;
        ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${a.toFixed(3)})`;
        ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
      }
      if (hov >= 0) {
        ctx.fillStyle = "rgba(242,239,231,.95)";
        for (let k = 0; k < n; k++) {
          if (system.si[k] !== hov) continue;
          const gx = system.sx[k], gy = system.sy[k]; if (gx < 0 || gy < 0) continue;
          ctx.beginPath(); ctx.arc(gx * CW, gy * CH, 2.2, 0, 6.2832); ctx.fill();
        }
      }
    };

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (!pausedRef.current) { t += dt; fade = Math.min(1, fade + dt / 1.8); system.step(dt, t, pointer); draw(); pointer.vx *= 0.5; pointer.vy *= 0.5; }
      if (!reduce) raf = requestAnimationFrame(frame);
    };
    if (reduce) { for (let i = 0; i < 30; i++) system.step(1 / 60, i / 60, pointer); fade = 1; draw(); } else raf = requestAnimationFrame(frame);

    const toGrid = (e: PointerEvent) => { const b = canvas.getBoundingClientRect(); const gx = (e.clientX - b.left) / CW, gy = (e.clientY - b.top) / CH; pointer.vx = Number.isNaN(pointer.x) ? 0 : gx - pointer.x; pointer.vy = Number.isNaN(pointer.y) ? 0 : gy - pointer.y; pointer.x = gx; pointer.y = gy; };
    const onLeave = () => { pointer.x = NaN; pointer.y = NaN; };
    const ro = new ResizeObserver(fit); ro.observe(canvas.parentElement ?? canvas);
    canvas.addEventListener("pointermove", toGrid, { passive: true }); canvas.addEventListener("pointerleave", onLeave);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); canvas.removeEventListener("pointermove", toGrid); canvas.removeEventListener("pointerleave", onLeave); };
  }, [system]);

  return <canvas ref={ref} aria-hidden="true" style={{ display: "block", width: "100%", height: "100%", touchAction: "none" }} />;
}
