import type { Feature, FeatureCollection, LineString, Point, Polygon } from "geojson";

/* ------------------------------------------------------------------
   Aquatech — live operations simulation.

   A seeded, deterministic model of the service pipeline that runs
   entirely in the browser (nothing to deploy, nothing to break in a
   pitch). Each monitored McDonald's has a filtration unit reporting
   filter life, flow and TDS. The pipeline:

     TELEMETRY → DETECT → DISPATCH → EN ROUTE → ON SITE → VERIFIED → VALUE

   Units drift toward "due" or throw an alert; the dispatcher assigns
   the best idle van; the van drives the real road route (baked from
   OSRM in routes.json) from the Parañaque warehouse, services the
   unit, verifies it, and returns. KPIs accumulate as it runs.

   Pure TypeScript — no React, no MapLibre. The map and the console
   read snapshots; `tick()` is the only mutator.
   ------------------------------------------------------------------ */

export const ROUTES_URL = "/data/aquatech/routes.json";
/** Simulated seconds per real second. 40× makes a 25-minute drive take ~38 s. */
export const SIM_SPEED = 40;
export const FLEET_SIZE = 8;

export type UnitStatus = "ok" | "due" | "alert" | "service";
export const STATUS_COLOR: Record<UnitStatus, string> = {
  ok: "#3DDC97",      // green: fine
  due: "#E0A74A",     // amber: needs service
  alert: "#E0A74A",   // amber: needs service (same colour; priority is the engine's business, not the eye's)
  service: "#2D9CFF", // blue: a tech is on site
};
export const UNMONITORED_COLOR = "rgba(242,239,231,0.34)"; // network stores outside the service territory
export const FLEET_COLOR = "#2D9CFF";

/* One colour rule for the whole page.
   Stores: green = OK, amber = needs service.  Techs: blue = heading to a store, red = returning to main office. */
export const RETURN_COLOR = "#FF5C5C";

/** Service zones: the territory split by geography, for the counts in the HUD. */
export type Zone = { id: string; name: string; test: (lng: number, lat: number) => boolean };
export const ZONES: Zone[] = [
  { id: "north", name: "North", test: (_lng, lat) => lat > 14.63 },
  { id: "bay", name: "Manila Bay", test: (lng, lat) => lng < 121.0 && lat > 14.52 },
  { id: "east", name: "East", test: (lng, lat) => lng > 121.08 && lat > 14.52 },
  { id: "central", name: "Makati · BGC · Ortigas", test: (_lng, lat) => lat > 14.52 },
  { id: "south", name: "South", test: () => true },
];
export const zoneOf = (lng: number, lat: number) => ZONES.find((z) => z.test(lng, lat)) ?? ZONES[ZONES.length - 1];

