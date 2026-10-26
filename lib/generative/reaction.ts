import type { GenerativeSystem, Pointer } from "./types";

/* ------------------------------------------------------------------
   Experiment C — Emergence.  Gray–Scott reaction–diffusion.

     ∂u/∂t = Du ∇²u − u v² + F (1 − u)
     ∂v/∂t = Dv ∇²v + u v² − (F + k) v

   Two chemicals on a bounded grid. U feeds in, V eats U and
   replicates, both diffuse at different rates. With F = 0.037,
   k = 0.060 the field self-organises into dividing, branching
   structures — "mitosis". The simulation grid is 2× the character
   grid so the structures have smooth edges when sampled down.
   The pointer deposits V, seeding new growth where the visitor moves.
   ------------------------------------------------------------------ */

const DU = 1.0, DV = 0.5;
const F = 0.037, K = 0.060;
const ITER = 3;   // simulation steps per frame
const SS = 2;      // supersample factor

export class ReactionSystem implements GenerativeSystem {
  readonly id = "emergence";
  readonly title = "Emergence";
  readonly algorithm = "Gray–Scott reaction–diffusion · F 0.037 · k 0.060";
  readonly description =
    "Two chemicals, two rates of diffusion, one rule. The forms that appear were never specified — they are what the arithmetic settles into when it is left alone.";

  density = new Float32Array(0);
  tint = new Float32Array(0);
  private cols = 0; private rows = 0;
  private w = 0; private h = 0;
  private u = new Float32Array(0); private v = new Float32Array(0);
  private u2 = new Float32Array(0); private v2 = new Float32Array(0);

  resize(cols: number, rows: number) {
    this.cols = cols; this.rows = rows;
    this.density = new Float32Array(cols * rows);
    this.tint = new Float32Array(cols * rows);
    this.w = cols * SS; this.h = rows * SS;
    const n = this.w * this.h;
    this.u = new Float32Array(n).fill(1); this.v = new Float32Array(n);
    this.u2 = new Float32Array(n); this.v2 = new Float32Array(n);
    this.seed();
  }

  private seed() {
    const { w, h, v } = this;
    // a few quiet seeds, off-centre, so the composition grows asymmetrically
    const spots = [[0.32, 0.42], [0.66, 0.58], [0.5, 0.3]];
    for (const [fx, fy] of spots) {
      const cx = fx * w | 0, cy = fy * h | 0;
      for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) {
        if (x * x + y * y > 9) continue;
        v[(cy + y) * w + cx + x] = 0.5;
      }
    }
  }

  private deposit(gx: number, gy: number) {
    const cx = gx * SS | 0, cy = gy * SS | 0;
    for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) {
      const xx = cx + x, yy = cy + y;
      if (xx < 1 || yy < 1 || xx >= this.w - 1 || yy >= this.h - 1) continue;
      this.v[yy * this.w + xx] = Math.min(1, this.v[yy * this.w + xx] + 0.4);
    }
  }

  step(dt: number, t: number, pointer: Pointer) {
    if (!Number.isNaN(pointer.x) && (Math.abs(pointer.vx) + Math.abs(pointer.vy) > 0.05 || pointer.down)) {
      this.deposit(pointer.x, pointer.y);
    }
    const { w, h } = this;
    let u = this.u, v = this.v, u2 = this.u2, v2 = this.v2;
    const iters = Math.max(1, Math.round(ITER * dt * 60));
    for (let it = 0; it < iters; it++) {
      for (let y = 1; y < h - 1; y++) {
        const row = y * w;
        for (let x = 1; x < w - 1; x++) {
          const i = row + x;
          const uu = u[i], vv = v[i];
          // 3×3 Laplacian (centre −1, edges .2, corners .05)
          const lu = (u[i - 1] + u[i + 1] + u[i - w] + u[i + w]) * 0.2
                   + (u[i - w - 1] + u[i - w + 1] + u[i + w - 1] + u[i + w + 1]) * 0.05 - uu;
          const lv = (v[i - 1] + v[i + 1] + v[i - w] + v[i + w]) * 0.2
                   + (v[i - w - 1] + v[i - w + 1] + v[i + w - 1] + v[i + w + 1]) * 0.05 - vv;
          const uvv = uu * vv * vv;
          u2[i] = uu + (DU * lu - uvv + F * (1 - uu));
          v2[i] = vv + (DV * lv + uvv - (F + K) * vv);
        }
      }
      // bounded: edges stay at rest
      [u, u2] = [u2, u]; [v, v2] = [v2, v];
    }
    this.u = u; this.v = v; this.u2 = u2; this.v2 = v2;

    // sample down to the character grid
    const { cols, rows, density, tint } = this;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      let s = 0;
      for (let y = 0; y < SS; y++) for (let x = 0; x < SS; x++) s += v[(r * SS + y) * w + c * SS + x];
      const val = s / (SS * SS);                 // ~0..0.4
      // soft edge: the field fades toward the frame so the box never reads as a box
      const ex = (c / cols) * 2 - 1, ey = (r / rows) * 2 - 1;
      const edge = Math.max(0, 1 - Math.pow(Math.max(Math.abs(ex), Math.abs(ey)), 6));
      const d = Math.min(1, val * 2.6) * edge;
      density[r * cols + c] = d;
      tint[r * cols + c] = 0.2 + 0.8 * Math.min(1, val * 3); // interiors ivory, fronts green, faint stone
    }
  }
}
