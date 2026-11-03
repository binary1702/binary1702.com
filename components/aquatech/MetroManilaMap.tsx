"use client";

import { useEffect, useRef, type MutableRefObject, type RefObject } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Feature, FeatureCollection, Point, Polygon } from "geojson";
import { ACCENT, AQUATECH_OFFICE, BOUNDS, CAMERA, STORES_URL, buildStyle, resolveProvider, type Cam } from "@/lib/aquatech/mapStyle";
import { FLEET_COLOR, KIND_LABEL, RETURN_COLOR, STATE_LABEL, STATUS_COLOR, UNMONITORED_COLOR, zonePolygons, type OpsSim, type Unit, type UnitStatus, type Van } from "@/lib/aquatech/ops";

/* ------------------------------------------------------------------
   MetroManilaMap — the city. Client-only (loaded via next/dynamic).

   Lifecycle
     load      → slow drift at altitude while the title holds
     descend   → one directed flyTo into Makati / BGC
     any touch → the camera is the visitor's; we never move it on our own again
     (the descent lands on Aquatech's office when it is configured, otherwise on Makati / BGC)

   Operational layer
     McDonald's restaurants (OSM): amber points from altitude; from street level
     (zoom ≥ 13) each one stands up as a 3D capital M, facing the arrival camera.
     Aquatech's office as a marker, once its address is configured.

   Live operations (ops mode)
     Monitored units take their colour from feature-state (ok / due / alert /
     service); the fleet drives baked OSRM road routes from the warehouse. The
     simulation lives in lib/aquatech/ops.ts; this file only draws it. The
     camera moves in ops mode only on an explicit visitor action (follow a van,
     jump to a unit) and any gesture hands it straight back.
   ------------------------------------------------------------------ */

type StoreProps = { id: string; name: string; address: string | null; driveThru?: boolean };

/** Imperative surface the experience uses to drive the ops layer. */
export type MapApi = {
  draw: (sim: OpsSim) => void;
  setOps: (on: boolean) => void;
  /** Pixels covered by the HUD at the bottom: the camera centres on what is left. */
  setPadding: (bottom: number) => void;
  follow: (vanId: string | null) => void;
  flyToUnit: (unit: Unit) => void;
  flyToWarehouse: () => void;
};

type Props = {
  descend: boolean;
  reducedMotion: boolean;
  showStores: boolean;
  coordsRef?: RefObject<HTMLElement | null>;
  apiRef: MutableRefObject<MapApi | null>;
  opsRef: RefObject<OpsSim | null>;
  onLoad: () => void;
  onArrive: () => void;
  onInteract: () => void;
  onError: (reason: string) => void;
  onStores: (total: number) => void;
  onInView: (n: number) => void;
  onFollowEnd: () => void;
};

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const fmt = (lng: number, lat: number) =>
  `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? "N" : "S"}   ${Math.abs(lng).toFixed(4)}° ${lng >= 0 ? "E" : "W"}`;

/** Popup body built with textContent — OSM text is never parsed as HTML. */
function storeCard(p: StoreProps, lng: number, lat: number, kicker?: string) {
  const el = document.createElement("div");
  el.className = "aq-card";
  const add = (tag: string, cls: string, text: string) => {
    const n = document.createElement(tag); n.className = cls; n.textContent = text; el.appendChild(n);
  };
  add("p", "aq-card-k", kicker ?? (p.driveThru ? "Restaurant · Drive-thru" : "Restaurant"));
  add("p", "aq-card-t", p.name);
  if (p.address) add("p", "aq-card-a", p.address);
  add("p", "aq-card-c", fmt(lng, lat));
  return el;
}

const STATUS_LABEL: Record<UnitStatus, string> = { ok: "OK", due: "Needs service", alert: "Needs service", service: "Tech on site" };

