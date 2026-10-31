"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import s from "../engineering.module.css";

/* ------------------------------------------------------------------
   002 — Gaia · the sky over New York City, now — as a star globe.
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

const LAT = 40.7128, LON = -74.0060; // New York City — the app's default observer
const R = 350, CX = 400, CY = 374, VH = 796; // the whole globe, as large as the frame allows; caption band below
const TILT0 = 24; // how far the globe leans its north pole toward the viewer, at rest
const D2R = Math.PI / 180;
const PHOS = "#A36EFF"; // the instrument's one colour: rim, ticks, readouts, figures
const AMBER = "#FFB000";
const SLATE = "#8C98A8"; // the globe itself: sphere, limb, grid, horizon — neutral, so the violet figures stand out // the only other colour: whatever you're pointing at
/* monochrome terminal: every figure is dark violet; each gets its own intensity (stable, from its
   abbreviation) so neighbouring figures still read apart */
const conLevel = (abbr: string) => { let h = 0; for (const ch of abbr) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return 0.5 + (h % 5) * 0.1; };
const pad = (n: number, w: number) => String(Math.floor(n)).padStart(w, "0");
const hms = (deg: number) => { const h = deg / 15; return `${pad(h, 2)}:${pad((h % 1) * 60, 2)}`; };

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
/** The celestial sphere seen from outside, like an antique star globe: orthographic
 *  projection centred on (lon0, lat0). z is depth — >0 faces us, <0 is the far side. */
function globe(ra: number, dec: number, lon0: number, lat0: number) {
  const l = (ra - lon0) * D2R, φ = dec * D2R, φ0 = lat0 * D2R;
  const cosφ = Math.cos(φ);
  return {
    x: CX + R * cosφ * Math.sin(l),
    y: CY - R * (Math.cos(φ0) * Math.sin(φ) - Math.sin(φ0) * cosφ * Math.cos(l)),
    z: Math.sin(φ0) * Math.sin(φ) + Math.cos(φ0) * cosφ * Math.cos(l),
  };
}
type GP = { x: number; y: number; z: number };
/** a sampled curve on the sphere → SVG path of only its near-side runs */
function frontPath(pts: GP[]) {
  let d = "", pen = false;
  for (const p of pts) {
    if (p.z > 0) { d += `${pen ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`; pen = true; } else pen = false;
  }
  return d;
}
/** points on the great circle 90° from (ra0, dec0) — e.g. an observer's horizon */
function greatCircle(ra0: number, dec0: number, n = 144): [number, number][] {
  const a = ra0 * D2R, d = dec0 * D2R;
  const z = [Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)];
  const u = [-Math.sin(a), Math.cos(a), 0]; // east
  const v = [z[1] * u[2] - z[2] * u[1], z[2] * u[0] - z[0] * u[2], z[0] * u[1] - z[1] * u[0]]; // north
  const out: [number, number][] = [];
  for (let k = 0; k <= n; k++) {
    const t = (k / n) * 2 * Math.PI, c = Math.cos(t), s2 = Math.sin(t);
    const x = u[0] * c + v[0] * s2, y = u[1] * c + v[1] * s2, w = u[2] * c + v[2] * s2;
    out.push([(Math.atan2(y, x) / D2R + 360) % 360, Math.asin(w) / D2R]);
  }
  return out;
}

