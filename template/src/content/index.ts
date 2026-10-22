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

type Fetched = { src: string; width: number; height: number; credit: string; license: string; page: string };

/** Resolves a Pic against images.json, or null if `npm run images` hasn't fetched it yet. */
export function picture(p: Pic | undefined): Picture | null {
  if (!p) return null;
  if (p.own) return { file: p.file, src: `/images/own/${p.file}`, caption: p.caption, credit: p.credit ?? 'Neil', license: 'Own photo', portrait: !!p.portrait };
  const got = (manifest as Record<string, Fetched>)[p.file];
  if (!got) {
    if (import.meta.env.DEV) console.warn(`Picture "${p.file}" isn't fetched yet: run npm run images`);
    return null;
  }
  return { ...got, src: `/${got.src}`, file: p.file, caption: p.caption, portrait: !!p.portrait, credit: p.credit ?? got.credit };
}
