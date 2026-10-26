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

type Props = { src?: string; className?: string };

export default function CanopyField({ src = "/canopy.jpg", className }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

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
    let cells: { p: number; dx: number; dy: number }[] = [];
    const sprites = new Map<string, HTMLCanvasElement>();
    const mouse = { x: -1e4, y: -1e4, vx: 0, vy: 0, px: -1e4, py: -1e4 };
    const t0 = performance.now();
    const img = new Image();

    const setup = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = canvas.clientWidth; H = canvas.clientHeight;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cw = W < 700 ? 7 : 9; ch = cw * 1.5;
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
      cells = Array.from({ length: cols * rows }, () => ({ p: Math.random() * 6.283, dx: 0, dy: 0 }));
      sprites.clear();
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

    const frame = (now: number) => {
      const t = (now - t0) / 1000;
      const fade = Math.min(1, t / 3.4);
      ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
      mouse.vx = mouse.x - mouse.px; mouse.vy = mouse.y - mouse.py; mouse.px = mouse.x; mouse.py = mouse.y;
      const R = Math.min(W, H) * 0.2;
      ctx.globalAlpha = fade;

      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const k = r * cols + c, cl = cells[k];
        const px = c * cw, py = r * ch;
        let sx = c, sy = r, ox = 0, oy = 0;
        if (!reduce) {
          const ddx = px - mouse.x, ddy = py - mouse.y, d = Math.hypot(ddx, ddy);
          if (d < R) { const f = (1 - d / R) ** 2; cl.dx += (mouse.vx * 0.1 + ddx / (d + 1) * 1.1) * f; cl.dy += (mouse.vy * 0.1 + ddy / (d + 1) * 1.1) * f; }
          cl.dx *= 0.9; cl.dy *= 0.9;
          sx += Math.sin(t * 0.55 + cl.p) * 0.45 + cl.dx * 0.2;
          sy += Math.cos(t * 0.45 + cl.p * 1.3) * 0.3 + cl.dy * 0.2;
          ox = cl.dx * 0.5; oy = cl.dy * 0.5;
        }
        const ix = Math.max(0, Math.min(sw - 1, sx | 0)), iy = Math.max(0, Math.min(sh - 1, sy | 0));
        const i = iy * sw + ix;
        const L = lum[i];
        const g = Math.hypot(gx[i], gy[i]);

        let chr: string;
        if (g > 1.6) {
          const a = Math.atan2(gy[i], gx[i]);
          const e = (((a + Math.PI) / Math.PI) * 4 + 0.5 | 0) % 4;
          chr = EDGE[[2, 1, 0, 3][e]];
        } else {
          const li = (0.12 + 0.88 * Math.pow(L, 0.8)) * (FILL.length - 1) + 0.5 | 0;
          chr = FILL[Math.max(1, li)];
        }

        let rr = pix[i * 4] / 255, gg = pix[i * 4 + 1] / 255, bb = pix[i * 4 + 2] / 255;
        const m = (rr + gg + bb) / 3;
        rr = Math.max(0, m + (rr - m) * 1.7); gg = Math.max(0, m + (gg - m) * 1.7); bb = Math.max(0, m + (bb - m) * 1.7);
        const v = 0.3 + 0.7 * Math.pow(L, 0.7);
        const mx = Math.max(rr, gg, bb, 0.001);
        rr = Math.min(1, rr / mx * v); gg = Math.min(1, gg / mx * v); bb = Math.min(1, bb / mx * v);
        ctx.drawImage(sprite(chr, Math.round(rr * (Q - 1)), Math.round(gg * (Q - 1)), Math.round(bb * (Q - 1))), px + ox, py + oy, cw, ch);
      }
      ctx.globalAlpha = 1;
      if (alive && !reduce) raf = requestAnimationFrame(frame);
    };

    const onMove = (e: PointerEvent) => { const b = canvas.getBoundingClientRect(); mouse.x = e.clientX - b.left; mouse.y = e.clientY - b.top; };
    const onLeave = () => { mouse.x = mouse.y = -1e4; };
    const onResize = () => { setup(); if (reduce) frame(performance.now()); };

    img.onload = () => {
      setup();
      raf = requestAnimationFrame(frame);
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
  }, [src]);

  return <canvas ref={ref} className={className} aria-hidden="true" style={{ display: "block", width: "100%", height: "100%" }} />;
}
