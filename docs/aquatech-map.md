# Aquatech case study — 3D Metro Manila map

Route: `/client/aquatech`

## Files

| File | Role |
|---|---|
| `app/client/aquatech/page.tsx` | Route + metadata |
| `components/aquatech/AquatechExperience.tsx` | Intro → descend → explore phases, WebGL check, reduced motion, UI on top of the map |
| `components/aquatech/MetroManilaMap.tsx` | MapLibre instance (client-only via `next/dynamic`), camera flight, user-takeover, cleanup |
| `components/aquatech/aquatech.module.css` | Typography, veil, UI overlays, MapLibre control styling |
| `lib/aquatech/mapStyle.ts` | Tile provider choice, camera presets, bounds, the dark map style |

## Tile provider

The style is written against the **OpenMapTiles vector schema**. Two providers serve that schema, so switching between them changes nothing in the style.

| | OpenFreeMap (default) | MapTiler (optional) |
|---|---|---|
| Key | None | `NEXT_PUBLIC_MAPTILER_KEY` |
| Cost | Free, commercial use allowed | Free tier is for testing / non-commercial use. Flex is $30/mo (25k map sessions, 500k API requests) |
| SLA | None | Yes, on paid plans |
| Data | OSM, weekly planet build | OSM (OpenMapTiles), MapTiler-hosted |

**Recommendation:** OpenFreeMap is fine for launch. Set a MapTiler key (Flex) if the case study ever needs an uptime guarantee.

### Using MapTiler
```bash
# .env.local  (also add it to Vercel → Project → Settings → Environment Variables)
NEXT_PUBLIC_MAPTILER_KEY=your_key
```
In the MapTiler dashboard, limit the key to `binary1702.com`, `*.binary1702.com` and `localhost`, because it is visible in the browser. Restart `next dev` after adding it.

## Building heights: what's real

- Footprints come from OpenStreetMap and are real.
- Heights use `render_height`, which is the OSM `height` tag, else `building:levels` × ~3.66 m, else a default low height. Most towers in Makati, BGC, Ortigas and Rockwell are tagged. Many low-rise homes use the default height.
- No buildings are generated or invented. A building missing from OSM is missing from the map.
- Next step if we need better coverage: Overture Maps buildings, which add Microsoft and Google footprints and heights, served as self-hosted PMTiles. That is a separate pipeline and is not built here.

## Attribution (required)
The source attribution shows "OpenFreeMap © OpenMapTiles © OpenStreetMap contributors" (or the MapTiler credit) behind the ⓘ control. Do not remove it.

## Behaviour
- **Intro (≈5 s):** the title sits over a dark veil while the city loads at altitude. Visitors can skip it with Enter, Space, ↓, scroll or the "Enter Metro Manila" button.
- **Descend:** one `flyTo` (≈10 s desktop, ≈8 s mobile) into Makati / BGC with the pitch rising to 63°. Buildings rise out of the ground between zoom 13 and 14.6.
- **Explore:** the first pointer, wheel, touch or key input stops any flight. After that the code never moves the camera again.
- **Reduced motion:** the camera jumps straight to the end position and the fades are short.
- **No WebGL / map failure:** the intro stays up with a one-line note.
- Exploration is limited to roughly Metro Manila plus its edges (see `BOUNDS`).

Camera presets and colours live at the top of `lib/aquatech/mapStyle.ts`. Amber (`--accent`) is kept unused here so the operational layers added later can own it.

## McDonald's layer

- Data: `public/data/aquatech/mcdonalds-ph.geojson`, built from OpenStreetMap features tagged `brand:wikidata=Q38076`. The 2026-10-31 run returned 811 raw features and kept 790 after dropping closed stores and merging duplicates within 40 m.
- Refresh: `node scripts/aquatech/fetch-mcdonalds.mjs`. The public Overpass server is sometimes overloaded; the script retries, or you can pass a saved response file as the first argument.
- Coverage: this count comes from OSM, not from McDonald's. McDonald's PH reported its 800th store in July 2025, so it lines up, but a few stores may be missing or out of date.
- UI: amber points appear when the descent finishes. Clicking one opens a card with branch, address and coordinates. The panel counts up to the total, shows how many stores are in view, and switches between **Metro Manila** and **Philippines**. The camera only moves when one of those buttons is pressed.

## Aquatech office

`AQUATECH_OFFICE` in `lib/aquatech/mapStyle.ts`: Warehouse 103, Bormaheco Compound, Cervantes St., West Service Rd., Parañaque. Pinned on Cervantes St. (OSM way 33302810), the compound's access road off West Service Rd, at `[121.0437, 14.4714]`. OSM has no footprint for Warehouse 103 itself, so nudge the coordinates if the exact building is known. The marker is a green map pin (`#2FE38A`). The **Office** view button flies to it.

## Type (this page only)

Archivo at full width and weight 900 for display, and JetBrains Mono for readouts. Both load through `next/font/google` in `lib/aquatech/fonts.ts`, which self-hosts them at build time. The rest of the site keeps Playfair and Archivo Narrow.