/** The zone rules as boxes [west, south, east, north]; drawn clipped to the territory circle. */
const ZONE_BOX: Record<string, [number, number, number, number]> = {
  north: [-180, 14.63, 180, 90],
  bay: [-180, 14.52, 121.0, 14.63],
  east: [121.08, 14.52, 180, 14.63],
  central: [121.0, 14.52, 121.08, 14.63],
  south: [-180, -90, 180, 14.52],
};
/** Shaded zone polygons for the map: a circle of `radiusKm` around the warehouse, cut by each zone's box. */
export function zonePolygons(center: [number, number], radiusKm: number): FeatureCollection<Polygon | Point, { id: string; name: string }> {
  const kmLng = 111.32 * Math.cos((center[1] * Math.PI) / 180), kmLat = 110.54;
  const circle: [number, number][] = [];
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    circle.push([center[0] + (Math.cos(a) * radiusKm) / kmLng, center[1] + (Math.sin(a) * radiusKm) / kmLat]);
  }
  // Sutherland–Hodgman against each side of the box
  const clip = (poly: [number, number][], inside: (p: [number, number]) => boolean, cross: (a: [number, number], b: [number, number]) => [number, number]) => {
    const out: [number, number][] = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      if (inside(a)) { out.push(a); if (!inside(b)) out.push(cross(a, b)); }
      else if (inside(b)) out.push(cross(a, b));
    }
    return out;
  };
  const atLng = (x: number) => (a: [number, number], b: [number, number]): [number, number] => [x, a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0])];
  const atLat = (y: number) => (a: [number, number], b: [number, number]): [number, number] => [a[0] + ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]), y];
  const features: Feature<Polygon | Point, { id: string; name: string }>[] = [];
  for (const z of ZONES) {
    const [w, s, e, n] = ZONE_BOX[z.id];
    let poly = circle;
    poly = clip(poly, (p) => p[0] >= w, atLng(w));
    poly = clip(poly, (p) => p[0] <= e, atLng(e));
    poly = clip(poly, (p) => p[1] >= s, atLat(s));
    poly = clip(poly, (p) => p[1] <= n, atLat(n));
    if (poly.length < 3) continue;
    features.push({ type: "Feature", geometry: { type: "Polygon", coordinates: [[...poly, poly[0]]] }, properties: { id: z.id, name: z.name } });
    // one label per zone, at the shape's centre (a polygon would be labelled once per tile)
    const c = poly.reduce((a, p) => [a[0] + p[0] / poly.length, a[1] + p[1] / poly.length], [0, 0]);
    features.push({ type: "Feature", geometry: { type: "Point", coordinates: c }, properties: { id: z.id, name: z.name } });
  }
  return { type: "FeatureCollection", features };
}

export type RouteStore = { id: string; name: string; address: string | null; lng: number; lat: number; dist: number; dur: number; coords: [number, number][] };
export type RoutesFile = { warehouse: [number, number]; radiusKm: number; baked: string; stores: RouteStore[] };

export type Unit = {
  id: string; code: string; name: string; address: string | null; lng: number; lat: number;
  route: RouteStore;
  life: number;   // filter life 0..1
  flow: number;   // L/min, nominal
  tds: number;    // ppm, nominal (filtered water)
  status: UnitStatus;
  jobId: string | null;
  zone: Zone;
};
export type JobKind = "swap" | "alert" | "inspect";
export type JobState = "queued" | "enroute" | "onsite" | "done";
export type Job = { id: string; kind: JobKind; unitId: string; priority: 1 | 2 | 3; createdAt: number; vanId: string | null; assignedAt: number; arrivedAt: number; doneAt: number; state: JobState; reason: string };
export type VanState = "idle" | "enroute" | "onsite" | "returning";
export type Van = {
  id: string; label: string; state: VanState;
  pos: [number, number]; bearing: number;
  route: RouteStore | null; progress: number; speed: number; // metres along route, m/s
  jobId: string | null; untilT: number; done: number;
};
export type Stage = "detect" | "dispatch" | "arrive" | "complete" | "return";
export type Ev = { id: number; t: number; stage: Stage; text: string; unitId?: string; vanId?: string; kind?: JobKind };
export type ZoneStat = { zone: Zone; units: number; open: number; alerts: number };
export type KPI = {
  monitored: number; network: number; online: number; openAlerts: number;
  uptime: number;        // %
  jobsToday: number;
  responseMin: number;   // mean detect → on site
  liters: number;        // filtered today
  downtimeHrs: number;   // avoided today (est.)
  savedPhp: number;      // est.
};
export type Stages = { monitor: number; detect: number; dispatch: number; onsite: number; verified: number };

