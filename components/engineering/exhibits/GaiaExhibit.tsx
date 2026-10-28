"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import s from "../engineering.module.css";

/* ------------------------------------------------------------------
   004 — Gaia · the sky over Orangevale, now.
   793 Hipparcos stars and 88 constellation figures from the
   application's catalog, placed for the visitor's current moment:
   local sidereal time → hour angle → altitude/azimuth, projected onto
   a zenith-centred dome. Stars sized by magnitude. The sky turns
   with the Earth (sped up); hover a star to name it, a figure to
   light it.
   ------------------------------------------------------------------ */

type Star = [string, string, number, number, number, string, number | null, string]; // id, name, ra, dec, mag, constellation, ly, spectral
type Con = { a: string; n: string; l: string[][] };
type Sky = { source: string; stars: Star[]; constellations: Con[] };

const LAT = 38.67861, LON = -121.22472; // Orangevale, CA — the app's default observer
const R = 300, CX = 400, CY = 310;
const D2R = Math.PI / 180;

/** star colour from spectral class — the real tint of its light (O/B blue → A white → F/G yellow → K orange → M red) */
function starColor(spectral: string): [number, number, number] {
  const c = (spectral || "")[0];
  switch (c) {
    case "O": return [155, 176, 255];
    case "B": return [170, 191, 255];
    case "A": return [202, 215, 255];
    case "F": return [248, 247, 255];
    case "G": return [255, 244, 234];
    case "K": return [255, 210, 161];
    case "M": return [255, 172, 120];
    default:  return [242, 239, 231];
  }
}

/** Greenwich mean sidereal time in degrees for a JS Date */
function gmst(d: Date) {
  const jd = d.getTime() / 86400000 + 2440587.5;
  const t = (jd - 2451545) / 36525;
  let g = 280.46061837 + 360.98564736629 * (jd - 2451545) + 0.000387933 * t * t;
  return ((g % 360) + 360) % 360;
}
/** altitude / azimuth (deg) for RA/Dec at a given local sidereal time */
function altaz(ra: number, dec: number, lst: number) {
  const H = (lst - ra) * D2R, φ = LAT * D2R, δ = dec * D2R;
  const sinAlt = Math.sin(δ) * Math.sin(φ) + Math.cos(δ) * Math.cos(φ) * Math.cos(H);
  const alt = Math.asin(sinAlt);
  const y = -Math.sin(H), x = Math.tan(δ) * Math.cos(φ) - Math.sin(φ) * Math.cos(H);
  const az = Math.atan2(y, x);
  return { alt: alt / D2R, az: ((az / D2R) + 360) % 360 };
}
/** zenith-centred dome: north up, east left (as seen looking up) */
function project(alt: number, az: number) {
  const r = ((90 - alt) / 90) * R;
  const a = az * D2R;
  return { x: CX - Math.sin(a) * r, y: CY - Math.cos(a) * r };
}

