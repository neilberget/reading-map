#!/usr/bin/env node
// Pulls OpenStreetMap geometry out of the OpenFreeMap vector tiles the map already uses, so places
// and routes can be found and traced without Overpass (which is often at capacity).
//
//   node scripts/tiles.mjs names   <w,s,e,n> [regex]                     named features and where they are
//   node scripts/tiles.mjs islands <w,s,e,n>                             islands (holes in water), with area
//   node scripts/tiles.mjs trace   <w,s,e,n> --from lon,lat --to lon,lat [options]
//        --layer waterway|transportation_name|boundary|...   (default waterway)
//        --where key=value   keep features whose property matches (repeatable; value may be /regex/)
//        --not key=value     drop features whose property matches (repeatable)
//        --zoom 12   --bridge 100 (metres, to join pieces)   --simplify 15 (metres)
//      Prints a JSON array of [lon, lat] from --from to --to; length goes to stderr.
//   node scripts/tiles.mjs water   <w,s,e,n> --via lon,lat --via lon,lat ... [options]
//        A canoe route: the shortest path through lakes and rivers between the waypoints, crossing land
//        only where it must (portages). Use when the water is a chain of lakes with no line to follow.
//        --zoom 11   --cell 100 (metres per grid cell)   --land 30 (cost of a land cell vs water)
//      Prints a JSON array of [lon, lat]; length and the share on land go to stderr.
//
// Tiles are cached in .tile-cache/. Examples:
//   node scripts/tiles.mjs names -89.72,47.90,-89.55,47.99 "island|point"
//   node scripts/tiles.mjs trace -93.5,47.9,-89.45,48.8 --layer boundary --where admin_level=2 --not maritime=1 \
//        --from -89.83,48.004 --to -93.39,48.605 --zoom 11
//   node scripts/tiles.mjs trace -89.86,47.95,-89.66,48.03 --layer transportation_name \
//        --where "name=Grand Portage Trail" --from -89.6847,47.9625 --to -89.826,48.0065 --zoom 14
import fs from 'node:fs';
import path from 'node:path';
import { VectorTile } from '@mapbox/vector-tile';
import { PbfReader as Pbf } from 'pbf';

const CACHE = path.resolve('.tile-cache');
const args = process.argv.slice(2);
const cmd = args.shift();
const bbox = (args.shift() ?? '').split(',').map(Number);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i < 0 ? fallback : args[i + 1];
};
const opts = (name) => args.flatMap((a, i) => (a === `--${name}` ? [args[i + 1]] : []));
const lonlat = (s) => s.split(',').map(Number);

if (!['names', 'islands', 'trace', 'water'].includes(cmd) || bbox.length !== 4 || bbox.some(Number.isNaN)) {
  console.error(fs.readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1, 28).join('\n'));
  process.exit(1);
}
const [W, S, E, N] = bbox;

// ---------- tiles ----------

/** fetch, retried a few times: the tile server sometimes resets the connection. */
async function get(url) {
  for (let tries = 1; ; tries++) {
    try {
      return await fetch(url);
    } catch (err) {
      if (tries === 5) throw err;
      await new Promise((r) => setTimeout(r, 1000 * tries));
    }
  }
}

let template;
async function tileUrl(z, x, y) {
  template ??= (await (await get('https://tiles.openfreemap.org/planet')).json()).tiles[0];
  return template.replace('{z}', z).replace('{x}', x).replace('{y}', y);
}
const tx = (lon, z) => Math.floor(((lon + 180) / 360) * 2 ** z);
const ty = (lat, z) => {
  const r = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z);
};
const tileLat = (y, z) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / 2 ** z))) * 180) / Math.PI;

/** Every tile over the bbox at zoom z, as { x, y, z, vt, box }. */
async function* tiles(z) {
  fs.mkdirSync(CACHE, { recursive: true });
  const count = (tx(E, z) - tx(W, z) + 1) * (ty(S, z) - ty(N, z) + 1);
  if (count > 1500) throw new Error(`${count} tiles at z${z}: use a smaller box or a lower --zoom`);
  for (let x = tx(W, z); x <= tx(E, z); x++) {
    for (let y = ty(N, z); y <= ty(S, z); y++) {
      const file = path.join(CACHE, `${z}-${x}-${y}.pbf`);
      if (!fs.existsSync(file)) {
        const res = await get(await tileUrl(z, x, y));
        if (!res.ok) throw new Error(`tile ${z}/${x}/${y}: HTTP ${res.status}`);
        fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
      }
      const box = [(x / 2 ** z) * 360 - 180, tileLat(y + 1, z), ((x + 1) / 2 ** z) * 360 - 180, tileLat(y, z)];
      yield { x, y, z, vt: new VectorTile(new Pbf(fs.readFileSync(file))), box };
    }
  }
}

