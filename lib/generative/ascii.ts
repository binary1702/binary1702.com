/* ------------------------------------------------------------------
   AsciiRenderer — turns a density/tint field into characters on a
   Canvas 2D context.

   Glyphs are pre-rendered once per (ramp index × palette step) into
   small sprites, so a full frame is a few thousand drawImage calls
   rather than fillText calls. Cell geometry is DPR-aware.
   ------------------------------------------------------------------ */

export type Palette = {
  /** color stops along tint 0..1, as [r,g,b] */
  stops: [number, number, number][];
  background: string;
};

/* Binary 1702 lab palette: stone → forest → ivory on ink black. */
export const PALETTE: Palette = {
  stops: [
    [86, 82, 74],    // stone
    [111, 140, 104], // muted forest green
    [242, 239, 231], // warm ivory
  ],
  background: "#0A0A0A",
};

export const RAMP = " .:-=+*#%@";

const TINT_STEPS = 24;
const BRIGHT_STEPS = 6;

export class AsciiRenderer {
  cols = 0;
  rows = 0;
  cw = 0;
  ch = 0;
  private dpr = 1;
  private sprites: (HTMLCanvasElement | null)[] = [];
  private font = "";

  constructor(
    private ctx: CanvasRenderingContext2D,
    private palette: Palette = PALETTE,
    private ramp = RAMP,
    private cellPx = 10,
  ) {}

  /** Size the canvas to its CSS box; returns true if the grid changed. */
  resize(canvas: HTMLCanvasElement): boolean {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const cw = this.cellPx, ch = Math.round(this.cellPx * 1.55);
    const cols = Math.max(1, Math.floor(w / cw)), rows = Math.max(1, Math.floor(h / ch));
    const changed = cols !== this.cols || rows !== this.rows || dpr !== this.dpr;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.dpr = dpr; this.cw = cw; this.ch = ch; this.cols = cols; this.rows = rows;
    this.font = `500 ${Math.round(cw * 1.5)}px ui-monospace, "SF Mono", Menlo, Consolas, monospace`;
    if (changed) this.sprites = [];
    return changed;
  }

  /** Horizontal/vertical offset that centers the grid in the canvas. */
  get offsetX() { return (this.ctx.canvas.clientWidth - this.cols * this.cw) / 2; }
  get offsetY() { return (this.ctx.canvas.clientHeight - this.rows * this.ch) / 2; }

  private color(tint: number, bright: number): string {
    const s = this.palette.stops;
    const p = Math.max(0, Math.min(1, tint)) * (s.length - 1);
    const i = Math.min(s.length - 2, Math.floor(p)), f = p - i;
    const a = s[i], b = s[i + 1];
    const k = 0.35 + 0.65 * bright;
    const r = (a[0] + (b[0] - a[0]) * f) * k, g = (a[1] + (b[1] - a[1]) * f) * k, bl = (a[2] + (b[2] - a[2]) * f) * k;
    return `rgb(${r | 0},${g | 0},${bl | 0})`;
  }

  private sprite(ri: number, ti: number, bi: number): HTMLCanvasElement {
    const key = (ri * TINT_STEPS + ti) * BRIGHT_STEPS + bi;
    let s = this.sprites[key];
    if (s) return s;
    s = document.createElement("canvas");
    s.width = Math.ceil(this.cw * this.dpr);
    s.height = Math.ceil(this.ch * this.dpr);
    const c = s.getContext("2d")!;
    c.scale(this.dpr, this.dpr);
    c.font = this.font;
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillStyle = this.color(ti / (TINT_STEPS - 1), bi / (BRIGHT_STEPS - 1));
    c.fillText(this.ramp[ri], this.cw / 2, this.ch / 2);
    this.sprites[key] = s;
    return s;
  }

  draw(density: Float32Array, tint: Float32Array, alpha = 1) {
    const { ctx, cols, rows, cw, ch } = this;
    const ox = this.offsetX, oy = this.offsetY;
    if (this.palette.background === "transparent") ctx.clearRect(0, 0, ctx.canvas.clientWidth, ctx.canvas.clientHeight);
    else { ctx.fillStyle = this.palette.background; ctx.fillRect(0, 0, ctx.canvas.clientWidth, ctx.canvas.clientHeight); }
    ctx.globalAlpha = alpha;
    const n = this.ramp.length - 1;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        const d = density[i];
        if (d <= 0.02) continue;
        const ri = Math.min(n, Math.round(Math.min(1, d) * n));
        if (ri === 0) continue;
        const ti = Math.round(Math.max(0, Math.min(1, tint[i])) * (TINT_STEPS - 1));
        const bi = Math.round(Math.min(1, d) * (BRIGHT_STEPS - 1));
        ctx.drawImage(this.sprite(ri, ti, bi), ox + c * cw, oy + r * ch, cw, ch);
      }
    }
    ctx.globalAlpha = 1;
  }
}