/** Ops-mode card for a monitored unit: status, live telemetry, open job. */
function unitCard(sim: OpsSim, u: Unit) {
  const el = document.createElement("div");
  el.className = "aq-card aq-card-ops";
  el.style.setProperty("--st", STATUS_COLOR[u.status]);
  const add = (tag: string, cls: string, text: string, parent: HTMLElement = el) => {
    const n = document.createElement(tag); n.className = cls; n.textContent = text; parent.appendChild(n); return n;
  };
  add("p", "aq-card-k aq-card-st", `${u.code} · ${STATUS_LABEL[u.status]}`);
  add("p", "aq-card-t", u.name);
  if (u.address) add("p", "aq-card-a", u.address);
  add("p", "aq-card-c", `Zone · ${u.zone.name}`);
  const tm = sim.telemetry(u);
  const grid = document.createElement("div"); grid.className = "aq-tele"; el.appendChild(grid);
  const cell = (k: string, v: string) => { const c = document.createElement("div"); add("span", "aq-tele-k", k, c); add("b", "aq-tele-v", v, c); grid.appendChild(c); };
  cell("Filter life", `${tm.life}%`);
  cell("Flow", `${tm.flow.toFixed(1)} L/min`);
  cell("TDS", `${tm.tds} ppm`);
  cell("Pressure", `${tm.pressure} bar`);
  const j = sim.job(u.jobId);
  if (j) {
    const van = j.vanId ? sim.van(j.vanId) : undefined;
    const line = j.state === "queued" ? `${j.id} · ${KIND_LABEL[j.kind]} · awaiting dispatch`
      : j.state === "enroute" && van ? `${j.id} · ${van.label} en route · ETA ${sim.etaMin(van)} min`
      : `${j.id} · ${van?.label ?? ""} on site · ${KIND_LABEL[j.kind]}`;
    add("p", "aq-card-c aq-card-job", line);
  }
  return el;
}

/** Ops-mode card for a van: where it is, where it is going, and why. */
function vanCard(sim: OpsSim, v: Van) {
  const el = document.createElement("div");
  el.className = "aq-card aq-card-ops";
  const j = sim.job(v.jobId), u = j ? sim.unit(j.unitId) : undefined;
  el.style.setProperty("--st", v.state === "returning" ? RETURN_COLOR : FLEET_COLOR);
  const add = (tag: string, cls: string, text: string) => { const n = document.createElement(tag); n.className = cls; n.textContent = text; el.appendChild(n); };
  add("p", "aq-card-k aq-card-st", `${v.label} · ${STATE_LABEL[v.state]}`);
  if (v.state === "enroute" && j && u) {
    add("p", "aq-card-t", `→ ${u.code}`);
    if (u.address) add("p", "aq-card-a", u.address);
    add("p", "aq-card-c aq-card-job", `${KIND_LABEL[j.kind]} · ${j.reason} · ETA ${sim.etaMin(v)} min`);
  } else if (v.state === "onsite" && j && u) {
    add("p", "aq-card-t", `At ${u.code}`);
    if (u.address) add("p", "aq-card-a", u.address);
    add("p", "aq-card-c aq-card-job", `${KIND_LABEL[j.kind]} in progress · ${Math.max(1, Math.round((v.untilT - sim.t) / 60))} min left`);
  } else if (v.state === "returning") {
    add("p", "aq-card-t", "→ Main office");
    add("p", "aq-card-a", "Job verified · returning for the next dispatch");
    add("p", "aq-card-c aq-card-job", `ETA ${sim.etaMin(v)} min`);
  } else {
    add("p", "aq-card-t", "Main office");
    add("p", "aq-card-a", "Awaiting dispatch");
  }
  add("p", "aq-card-c", `${v.done} jobs completed today`);
  return el;
}

/** Where the descent lands: the office if we know it, otherwise the Makati / BGC skyline. */
const arrivalCam = (mobile: boolean): Cam =>
  AQUATECH_OFFICE
    // pulled back far enough to show the office among its network: ~20+ restaurants on screen
    ? { center: AQUATECH_OFFICE.coordinates, zoom: mobile ? 12.6 : 13, pitch: mobile ? 45 : 50, bearing: -20 }
    : CAMERA[mobile ? "mobile" : "desktop"].target;

/* ---- the 3D "M" ---------------------------------------------------
   fill-extrusion can only push a flat footprint straight up, so a standing letter is
   built from slices: two full-height legs, and each diagonal as a run of narrow boxes
   whose base/top step down toward the centre valley. Sizes in metres. */