const nameOf = (p) => p['name:latin'] || p.name_en || p.name;
const metres = (a, b) => {
  const k = Math.cos((((a[1] + b[1]) / 2) * Math.PI) / 180);
  return Math.hypot((a[0] - b[0]) * 111320 * k, (a[1] - b[1]) * 110570);
};
const round = (p) => [+p[0].toFixed(5), +p[1].toFixed(5)];

// ---------- names ----------

if (cmd === 'names') {
  const re = new RegExp(args[0] ?? '.', 'i');
  const seen = new Map();
  for await (const t of tiles(+opt('zoom', 14))) {
    for (const [layer, l] of Object.entries(t.vt.layers)) {
      for (let i = 0; i < l.length; i++) {
        const f = l.feature(i);
        const name = nameOf(f.properties);
        if (!name || !re.test(name)) continue;
        const flat = [f.toGeoJSON(t.x, t.y, t.z).geometry.coordinates].flat(4);
        const key = `${layer}|${f.properties.class}|${name}`;
        if (!seen.has(key)) seen.set(key, `${layer.padEnd(19)} ${String(f.properties.class ?? '').padEnd(14)} ${name}  [${round(flat).join(', ')}]`);
      }
    }
  }
  console.log([...seen.values()].sort().join('\n') || 'nothing named like that here');
}

// ---------- islands ----------

if (cmd === 'islands') {
  const out = new Map();
  for await (const t of tiles(+opt('zoom', 14))) {
    const l = t.vt.layers.water;
    if (!l) continue;
    for (let i = 0; i < l.length; i++) {
      const g = l.feature(i).toGeoJSON(t.x, t.y, t.z).geometry;
      const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
      for (const hole of polys.flatMap((p) => p.slice(1))) {
        let a = 0, cx = 0, cy = 0;
        for (let k = 0; k < hole.length - 1; k++) {
          const [x0, y0] = hole[k], [x1, y1] = hole[k + 1];
          const c = x0 * y1 - x1 * y0;
          a += c; cx += (x0 + x1) * c; cy += (y0 + y1) * c;
        }
        const centre = round([cx / (3 * a), cy / (3 * a)]);
        const ha = (Math.abs(a / 2) * 111320 * Math.cos((centre[1] * Math.PI) / 180) * 110570) / 10000;
        if (ha >= 0.2) out.set(centre.join(), `${ha.toFixed(1).padStart(8)} ha  [${centre.join(', ')}]`);
      }
    }
  }
  console.log([...out.values()].sort((a, b) => parseFloat(b) - parseFloat(a)).join('\n') || 'no islands here');
}

// ---------- trace ----------

