"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import s from "../engineering.module.css";
import PointCanvas, { REGION_HEX } from "@/components/engineering/PointCanvas";
import { PointCloudSystem, type CloudData } from "@/lib/generative";

/* ------------------------------------------------------------------
   002 — Anatomy · Exploring biological structure.
   The application's real nervous-system geometry (Z-Anatomy, CC BY-SA
   4.0): 9,048 points sampled from 2.4M vertices across 582 structures,
   rendered as a point cloud coloured by body region, as the application does. Slow rotation; the cursor
   tilts it and names the structure beneath it. Select a region and the rest recedes.
   ------------------------------------------------------------------ */

const fmt = (n: number) => n.toLocaleString("en-US");

const HIDDEN = new Set(["Head & neck", "Spinal cord"]);

export default function AnatomyExhibit() {
  const [data, setData] = useState<CloudData | null>(null);
  const [focus, setFocus] = useState(-1);
  const [hover, setHover] = useState(-1);
  const sysRef = useRef<PointCloudSystem | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/data/nervous-points.json").then((r) => r.json()).then((d: CloudData) => { if (alive) setData(d); });
    return () => { alive = false; };
  }, []);

  const system = useMemo(() => (data ? (sysRef.current = new PointCloudSystem(data)) : null), [data]);
  useEffect(() => { if (sysRef.current) sysRef.current.focus = focus; }, [focus]);

  // read the hovered structure a few times a second — not per frame
  useEffect(() => {
    if (!system) return;
    const id = window.setInterval(() => { const h = sysRef.current?.hovered ?? -1; setHover((v) => (v === h ? v : h)); }, 120);
    return () => window.clearInterval(id);
  }, [system]);

  const counts = useMemo(() => {
    if (!data) return [];
    const c = data.regions.map(() => 0); data.r.forEach((r) => c[r]++); return c;
  }, [data]);

  const st = data && hover >= 0 ? data.structures[hover] : null;

  return (
    <>
      <div className={s.stageBody} style={{ position: "relative" }}>
        <style>{`
          .an-parts { position: absolute; left: 0; right: 0; top: 0; display: flex; flex-wrap: wrap; justify-content: center; gap: 2px 18px; z-index: 2; }
          .an-stage { position: absolute !important; left: 0 !important; right: 0 !important; top: 34px !important; bottom: 0 !important; width: 100% !important; }
          @media (max-width: 860px) { .an-parts { gap: 2px 12px; } .an-stage { top: 48px !important; } }
        `}</style>
        {system ? (
          <div className="an-stage" style={{ background: "radial-gradient(ellipse 26% 62% at 50% 50%, rgba(0,0,0,.97) 0%, rgba(0,0,0,.92) 60%, rgba(0,0,0,.5) 85%, rgba(0,0,0,0) 100%)" }}><PointCanvas system={system} paused={false} /></div>
        ) : (
          <div style={{ position: "absolute", inset: 0, display: "grid", placeContent: "center", fontFamily: "ui-monospace, Menlo, monospace", fontSize: 10, letterSpacing: ".3em", color: "rgba(242,239,231,.35)" }}>
            LOADING GEOMETRY
          </div>
        )}

        {/* part controls, set into the frame */}
        {data && (
          <div role="group" aria-label="Regions of the body" className="an-parts">
            {data.regions.map((_, i) => i).filter((i) => !HIDDEN.has(data.regions[i])).map((p) => {
              const on = focus === p;
              const label = data.regions[p];
              return (
                <button
                  key={p}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setFocus(on ? -1 : p)} /* tap again to release */
                  style={{
                    background: "none", border: 0, padding: "3px 0", textAlign: "left", cursor: "pointer",
                    fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace", fontSize: 10, letterSpacing: ".24em", textTransform: "uppercase",
                    color: on ? "#F2EFE7" : "rgba(242,239,231,.42)", transition: "color 150ms linear",
                  }}
                >
                  <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", marginRight: 10, verticalAlign: "middle", background: p < 0 ? (on ? "#F2EFE7" : "transparent") : REGION_HEX[p], opacity: on || p >= 0 ? 1 : .6, border: "1px solid rgba(242,239,231,.45)" }} />
                  {label}
                </button>
              );
            })}
          </div>
        )}

      </div>

      <div className={s.read} aria-live="polite">
        {st ? (
          <>
            <span className={s.readK}>{data!.parts[st.p]}{st.g ? ` · ${st.g}` : ""}</span>
            <span className={s.readT}>{st.n}{st.s ? ` · ${st.s === "L" ? "left" : "right"}` : ""}</span>
          </>
        ) : focus >= 0 ? (
          <span className={s.readK}>{data!.regions[focus]}</span>
        ) : null}
      </div>
    </>
  );
}
