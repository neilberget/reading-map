export type LonLat = [number, number];

/**
 * A picture. Wikimedia files are fetched by `npm run images`, which saves them in public/images/ with
 * their credit and licence (src/content/images.json). Neil's own photos go in public/images/own/.
 */
export interface Pic {
  /** The Wikimedia file name, without "File:"; or, with `own`, a file name in public/images/own/. */
  file: string;
  /** What it shows, with a date: "Sir George Simpson, about 1857". Artworks: “Title” by Artist, year. */
  caption: string;
  /** A file on English Wikipedia rather than Commons (the odd non-free upload). */
  wiki?: 'en';
  /** Neil's own photo. */
  own?: boolean;
  /** A head-and-shoulders portrait: also shown round beside the name in the chapter list. */
  portrait?: boolean;
  /** Overrides the credit from Wikimedia when its metadata is unusable. */
  credit?: string;
}

/** A marker drawn for a concept: a mission, a post, a portage. */
export interface Site {
  name: string;
  at: LonLat;
  /** Shown beside the name, e.g. "1846" or "c. 1850". */
  year?: string;
  /** One or two sentences, shown when the marker is clicked. [[id]] links work here too. */
  note?: string;
  icon?: Icon;
  image?: Pic;
}

/**
 * A rough territory. The outline is a handful of points and is smoothed when drawn, so it reads as
 * the generalized range it is rather than a surveyed boundary.
 */
export interface Area {
  name: string;
  /** A second line under the name on the map, e.g. the people's own name. */
  sub?: string;
  outline: LonLat[];
  /** Where to put the name; the middle of the outline when left out. */
  label?: LonLat;
}

/**
 * A step in a line's path. Plain points are hand-placed and smoothed when drawn. { traced } is a run
 * of real geometry drawn as is. 'route' stands for the book's whole traced route, run in whichever
 * direction meets the points on either side of it.
 */
export type PathStep = LonLat | 'route' | { traced: LonLat[] };

export interface Line {
  name: string;
  path: PathStep[];
}

export type Icon = 'cross' | 'square' | 'diamond' | 'triangle' | 'ring' | 'dot';

export interface Concept {
  id: string;
  title: string;
  /** Another name for it, shown under the title, e.g. "Denésųłiné". */
  aka?: string;
  /** A short label for the kind of thing, e.g. "People", "Church", "Fur trade". */
  kind: string;
  color: string;
  /** Paragraphs of context. Plain text; *asterisks* mark italics; [[id]] or [[id|words]] links to another concept. */
  body: string[];
  areas?: Area[];
  sites?: Site[];
  lines?: Line[];
  /** Concepts in the same group show each other's outlines faintly, e.g. neighbouring peoples. */
  group?: string;
  /** Where to look up more. */
  sources?: { label: string; url: string }[];
  /** How close the map may zoom when fitting this concept's overlay. Defaults to 7.5; raise it for a single town. */
  zoom?: number;
  /** Pictures, the first shown large when the concept is open. */
  images?: Pic[];
}

/**
 * A minor place mentioned in the text: no write-up, just somewhere to find on the map. Listed under
 * the chapter's concepts; clicking one flies there and marks it.
 */
export interface Place {
  id: string;
  name: string;
  at: LonLat;
  /** A line on what it is, shown in the list and the popup. */
  note?: string;
  /** How close to fly in. Defaults to 11, about a bay's width. */
  zoom?: number;
  image?: Pic;
}

/** A passage Neil wants to keep, word for word. */
export interface Quote {
  text: string;
  /** Page number, if given. */
  page?: string;
  /** Who said it, when it isn't Olson. */
  by?: string;
  /** The concept it bears on, linked from its caption. */
  about?: string;
}

export interface Chapter {
  number: number;
  title: string;
  /** One line on what the chapter covers. */
  note?: string;
  concepts: Concept[];
  places?: Place[];
  quotes?: Quote[];
}

/** A place always marked on the map, so the reader can find their bearings at any zoom. */
export interface Landmark {
  name: string;
  at: LonLat;
  note?: string;
  icon?: Icon;
  /** The trip's two ends: labelled at every zoom. Others appear from zoom 4.5. */
  end?: boolean;
  image?: Pic;
}
