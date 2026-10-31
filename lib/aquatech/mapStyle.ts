import type { ExpressionSpecification, LngLatBoundsLike, StyleSpecification } from "maplibre-gl";

/* ------------------------------------------------------------------
   Aquatech — Metro Manila map style.

   Both providers serve the same OpenMapTiles vector schema, so one
   hand-built style works against either. The style is deliberately
   sparse: land, water, a road hierarchy, rail, extruded buildings and
   a handful of place names. Amber (--accent) is NOT used here; it is
   reserved for the operational layers that come later.
   ------------------------------------------------------------------ */

export type MapProvider = {
  id: "maptiler" | "openfreemap";
  source: string;
  glyphs: string;
  attribution: string;
};

const OSM = '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap contributors</a>';
const OMT = '<a href="https://openmaptiles.org/" target="_blank" rel="noopener">© OpenMapTiles</a>';

/** MapTiler when NEXT_PUBLIC_MAPTILER_KEY is set; otherwise OpenFreeMap (no key). */
export function resolveProvider(): MapProvider {
  const key = process.env.NEXT_PUBLIC_MAPTILER_KEY;
  if (key) {
    return {
      id: "maptiler",
      source: `https://api.maptiler.com/tiles/v3-openmaptiles/tiles.json?key=${key}`,
      glyphs: `https://api.maptiler.com/fonts/{fontstack}/{range}.pbf?key=${key}`,
      attribution: `<a href="https://www.maptiler.com/copyright/" target="_blank" rel="noopener">© MapTiler</a> ${OSM}`,
    };
  }
  return {
    id: "openfreemap",
    source: "https://tiles.openfreemap.org/planet",
    glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
    attribution: `<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> ${OMT} ${OSM}`,
  };
}

/* ---- camera ---------------------------------------------------- */
export type Cam = { center: [number, number]; zoom: number; pitch: number; bearing: number };
export type View = "manila" | "philippines" | "office";

/** Overview: zoomed out to show ~20+ McDonald's. Target: Makati CBD ↔ BGC, the densest skyline in the region. */
/** Philippines: the whole archipelago, for the network view. */
export const CAMERA: Record<"desktop" | "mobile", { overview: Cam; target: Cam; philippines: Cam }> = {
  desktop: {
    overview: { center: [121.02, 14.58], zoom: 11.8, pitch: 42, bearing: -14 },
    target: { center: [121.0335, 14.5535], zoom: 15.1, pitch: 63, bearing: 32 },
    philippines: { center: [122.4, 12.3], zoom: 5.3, pitch: 18, bearing: 0 },
  },
  mobile: {
    overview: { center: [121.02, 14.58], zoom: 11.0, pitch: 38, bearing: -14 },
    target: { center: [121.026, 14.556], zoom: 14.3, pitch: 58, bearing: 24 },
    philippines: { center: [122.1, 12.0], zoom: 4.5, pitch: 12, bearing: 0 },
  },
};

/** Exploration stays within the Philippines. */
export const BOUNDS: LngLatBoundsLike = [[114.5, 3.5], [129.5, 22.5]];

/* ---- operational data ------------------------------------------- */
/** McDonald's Philippines, from OpenStreetMap. Rebuild: node scripts/aquatech/fetch-mcdonalds.mjs */
export const STORES_URL = "/data/aquatech/mcdonalds-ph.geojson";
export const ACCENT = "#C98A3C"; // = --accent; the operational colour

/**
 * Aquatech's office. Left null until the real address is confirmed; the
 * marker and its legend entry only render once this is set.
 */
export const AQUATECH_OFFICE: { label: string; address: string; coordinates: [number, number] } | null = {
  label: "Aquatech",
  address: "Warehouse 103, Bormaheco Compound, Cervantes St., West Service Rd., Parañaque",
  // Cervantes St. (OSM way 33302810), the compound's access road off West Service Rd.
  // OSM has no footprint for Warehouse 103 itself; nudge if the exact building is known.
  coordinates: [121.0437, 14.4714],
};
export const OFFICE_BLUE = "#2D9CFF"; // ocean blue

/* ---- palette ----------------------------------------------------- */
const C = {
  ground: "#0B0C0E", // = --room-bg
  water: "#060709",
  park: "#0D100F",
  ivory: "242,239,231",
  rail: "185,174,230", // the Binary violet, at a whisper
};
const iv = (a: number) => `rgba(${C.ivory},${a})`;
const cls = (...v: string[]): ExpressionSpecification => ["match", ["get", "class"], v, true, false];
const notTunnel: ExpressionSpecification = ["!=", ["get", "brunnel"], "tunnel"];
const width = (pairs: number[]): ExpressionSpecification =>
  ["interpolate", ["exponential", 1.6], ["zoom"], ...pairs] as ExpressionSpecification;
const h: ExpressionSpecification = ["coalesce", ["get", "render_height"], 0];
const minH: ExpressionSpecification = ["coalesce", ["get", "render_min_height"], 0];