const M = { W: 64, H: 56, T: 12, D: 9, VALLEY: 0.34, STEP: 2.4 };
/** Below this zoom stores are dots; the Ms stand up as the visitor comes down. Kept above the arrival zoom (13) for performance. */
const M_MINZOOM = 13.6, M_FULL = 14.3; // STEP: coarser = fewer extruded boxes (790 stores × slices)
type MPart = { id: string; name: string; address: string | null; driveThru?: boolean; lng: number; lat: number; base: number; top: number };
function letterM(lng: number, lat: number, props: StoreProps, faceBearing: number): Feature<Polygon, MPart>[] {
  const { W, H, T, D, VALLEY, STEP } = M;
  const mLng = 1 / (111320 * Math.cos(lat * Math.PI / 180)), mLat = 1 / 110540;
  // the letter's width runs across the screen of a camera with this bearing
  const au = (faceBearing + 90) * Math.PI / 180, av = faceBearing * Math.PI / 180;
  const at = (u: number, v: number): [number, number] => {
    const uu = u - W / 2, vv = v - D / 2;
    return [lng + (uu * Math.sin(au) + vv * Math.sin(av)) * mLng, lat + (uu * Math.cos(au) + vv * Math.cos(av)) * mLat];
  };
  const box = (u0: number, u1: number, base: number, top: number): Feature<Polygon, MPart> => ({
    type: "Feature",
    properties: { ...props, lng, lat, base: Math.max(0, base), top },
    geometry: { type: "Polygon", coordinates: [[at(u0, 0), at(u1, 0), at(u1, D), at(u0, D), at(u0, 0)]] },
  });
  const parts = [box(0, T, 0, H), box(W - T, W, 0, H)];
  const th = T * 1.35, zTop = H - th / 2, zLow = H * VALLEY;
  for (let u = T; u < W / 2; u += STEP) {
    const u1 = Math.min(u + STEP, W / 2);
    const f = ((u + u1) / 2 - T) / (W / 2 - T);
    const zc = zTop - f * (zTop - zLow);
    parts.push(box(u, u1, zc - th / 2, zc + th / 2), box(W - u1, W - u, zc - th / 2, zc + th / 2));
  }
  return parts;
}

const SVG_NS = "http://www.w3.org/2000/svg";
/** Map-pin glyph (Font Awesome "map-marker-alt" path), drawn in Aquatech ocean blue. */
const PIN_PATH = "M172.268 501.67C26.97 291.031 0 269.413 0 192 0 85.961 85.961 0 192 0s192 85.961 192 192c0 77.413-26.97 99.031-172.268 309.67-9.535 13.774-29.93 13.773-39.464 0zM192 272c44.183 0 80-35.817 80-80s-35.817-80-80-80-80 35.817-80 80 35.817 80 80 80z";

function officeMarker(label: string) {
  const el = document.createElement("div");
  el.className = "aq-office";
  el.setAttribute("role", "button");
  el.setAttribute("aria-label", `${label} office`);
  const pulse = document.createElement("span"); pulse.className = "aq-office-pulse";
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 384 512"); svg.setAttribute("aria-hidden", "true"); svg.setAttribute("class", "aq-office-pin");
  const path = document.createElementNS(SVG_NS, "path"); path.setAttribute("d", PIN_PATH);
  svg.appendChild(path);
  const tag = document.createElement("span"); tag.className = "aq-office-tag";
  const t1 = document.createElement("b"); t1.textContent = label;
  const t2 = document.createElement("span"); t2.textContent = "Office";
  tag.append(t1, t2);
  el.append(pulse, svg, tag);
  return el;
}

/* ---- ops-mode paint ------------------------------------------------
   Monitored units carry their status in feature-state; stores outside the
   territory have no state and fall through to the "unmonitored" colour. */
type Expr = maplibregl.ExpressionSpecification;
const st: Expr = ["feature-state", "st"];
const byStatus = (ok: unknown, due: unknown, alert: unknown, service: unknown, none: unknown): Expr =>
  ["case", ["==", st, "ok"], ok, ["==", st, "due"], due, ["==", st, "alert"], alert, ["==", st, "service"], service, none] as Expr;
const OPS_COLOR = byStatus(STATUS_COLOR.ok, STATUS_COLOR.due, STATUS_COLOR.alert, STATUS_COLOR.service, UNMONITORED_COLOR);

