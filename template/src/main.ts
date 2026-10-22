import type { FeatureCollection } from 'geojson';
import { backlinks, chapters, concepts, listed, listedPlaces, picture, places, prose, type Picture } from './content';
import { oldMaps } from './content/oldmaps';
import type { Chapter, Concept } from './content/types';
import { book } from './book';
import { creditLine, pictureButton } from './lightbox';
import { ReadingMap } from './map';
import './styles.css';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Where the reader left off: the map view, the chapter and the open concept survive a reload. */
const STORE = 'lonely-land';
interface Saved {
  view?: { center: [number, number]; zoom: number };
  chapter?: number | string;
  concept?: string | null;
  satellite?: boolean;
  oldMap?: string | null;
  oldMapOpacity?: number;
  hideRoute?: boolean;
}
function load(): Saved {
  try {
    return JSON.parse(localStorage.getItem(STORE) ?? '{}') as Saved;
  } catch {
    return {};
  }
}
function save(patch: Saved) {
  try {
    localStorage.setItem(STORE, JSON.stringify({ ...load(), ...patch }));
  } catch {
    // Private windows can refuse storage; the page works without it.
  }
}

document.title = book.title;
$('book-title').textContent = book.title;
$('book-byline').textContent = `${book.author}, ${book.year}`;
$('book-tagline').textContent = book.tagline;
if (book.route) $('book-tagline').prepend(Object.assign(document.createElement('span'), { className: 'trip-line' }));

const saved = load();
const reader = new ReadingMap($('map'), $('readout'), saved.view);
if (import.meta.env.DEV) Object.assign(window, { __map: reader.map });
const panel = $('panel');
const wide = matchMedia('(min-width: 760px)');

/** Keep fitted views clear of the panel: beside it on wide screens, above it on phones. */
function updatePadding() {
  const r = panel.getBoundingClientRect();
  reader.padding = wide.matches
    ? { top: 40, right: 70, bottom: 40, left: r.right + 32 }
    : { top: 32, right: 56, bottom: window.innerHeight - r.top + 24, left: 24 };
}
new ResizeObserver(updatePadding).observe(panel);
wide.addEventListener('change', updatePadding);
updatePadding();

reader.map.on('moveend', () => save({ view: reader.view() }));
$('zoom-in').addEventListener('click', () => reader.zoomBy(1));
$('zoom-out').addEventListener('click', () => reader.zoomBy(-1));
$('zoom-home').addEventListener('click', () => reader.home());

function setSatellite(on: boolean) {
  $('satellite').setAttribute('aria-pressed', String(on));
  void reader.setSatellite(on);
  save({ satellite: on });
}
$('satellite').addEventListener('click', () => setSatellite($('satellite').getAttribute('aria-pressed') !== 'true'));
if (saved.satellite) setSatellite(true);

