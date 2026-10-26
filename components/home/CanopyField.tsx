"use client";

import { useEffect, useRef } from "react";

/* ------------------------------------------------------------------
   CanopyField — a photograph rendered as living ASCII.

   The source (public/canopy.jpg, pre-blurred so shapes survive the
   quantisation) is sampled once into a grid of cells. Per cell:
     brightness → glyph density (on black, more ink = brighter)
     gradient   → on hard edges, a directional glyph ( | / - \ )
     color      → the pixel's own, saturated, so greens stay green
   Each cell samples from a slowly drifting point so the canopy sways;
   the cursor is wind. Glyphs are pre-rendered sprites. Static under
   reduced motion.
   ------------------------------------------------------------------ */

const FILL = " .:-=+*#@";
const EDGE = "|/-\\";
const Q = 5; // color levels per channel

/* The color cycle: the canopy's palette travels through these, in order, forever. */
const CYCLE: [number, number, number][] = [
  [0.45, 0.95, 0.42], // green
  [0.98, 0.86, 0.32], // yellow
  [0.38, 0.62, 1.0],  // blue
  [1.0, 0.58, 0.25],  // orange
];
const CYCLE_SECONDS = 12; // per color
const smooth = (x: number) => x * x * (3 - 2 * x);

type Props = {
  src?: string;
  className?: string;
  /** when false the loop sleeps (nothing drawn, no rAF) — e.g. once the opening has scrolled away */
  active?: boolean;
  /** travel through the color cycle (the canopy) or keep the photo's own tones (monochrome references) */
  cycle?: boolean;
  /** cell size in px at desktop widths */
  cell?: number;
};

