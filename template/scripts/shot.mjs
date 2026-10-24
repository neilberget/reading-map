#!/usr/bin/env node
// A screenshot of the running dev map, for checking a new overlay, or a guessed spot against the
// satellite or a topographic map. It sets what the page restores on load (view, chapter, open concept or
// place, satellite, a map from the Maps menu), then can drop red labelled crosses on candidate points.
// Needs the map running: the library's server (`npm run dev` in ~/Projects/reading-maps), or for a book on
// its own, the book's `npm run dev`. Drives the installed Google Chrome, or the browser at CHROME_PATH.
//   npm run shot -- <out.png> [--at lon,lat] [--zoom 12] [--chapter 3] [--open <id>] [--sat] [--map <old map id>]
//     [--no-route] [--no-panel] [--mark "name:lon,lat"]...
//   npm run shot -- camp.png --at -107.71,55.94 --zoom 13 --sat --no-panel --mark "camp:-107.7105,55.9378"
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const a = process.argv.slice(2);
const out = a[0];
const opt = (k) => (a.includes(k) ? a[a.indexOf(k) + 1] : undefined);
const marks = a.flatMap((x, i) => (a[i - 1] === '--mark' ? [x] : [])).map((m) => {
  const [n, ll] = m.split(':');
  return [n, ...ll.split(',').map(Number)];
});
// The library serves this book under its folder's name, if it has it; a book on its own serves itself at
// the server.port in its vite.config.ts.
const slug = path.basename(process.cwd());
const shelf = await fetch('http://localhost:5179/books.json').then((r) => r.json(), () => []).catch(() => []);
const port = fs.readFileSync('vite.config.ts', 'utf8').match(/server:\s*\{[^}]*port:\s*(\d+)/)?.[1] ?? 5173;
const url = shelf.some((b) => b.slug === slug) ? `http://localhost:5179/${slug}/` : `http://localhost:${port}/`;

const at = opt('--at')?.split(',').map(Number), chapter = opt('--chapter');
const saved = {
  view: at && { center: at, zoom: Number(opt('--zoom') ?? 12) },
  chapter: chapter && (/^\d+$/.test(chapter) ? Number(chapter) : chapter),
  concept: opt('--open') ?? null,
  satellite: a.includes('--sat'),
  oldMap: opt('--map') ?? null,
  hideRoute: a.includes('--no-route'),
};
const tiles = saved.satellite || saved.oldMap;

const browser = await puppeteer.launch({
  // Chrome wherever it installs itself on macOS, Windows or Linux, unless CHROME_PATH names another browser.
  ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: 'chrome' }),
  headless: 'new',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1400,900'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1400, height: 900 });
await page.goto(url, { waitUntil: 'networkidle2' });
await page.evaluate((v) => { localStorage.clear(); localStorage.setItem(window.__store, v); }, JSON.stringify(saved));
await page.reload({ waitUntil: 'networkidle2' });
await new Promise((r) => setTimeout(r, tiles ? 9000 : 3500));
if (a.includes('--no-panel')) {
  // Without the panel, centre on --at across the whole window rather than beside the panel.
  await page.evaluate((v) => {
    document.getElementById('panel')?.style.setProperty('display', 'none');
    if (v) window.__map.jumpTo({ ...v, padding: { top: 0, left: 0, right: 0, bottom: 0 } });
  }, saved.view);
  await new Promise((r) => setTimeout(r, tiles ? 4000 : 1000));
}
if (marks.length) {
  const xy = await page.evaluate((ms) => ms.map(([n, lon, lat]) => [n, window.__map.project([lon, lat])]), marks);
  await page.evaluate((xy) => {
    for (const [n, p] of xy) {
      const d = document.createElement('div');
      d.textContent = `✚ ${n}`;
      d.style.cssText = `position:fixed;left:${p.x - 6}px;top:${p.y - 9}px;font:bold 13px sans-serif;color:#d00;white-space:nowrap;text-shadow:0 0 3px #fff,0 0 3px #fff;z-index:9999;pointer-events:none`;
      document.body.append(d);
    }
  }, xy);
}
await page.screenshot({ path: out });
await browser.close();
console.log(out);
