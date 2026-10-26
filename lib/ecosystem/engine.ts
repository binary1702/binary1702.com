/* ------------------------------------------------------------------
   Binary 1702 — living threshold.

   One continuous particle system. Every glyph in the rain is a particle
   carrying a single scalar, `dev` (deviation ∈ [0,1]), that says how far
   it has drifted from mechanical order toward organic behavior. Nothing
   is sequenced; the four "states" are the same rules weighted by `dev`:

     dev ≈ 0   ORDER         column-locked fall, glyph trails (the Matrix rain)
     dev ↑     EMERGENCE     curl-noise flow bends the trajectory
     dev ≫     ORGANIZATION  neighbor forces pull kin into cells and branches
     dev → 1   LIFE          clusters breathe, age, dissolve, and the particle
                             falls back into the rain to be reborn

   `dev` relaxes toward a target set by a slow global tide, a drifting
   spatial susceptibility field (so life forms in patches), cursor
   proximity, and click energy — then decays when a particle has lived
   out its lifespan. That decay is what makes structures dissolve and
   regenerate without any scripted timeline.

   Pure TypeScript. No React in here; the component only mounts a canvas
   and hands it over.
   ------------------------------------------------------------------ */

import { SimplexNoise } from "./noise";
import { SpatialGrid } from "./grid";

export type EcosystemOptions = {
  isMobile: boolean;
  reducedMotion: boolean;
  /** Cap on devicePixelRatio. */
  maxDpr?: number;
};

type Pulse = { x: number; y: number; t0: number; strength: number };

const GLYPHS =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ123456789@#$%^&*()*&^%+-/~{[|`]}".split("");

