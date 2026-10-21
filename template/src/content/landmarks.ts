import type { Landmark } from './types';

/**
 * Always on the map, so there is something to steer by at any zoom. A journey's start and end get
 * `end: true` (labelled at every zoom); other landmarks appear from zoom 4.5.
 */
export const landmarks: Landmark[] = [];
