"use client";

import { useEffect, useRef, type RefObject } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Feature, FeatureCollection, Point, Polygon } from "geojson";
import { ACCENT, AQUATECH_OFFICE, BOUNDS, CAMERA, STORES_URL, buildStyle, resolveProvider, type Cam } from "@/lib/aquatech/mapStyle";

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
   ------------------------------------------------------------------ */

type StoreProps = { id: string; name: string; address: string | null; driveThru?: boolean };

type Props = {
  descend: boolean;
  reducedMotion: boolean;
  showStores: boolean;
  coordsRef?: RefObject<HTMLElement | null>;
  onLoad: () => void;
  onArrive: () => void;
  onInteract: () => void;
  onError: (reason: string) => void;
  onStores: (total: number) => void;
  onInView: (n: number) => void;
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
const M = { W: 64, H: 56, T: 12, D: 9, VALLEY: 0.34, STEP: 1.6 };
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

export default function MetroManilaMap(props: Props) {
  const { descend, reducedMotion, showStores, coordsRef } = props;
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
    const popup = new maplibregl.Popup({ closeButton: false, offset: 12, maxWidth: "280px", className: "aq-popup" });
    let office: maplibregl.Marker | null = null;

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
        map.addSource("stores", { type: "geojson", data, attribution: "McDonald’s locations © OpenStreetMap contributors" });
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
        map.addSource("stores-m", { type: "geojson", data: { type: "FeatureCollection", features: ms } });
        map.addLayer({
          id: "stores-m", type: "fill-extrusion", source: "stores-m", minzoom: 12.8,
          paint: {
            "fill-extrusion-color": ACCENT,
            "fill-extrusion-base": ["get", "base"],
            "fill-extrusion-height": ["get", "top"],
            "fill-extrusion-vertical-gradient": true,
            "fill-extrusion-opacity": 0, "fill-extrusion-opacity-transition": fade,
          },
        });
        storesReady.current = true;
        cb.current.onStores(data.features.length);
        // Always show stores on overview so user can see the network
        reveal(true);
      } catch (e) {
        if (!disposed) console.warn("[aquatech map] stores unavailable", e);
      }
    };
    const reveal = (on: boolean) => {
      if (!storesReady.current) return;
      // points from altitude, letters at street level: the dots fade out as the Ms rise
      const handoff = (v: number) => (on ? ["interpolate", ["linear"], ["zoom"], 12.8, v, 13.6, 0] : 0) as maplibregl.ExpressionSpecification | number;
      map.setPaintProperty("stores", "circle-opacity", handoff(1));
      map.setPaintProperty("stores", "circle-stroke-opacity", handoff(1));
      map.setPaintProperty("stores-halo", "circle-opacity", handoff(0.16));
      map.setPaintProperty("stores-m", "fill-extrusion-opacity", on ? 0.95 : 0);
      if (on) countInView();
    };
    revealRef.current = reveal;

    const onStoreClick = (e: maplibregl.MapLayerMouseEvent) => {
      const f = e.features?.[0];
      if (!f || !showRef.current) return;
      const pr = f.properties as Partial<MPart>;
      const [lng, lat] = typeof pr.lng === "number" && typeof pr.lat === "number" ? [pr.lng, pr.lat] : (f.geometry as Point).coordinates as [number, number];
      popup.setLngLat([lng, lat]).setDOMContent(storeCard(f.properties as StoreProps, lng, lat)).addTo(map);
    };
    const onEnter = () => { if (showRef.current) map.getCanvas().style.cursor = "pointer"; };
    const onLeave = () => { map.getCanvas().style.cursor = ""; };

    const onLoadMap = () => {
      loaded = true;
      writeCoords();
      cb.current.onLoad();
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
      if (!flying.current) return;
      flying.current = false;
      cb.current.onArrive();
    };

    // The first real gesture hands over the camera, permanently.
    const takeControl = () => {
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
    map.on("mouseenter", "stores", onEnter);
    map.on("mouseenter", "stores-m", onEnter);
    map.on("mouseleave", "stores", onLeave);
    map.on("mouseleave", "stores-m", onLeave);
    const canvas = map.getCanvasContainer();
    const gestures = ["pointerdown", "wheel", "touchstart", "keydown"] as const;
    gestures.forEach((g) => canvas.addEventListener(g, takeControl, { passive: true }));

    return () => {
      disposed = true;
      abort.abort();
      cancelAnimationFrame(raf);
      gestures.forEach((g) => canvas.removeEventListener(g, takeControl));
      map.off("load", onLoadMap);
      map.off("move", onMove);
      map.off("moveend", onMoveEnd);
      map.off("error", onMapError);
      map.off("webglcontextlost", onContextLost);
      map.off("click", "stores", onStoreClick);
      map.off("click", "stores-m", onStoreClick);
      map.off("mouseenter", "stores", onEnter);
      map.off("mouseenter", "stores-m", onEnter);
      map.off("mouseleave", "stores", onLeave);
      map.off("mouseleave", "stores-m", onLeave);
      popup.remove();
      office?.remove();
      map.remove();
      mapRef.current = null;
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
