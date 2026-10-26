import type { GenerativeSystem, Pointer } from "./types";

/* ------------------------------------------------------------------
   Experiment D — The Organism.  Stochastic excitable cellular field.

   Each cell holds an activity v ∈ [0,1]. Every step it looks at the
   eight cells around it and sums their activity s:
     1.9 < s < 4.8   → activation  (+0.14 · headroom)
     s ≥ 4.8         → inhibition  (−0.16)        crowding kills
     otherwise       → decay       (−0.025)       isolation fades
   plus a little noise and a constant drain. Colonies grow, split,
   starve and re-seed. The pointer deposits activity where it moves.
   Ported from Ben's "Computational Wilderness — 001" sketch.
   ------------------------------------------------------------------ */

export class OrganismSystem implements GenerativeSystem {
  readonly id = "organism";
  readonly title = "The Organism";
  readonly algorithm = "Excitable cellular field · activation / inhibition / decay";
  readonly description =
    "Local rules. Mutation. Growth and collapse. No cell knows the whole; the whole is what the rules add up to. Move to disturb it.";

  density = new Float32Array(0);
  tint = new Float32Array(0);
  private cols = 0; private rows = 0;
  private grid = new Float32Array(0);
  private next = new Float32Array(0);
  private frame = 0;
  private acc = 0;
  private seed = 1;

  private rand() {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  resize(cols: number, rows: number) {
    this.cols = cols; this.rows = rows;
    this.density = new Float32Array(cols * rows);
    this.tint = new Float32Array(cols * rows);
    this.grid = new Float32Array(cols * rows);
    this.next = new Float32Array(cols * rows);
    this.seed = (Date.now() ^ ((Math.random() * 0xffffffff) >>> 0)) >>> 0;
    this.frame = 0;
    for (let i = 0; i < this.grid.length; i++) this.grid[i] = this.rand() < 0.12 ? this.rand() : 0;
    for (let k = 0; k < 22; k++) this.mark(this.rand() * cols, this.rand() * rows, 3);
  }

  private mark(x: number, y: number, r: number) {
    const { cols, rows, grid } = this;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const xx = Math.floor(x + dx), yy = Math.floor(y + dy);
      if (xx >= 0 && xx < cols && yy >= 0 && yy < rows && dx * dx + dy * dy < r * r) grid[yy * cols + xx] = 1;
    }
  }

  step(dt: number, _t: number, pointer: Pointer) {
    // the sketch ran at ~28 fps; keep that cadence regardless of display rate
    this.acc += dt;
    if (this.acc < 1 / 28) return;
    this.acc = 0;
    this.frame++;

    const { cols, rows, grid, next } = this;
    for (let y = 1; y < rows - 1; y++) for (let x = 1; x < cols - 1; x++) {
      const i = y * cols + x;
      const s = grid[i - cols - 1] + grid[i - cols] + grid[i - cols + 1] + grid[i - 1] + grid[i + 1] + grid[i + cols - 1] + grid[i + cols] + grid[i + cols + 1];
      const v = grid[i];
      const activation = s > 1.9 && s < 4.8 ? 0.14 : s >= 4.8 ? -0.16 : -0.025;
      const noise = (this.rand() - 0.5) * 0.12;
      const nv = v + activation * (1 - v) + noise - 0.015;
      next[i] = nv < 0 ? 0 : nv > 1 ? 1 : nv;
    }
    this.grid = next; this.next = grid;
    if (this.frame % 55 === 0) this.mark(this.rand() * cols, this.rand() * rows, 2 + this.rand() * 7);
    if (!Number.isNaN(pointer.x) && this.frame % 3 === 0) this.mark(pointer.x, pointer.y, 3);

    const g = this.grid;
    for (let i = 0; i < g.length; i++) {
      const v = g[i];
      this.density[i] = v < 0.08 ? 0 : 0.12 + v * 0.88;
      this.tint[i] = 0.35 + v * 0.45; // forest green rising toward ivory as cells saturate
    }
  }
}