export default function GaiaExhibit() {
  const [sky, setSky] = useState<Sky | null>(null);
  const [t, setT] = useState(() => Date.now());
  const [hover, setHover] = useState<string | null>(null);
  const [con, setConRaw] = useState<string | null>(null);
  // hovering a figure: enter immediately, but leave only after a short grace period,
  // so crossing a gap between two lines of the same figure doesn't flicker it off
  const leaveT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setCon = (n: string | null) => {
    if (leaveT.current) { clearTimeout(leaveT.current); leaveT.current = null; }
    if (n) setConRaw(n);
    else leaveT.current = setTimeout(() => setConRaw(null), 180);
  };
  useEffect(() => () => { if (leaveT.current) clearTimeout(leaveT.current); }, []);
  const raf = useRef(0);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);
  const [tilt, setTilt] = useState(TILT0);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/data/sky.json").then((r) => r.json()).then((d: Sky) => { if (alive) setSky(d); });
    return () => { alive = false; };
  }, []);

  // the sky turns: 1 real second = 2 minutes of sky; stops under reduced motion,
  // and holds still while a star or figure is hovered so it can be read
  const paused = useRef(false);
  paused.current = hover !== null || con !== null;
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let last = performance.now();
    const tick = (now: number) => { const dt = now - last; last = now; if (!drag.current && !paused.current) setT((v) => v + dt * 360); raf.current = requestAnimationFrame(tick); };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, []);

  const lst = useMemo(() => (gmst(new Date(t)) + LON + 360) % 360, [t]);

  // The globe turns with the sky: its central meridian is New York's local sidereal time,
  // so the face toward you is always the part of the sky over the city right now.
  const placed = useMemo(() => {
    if (!sky) return null;
    const pos = new Map<string, GP & { alt: number }>();
    for (const st of sky.stars) pos.set(st[0], { ...globe(st[2], st[3], lst, tilt), alt: altaz(st[2], st[3], lst).alt });
    return pos;
  }, [sky, lst, tilt]);

  // graticule (every 2h of RA, every 30° of Dec) and New York's horizon, drawn on the sphere
  const grid = useMemo(() => {
    const lines: { d: string; strong: boolean }[] = [];
    for (let dec = -60; dec <= 60; dec += 30) {
      const pts: GP[] = []; for (let ra = 0; ra <= 360; ra += 4) pts.push(globe(ra, dec, lst, tilt));
      lines.push({ d: frontPath(pts), strong: dec === 0 });
    }
    for (let ra = 0; ra < 360; ra += 30) {
      const pts: GP[] = []; for (let dec = -88; dec <= 88; dec += 4) pts.push(globe(ra, dec, lst, tilt));
      lines.push({ d: frontPath(pts), strong: false });
    }
    const horizon = frontPath(greatCircle(lst, LAT).map(([ra, dec]) => globe(ra, dec, lst, tilt)));
    const zenith = globe(lst, LAT, lst, tilt);
    const pole = globe(0, 90, lst, tilt);
    return { lines, horizon, zenith, pole };
  }, [lst, tilt]);

  // the caption carries over from one figure (or star) to the next: it holds the
  // last thing hovered while the cursor crosses empty sky, and clears only when
  // the cursor leaves the sky altogether
  const [last, setLast] = useState<{ star: string | null; con: string | null }>({ star: null, con: null });
  useEffect(() => {
    if (hover) setLast({ star: hover, con: null });
    else if (con) setLast({ star: null, con });
  }, [hover, con]);
  const showStar = hover ?? (con ? null : last.star);
  const hovered = sky && showStar ? sky.stars.find((x) => x[0] === showStar) : null;
  const litCon = con ?? hovered?.[5] ?? (hover ? null : last.con);
  const conName = sky?.constellations.find((c) => c.a === litCon)?.n; // litCon is always an abbreviation
  const when = new Date(t);
  const visible = placed ? [...placed.values()].filter((p) => p.alt > 0).length : 0;
  const [still, setStill] = useState(false);
  useEffect(() => { setStill(window.matchMedia("(prefers-reduced-motion: reduce)").matches); }, []);

  // Drag turns the sky by hand: a sweep across the dome is ~180° of sky, i.e. twelve hours.
  const MS_PER_DEG = 86164000 / 360; // one sidereal day per full turn
  const onDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY }; setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = drag.current; if (!d || d.id !== e.pointerId) return;
    const svg = e.currentTarget; const unitsPerPx = 800 / svg.clientWidth;
    const dx = (e.clientX - d.x) * unitsPerPx, dy = (e.clientY - d.y) * unitsPerPx; d.x = e.clientX; d.y = e.clientY;
    setT((v) => v - dx * 0.3 * MS_PER_DEG); // drag sideways → spin the globe
    setTilt((v) => Math.max(-80, Math.min(80, v + dy * 0.3))); // drag up/down → tip it toward a pole
  };
  const onUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (drag.current?.id !== e.pointerId) return;
    drag.current = null; setDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  return (
    <div className={`${s.stageBody} ${s.gaiaBody}`}>
      <svg ref={svgRef} className={s.svg} viewBox={`0 0 800 ${VH}`} preserveAspectRatio="xMidYMid meet" role="group" aria-label="The night sky over New York City, now, as a star globe. Drag to spin and tilt it."
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        onPointerLeave={() => setLast({ star: null, con: null })}
        style={{ touchAction: "none", cursor: dragging ? "grabbing" : "grab", userSelect: "none" }}>
        <defs>
          <radialGradient id="gaia-sky" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(58,66,78,.55)" />
            <stop offset="100%" stopColor="rgba(26,30,36,.55)" />
          </radialGradient>
          {/* sphere shading: a highlight up-left falling to a dark limb, so the disc reads as a ball */}
          <radialGradient id="gaia-shade" cx="36%" cy="30%" r="75%">
            <stop offset="0%" stopColor="rgba(200,210,225,.14)" />
            <stop offset="45%" stopColor="rgba(120,130,145,.05)" />
            <stop offset="85%" stopColor="rgba(0,0,0,.35)" />
            <stop offset="100%" stopColor="rgba(0,0,0,.6)" />
          </radialGradient>
          {/* CRT scanlines, clipped to the dome */}
          <pattern id="gaia-scan" width="4" height="4" patternUnits="userSpaceOnUse">
            <rect width="4" height="1.2" fill="rgba(140,152,168,.05)" />
          </pattern>
          <clipPath id="gaia-dome"><circle cx={CX} cy={CY} r={R} /></clipPath>
          {/* phosphor bloom: the line itself plus a soft halo of its own colour */}
          <filter id="gaia-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.2" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* the globe: a lit sphere (light from upper left), scanlines, a glowing limb */}
        <circle cx={CX} cy={CY} r={R} fill="url(#gaia-sky)" />
        <circle cx={CX} cy={CY} r={R} fill="url(#gaia-shade)" />
        <circle cx={CX} cy={CY} r={R} fill="url(#gaia-scan)" />
        <circle cx={CX} cy={CY} r={R} fill="none" stroke={SLATE} strokeOpacity={0.7} strokeWidth={2} />
        <circle cx={CX} cy={CY} r={R + 14} fill="none" stroke={SLATE} strokeOpacity={0.22} strokeWidth={1} strokeDasharray="2 6" />

        {/* far side: stars seen faintly through the sphere, for depth */}
        {sky && placed && (
          <g style={{ pointerEvents: "none" }}>
            {sky.stars.map((st) => {
              const p = placed.get(st[0]); if (!p || p.z > 0 || st[4] > 3) return null;
              return <rect key={st[0]} x={p.x - 0.8} y={p.y - 0.8} width={1.6} height={1.6} fill={SLATE} opacity={0.3 * (1 + p.z)} />;
            })}
          </g>
        )}

        {/* graticule: right ascension meridians and declination parallels; the celestial equator brighter */}
        <g style={{ pointerEvents: "none" }}>
          {grid.lines.map((l, k) => l.d && (
            <path key={k} d={l.d} fill="none" stroke={SLATE} strokeOpacity={l.strong ? 0.5 : 0.22} strokeWidth={l.strong ? 1.6 : 1.1} strokeDasharray={l.strong ? undefined : "2 5"} />
          ))}
          {/* New York's horizon: everything inside this ring is above the city right now */}
          {grid.horizon && <path d={grid.horizon} fill="none" stroke={SLATE} strokeOpacity={0.85} strokeWidth={1.8} strokeDasharray="7 5" />}
          {grid.zenith.z > 0 && (
            <g>
              <path d={`M${grid.zenith.x - 10} ${grid.zenith.y}H${grid.zenith.x - 4}M${grid.zenith.x + 4} ${grid.zenith.y}H${grid.zenith.x + 10}M${grid.zenith.x} ${grid.zenith.y - 10}V${grid.zenith.y - 4}M${grid.zenith.x} ${grid.zenith.y + 4}V${grid.zenith.y + 10}`} stroke={SLATE} strokeWidth={1.6} />
              <text x={grid.zenith.x + 14} y={grid.zenith.y - 8} className={s.tiny} style={{ fill: SLATE, fontSize: 11.5 }}>NYC ZENITH</text>
            </g>
          )}
          {grid.pole.z > 0 && <text x={grid.pole.x} y={grid.pole.y - 8} textAnchor="middle" className={s.tiny} style={{ fill: SLATE, fontSize: 11 }}>NCP</text>}
        </g>

        {/* constellation figures, in phosphor. The hovered one pops: it scales up around its own
            centre with a little overshoot, lifts on a shadow, shows its stars, and is drawn last so
            it sits on top of everything else. */}
        <g filter="url(#gaia-glow)">
        {sky && placed && [...sky.constellations].sort((a, b) => Number(a.a === litCon) - Number(b.a === litCon)).map((c) => {
          const on = c.a === litCon;
          const segs = c.l
            .map((ln) => ln.map((id) => placed.get(id)).filter((p): p is GP & { alt: number } => !!p && p.z > 0.02))
            .filter((pts) => pts.length >= 2);
          if (!segs.length) return null;
          const all = segs.flat();
          const cx = all.reduce((a, p) => a + p.x, 0) / all.length, cy = all.reduce((a, p) => a + p.y, 0) / all.length;
          const ids = on ? [...new Set(c.l.flat())] : [];
          return (
            <g key={c.a} onPointerEnter={() => setCon(c.a)} onPointerLeave={() => setCon(null)} style={{ cursor: "pointer" }}>
              <g style={{
                transformBox: "view-box", transformOrigin: `${cx.toFixed(1)}px ${cy.toFixed(1)}px`,
                transform: on ? "scale(1.45)" : "scale(1)",
                transition: "transform 420ms cubic-bezier(.34,1.56,.64,1), filter 300ms ease",
                filter: on ? "drop-shadow(0 12px 14px rgba(0,0,0,.75)) drop-shadow(0 0 10px rgba(255,176,0,.45))" : "none",
              }}>
                {segs.map((pts, i) => {
                  const d = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
                  const depth = Math.min(...pts.map((p) => p.z)); // fade toward the limb
                  const up = pts.some((p) => p.alt > 0); // above New York right now
                  return (<g key={i}>
                    {/* wide invisible stroke: the hover target, much fatter than the visible line */}
                    <polyline points={d} fill="none" stroke="transparent" strokeWidth={18} strokeLinecap="round" strokeLinejoin="round" pointerEvents="stroke" />
                    <polyline points={d} fill="none" stroke={on ? AMBER : PHOS} strokeOpacity={on ? 1 : (litCon ? 0.18 : conLevel(c.a)) * (up ? 1 : 0.4) * (0.35 + 0.65 * depth)} strokeWidth={on ? 2.6 : 2.2} strokeLinecap="square" strokeLinejoin="miter" style={{ transition: "stroke-opacity 250ms ease" }} pointerEvents="none" />
                  </g>);
                })}
                {/* its stars ride along with the figure while it's lifted */}
                {ids.map((id) => {
                  const p = placed.get(id); if (!p || p.z <= 0.02) return null;
                  return <rect key={id} x={p.x - 2.6} y={p.y - 2.6} width={5.2} height={5.2} fill="#FFFFFF" pointerEvents="none" />;
                })}
              </g>
            </g>
          );
        })}
        </g>

        {/* stars as pixels; the brightest get a targeting reticle */}
        {sky && placed && sky.stars.map((st) => {
          const p = placed.get(st[0]); if (!p || p.z <= 0.02) return null;
          const mag = st[4];
          const r = Math.max(0.9, 3.4 - mag * 0.6) * (0.6 + 0.4 * p.z);
          const on = hover === st[0], inCon = litCon && st[5] === litCon;
          const a = Math.min(1, 0.55 + (3 - mag) * 0.18) * (p.alt > 0 ? 1 : 0.45) * (0.4 + 0.6 * p.z);
          const [cr, cg, cb] = starColor(st[7]);
          const sz = on ? r * 2 + 3 : r * 2;
          const fill = on ? AMBER : inCon ? "#FFFFFF" : `rgba(${cr},${cg},${cb},${a.toFixed(2)})`;
          const named = on || (st[1] && mag < 1.2 && p.z > 0.25);
          return (
            <g key={st[0]} onPointerEnter={() => setHover(st[0])} onPointerLeave={() => setHover(null)} style={{ cursor: "pointer" }}>
              <rect x={p.x - r - 5} y={p.y - r - 5} width={r * 2 + 10} height={r * 2 + 10} fill="transparent" />
              <rect x={p.x - sz / 2} y={p.y - sz / 2} width={sz} height={sz} fill={fill} />
              {(mag < 1.2 || on) && (() => {
                const g = r + 4, l = 4, c = on ? AMBER : "rgba(242,239,231,.55)";
                return <path d={`M${p.x - g} ${p.y - g + l}V${p.y - g}H${p.x - g + l} M${p.x + g - l} ${p.y - g}H${p.x + g}V${p.y - g + l} M${p.x + g} ${p.y + g - l}V${p.y + g}H${p.x + g - l} M${p.x - g + l} ${p.y + g}H${p.x - g}V${p.y + g - l}`} fill="none" stroke={c} strokeWidth={1.1} />;
              })()}
              {named && <text x={p.x + r + 9} y={p.y + 4} className={s.tiny} style={{ fill: on ? AMBER : "#F2EFE7", fontSize: 12.5, paintOrder: "stroke", stroke: "rgba(0,0,0,.85)", strokeWidth: 3 }}>{(st[1] || st[0]).toUpperCase()}</text>}
            </g>
          );
        })}

        {/* terminal readouts: observer top-left, count top-right, the hovered thing as a caption bottom-left */}
        <g style={{ pointerEvents: "none" }}>
          <text x={8} y={28} className={s.tiny} style={{ fill: "#F2EFE7", fontSize: 18, fontWeight: 700, paintOrder: "stroke", stroke: "rgba(0,0,0,.8)", strokeWidth: 4 }}>
            &gt; NEW YORK CITY
            <tspan fill={PHOS}>{" "}█{!still && <animate attributeName="opacity" values="1;1;0;0" keyTimes="0;.5;.5;1" dur="1.1s" repeatCount="indefinite" />}</tspan>
          </text>
          <text x={8} y={50} className={s.tiny} style={{ fill: "rgba(163,110,255,.95)", fontSize: 13 }}>40.71°N 074.01°W</text>
          <text x={792} y={28} textAnchor="end" className={s.tiny} style={{ fill: PHOS, fontSize: 18, fontWeight: 700, paintOrder: "stroke", stroke: "rgba(0,0,0,.8)", strokeWidth: 4 }}>VISIBLE {visible}</text>
          <text x={792} y={50} textAnchor="end" className={s.tiny} style={{ fill: "rgba(163,110,255,.95)", fontSize: 13 }}>
            LST {hms(lst)} · {when.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false })}
          </text>

          {/* bottom-centre caption, under the S: the hovered star or figure */}
          {hovered ? (
            <>
              <text x={CX} y={VH - 40} textAnchor="middle" className={s.tiny} style={{ fill: AMBER, fontSize: 22, fontWeight: 700, paintOrder: "stroke", stroke: "rgba(0,0,0,.85)", strokeWidth: 4 }}>{(hovered[1] || hovered[0]).toUpperCase()}</text>
              <text x={CX} y={VH - 14} textAnchor="middle" className={s.tiny} style={{ fill: "#F2EFE7", fontSize: 13.5 }}>
                {(sky?.constellations.find((c) => c.a === hovered[5])?.n ?? hovered[5]).toUpperCase()} · MAG {hovered[4].toFixed(2)}{hovered[6] ? ` · ${Math.round(hovered[6]).toLocaleString("en-US")} LY` : ""}{hovered[7] ? ` · ${hovered[7].toUpperCase()}` : ""}
              </text>
            </>
          ) : conName ? (
            <text x={CX} y={VH - 26} textAnchor="middle" className={s.tiny} style={{ fill: AMBER, fontSize: 22, fontWeight: 700, paintOrder: "stroke", stroke: "rgba(0,0,0,.85)", strokeWidth: 4 }}>{conName.toUpperCase()}</text>
          ) : null}
        </g>
      </svg>
    </div>
  );
}