/* ---- helpers ------------------------------------------------------ */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const R = 6371000;
function metres(a: [number, number], b: [number, number]) {
  const dLat = ((b[1] - a[1]) * Math.PI) / 180, dLng = ((b[0] - a[0]) * Math.PI) / 180;
  const la1 = (a[1] * Math.PI) / 180, la2 = (b[1] * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function bearing(a: [number, number], b: [number, number]) {
  const la1 = (a[1] * Math.PI) / 180, la2 = (b[1] * Math.PI) / 180, dLng = ((b[0] - a[0]) * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(la2), x = Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}
/** Cumulative distance along each baked route, computed once. */
const cumCache = new WeakMap<RouteStore, number[]>();
function cumulative(r: RouteStore) {
  let c = cumCache.get(r);
  if (c) return c;
  c = [0];
  for (let i = 1; i < r.coords.length; i++) c.push(c[i - 1] + metres(r.coords[i - 1], r.coords[i]));
  cumCache.set(r, c);
  return c;
}
/** Position and heading `m` metres along the route. */
function along(r: RouteStore, m: number): { pos: [number, number]; bearing: number } {
  const c = cumulative(r), total = c[c.length - 1];
  const d = Math.max(0, Math.min(total, m));
  let i = 1;
  while (i < c.length - 1 && c[i] < d) i++;
  const a = r.coords[i - 1], b = r.coords[i];
  const seg = c[i] - c[i - 1];
  const f = seg > 0 ? (d - c[i - 1]) / seg : 0;
  return { pos: [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f], bearing: bearing(a, b) };
}
/** Seconds since midnight in Manila right now — the sim clock starts at the real local time. */
function manilaSeconds() {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Manila", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).formatToParts(new Date());
  const g = (t: string) => Number(p.find((x) => x.type === t)?.value ?? 0);
  return (g("hour") % 24) * 3600 + g("minute") * 60 + g("second");
}
export const clock = (t: number) => {
  const s = ((t % 86400) + 86400) % 86400;
  const hh = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60), ss = Math.floor(s % 60);
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
};
export const hhmm = (t: number) => clock(t).slice(0, 5);

const OPEN_T = 6 * 3600;             // the service day starts at 06:00
const PHP_PER_DOWNTIME_HOUR = 14500; // est. beverage revenue at risk per store-hour (demo assumption)
const DOWNTIME_PER_ALERT_HRS = 5.5;  // est. outage avoided when an alert is caught before failure (demo assumption)
const AVG_FLOW_LPM = 1.9;

/* ---- the model ---------------------------------------------------- */
export class OpsSim {
  readonly warehouse: [number, number];
  readonly units: Unit[];
  readonly vans: Van[] = [];
  readonly jobs = new Map<string, Job>();
  readonly events: Ev[] = []; // newest first, capped
  readonly networkSize: number;
  readonly radiusKm: number;
  t: number;
  /** Bumped whenever a unit's status changes / a van's route changes; consumers diff on these. */
  unitsVersion = 0;
  routesVersion = 0;
  readonly changed = new Set<string>();

  private rnd: () => number;
  private evId = 0;
  private jobSeq = 0;
  private jobsDoneToday: number;
  private responseSum: number;
  private responseN: number;
  private liters: number;
  private alertsResolved: number;
  private unitById = new Map<string, Unit>();

  constructor(file: RoutesFile, networkSize: number, seed = 1702) {
    this.rnd = mulberry32(seed);
    this.warehouse = file.warehouse;
    this.networkSize = networkSize;
    this.radiusKm = file.radiusKm;
    this.t = manilaSeconds();
    const hoursOpen = Math.max(0, (this.t - OPEN_T) / 3600);

    this.units = file.stores.map((s, i) => ({
      id: s.id, code: `MNL-${String(101 + i).padStart(4, "0")}`, name: s.name, address: s.address, lng: s.lng, lat: s.lat, route: s,
      life: 0.22 + 0.78 * this.rnd(), flow: 1.3 + 1.6 * this.rnd(), tds: 42 + 60 * this.rnd(), status: "ok", jobId: null,
      zone: zoneOf(s.lng, s.lat),
    }));
    for (const u of this.units) this.unitById.set(u.id, u);

    // what the day has already produced before the visitor arrived
    this.jobsDoneToday = Math.round(hoursOpen * 6.8);
    this.responseN = Math.min(12, this.jobsDoneToday);
    this.responseSum = this.responseN * (31 + 6 * this.rnd()) * 60;
    this.liters = hoursOpen * 3600 * this.units.length * AVG_FLOW_LPM / 60;
    this.alertsResolved = Math.round(this.jobsDoneToday * 0.27);

    for (let i = 0; i < FLEET_SIZE; i++) {
      this.vans.push({ id: `van-${i + 1}`, label: `Tech ${i + 1}`, state: "idle", pos: [...this.warehouse], bearing: 0, route: null, progress: 0, speed: 0, jobId: null, untilT: 0, done: Math.round(hoursOpen * 0.85) });
    }

    // pre-warm: the operation is already mid-shift when the page opens
    this.spawn("swap"); this.spawn("alert"); this.spawn("swap"); this.spawn("inspect"); this.spawn("swap");
    for (const j of this.jobs.values()) j.createdAt -= 120;
    this.dispatch();
    for (const v of this.vans) {
      if (v.state !== "enroute" || !v.route) continue;
      const total = v.route.dist;
      const f = 0.15 + 0.7 * this.rnd();
      v.progress = total * f;
      const j = this.jobs.get(v.jobId!)!;
      j.createdAt -= (f * total) / v.speed + 300;
      j.assignedAt = j.createdAt + 70 + 60 * this.rnd();
      const p = along(v.route, v.progress); v.pos = p.pos; v.bearing = p.bearing;
    }
    // one van already on site, one on its way back
    const idle = this.vans.filter((v) => v.state === "idle");
    if (idle[0]) this.placeOnsite(idle[0]);
    if (idle[1]) this.placeReturning(idle[1]);
    // backdate the pre-warm events so the log reads as history
    this.events.forEach((e, i) => { e.t = this.t - 90 - i * (140 + 160 * this.rnd()); });
    this.events.sort((a, b) => b.t - a.t);
    this.spawn("swap");
    this.changed.clear();
    for (const u of this.units) this.changed.add(u.id);
  }

  /* ---- public read side ---- */
  unit(id: string) { return this.unitById.get(id); }
  van(id: string) { return this.vans.find((v) => v.id === id); }
  job(id: string | null) { return id ? this.jobs.get(id) : undefined; }

  /** Live telemetry for display: nominal value plus a small, deterministic wobble. */
  telemetry(u: Unit) {
    const w = Math.sin(this.t / 37 + u.lng * 1000) * 0.5 + Math.sin(this.t / 11 + u.lat * 700) * 0.5;
    const j = this.job(u.jobId);
    const alertFlow = j?.kind === "alert" && j.reason.startsWith("Flow");
    const alertTds = j?.kind === "alert" && j.reason.startsWith("TDS");
    return {
      flow: Math.max(0.1, (alertFlow ? 0.3 : u.flow) + w * 0.12),
      tds: Math.round((alertTds ? 340 : u.tds) + w * 6),
      life: Math.round(u.life * 100),
      pressure: Math.round(((alertFlow ? 1.4 : 2.6) + w * 0.1) * 10) / 10,
    };
  }

  etaMin(v: Van) {
    if (!v.route || !v.speed) return 0;
    const left = v.state === "returning" ? v.progress : v.route.dist - v.progress;
    return Math.max(0, Math.round(left / v.speed / 60));
  }

  kpi(): KPI {
    const monitored = this.units.length;
    const openAlerts = this.units.filter((u) => u.status === "alert").length;
    const online = monitored - openAlerts;
    const downtimeHrs = this.alertsResolved * DOWNTIME_PER_ALERT_HRS;
    return {
      monitored, network: this.networkSize, online, openAlerts,
      uptime: (online / monitored) * 100,
      jobsToday: this.jobsDoneToday,
      responseMin: this.responseN ? this.responseSum / this.responseN / 60 : 0,
      liters: this.liters,
      downtimeHrs,
      savedPhp: downtimeHrs * PHP_PER_DOWNTIME_HOUR,
    };
  }

  stages(): Stages {
    let detect = 0, dispatch = 0, onsite = 0;
    for (const j of this.jobs.values()) {
      if (j.state === "queued") detect++;
      else if (j.state === "enroute") dispatch++;
      else if (j.state === "onsite") onsite++;
    }
    return { monitor: this.units.length - detect - dispatch - onsite, detect, dispatch, onsite, verified: this.jobsDoneToday };
  }

  zoneStats(): ZoneStat[] {
    return ZONES.map((zone) => {
      let units = 0, open = 0, alerts = 0;
      for (const u of this.units) {
        if (u.zone !== zone) continue;
        units++;
        if (u.jobId) open++;
        if (u.status === "alert") alerts++;
      }
      return { zone, units, open, alerts };
    });
  }

  /** Active jobs, newest first. */
  activeJobs() {
    return [...this.jobs.values()].filter((j) => j.state !== "done").sort((a, b) => b.createdAt - a.createdAt);
  }

  /** Job kind a van is carrying, or "none" when idle / returning (drawn in fleet blue). */
  private vanKind(v: Van): JobKind | "none" {
    const j = this.job(v.jobId);
    return j && v.state !== "returning" ? j.kind : "none";
  }
  vansGeoJSON(): FeatureCollection<Point, { id: string; label: string; state: VanState; kind: string; bearing: number }> {
    return {
      type: "FeatureCollection",
      features: this.vans.map((v) => ({ type: "Feature", geometry: { type: "Point", coordinates: v.pos }, properties: { id: v.id, label: v.label, state: v.state, kind: this.vanKind(v), bearing: v.bearing } })),
    };
  }
  routesGeoJSON(): FeatureCollection<LineString, { id: string; state: VanState; kind: string }> {
    const features: Feature<LineString, { id: string; state: VanState; kind: string }>[] = [];
    for (const v of this.vans) {
      if (!v.route || v.state === "idle" || v.state === "onsite") continue;
      features.push({ type: "Feature", geometry: { type: "LineString", coordinates: v.route.coords }, properties: { id: v.id, state: v.state, kind: this.vanKind(v) } });
    }
    return { type: "FeatureCollection", features };
  }

  /* ---- the only mutator ---- */
  tick(realDt: number) {
    const dt = Math.min(realDt, 0.1) * SIM_SPEED;
    this.t += dt;

    // telemetry drift: filters wear slowly across the whole network
    for (const u of this.units) if (u.status === "ok") u.life = Math.max(0.05, u.life - dt / (3600 * 24 * 45));

    // detection: new work arrives at a rate that keeps the fleet busy but never swamped
    const queued = this.stages().detect;
    const rate = queued >= 4 ? 1.2 / 3600 : 7.5 / 3600;
    if (this.rnd() < rate * dt) {
      const r = this.rnd();
      this.spawn(r < 0.62 ? "swap" : r < 0.9 ? "alert" : "inspect");
    }

    this.dispatch();

    for (const v of this.vans) {
      if (v.state === "enroute" && v.route) {
        v.progress += v.speed * dt;
        if (v.progress >= v.route.dist) this.arrive(v);
        else { const p = along(v.route, v.progress); v.pos = p.pos; v.bearing = p.bearing; }
      } else if (v.state === "onsite") {
        if (this.t >= v.untilT) this.complete(v);
      } else if (v.state === "returning" && v.route) {
        v.progress -= v.speed * dt;
        if (v.progress <= 0) { v.state = "idle"; v.route = null; v.pos = [...this.warehouse]; v.jobId = null; this.routesVersion++; }
        else { const p = along(v.route, v.progress); v.pos = p.pos; v.bearing = (p.bearing + 180) % 360; }
      }
    }

    this.liters += (this.units.length * AVG_FLOW_LPM / 60) * dt;
  }

  /* ---- pipeline stages ---- */
  private spawn(kind: JobKind) {
    const free = this.units.filter((u) => u.status === "ok" && !u.jobId);
    if (!free.length) return;
    // swaps favour the most-worn filters; alerts can hit anyone
    const u = kind === "swap"
      ? free.sort((a, b) => a.life - b.life)[Math.floor(this.rnd() * Math.min(12, free.length))]
      : free[Math.floor(this.rnd() * free.length)];
    let reason = "", priority: 1 | 2 | 3 = 2;
    if (kind === "swap") { u.life = 0.06 + 0.08 * this.rnd(); reason = `Filter life ${Math.round(u.life * 100)}%`; u.status = "due"; priority = 2; }
    else if (kind === "alert") { reason = this.rnd() < 0.5 ? `TDS ${Math.round(300 + 120 * this.rnd())} ppm` : `Flow ${(0.2 + 0.2 * this.rnd()).toFixed(1)} L/min`; u.status = "alert"; priority = 3; }
    else { reason = "Scheduled inspection"; u.status = "due"; priority = 1; }
    const id = `J-${String(++this.jobSeq + 1000 + this.jobsDoneToday).padStart(4, "0")}`;
    const job: Job = { id, kind, unitId: u.id, priority, createdAt: this.t, vanId: null, assignedAt: 0, arrivedAt: 0, doneAt: 0, state: "queued", reason };
    this.jobs.set(id, job);
    u.jobId = id;
    this.touch(u);
    this.log("detect", kind === "alert" ? `${u.code} · ${reason} → ALERT` : kind === "swap" ? `${u.code} · ${reason.toLowerCase()} → service due` : `${u.code} · inspection due`, u.id);
  }

  private dispatch() {
    const idle = this.vans.filter((v) => v.state === "idle");
    if (!idle.length) return;
    // the dispatcher takes ~45 s (sim) to score candidates before it commits a van
    const queue = [...this.jobs.values()].filter((j) => j.state === "queued" && this.t - j.createdAt >= 45)
      .sort((a, b) => b.priority - a.priority || (this.unit(a.unitId)!.route.dur - this.unit(b.unitId)!.route.dur) || a.createdAt - b.createdAt);
    for (const v of idle) {
      const j = queue.shift();
      if (!j) break;
      const u = this.unit(j.unitId)!;
      v.state = "enroute"; v.route = u.route; v.progress = 0; v.jobId = j.id;
      v.speed = (u.route.dist / u.route.dur) * (0.82 + 0.3 * this.rnd()); // traffic
      v.pos = [...this.warehouse];
      j.state = "enroute"; j.vanId = v.id; j.assignedAt = this.t;
      this.routesVersion++;
      this.log("dispatch", `${v.label} ← ${u.code} · ${(u.route.dist / 1000).toFixed(1)} km · ETA ${this.etaMin(v)} min`, u.id, v.id);
    }
  }

  private arrive(v: Van) {
    const j = this.job(v.jobId)!, u = this.unit(j.unitId)!;
    v.state = "onsite"; v.progress = v.route!.dist; v.pos = [u.lng, u.lat];
    const mins = j.kind === "alert" ? 24 + 14 * this.rnd() : j.kind === "swap" ? 13 + 8 * this.rnd() : 9 + 6 * this.rnd();
    v.untilT = this.t + mins * 60;
    j.state = "onsite"; j.arrivedAt = this.t;
    this.responseSum += j.arrivedAt - j.createdAt; this.responseN++;
    u.status = "service"; this.touch(u);
    this.routesVersion++;
    this.log("arrive", `${v.label} on site · ${u.code} · ${j.kind === "alert" ? "fault isolation" : j.kind === "swap" ? "cartridge swap" : "inspection"}`, u.id, v.id);
  }

  private complete(v: Van) {
    const j = this.job(v.jobId)!, u = this.unit(j.unitId)!;
    j.state = "done"; j.doneAt = this.t;
    this.jobsDoneToday++; v.done++;
    if (j.kind === "alert") this.alertsResolved++;
    u.life = 1; u.tds = 40 + 30 * this.rnd(); u.flow = 2.1 + 1.0 * this.rnd(); u.status = "ok"; u.jobId = null;
    this.touch(u);
    const tm = this.telemetry(u);
    this.log("complete", `${u.code} verified · TDS ${tm.tds} ppm · ${tm.flow.toFixed(1)} L/min`, u.id, v.id, j.kind);
    v.state = "returning"; v.progress = v.route!.dist;
    this.routesVersion++;
    this.log("return", `${v.label} returning to main office`, undefined, v.id);
    // the job stays queryable for the console, then falls out
    if (this.jobs.size > 60) for (const [id, jj] of this.jobs) { if (jj.state === "done") { this.jobs.delete(id); break; } }
  }

  private placeOnsite(v: Van) {
    const free = this.units.filter((u) => u.status === "ok" && !u.jobId && u.route.dur > 600);
    const u = free[Math.floor(this.rnd() * free.length)];
    const id = `J-${String(++this.jobSeq + 1000 + this.jobsDoneToday).padStart(4, "0")}`;
    const j: Job = { id, kind: "swap", unitId: u.id, priority: 2, createdAt: this.t - 2400, vanId: v.id, assignedAt: this.t - 2300, arrivedAt: this.t - 400, doneAt: 0, state: "onsite", reason: "Filter life 9%" };
    this.jobs.set(id, j); u.jobId = id; u.status = "service"; u.life = 0.09; this.touch(u);
    v.state = "onsite"; v.route = u.route; v.progress = u.route.dist; v.speed = u.route.dist / u.route.dur; v.pos = [u.lng, u.lat]; v.jobId = id; v.untilT = this.t + 420 + 500 * this.rnd();
    this.responseSum += 2000; this.responseN++;
    this.log("arrive", `${v.label} on site · ${u.code} · cartridge swap`, u.id, v.id);
  }
  private placeReturning(v: Van) {
    const free = this.units.filter((u) => u.status === "ok" && !u.jobId && u.route.dur > 900);
    const u = free[Math.floor(this.rnd() * free.length)];
    v.state = "returning"; v.route = u.route; v.speed = u.route.dist / u.route.dur; v.progress = u.route.dist * (0.3 + 0.5 * this.rnd()); v.jobId = null;
    const p = along(u.route, v.progress); v.pos = p.pos; v.bearing = (p.bearing + 180) % 360;
    this.routesVersion++;
    this.log("complete", `${u.code} verified · TDS ${Math.round(u.tds)} ppm · ${u.flow.toFixed(1)} L/min`, u.id, v.id);
    this.log("return", `${v.label} returning to main office`, undefined, v.id);
  }

  private touch(u: Unit) { this.changed.add(u.id); this.unitsVersion++; }
  private log(stage: Stage, text: string, unitId?: string, vanId?: string, kindOverride?: JobKind) {
    const u = unitId ? this.unit(unitId) : undefined;
    const kind = kindOverride ?? (u ? this.job(u.jobId)?.kind : undefined);
    this.events.unshift({ id: ++this.evId, t: this.t, stage, text, unitId, vanId, kind });
    if (this.events.length > 48) this.events.length = 48;
  }
}

/* ---- formatting shared by the console ---- */
export const fmtInt = (n: number) => Math.round(n).toLocaleString("en-US");
export const fmtPhp = (n: number) => (n >= 1e6 ? `₱${(n / 1e6).toFixed(2)}M` : `₱${Math.round(n / 1000)}K`);
export const KIND_LABEL: Record<JobKind, string> = { swap: "Cartridge swap", alert: "Fault response", inspect: "Inspection" };
export const STATE_LABEL: Record<VanState, string> = { idle: "At main office", enroute: "En route", onsite: "On site", returning: "Returning" };