export function buildStyle(p: MapProvider): StyleSpecification {
  return {
    version: 8,
    name: "Binary 1702 — Metro Manila",
    glyphs: p.glyphs,
    sources: { omt: { type: "vector", url: p.source, attribution: p.attribution } },
    // Architectural key light from the south-west, warm, low.
    light: { anchor: "map", color: "#F3E7D3", intensity: 0.32, position: [1.6, 215, 32] },
    sky: {
      "sky-color": C.ground,
      "horizon-color": "#15161A",
      "fog-color": C.ground,
      "sky-horizon-blend": 0.7,
      "horizon-fog-blend": 0.8,
      "fog-ground-blend": 0.55,
      "atmosphere-blend": 0,
    },
    layers: [
      { id: "ground", type: "background", paint: { "background-color": C.ground } },
      { id: "park", type: "fill", source: "omt", "source-layer": "park", paint: { "fill-color": C.park, "fill-opacity": 0.9 } },
      {
        id: "green", type: "fill", source: "omt", "source-layer": "landcover", filter: cls("wood", "grass"),
        paint: { "fill-color": C.park, "fill-opacity": 0.7 },
      },
      { id: "water", type: "fill", source: "omt", "source-layer": "water", paint: { "fill-color": C.water } },
      {
        id: "waterway", type: "line", source: "omt", "source-layer": "waterway",
        paint: { "line-color": C.water, "line-width": width([10, 0.5, 16, 4]) },
      },
      {
        id: "runway", type: "line", source: "omt", "source-layer": "aeroway", filter: cls("runway", "taxiway"),
        paint: { "line-color": iv(0.07), "line-width": width([10, 1, 16, 40]) },
      },

      // ---- road hierarchy: thin ivory hairlines, brighter as rank rises
      {
        id: "road-minor", type: "line", source: "omt", "source-layer": "transportation", minzoom: 12.5,
        filter: ["all", cls("minor", "service"), notTunnel],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": iv(0.06), "line-width": width([13, 0.4, 18, 7]) },
      },
      {
        id: "road-mid", type: "line", source: "omt", "source-layer": "transportation", minzoom: 10.5,
        filter: ["all", cls("secondary", "tertiary"), notTunnel],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": iv(0.1), "line-width": width([11, 0.35, 18, 11]) },
      },
      {
        id: "road-major", type: "line", source: "omt", "source-layer": "transportation",
        filter: ["all", cls("primary", "trunk"), notTunnel],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": iv(0.15), "line-width": width([9, 0.4, 18, 15]) },
      },
      {
        id: "road-motorway", type: "line", source: "omt", "source-layer": "transportation",
        filter: ["all", cls("motorway"), notTunnel],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": iv(0.22), "line-width": width([9, 0.6, 18, 18]) },
      },
      {
        id: "rail", type: "line", source: "omt", "source-layer": "transportation",
        filter: ["all", cls("transit", "rail"), notTunnel],
        paint: { "line-color": `rgba(${C.rail},0.22)`, "line-width": width([10, 0.5, 18, 3]) },
      },

      // ---- buildings: real OSM footprints; heights from OSM height / levels tags
      {
        id: "buildings", type: "fill-extrusion", source: "omt", "source-layer": "building", minzoom: 13,
        filter: ["!=", ["get", "hide_3d"], true],
        paint: {
          "fill-extrusion-color": ["interpolate", ["linear"], h, 0, "#15161A", 15, "#1B1C21", 50, "#23242A", 120, "#2C2C2E", 240, "#38362F"],
          // Grow out of the ground as the camera descends through z13–14.6.
          "fill-extrusion-height": ["interpolate", ["linear"], ["zoom"], 13, 0, 14.6, h],
          "fill-extrusion-base": ["interpolate", ["linear"], ["zoom"], 13, 0, 14.6, minH],
          "fill-extrusion-opacity": ["interpolate", ["linear"], ["zoom"], 13, 0, 13.6, 0.96],
          "fill-extrusion-vertical-gradient": true,
        },
      },

      // ---- labels: cities and districts only, tracked-out caps
      {
        id: "place-district", type: "symbol", source: "omt", "source-layer": "place", minzoom: 12.5, maxzoom: 15.5,
        filter: cls("suburb", "quarter"),
        layout: {
          "text-field": ["coalesce", ["get", "name:en"], ["get", "name"]],
          "text-font": ["Noto Sans Regular"], "text-size": 10, "text-transform": "uppercase",
          "text-letter-spacing": 0.32, "text-max-width": 8,
        },
        paint: { "text-color": iv(0.28), "text-halo-color": "rgba(11,12,14,.85)", "text-halo-width": 1.2 },
      },
      {
        id: "place-city", type: "symbol", source: "omt", "source-layer": "place", minzoom: 10.8, maxzoom: 14.5,
        filter: cls("city", "town"),
        layout: {
          "text-field": ["coalesce", ["get", "name:en"], ["get", "name"]],
          "text-font": ["Noto Sans Regular"], "text-transform": "uppercase", "text-letter-spacing": 0.4,
          "text-size": ["interpolate", ["linear"], ["zoom"], 9, 10, 13, 12],
        },
        paint: { "text-color": iv(0.5), "text-halo-color": "rgba(11,12,14,.9)", "text-halo-width": 1.4 },
      },
    ],
  };
}
