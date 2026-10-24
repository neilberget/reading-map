export type LonLat = [number, number];

/**
 * A picture. Wikimedia files are fetched by `npm run images`, which saves them in public/images/ with
 * their credit and licence (src/content/images.json). The reader's own photos go in public/images/own/.
 * `npm run images` reads the source text, so write each field as a string literal, not a variable.
 */
export interface Pic {
  /**
   * The Wikimedia file name, without "File:"; with `own`, a file name in public/images/own/; with `url`,
   * a short name of your choosing to file it under.
   */
  file: string;
  /** What it shows, with a date: "Sir George Simpson, about 1857". Artworks: “Title” by Artist, year. */
  caption: string;
  /** A file on English Wikipedia rather than Commons (the odd non-free upload). */
  wiki?: 'en';
  /** The reader's own photo. */
  own?: boolean;
  /** A head-and-shoulders portrait: also shown round beside the name in the chapter list. */
  portrait?: boolean;
  /** Who took it: overrides Wikimedia's credit when its metadata is unusable, and names whoever took an `own` photo. Required with `url`. */
  credit?: string;
  /**
   * A photo from elsewhere on the web, for a map kept private: the direct image address. `npm run images`
   * saves a copy in public/images/web/. Give `page` and `credit` with it. A path under public/ instead
   * (e.g. "images/web/patuanak-1982.jpg") uses a copy already saved there, such as a crop.
   */
  url?: string;
  /** With `url`: the page the photo appears on, linked from its credit. */
  page?: string;
  /**
   * With `url` or `own`: the licence, when it lets anyone see the picture ('Public domain', 'CC BY 4.0').
   * Wikimedia pictures get theirs from `npm run images`. A library that puts its books online shows a
   * picture without a free licence only to the readers it lets in.
   */
  license?: string;
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

/** A passage the reader wants to keep, word for word. */
export interface Quote {
  text: string;
  /** Page number, if given. */
  page?: string;
  /** Who said it, when it isn't the author. */
  by?: string;
  /** The concept it bears on, linked from its caption. */
  about?: string;
}

export interface Chapter {
  /** Left out for an introduction, prologue or epilogue, which go by their title alone. */
  number?: number;
  /** As the book prints it: "Île-à-la-Crosse", or "Introduction". */
  title: string;
  /** One line on what the chapter covers. */
  note?: string;
  /**
   * Where the chapter happens, as [south-west, north-east] corners: opening the chapter frames it.
   * Left out (an introduction, a chapter that ranges widely), the map stays where it is.
   */
  view?: [LonLat, LonLat];
  concepts: Concept[];
  /**
   * Ids of concepts or places from earlier chapters that come up again here. They are listed after
   * this chapter's own and open here, without leaving the chapter; each stays in its first chapter.
   */
  again?: string[];
  places?: Place[];
  quotes?: Quote[];
}

/**
 * A historical map that can be laid over the land and water from the old-maps button: either web tiles
 * already georeferenced, or an image in public/oldmaps/ warped to web mercator by `npm run oldmap`
 * (`scripts/oldmap.mjs` explains the control points).
 */
export interface OldMap {
  id: string;
  /** In the menu: "Arrowsmith, 1857". */
  name: string;
  /** One line on what it shows and why it's worth a look. */
  note?: string;
  /** A present-day map (a topographic one, say) rather than a historical one: listed first, under Today. */
  today?: boolean;
  /** Laid over the land from the first visit, until the reader picks another map or None. One at most. */
  default?: boolean;
  /** Maker and holder: "John Arrowsmith; David Rumsey Map Collection". */
  credit: string;
  /** The map's own page, linked from the menu. */
  page?: string;
  /** An XYZ tile template for a map someone has already georeferenced; a WMS works too, with {bbox-epsg-3857}. */
  tiles?: string;
  /** Or a warped image's path under public/, e.g. "oldmaps/arrowsmith-1857.jpg". */
  image?: string;
  /** [west, south, east, north]: the image's corners, or where the tiles exist. */
  bounds?: [number, number, number, number];
  maxzoom?: number;
  /** Tiles that only exist close in (a server that returns nothing further out): hidden below this zoom. */
  minzoom?: number;
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
