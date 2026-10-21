import type { LonLat } from './content/types';

/** Chaikin's corner cutting: each pass replaces every corner with two points a quarter of the way along. */
export function smooth(points: LonLat[], closed: boolean, passes = 3): LonLat[] {
  let out = points;
  for (let pass = 0; pass < passes; pass++) {
    const next: LonLat[] = closed ? [] : [out[0]];
    const n = closed ? out.length : out.length - 1;
    for (let i = 0; i < n; i++) {
      const [ax, ay] = out[i];
      const [bx, by] = out[(i + 1) % out.length];
      next.push([ax * 0.75 + bx * 0.25, ay * 0.75 + by * 0.25], [ax * 0.25 + bx * 0.75, ay * 0.25 + by * 0.75]);
    }
    if (!closed) next.push(out[out.length - 1]);
    out = next;
  }
  return out;
}

export function ring(outline: LonLat[]): LonLat[] {
  const r = smooth(outline, true);
  return [...r, r[0]];
}

/** The middle of an outline's bounding box: good enough to hang a label on a roughly round area. */
export function middle(points: LonLat[]): LonLat {
  const [[w, s], [e, n]] = bounds(points);
  return [(w + e) / 2, (s + n) / 2];
}

export function bounds(points: LonLat[]): [LonLat, LonLat] {
  let w = Infinity;
  let s = Infinity;
  let e = -Infinity;
  let n = -Infinity;
  for (const [x, y] of points) {
    w = Math.min(w, x);
    e = Math.max(e, x);
    s = Math.min(s, y);
    n = Math.max(n, y);
  }
  return [
    [w, s],
    [e, n],
  ];
}

/** 55.44, -107.89 → 55°26′N 107°53′W */
export function dms(lon: number, lat: number): string {
  const part = (v: number, pos: string, neg: string) => {
    const a = Math.abs(v);
    let d = Math.floor(a);
    let m = Math.round((a - d) * 60);
    if (m === 60) {
      d += 1;
      m = 0;
    }
    return `${d}°${String(m).padStart(2, '0')}′${v >= 0 ? pos : neg}`;
  };
  return `${part(lat, 'N', 'S')} ${part(lon, 'E', 'W')}`;
}
