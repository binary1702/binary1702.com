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

export default function PointCanvas({ system, paused, white }: { system: PointCloudSystem; paused: boolean; white?: boolean }) {
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
      dpr = Math.min(window.devicePixelRatio || 1, 3); // phones are 3×; capping at 2 made the cloud upscale and blur
      W = canvas.clientWidth; H = canvas.clientHeight;
      canvas.width = W * dpr; canvas.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      system.resize(Math.max(1, Math.floor(W / CW)), Math.max(1, Math.floor(H / CH)));
    };
    fit();

    // Depth is drawn in bands, back to front: one path + one fill per band.
    // Small, near-opaque points keep the structure crisp; brightness and size
    // carry depth. (Large translucent discs overlap into fog — avoid.)
    const BANDS = 8;
    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      const n = system.points, hov = system.hovered, focus = system.focus;
      // sparse clouds (e.g. one limb, ~1.3k points) get slightly larger, brighter points
      // so every region carries the same visual weight as the dense brain (~4k)
      const density = Math.min(1.45, Math.max(1, Math.sqrt(4000 / Math.max(1, n))));
      const scale = (H < 600 ? 1.25 : 1) * density;
      for (let band = 0; band < BANDS; band++) {
        const lo = band / BANDS, hi = (band + 1) / BANDS, mid = (lo + hi) / 2;
        const r = (0.55 + 0.75 * mid) * scale;           // ~1.1px far → ~2.6px near (diameter)
        const a = Math.min(1, (0.18 + 0.77 * mid * mid) * (0.75 + 0.25 * density * density)) * fade; // far recede, near solid
        let started = false;
        let regColor: readonly number[] | null = null;
        for (let k = 0; k < n; k++) {
          const near = system.near[k];
          if (near < lo || (near >= hi && band < BANDS - 1)) continue;
          const gx = system.sx[k], gy = system.sy[k];
          if (gx < 0 || gy < 0) continue;
          const reg = system.ri[k];
          if (focus >= 0 && reg !== focus) continue;
          if (!white && regColor !== REGION_COLORS[reg]) {
            if (started) ctx.fill();
            regColor = REGION_COLORS[reg];
            ctx.fillStyle = `rgba(${regColor[0]},${regColor[1]},${regColor[2]},${a.toFixed(3)})`;
            ctx.beginPath(); started = true;
          } else if (!started) {
            ctx.fillStyle = `rgba(242,239,231,${a.toFixed(3)})`;
            ctx.beginPath(); started = true;
          }
          const x = gx * CW, y = gy * CH;
          ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, 6.2832);
        }
        if (started) ctx.fill();
      }
      const still = reduce ? 0 : 1;
      ctx.globalCompositeOperation = "lighter"; // light adds up: glow, not paint

      // hovered cluster — all structures near the cursor — in blood red with a soft glow
      const hovSet = system.hoveredSet;
      const intensity = system.hoverIntensity;
      if (hovSet.size > 0 && intensity > 0.01) {
        for (let k = 0; k < n; k++) {
          if (!hovSet.has(system.si[k])) continue;
          const gx = system.sx[k], gy = system.sy[k]; if (gx < 0 || gy < 0) continue;
          const x = gx * CW, y = gy * CH;
          const tw = still ? 0.8 + 0.2 * Math.sin(t * 6 + k * 1.7) : 1; // a slow pulse, not a flicker
          const i = intensity * tw;
          ctx.fillStyle = `rgba(170,8,24,${(0.2 * i).toFixed(3)})`;
          ctx.beginPath(); ctx.arc(x, y, 7, 0, 6.2832); ctx.fill();   // glow
          ctx.fillStyle = `rgba(214,22,38,${(0.95 * i).toFixed(3)})`;
          ctx.beginPath(); ctx.arc(x, y, 1.9, 0, 6.2832); ctx.fill(); // core
        }
      }
      ctx.globalCompositeOperation = "source-over";

      // the cursor says what a press will do: inspect, grab, or (held) spin
      const want = system.isDragging ? "grabbing" : hov >= 0 ? "pointer" : "grab";
      if (canvas.style.cursor !== want) canvas.style.cursor = want;
    };

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (!pausedRef.current) { t += dt; fade = Math.min(1, fade + dt / 1.8); system.step(dt, t, pointer); draw(); pointer.vx *= 0.5; pointer.vy *= 0.5; }
      if (!reduce) raf = requestAnimationFrame(frame);
    };
    if (reduce) { for (let i = 0; i < 30; i++) system.step(1 / 60, i / 60, pointer); fade = 1; draw(); } else raf = requestAnimationFrame(frame);

    const toGrid = (e: PointerEvent) => { const b = canvas.getBoundingClientRect(); const gx = (e.clientX - b.left) / CW, gy = (e.clientY - b.top) / CH; pointer.vx = Number.isNaN(pointer.x) ? 0 : gx - pointer.x; pointer.vy = Number.isNaN(pointer.y) ? 0 : gy - pointer.y; pointer.x = gx; pointer.y = gy; };
    const onLeave = () => { if (!system.isDragging) { pointer.x = NaN; pointer.y = NaN; } };

    // click-and-drag spins the figure (mouse, pen or one finger)
    let lastX = 0, lastY = 0;
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      canvas.setPointerCapture(e.pointerId);
      lastX = e.clientX; lastY = e.clientY;
      system.beginDrag();
    };
    const onDrag = (e: PointerEvent) => {
      if (!system.isDragging) return;
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      system.dragBy(dx * 0.012, -dy * 0.008); // ~520 px of travel = one full turn; drag up tips the top away
    };
    const onUp = (e: PointerEvent) => {
      if (!system.isDragging) return;
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
      system.endDrag();
    };
    const ro = new ResizeObserver(fit); ro.observe(canvas.parentElement ?? canvas);
    canvas.addEventListener("pointermove", toGrid, { passive: true }); canvas.addEventListener("pointerleave", onLeave);
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onDrag, { passive: true });
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    return () => {
      cancelAnimationFrame(raf); ro.disconnect();
      canvas.removeEventListener("pointermove", toGrid); canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("pointerdown", onDown); canvas.removeEventListener("pointermove", onDrag);
      canvas.removeEventListener("pointerup", onUp); canvas.removeEventListener("pointercancel", onUp);
    };
  }, [system]);

  return <canvas ref={ref} aria-hidden="true" style={{ display: "block", width: "100%", height: "100%", touchAction: "none", borderRadius: 12 }} />;
}
