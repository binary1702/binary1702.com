"use client";

import { useEffect, useRef } from "react";
import { Ecosystem } from "@/lib/ecosystem/engine";

/* ------------------------------------------------------------------
   LivingThreshold — the only React in the artwork.

   React owns one <canvas>. On mount it hands the element to the
   Ecosystem engine, wires browser events to the engine's influence
   methods, and tears everything down on unmount. No React state is
   touched per frame; the engine runs its own requestAnimationFrame.
   ------------------------------------------------------------------ */
export default function LivingThreshold() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const motionMq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const isMobile = coarse || window.innerWidth < 768;

    const eco = new Ecosystem(canvas, {
      isMobile,
      reducedMotion: motionMq.matches,
    });
    eco.start();

    // --- influences -------------------------------------------------
    // Listeners live on window so the typography and nav overlays never
    // block the cursor from reaching the organism.
    const onMove = (e: PointerEvent) => eco.setPointer(e.clientX, e.clientY);
    const onDown = (e: PointerEvent) => {
      eco.setPointer(e.clientX, e.clientY);
      eco.inject(e.clientX, e.clientY, e.pointerType === "touch" ? 1.2 : 1);
    };
    const onUp = (e: PointerEvent) => {
      if (e.pointerType === "touch") eco.clearPointer();
    };
    const onLeave = () => eco.clearPointer();

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true });
    window.addEventListener("pointercancel", onUp, { passive: true });
    document.documentElement.addEventListener("mouseleave", onLeave);
    window.addEventListener("blur", onLeave);

    // --- environment ------------------------------------------------
    let resizeT = 0;
    const onResize = () => {
      window.clearTimeout(resizeT);
      resizeT = window.setTimeout(() => eco.resize(), 120);
    };
    window.addEventListener("resize", onResize);

    const onVisibility = () => {
      if (document.hidden) eco.stop();
      else eco.start();
    };
    document.addEventListener("visibilitychange", onVisibility);

    const onMotion = (e: MediaQueryListEvent) => eco.setReducedMotion(e.matches);
    motionMq.addEventListener("change", onMotion);

    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      document.documentElement.removeEventListener("mouseleave", onLeave);
      window.removeEventListener("blur", onLeave);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      motionMq.removeEventListener("change", onMotion);
      window.clearTimeout(resizeT);
      eco.destroy();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        display: "block",
        background: "#000",
        touchAction: "none",
        userSelect: "none",
      }}
    />
  );
}