/** Techs: blue heading out, red heading home. */
const BY_DIR: Expr = ["match", ["get", "state"], "returning", RETURN_COLOR, FLEET_COLOR];
const DASH = [[0, 4, 3], [0.5, 4, 2.5], [1, 4, 2], [1.5, 4, 1.5], [2, 4, 1], [2.5, 4, 0.5], [3, 4, 0], [0, 0.5, 3, 3.5], [0, 1, 3, 3], [0, 1.5, 3, 2.5], [0, 2, 3, 2], [0, 2.5, 3, 1.5], [0, 3, 3, 1], [0, 3.5, 3, 0.5]];

export default function MetroManilaMap(props: Props) {
  const { descend, reducedMotion, showStores, coordsRef, apiRef, opsRef } = props;
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const userControl = useRef(false);
  const flying = useRef(false);
  const descended = useRef(false);
  const mobile = useRef(false);
  const storesReady = useRef(false);
  const revealRef = useRef<(on: boolean) => void>(() => {});
  const showRef = useRef(showStores);
  showRef.current = showStores;
  // latest callbacks without re-running effects
  const cb = useRef(props);
  cb.current = props;

  /* ---- create / destroy ---- */
  useEffect(() => {
    const container = el.current;
    if (!container) return;
    mobile.current = window.matchMedia("(max-width: 767px)").matches;
    const cam = CAMERA[mobile.current ? "mobile" : "desktop"];

    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container,
        style: buildStyle(resolveProvider()),
        ...cam.overview,
        minZoom: 4,
        maxZoom: 18.5,
        maxPitch: 75,
        maxBounds: BOUNDS,
        attributionControl: false,
        pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
        canvasContextAttributes: { antialias: !mobile.current },
        fadeDuration: 400,
      });
    } catch (e) {
      cb.current.onError(e instanceof Error ? e.message : "map-init");
      return;
    }
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-right");

    let loaded = false;
    let raf = 0;
    let disposed = false;
    let coords: [number, number][] = [];
    const abort = new AbortController();
    const popup = new maplibregl.Popup({ closeButton: false, offset: 12, maxWidth: "300px", className: "aq-popup" });
    let office: maplibregl.Marker | null = null;

    // ops state
    let ops = false;
    let opsLayers = false;
    let followId: string | null = null;
    let followFlying = false;
    let lastRoutes = -1;
    let dashStep = -1;
    let lastPulse = 0;
    let lastTouch = 0;

    const writeCoords = () => {
      raf = 0;
      const c = map.getCenter();
      if (coordsRef?.current) coordsRef.current.textContent = fmt(c.lng, c.lat);
    };
    const onMove = () => { if (!raf) raf = requestAnimationFrame(writeCoords); };

    const countInView = () => {
      if (!coords.length) return;
      const b = map.getBounds();
      let n = 0;
      for (const c of coords) if (b.contains(c)) n++;
      cb.current.onInView(n);
    };

    /* McDonald's — real locations from OSM, drawn as ground-aligned points */
    const addStores = async () => {
      try {
        const res = await fetch(STORES_URL, { signal: abort.signal });
        if (!res.ok) throw new Error(`stores ${res.status}`);
        const data = (await res.json()) as FeatureCollection<Point, StoreProps>;
        if (disposed) return;
        coords = data.features.map((f) => f.geometry.coordinates as [number, number]);
        map.addSource("stores", { type: "geojson", data, promoteId: "id", attribution: "McDonald’s locations © OpenStreetMap contributors" });
        const before = map.getLayer("place-district") ? "place-district" : undefined;
        const fade = { duration: reducedMotion ? 0 : 1800, delay: 0 };
        map.addLayer({
          id: "stores-halo", type: "circle", source: "stores",
          paint: {
            "circle-color": ACCENT, "circle-blur": 1, "circle-pitch-alignment": "map",
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 4, 3, 10, 7, 15, 16],
            "circle-opacity": 0, "circle-opacity-transition": fade,
          },
        }, before);
        map.addLayer({
          id: "stores", type: "circle", source: "stores",
          paint: {
            "circle-color": ACCENT, "circle-pitch-alignment": "map",
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 4, 1.4, 8, 2, 11, 3, 15, 5.5, 18, 8],
            "circle-stroke-color": "rgba(11,12,14,.9)",
            "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 11, 0, 14, 1.2],
            "circle-opacity": 0, "circle-opacity-transition": fade,
            "circle-stroke-opacity": 0, "circle-stroke-opacity-transition": fade,
          },
        }, before);
        const ms: Feature<Polygon, MPart>[] = [];
        const face = arrivalCam(mobile.current).bearing;
        for (const f of data.features) {
          const [lng, lat] = f.geometry.coordinates as [number, number];
          ms.push(...letterM(lng, lat, f.properties, face));
        }
        map.addSource("stores-m", { type: "geojson", promoteId: "id", data: { type: "FeatureCollection", features: ms } });
        map.addLayer({
          id: "stores-m", type: "fill-extrusion", source: "stores-m", minzoom: M_MINZOOM,
          paint: {
            "fill-extrusion-color": ACCENT,
            "fill-extrusion-base": ["get", "base"],
            "fill-extrusion-height": ["get", "top"],
            "fill-extrusion-vertical-gradient": true,
            "fill-extrusion-opacity": 0, "fill-extrusion-opacity-transition": fade,
          },
        });
        // the fleet draws above the network
        if (opsLayers) for (const id of ["ops-route-glow", "ops-route", "ops-van-halo", "ops-van", "ops-van-label"]) map.moveLayer(id);
        storesReady.current = true;
        cb.current.onStores(data.features.length);
        // Always show stores on overview so user can see the network
        reveal(true);
        paintOps(ops);
      } catch (e) {
        if (!disposed) console.warn("[aquatech map] stores unavailable", e);
      }
    };
    const reveal = (on: boolean) => {
      if (!storesReady.current) return;
      // points from altitude, letters at street level: the dots fade out as the Ms rise
      const handoff = (v: number) => (on ? ["interpolate", ["linear"], ["zoom"], M_MINZOOM, v, M_FULL, 0] : 0) as maplibregl.ExpressionSpecification | number;
      map.setPaintProperty("stores", "circle-opacity", handoff(1));
      map.setPaintProperty("stores", "circle-stroke-opacity", handoff(1));
      map.setPaintProperty("stores-halo", "circle-opacity", handoff(0.16));
      map.setPaintProperty("stores-m", "fill-extrusion-opacity", on ? 0.95 : 0);
      if (on) countInView();
    };
    revealRef.current = reveal;

    /* ---- live operations: sources + layers, hidden until ops mode ---- */
    const addOpsLayers = () => {
      const empty: FeatureCollection = { type: "FeatureCollection", features: [] };
      map.addSource("ops-zones", { type: "geojson", data: empty });
      map.addSource("ops-routes", { type: "geojson", data: empty });
      map.addSource("ops-vans", { type: "geojson", data: empty });
      const hidden = { visibility: "none" as const };
      // service zones: a quiet shade with a hairline and a name — no colour of their own
      const zonesBefore = map.getLayer("road-minor") ? "road-minor" : undefined;
      map.addLayer({ id: "ops-zone-fill", type: "fill", source: "ops-zones", layout: hidden, filter: ["==", ["geometry-type"], "Polygon"], paint: { "fill-color": "#F2EFE7", "fill-opacity": ["match", ["get", "id"], "central", 0.06, "south", 0.03, 0.045] as Expr } }, zonesBefore);
      map.addLayer({ id: "ops-zone-line", type: "line", source: "ops-zones", layout: hidden, filter: ["==", ["geometry-type"], "Polygon"], paint: { "line-color": "rgba(242,239,231,.28)", "line-width": 1, "line-dasharray": [3, 3] } }, zonesBefore);
      map.addLayer({
        id: "ops-zone-label", type: "symbol", source: "ops-zones", maxzoom: 13.6, filter: ["==", ["geometry-type"], "Point"],
        layout: { ...hidden, "text-field": ["get", "name"], "text-font": ["Noto Sans Regular"], "text-size": 11, "text-letter-spacing": 0.5, "text-transform": "uppercase", "text-allow-overlap": true },
        paint: { "text-color": "rgba(242,239,231,.45)", "text-halo-color": "rgba(11,12,14,.9)", "text-halo-width": 1.4 },
      });
      const dim: Expr = ["match", ["get", "state"], "returning", 0.6, 1];
      map.addLayer({
        id: "ops-route-glow", type: "line", source: "ops-routes", layout: { ...hidden, "line-cap": "round", "line-join": "round" },
        paint: { "line-color": BY_DIR, "line-blur": 4, "line-opacity": ["*", 0.22, dim] as Expr, "line-width": ["interpolate", ["linear"], ["zoom"], 10, 4, 15, 12] },
      });
      map.addLayer({
        id: "ops-route", type: "line", source: "ops-routes", layout: { ...hidden, "line-join": "round" },
        paint: { "line-color": BY_DIR, "line-opacity": ["*", 0.9, dim] as Expr, "line-width": ["interpolate", ["linear"], ["zoom"], 10, 1.4, 15, 3.2], "line-dasharray": DASH[0] },
      });
      map.addLayer({
        id: "ops-van-halo", type: "circle", source: "ops-vans", layout: hidden,
        paint: { "circle-color": BY_DIR, "circle-blur": 1, "circle-opacity": 0.45, "circle-pitch-alignment": "map", "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 9, 15, 20] },
      });
      map.addLayer({
        id: "ops-van", type: "circle", source: "ops-vans", layout: hidden,
        paint: {
          "circle-color": ["match", ["get", "state"], "onsite", FLEET_COLOR, "#F2EFE7"] as Expr,
          "circle-stroke-color": BY_DIR, "circle-stroke-width": 2,
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 3.5, 15, 6.5],
        },
      });
      map.addLayer({
        id: "ops-van-label", type: "symbol", source: "ops-vans", minzoom: 11,
        layout: { ...hidden, "text-field": ["get", "label"], "text-font": ["Noto Sans Regular"], "text-size": 10, "text-letter-spacing": 0.16, "text-offset": [0, -1.7], "text-anchor": "bottom", "text-allow-overlap": true, "text-ignore-placement": true },
        paint: { "text-color": "#F2EFE7", "text-halo-color": "rgba(11,12,14,.9)", "text-halo-width": 1.4 },
      });
      opsLayers = true;
    };
    const setOpsVisibility = (on: boolean) => {
      if (!opsLayers) return;
      for (const id of ["ops-zone-fill", "ops-zone-line", "ops-zone-label", "ops-route-glow", "ops-route", "ops-van-halo", "ops-van", "ops-van-label"]) map.setLayoutProperty(id, "visibility", on ? "visible" : "none");
    };
    /** Network colour (amber everywhere) ↔ ops colour (status per unit). */
    const paintOps = (on: boolean) => {
      if (!storesReady.current) return;
      map.setPaintProperty("stores", "circle-color", on ? OPS_COLOR : ACCENT);
      map.setPaintProperty("stores-halo", "circle-color", on ? OPS_COLOR : ACCENT);
      map.setPaintProperty("stores-m", "fill-extrusion-color", on ? OPS_COLOR : ACCENT);
      map.setPaintProperty("stores", "circle-radius", on
        ? ["interpolate", ["linear"], ["zoom"], 4, 1.4, 8, 2, 11, byStatus(3, 4, 4.5, 4.5, 2.4), 15, byStatus(5.5, 7, 8, 8, 4), 18, byStatus(8, 10, 11, 11, 6)]
        : ["interpolate", ["linear"], ["zoom"], 4, 1.4, 8, 2, 11, 3, 15, 5.5, 18, 8]);
    };

    const draw = (sim: OpsSim) => {
      if (!loaded || !opsLayers) return;
      if (sim.changed.size && storesReady.current) {
        for (const id of sim.changed) {
          const u = sim.unit(id);
          if (!u) continue;
          map.setFeatureState({ source: "stores", id }, { st: u.status });
          map.setFeatureState({ source: "stores-m", id }, { st: u.status });
        }
        sim.changed.clear();
      }
      if (!ops) return;
      // Every touch below makes MapLibre re-render the whole 3D city, so the ops layer
      // only touches it ~20×/s (full rate while following, where the camera moves anyway).
      const now = performance.now();
      if (!followId && now - lastTouch < 50) return;
      lastTouch = now;
      (map.getSource("ops-vans") as maplibregl.GeoJSONSource).setData(sim.vansGeoJSON());
      if (sim.routesVersion !== lastRoutes) {
        lastRoutes = sim.routesVersion;
        (map.getSource("ops-routes") as maplibregl.GeoJSONSource).setData(sim.routesGeoJSON());
      }
      // alerts breathe; the fleet's routes flow toward the store (both throttled to ~10 Hz)
      if (now - lastPulse > 100) {
        lastPulse = now;
        const pulse = reducedMotion ? 0.45 : 0.25 + 0.3 * (0.5 + 0.5 * Math.sin(now / 260));
        map.setPaintProperty("stores-halo", "circle-opacity", ["interpolate", ["linear"], ["zoom"], M_MINZOOM, byStatus(0.16, 0.3, pulse, 0.3, 0.08), M_FULL, byStatus(0, 0.3, pulse, 0.3, 0)]);
        if (!reducedMotion) {
          const step = Math.floor((now / 60) % DASH.length);
          if (step !== dashStep) { dashStep = step; map.setPaintProperty("ops-route", "line-dasharray", DASH[step]); }
        }
      }
      if (followId && !followFlying) {
        const v = sim.van(followId);
        if (v) map.setCenter(v.pos);
      }
    };

    const endFollow = () => {
      if (!followId) return;
      followId = null; followFlying = false;
      cb.current.onFollowEnd();
    };

    apiRef.current = {
      draw,
      setOps: (on) => {
        ops = on;
        setOpsVisibility(on);
        paintOps(on);
        popup.remove();
        // ops animates continuously, so shade fewer pixels: 1.5× instead of 2× on retina (~45% fewer)
        map.setPixelRatio(Math.min(window.devicePixelRatio || 1, on ? 1.5 : 2));
        if (!on) map.setPadding({ top: 0, bottom: 0, left: 0, right: 0 });
        if (storesReady.current) {
          // the halo pulses in ops mode, so its fade transition is switched off while ops is on
          map.setPaintProperty("stores-halo", "circle-opacity-transition", { duration: on ? 0 : 1800, delay: 0 });
          if (!on) map.setPaintProperty("stores-halo", "circle-opacity", ["interpolate", ["linear"], ["zoom"], M_MINZOOM, 0.16, M_FULL, 0]);
        }
        if (!on) endFollow();
        else {
          lastRoutes = -1;
          const sim = opsRef.current;
          if (sim) (map.getSource("ops-zones") as maplibregl.GeoJSONSource).setData(zonePolygons(sim.warehouse, sim.radiusKm));
        }
      },
      setPadding: (bottom) => { if (ops) map.setPadding({ top: 0, bottom, left: 0, right: 0 }); },
      follow: (vanId) => {
        if (!vanId) { endFollow(); return; }
        const v = opsRef.current?.van(vanId);
        if (!v) return;
        followId = vanId; followFlying = true;
        map.stop();
        map.flyTo({ center: v.pos, zoom: Math.max(map.getZoom(), 15), pitch: 54, duration: reducedMotion ? 0 : 1800, essential: true });
        if (reducedMotion) followFlying = false;
      },
      flyToUnit: (u) => {
        endFollow();
        map.stop();
        map.flyTo({ center: [u.lng, u.lat], zoom: Math.max(map.getZoom(), 15.4), pitch: 58, duration: reducedMotion ? 0 : 2000, essential: true });
      },
      flyToWarehouse: () => {
        endFollow();
        map.stop();
        const c = opsRef.current?.warehouse ?? AQUATECH_OFFICE?.coordinates;
        if (c) map.flyTo({ center: c, zoom: 14.2, pitch: 55, duration: reducedMotion ? 0 : 2000, essential: true });
      },
    };

    const onStoreClick = (e: maplibregl.MapLayerMouseEvent) => {
      const f = e.features?.[0];
      if (!f || !showRef.current) return;
      const pr = f.properties as Partial<MPart>;
      const [lng, lat] = typeof pr.lng === "number" && typeof pr.lat === "number" ? [pr.lng, pr.lat] : (f.geometry as Point).coordinates as [number, number];
      const sim = opsRef.current;
      const unit = ops && sim ? sim.unit(String(pr.id)) : undefined;
      popup.setLngLat([lng, lat]).setDOMContent(unit && sim ? unitCard(sim, unit) : storeCard(f.properties as StoreProps, lng, lat)).addTo(map);
    };
    const onVanClick = (e: maplibregl.MapLayerMouseEvent) => {
      const f = e.features?.[0], sim = opsRef.current;
      if (!f || !sim) return;
      const v = sim.van(String((f.properties as { id: string }).id));
      if (!v) return;
      popup.setLngLat(v.pos).setDOMContent(vanCard(sim, v)).addTo(map);
    };
    const onEnter = () => { if (showRef.current) map.getCanvas().style.cursor = "pointer"; };
    const onLeave = () => { map.getCanvas().style.cursor = ""; };

    const onLoadMap = () => {
      loaded = true;
      writeCoords();
      cb.current.onLoad();
      addOpsLayers();
      addStores();
      if (AQUATECH_OFFICE) {
        office = new maplibregl.Marker({ element: officeMarker(AQUATECH_OFFICE.label), anchor: "bottom" })
          .setLngLat(AQUATECH_OFFICE.coordinates)
          .setPopup(new maplibregl.Popup({ closeButton: false, offset: 38, className: "aq-popup aq-popup-office" })
            .setDOMContent(storeCard({ id: "office", name: AQUATECH_OFFICE.label, address: AQUATECH_OFFICE.address }, ...AQUATECH_OFFICE.coordinates, "Office")))
          .addTo(map);
      }
      // the hold: a barely perceptible drift while the title is on screen
      if (!reducedMotion && !descended.current && !userControl.current) {
        map.easeTo({ bearing: cam.overview.bearing + 9, duration: 16000, easing: (t) => t, essential: true });
      }
    };

    const onMoveEnd = () => {
      if (showRef.current) countInView();
      if (followFlying) followFlying = false;
      if (!flying.current) return;
      flying.current = false;
      cb.current.onArrive();
    };

    // The first real gesture hands over the camera, permanently; any gesture ends a follow.
    const onGesture = () => {
      if (followId) { map.stop(); endFollow(); }
      if (userControl.current || !descended.current) return;
      userControl.current = true;
      if (flying.current) { map.stop(); flying.current = false; }
      cb.current.onInteract();
      cb.current.onArrive();
    };

    const onMapError = (e: { error?: Error }) => {
      if (!loaded) cb.current.onError(e?.error?.message ?? "map-error");
      else console.warn("[aquatech map]", e?.error?.message);
    };
    const onContextLost = () => cb.current.onError("webgl-context-lost");

    map.on("load", onLoadMap);
    map.on("move", onMove);
    map.on("moveend", onMoveEnd);
    map.on("error", onMapError);
    map.on("webglcontextlost", onContextLost);
    map.on("click", "stores", onStoreClick);
    map.on("click", "stores-m", onStoreClick);
    map.on("click", "ops-van", onVanClick);
    for (const l of ["stores", "stores-m", "ops-van"]) { map.on("mouseenter", l, onEnter); map.on("mouseleave", l, onLeave); }
    const canvas = map.getCanvasContainer();
    const gestures = ["pointerdown", "wheel", "touchstart", "keydown"] as const;
    gestures.forEach((g) => canvas.addEventListener(g, onGesture, { passive: true }));

    return () => {
      disposed = true;
      abort.abort();
      cancelAnimationFrame(raf);
      gestures.forEach((g) => canvas.removeEventListener(g, onGesture));
      map.off("load", onLoadMap);
      map.off("move", onMove);
      map.off("moveend", onMoveEnd);
      map.off("error", onMapError);
      map.off("webglcontextlost", onContextLost);
      map.off("click", "stores", onStoreClick);
      map.off("click", "stores-m", onStoreClick);
      map.off("click", "ops-van", onVanClick);
      for (const l of ["stores", "stores-m", "ops-van"]) { map.off("mouseenter", l, onEnter); map.off("mouseleave", l, onLeave); }
      popup.remove();
      office?.remove();
      map.remove();
      mapRef.current = null;
      apiRef.current = null;
      storesReady.current = false;
      revealRef.current = () => {};
    };
    // reducedMotion is read once at creation; the descend effect handles later changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---- the descent ---- */
  useEffect(() => {
    const map = mapRef.current;
    if (!descend || !map || descended.current) return;
    descended.current = true;
    if (userControl.current) return;
    const target = arrivalCam(mobile.current);
    map.stop();
    if (reducedMotion) {
      map.jumpTo(target);
      cb.current.onArrive();
      return;
    }
    flying.current = true;
    map.flyTo({ ...target, duration: mobile.current ? 8200 : 9800, curve: 1.25, easing: easeInOutCubic, essential: true });
  }, [descend, reducedMotion]);

  /* ---- reveal the network ---- */
  useEffect(() => {
    revealRef.current(showStores);
  }, [showStores]);

  return <div ref={el} style={{ position: "absolute", inset: 0 }} aria-label="3D map of Metro Manila" role="region" />;
}
