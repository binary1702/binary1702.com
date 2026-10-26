import type { GenerativeSystem, Pointer } from "./types";
import { SimplexNoise } from "@/lib/ecosystem/noise";

/* ------------------------------------------------------------------
   Experiment B — The Living Canopy.  L-system + flow field.

   Grammar (bracketed, stochastic angle):
     axiom  X
     X → F[+X][-X]FX
     F → FF
   expanded 5 generations. Each tree is a turtle walk of that string.

   Perspective: the camera looks straight up. Trunks start at the
   frame's edge and grow toward the vanishing point at centre; every
   generation is farther away, so segments shorten, thin and dim as
   they approach the middle. Finer branches sway in a curl-noise flow
   field (divergence-free, so the motion reads as air, not jitter).
   The pointer adds a local gust. Leaves are the terminal X symbols.
   ------------------------------------------------------------------ */

type Seg = { x0: number; y0: number; x1: number; y1: number; depth: number; gen: number; leaf: boolean };

const GENERATIONS = 5;
const TREES = 9;

function expand(axiom: string, gens: number) {
  let s = axiom;
  for (let g = 0; g < gens; g++) {
    let out = "";
    for (const ch of s) out += ch === "X" ? "F[+X][-X]FX" : ch === "F" ? "FF" : ch;
    s = out;
  }
  return s;
}

export class CanopySystem implements GenerativeSystem {
  readonly id = "canopy";
  readonly title = "The Living Canopy";
  readonly algorithm = "Bracketed L-system · turtle geometry · curl-noise flow field";
  readonly description =
    "A four-symbol grammar, rewritten five times, becomes a forest. Nothing here was drawn: the branching is the rule applied to itself, and the air is a divergence-free noise field.";

  density = new Float32Array(0);
  tint = new Float32Array(0);
  private cols = 0;
  private rows = 0;
  private noise = new SimplexNoise(1702);
  private grammar = expand("X", GENERATIONS);
  private segs: Seg[] = [];
  private gust = { x: 0, y: 0, cx: 0, cy: 0 };
  private flow = new Float32Array(2);

  resize(cols: number, rows: number) {
    this.cols = cols; this.rows = rows;
    this.density = new Float32Array(cols * rows);
    this.tint = new Float32Array(cols * rows);
  }

  /** Walk the grammar for one tree; sway is applied per generation from the flow field. */
  private grow(tree: number, t: number, out: Seg[]) {
    const { cols, rows } = this;
    const cx = cols / 2, cy = rows / 2;
    const a0 = (tree / TREES) * Math.PI * 2 + 0.4;
    // start just outside the frame, heading at the vanishing point
    const R = Math.max(cols, rows * 1.55) * 0.62;
    let x = cx + Math.cos(a0) * R, y = cy + Math.sin(a0) * R / 1.55;
    let heading = Math.atan2(cy - y, cx - x);
    let gen = 0;
    const stack: { x: number; y: number; h: number; g: number }[] = [];
    const base = 34 / Math.pow(2, GENERATIONS - 1); // trunk step length at generation 0

    const sway = (g: number) => {
      // finer branches feel the air more; trunks barely move
      this.noise.curl2(x * 0.02, y * 0.03, t * 0.12 + tree, this.flow, 0.01);
      const w = Math.pow(g / GENERATIONS, 2) * 0.55;
      const dx = x - this.gust.cx, dy = y - this.gust.cy, dd = dx * dx + dy * dy;
      const gust = dd < 400 ? (1 - dd / 400) * (this.gust.x * dx + this.gust.y * dy) * 0.02 : 0;
      return (this.flow[0] * 0.8 + this.flow[1] * 0.4) * w + gust;
    };

    for (const ch of this.grammar) {
      switch (ch) {
        case "F": {
          const dist = Math.hypot(x - cx, (y - cy) * 1.55);
          const far = 1 - Math.min(1, dist / R);        // 0 at edge (near), 1 at centre (far)
          if (far > 0.82) break;                        // the sky: nothing grows into the vanishing point
          const len = base * (1 - 0.6 * far);
          const h = heading + sway(gen) + (gen === 0 ? this.noise.noise3(tree * 3, far * 2, t * 0.05) * 0.06 : 0);
          const nx = x + Math.cos(h) * len, ny = y + Math.sin(h) * len / 1.55;
          out.push({ x0: x, y0: y, x1: nx, y1: ny, depth: far, gen, leaf: false });
          x = nx; y = ny;
          break;
        }
        case "+": heading += 0.52 + this.noise.noise3(x * 0.05, y * 0.05, tree) * 0.12; break;
        case "-": heading -= 0.52 + this.noise.noise3(y * 0.05, x * 0.05, tree) * 0.12; break;
        case "[": stack.push({ x, y, h: heading, g: gen }); gen++; break;
        case "]": {
          // leaf at the tip before we pop
          const dist = Math.hypot(x - cx, y - cy);
          out.push({ x0: x, y0: y, x1: x, y1: y, depth: 1 - Math.min(1, dist / R), gen, leaf: true });
          const s = stack.pop(); if (s) { x = s.x; y = s.y; heading = s.h; gen = s.g; }
          break;
        }
      }
    }
  }

  private splat(c: number, r: number, d: number, tn: number) {
    if (c < 0 || c >= this.cols || r < 0 || r >= this.rows) return;
    const k = r * this.cols + c;
    this.density[k] = Math.min(1, this.density[k] + d);
    this.tint[k] = Math.max(this.tint[k], tn);
  }

  step(dt: number, t: number, pointer: Pointer) {
    // pointer gust decays; a moving pointer pushes air
    if (!Number.isNaN(pointer.x)) { this.gust.cx = pointer.x; this.gust.cy = pointer.y; this.gust.x += pointer.vx * 0.5; this.gust.y += pointer.vy * 0.5; }
    this.gust.x *= 0.9; this.gust.y *= 0.9;

    this.segs.length = 0;
    for (let i = 0; i < TREES; i++) this.grow(i, t, this.segs);

    this.density.fill(0); this.tint.fill(0);
    for (const s of this.segs) {
      const near = 1 - s.depth;
      if (s.leaf) {
        this.splat(Math.round(s.x0), Math.round(s.y0), 0.08 + 0.14 * near, 0.6);
        continue;
      }
      // rasterise the segment; trunks (low gen, near) are thick and bright
      const thick = s.gen === 0 && near > 0.45 ? 2 : 1;
      const d = s.gen === 0 ? 0.3 + 0.55 * near : s.gen === 1 ? 0.14 + 0.3 * near : 0.07 + 0.16 * near;
      const tn = s.gen === 0 ? 0.1 + 0.55 * near : 0.42 + 0.3 * near; // trunks stone→ivory, branches green
      const n = Math.max(1, Math.ceil(Math.hypot(s.x1 - s.x0, (s.y1 - s.y0) * 1.55)));
      for (let i = 0; i <= n; i++) {
        const f = i / n;
        const c = Math.round(s.x0 + (s.x1 - s.x0) * f), r = Math.round(s.y0 + (s.y1 - s.y0) * f);
        this.splat(c, r, d, tn);
        if (thick > 1) this.splat(c + 1, r, d * 0.6, tn);
      }
    }
  }
}
