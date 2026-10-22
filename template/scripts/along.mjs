#!/usr/bin/env node
// Distances along the book's route (public/data/route.geojson), in the book's units (src/book.ts), for
// checking the author's mileages: how far each point is from the start, how far apart they are, and how
// far each sits off the line. "+N" or "-N" after a point gives the spot N units further on or back.
//   npm run along -- <lon,lat> [<lon,lat> | +N | -N] ...
//   npm run along -- -107.767,55.4995 +20          where "twenty miles" from the first camp lands
import fs from 'node:fs';

const line = JSON.parse(fs.readFileSync('public/data/route.geojson', 'utf8')).features.find((f) => f.geometry.type === 'LineString').geometry.coordinates;
const imperial = /units:\s*'imperial'/.test(fs.readFileSync('src/book.ts', 'utf8'));
const unit = imperial ? 1.609344 : 1, name = imperial ? 'mi' : 'km';

const R = 6371.0088, rad = Math.PI / 180;
function km(a, b) {
  const h = Math.sin(((b[1] - a[1]) * rad) / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(((b[0] - a[0]) * rad) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
const cum = [0];
for (let i = 1; i < line.length; i++) cum.push(cum[i - 1] + km(line[i - 1], line[i]));

/** The nearest spot on the route to p: its distance from the start and how far p is off the line, in km. */
function snap(p) {
  const kx = Math.cos(p[1] * rad);
  let best = { along: 0, off: Infinity };
  for (let i = 0; i < line.length - 1; i++) {
    const [a, b] = [line[i], line[i + 1]];
    const dx = (b[0] - a[0]) * kx, dy = b[1] - a[1];
    const t = Math.max(0, Math.min(1, (((p[0] - a[0]) * kx) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
    const q = [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
    const off = km(p, q);
    if (off < best.off) best = { along: cum[i] + t * (cum[i + 1] - cum[i]), off };
  }
  return best;
}
/** The point on the route `along` km from the start. */
function at(along) {
  const d = Math.max(0, Math.min(cum.at(-1), along));
  let i = cum.findIndex((c) => c >= d);
  if (i <= 0) return line[0];
  const t = (d - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
  return [line[i - 1][0] + t * (line[i][0] - line[i - 1][0]), line[i - 1][1] + t * (line[i][1] - line[i - 1][1])];
}

const f = (n, d = 1) => (n / unit).toFixed(d);
console.log(`route: ${f(cum.at(-1), 0)} ${name}`);
let prev = null;
for (const arg of process.argv.slice(2)) {
  if (/^[+-][\d.]+$/.test(arg)) {
    if (!prev) throw new Error(`${arg} needs a point before it`);
    const along = prev.along + Number(arg) * unit;
    const p = at(along);
    console.log(`${arg} ${name} → ${p[0].toFixed(4)},${p[1].toFixed(4)}  (${f(along)} ${name} from the start)`);
    prev = { along, off: 0 };
    continue;
  }
  const p = arg.split(',').map(Number);
  const s = snap(p);
  const step = prev ? `, ${f(Math.abs(s.along - prev.along))} ${name} from the last` : '';
  console.log(`${arg}: ${f(s.along)} ${name} from the start${step} (${f(s.off, 2)} ${name} off the route)`);
  prev = s;
}
