/* ------------------------------------------------------------------
   Generative systems — the contract between a simulation and the
   ASCII renderer.

   A system owns its mathematics. Each frame it writes two fields over
   the character grid:
     density[i]  0..1  how much "ink" the cell carries (→ glyph choice)
     tint[i]     0..1  where the cell sits on the palette (→ color)
   The renderer never knows what the system is; the system never
   knows it is being drawn as text. That is what lets a system be
   lifted out of the lab and reused elsewhere on the site.
   ------------------------------------------------------------------ */

export type Pointer = {
  /** grid-space pointer position (cells), or NaN when off-canvas */
  x: number;
  y: number;
  /** grid-space velocity (cells/frame) */
  vx: number;
  vy: number;
  down: boolean;
};

export interface GenerativeSystem {
  readonly id: string;
  readonly title: string;
  readonly algorithm: string;
  readonly description: string;

  density: Float32Array;
  tint: Float32Array;

  /** (Re)allocate for a grid; called on mount and resize. */
  resize(cols: number, rows: number): void;
  /** Advance the mathematics by dt seconds and refill density/tint. */
  step(dt: number, t: number, pointer: Pointer): void;
}