// --- palette -------------------------------------------------------
// Rain keeps its original muted sand. Life glows faintly in a cool
// bioluminescent teal; a minority of particles carry the brand violet
// so the organism reads as Binary 1702, not generic sci-fi.
const RAIN_RGB = [0x6e, 0x6e, 0x6e];
const LIFE_RGB = [0x8a, 0xd4, 0xc6];
const VIOLET_RGB = [0x9c, 0x8e, 0xd4];

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export class Ecosystem {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private opts: Required<EcosystemOptions>;

  // Viewport in CSS pixels
  private w = 1;
  private h = 1;
  private dpr = 1;

  // Typography of the rain
  private fontSize: number;
  private columns = 1;

  // Particle state — struct of arrays
  private n = 0;
  private x!: Float32Array;
  private y!: Float32Array;
  private vx!: Float32Array;
  private vy!: Float32Array;
  private dev!: Float32Array;      // deviation from order, 0..1
  private age!: Float32Array;      // seconds spent organized
  private lifespan!: Float32Array; // seconds before dissolving
  private rest!: Float32Array;     // refractory countdown after dissolving
  private phase!: Float32Array;    // personal breathing phase
  private speed!: Float32Array;    // personal fall speed (px/s)
  private col!: Int16Array;        // home column
  private glyph!: Uint8Array;
  private glyphT!: Float32Array;   // seconds until next glyph change
  private violet!: Uint8Array;     // 1 = carries the brand tint
  private nbrs!: Uint8Array;       // neighbor count this frame (for drawing)

  private noise = new SimplexNoise(1702);
  private grid: SpatialGrid;
  private curl = new Float32Array(2);

  // External influences
  private pointerX = -1e9;
  private pointerY = -1e9;
  private pointerActive = false;
  private pulses: Pulse[] = [];

  // Time
  private t = 0;
  private last = 0;
  private raf = 0;
  private running = false;
  private destroyed = false;

  // Tunables (scaled for mobile in the constructor)
  private readonly interactR: number;
  private readonly separationR: number;
  private readonly flowScale = 0.0028;
  private readonly flowStrength: number;

  constructor(canvas: HTMLCanvasElement, opts: EcosystemOptions) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("Canvas 2D unavailable");
    this.ctx = ctx;
    this.opts = { maxDpr: opts.isMobile ? 1.5 : 2, ...opts };

    this.fontSize = opts.isMobile ? 12 : 13;
    this.interactR = this.fontSize * (opts.isMobile ? 3.0 : 3.4);
    this.separationR = this.fontSize * 1.1;
    this.flowStrength = opts.isMobile ? 55 : 70;
    this.grid = new SpatialGrid(this.interactR);

    this.resize();
    this.seed();
  }

  // ------------------------------------------------------------------
  // Lifecycle
  // ------------------------------------------------------------------

  start(): void {
    if (this.destroyed) return;
    if (this.opts.reducedMotion) {
      this.renderStill();
      return;
    }
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const loop = (now: number) => {
      if (!this.running) return;
      let dt = (now - this.last) / 1000;
      this.last = now;
      if (dt > 1 / 30) dt = 1 / 30; // never let a hitch explode the physics
      this.t += dt;
      this.step(dt);
      this.draw(dt);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop(): void {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  destroy(): void {
    this.stop();
    this.destroyed = true;
  }

  setReducedMotion(reduced: boolean): void {
    this.opts.reducedMotion = reduced;
    if (reduced) {
      this.stop();
      this.renderStill();
    } else {
      this.start();
    }
  }

  // ------------------------------------------------------------------
  // Input — influences, never triggers
  // ------------------------------------------------------------------

  setPointer(x: number, y: number): void {
    this.pointerX = x;
    this.pointerY = y;
    this.pointerActive = true;
  }

  clearPointer(): void {
    this.pointerActive = false;
    this.pointerX = -1e9;
    this.pointerY = -1e9;
  }

  /** A click or tap injects energy that seeds local organization. */
  inject(x: number, y: number, strength = 1): void {
    this.pulses.push({ x, y, t0: this.t, strength });
    if (this.pulses.length > 10) this.pulses.shift();
    if (this.opts.reducedMotion) this.renderStill();
  }

  // ------------------------------------------------------------------
  // Geometry
  // ------------------------------------------------------------------

  resize(): void {
    const w = Math.max(1, this.canvas.clientWidth || window.innerWidth);
    const h = Math.max(1, this.canvas.clientHeight || window.innerHeight);
    const dpr = Math.min(this.opts.maxDpr, window.devicePixelRatio || 1);

    const areaBefore = this.w * this.h;
    this.w = w;
    this.h = h;
    this.dpr = dpr;

    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.fillStyle = "#000";
    this.ctx.fillRect(0, 0, w, h);

    this.columns = Math.max(1, Math.floor(w / this.fontSize));

    // Re-seed only on a real change of world size (orientation flip,
    // window drag), not on the address bar sliding in and out.
    const areaAfter = w * h;
    if (this.n > 0) {
      const ratio = areaAfter / Math.max(1, areaBefore);
      if (ratio > 1.4 || ratio < 0.7) this.seed();
      else this.grid.resize(w, h, this.n);
      for (let i = 0; i < this.n; i++) {
        if (this.x[i] > w) { this.x[i] = Math.random() * w; this.col[i] = (this.x[i] / this.fontSize) | 0; }
        if (this.y[i] > h + 40) this.y[i] = Math.random() * h;
      }
    }
  }

  private seed(): void {
    const perColumn = this.opts.isMobile ? 5 : 6.5;
    const n = Math.round(Math.min(this.opts.isMobile ? 420 : 1150, Math.max(220, this.columns * perColumn)));
    this.n = n;

    this.x = new Float32Array(n);
    this.y = new Float32Array(n);
    this.vx = new Float32Array(n);
    this.vy = new Float32Array(n);
    this.dev = new Float32Array(n);
    this.age = new Float32Array(n);
    this.lifespan = new Float32Array(n);
    this.rest = new Float32Array(n);
    this.phase = new Float32Array(n);
    this.speed = new Float32Array(n);
    this.col = new Int16Array(n);
    this.glyph = new Uint8Array(n);
    this.glyphT = new Float32Array(n);
    this.violet = new Uint8Array(n);
    this.nbrs = new Uint8Array(n);

    for (let i = 0; i < n; i++) {
      this.col[i] = Math.floor(Math.random() * this.columns);
      this.x[i] = (this.col[i] + 0.5) * this.fontSize;
      // Original rain started drops above the viewport and let them fall in.
      this.y[i] = Math.random() * this.h * 2 - this.h;
      this.speed[i] = this.fontSize * (14 + Math.random() * 10); // ~180–310 px/s
      this.vy[i] = this.speed[i];
      this.phase[i] = Math.random() * Math.PI * 2;
      this.lifespan[i] = 14 + Math.random() * 26;
      this.glyph[i] = (Math.random() * GLYPHS.length) | 0;
      this.glyphT[i] = Math.random() * 0.5;
      this.violet[i] = Math.random() < 0.18 ? 1 : 0;
    }
    this.grid.resize(this.w, this.h, n);
  }

  // ------------------------------------------------------------------
  // The tide: a slow, non-repeating global energy in [0,1].
  // Three incommensurate periods, all starting at their trough so the
  // first visit opens in pure order and emergence arrives on its own.
  // ------------------------------------------------------------------
  private tide(t: number): number {
    const a = -0.55 * Math.cos((2 * Math.PI * t) / 151);
    const b = -0.30 * Math.cos((2 * Math.PI * t) / 61 + 0.4);
    const c = -0.15 * Math.cos((2 * Math.PI * t) / 23);
    return clamp01(0.5 + 0.5 * (a + b + c));
  }

  /** Energy from recent clicks at a point, with spatial and temporal falloff. */
  private pulseEnergy(px: number, py: number): number {
    let e = 0;
    for (let k = 0; k < this.pulses.length; k++) {
      const p = this.pulses[k];
      const dt = this.t - p.t0;
      if (dt > 14) continue;
      const dx = px - p.x, dy = py - p.y;
      const r2 = dx * dx + dy * dy;
      const radius = 160 + dt * 18; // the ripple widens as it fades
      e += p.strength * Math.exp(-r2 / (radius * radius)) * Math.exp(-dt / 5);
    }
    return e;
  }

  // ------------------------------------------------------------------
  // Simulation
  // ------------------------------------------------------------------

  private step(dt: number): void {
    const { n, x, y, vx, vy, dev, age, lifespan, rest, phase, speed, col, glyph, glyphT, nbrs } = this;
    const { w, h, fontSize, interactR, separationR, t } = this;
    const E = this.tide(t);
    const maxNbrs = this.opts.isMobile ? 9 : 12;

    // Drop pulses that have fully faded.
    if (this.pulses.length && t - this.pulses[0].t0 > 14) this.pulses.shift();

    this.grid.rebuild(x, y, n);

    const pActive = this.pointerActive;
    const px = this.pointerX, py = this.pointerY;

    for (let i = 0; i < n; i++) {
      const d = dev[i];
      const xi = x[i], yi = y[i];

      // ---- 1. Where does this particle want to be on the order↔life axis?
      // Susceptibility drifts slowly through space: life forms in patches.
      const patch = 0.5 + 0.5 * this.noise.noise3(xi * 0.0016, yi * 0.0016, t * 0.012);
      let target = E * 1.35 * (0.25 + patch) - 0.22;

      // Local energy from clicks.
      const pulse = this.pulseEnergy(xi, yi);
      target += pulse * 0.9;

      // Cursor: localized growth within a soft radius.
      let cdx = 0, cdy = 0, cr = 1e9;
      if (pActive) {
        cdx = px - xi; cdy = py - yi;
        cr = Math.sqrt(cdx * cdx + cdy * cdy);
        if (cr < 190) {
          const g = 1 - cr / 190;
          target += 0.55 * g * g;
        }
      }

      // Life cycle: organized particles age; after their lifespan they
      // dissolve (target forced down) and rest before they can reorganize.
      if (rest[i] > 0) {
        rest[i] -= dt;
        target = Math.min(target, 0.05);
      } else if (d > 0.75) {
        age[i] += dt;
        if (age[i] > lifespan[i]) {
          age[i] = 0;
          rest[i] = 4 + Math.random() * 6;
          lifespan[i] = 14 + Math.random() * 26;
        }
      } else if (d < 0.3) {
        age[i] = Math.max(0, age[i] - dt * 0.5);
      }

      target = clamp01(target);
      // Organizing is slow and deliberate; dissolving is a little faster.
      const rate = target > d ? 0.22 : 0.4;
      const nd = d + (target - d) * (1 - Math.exp(-rate * dt));
      dev[i] = nd;

      const order = 1 - nd;
      const order2 = order * order;
      const life = nd * nd;

      // ---- 2. ORDER: fall down a column at a personal speed.
      const homeX = (col[i] + 0.5) * fontSize;
      vx[i] += (homeX - xi) * 18 * order2 * dt;
      vy[i] += (speed[i] - vy[i]) * 6 * order2 * dt;

      // ---- 3. EMERGENCE: a divergence-free flow field bends the path.
      if (nd > 0.02) {
        this.noise.curl2(xi * this.flowScale, yi * this.flowScale, t * 0.07, this.curl, 0.02);
        const f = this.flowStrength * nd * (0.5 + 0.5 * (1 - life)); // strongest mid-transition
        vx[i] += this.curl[0] * f * dt;
        vy[i] += this.curl[1] * f * dt;
        // Falling slows as the particle forgets gravity.
        vy[i] -= vy[i] * 2.2 * nd * dt;
      }

      // ---- 4. ORGANIZATION + LIFE: neighbor forces, breathing.
      let count = 0;
      if (nd > 0.3) {
        let cx = 0, cy = 0;
        let ax = 0, ay = 0;
        this.grid.forEachNear(xi, yi, (j) => {
          if (j === i || count >= maxNbrs) return;
          const dj = dev[j];
          if (dj < 0.3) return;
          const dx = x[j] - xi, dy = y[j] - yi;
          const r2 = dx * dx + dy * dy;
          if (r2 > interactR * interactR || r2 < 1e-4) return;
          const r = Math.sqrt(r2);
          const wgt = nd * dj;
          count++;
          cx += x[j]; cy += y[j];
          if (r < separationR) {
            // Separation: cells need room — the source of negative space.
            const s = (separationR - r) / separationR;
            ax -= (dx / r) * s * 420 * wgt;
            ay -= (dy / r) * s * 420 * wgt;
          } else {
            // Cohesion: spring toward kin, strongest at mid-range.
            const s = (r - separationR) / (interactR - separationR);
            const pull = s * (1 - s) * 4; // peaks between separation and reach
            ax += (dx / r) * pull * 95 * wgt;
            ay += (dy / r) * pull * 95 * wgt;
          }
        });

        if (count > 0) {
          cx /= count; cy /= count;
          // Breathing: a slow radial oscillation around the local centroid,
          // phase-offset per particle so clusters shimmer rather than pump.
          const bx = xi - cx, by = yi - cy;
          const br = Math.sqrt(bx * bx + by * by) || 1;
          const breath = Math.sin(t * 0.9 + phase[i] + (cx + cy) * 0.004) * 26 * life;
          ax += (bx / br) * breath;
          ay += (by / br) * breath;
        }
        vx[i] += ax * dt;
        vy[i] += ay * dt;
      }
      nbrs[i] = count;

      // ---- Cursor as a gentle attractor with a little turbulence.
      if (pActive && cr < 240) {
        const g = (1 - cr / 240);
        const pull = g * g * 38 * (0.25 + nd);
        vx[i] += (cdx / (cr + 1)) * pull * dt;
        vy[i] += (cdy / (cr + 1)) * pull * dt;
        vx[i] += (Math.random() - 0.5) * 30 * g * nd * dt;
        vy[i] += (Math.random() - 0.5) * 30 * g * nd * dt;
      }

      // ---- Click ripple: a brief outward push so energy visibly arrives.
      if (pulse > 0.02) {
        for (let k = 0; k < this.pulses.length; k++) {
          const p = this.pulses[k];
          const dtp = t - p.t0;
          if (dtp > 0.9) continue;
          const dx = xi - p.x, dy = yi - p.y;
          const r = Math.sqrt(dx * dx + dy * dy) + 1;
          if (r > 240) continue;
          const kick = (1 - dtp / 0.9) * (1 - r / 240) * 260 * p.strength;
          vx[i] += (dx / r) * kick * dt;
          vy[i] += (dy / r) * kick * dt;
        }
      }

      // ---- Viscosity grows with life: organisms move slowly.
      const damp = Math.exp(-(0.3 + 3.2 * nd) * dt);
      vx[i] *= damp;
      vy[i] *= damp;

      // ---- Integrate.
      x[i] += vx[i] * dt;
      y[i] += vy[i] * dt;

      // ---- Boundaries. Rain wraps top→bottom like the original; organized
      // particles are softly contained so colonies don't drift offscreen.
      if (y[i] > h + fontSize) {
        if (nd < 0.4 && Math.random() > 0.3) {
          y[i] = -Math.random() * h * 0.5;
          col[i] = Math.floor(Math.random() * this.columns);
          x[i] = (col[i] + 0.5) * fontSize;
          vx[i] = 0;
        } else {
          y[i] = h + fontSize; vy[i] *= -0.3;
        }
      } else if (y[i] < -h) {
        y[i] = -fontSize;
      }
      if (x[i] < -fontSize) { x[i] = -fontSize; vx[i] = Math.abs(vx[i]) * 0.3; }
      else if (x[i] > w + fontSize) { x[i] = w + fontSize; vx[i] = -Math.abs(vx[i]) * 0.3; }

      // Rain that has wandered re-homes to the nearest column so it can
      // slot back into the grid when it returns to order.
      if (nd < 0.2 && Math.abs(xi - homeX) > fontSize * 2.5) {
        col[i] = Math.max(0, Math.min(this.columns - 1, (xi / fontSize) | 0));
      }

      // ---- Glyph flicker: faster while emerging, calm once alive.
      glyphT[i] -= dt;
      if (glyphT[i] <= 0) {
        glyph[i] = (Math.random() * GLYPHS.length) | 0;
        const rateHz = 2 + 9 * nd * (1 - nd) * 4; // peaks mid-transition
        glyphT[i] = 1 / rateHz + Math.random() * 0.15;
      }
    }
  }

  // ------------------------------------------------------------------
  // Rendering
  // ------------------------------------------------------------------

  /**
   * @param exposure  Multiplies per-frame alphas. 1 for the animated loop,
   *                  where the trail veil integrates light over time; ~12
   *                  for a single still frame, which has no integration.
   */
  private draw(dt: number, exposure = 1): void {
    const { ctx, n, x, y, dev, nbrs, w, h, fontSize, interactR, t } = this;

    // Trail fade — the original 4% veil, slightly stronger so edges and
    // dots smear into soft light rather than accumulating.
    ctx.fillStyle = `rgba(0,0,0,${Math.min(0.12, 0.055 * (dt * 60))})`;
    ctx.fillRect(0, 0, w, h);

    // ---- Edges between organized kin. Drawn first so nodes sit on top.
    ctx.lineWidth = 0.75;
    ctx.lineCap = "round";
    for (let i = 0; i < n; i++) {
      const di = dev[i];
      if (di < 0.55 || nbrs[i] === 0) continue;
      const xi = x[i], yi = y[i];
      let drawn = 0;
      this.grid.forEachNear(xi, yi, (j) => {
        if (j <= i || drawn >= 5) return;
        const dj = dev[j];
        if (dj < 0.55) return;
        const dx = x[j] - xi, dy = y[j] - yi;
        const r2 = dx * dx + dy * dy;
        const reach = interactR * 0.95;
        if (r2 > reach * reach) return;
        const r = Math.sqrt(r2);
        // Steady-state brightness under the veil ≈ a / 0.055, so ~0.03 → ~0.5.
        const a = 0.03 * di * dj * (1 - r / reach);
        const c = this.violet[i] && this.violet[j] ? VIOLET_RGB : LIFE_RGB;
        ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${Math.min(1, a * exposure).toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(xi, yi);
        ctx.lineTo(x[j], y[j]);
        ctx.stroke();
        drawn++;
      });
    }

    // ---- Glyphs and nodes. Each particle is a glyph fading into a point
    // of light as it comes alive — the same object, a different state.
    ctx.font = `${fontSize}px monospace`;
    ctx.textBaseline = "alphabetic";
    for (let i = 0; i < n; i++) {
      const d = dev[i];
      const xi = x[i], yi = y[i];
      if (yi < -fontSize || yi > h + fontSize) continue;

      const glyphA = 1 - smoothstep(0.45, 0.85, d);
      const dotA = smoothstep(0.4, 0.8, d);
      const tint = this.violet[i] ? VIOLET_RGB : LIFE_RGB;
      const mix = smoothstep(0.15, 0.7, d);
      const r = lerp(RAIN_RGB[0], tint[0], mix) | 0;
      const g = lerp(RAIN_RGB[1], tint[1], mix) | 0;
      const b = lerp(RAIN_RGB[2], tint[2], mix) | 0;

      if (glyphA > 0.02) {
        ctx.fillStyle = `rgba(${r},${g},${b},${(glyphA * 0.95).toFixed(3)})`;
        ctx.fillText(GLYPHS[this.glyph[i]], xi - fontSize * 0.5, yi + fontSize * 0.35);
      }
      if (dotA > 0.02) {
        const pulse = 0.5 + 0.5 * Math.sin(t * 1.3 + this.phase[i]);
        const radius = 0.9 + 1.1 * d + 0.6 * pulse * d;
        // Per-frame alpha is low on purpose: organized nodes barely move,
        // so the veil integrates them up to a soft glow (~a / 0.055).
        const a = dotA * (0.035 + 0.03 * pulse) * (0.6 + 0.4 * Math.min(1, nbrs[i] / 4));
        ctx.fillStyle = `rgba(${r},${g},${b},${Math.min(1, a * exposure).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(xi, yi, radius, 0, Math.PI * 2);
        ctx.fill();
        // Soft halo on well-connected nodes: bioluminescence, not neon.
        if (nbrs[i] >= 3 && d > 0.8) {
          ctx.fillStyle = `rgba(${r},${g},${b},${Math.min(1, a * 0.15 * exposure).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(xi, yi, radius * 4.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  /**
   * Reduced motion: no animation loop. Advance the system to a calm,
   * mid-life moment and render one still tableau without trails.
   */
  private renderStill(): void {
    this.t = 42; // a point on the tide where order and life coexist
    for (let k = 0; k < 240; k++) this.step(1 / 30);
    const { ctx, w, h } = this;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);
    this.draw(0, 12);
  }
}
