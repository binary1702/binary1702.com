import type { GenerativeSystem, Pointer } from "./types";

/* ------------------------------------------------------------------
   PointCloudSystem — a real 3D point cloud rendered as ASCII.

   Points come from geometry sampled offline (public/data/*.json):
   quantised x/y/z, a structure index per point, and a structure
   table (name, side, part). Each frame the cloud turns slowly about
   its vertical axis, tilts toward the pointer, is projected with
   perspective and splatted into the density/tint fields. Nearer
   points are brighter. A focused part is lit; the rest recede.
   The pointer also picks the nearest on-screen point so the exhibit
   can name the structure under the cursor.
   ------------------------------------------------------------------ */

export type CloudData = {
  regions: string[]; r: number[];   // per-point body region
  source: string; license: string; system: string; parts: string[];
  structures: { n: string; s: string; p: number; g: string }[];
  x: number[]; y: number[]; z: number[]; i: number[];
  totals: { structures: number; vertices: number; points: number };
};

export class PointCloudSystem implements GenerativeSystem {
  readonly id = "pointcloud";
  readonly title: string;
  readonly algorithm = "Sampled mesh vertices · perspective projection · depth-weighted splatting";
  readonly description: string;

  density = new Float32Array(0);
  tint = new Float32Array(0);
  private cols = 0; private rows = 0;
  private px: Float32Array; private py: Float32Array; private pz: Float32Array; readonly si: Uint16Array; readonly ri: Uint8Array;
  private yaw = Math.PI; private pitch = 0.08; private tyaw = Math.PI; private tpitch = 0.08;
  readonly sx: Float32Array; readonly sy: Float32Array; // last projected grid position per point (-1 when off-grid)
  readonly near: Float32Array;                           // 0..1 depth toward the viewer, per point
  get points() { return this.si.length; }
  /** region index to light, or -1 for all */
  focus = -1;
  /** structure index under the pointer, or -1 */
  hovered = -1;
  /** seconds; the cloud completes a turn in ~48 s */
  spin = 0.13;

  constructor(public readonly data: CloudData) {
    const n = data.i.length;
    this.px = new Float32Array(n); this.py = new Float32Array(n); this.pz = new Float32Array(n); this.si = new Uint16Array(n); this.ri = new Uint8Array(n);
    for (let k = 0; k < n; k++) { this.px[k] = data.x[k] / 4095 - 0.5; this.py[k] = data.y[k] / 4095 - 0.5; this.pz[k] = data.z[k] / 4095 - 0.5; this.si[k] = data.i[k]; this.ri[k] = data.r[k]; }
    this.sx = new Float32Array(n); this.sy = new Float32Array(n); this.near = new Float32Array(n);
    this.title = data.system;
    this.description = `${data.totals.structures} structures · ${data.totals.points.toLocaleString("en-US")} sampled points of ${data.totals.vertices.toLocaleString("en-US")} vertices`;
  }

  resize(cols: number, rows: number) {
    this.cols = cols; this.rows = rows;
    this.density = new Float32Array(cols * rows); this.tint = new Float32Array(cols * rows);
  }

  partOf(point: number) { return this.data.structures[this.si[point]].p; }

  step(dt: number, t: number, pointer: Pointer) {
    const { cols, rows, density, tint } = this;
    const hasP = !Number.isNaN(pointer.x);
    this.tyaw = Math.PI + Math.sin(t * this.spin) * 0.55 + (hasP ? (pointer.x / cols - 0.5) * 0.7 : 0); // faces the viewer; sways ±32° rather than turning its back
    this.tpitch = 0.08 + (hasP ? (pointer.y / rows - 0.5) * 0.35 : 0);
    this.yaw += (this.tyaw - this.yaw) * 0.05; this.pitch += (this.tpitch - this.pitch) * 0.05;
    const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw), cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);

    density.fill(0); tint.fill(0);
    const scale = rows * 1.55 * 0.98;          // the cloud's height ≈ the stage height
    const cxs = cols / 2, cys = rows / 2;
    const cam = 2.6;
    const n = this.si.length;
    let best = -1, bestD = 9;

    for (let k = 0; k < n; k++) {
      const x0 = this.px[k], y0 = this.py[k], z0 = this.pz[k];
      const X = x0 * cy - z0 * sy, D = x0 * sy + z0 * cy;      // spin about the vertical axis
      const Y = y0 * cp - D * sp, Z = y0 * sp + D * cp;         // tilt toward the viewer
      const persp = cam / (cam + Z);
      const gx = cxs + X * scale * persp, gy = cys - Y * scale * persp / 1.55;
      const near = Math.max(0, Math.min(1, 0.5 - Z));         // 1 = toward the viewer
      this.near[k] = near;
      const c = gx | 0, r = gy | 0;
      if (c < 0 || c >= cols || r < 0 || r >= rows) { this.sx[k] = -1; this.sy[k] = -1; continue; }
      this.sx[k] = gx; this.sy[k] = gy;
      const lit = this.focus < 0 || this.ri[k] === this.focus;
      const idx = r * cols + c;
      if (lit) {
        density[idx] = Math.min(1, density[idx] + 0.11 + 0.24 * near);
        tint[idx] = Math.max(tint[idx], 0.55 + 0.45 * near);     // forest → ivory with depth
      } else {
        density[idx] = Math.min(1, density[idx] + 0.035 + 0.05 * near);
        tint[idx] = Math.max(tint[idx], 0.06);                    // stone
      }
      if (hasP && lit) { const dx = gx - pointer.x, dy = (gy - pointer.y) * 1.55; const d = dx * dx + dy * dy; if (d < bestD) { bestD = d; best = k; } }
    }

    // the hovered structure, in full
    this.hovered = best >= 0 ? this.si[best] : -1;
    if (best >= 0) {
      const sidx = this.si[best];
      for (let k = 0; k < n; k++) {
        if (this.si[k] !== sidx) continue;
        const c = this.sx[k] | 0, r = this.sy[k] | 0;
        if (c < 0 || c >= cols || r < 0 || r >= rows) continue;
        density[r * cols + c] = 1; tint[r * cols + c] = 1;
      }
    }
  }
}
