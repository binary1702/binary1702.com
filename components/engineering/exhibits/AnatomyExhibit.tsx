"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import s from "../engineering.module.css";
import PointCanvas from "@/components/engineering/PointCanvas";
import TerminalLoader from "@/components/engineering/TerminalLoader";
import { PointCloudSystem, type CloudData } from "@/lib/generative";

/* ------------------------------------------------------------------
   002 — Skeletor · Exploring biological structure.
   The application's real nervous-system geometry (Z-Anatomy, CC BY-SA
   4.0): 9,048+ points sampled from 2.4M vertices across 582 structures.
   Pick a part of the body; it is isolated, recentred and scaled to fill
   the stage. The cursor tilts it and names the structure beneath it.
   ------------------------------------------------------------------ */

/* Parts are cut from the whole body by position, not by the dataset's own
   region labels (its "Trunk" group carries arm and leg nerves too).
   Raw grid: y runs up (feet ≈ 0, brain ≈ 4000), body centre x ≈ 2047.
   Cut lines measured from the data:
     NECK_Y  — head & neck structures begin above ≈ 3400
     HIP_Y   — leg nerves top out at ≈ 2100
     ARM_X   — at torso height, body points sit within ≈ 370 of centre, arm points beyond ≈ 400 */
const CX = 2047;
const NECK_Y = 3400;
const HIP_Y = 2100;
/** Legs = everything below this line, nothing else considered. Set below the outer-thigh
 *  nerve branches (which read as hanging hands, y ≈ 1300–1600), so the view is clean legs.
 *  Raise it to show more thigh. */
const LEGS_CUT = 1300;
const ARM_X = 380;
const inBody = (x: number) => Math.abs(x - CX) < ARM_X;
/* The brachial plexus (shoulder/armpit, y ≈ 3200–3400) overlaps the torso's width,
   so no straight cut separates it; below the neck, arm nerves are assigned to Arms
   by name (above it, words like "median"/"radiation" name brain structures). */
const ARM_NERVE = /brachial|axillary|radial|ulnar|median|musculocutaneous/i;

type Keep = (x: number, y: number, armNerve: boolean) => boolean;
const PARTS: { label: string; full: string; keep: Keep }[] = [
  { label: "Skull", full: "The Human Skull", keep: (x, y) => y >= NECK_Y && inBody(x) },
  { label: "Chest", full: "The Human Chest", keep: (x, y, arm) => y >= HIP_Y && y < NECK_Y && inBody(x) && !arm },
  { label: "Arms", full: "The Human Arms", keep: (x, y, arm) => y < NECK_Y && (!inBody(x) || (arm && y >= HIP_Y)) },
  { label: "Legs", full: "The Human Legs", keep: (_x, y) => y < LEGS_CUT },
];

/** Keep the points a part selects, recentre and scale them to the full 0–4095 grid. */
function isolate(d: CloudData, keep: Keep): CloudData {
  const armIds = new Set<number>();
  d.structures.forEach((st, id) => { if (ARM_NERVE.test(st.n)) armIds.add(id); });
  const idx: number[] = [];
  for (let k = 0; k < d.x.length; k++) if (keep(d.x[k], d.y[k], armIds.has(d.i[k]))) idx.push(k);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const k of idx) {
    const x = d.x[k], y = d.y[k], z = d.z[k];
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
  }
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, cz = (minZ + maxZ) / 2;
  const scale = 4095 / Math.max(maxX - minX, maxY - minY, maxZ - minZ, 1);
  const at = (v: number, c: number) => Math.round((v - c) * scale + 2047.5);
  return {
    ...d,
    x: idx.map((k) => at(d.x[k], cx)),
    y: idx.map((k) => at(d.y[k], cy)),
    z: idx.map((k) => at(d.z[k], cz)),
    r: idx.map((k) => d.r[k]),
    i: idx.map((k) => d.i[k]), // structure ids unchanged → hover names still resolve
    totals: { ...d.totals, points: idx.length },
  };
}