/** The old-maps button: a short menu of historical maps to lay over the land, and how strongly. */
let oldMap: string | null = null;
let oldMapOpacity = saved.oldMapOpacity ?? 0.85;
let hideRoute = saved.hideRoute ?? false;
function setOldMap(id: string | null) {
  oldMap = oldMaps.some((m) => m.id === id) ? id : null;
  $('old-maps').setAttribute('aria-pressed', String(!!oldMap));
  void reader.setOldMap(oldMaps.find((m) => m.id === oldMap) ?? null, oldMapOpacity);
  save({ oldMap });
  renderOldMaps();
}
function renderOldMaps() {
  const menu = $('old-maps-menu');
  menu.replaceChildren(el('p', 'eyebrow', 'Maps'));
  const list = el('ul', 'old-maps-list');
  const today = oldMaps.filter((m) => m.today), old = oldMaps.filter((m) => !m.today);
  const heading = (text: string) => list.append(el('li', 'old-maps-heading eyebrow', text));
  for (const m of [null, ...today, ...old]) {
    if (m && today.length && m === today[0]) heading('Today');
    if (m && today.length && m === old[0]) heading('Old maps');
    const item = el('li');
    const label = el('label');
    const radio = Object.assign(document.createElement('input'), { type: 'radio', name: 'old-map', checked: (m?.id ?? null) === oldMap });
    radio.addEventListener('change', () => setOldMap(m?.id ?? null));
    label.append(radio, el('span', 'old-map-name', m ? prose(m.name) : 'None'));
    item.append(label);
    if (m?.note) item.append(el('p', 'old-map-note', prose(m.note)));
    if (m) {
      const credit = el('p', 'old-map-credit', prose(m.credit));
      if (m.page) {
        const a = Object.assign(document.createElement('a'), { href: m.page, target: '_blank', rel: 'noopener', textContent: 'Source' });
        credit.append(' · ', a);
      }
      item.append(credit);
    }
    list.append(item);
  }
  const fade = el('label', 'old-map-opacity', 'Strength');
  const range = Object.assign(document.createElement('input'), { type: 'range', min: '0.2', max: '1', step: '0.05', value: String(oldMapOpacity) });
  range.addEventListener('input', () => {
    oldMapOpacity = Number(range.value);
    void reader.setOldMapOpacity(oldMapOpacity);
    save({ oldMapOpacity });
  });
  fade.append(range);
  const route = el('label', 'old-map-route');
  const box = Object.assign(document.createElement('input'), { type: 'checkbox', checked: !hideRoute });
  box.addEventListener('change', () => {
    hideRoute = !box.checked;
    void reader.setRouteVisible(!hideRoute);
    save({ hideRoute });
  });
  route.append(box, document.createTextNode(' Show the route'));
  menu.append(list, fade, route);
}
function toggleOldMapsMenu(open = $('old-maps-menu').hidden) {
  $('old-maps-menu').hidden = !open;
  $('old-maps').setAttribute('aria-expanded', String(open));
}
if (oldMaps.length) {
  $('old-maps').hidden = false;
  $('old-maps').addEventListener('click', () => toggleOldMapsMenu());
  document.addEventListener('keydown', (e) => e.key === 'Escape' && toggleOldMapsMenu(false));
  document.addEventListener('click', (e) => {
    const t = e.target as Element;
    if (!t.closest('#old-maps, #old-maps-menu')) toggleOldMapsMenu(false);
  });
  // A reader's own choice, None included, wins over the book's default map.
  setOldMap(saved.oldMap !== undefined ? saved.oldMap : (oldMaps.find((m) => m.default)?.id ?? null));
  if (hideRoute) void reader.setRouteVisible(false);
}

/** A chapter's number, or the title of an unnumbered one such as the introduction. */
const chapterKey = (c: Chapter) => c.number ?? c.title;
const chapterName = (c: Chapter) => (c.number === undefined ? c.title : `Chapter ${c.number}`);

let chapter: Chapter = chapters.find((c) => chapterKey(c) === saved.chapter) ?? chapters[0];
let open: string | null = null;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, html?: string) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (html !== undefined) node.innerHTML = html;
  return node;
}

/** What a concept puts on the map, in a few words, for the line under its text. */
function legend(c: Concept) {
  const parts: string[] = [];
  if (c.areas?.length && c.kind === 'People')
    parts.push(c.areas.length === 1 ? 'approximate homeland' : `${c.areas.length} approximate homelands`);
  else if (c.areas?.length) parts.push([...new Set(c.areas.map((a) => a.name))].join(', '));
  if (c.lines?.length) parts.push(c.lines.map((l) => l.name).join(', '));
  if (c.sites?.length) parts.push(`${c.sites.length} places`);
  return parts.join(' · ');
}

function swatch(c: Concept) {
  const shape = c.areas?.length ? 'area' : c.lines?.length ? 'line' : 'site';
  const s = el('span', `swatch swatch-${shape}`);
  s.style.setProperty('--c', c.color);
  s.setAttribute('aria-hidden', 'true');
  return s;
}

/** A person's portrait, round, in place of the swatch; otherwise the swatch. */
function marker(c: Concept) {
  // A people's homeland keeps its swatch even when its first picture is a portrait of one person.
  const pic = c.images?.[0]?.portrait && !c.areas?.length ? picture(c.images[0]) : null;
  if (!pic) return swatch(c);
  const a = el('span', 'avatar');
  a.style.setProperty('--c', c.color);
  a.setAttribute('aria-hidden', 'true');
  a.append(Object.assign(document.createElement('img'), { src: pic.src, alt: '', loading: 'lazy' }));
  return a;
}

function figures(c: Concept) {
  const pics = (c.images ?? []).map(picture).filter((p): p is Picture => !!p);
  if (!pics.length) return [];
  const [hero, ...more] = pics;
  const fig = el('figure', `concept-figure${hero.portrait ? ' is-portrait' : ''}`);
  fig.innerHTML =
    pictureButton(hero, 'figure-pic') +
    `<figcaption>${prose(hero.caption)}<span class="credit">${creditLine(hero)}</span></figcaption>`;
  if (!more.length) return [fig];
  const strip = el('div', 'concept-thumbs', more.map((p) => pictureButton(p, 'thumb')).join(''));
  return [fig, strip];
}

