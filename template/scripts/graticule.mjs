#!/usr/bin/env node
// Refines graticule crossings on a scanned map: for each estimate, finds the darkest near-vertical and
// near-horizontal straight lines through a window around it and returns their intersection.
//   node scripts/graticule.mjs <image> <estimates.json [[lon,lat,x,y],...]> [window=320]
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
const [img, estFile, winArg] = process.argv.slice(2);
const W = +(winArg ?? 320);
const est = JSON.parse(fs.readFileSync(estFile, 'utf8'));
const out = [];
for (const [lon, lat, x0, y0] of est) {
  const left = Math.round(x0 - W / 2), top = Math.round(y0 - W / 2);
  const raw = execFileSync('magick', [img, '-crop', `${W}x${W}+${left}+${top}`, '+repage', '-colorspace', 'gray', '-depth', '8', 'gray:-'], { maxBuffer: 1 << 26 });
  const dark = (x, y) => (x < 0 || y < 0 || x >= W || y >= W ? 0 : 255 - raw[y * W + x]);
  // A line's score: mean darkness along it, minus the mean darkness 4 px either side (so broad
  // dark areas, like coloured bands, don't win over a thin ruled line).
  const best = (vertical) => {
    let top = { s: -1 };
    for (let k = -0.2; k <= 0.2001; k += 0.004) {
      for (let o = 20; o < W - 20; o++) {
        let s = 0, n = 0;
        for (let t = 10; t < W - 10; t += 2) {
          const a = o + k * (t - W / 2);
          const xi = Math.round(vertical ? a : t), yi = Math.round(vertical ? t : a);
          const on = dark(xi, yi);
          const side = vertical ? (dark(xi - 4, yi) + dark(xi + 4, yi)) / 2 : (dark(xi, yi - 4) + dark(xi, yi + 4)) / 2;
          s += on - side; n++;
        }
        s /= n;
        if (s > top.s) top = { s, k, o };
      }
    }
    return top;
  };
  const v = best(true), h = best(false);
  // x = v.o + v.k*(y - W/2);  y = h.o + h.k*(x - W/2)
  let x = v.o, y = h.o;
  for (let i = 0; i < 20; i++) { x = v.o + v.k * (y - W / 2); y = h.o + h.k * (x - W / 2); }
  out.push({ lon, lat, x: +(left + x).toFixed(1), y: +(top + y).toFixed(1), vs: +v.s.toFixed(1), hs: +h.s.toFixed(1), vk: +v.k.toFixed(3), hk: +h.k.toFixed(3) });
}
console.log(JSON.stringify(out));