if (cmd === 'trace') {
  const layer = opt('layer', 'waterway');
  const test = (spec) => {
    const [k, ...rest] = spec.split('=');
    const v = rest.join('=');
    const re = v.startsWith('/') && v.endsWith('/') ? new RegExp(v.slice(1, -1), 'i') : null;
    return (p) => {
      const have = k === 'name' ? nameOf(p) : p[k];
      return re ? re.test(String(have ?? '')) : String(have) === v;
    };
  };
  const keep = opts('where').map(test);
  const drop = opts('not').map(test);
  const from = lonlat(opt('from', ''));
  const to = lonlat(opt('to', ''));
  if (from.length !== 2 || to.length !== 2) throw new Error('trace needs --from lon,lat and --to lon,lat');

  // Each line is cut at its own tile's edges, so pieces from neighbouring tiles meet end to end.
  const clip = (line, [w, s, e, n]) => {
    const pieces = [];
    let cur = null;
    for (let i = 1; i < line.length; i++) {
      const [x0, y0] = line[i - 1], [x1, y1] = line[i];
      const dx = x1 - x0, dy = y1 - y0;
      let t0 = 0, t1 = 1, ok = true;
      for (const [p, q] of [[-dx, x0 - w], [dx, e - x0], [-dy, y0 - s], [dy, n - y0]]) {
        if (p === 0) { if (q < 0) { ok = false; break; } continue; }
        const r = q / p;
        if (p < 0) { if (r > t1) { ok = false; break; } if (r > t0) t0 = r; }
        else { if (r < t0) { ok = false; break; } if (r < t1) t1 = r; }
      }
      if (!ok) { if (cur) pieces.push(cur); cur = null; continue; }
      const a = [x0 + t0 * dx, y0 + t0 * dy], b = [x0 + t1 * dx, y0 + t1 * dy];
      if (!cur) cur = [a];
      cur.push(b);
      if (t1 < 1) { pieces.push(cur); cur = null; }
    }
    if (cur) pieces.push(cur);
    return pieces;
  };

  const lines = [];
  for await (const t of tiles(+opt('zoom', 12))) {
    const l = t.vt.layers[layer];
    if (!l) continue;
    for (let i = 0; i < l.length; i++) {
      const f = l.feature(i);
      if (!keep.every((k) => k(f.properties)) || drop.some((d) => d(f.properties))) continue;
      const g = f.toGeoJSON(t.x, t.y, t.z).geometry;
      const parts = g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : [];
      for (const part of parts) lines.push(...clip(part, t.box));
    }
  }
  if (!lines.length) throw new Error(`no ${layer} features matched in that box`);

  // Graph over the points; near points (within --bridge metres) are joined across seams and gaps.
  const key = (p) => `${p[0].toFixed(5)},${p[1].toFixed(5)}`;
  const pts = new Map();
  const adj = new Map();
  const link = (a, b, d) => {
    (adj.get(a) ?? adj.set(a, []).get(a)).push([b, d]);
    (adj.get(b) ?? adj.set(b, []).get(b)).push([a, d]);
  };
  for (const line of lines) {
    for (let i = 1; i < line.length; i++) {
      const a = key(line[i - 1]), b = key(line[i]);
      if (a === b) continue;
      pts.set(a, line[i - 1]);
      pts.set(b, line[i]);
      link(a, b, metres(line[i - 1], line[i]));
    }
  }
  const bridge = +opt('bridge', 100);
  const cell = bridge / 111000;
  const grid = new Map();
  for (const [k, p] of pts) {
    const g = `${Math.floor(p[0] / cell)},${Math.floor(p[1] / cell)}`;
    (grid.get(g) ?? grid.set(g, []).get(g)).push(k);
  }
  for (const [k, p] of pts) {
    const gx = Math.floor(p[0] / cell), gy = Math.floor(p[1] / cell);
    for (let dx = -2; dx <= 2; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (const k2 of grid.get(`${gx + dx},${gy + dy}`) ?? []) {
          if (k2 <= k) continue;
          const d = metres(p, pts.get(k2));
          if (d < bridge) link(k, k2, d * 1.5);
        }
      }
    }
  }
  const nearest = (target) => {
    let best = null, bd = Infinity;
    for (const [k, p] of pts) { const d = metres(p, target); if (d < bd) { bd = d; best = k; } }
    return [best, bd];
  };
  const [start, ds] = nearest(from);
  const [end, de] = nearest(to);
  console.error(`start ${Math.round(ds)} m from --from, end ${Math.round(de)} m from --to`);

  // Dijkstra with a binary heap.
  const dist = new Map([[start, 0]]);
  const prev = new Map();
  const heap = [[0, start]];
  const push = (item) => {
    heap.push(item);
    for (let i = heap.length - 1; i > 0; ) {
      const p = (i - 1) >> 1;
      if (heap[p][0] <= heap[i][0]) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      for (let i = 0; ; ) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]];
        i = m;
      }
    }
    return top;
  };
  while (heap.length) {
    const [d, k] = pop();
    if (k === end) break;
    if (d > (dist.get(k) ?? Infinity)) continue;
    for (const [k2, w] of adj.get(k) ?? []) {
      if (d + w < (dist.get(k2) ?? Infinity)) {
        dist.set(k2, d + w);
        prev.set(k2, k);
        push([d + w, k2]);
      }
    }
  }
  if (!dist.has(end)) throw new Error('the pieces do not connect: raise --bridge, widen the box, or split the trace');

  const route = [];
  for (let k = end; k; k = prev.get(k)) route.push(pts.get(k));
  route.reverse();

  // Douglas–Peucker in metres.
  const tol = +opt('simplify', 15);
  const simplify = (p) => {
    if (p.length < 3) return p;
    let best = -1, idx = 0;
    const [a, b] = [p[0], p[p.length - 1]];
    const ab = metres(a, b);
    for (let i = 1; i < p.length - 1; i++) {
      const d = ab === 0 ? metres(p[i], a) : (2 * Math.abs(area(a, b, p[i]))) / ab;
      if (d > best) { best = d; idx = i; }
    }
    return best <= tol ? [a, b] : [...simplify(p.slice(0, idx + 1)).slice(0, -1), ...simplify(p.slice(idx))];
  };
  const area = (a, b, c) => {
    const k = Math.cos((a[1] * Math.PI) / 180);
    const [ax, ay, bx, by, cx, cy] = [a[0] * 111320 * k, a[1] * 110570, b[0] * 111320 * k, b[1] * 110570, c[0] * 111320 * k, c[1] * 110570];
    return ((bx - ax) * (cy - ay) - (cx - ax) * (by - ay)) / 2;
  };
  const out = simplify(route).map(round);
  let km = 0;
  for (let i = 1; i < out.length; i++) km += metres(out[i - 1], out[i]) / 1000;
  console.error(`${out.length} points, ${km.toFixed(1)} km (${(km / 1.609).toFixed(1)} mi)`);
  console.log(JSON.stringify(out));
}