function neighbours(c: Concept) {
  return c.group ? listed(chapter).filter((o) => o.group === c.group && o.id !== c.id) : [];
}

function setChapter(next: Chapter) {
  if (next === chapter && $('chapter').childElementCount) return;
  chapter = next;
  save({ chapter: chapterKey(next) });
  renderChapters();
  renderChapter();
}

/** Opens a concept, or closes it with null, and draws it on the map. */
function select(id: string | null, fly = true) {
  open = id;
  save({ concept: id });
  const concept = id ? (concepts.get(id)?.concept ?? null) : null;
  void reader.show(concept, concept ? neighbours(concept) : [], fly);
  for (const item of $('chapter').querySelectorAll<HTMLLIElement>('.concept')) {
    const on = item.dataset.id === id;
    item.classList.toggle('is-open', on);
    item.querySelector('.concept-head')!.setAttribute('aria-expanded', String(on));
    item.querySelector<HTMLElement>('.concept-body')!.hidden = !on;
    if (on && fly) item.scrollIntoView({ block: 'start', behavior: reducedMotion() ? 'auto' : 'smooth' });
  }
}

/** Marks a minor place and flies to it, or clears the mark with null. The open concept stays open. */
function pin(id: string | null) {
  void reader.showPlace(id ? (places.get(id)?.place ?? null) : null);
  for (const row of $('chapter').querySelectorAll<HTMLElement>('.place-row')) {
    row.classList.toggle('is-active', row.dataset.id === id);
  }
}

/**
 * Follows a link to a concept or place in any chapter. Concepts go into the browser history,
 * so Back returns to the one before.
 */
function go(id: string | null, { fly = true, push = true } = {}) {
  const place = id ? places.get(id) : undefined;
  if (place) {
    if (!listedPlaces(chapter).includes(place.place)) setChapter(place.chapter);
    pin(place.place.id);
    return;
  }
  const target = id ? concepts.get(id) : undefined;
  if (id && !target) return;
  // A concept the open chapter brings back opens here; any other takes the reader to its own chapter.
  if (target && !listed(chapter).includes(target.concept)) setChapter(target.chapter);
  select(target ? id : null, fly);
  const hash = target ? `#${id}` : '';
  if (push && location.hash !== hash) history.pushState(null, '', hash || location.pathname);
}

/** The title: close whatever is open, clear the marked place, and show the whole journey again. */
$('book-title').addEventListener('click', () => {
  go(null);
  pin(null);
  reader.home();
  panel.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' });
});

function renderChapters() {
  const nav = $('chapters');
  nav.replaceChildren(el('span', 'eyebrow', 'Contents'));
  for (const c of chapters) {
    const b = el('button', 'chapter-tab', String(chapterKey(c)));
    b.type = 'button';
    b.setAttribute('aria-pressed', String(c === chapter));
    b.title = c.title;
    b.setAttribute('aria-label', c.number === undefined ? c.title : `Chapter ${c.number}: ${c.title}`);
    b.addEventListener('click', () => {
      setChapter(c);
      go(null);
      if (c.view) reader.frame(c.view);
    });
    nav.append(b);
  }
}

/** Text with its [[links]] turned back into plain words, for places where a link can't go (inside a button). */
function plain(text: string) {
  return text.replace(/\[\[([a-z0-9-]+)(?:\|([^\]]+))?\]\]/g, (_, id: string, words?: string) =>
    words ?? concepts.get(id)?.concept.title ?? places.get(id)?.place.name ?? id,
  );
}

function linkList(label: string, items: Concept[]) {
  const p = el('p', 'concept-links', `${label} `);
  p.insertAdjacentHTML('beforeend', items.map((c) => prose(`[[${c.id}]]`)).join(' · '));
  return p;
}

