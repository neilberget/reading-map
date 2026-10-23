import { chapter01 } from './chapter-01';
import manifest from './images.json';
import type { Chapter, Concept, Pic, Place } from './types';

export const chapters: Chapter[] = [chapter01];

/** Every concept by id, across chapters, for [[links]] between them. Ids must be unique. */
export const concepts = new Map<string, { concept: Concept; chapter: Chapter }>();
for (const chapter of chapters) {
  for (const concept of chapter.concepts) {
    if (import.meta.env.DEV && concepts.has(concept.id)) console.warn(`Two concepts share the id "${concept.id}"`);
    concepts.set(concept.id, { concept, chapter });
  }
}

/** What a chapter lists: its own concepts, then those it brings back from earlier chapters. */
export function listed(chapter: Chapter): Concept[] {
  const again = (chapter.again ?? []).flatMap((id) => {
    const found = concepts.get(id)?.concept;
    if (import.meta.env.DEV && !found && !places.has(id)) console.warn(`${chapter.title} brings back unknown "${id}"`);
    return found ? [found] : [];
  });
  return [...chapter.concepts, ...again];
}

/** The minor places a chapter lists: its own, then those it brings back. */
export function listedPlaces(chapter: Chapter): Place[] {
  const again = (chapter.again ?? []).flatMap((id) => places.get(id)?.place ?? []);
  return [...(chapter.places ?? []), ...again];
}

/** Minor places by id. They share the id space with concepts, so [[id]] can point at either. */
export const places = new Map<string, { place: Place; chapter: Chapter }>();
for (const chapter of chapters) {
  for (const place of chapter.places ?? []) {
    if (import.meta.env.DEV && (concepts.has(place.id) || places.has(place.id))) console.warn(`Id "${place.id}" is taken`);
    places.set(place.id, { place, chapter });
  }
}

const LINK = /\[\[([a-z0-9-]+)(?:\|([^\]]+))?\]\]/g;

/** The ids a piece of text links to. */
export function linksIn(text: string): string[] {
  return [...text.matchAll(LINK)].map((m) => m[1]);
}

/** For each concept, the concepts whose text links to it. */
export const backlinks = new Map<string, Concept[]>();
for (const { concept } of concepts.values()) {
  const texts = [...concept.body, ...(concept.sites ?? []).map((s) => s.note ?? '')];
  for (const id of new Set(texts.flatMap(linksIn))) {
    if (id === concept.id) continue;
    if (import.meta.env.DEV && !concepts.has(id) && !places.has(id)) console.warn(`${concept.id} links to unknown "${id}"`);
    backlinks.set(id, [...(backlinks.get(id) ?? []), concept]);
  }
}

/**
 * Text to HTML: escapes it, turns *word* into italics, a line break into a break (for verse), and
 * [[id]] or [[id|words]] into a link that opens that concept.
 */
export function prose(text: string): string {
  const safe = text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
  return safe
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>')
    .replace(LINK, (whole, id: string, words?: string) => {
      const target = concepts.get(id)?.concept;
      if (target) return `<a class="xref" href="#${id}" style="--c: ${target.color}">${words ?? target.title}</a>`;
      const place = places.get(id)?.place;
      if (place) return `<a class="xref xref-place" href="#${id}">${words ?? place.name}</a>`;
      return words ?? whole;
    });
}

/**
 * A file in public/, at the address the book is served from: the library serves each book under its own
 * path (/the-lonely-land/), a preview build from /. Takes "oldmaps/x.webp" or "/data/route.geojson".
 */
export function asset(path: string): string {
  return import.meta.env.BASE_URL + path.replace(/^\//, '');
}

/** A picture ready to show: the file on disk plus what it is and whose it is. */
export interface Picture {
  file: string;
  src: string;
  width?: number;
  height?: number;
  caption: string;
  credit: string;
  license: string;
  page?: string;
  portrait: boolean;
}

type Fetched = { src: string; width?: number; height?: number; credit: string; license: string; page?: string };

/** Licences that let anyone see a picture. */
const FREE = /^(Public domain|No restrictions|CC0|CC BY)/;

/**
 * Whether this reader sees the pictures without a free licence. Here, always. On the website (a build with
 * VITE_ONLINE, made by the library's `npm run deploy`) only when signed in with an account Neil has flagged:
 * `checkAccess` asks before the map is drawn, and those pictures come from /private/, which checks again.
 */
export const access = { private: !import.meta.env.VITE_ONLINE };

export async function checkAccess(): Promise<void> {
  if (!import.meta.env.VITE_ONLINE) return;
  try {
    const me = (await (await fetch('/api/me')).json()) as { private?: boolean };
    access.private = me.private === true;
  } catch {
    // Can't tell: the free pictures still show.
  }
}

/** Resolves a Pic against images.json, or null if `npm run images` hasn't fetched it yet or this reader can't see it. */
export function picture(p: Pic | undefined): Picture | null {
  if (!p) return null;
  const got: Fetched | undefined = p.own
    ? { src: `images/own/${p.file}`, credit: 'Neil', license: p.license ?? 'Own photo' }
    : (manifest as Record<string, Fetched>)[p.file];
  if (!got) {
    if (import.meta.env.DEV) console.warn(`Picture "${p.file}" isn't fetched yet: run npm run images`);
    return null;
  }
  const free = FREE.test(got.license);
  if (!free && !access.private) return null;
  const src = free || !import.meta.env.VITE_ONLINE ? asset(got.src) : `/private${import.meta.env.BASE_URL}${got.src}`;
  return { ...got, src, file: p.file, caption: p.caption, portrait: !!p.portrait, credit: p.credit ?? got.credit };
}
