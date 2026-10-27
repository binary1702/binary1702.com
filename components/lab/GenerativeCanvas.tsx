"use client";

import { useEffect, useRef } from "react";
import { AsciiRenderer, PALETTE, type GenerativeSystem, type Pointer } from "@/lib/generative";

/* ------------------------------------------------------------------
   GenerativeCanvas — the interaction layer.

   Owns the canvas, the animation loop, pointer state and reduced-motion
   handling. Takes any GenerativeSystem and an AsciiRenderer; knows
   nothing about which algorithm it is driving. Cleans up its frame
   and listeners on unmount or when the system changes.
   ------------------------------------------------------------------ */

type Props = {
  system: GenerativeSystem;
  paused: boolean;
  className?: string;
  /** character cell size in px (default: 8 on phones, 10 otherwise) */
  cell?: number;
  /** draw over whatever is beneath instead of on ink black */
  transparent?: boolean;
};

export default function GenerativeCanvas({ system, paused, className, cell, transparent }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: !!transparent });
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const renderer = new AsciiRenderer(ctx, transparent ? { ...PALETTE, background: "transparent" } : undefined, undefined, cell ?? (window.innerWidth < 700 ? 8 : 10));
    const pointer: Pointer = { x: NaN, y: NaN, vx: 0, vy: 0, down: false };
    let raf = 0;
    let last = performance.now();
    let t = 0;
    let fade = 0;

    const fit = () => {
      if (renderer.resize(canvas)) system.resize(renderer.cols, renderer.rows);
    };
    fit();

    const toGrid = (e: PointerEvent) => {
      const b = canvas.getBoundingClientRect();
      const gx = (e.clientX - b.left - renderer.offsetX) / renderer.cw;
      const gy = (e.clientY - b.top - renderer.offsetY) / renderer.ch;
      pointer.vx = Number.isNaN(pointer.x) ? 0 : gx - pointer.x;
      pointer.vy = Number.isNaN(pointer.y) ? 0 : gy - pointer.y;
      pointer.x = gx; pointer.y = gy;
    };
    const onMove = (e: PointerEvent) => toGrid(e);
    const onDown = (e: PointerEvent) => { pointer.down = true; toGrid(e); };
    const onUp = () => { pointer.down = false; };
    const onLeave = () => { pointer.x = NaN; pointer.y = NaN; pointer.vx = 0; pointer.vy = 0; };

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!pausedRef.current) {
        t += dt;
        fade = Math.min(1, fade + dt / 2.2);
        system.step(dt, t, pointer);
        renderer.draw(system.density, system.tint, fade);
        // velocity is per-frame; it decays if the pointer rests
        pointer.vx *= 0.5; pointer.vy *= 0.5;
      }
      if (!reduce) raf = requestAnimationFrame(frame);
    };

    if (reduce) {
      // settle the system, then draw a single still
      for (let i = 0; i < 90; i++) system.step(1 / 60, i / 60, pointer);
      renderer.draw(system.density, system.tint, 1);
    } else {
      raf = requestAnimationFrame(frame);
    }

    const ro = new ResizeObserver(() => { fit(); if (reduce) renderer.draw(system.density, system.tint, 1); });
    ro.observe(canvas);
    canvas.addEventListener("pointermove", onMove, { passive: true });
    canvas.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointerleave", onLeave);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointerleave", onLeave);
    };
  }, [system, cell, transparent]);

  return <canvas ref={ref} className={className} aria-hidden="true" style={{ display: "block", width: "100%", height: "100%", touchAction: "none" }} />;
}
