#!/usr/bin/env node
// Warps a scanned historical map into web mercator over [W,S,E,N], for the old-maps menu
// (src/content/oldmaps.ts). Source pixels come from a polynomial fit of control points [lon,lat,x,y]:
// graticule crossings (see scripts/graticule.mjs), a sheet's four corners (--order b, bilinear), or
// places matched by eye. With --pin, each control point is also pinned exactly, the leftover error
// spread by inverse-distance weighting that fades out over --reach km. Needs ImageMagick.
//   npm run oldmap -- <img> <cp.json> W S E N <px/deg lon> <out.webp> [--order 2] [--pin] [--reach 40] [--mask x0,y0,x1,y1]
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
const a = process.argv.slice(2);
const [img, cpFile] = a; const [W, S, E, N, ppd] = a.slice(2, 7).map(Number); const out = a[7];
const opt = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const orderArg = opt('--order', '3'), bilinear = orderArg === 'b', order = bilinear ? 1 : +orderArg, pin = a.includes('--pin'), reach = +opt('--reach', 40);
const mask = opt('--mask', null)?.split(',').map(Number);
const cp = JSON.parse(fs.readFileSync(cpFile, 'utf8'));

// Least squares for the polynomial, as in fit.py.
const cu = cp.reduce((s, p) => s + p[0], 0) / cp.length, cv = cp.reduce((s, p) => s + p[1], 0) / cp.length;
const terms = (u, v) => { if (bilinear) return [1, u, v, u * v]; const t = []; for (let i = 0; i <= order; i++) for (let j = 0; j <= order - i; j++) t.push(u ** i * v ** j); return t; };
function solve(A, b) {
  const n = A[0].length, M = [];
  for (let i = 0; i < n; i++) { M.push([]); for (let j = 0; j < n; j++) M[i].push(A.reduce((s, r) => s + r[i] * r[j], 0)); M[i].push(A.reduce((s, r, k) => s + r[i] * b[k], 0)); }
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
  }
  return M.map((r, i) => r[n] / r[i]);
}
const A = cp.map((p) => terms(p[0] - cu, p[1] - cv));
const cx = solve(A, cp.map((p) => p[2])), cy = solve(A, cp.map((p) => p[3]));
const poly = (lon, lat) => { const t = terms(lon - cu, lat - cv); let x = 0, y = 0; for (let i = 0; i < t.length; i++) { x += cx[i] * t[i]; y += cy[i] * t[i]; } return [x, y]; };
const resid = cp.map((p) => { const [x, y] = poly(p[0], p[1]); return [p[2] - x, p[3] - y]; });
const km = (lon1, lat1, lon2, lat2) => { const k = Math.cos((lat1 * Math.PI) / 180) * 111.32; return Math.hypot((lon1 - lon2) * k, (lat1 - lat2) * 110.57); };
const src = (lon, lat) => {
  let [x, y] = poly(lon, lat);
  if (!pin) return [x, y];
  let wx = 0, wy = 0, ws = 1 / (reach * reach);
  for (let i = 0; i < cp.length; i++) {
    const d = km(lon, lat, cp[i][0], cp[i][1]);
    if (d < 1e-6) return [cp[i][2], cp[i][3]];
    const w = 1 / (d * d); wx += w * resid[i][0]; wy += w * resid[i][1]; ws += w;
  }
  return [x + wx / ws, y + wy / ws];
};

const [sw, sh] = execFileSync('magick', ['identify', '-format', '%w %h', img]).toString().split(' ').map(Number);
const rgb = execFileSync('magick', [img, '-depth', '8', 'rgb:-'], { maxBuffer: sw * sh * 3 + 1024 });
const merc = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const outW = Math.round((E - W) * ppd);
const outH = Math.round(((merc(N) - merc(S)) / (((E - W) * Math.PI) / 180)) * outW);
const px = Buffer.alloc(outW * outH * 4);
const inside = (x, y) => x >= 0 && y >= 0 && x < sw - 1 && y < sh - 1 && (!mask || (x >= mask[0] && y >= mask[1] && x <= mask[2] && y <= mask[3]));
// Evaluate the mapping on a coarse lattice and interpolate, for speed.
const step = 8, gw = Math.ceil(outW / step) + 1, gh = Math.ceil(outH / step) + 1, grid = new Float64Array(gw * gh * 2);
for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
  const lon = W + ((E - W) * i * step) / outW;
  const m = merc(N) - ((merc(N) - merc(S)) * j * step) / outH;
  const lat = (2 * Math.atan(Math.exp(m)) - Math.PI / 2) * (180 / Math.PI);
  const [x, y] = src(lon, lat); grid[(j * gw + i) * 2] = x; grid[(j * gw + i) * 2 + 1] = y;
}
for (let oy = 0; oy < outH; oy++) {
  const gj = Math.min(Math.floor(oy / step), gh - 2), fy = oy / step - gj;
  for (let ox = 0; ox < outW; ox++) {
    const gi = Math.min(Math.floor(ox / step), gw - 2), fx = ox / step - gi;
    const g = (ii, jj, k) => grid[((gj + jj) * gw + gi + ii) * 2 + k];
    const x = (1 - fy) * ((1 - fx) * g(0, 0, 0) + fx * g(1, 0, 0)) + fy * ((1 - fx) * g(0, 1, 0) + fx * g(1, 1, 0));
    const y = (1 - fy) * ((1 - fx) * g(0, 0, 1) + fx * g(1, 0, 1)) + fy * ((1 - fx) * g(0, 1, 1) + fx * g(1, 1, 1));
    if (!inside(x, y)) continue;
    const x0 = Math.floor(x), y0 = Math.floor(y), dx = x - x0, dy = y - y0, o = (oy * outW + ox) * 4;
    for (let c = 0; c < 3; c++) {
      const s = (xx, yy) => rgb[(yy * sw + xx) * 3 + c];
      px[o + c] = (1 - dy) * ((1 - dx) * s(x0, y0) + dx * s(x0 + 1, y0)) + dy * ((1 - dx) * s(x0, y0 + 1) + dx * s(x0 + 1, y0 + 1));
    }
    px[o + 3] = 255;
  }
}
execFileSync('magick', ['-size', `${outW}x${outH}`, '-depth', '8', 'rgba:-', '-quality', '82', out], { input: px, maxBuffer: 1 << 28 });
const err = resid.map(([x, y]) => Math.hypot(x, y));
console.log(`${out}: ${outW}x${outH}, bounds [${W}, ${S}, ${E}, ${N}]; polynomial order ${order}, max residual ${Math.max(...err).toFixed(1)} px${pin ? ', pinned' : ''}`);