function renderChapter() {
  const section = $('chapter');
  const head = el('header', 'chapter-head');
  if (chapter.number !== undefined) head.append(el('p', 'eyebrow', `Chapter ${chapter.number}`));
  head.append(el('h2', '', prose(chapter.title)));
  if (chapter.note) head.append(el('p', 'chapter-note', prose(chapter.note)));

  const list = el('ul', 'concepts');
  const shownHere = listed(chapter);
  for (const c of shownHere) {
    const item = el('li', 'concept');
    item.dataset.id = c.id;
    item.style.setProperty('--c', c.color);

    const button = el('button', 'concept-head');
    button.type = 'button';
    button.setAttribute('aria-controls', `body-${c.id}`);
    const title = el('span', 'concept-title', prose(c.title));
    if (c.aka) title.append(el('span', 'concept-aka', prose(c.aka)));
    button.append(marker(c), title, el('span', 'concept-kind', c.kind));
    button.addEventListener('click', () => go(open === c.id ? null : c.id));

    const body = el('div', 'concept-body');
    body.id = `body-${c.id}`;
    body.hidden = true;
    body.append(...figures(c));
    for (const p of c.body) body.append(el('p', '', prose(p)));
    const home = concepts.get(c.id)!.chapter;
    if (home !== chapter) {
      const where = home.number === undefined ? `the ${home.title}` : `chapter ${home.number}`;
      body.append(el('p', 'concept-legend', `First named in ${prose(where)}.`));
    }
    const shown = legend(c);
    if (shown) body.append(el('p', 'concept-legend', `On the map: ${prose(shown)}`));
    const from = backlinks.get(c.id);
    if (from?.length) body.append(linkList('Linked from:', from));
    if (c.sources?.length) {
      const src = el('p', 'concept-sources', 'Further reading: ');
      c.sources.forEach((s, i) => {
        const a = el('a', '', prose(s.label));
        a.href = s.url;
        a.target = '_blank';
        a.rel = 'noopener';
        src.append(...(i ? [document.createTextNode(' · '), a] : [a]));
      });
      body.append(src);
    }

    item.append(button, body);
    list.append(item);
  }
  section.replaceChildren(head, list);
  const placesHere = listedPlaces(chapter);
  if (!shownHere.length && !placesHere.length && !chapter.quotes?.length) {
    section.append(el('p', 'chapter-empty', 'Nothing from this chapter yet. Name things as you read and they will appear here.'));
  }

  if (placesHere.length) {
    const block = el('section', 'places');
    block.append(el('h3', 'eyebrow', 'Places'));
    const rows = el('ul', 'place-list');
    for (const p of placesHere) {
      const row = el('li');
      const b = el('button', 'place-row');
      b.type = 'button';
      b.dataset.id = p.id;
      b.append(el('span', 'place-pin'), el('span', 'place-name', prose(p.name)));
      const pic = picture(p.image);
      if (pic) b.append(Object.assign(document.createElement('img'), { className: 'place-thumb', src: pic.src, alt: '', loading: 'lazy' }));
      // The list shows the note as plain text; its links work in the map popup.
      if (p.note) b.append(el('span', 'place-note', prose(plain(p.note))));
      b.addEventListener('click', () => go(p.id));
      row.append(b);
      rows.append(row);
    }
    block.append(rows);
    section.append(block);
  }

  if (chapter.quotes?.length) {
    const block = el('section', 'quotes');
    block.append(el('h3', 'eyebrow', 'Quotes'));
    for (const q of chapter.quotes) {
      const fig = el('figure', 'quote');
      fig.append(el('blockquote', '', `<p>${prose(q.text)}</p>`));
      const parts = [
        ...(q.by ? [`— ${prose(q.by)}`] : []),
        q.page ? `p. ${prose(q.page)}` : chapterName(chapter),
        ...(q.about ? [`on ${prose(`[[${q.about}]]`)}`] : []),
      ];
      fig.append(el('figcaption', '', parts.join(' · ')));
      block.append(fig);
    }
    section.append(block);
  }
}

/** Links inside text and popups open concepts and places in place, rather than jumping the page. */
document.addEventListener('click', (e) => {
  const a = (e.target as Element).closest<HTMLAnchorElement>('a.xref');
  if (!a) return;
  e.preventDefault();
  go(a.getAttribute('href')!.slice(1));
});
window.addEventListener('popstate', () => go(location.hash.slice(1) || null, { push: false }));

renderChapters();
renderChapter();

void (book.route ? fetch(book.route) : Promise.reject())
  .then((r) => (r.ok ? (r.json() as Promise<FeatureCollection>) : null))
  .catch(() => null)
  .then(async (route) => {
    if (route) await reader.setRoute(route);
    if (!saved.view) {
      if (chapter.view) reader.frame(chapter.view, false);
      else reader.home(false);
    }
    // A link with #concept wins; otherwise reopen what was open, keeping the restored view.
    const linked = location.hash.slice(1);
    if (linked && (concepts.has(linked) || places.has(linked))) go(linked, { push: false });
    else go(saved.concept ?? null, { fly: !saved.view, push: false });
  });
