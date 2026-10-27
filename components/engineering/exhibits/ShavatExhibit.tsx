"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import s from "../engineering.module.css";

/* ------------------------------------------------------------------
   003 — Shavat · scripture as a city, seen from above at night.
   1,189 chapters as 1,189 cells; 66 books as 66 districts separated
   by streets of black, in canonical order. A cell's brightness is its
   verse count; its tint is the book's division. Hover a district to
   name it; click a cell to read the chapter's opening line and the
   sections the app divides it into. Nothing here is drawn by hand:
   every cell is a real chapter from the application's data.
   ------------------------------------------------------------------ */

type Ch = { n: number; v: number; s: string[]; t: string; vn?: number };
type Book = { slug: string; name: string; cat: string; ch: Ch[] };
type Data = { source: string; books: Book[] };

const CAT_LABEL: Record<string, string> = { pentateuch: "Torah", historical: "History", wisdom: "Wisdom", "major-prophets": "Prophets", "minor-prophets": "Prophets", gospels: "Gospels", acts: "Acts", pauline: "Epistles", general: "Epistles", apocalypse: "Revelation" };
const CAT_TINT: Record<string, [number, number, number]> = {
  pentateuch: [232, 200, 130], historical: [220, 190, 160], wisdom: [226, 176, 210], "major-prophets": [196, 180, 236], "minor-prophets": [196, 180, 236],
  gospels: [160, 214, 190], acts: [170, 204, 236], pauline: [170, 204, 236], general: [170, 204, 236], apocalypse: [236, 170, 140],
};

/* the map: districts packed left→right, top→bottom; each district is a block of cells w cells wide */
const CELL = 9, GAP = 1.5, STREET = 13, LABEL = 20, W = 800, PAD = 14;
/* every district in a row is the same height, so the labels beneath share one baseline;
   a district's width is whatever that height needs to hold its chapters */
const ROW_CELLS = 7;
const districtCols = (n: number) => Math.ceil(n / ROW_CELLS);

export default function ShavatExhibit() {
  const [data, setData] = useState<Data | null>(null);
  const [book, setBook] = useState<string | null>(null);
  const [sel, setSel] = useState<{ b: string; n: number } | null>(null);
  const [tick, setTick] = useState(0);
  const raf = useRef(0);

  useEffect(() => {
    let alive = true;
    fetch("/data/scripture.json").then((r) => r.json()).then((d: Data) => { if (alive) setData(d); });
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t0 = performance.now();
    const loop = (now: number) => { setTick((now - t0) / 1000); raf.current = requestAnimationFrame(loop); };
    raf.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf.current);
  }, []);

  const layout = useMemo(() => {
    if (!data) return null;
    const districts: { b: Book; x: number; y: number; w: number; h: number; cells: { c: Ch; x: number; y: number }[] }[] = [];
    const rowH = ROW_CELLS * (CELL + GAP) - GAP;
    let x = PAD, y = PAD;
    for (const b of data.books) {
      const cols = districtCols(b.ch.length);
      const w = cols * (CELL + GAP) - GAP;
      if (x + w > W - PAD) { x = PAD; y += rowH + LABEL + STREET; }
      // fill column by column, top to bottom, so a district is a solid block with a ragged right edge only
      const cells = b.ch.map((c, i) => ({ c, x: x + Math.floor(i / ROW_CELLS) * (CELL + GAP), y: y + (i % ROW_CELLS) * (CELL + GAP) }));
      districts.push({ b, x, y, w, h: rowH, cells });
      x += w + STREET;
    }
    return { districts, height: y + rowH + LABEL + PAD };
  }, [data]);

  const maxV = 176; // Psalm 119
  const hovered = data && book ? data.books.find((b) => b.slug === book) : null;
  const selBook = data && sel ? data.books.find((b) => b.slug === sel.b) : null;
  const selected = selBook && sel ? selBook.ch.find((c) => c.n === sel.n) : null;
  const H = layout ? layout.height + 70 : 560;

  return (
    <div className={s.stageBody}>
      <svg className={s.svg} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" role="group" aria-label="Scripture as a city map: 1,189 chapters in 66 districts">
        {layout && layout.districts.map((d) => {
          const lit = book === d.b.slug;
          const dim = book !== null && !lit;
          const [r, g, bl] = CAT_TINT[d.b.cat] ?? [242, 239, 231];
          return (
            <g key={d.b.slug} onPointerEnter={() => setBook(d.b.slug)} onPointerLeave={() => setBook(null)} style={{ cursor: "pointer" }}>
              <rect x={d.x - 3} y={d.y - 3} width={d.w + 6} height={d.h + 6} fill="transparent" />
              {d.cells.map(({ c, x, y }) => {
                const isSel = sel?.b === d.b.slug && sel.n === c.n;
                // brightness from verse count, with a slow breathing shimmer so the city reads as lit, not printed
                const base = 0.18 + Math.pow(c.v / maxV, 0.6) * 0.75;
                const shimmer = 0.04 * Math.sin(tick * 0.9 + x * 0.05 + y * 0.07);
                const a = dim ? base * 0.3 : Math.min(1, base + shimmer + (lit ? 0.15 : 0));
                return (
                  <rect key={c.n} x={x} y={y} width={CELL} height={CELL} onClick={(e) => { e.stopPropagation(); setSel({ b: d.b.slug, n: c.n }); }}
                        fill={isSel ? "#C98A3C" : `rgba(${r},${g},${bl},${a.toFixed(2)})`} style={{ transition: "fill 200ms ease" }} />
                );
              })}
              {(lit || d.w >= 50) && (
                <text x={d.x} y={d.y + d.h + 12} className={s.tiny} style={{ fill: lit ? "#F2EFE7" : "rgba(242,239,231,.4)", fontSize: 7.5 }}>{d.b.name.toUpperCase()}</text>
              )}
            </g>
          );
        })}

        {/* reading */}
        <g>
          {selected && selBook ? (
            <>
              <text x={PAD} y={H - 46} className={s.serifT} style={{ fontSize: 22 }}>{selBook.name} {selected.n}</text>
              <text x={PAD} y={H - 28} className={s.tiny} style={{ fill: "rgba(242,239,231,.6)", fontSize: 10 }}>{selected.v} VERSES · {selected.s.length} SECTIONS · {selected.s.slice(0, 4).join(" · ").toUpperCase()}{selected.s.length > 4 ? " · …" : ""}</text>
              {selected.t && (() => { const q = selected.t.replace(/^[“"‘']+|[”"’']+$/g, ""); const short = q.length > 118 ? q.slice(0, 116) + "…" : q; return (
                <text x={PAD} y={H - 8} className={s.serifT} style={{ fontSize: 14, fill: "rgba(242,239,231,.88)", fontStyle: "italic" }}>“{short}”<tspan style={{ fontStyle: "normal", fill: "rgba(242,239,231,.5)", fontSize: 10 }}>  {selBook.name} {selected.n}{selected.vn ? `:${selected.vn}` : ""}</tspan></text>
              ); })()}
            </>
          ) : hovered ? (
            <>
              <text x={PAD} y={H - 46} className={s.serifT} style={{ fontSize: 22 }}>{hovered.name}</text>
              <text x={PAD} y={H - 28} className={s.tiny} style={{ fill: "rgba(242,239,231,.6)", fontSize: 10 }}>{CAT_LABEL[hovered.cat]?.toUpperCase()} · {hovered.ch.length} CHAPTERS · {hovered.ch.reduce((a, c) => a + c.v, 0).toLocaleString("en-US")} VERSES</text>
            </>
          ) : null}
        </g>
      </svg>
    </div>
  );
}
