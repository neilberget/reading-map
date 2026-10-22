import type { LonLat } from './content/types';

/** The book itself. Everything else in src/ outside content/ is the same for every book. */
export const book = {
  title: '__TITLE__',
  author: '__AUTHOR__',
  year: 0,
  /** One line under the byline: where the book goes. */
  tagline: '__TAGLINE__',
  /** The opening view, framing the book's setting ([west, south], [east, north]). The ⛶ button comes back here. */
  home: [
    [-110, 45],
    [-90, 55],
  ] as [LonLat, LonLat],
  /**
   * The journey, if the book has one: a GeoJSON file in public/ with one LineString and named waypoint
   * Points. Drawn in robin orange at every zoom. null for a book without a single route.
   */
  route: null as string | null,
  /** The scale bar's units: the book's own, so its distances read straight off the map. */
  units: 'metric' as 'imperial' | 'metric',
};
