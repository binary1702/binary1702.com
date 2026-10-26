import type { GenerativeSystem, Pointer } from "./types";

/* ------------------------------------------------------------------
   Experiment A — Architecture of Chaos.  Lorenz attractor.

     dx/dt = σ (y − x)
     dy/dt = x (ρ − z) − y
     dz/dt = x y − β z        σ = 10, ρ = 28, β = 8/3

   A single trajectory is integrated (RK4) and kept as a ring of
   points. Each frame the ring is rotated by a slowly orbiting camera,
   projected with perspective, and splatted into the density field.
   Nearer points are brighter and denser; the tint runs stone → ivory
   with depth, so the sculpture reads as lit from the front.
   ------------------------------------------------------------------ */

const SIGMA = 10, RHO = 28, BETA = 8 / 3;
const TRAIL = 7000;      // points kept
const STEPS = 28;        // integration steps per frame at 60fps
const DT = 0.0045;

export class LorenzSystem implements GenerativeSystem {
  readonly id = "chaos";
  readonly title = "Architecture of Chaos";
  readonly algorithm = "Lorenz attractor · RK4 integration · perspective projection";
  readonly description =
    "Three coupled differential equations. One trajectory, never repeating, never leaving. The structure is not drawn — it is the only place the equations allow the point to go.";

  density = new Float32Array(0);
  tint = new Float32Array(0);
  private cols = 0;
  private rows = 0;

  private px = new Float32Array(TRAIL);
  private py = new Float32Array(TRAIL);
  private pz = new Float32Array(TRAIL);
  private head = 0;
  private filled = 0;
  private x = 0.1; private y = 0; private z = 0;

  private yaw = 0;
  private pitch = 0;
  private targetYaw = 0;
  private targetPitch = 0;

  constructor() {
    // warm up so the first frame is already on the attractor
    for (let i = 0; i < 3000; i++) this.integrate();
  }

  resize(cols: number, rows: number) {
    this.cols = cols; this.rows = rows;
    this.density = new Float32Array(cols * rows);
    this.tint = new Float32Array(cols * rows);
  }

  private integrate() {
    const f = (x: number, y: number, z: number) => [SIGMA * (y - x), x * (RHO - z) - y, x * y - BETA * z];
    const { x, y, z } = this;
    const k1 = f(x, y, z);
    const k2 = f(x + k1[0] * DT / 2, y + k1[1] * DT / 2, z + k1[2] * DT / 2);
    const k3 = f(x + k2[0] * DT / 2, y + k2[1] * DT / 2, z + k2[2] * DT / 2);
    const k4 = f(x + k3[0] * DT, y + k3[1] * DT, z + k3[2] * DT);
    this.x += (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]) * DT / 6;
    this.y += (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]) * DT / 6;
    this.z += (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]) * DT / 6;
    this.px[this.head] = this.x; this.py[this.head] = this.y; this.pz[this.head] = this.z;
    this.head = (this.head + 1) % TRAIL;
    if (this.filled < TRAIL) this.filled++;
  }

  step(dt: number, t: number, pointer: Pointer) {
    const steps = Math.max(1, Math.round(STEPS * dt * 60));
    for (let i = 0; i < steps; i++) this.integrate();

    // camera: slow orbit, pointer nudges it
    this.targetYaw = Math.sin(t * 0.09) * 0.18 + (Number.isNaN(pointer.x) ? 0 : (pointer.x / this.cols - 0.5) * 0.3);
    this.targetPitch = Math.sin(t * 0.06) * 0.14 + (Number.isNaN(pointer.y) ? 0 : (pointer.y / this.rows - 0.5) * 0.3);
    this.yaw += (this.targetYaw - this.yaw) * 0.04;
    this.pitch += (this.targetPitch - this.pitch) * 0.04;

    const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const { cols, rows, density, tint } = this;
    density.fill(0); tint.fill(0);

    // fit: the attractor spans roughly x∈[-20,20], z∈[0,50]; z is "up" on screen
    const scale = Math.min(cols / 64, (rows * 1.55) / 64);
    const cxs = cols / 2, cys = rows / 2;
    const camDist = 110;

    for (let n = 0; n < this.filled; n++) {
      const i = (this.head - 1 - n + TRAIL) % TRAIL;
      const x0 = this.px[i], y0 = this.py[i], z0 = this.pz[i] - 25;
      // yaw: spin about the vertical (z) axis; then pitch: tilt about the screen's x axis
      const X = x0 * cy - y0 * sy, D = x0 * sy + y0 * cy;
      const Y = z0 * cp - D * sp, Z = z0 * sp + D * cp;
      const persp = camDist / (camDist + Z);
      const sx = cxs + X * scale * persp;
      const syy = cys - Y * scale * persp / 1.55;
      const c = sx | 0, r = syy | 0;
      if (c < 0 || c >= cols || r < 0 || r >= rows) continue;
      const k = r * cols + c;
      const depth = Math.max(0, Math.min(1, 0.5 - Z / 60)); // 1 = near the camera
      const age = 1 - n / this.filled;                        // 1 = newest
      const d = (0.035 + 0.075 * depth) * (0.55 + 0.45 * age);
      density[k] = Math.min(1, density[k] + d);
      tint[k] = Math.max(tint[k], 0.2 + 0.8 * depth);
    }
  }
}
