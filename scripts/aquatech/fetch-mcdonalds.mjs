#!/usr/bin/env node
/* ------------------------------------------------------------------
   Rebuilds public/data/aquatech/mcdonalds-ph.geojson from OpenStreetMap.

   Source: Overpass API, every feature tagged brand:wikidata=Q38076
   (McDonald's) inside the Philippines. Cleaning:
     - drops features marked disused / abandoned / end_date / under construction
     - drops features without an amenity tag (stray building/landuse outlines)
     - merges duplicates within 40 m (a node + its building outline), keeping
       the one with the most tags
   Usage: node scripts/aquatech/fetch-mcdonalds.mjs [saved-overpass-response.json]
   Data © OpenStreetMap contributors, ODbL.
   ------------------------------------------------------------------ */
import { readFileSync, writeFileSync } from "node:fs";

const QUERY = `[out:json][timeout:150];
area["ISO3166-1"="PH"][admin_level=2]->.ph;
nwr["brand:wikidata"="Q38076"](area.ph);
out center tags;`;

async function overpass() {
  // The public Overpass instance sheds load with 429/502/504; back off and retry.
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { "User-Agent": "Binary1702-Aquatech/1.0 (+https://binary1702.com)", Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ data: QUERY }),
    });
    if (res.ok) return res.json();
    console.warn(`Overpass ${res.status} (attempt ${attempt}/4)`);
    await new Promise((r) => setTimeout(r, attempt * 15_000));
  }
  throw new Error("Overpass unavailable — try again later, or pass a saved response file.");
}

const saved = process.argv[2];
const { elements } = saved ? JSON.parse(readFileSync(saved, "utf8")) : await overpass();

const isGone = (t) => Object.keys(t).some((k) => /^(disused|abandoned|was|razed|demolished):/.test(k) || k === "end_date") || t.building === "construction";
const rows = elements
  .filter((e) => e.tags && e.tags.amenity && !isGone(e.tags))
  .map((e) => ({ lat: e.lat ?? e.center.lat, lon: e.lon ?? e.center.lon, tags: e.tags, id: `${e.type}/${e.id}` }));

// merge near-duplicates (≈40 m)
const m = (a, b) => {
  const dy = (a.lat - b.lat) * 111_320, dx = (a.lon - b.lon) * 111_320 * Math.cos((a.lat * Math.PI) / 180);
  return Math.hypot(dx, dy);
};
rows.sort((a, b) => Object.keys(b.tags).length - Object.keys(a.tags).length);
const kept = [];
for (const r of rows) if (!kept.some((k) => m(k, r) < 40)) kept.push(r);

const title = (t) => {
  const b = t.branch || (t.name && !/^mcdonald'?s$/i.test(t.name.trim()) ? t.name.replace(/^mcdonald'?s\s*[-–]?\s*/i, "") : "");
  return b ? `McDonald's ${b}` : "McDonald's";
};
const addr = (t) => [t["addr:housename"], [t["addr:housenumber"], t["addr:street"]].filter(Boolean).join(" "), t["addr:city"]].filter(Boolean).join(", ");

const features = kept
  .map((r) => ({
    type: "Feature",
    geometry: { type: "Point", coordinates: [+r.lon.toFixed(6), +r.lat.toFixed(6)] },
    properties: { id: r.id, name: title(r.tags), address: addr(r.tags) || null, driveThru: r.tags.drive_through === "yes" || undefined },
  }))
  .sort((a, b) => a.properties.id.localeCompare(b.properties.id));

const out = {
  type: "FeatureCollection",
  metadata: { source: "OpenStreetMap via Overpass (brand:wikidata=Q38076, Philippines)", license: "ODbL © OpenStreetMap contributors", fetched: new Date().toISOString().slice(0, 10), raw: elements.length, count: features.length },
  features,
};
writeFileSync(new URL("../../public/data/aquatech/mcdonalds-ph.geojson", import.meta.url), JSON.stringify(out));
console.log(`raw ${elements.length} → kept ${features.length}`);
