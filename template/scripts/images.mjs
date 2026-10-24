#!/usr/bin/env node
// Fetches every Wikimedia picture the content mentions into public/images/, and records each one's
// size, credit, licence and source page in src/content/images.json for the app to show.
//
//   npm run images            fetch what's new
//   npm run images -- --all   fetch everything again
//
// A picture is any object in src/content/ with a `file:` (plus `wiki: 'en'` for an English Wikipedia
// file); `own: true` pictures are the reader's, already in public/images/own/, and are skipped. One with a
// `url:` comes from elsewhere on the web: it is saved in public/images/web/, credited to its `credit:`
// and linked to its `page:`, under its `license:` if it has a free one (otherwise the site's name, which
// keeps it private on a library's website).
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const CONTENT = path.join(ROOT, 'src/content');
const OUT = path.join(ROOT, 'public/images');
const MANIFEST = path.join(CONTENT, 'images.json');
const UA = { 'User-Agent': 'reading-map/0.1 (personal reading project)' };
const all = process.argv.includes('--all');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Wikimedia rate-limits busy clients with 429s; wait as long as it asks (or back off) and try again. */
async function get(url) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: UA });
    if ((res.status !== 429 && res.status !== 503) || attempt === 6) return res;
    const wait = Number(res.headers.get('retry-after')) || 5 * 2 ** attempt;
    console.log(`  … rate-limited, waiting ${wait}s`);
    await sleep(wait * 1000);
  }
}

/** A string field in an object literal's text, unescaped: `url: '…'` gives the …. */
const field = (obj, key) => {
  const m = obj.match(new RegExp(`\\b${key}:\\s*(?:'((?:[^'\\\\]|\\\\.)*)'|"((?:[^"\\\\]|\\\\.)*)")`));
  return m ? (m[1] ?? m[2]).replace(/\\(.)/g, '$1') : undefined;
};

/** Every { file: '…', wiki?, own?, url? } object literal in the content files. */
function wanted() {
  const found = new Map();
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir)) {
      const p = path.join(dir, name);
      if (fs.statSync(p).isDirectory()) walk(p);
      else if (p.endsWith('.ts')) {
        const text = fs.readFileSync(p, 'utf8');
        const re = /file:\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")/g;
        for (const m of text.matchAll(re)) {
          const file = (m[1] ?? m[2]).replace(/\\(.)/g, '$1');
          const obj = text.slice(text.lastIndexOf('{', m.index), text.indexOf('}', m.index));
          if (/own:\s*true/.test(obj)) continue;
          const url = field(obj, 'url');
          if (url) found.set(file, { url, page: field(obj, 'page'), credit: field(obj, 'credit'), license: field(obj, 'license') });
          else found.set(file, /wiki:\s*'en'/.test(obj) ? 'en' : 'commons');
        }
      }
    }
  };
  walk(CONTENT);
  return found;
}

const slug = (file) =>
  file
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);

