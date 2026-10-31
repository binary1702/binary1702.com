"use client";

import { useEffect, useRef } from "react";

/* ------------------------------------------------------------------
   OceanicField — fresh water photo rendered as living ASCII.

   Based on CanopyField's image sampling approach, but with water-
   specific motion: horizontal flow, gentle undulation.
   ------------------------------------------------------------------ */

const FILL = " .:-=+*#@";
const EDGE = "|/-\\";
const Q = 5; // color levels per channel

type Props = {
  src?: string;
  className?: string;
  active?: boolean;
};

export default function OceanicField({ src = "/water.jpg", className, active = true }: Props) {
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
    let chars: string[] = [];
    let colR = new Float32Array(0), colG = new Float32Array(0), colB = new Float32Array(0), colV = new Float32Array(0);
    let cells: { p: number; dx: number; dy: number }[] = [];
    const sprites = new Map<string, HTMLCanvasElement>();
    const mouse = { x: -1e4, y: -1e4, vx: 0, vy: 0, px: -1e4, py: -1e4 };
    const t0 = performance.now();
    const img = new Image();

    const setup = (): boolean => {
      W = canvas.clientWidth; H = canvas.clientHeight;
      if (W < 2 || H < 2) return false;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cw = W < 700 ? 8 : W > 1800 ? 10 : 9;
      ch = cw * 1.5;
      cols = Math.ceil(W / cw); rows = Math.ceil(H / ch);
      sw = cols; sh = rows;

      const s = document.createElement("canvas"); s.width = sw; s.height = sh;
      const sc = s.getContext("2d")!; sc.imageSmoothingEnabled = true; sc.imageSmoothingQuality = "high";
      // Niagara - wide majestic view
      const zoom = 1.8;
      const ir = img.width / img.height, cr = W / H;
      let vw: number, vh: number, vx: number, vy: number;
      if (cr > ir) { vw = W * zoom; vh = vw / ir; vx = (W - vw) / 2; vy = (H - vh) / 2; } else { vh = H * zoom; vw = vh * ir; vy = (H - vh) / 2; vx = (W - vw) / 2; }
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
        // Boost brightness and saturation for fresh, vibrant look
        let rr = pix[i * 4] / 255, gg = pix[i * 4 + 1] / 255, bb = pix[i * 4 + 2] / 255;
        const m = (rr + gg + bb) / 3;
        const sat = 1.5; // boost saturation
        rr = Math.max(0, m + (rr - m) * sat); gg = Math.max(0, m + (gg - m) * sat); bb = Math.max(0, m + (bb - m) * sat);
        // Lift greens extra for freshness
        gg = Math.min(1, gg * 1.25);
        // Brighter overall - fresh water, not dark ocean
        const v = 0.45 + 0.55 * Math.pow(L, 0.6);
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

    const FRAME_MS = 1000 / 28;
    let lastDraw = 0;
    const frame = (now: number) => {
      if (!alive) return;
      if (!activeRef.current) { raf = 0; return; }
      raf = requestAnimationFrame(frame);
      if (now - lastDraw < FRAME_MS) return;
      lastDraw = now;

      const t = Math.max(0, (now - t0) / 1000);
      const fade = Math.min(1, t / 2.5);
      ctx.fillStyle = "#080a08"; ctx.fillRect(0, 0, W, H);
      mouse.vx = mouse.x - mouse.px; mouse.vy = mouse.y - mouse.py; mouse.px = mouse.x; mouse.py = mouse.y;
      const R = Math.min(W, H) * 0.22;
      ctx.globalAlpha = fade;

      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const k = r * cols + c, cl = cells[k];
        const px = c * cw, py = r * ch;
        let sx = c, sy = r, ox = 0, oy = 0;
        if (!reduce) {
          const ddx = px - mouse.x, ddy = py - mouse.y, d2 = ddx * ddx + ddy * ddy;
          if (d2 < R * R) { const d = Math.sqrt(d2); const f = (1 - d / R) ** 2; cl.dx += (mouse.vx * 0.12 + ddx / (d + 1) * 1.2) * f; cl.dy += (mouse.vy * 0.12 + ddy / (d + 1) * 1.2) * f; }
          cl.dx *= 0.9; cl.dy *= 0.9;
          // Horizontal flow + gentle vertical undulation (water motion)
          sx += Math.sin(t * 0.4 + cl.p + r * 0.1) * 0.35 + cl.dx * 0.2;
          sy += Math.cos(t * 0.25 + cl.p * 1.2 + c * 0.05) * 0.2 + cl.dy * 0.2;
          ox = cl.dx * 0.5; oy = cl.dy * 0.5;
        }
        const ix = sx < 0 ? 0 : sx >= sw ? sw - 1 : sx | 0, iy = sy < 0 ? 0 : sy >= sh ? sh - 1 : sy | 0;
        const i = iy * sw + ix;
        const rr = colR[i], gg = colG[i], bb = colB[i];
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
        raf = 1; frame(performance.now());
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
  }, [src]);

  useEffect(() => { if (active) wake.current(); }, [active]);

  return <canvas ref={ref} className={className} aria-hidden="true" style={{ display: "block", width: "100%", height: "100%", touchAction: "none" }} />;
}