export default function GaiaExhibit() {
  const [sky, setSky] = useState<Sky | null>(null);
  const [t, setT] = useState(() => Date.now());
  const [hover, setHover] = useState<string | null>(null);
  const [con, setCon] = useState<string | null>(null);
  const raf = useRef(0);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ id: number; x: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/data/sky.json").then((r) => r.json()).then((d: Sky) => { if (alive) setSky(d); });
    return () => { alive = false; };
  }, []);

  // the sky turns: 1 real second = 2 minutes of sky; stops under reduced motion
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let last = performance.now();
    const tick = (now: number) => { const dt = now - last; last = now; if (!drag.current) setT((v) => v + dt * 360); raf.current = requestAnimationFrame(tick); };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, []);

  const lst = useMemo(() => (gmst(new Date(t)) + LON + 360) % 360, [t]);

  const placed = useMemo(() => {
    if (!sky) return null;
    const pos = new Map<string, { x: number; y: number; alt: number }>();
    for (const st of sky.stars) { const { alt, az } = altaz(st[2], st[3], lst); if (alt > -2) { const p = project(alt, az); pos.set(st[0], { ...p, alt }); } }
    return pos;
  }, [sky, lst]);

  const hovered = sky && hover ? sky.stars.find((x) => x[0] === hover) : null;
  const litCon = con ?? hovered?.[5] ?? null;
  const conName = sky?.constellations.find((c) => c.n === litCon)?.n;
  const when = new Date(t);

  // Drag turns the sky by hand: a sweep across the dome is ~180° of sky, i.e. twelve hours.
  const MS_PER_DEG = 86164000 / 360; // one sidereal day per full turn
  const onDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    drag.current = { id: e.pointerId, x: e.clientX }; setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = drag.current; if (!d || d.id !== e.pointerId) return;
    const svg = e.currentTarget; const unitsPerPx = 800 / svg.clientWidth;
    const dx = (e.clientX - d.x) * unitsPerPx; d.x = e.clientX;
    setT((v) => v + dx * 0.3 * MS_PER_DEG); // drag right → sky turns the way it does with time
  };
  const onUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (drag.current?.id !== e.pointerId) return;
    drag.current = null; setDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  return (
    <div className={s.stageBody}>
      <svg ref={svgRef} className={s.svg} viewBox="0 0 800 650" preserveAspectRatio="xMidYMid meet" role="group" aria-label="The night sky over Orangevale, California, now. Drag to turn the sky."
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        style={{ touchAction: "pan-y", cursor: dragging ? "grabbing" : "grab", userSelect: "none" }}>
        <defs>
          <radialGradient id="gaia-sky" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(60,70,110,.22)" />
            <stop offset="100%" stopColor="rgba(10,12,24,.0)" />
          </radialGradient>
        </defs>
        <circle cx={CX} cy={CY} r={R} fill="url(#gaia-sky)" stroke="rgba(242,239,231,.22)" />
        <circle cx={CX} cy={CY} r={R * 2 / 3} fill="none" stroke="rgba(242,239,231,.07)" strokeDasharray="2 5" />
        <circle cx={CX} cy={CY} r={R / 3} fill="none" stroke="rgba(242,239,231,.07)" strokeDasharray="2 5" />
        <line x1={CX} y1={CY - R} x2={CX} y2={CY + R} stroke="rgba(242,239,231,.07)" strokeDasharray="2 5" />
        <line x1={CX - R} y1={CY} x2={CX + R} y2={CY} stroke="rgba(242,239,231,.07)" strokeDasharray="2 5" />
        {[["N", CX, CY - R - 12], ["S", CX, CY + R + 22], ["E", CX - R - 16, CY + 4], ["W", CX + R + 16, CY + 4]].map(([l, x, y]) => (
          <text key={l as string} x={x as number} y={y as number} textAnchor="middle" className={s.lbl} style={{ fontSize: 11, fill: "rgba(242,239,231,.7)" }}>{l}</text>
        ))}

        {/* constellation figures */}
        {sky && placed && sky.constellations.map((c) => {
          const on = c.n === litCon;
          return (
            <g key={c.a} onPointerEnter={() => setCon(c.n)} onPointerLeave={() => setCon(null)} style={{ cursor: "pointer" }}>
              {c.l.map((ln, i) => {
                const pts = ln.map((id) => placed.get(id)).filter((p): p is { x: number; y: number; alt: number } => !!p && p.alt > 0);
                if (pts.length < 2) return null;
                return <polyline key={i} points={pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")} fill="none" stroke={on ? "#C98A3C" : "rgba(140,160,210,.4)"} strokeWidth={on ? 1.3 : 0.8} style={{ transition: "stroke 250ms ease" }} />;
              })}
            </g>
          );
        })}

        {/* stars */}
        {sky && placed && sky.stars.map((st) => {
          const p = placed.get(st[0]); if (!p || p.alt <= 0) return null;
          const mag = st[4];
          const r = Math.max(0.8, 3.6 - mag * 0.6);
          const on = hover === st[0], inCon = litCon && st[5] === litCon;
          const a = Math.min(1, 0.55 + (3 - mag) * 0.18);
          const [cr, cg, cb] = starColor(st[7]);
          return (
            <g key={st[0]} onPointerEnter={() => setHover(st[0])} onPointerLeave={() => setHover(null)} style={{ cursor: "pointer" }}>
              <circle cx={p.x} cy={p.y} r={r + 5} fill="transparent" />
              {mag < 1.5 && <circle cx={p.x} cy={p.y} r={r * 2.4} fill={`rgba(${cr},${cg},${cb},.14)`} />}
              <circle cx={p.x} cy={p.y} r={on ? r + 2 : r} fill={on ? "#C98A3C" : inCon ? "#F2EFE7" : `rgba(${cr},${cg},${cb},${a.toFixed(2)})`} style={{ transition: "r 150ms ease" }} />
              {(on || (st[1] && mag < 1.2)) && <text x={p.x + r + 6} y={p.y + 3} className={s.tiny} style={{ fill: on ? "#C98A3C" : "rgba(242,239,231,.55)", fontSize: 9 }}>{st[1]}</text>}
            </g>
          );
        })}

        {/* reading */}
        <g>
          {/* the observer, under the dome */}
          <text x={CX} y={CY + R + 26} textAnchor="middle" className={s.tiny} style={{ fill: "rgba(242,239,231,.9)", fontSize: 11, paintOrder: "stroke", stroke: "rgba(0,0,0,.8)", strokeWidth: 3 }}>ORANGEVALE, CALIFORNIA · {when.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).toUpperCase()}</text>
          {hovered ? (
            <>
              <text x={16} y={34} className={s.serifT} style={{ fontSize: 24 }}>{hovered[1] || hovered[0].toUpperCase()}</text>
              <text x={16} y={56} className={s.tiny} style={{ fill: "rgba(242,239,231,.75)", fontSize: 10 }}>
                {hovered[5].toUpperCase()} · MAG {hovered[4].toFixed(2)}{hovered[6] ? ` · ${Math.round(hovered[6]).toLocaleString("en-US")} LIGHT-YEARS` : ""}{hovered[7] ? ` · ${hovered[7]}` : ""}
              </text>
            </>
          ) : conName ? (
            <text x={16} y={34} className={s.serifT} style={{ fontSize: 24 }}>{conName}</text>
          ) : null}
        </g>
      </svg>
    </div>
  );
}