const text = (html) => {
  const t = String(html ?? '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
  // Commons often repeats a field in a hidden span: "Unknown authorUnknown author".
  const half = t.length / 2;
  return Number.isInteger(half) && t.slice(0, half) === t.slice(half) ? t.slice(0, half) : t;
};

async function info(file, wiki) {
  const host = wiki === 'en' ? 'en.wikipedia.org' : 'commons.wikimedia.org';
  const q = new URLSearchParams({
    action: 'query',
    titles: `File:${file}`,
    prop: 'imageinfo',
    iiprop: 'url|size|extmetadata',
    iiurlwidth: '1280',
    format: 'json',
    formatversion: '2',
  });
  const res = await get(`https://${host}/w/api.php?${q}`);
  if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`);
  const page = (await res.json()).query?.pages?.[0];
  const ii = page?.imageinfo?.[0];
  if (!ii) throw new Error(`${file}: not found on ${host}`);
  const meta = ii.extmetadata ?? {};
  return {
    url: ii.thumburl ?? ii.url,
    width: ii.thumbwidth ?? ii.width,
    height: ii.thumbheight ?? ii.height,
    credit: text(meta.Artist?.value) || text(meta.Credit?.value) || 'Unknown',
    license: text(meta.LicenseShortName?.value) || (wiki === 'en' ? 'Non-free (Wikipedia)' : 'See source'),
    page: ii.descriptionurl,
  };
}

/** Width and height from a PNG, GIF, JPEG or WebP file's header. */
function dimensions(b) {
  if (b.readUInt32BE(0) === 0x89504e47) return [b.readUInt32BE(16), b.readUInt32BE(20)];
  if (b.toString('ascii', 0, 3) === 'GIF') return [b.readUInt16LE(6), b.readUInt16LE(8)];
  if (b.toString('ascii', 8, 12) === 'WEBP') {
    const kind = b.toString('ascii', 12, 16);
    if (kind === 'VP8 ') return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
    if (kind === 'VP8L') {
      const n = b.readUInt32LE(21);
      return [(n & 0x3fff) + 1, ((n >> 14) & 0x3fff) + 1];
    }
    return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
  }
  for (let i = 2; i + 9 < b.length; ) {
    if (b[i] !== 0xff) return [];
    const marker = b[i + 1];
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker))
      return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
    i += 2 + b.readUInt16BE(i + 2);
  }
  return [];
}

/** The site a web photo comes from: its credit and licence when it gives neither. */
const siteOf = ({ url, page }) => (page || /^https?:/.test(url) ? new URL(page ?? url).hostname.replace(/^www\./, '') : 'Saved copy');

/** A photo from elsewhere on the web, saved as it is; or, with a path under public/, a copy already saved (a crop). */
async function fromWeb(file, { url, page, credit, license }) {
  const site = siteOf({ url, page });
  if (!/^https?:/.test(url)) {
    const [width, height] = dimensions(fs.readFileSync(path.join(ROOT, 'public', url)));
    return { src: url, width, height, credit: credit ?? site, license: license ?? site, page };
  }
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh) reading-map/0.1' } });
  if (!res.ok) throw new Error(`${file}: download HTTP ${res.status}`);
  const body = Buffer.from(await res.arrayBuffer());
  const ext = (url.match(/\.(jpe?g|png|gif|webp)(?:$|[?#])/i)?.[1] ?? 'jpg').toLowerCase().replace('jpeg', 'jpg');
  const name = `${slug(file)}.${ext}`;
  fs.mkdirSync(path.join(OUT, 'web'), { recursive: true });
  fs.writeFileSync(path.join(OUT, 'web', name), body);
  const [width, height] = dimensions(body);
  return { src: `images/web/${name}`, width, height, credit: credit ?? site, license: license ?? site, page: page ?? url };
}

const manifest = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) : {};
fs.mkdirSync(OUT, { recursive: true });
const files = wanted();
let fetched = 0;
for (const [file, wiki] of files) {
  if (!all && manifest[file] && fs.existsSync(path.join(ROOT, 'public', manifest[file].src))) {
    // A saved web photo's credit and licence come from the content: keep them current without fetching it again.
    if (typeof wiki === 'object') Object.assign(manifest[file], { credit: wiki.credit ?? siteOf(wiki), license: wiki.license ?? siteOf(wiki) });
    continue;
  }
  try {
    if (typeof wiki === 'object') {
      manifest[file] = await fromWeb(file, wiki);
      fetched++;
      console.log(`✓ ${file}  (${manifest[file].license}; ${manifest[file].credit})`);
      continue;
    }
    const i = await info(file, wiki);
    const ext = (i.url.match(/\.(jpe?g|png|gif|webp|tiff?)(?:$|\?)/i)?.[1] ?? 'jpg').toLowerCase().replace('jpeg', 'jpg');
    const name = `${slug(file)}.${ext.startsWith('tif') ? 'jpg' : ext}`;
    const res = await get(i.url);
    if (!res.ok) throw new Error(`${file}: download HTTP ${res.status}`);
    fs.writeFileSync(path.join(OUT, name), Buffer.from(await res.arrayBuffer()));
    manifest[file] = { src: `images/${name}`, width: i.width, height: i.height, credit: i.credit, license: i.license, page: i.page };
    fetched++;
    console.log(`✓ ${file}  (${i.license}; ${i.credit})`);
    await sleep(1500);
  } catch (e) {
    console.error(`✗ ${e.message}`);
  }
}
const sorted = Object.fromEntries(Object.entries(manifest).filter(([f]) => files.has(f)).sort(([a], [b]) => a.localeCompare(b)));
fs.writeFileSync(MANIFEST, JSON.stringify(sorted, null, 2) + '\n');
console.log(`${fetched} fetched, ${Object.keys(sorted).length} in images.json`);
