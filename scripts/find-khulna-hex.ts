import { readFileSync } from "fs";
import path from "path";
import { cellToLatLng } from "h3-js";

interface Row {
  h: string;
  p: number;
  cc: string;
  yf: number;
  m: number;
  rp: number;
  y0: number;
  y1: number;
}

const raw = readFileSync(path.resolve("public/data/hex_compact.json"), "utf-8");
const json = JSON.parse(raw);
const cols: string[] = json.columns;
const rows: (string | number)[][] = json.rows;

const bd = rows
  .map((r) => Object.fromEntries(cols.map((c, i) => [c, r[i]])) as unknown as Row)
  .filter((r) => r.cc === "BGD")
  .sort((a, b) => b.p - a.p);

console.log("Top 5 Bangladesh hexes by exposed population:");
for (const r of bd.slice(0, 5)) {
  const [lat, lng] = cellToLatLng(r.h);
  const span = r.y1 - r.y0 + 1;
  console.log(
    `  ${r.h} — pop=${r.p.toLocaleString()}, flooded=${r.yf}/${span} years, months=${r.m}, return=${r.rp.toFixed(2)}yr, centroid=[${lng.toFixed(3)}, ${lat.toFixed(3)}]`
  );
}
