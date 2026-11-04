"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AQUATECH_OFFICE } from "@/lib/aquatech/mapStyle";
import { aqDisplay, aqMono } from "@/lib/aquatech/fonts";
import { KIND_LABEL, OpsSim, RETURN_COLOR, ROUTES_URL, STATUS_COLOR, clock, fmtPhp, type JobKind, type KPI, type RoutesFile, type Stages, type VanState } from "@/lib/aquatech/ops";
import type { MapApi } from "./MetroManilaMap";
import s from "./aquatech.module.css";

/* ------------------------------------------------------------------
   AquatechExperience — the opening of the Aquatech case study.

   intro    title holds over the city at altitude (veil ~80%)
   descend  title lifts away, veil clears, camera flies into Makati/BGC
   explore  instruments appear; the camera belongs to the visitor
   ops      (inside explore) the live operations console replaces the
            network panel; the simulation in lib/aquatech/ops.ts drives
            the map through MapApi and this console through snapshots

   The map is client-only and loaded after first paint, so the title
   is on screen immediately and never waits on WebGL or tiles.
   ------------------------------------------------------------------ */

const MetroManilaMap = dynamic(() => import("./MetroManilaMap"), { ssr: false, loading: () => null });

type Phase = "intro" | "descend" | "explore";

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#/<>=_";
/** Title decode: each letter cycles through glyphs and locks in, left to right. */
function useDecode(text: string, run: boolean, reduced: boolean) {
  const [out, setOut] = useState(text);
  useEffect(() => {
    if (!run || reduced) { setOut(text); return; }
    let raf = 0;
    const t0 = performance.now(), per = 90, settle = 520;
    const tick = (t: number) => {
      const e = t - t0;
      let done = true;
      const next = [...text].map((ch, i) => {
        if (e >= settle + i * per) return ch;
        done = false;
        return GLYPHS[(Math.random() * GLYPHS.length) | 0];
      }).join("");
      setOut(next);
      if (!done) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [text, run, reduced]);
  return out;
}

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

/* ---- console snapshot: what React renders, refreshed ~4×/s ---- */
type VanRow = { id: string; label: string; state: VanState; eta: number; unit: string; kind: JobKind | null; done: number; progress: number };
type Snap = { clock: string; kpi: KPI; stages: Stages; vans: VanRow[] };
function snapshot(sim: OpsSim): Snap {
  return {
    clock: clock(sim.t),
    kpi: sim.kpi(),
    stages: sim.stages(),
    vans: sim.vans.map((v) => {
      const j = sim.job(v.jobId), u = j ? sim.unit(j.unitId) : undefined;
      const progress = v.route ? (v.state === "returning" ? 1 - v.progress / v.route.dist : v.state === "onsite" ? 1 : v.progress / v.route.dist) : 0;
      return { id: v.id, label: v.label, state: v.state, eta: sim.etaMin(v), unit: u?.code ?? "", kind: j && v.state !== "returning" ? j.kind : null, done: v.done, progress };
    }),
  };
}

export default function AquatechExperience() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [shown, setShown] = useState(false);
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [reduced, setReduced] = useState(false);
  const [touch, setTouch] = useState(false);
  const [hint, setHint] = useState(true);
  const [panelOpen, setPanelOpen] = useState(true);
  // remember the panel state per viewer (a convenience; storage may be unavailable)
  useEffect(() => { try { if (localStorage.getItem("aq-panel") === "closed") setPanelOpen(false); } catch {} }, []);
  const togglePanel = () => setPanelOpen((o) => { try { localStorage.setItem("aq-panel", o ? "closed" : "open"); } catch {} return !o; });
  const mountedAt = useRef(0);
  const wantEnter = useRef(false);
  const coordsRef = useRef<HTMLSpanElement>(null);
  const countRef = useRef<HTMLSpanElement>(null);
  const [stores, setStores] = useState(0);
  const inViewRef = useRef<HTMLSpanElement>(null);
  const inViewCurrent = useRef(0);
  const inViewRaf = useRef(0);

  /* live operations */
  const apiRef = useRef<MapApi | null>(null);
  const simRef = useRef<OpsSim | null>(null);
  const [ops, setOps] = useState(false);
  const [simReady, setSimReady] = useState(false);
  const [snap, setSnap] = useState<Snap | null>(null);
  const [follow, setFollow] = useState<string | null>(null);
  const [hudMin, setHudMin] = useState(false); // live ops never stops; the HUD only folds to its top row

  /* environment + full-viewport lock */
  useEffect(() => {
    mountedAt.current = performance.now();
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onMq = () => setReduced(mq.matches);
    mq.addEventListener("change", onMq);
    setTouch(window.matchMedia("(pointer: coarse)").matches);
    setWebgl(hasWebGL());
    const t = window.setTimeout(() => setShown(true), 120);
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = "hidden";
    return () => { mq.removeEventListener("change", onMq); window.clearTimeout(t); html.style.overflow = prev; };
  }, []);

  const enter = useCallback(() => {
    if (phase !== "intro") return;
    if (!mapReady) { wantEnter.current = true; return; }
    setPhase("descend");
  }, [phase, mapReady]);

  /* NO auto-advance - wait for user to press the button */
  useEffect(() => {
    if (phase !== "intro" || !mapReady) return;
    if (wantEnter.current) { setPhase("descend"); return; }
    // Don't auto-descend - let user explore the overview first
  }, [phase, mapReady, reduced]);

  /* keyboard / wheel can skip the hold */
  useEffect(() => {
    if (phase !== "intro") return;
    const onKey = (e: KeyboardEvent) => { if (["Enter", " ", "ArrowDown"].includes(e.key)) enter(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, enter]);

  /* the gesture hint retires itself */
  useEffect(() => {
    if (phase !== "explore" || !hint) return;
    const t = window.setTimeout(() => setHint(false), 7000);
    return () => window.clearTimeout(t);
  }, [phase, hint]);

  /* the count rises once, as the network appears */
  useEffect(() => {
    const el = countRef.current;
    if (phase !== "explore" || !stores || !el) return;
    if (reduced) { el.textContent = stores.toLocaleString(); return; }
    let raf = 0;
    const t0 = performance.now(), dur = 2400;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      el.textContent = Math.round(stores * (1 - Math.pow(1 - p, 3))).toLocaleString();
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, stores, reduced]);

  /* the simulation is prepared as soon as the network is known (during the hold / descent) … */
  useEffect(() => {
    if (simRef.current || !stores) return;
    const ac = new AbortController();
    fetch(ROUTES_URL, { signal: ac.signal })
      .then((r) => { if (!r.ok) throw new Error(`routes ${r.status}`); return r.json() as Promise<RoutesFile>; })
      .then((file) => { simRef.current = new OpsSim(file, stores); setSimReady(true); })
      .catch((e) => { if (!ac.signal.aborted) console.warn("[aquatech] ops unavailable", e); });
    return () => ac.abort();
  }, [stores]);
  /* … and live operations open on their own the moment the descent lands */
  useEffect(() => {
    if (phase === "explore" && simReady && simRef.current) {
      /* prime the first snapshot so the HUD has data on its very first render frame */
      setSnap(snapshot(simRef.current));
      setOps(true);
    }
  }, [phase, simReady]);

  /* the HUD covers the bottom of the map; the camera is told so it centres on what is visible */
  const hudRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!ops) return;
    const measure = () => {
      const h = hudRef.current;
      if (!h) return;
      const r = h.getBoundingClientRect();
      const covered = Math.max(0, Math.round(window.innerHeight - r.top));
      apiRef.current?.setPadding(covered);
      h.parentElement?.style.setProperty("--hud-h", `${covered}px`);
    };
    /* defer first measurement so the HUD animation can start without a forced reflow */
    const t = requestAnimationFrame(() => requestAnimationFrame(measure));
    const ro = new ResizeObserver(measure);
    if (hudRef.current) ro.observe(hudRef.current);
    window.addEventListener("resize", measure);
    return () => { cancelAnimationFrame(t); ro.disconnect(); window.removeEventListener("resize", measure); };
  }, [ops, snap !== null]);

  /* the operations loop: tick → draw on the map → refresh the console ~4×/s */
  useEffect(() => {
    const sim = simRef.current;
    if (!ops || !sim) return;
    apiRef.current?.setOps(true);
    /* snap is already primed before ops goes true; no need to set it again here */
    let raf = 0, last = performance.now(), lastSnap = performance.now();
    const loop = (t: number) => {
      const dt = (t - last) / 1000; last = t;
      sim.tick(dt);
      apiRef.current?.draw(sim);
      if (t - lastSnap > 250) { lastSnap = t; setSnap(snapshot(sim)); }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); apiRef.current?.setOps(false); };
  }, [ops]);

  const onLoad = useCallback(() => setMapReady(true), []);
  const onStores = useCallback((n: number) => setStores(n), []);
  const onInView = useCallback((n: number) => {
    const el = inViewRef.current;
    if (!el) return;
    const from = inViewCurrent.current;
    if (from === n) return;
    cancelAnimationFrame(inViewRaf.current);
    const t0 = performance.now(), dur = 180;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      const ease = 1 - Math.pow(1 - p, 3);
      const v = Math.round(from + (n - from) * ease);
      el.textContent = v.toLocaleString();
      if (p < 1) inViewRaf.current = requestAnimationFrame(tick);
      else inViewCurrent.current = n;
    };
    inViewRaf.current = requestAnimationFrame(tick);
  }, []);
  const onArrive = useCallback(() => setPhase("explore"), []);
  const onInteract = useCallback(() => setHint(false), []);
  const onError = useCallback((r: string) => { console.warn("[aquatech] map unavailable:", r); setFailed(r); }, []);
  const onFollowEnd = useCallback(() => setFollow(null), []);

  const toggleFollow = (id: string) => {
    if (follow === id) { apiRef.current?.follow(null); setFollow(null); return; }
    apiRef.current?.follow(id); setFollow(id);
  };

  const unavailable = webgl === false || failed !== null;
  const title = useDecode("AQUATECH", shown, reduced);
  const k = snap?.kpi;

  return (
    <div className={`${s.stage} ${aqDisplay.variable} ${aqMono.variable}`} data-phase={phase} data-shown={shown || undefined} data-ready={mapReady || undefined} data-ops={ops || undefined}>
            {webgl && !failed && (
        <MetroManilaMap
          descend={phase !== "intro"}
          reducedMotion={reduced}
          showStores={phase === "explore"}
          coordsRef={coordsRef}
          apiRef={apiRef}
          opsRef={simRef}
          onStores={onStores}
          onInView={onInView}
          onLoad={onLoad}
          onArrive={onArrive}
          onInteract={onInteract}
          onError={onError}
          onFollowEnd={onFollowEnd}
        />
      )}

      <div className={s.vignette} aria-hidden="true" />
      <div className={s.veil} aria-hidden="true" />

      {/* 01 — the introduction */}
      <section className={s.intro} aria-label="Aquatech" onWheel={enter}>
        <p className={s.eyebrow}><span className={s.binary}>Binary</span> 1702 <i>/</i> Case Study</p>
        <h1 className={s.title} aria-label="Aquatech"><span aria-hidden="true">{title}</span></h1>
        <span className={s.rule} aria-hidden="true" />
        <p className={s.headline}>Inventory Operations at Scale.</p>
        <p className={s.support}>From warehouse to installation,<br />every piece of equipment accounted for.</p>
        <p className={s.label}>Interactive simulation</p>
        <div className={s.cue}>
          {unavailable ? (
            <span className={s.note}>
              The 3D city needs WebGL, which isn&rsquo;t available in this browser.
            </span>
          ) : (
            <button type="button" className={s.enter} onClick={enter} disabled={phase !== "intro"}>
              {mapReady ? "Enter Metro Manila" : "Loading the city"}
            </button>
          )}
        </div>
      </section>

      {/* 02 — instruments, once the camera is the visitor's */}
      <header className={s.mark}>
        <Link href="/" className={s.markLink}><span className={s.binary}>Binary</span> 1702</Link>
        <i>/</i>
        <span>Aquatech</span>
        {/* map data credit (required by the OpenStreetMap licence), kept as small as it can be */}
        <a className={s.credit} href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>
      </header>

      {/* 03 — live operations HUD: a band across the bottom; the city stays the proof above it */}
      {ops && snap && k && (
        <aside ref={hudRef} className={s.hud} aria-label="Aquatech live operations" data-min={hudMin || undefined}>
          <div className={s.hudTop}>
            <p className={s.conK}><span className={s.liveDot} aria-hidden="true" />Live operations <i>/</i> <span className={s.conClock}>{snap.clock}</span> <span className={s.conTz}>PHT</span></p>
            <ul className={s.key} aria-label="Legend">
              <li><i style={{ background: STATUS_COLOR.ok }} />Store OK</li>
              <li><i style={{ background: STATUS_COLOR.due }} />Needs service</li>
              <li className={s.keyGap}><b style={{ background: STATUS_COLOR.service }} />Tech heading to store</li>
              <li><b style={{ background: RETURN_COLOR }} />Tech returning</li>
            </ul>
            <div className={s.hudActions}>
              <button type="button" className={s.depot} onClick={() => { setFollow(null); apiRef.current?.flyToWarehouse(); }}>Main office</button>
              <button type="button" className={s.hudMin} onClick={() => setHudMin((m) => !m)} aria-expanded={!hudMin} aria-label={hudMin ? "Expand the dashboard" : "Minimize the dashboard"}>{hudMin ? "+" : "×"}</button>
            </div>
          </div>

          <div className={s.hudMain}>
            <div className={s.kpis}>
              <div className={s.kpi}><span className={s.kpiK}>Stores running</span><b className={s.kpiV} style={{ color: STATUS_COLOR.ok }}>{k.uptime.toFixed(1)}<small>%</small></b></div>
              <div className={s.kpi}><span className={s.kpiK}>Problem to tech on site</span><b className={s.kpiV}>{Math.round(k.responseMin)}<small>min</small></b></div>
              <div className={s.kpi}><span className={s.kpiK}>Saved today</span><b className={s.kpiV} style={{ color: STATUS_COLOR.due }}>{fmtPhp(k.savedPhp)}</b></div>
            </div>

            <ol className={s.pipe} aria-label="Pipeline">
              {([["monitor", "Watching"], ["detect", "Needs service"], ["dispatch", "Tech on the way"], ["onsite", "Tech on site"], ["verified", "Fixed today"]] as [keyof Stages, string][]).map(([key, label]) => (
                <li key={key} className={s.pipeStage} data-stage={key} data-hot={snap.stages[key] > 0 && key !== "monitor" && key !== "verified" || undefined}>
                  <b>{snap.stages[key]}</b><span>{label}</span>
                </li>
              ))}
            </ol>

          </div>

          <div className={s.hudBottom}>
            <ul className={s.fleet} aria-label="Fleet">
              {snap.vans.map((v) => (
                <li key={v.id}>
                  <button type="button" className={s.van} data-state={v.state} data-follow={follow === v.id || undefined} onClick={() => toggleFollow(v.id)} title={follow === v.id ? "Stop following" : "Follow this tech"}>
                    <span className={s.vanId}>{v.label}</span>
                    <span className={s.vanText}>{
                      v.state === "enroute" ? `Heading to ${v.unit} · ${v.eta} min`
                      : v.state === "onsite" ? `At ${v.unit} · ${v.kind ? KIND_LABEL[v.kind].toLowerCase() : "working"}`
                      : v.state === "returning" ? `Heading back · ${v.eta} min`
                      : "At main office"
                    }</span>
                    <span className={s.vanBar} aria-hidden="true"><i style={{ transform: `scaleX(${v.progress})` }} /></span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <p className={s.conFoot}>Simulated operations for demonstration.</p>
        </aside>
      )}

      <div className={s.readout} aria-hidden="true">
        <span className={s.readK}>Metro Manila, Philippines</span>
        <span ref={coordsRef} className={s.readV} />
      </div>
      <p className={s.hint} data-on={(phase === "explore" && hint) || undefined} aria-hidden="true">
        {touch ? "Drag to pan  ·  Pinch to zoom  ·  Two fingers to rotate & tilt" : "Drag to pan  ·  Scroll to zoom  ·  Right-drag to rotate & tilt"}
      </p>
    </div>
  );
}