// ---------- water ----------

if (cmd === 'water') {
  const vias = opts('via').map(lonlat);
  if (vias.length < 2) throw new Error('water needs at least two --via lon,lat');
  const cellM = +opt('cell', 100);
  const landCost = +opt('land', 30);
  const mid = ((S + N) / 2) * (Math.PI / 180);
  const dLat = cellM / 110570;
  const dLon = cellM / (111320 * Math.cos(mid));
  const cols = Math.ceil((E - W) / dLon);
  const rows = Math.ceil((N - S) / dLat);
  if (cols * rows > 40e6) throw new Error(`${cols}×${rows} grid is too big: raise --cell or shrink the box`);
  const wet = new Uint8Array(cols * rows);
  const gx = (lon) => (lon - W) / dLon;
  const gy = (lat) => (N - lat) / dLat;

  // Fill polygons row by row (even–odd, so islands stay land), and draw rivers a cell wide.
  const fill = (rings) => {
    const edges = rings.flatMap((r) => r.slice(1).map((p, i) => [gx(r[i][0]), gy(r[i][1]), gx(p[0]), gy(p[1])]));
    let y0 = Infinity, y1 = -Infinity;
    for (const [, a, , b] of edges) { y0 = Math.min(y0, a, b); y1 = Math.max(y1, a, b); }
    for (let row = Math.max(0, Math.floor(y0)); row <= Math.min(rows - 1, Math.ceil(y1)); row++) {
      const yc = row + 0.5;
      const xs = [];
      for (const [ax, ay, bx, by] of edges) {
        if ((ay <= yc) !== (by <= yc)) xs.push(ax + ((yc - ay) / (by - ay)) * (bx - ax));
      }
      xs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        for (let col = Math.max(0, Math.ceil(xs[i] - 0.5)); col <= Math.min(cols - 1, Math.floor(xs[i + 1] - 0.5)); col++) wet[row * cols + col] = 1;
      }
    }
  };
  const draw = (line) => {
    for (let i = 1; i < line.length; i++) {
      const [x0, y0, x1, y1] = [gx(line[i - 1][0]), gy(line[i - 1][1]), gx(line[i][0]), gy(line[i][1])];
      const n = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2) + 1;
      for (let k = 0; k <= n; k++) {
        const col = Math.floor(x0 + ((x1 - x0) * k) / n), row = Math.floor(y0 + ((y1 - y0) * k) / n);
        if (col >= 0 && col < cols && row >= 0 && row < rows) wet[row * cols + col] = 1;
      }
    }
  };
  for await (const t of tiles(+opt('zoom', 11))) {
    for (const name of ['water', 'waterway']) {
      const l = t.vt.layers[name];
      if (!l) continue;
      for (let i = 0; i < l.length; i++) {
        const f = l.feature(i);
        if (f.properties.brunnel === 'tunnel' || f.properties.intermittent === 1) continue;
        const g = f.toGeoJSON(t.x, t.y, t.z).geometry;
        if (g.type === 'Polygon') fill(g.coordinates);
        else if (g.type === 'MultiPolygon') g.coordinates.forEach(fill);
        else if (g.type === 'LineString') draw(g.coordinates);
        else if (g.type === 'MultiLineString') g.coordinates.forEach(draw);
      }
    }
  }

  // Snap each waypoint to the nearest water within a kilometre or so.
  const snap = ([lon, lat]) => {
    const c = Math.floor(gx(lon)), r = Math.floor(gy(lat));
    const reach = Math.ceil(1000 / cellM);
    let best = r * cols + c, bd = Infinity;
    for (let dr = -reach; dr <= reach; dr++) for (let dc = -reach; dc <= reach; dc++) {
      const rr = r + dr, cc = c + dc;
      if (rr < 0 || rr >= rows || cc < 0 || cc >= cols || !wet[rr * cols + cc]) continue;
      const d = dr * dr + dc * dc;
      if (d < bd) { bd = d; best = rr * cols + cc; }
    }
    return best;
  };

  // A* on the 8-connected grid; land costs more, so the path takes to land only for a portage.
  const g = new Float32Array(cols * rows);
  const from = new Int32Array(cols * rows);
  const astar = (a, b) => {
    g.fill(Infinity);
    from.fill(-1);
    const bc = b % cols, br = (b / cols) | 0;
    const h = (i) => Math.hypot((i % cols) - bc, ((i / cols) | 0) - br);
    const heap = [[h(a), a]];
    g[a] = 0;
    const push = (item) => {
      heap.push(item);
      for (let i = heap.length - 1; i > 0; ) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; }
    };
    const pop = () => {
      const top = heap[0], last = heap.pop();
      if (heap.length) {
        heap[0] = last;
        for (let i = 0; ; ) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; }
      }
      return top;
    };
    while (heap.length) {
      const [f, i] = pop();
      if (i === b) break;
      if (f - h(i) > g[i] + 1e-6) continue;
      const c = i % cols, r = (i / cols) | 0;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const rr = r + dr, cc = c + dc;
        if (rr < 0 || rr >= rows || cc < 0 || cc >= cols) continue;
        const j = rr * cols + cc;
        const step = (dr && dc ? Math.SQRT2 : 1) * (wet[j] ? 1 : landCost);
        if (g[i] + step < g[j]) { g[j] = g[i] + step; from[j] = i; push([g[j] + h(j), j]); }
      }
    }
    const path = [];
    for (let i = b; i !== -1; i = from[i]) path.push(i);
    return path.reverse();
  };

  // Straighten: from each cell, jump to the farthest later cell reachable in a straight line over water.
  const clear = (i, j) => {
    const [c0, r0, c1, r1] = [i % cols, (i / cols) | 0, j % cols, (j / cols) | 0];
    const n = Math.max(Math.abs(c1 - c0), Math.abs(r1 - r0)) * 2;
    for (let k = 0; k <= n; k++) {
      if (!wet[Math.round(r0 + ((r1 - r0) * k) / n) * cols + Math.round(c0 + ((c1 - c0) * k) / n)]) return false;
    }
    return true;
  };
  const straighten = (path) => {
    const out = [path[0]];
    for (let i = 0; i < path.length - 1; ) {
      let j = i + 1;
      if (wet[path[i]]) {
        for (let k = Math.min(path.length - 1, i + 400); k > i + 1; k--) if (wet[path[k]] && clear(path[i], path[k])) { j = k; break; }
      }
      out.push(path[j]);
      i = j;
    }
    return out;
  };

  const cells = [];
  let onLand = 0;
  const stops = vias.map(snap);
  for (let k = 1; k < stops.length; k++) {
    const leg = astar(stops[k - 1], stops[k]);
    onLand += leg.filter((i) => !wet[i]).length;
    cells.push(...(k > 1 ? straighten(leg).slice(1) : straighten(leg)));
    console.error(`leg ${k}: ${leg.length} cells`);
  }
  const out = cells.map((i) => round([W + ((i % cols) + 0.5) * dLon, N - (((i / cols) | 0) + 0.5) * dLat]));
  let km = 0;
  for (let i = 1; i < out.length; i++) km += metres(out[i - 1], out[i]) / 1000;
  console.error(`${out.length} points, ${km.toFixed(1)} km (${(km / 1.609).toFixed(1)} mi), about ${((onLand * cellM) / 1000).toFixed(1)} km over land (portages or gaps in the map)`);
  console.log(JSON.stringify(out));
}
