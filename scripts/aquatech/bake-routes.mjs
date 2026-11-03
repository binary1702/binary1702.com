/**
 * Bake real road routes from the Aquatech warehouse to every McDonald's within
 * the service radius, using the public OSRM demo router (OSM data).
 *
 *   node scripts/aquatech/bake-routes.mjs            # resumes if interrupted
 *
 * Output: public/data/aquatech/routes.json
 * The demo server is rate-limited and has no SLA; this is a one-off bake, not
 * a runtime dependency. Routes are stored as [lng, lat] at 5 decimals.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const WAREHOUSE = [121.0437, 14.4714];
const RADIUS_KM = 25;
const SRC = "public/data/aquatech/mcdonalds-ph.geojson";
const OUT = "public/data/aquatech/routes.json";
const OSRM = "https://router.project-osrm.org/route/v1/driving";

const km = (a, b) => Math.hypot((a[0] - b[0]) * 111.32 * Math.cos((14.5 * Math.PI) / 180), (a[1] - b[1]) * 110.54);
const r5 = (n) => Math.round(n * 1e5) / 1e5;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const stores = JSON.parse(readFileSync(SRC, "utf8")).features
  .filter((f) => km(f.geometry.coordinates, WAREHOUSE) <= RADIUS_KM)
  .sort((a, b) => km(a.geometry.coordinates, WAREHOUSE) - km(b.geometry.coordinates, WAREHOUSE));

const out = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : { warehouse: WAREHOUSE, radiusKm: RADIUS_KM, baked: null, stores: [] };
const done = new Set(out.stores.map((s) => s.id));
console.log(`${stores.length} stores in radius, ${done.size} already baked`);

let n = 0;
for (const f of stores) {
  const id = f.properties.id;
  if (done.has(id)) continue;
  const [lng, lat] = f.geometry.coordinates;
  const url = `${OSRM}/${WAREHOUSE.join(",")};${lng},${lat}?overview=simplified&geometries=geojson`;
  let ok = false;
  for (let attempt = 0; attempt < 4 && !ok; attempt++) {
    try {
      const res = await fetch(url);
      if (res.status === 429) { await sleep(2000 * (attempt + 1)); continue; }
      const j = await res.json();
      if (j.code !== "Ok") throw new Error(j.code);
      const rt = j.routes[0];
      const coords = rt.geometry.coordinates.map(([x, y]) => [r5(x), r5(y)]);
      out.stores.push({ id, name: f.properties.name, address: f.properties.address, lng: r5(lng), lat: r5(lat), dist: Math.round(rt.distance), dur: Math.round(rt.duration), coords });
      ok = true;
    } catch (e) {
      console.warn(`  ${id}: ${e.message} (attempt ${attempt + 1})`);
      await sleep(1000);
    }
  }
  if (!ok) console.warn(`  ${id}: skipped`);
  if (++n % 20 === 0) { out.baked = new Date().toISOString().slice(0, 10); writeFileSync(OUT, JSON.stringify(out)); console.log(`  ${out.stores.length} baked`); }
  await sleep(120);
}
out.baked = new Date().toISOString().slice(0, 10);
out.stores.sort((a, b) => a.dist - b.dist);
writeFileSync(OUT, JSON.stringify(out));
console.log(`done: ${out.stores.length} routes → ${OUT}`);
