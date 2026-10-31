"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import s from "../engineering.module.css";

/* ------------------------------------------------------------------
   003 — Shavat · scripture as a city, seen from above at night.
   One quarter of the city at a time: the Pentateuch by default, with
   arrows to walk to the neighbouring quarters (History, History, Wisdom,
   Prophets, Gospels, Acts, Epistles, Revelation). Each chapter is a cell; each
   book is a district separated by streets of black, in canonical order. A cell's brightness is its
   verse count; its tint is the book's division. Hover a district to
   name it; click a cell to read the chapter's opening line and the
   sections the app divides it into. Nothing here is drawn by hand:
   every cell is a real chapter from the application's data.
   ------------------------------------------------------------------ */

type Ch = { n: number; v: number; s: string[]; t: string; vn?: number };
type Book = { slug: string; name: string; cat: string; ch: Ch[] };
type Data = { source: string; books: Book[] };

const CAT_TINT: Record<string, [number, number, number]> = {
  pentateuch: [232, 200, 130], historical: [220, 190, 160], wisdom: [226, 176, 210], "major-prophets": [196, 180, 236], "minor-prophets": [196, 180, 236],
  gospels: [160, 214, 190], acts: [170, 204, 236], pauline: [170, 204, 236], general: [170, 204, 236], apocalypse: [236, 170, 140],
};

/* quarters of the city, in canonical order; the exhibit opens on the Pentateuch */
const SECTIONS: { key: string; label: string; cats: string[]; add?: string[]; drop?: string[] }[] = [
  { key: "pentateuch", label: "Pentateuch", cats: ["pentateuch"] },
  { key: "history", label: "History", cats: ["historical"] },
  { key: "wisdom", label: "Wisdom", cats: ["wisdom"], add: ["lamentations"] },
  { key: "major-prophets", label: "Major Prophets", cats: ["major-prophets"], drop: ["lamentations"] },
  { key: "minor-prophets", label: "Minor Prophets", cats: ["minor-prophets"] },
  { key: "gospels", label: "Gospels", cats: ["gospels"] },
  { key: "acts", label: "Acts", cats: ["acts"] },
  { key: "epistles", label: "Epistles", cats: ["pauline", "general"] },
  { key: "revelation", label: "Revelation", cats: ["apocalypse"] },
];
const DEFAULT_SECTION = SECTIONS.findIndex((x) => x.key === "pentateuch");

/* the map: districts packed left→right, top→bottom; each district is a block of cells.
   every district in a row is the same height, so the labels above share one baseline;
   a district's width is whatever that height needs to hold its chapters.
   cell size is fitted per quarter so a small quarter (4 Gospels) fills the frame
   instead of floating as a speck, and a large one (Prophets) still fits. */
const W = 800, PAD = 14, NAV_H = 48, MAP_H = 300, LABEL = 26, READ_H = 200;
/* rough human-scale constants for the stats panel: ~25 words per verse across the Bible, read aloud at ~150 wpm */
const WORDS_PER_VERSE = 25, ALOUD_WPM = 150;
const PACE = 3; // chapters a day, for the "finish in" stat
const FADE_MS = 180;
const ROW_CELLS = 7;
const GLYPH = 0.78; // uppercase serif + letter-spacing: width per character as a fraction of font size
const H = NAV_H + MAP_H + READ_H;