export default function CanopyField({ src = "/canopy.jpg", className, active = true, cycle = true, cell }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const activeRef = useRef(active);
  activeRef.current = active;
  const wake = useRef<() => void>(() => {});

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let alive = true;
    let W = 0, H = 0, cols = 0, rows = 0, cw = 0, ch = 0, dpr = 1, sw = 0, sh = 0;
    let pix: Uint8ClampedArray = new Uint8ClampedArray(0);
    let lum = new Float32Array(0), gx = new Float32Array(0), gy = new Float32Array(0);
    // precomputed per source cell: which glyph, and the photo's own (normalised) color
    let chars: string[] = [];
    let colR = new Float32Array(0), colG = new Float32Array(0), colB = new Float32Array(0), colV = new Float32Array(0);
    let cells: { p: number; dx: number; dy: number }[] = [];
    const sprites = new Map<string, HTMLCanvasElement>();
    const mouse = { x: -1e4, y: -1e4, vx: 0, vy: 0, px: -1e4, py: -1e4 };
    const t0 = performance.now();
    const img = new Image();

    const setup = (): boolean => {
      W = canvas.clientWidth; H = canvas.clientHeight;
      if (W < 2 || H < 2) return false; // not laid out yet — caller retries next frame
      dpr = Math.min(window.devicePixelRatio || 1, W > 1600 ? 1.5 : 2);
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cw = cell ?? (W < 700 ? 8 : W > 1800 ? 10 : 9); ch = cw * 1.5;
      cols = Math.ceil(W / cw); rows = Math.ceil(H / ch);
      sw = cols; sh = rows;

      const s = document.createElement("canvas"); s.width = sw; s.height = sh;
      const sc = s.getContext("2d")!; sc.imageSmoothingEnabled = true; sc.imageSmoothingQuality = "high";
      const ir = img.width / img.height, cr = W / H;
      let vw: number, vh: number, vx: number, vy: number;
      if (cr > ir) { vw = W; vh = W / ir; vx = 0; vy = (H - vh) / 2; } else { vh = H; vw = H * ir; vy = 0; vx = (W - vw) / 2; }
      sc.drawImage(img, vx / W * sw, vy / H * sh, vw / W * sw, vh / H * sh);
      pix = sc.getImageData(0, 0, sw, sh).data;

      lum = new Float32Array(sw * sh);
      for (let i = 0; i < sw * sh; i++) lum[i] = (0.2126 * pix[i * 4] + 0.7152 * pix[i * 4 + 1] + 0.0722 * pix[i * 4 + 2]) / 255;
      gx = new Float32Array(sw * sh); gy = new Float32Array(sw * sh);
      for (let y = 1; y < sh - 1; y++) for (let x = 1; x < sw - 1; x++) {
        const i = y * sw + x;
        gx[i] = -lum[i - sw - 1] - 2 * lum[i - 1] - lum[i + sw - 1] + lum[i - sw + 1] + 2 * lum[i + 1] + lum[i + sw + 1];
        gy[i] = -lum[i - sw - 1] - 2 * lum[i - sw] - lum[i - sw + 1] + lum[i + sw - 1] + 2 * lum[i + sw] + lum[i + sw + 1];
      }
      // glyph + base color per source cell, once — the per-frame loop only looks these up
      const n = sw * sh;
      chars = new Array(n); colR = new Float32Array(n); colG = new Float32Array(n); colB = new Float32Array(n); colV = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const L = lum[i];
        const g = Math.hypot(gx[i], gy[i]);
        if (g > 1.6) {
          const a = Math.atan2(gy[i], gx[i]);
          const e = (((a + Math.PI) / Math.PI) * 4 + 0.5 | 0) % 4;
          chars[i] = EDGE[[2, 1, 0, 3][e]];
        } else {
          const li = (0.12 + 0.88 * Math.pow(L, 0.8)) * (FILL.length - 1) + 0.5 | 0;
          chars[i] = FILL[Math.max(1, li)];
        }
        let rr = pix[i * 4] / 255, gg = pix[i * 4 + 1] / 255, bb = pix[i * 4 + 2] / 255;
        const m = (rr + gg + bb) / 3;
        rr = Math.max(0, m + (rr - m) * 1.7); gg = Math.max(0, m + (gg - m) * 1.7); bb = Math.max(0, m + (bb - m) * 1.7);
        const v = 0.3 + 0.7 * Math.pow(L, 0.7);
        const mx = Math.max(rr, gg, bb, 0.001);
        colR[i] = rr / mx * v; colG[i] = gg / mx * v; colB[i] = bb / mx * v; colV[i] = v;
      }
      cells = Array.from({ length: cols * rows }, () => ({ p: Math.random() * 6.283, dx: 0, dy: 0 }));
      sprites.clear();
      return true;
    };

    const sprite = (chr: string, r: number, g: number, b: number) => {
      const key = chr + (r * 36 + g * 6 + b);
      let s = sprites.get(key);
      if (s) return s;
      s = document.createElement("canvas"); s.width = Math.ceil(cw * dpr); s.height = Math.ceil(ch * dpr);
      const c = s.getContext("2d")!; c.scale(dpr, dpr);
      c.font = `500 ${cw * 1.55}px ui-monospace, "SF Mono", Menlo, monospace`; c.textBaseline = "top"; c.textAlign = "center";
      c.fillStyle = `rgb(${(r * 255) / (Q - 1) | 0},${(g * 255) / (Q - 1) | 0},${(b * 255) / (Q - 1) | 0})`;
      c.fillText(chr, cw / 2, -cw * 0.1);
      sprites.set(key, s); return s;
    };

    const FRAME_MS = 1000 / 30;
    let lastDraw = 0;
    const frame = (now: number) => {
      if (!alive) return;
      if (!activeRef.current) { raf = 0; return; }          // sleep; wake() restarts the loop
      raf = requestAnimationFrame(frame);
      if (now - lastDraw < FRAME_MS) return;                 // 30 fps is plenty for a swaying forest
      lastDraw = now;

      const t = Math.max(0, (now - t0) / 1000); // rAF timestamps can precede a performance.now() taken just before
      const fade = Math.min(1, t / 3.4);
      ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
      mouse.vx = mouse.x - mouse.px; mouse.vy = mouse.y - mouse.py; mouse.px = mouse.x; mouse.py = mouse.y;
      const R = Math.min(W, H) * 0.2;
      ctx.globalAlpha = fade;
      const ph = (t / CYCLE_SECONDS) % CYCLE.length;
      const ci = Math.floor(ph), cf = smooth(ph - ci);
      const A = CYCLE[ci], B = CYCLE[(ci + 1) % CYCLE.length];
      const tr = A[0] + (B[0] - A[0]) * cf, tg = A[1] + (B[1] - A[1]) * cf, tb = A[2] + (B[2] - A[2]) * cf;

      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const k = r * cols + c, cl = cells[k];
        const px = c * cw, py = r * ch;
        let sx = c, sy = r, ox = 0, oy = 0;
        if (!reduce) {
          const ddx = px - mouse.x, ddy = py - mouse.y, d2 = ddx * ddx + ddy * ddy;
          if (d2 < R * R) { const d = Math.sqrt(d2); const f = (1 - d / R) ** 2; cl.dx += (mouse.vx * 0.1 + ddx / (d + 1) * 1.1) * f; cl.dy += (mouse.vy * 0.1 + ddy / (d + 1) * 1.1) * f; }
          cl.dx *= 0.9; cl.dy *= 0.9;
          sx += Math.sin(t * 0.55 + cl.p) * 0.45 + cl.dx * 0.2;
          sy += Math.cos(t * 0.45 + cl.p * 1.3) * 0.3 + cl.dy * 0.2;
          ox = cl.dx * 0.5; oy = cl.dy * 0.5;
        }
        const ix = sx < 0 ? 0 : sx >= sw ? sw - 1 : sx | 0, iy = sy < 0 ? 0 : sy >= sh ? sh - 1 : sy | 0;
        const i = iy * sw + ix;
        const v = colV[i];
        const rr = cycle ? colR[i] * 0.3 + v * tr * 0.7 : colR[i];
        const gg = cycle ? colG[i] * 0.3 + v * tg * 0.7 : colG[i];
        const bb = cycle ? colB[i] * 0.3 + v * tb * 0.7 : colB[i];
        ctx.drawImage(
          sprite(chars[i], Math.round((rr > 1 ? 1 : rr) * (Q - 1)), Math.round((gg > 1 ? 1 : gg) * (Q - 1)), Math.round((bb > 1 ? 1 : bb) * (Q - 1))),
          px + ox, py + oy, cw, ch,
        );
      }
      ctx.globalAlpha = 1;
      if (reduce) { cancelAnimationFrame(raf); raf = 0; }
    };
    wake.current = () => { if (alive && !raf && !reduce) raf = requestAnimationFrame(frame); };

    const onMove = (e: PointerEvent) => { const b = canvas.getBoundingClientRect(); mouse.x = e.clientX - b.left; mouse.y = e.clientY - b.top; };
    const onLeave = () => { mouse.x = mouse.y = -1e4; };
    const onResize = () => { if (setup() && reduce) { raf = 1; frame(performance.now()); } };

    img.onload = () => {
      let tries = 0;
      const start = () => {
        if (!alive) return;
        if (!setup()) { if (tries++ < 60) requestAnimationFrame(start); return; }
        raf = 1; frame(performance.now()); // first paint immediately, then the loop (or a single still under reduced motion)
      };
      start();
      window.addEventListener("resize", onResize);
      window.addEventListener("pointermove", onMove, { passive: true });
      canvas.addEventListener("pointerleave", onLeave);
    };
    img.src = src;

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
    };
  }, [src, cycle, cell]);

  // wake the loop when the opening becomes visible again
  useEffect(() => { if (active) wake.current(); }, [active]);

  return <canvas ref={ref} className={className} aria-hidden="true" style={{ display: "block", width: "100%", height: "100%" }} />;
}