export default function AnatomyExhibit() {
  const [raw, setRaw] = useState<CloudData | null>(null);
  const [part, setPart] = useState(0);
  const [hover, setHover] = useState(-1);
  const sysRef = useRef<PointCloudSystem | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/data/nervous-points.json").then((r) => r.json()).then((d: CloudData) => { if (alive) setRaw(d); })
      .catch((e) => console.warn("[skeletor] geometry failed to load", e));
    return () => { alive = false; };
  }, []);

  const keep = PARTS[part].keep;
  const subset = useMemo(() => (raw ? isolate(raw, keep) : null), [raw, keep]);
  const system = useMemo(() => (subset ? (sysRef.current = new PointCloudSystem(subset)) : null), [subset]);

  // read the hovered structure a few times a second — not per frame
  useEffect(() => {
    if (!system) return;
    setHover(-1);
    const id = window.setInterval(() => { const h = sysRef.current?.hovered ?? -1; setHover((v) => (v === h ? v : h)); }, 120);
    return () => window.clearInterval(id);
  }, [system]);

  const st = raw && hover >= 0 ? raw.structures[hover] : null;

  return (
    <>
      <div className={`${s.stageBody} an-body`} style={{ position: "relative" }}>
        <style>{`
          /* part selector — one column, right edge */
          .an-parts { position: absolute; right: 0; top: 50%; transform: translateY(-50%); z-index: 2; display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }
          .an-parts button {
            display: flex; align-items: baseline; gap: 12px;
            background: none; border: 0; padding: 6px 0; cursor: pointer;
            font-family: ui-monospace, 'SF Mono', Menlo, monospace; font-size: 15px; letter-spacing: .24em; text-transform: uppercase;
            color: rgba(242,239,231,.4); transition: color 150ms linear;
          }
          .an-parts button span { font-size: 10px; letter-spacing: .1em; color: rgba(242,239,231,.28); transition: color 150ms linear; }
          .an-parts button::after { content: ""; width: 0; height: 1px; align-self: center; background: #C98A3C; transition: width 240ms cubic-bezier(.2,.7,.2,1); }
          .an-parts button:hover { color: rgba(242,239,231,.85); }
          .an-parts button[aria-pressed="true"] { color: #F2EFE7; }
          .an-parts button[aria-pressed="true"] span { color: #C98A3C; }
          .an-parts button[aria-pressed="true"]::after { width: 22px; }
          .an-parts button:focus-visible { outline: 1px solid #C98A3C; outline-offset: 4px; }

          .an-stage { position: absolute !important; left: 0 !important; right: 0 !important; top: 16px !important; bottom: 0 !important; width: 100% !important; isolation: isolate; }
          /* the dark field: a true circle, larger than the stage, fading to nothing before its edge */
          .an-halo {
            position: absolute; left: 50%; top: 50%; height: 175%; aspect-ratio: 1; transform: translate(-50%, -50%); z-index: -1; pointer-events: none;
            background: radial-gradient(circle closest-side, rgba(0,0,0,.96) 0%, rgba(0,0,0,.92) 45%, rgba(0,0,0,.6) 72%, rgba(0,0,0,.2) 88%, rgba(0,0,0,0) 100%);
          }

          /* caption — one quiet line */
          .an-cap { position: relative; z-index: 1; min-height: 28px; padding-top: 8px; text-align: center; } /* above the dark circle */
          .an-one { margin: 0; font-family: 'Playfair Display', Georgia, serif; font-size: 15px; line-height: 1.4; color: rgba(242,239,231,.7); animation: anIn 500ms ease both; }
          .an-one b { font-weight: 400; margin-right: 12px; font-family: ui-monospace, 'SF Mono', Menlo, monospace; font-size: 9.5px; letter-spacing: .26em; text-transform: uppercase; color: #C98A3C; }
          .an-one em { font-style: italic; color: rgba(242,239,231,.45); }
          @keyframes anIn { from { opacity: 0; } to { opacity: 1; } }

          @media (max-width: 860px) {
            .an-parts { gap: 2px; }
            .an-parts button { font-size: 12px; letter-spacing: .18em; gap: 8px; }
            .an-parts button::after { display: none; }
            .an-body { min-height: 320px; }
            .an-stage { right: 88px !important; } /* leave the button column its own lane */
            .an-halo { height: auto; width: 100vw; } /* never wider than the screen */
          }
          @media (prefers-reduced-motion: reduce) { .an-one { animation: none !important; } }
        `}</style>

        <div role="group" aria-label="Part of the body" className="an-parts">
          {PARTS.map((p, k) => (
            <button key={p.label} type="button" aria-pressed={part === k} onClick={() => setPart(k)}>
              <span>{String(k + 1).padStart(2, "0")}</span>{p.label}
            </button>
          ))}
        </div>

        {system ? (
          <div className="an-stage">
            <div className="an-halo" aria-hidden="true" />
            <PointCanvas system={system} paused={false} white />
          </div>
        ) : (
          <TerminalLoader />
        )}
      </div>

      <div className="an-cap" aria-live="polite">
        {st ? (
          <p className="an-one" key={`h${hover}`}><b>Now tracing</b>{st.n}{st.s ? <em>{` \u2014 ${st.s === "L" ? "left" : "right"}`}</em> : null}</p>
        ) : (
          <p className="an-one" key={`p${part}`}>{PARTS[part].full}</p>
        )}
      </div>
    </>
  );
}