export default function ShavatExhibit() {
  const [data, setData] = useState<Data | null>(null);
  const [book, setBook] = useState<string | null>(null);
  const [sel, setSel] = useState<{ b: string; n: number } | null>(null);
  const [tick, setTick] = useState(0);
  const [secIdx, setSecIdx] = useState(DEFAULT_SECTION);
  const section = SECTIONS[secIdx];
  const [phase, setPhase] = useState<{ shown: boolean; dir: number; instant?: boolean }>({ shown: true, dir: 0 });
  const swapT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const goTo = (target: number, dir: number) => {
    if (target === secIdx) return;
    if (swapT.current) clearTimeout(swapT.current);
    const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setBook(null); setSel(null);
    if (reduced) { setSecIdx(target); return; }
    setPhase({ shown: false, dir });                       // 1. current quarter drifts out
    swapT.current = setTimeout(() => {
      setSecIdx(target);                                   // 2. swap while invisible
      setPhase({ shown: false, dir: -dir, instant: true }); //    park the new one on the opposite side
      requestAnimationFrame(() => requestAnimationFrame(() => setPhase({ shown: true, dir: 0 }))); // 3. drift in
    }, FADE_MS);
  };
  const swapAt = useRef(0);
  useEffect(() => { swapAt.current = performance.now(); }, [secIdx, data]);
  const go = (dir: number) => goTo((secIdx + dir + SECTIONS.length) % SECTIONS.length, dir);
  useEffect(() => () => { if (swapT.current) clearTimeout(swapT.current); }, []);
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
    const books = data.books.filter((b) => (section.cats.includes(b.cat) || section.add?.includes(b.slug)) && !section.drop?.includes(b.slug));
    type D = { b: Book; x: number; y: number; w: number; h: number; cells: { c: Ch; x: number; y: number }[] };
    const build = (cell: number) => {
      const gap = Math.max(1.5, cell / 6), street = Math.max(13, cell * 0.8);
      const fs = Math.min(18, Math.max(11, cell * 0.8)); // one label size for the whole quarter
      // pass 1: shape each district. A short book is laid out wide and low instead of tall and thin,
      // so its block is at least as wide as its name; if even one row is narrower, the slot widens to the name.
      const shaped = books.map((b) => {
        const n = b.ch.length;
        const labelW = b.name.length * fs * GLYPH;
        const colsNeeded = Math.max(1, Math.ceil((labelW + gap) / (cell + gap)));
        const rowsN = Math.min(ROW_CELLS, Math.max(1, Math.ceil(n / colsNeeded)));
        const cols = Math.ceil(n / rowsN);
        const w = cols * (cell + gap) - gap, h = rowsN * (cell + gap) - gap;
        return { b, rowsN, w, h, slot: Math.max(w, labelW) };
      });
      // pass 2: pack slots into rows
      const rows: (typeof shaped)[] = [[]];
      let x = PAD;
      for (const d of shaped) {
        if (rows[rows.length - 1].length && x + d.slot > W - PAD) { rows.push([]); x = PAD; }
        rows[rows.length - 1].push(d);
        x += d.slot + street;
      }
      const rowHs = rows.map((r) => Math.max(...r.map((d) => d.h)));
      const height = rowHs.reduce((a, h) => a + h + LABEL, 0) + (rows.length - 1) * street;
      // pass 3: place, centring each row and the whole block in the map area; labels share a baseline per row
      const districts: D[] = [];
      let y = NAV_H + Math.max(0, (MAP_H - height) / 2);
      rows.forEach((row, ri) => {
        const rowW = row.reduce((a, r) => a + r.slot, 0) + (row.length - 1) * street;
        let rx = (W - rowW) / 2;
        const top = y + LABEL; // label band sits above the cells
        for (const { b, rowsN, w, h, slot } of row) {
          const dx = rx + (slot - w) / 2;
          // fill column by column, top to bottom
          const cells = b.ch.map((c, i) => ({ c, x: dx + Math.floor(i / rowsN) * (cell + gap), y: top + (i % rowsN) * (cell + gap) }));
          districts.push({ b, x: dx, y: top, w, h, cells });
          rx += slot + street;
        }
        y += rowHs[ri] + LABEL + street;
      });
      return { districts, height, cell, fs };
    };
    // largest cell size whose layout fits the map area
    for (let cell = 30; cell > 6; cell -= 0.5) {
      const l = build(cell);
      if (l.height <= MAP_H) return l;
    }
    return build(6);
  }, [data, section]);

  const maxV = 176; // Psalm 119
  const hovered = data && book ? data.books.find((b) => b.slug === book) : null;
  const selBook = data && sel ? data.books.find((b) => b.slug === sel.b) : null;
  const selected = selBook && sel ? selBook.ch.find((c) => c.n === sel.n) : null;
  const prev = SECTIONS[(secIdx - 1 + SECTIONS.length) % SECTIONS.length];
  const next = SECTIONS[(secIdx + 1) % SECTIONS.length];
  const navKey = (dir: number) => (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(dir); } };
  const sectionChapters = layout ? layout.districts.reduce((a, d) => a + d.b.ch.length, 0) : 0;
  const sectionVerses = layout ? layout.districts.reduce((a, d) => a + d.b.ch.reduce((x, c) => x + c.v, 0), 0) : 0;
  const days = Math.ceil(sectionChapters / PACE);
  const fx = phase.shown ? 0 : phase.dir * 8; // very gentle horizontal shift

  /* the human numbers: what this quarter actually costs and holds */
  const stats = useMemo(() => {
    if (!data || !layout) return null;
    const books = layout.districts.map((d) => d.b);
    const all = data.books.reduce((a, b) => a + b.ch.length, 0);
    let longest = { b: books[0], c: books[0].ch[0] }, shortest = longest;
    for (const b of books) for (const c of b.ch) {
      if (c.v > longest.c.v) longest = { b, c };
      if (c.v < shortest.c.v) shortest = { b, c };
    }
    const biggest = books.reduce((m, b) => (b.ch.length > m.ch.length ? b : m), books[0]);
    const hours = (sectionVerses * WORDS_PER_VERSE) / ALOUD_WPM / 60;
    return { books: books.length, share: (sectionChapters / all) * 100, longest, shortest, biggest, hours };
  }, [data, layout, sectionChapters, sectionVerses]);
  // no counting animation — just show the numbers
  const cu = (n: number) => n;
  const P0 = NAV_H + MAP_H + 14; // top of the panel below the map
  const fade = { opacity: phase.shown ? 1 : 0, transform: `translateX(${fx}px)`, transition: phase.instant ? "none" : `opacity ${FADE_MS}ms ease, transform ${FADE_MS}ms ease` };

  return (
    <div className={s.stageBody} style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
      <svg className={s.svg} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" role="group" aria-label={`Scripture as a city map: ${section.label}, ${layout?.districts.length ?? 0} books, ${sectionChapters} chapters`}
           onKeyDown={(e) => { if (e.key === "ArrowLeft") go(-1); if (e.key === "ArrowRight") go(1); }}>
        {/* quarter navigation: ‹ previous · CURRENT · next › */}
        <g>
          <g role="button" tabIndex={0} aria-label={`Previous: ${prev.label}`} onClick={() => go(-1)} onKeyDown={navKey(-1)} onMouseDown={(e) => e.preventDefault()} style={{ cursor: "pointer", outline: "none" }}>
            <rect x={PAD} y={8} width={170} height={28} fill="transparent" />
            <text x={PAD} y={27} className={s.tiny} style={{ fill: "rgba(242,239,231,.55)", fontSize: 11 }}>‹  {prev.label.toUpperCase()}</text>
          </g>
          <g style={fade}>
            <text x={W / 2} y={22} textAnchor="middle" className={s.serifT} style={{ fontSize: 20 }}>{section.label}</text>
          </g>
          <g>
            {SECTIONS.map((x, i) => (
              <circle key={x.key} cx={W / 2 - ((SECTIONS.length - 1) * 9) / 2 + i * 9} cy={34} r={i === secIdx ? 2.4 : 1.6}
                      fill={i === secIdx ? "#C98A3C" : "rgba(242,239,231,.3)"} style={{ cursor: "pointer" }}
                      onClick={() => goTo(i, i > secIdx ? 1 : -1)}><title>{x.label}</title></circle>
            ))}
          </g>
          <g role="button" tabIndex={0} aria-label={`Next: ${next.label}`} onClick={() => go(1)} onKeyDown={navKey(1)} onMouseDown={(e) => e.preventDefault()} style={{ cursor: "pointer", outline: "none" }}>
            <rect x={W - PAD - 170} y={8} width={170} height={28} fill="transparent" />
            <text x={W - PAD} y={27} textAnchor="end" className={s.tiny} style={{ fill: "rgba(242,239,231,.55)", fontSize: 11 }}>{next.label.toUpperCase()}  ›</text>
          </g>
        </g>

        <g style={fade}>
        {layout && layout.districts.map((d) => {
          const lit = book === d.b.slug;
          const dim = book !== null && !lit;
          const [r, g, bl] = CAT_TINT[section.cats[0]] ?? [242, 239, 231];
          return (
            <g key={d.b.slug} onPointerEnter={() => setBook(d.b.slug)} onPointerLeave={() => setBook(null)} style={{ cursor: "pointer" }}>
              <rect x={d.x - 3} y={d.y - 3} width={d.w + 6} height={d.h + 6} fill="transparent" />
              {d.cells.map(({ c, x, y }) => {
                const CELL = layout.cell;
                const isSel = sel?.b === d.b.slug && sel.n === c.n;
                // brightness from verse count, very subtle shimmer
                const base = 0.18 + Math.pow(c.v / maxV, 0.6) * 0.72;
                const shimmer = 0.015 * Math.sin(tick * 0.4 + x * 0.03 + y * 0.04);
                const a = dim ? base * 0.35 : Math.min(1, base + shimmer + (lit ? 0.1 : 0));
                return (
                  <rect key={c.n} x={x} y={y} width={CELL} height={CELL} onClick={(e) => { e.stopPropagation(); setSel({ b: d.b.slug, n: c.n }); }}
                        fill={isSel ? "#C98A3C" : `rgba(${r},${g},${bl},${a.toFixed(2)})`} style={{ transition: "fill 200ms ease" }} />
                );
              })}
              {(() => {
                // book names, softly tinted
                const fs = layout.fs;
                return (
                  <text x={d.x + d.w / 2} y={d.y - 9} textAnchor="middle" className={s.serifT}
                        style={{ fontSize: fs, letterSpacing: ".06em", pointerEvents: "none", fill: lit ? "rgba(255,255,255,.95)" : `rgba(${Math.min(255, r + 15)},${Math.min(255, g + 15)},${Math.min(255, bl + 15)},.85)`,
                                 opacity: dim ? 0.4 : 1, transition: "opacity 180ms ease, fill 180ms ease" }}>
                    {d.b.name.toUpperCase()}
                  </text>
                );
              })()}
            </g>
          );
        })}
        </g>

        {/* below the map: the reading when something is touched, the quarter's human numbers otherwise */}
        <line x1={PAD} x2={W - PAD} y1={P0} y2={P0} stroke="rgba(242,239,231,.12)" />
        <g>
          {selected && selBook ? (
            <>
              <text x={PAD} y={P0 + 44} className={s.serifT} style={{ fontSize: 30 }}>{selBook.name} {selected.n}</text>
              <text x={PAD} y={P0 + 68} className={s.tiny} style={{ fill: "rgba(242,239,231,.6)", fontSize: 11 }}>{selected.v} VERSES · {selected.s.length} SECTIONS · {selected.s.slice(0, 4).join(" · ").toUpperCase()}{selected.s.length > 4 ? " · …" : ""}</text>
              {selected.t && (() => { const q = selected.t.replace(/^[“"‘']+|[”"’']+$/g, ""); const short = q.length > 96 ? q.slice(0, 94) + "…" : q; return (
                <text x={PAD} y={P0 + 108} className={s.serifT} style={{ fontSize: 17, fill: "rgba(242,239,231,.9)", fontStyle: "italic" }}>“{short}”<tspan style={{ fontStyle: "normal", fill: "rgba(242,239,231,.5)", fontSize: 11 }}>  {selBook.name} {selected.n}{selected.vn ? `:${selected.vn}` : ""}</tspan></text>
              ); })()}
            </>
          ) : hovered ? (
            <>
              <text x={W / 2} y={P0 + 44} textAnchor="middle" className={s.serifT} style={{ fontSize: 30 }}>{hovered.name}</text>
              <text x={W / 2} y={P0 + 68} textAnchor="middle" className={s.tiny} style={{ fill: "rgba(242,239,231,.6)", fontSize: 11 }}>{section.label.toUpperCase()} · {hovered.ch.length} CHAPTERS · {hovered.ch.reduce((a, c) => a + c.v, 0).toLocaleString("en-US")} VERSES</text>
            </>
          ) : stats ? (
            <g style={fade}>
              {/* quiet summary */}
              <text x={W / 2} y={P0 + 48} textAnchor="middle" className={s.serifT} style={{ fontSize: 22, fill: "rgba(242,239,231,.85)" }}>
                {stats.books} {stats.books === 1 ? "book" : "books"}, {sectionChapters} chapters
              </text>
              <text x={W / 2} y={P0 + 78} textAnchor="middle" className={s.tiny} style={{ fill: "rgba(242,239,231,.45)", fontSize: 11, letterSpacing: ".12em" }}>
                HOVER A BOOK · CLICK A CHAPTER
              </text>
            </g>
          ) : null}
        </g>
      </svg>
    </div>
  );
}
