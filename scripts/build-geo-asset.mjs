// Build the world-countries geo asset from Natural Earth 1:110m admin-0
// (public domain / CC0 — https://www.naturalearthdata.com). One-off build tool:
// fetches the source GeoJSON, extracts ISO-alpha2 → { name, rings }, simplifies
// + rounds the coordinates, and writes our own compact asset. NOT a runtime
// dependency — the committed JSON is the artifact the engine's geo family loads.
//
// Run: node scripts/build-geo-asset.mjs
// Out: apps/web/public/geo/world-countries.json
//
// rings: number[][][]  — each ring is a flat [lon,lat,lon,lat,…] not used; we
// keep [[ [lon,lat], … ], … ] outer rings only (holes dropped — a choropleth
// fills the country; lakes/holes add weight for no visual gain at this scale).

import { writeFileSync, mkdirSync } from "node:fs";
import { execSync } from "node:child_process";

const SRC = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson";
const OUT_DIR = new URL("../apps/web/public/geo/", import.meta.url);
const OUT = new URL("world-countries.json", OUT_DIR);

// Douglas–Peucker simplification on a [lon,lat] ring. epsilon in degrees.
function simplify(points, eps) {
  if (points.length < 4) return points;
  let maxD = 0, idx = 0;
  const [ax, ay] = points[0], [bx, by] = points[points.length - 1];
  for (let i = 1; i < points.length - 1; i++) {
    const [px, py] = points[i];
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy || 1e-12;
    const t = ((px - ax) * dx + (py - ay) * dy) / len2;
    const cx = ax + t * dx, cy = ay + t * dy;
    const d = (px - cx) ** 2 + (py - cy) ** 2;
    if (d > maxD) { maxD = d; idx = i; }
  }
  if (maxD > eps * eps) {
    const left = simplify(points.slice(0, idx + 1), eps);
    const right = simplify(points.slice(idx), eps);
    return left.slice(0, -1).concat(right);
  }
  return [points[0], points[points.length - 1]];
}

const round = (v) => Math.round(v * 100) / 100; // ~1km at the equator; plenty.

function ringsFromGeometry(geom) {
  // Polygon: [outer, hole, …]; MultiPolygon: [[outer, hole, …], …]. Outer only.
  const polys = geom.type === "Polygon" ? [geom.coordinates]
    : geom.type === "MultiPolygon" ? geom.coordinates : [];
  const out = [];
  for (const poly of polys) {
    const outer = poly[0]; // ring 0 is the outer boundary
    if (!outer || outer.length < 4) continue;
    const simp = simplify(outer.map(([lon, lat]) => [lon, lat]), 0.4)
      .map(([lon, lat]) => [round(lon), round(lat)]);
    if (simp.length >= 3) out.push(simp);
  }
  return out;
}

console.log("[geo] fetching Natural Earth 110m…");
const tmp = "/tmp/ne_110m_admin_0_countries.geojson";
execSync(`curl -sL --max-time 60 "${SRC}" -o "${tmp}"`, { stdio: "inherit" });
const { default: gj } = await import(tmp, { with: { type: "json" } }).catch(async () => {
  const { readFileSync } = await import("node:fs");
  return { default: JSON.parse(readFileSync(tmp, "utf8")) };
});

const world = {};
let kept = 0, skipped = 0;
for (const f of gj.features) {
  const p = f.properties || {};
  // ISO_A2 is "-99" for a few disputed/unrecognized entities; fall back to _EH.
  let iso = p.ISO_A2 && p.ISO_A2 !== "-99" ? p.ISO_A2 : (p.ISO_A2_EH || null);
  if (!iso || iso === "-99") { skipped++; continue; }
  iso = iso.toUpperCase();
  const rings = ringsFromGeometry(f.geometry || {});
  if (!rings.length) { skipped++; continue; }
  world[iso] = { name: p.NAME || p.ADMIN || iso, rings };
  kept++;
}

mkdirSync(OUT_DIR, { recursive: true });
const json = JSON.stringify(world);
writeFileSync(OUT, json);
console.log(`[geo] wrote ${OUT.pathname}`);
console.log(`[geo] countries: ${kept} kept, ${skipped} skipped · ${(json.length / 1024).toFixed(0)} KB`);
