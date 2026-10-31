"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AQUATECH_OFFICE } from "@/lib/aquatech/mapStyle";
import { aqDisplay, aqMono } from "@/lib/aquatech/fonts";
import s from "./aquatech.module.css";

/* ------------------------------------------------------------------
   AquatechExperience — the opening of the Aquatech case study.

   intro    title holds over the city at altitude (veil ~80%)
   descend  title lifts away, veil clears, camera flies into Makati/BGC
   explore  instruments appear; the camera belongs to the visitor

   The map is client-only and loaded after first paint, so the title
   is on screen immediately and never waits on WebGL or tiles.
   ------------------------------------------------------------------ */

const MetroManilaMap = dynamic(() => import("./MetroManilaMap"), { ssr: false, loading: () => null });

type Phase = "intro" | "descend" | "explore";
const HOLD_MS = 5200; // minimum time the title owns the screen
const HOLD_REDUCED_MS = 2600;

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

  const unavailable = webgl === false || failed !== null;
  const title = useDecode("AQUATECH", shown, reduced);

  return (
    <div className={`${s.stage} ${aqDisplay.variable} ${aqMono.variable}`} data-phase={phase} data-shown={shown || undefined} data-ready={mapReady || undefined}>
            {webgl && !failed && (
        <MetroManilaMap
          descend={phase !== "intro"}
          reducedMotion={reduced}
          showStores={phase === "explore"}
          coordsRef={coordsRef}
          onStores={onStores}
          onInView={onInView}
          onLoad={onLoad}
          onArrive={onArrive}
          onInteract={onInteract}
          onError={onError}
        />
      )}

      <div className={s.vignette} aria-hidden="true" />
      <div className={s.veil} aria-hidden="true" />

      {/* 01 — the introduction */}
      <section className={s.intro} aria-label="Aquatech" onWheel={enter}>
        <p className={s.eyebrow}><span className={s.binary}>Binary</span> 1702 <i>/</i> Case Study</p>
        <h1 className={s.title} aria-label="Aquatech"><span aria-hidden="true">{title}</span></h1>
        <span className={s.rule} aria-hidden="true" />
        <p className={s.headline}>
          <span>700+ Connections.</span>
          <span className={s.headline2}>One Connected Operation.</span>
        </p>
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
      {stores > 0 && (
        <aside className={s.panel} aria-label="McDonald's restaurants" data-collapsed={!panelOpen || undefined}>
          <button type="button" className={s.panelToggle} onClick={togglePanel} aria-expanded={panelOpen} aria-label={panelOpen ? "Hide panel" : "Show panel"}>
            {panelOpen ? "\u2212" : "+"}
          </button>
          <p className={s.panelK}>McDonald&rsquo;s <i>/</i> Philippines</p>
          <p className={s.panelN}><span ref={inViewRef} className={s.panelLive}>0</span> <span className={s.panelUnit}>Restaurants</span></p>
          <ul className={s.legend}>
            <li><span className={s.mark3d} aria-hidden="true">M</span>McDonald&rsquo;s</li>
            {AQUATECH_OFFICE && (
              <li>
                <svg className={s.pin} viewBox="0 0 384 512" aria-hidden="true"><path d="M172.268 501.67C26.97 291.031 0 269.413 0 192 0 85.961 85.961 0 192 0s192 85.961 192 192c0 77.413-26.97 99.031-172.268 309.67-9.535 13.774-29.93 13.773-39.464 0zM192 272c44.183 0 80-35.817 80-80s-35.817-80-80-80-80 35.817-80 80 35.817 80 80 80z" /></svg>
                {AQUATECH_OFFICE.label} office
              </li>
            )}
          </ul>
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
