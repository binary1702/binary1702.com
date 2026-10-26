/* ------------------------------------------------------------------
   Uniform spatial hash.

   Neighbor search is the one O(n²) trap in a particle system. Binning
   particles into cells the size of the interaction radius means each
   particle only inspects the 3×3 cells around it. Typed arrays and a
   linked-list-per-cell layout keep this allocation-free per frame.
   ------------------------------------------------------------------ */

export class SpatialGrid {
  private cellSize: number;
  private cols = 0;
  private rows = 0;
  private head = new Int32Array(0);
  private next = new Int32Array(0);

  constructor(cellSize: number) {
    this.cellSize = cellSize;
  }

  resize(width: number, height: number, capacity: number): void {
    this.cols = Math.max(1, Math.ceil(width / this.cellSize));
    this.rows = Math.max(1, Math.ceil(height / this.cellSize));
    const cells = this.cols * this.rows;
    if (this.head.length !== cells) this.head = new Int32Array(cells);
    if (this.next.length !== capacity) this.next = new Int32Array(capacity);
  }

  rebuild(x: Float32Array, y: Float32Array, count: number): void {
    this.head.fill(-1);
    const { cols, rows, cellSize } = this;
    for (let i = 0; i < count; i++) {
      let cx = (x[i] / cellSize) | 0;
      let cy = (y[i] / cellSize) | 0;
      if (cx < 0) cx = 0; else if (cx >= cols) cx = cols - 1;
      if (cy < 0) cy = 0; else if (cy >= rows) cy = rows - 1;
      const cell = cy * cols + cx;
      this.next[i] = this.head[cell];
      this.head[cell] = i;
    }
  }

  /**
   * Calls `visit(j)` for every particle in the 3×3 cell block around
   * (px, py). Callers do their own distance test; this is the coarse pass.
   */
  forEachNear(px: number, py: number, visit: (j: number) => void): void {
    const { cols, rows, cellSize, head, next } = this;
    const cx = (px / cellSize) | 0;
    const cy = (py / cellSize) | 0;
    const x0 = Math.max(0, cx - 1), x1 = Math.min(cols - 1, cx + 1);
    const y0 = Math.max(0, cy - 1), y1 = Math.min(rows - 1, cy + 1);
    for (let gy = y0; gy <= y1; gy++) {
      for (let gx = x0; gx <= x1; gx++) {
        let j = head[gy * cols + gx];
        while (j !== -1) {
          visit(j);
          j = next[j];
        }
      }
    }
  }
}
