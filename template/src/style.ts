import type { Feature, FeatureCollection } from 'geojson';
import type { ExpressionSpecification, GeoJSONSourceSpecification, StyleSpecification } from 'maplibre-gl';

/** Flyway's palette (../geo-bird): robin's-egg water, eggshell land, ink lines. */
export const ink = '#15282e';
export const inkSoft = '#4a636b';
export const shell = '#fffcf5';
export const water = '#a9dad3';
export const waterDeep = '#6fb0a7';
export const waterText = '#2c6a62';
export const robin = '#e5532a';
export const robinDeep = '#ad3512';

const OFM = 'https://tiles.openfreemap.org';

/** Many northern places carry their Cree or Dene name in syllabics first; the map labels in Latin script. */
const name: ExpressionSpecification = ['coalesce', ['get', 'name:latin'], ['get', 'name_en'], ['get', 'name']];

const lines = ['match', ['geometry-type'], ['LineString', 'MultiLineString'], true, false] as ExpressionSpecification;
const polygons = ['match', ['geometry-type'], ['Polygon', 'MultiPolygon'], true, false] as ExpressionSpecification;
const points = ['match', ['geometry-type'], ['Point', 'MultiPoint'], true, false] as ExpressionSpecification;

const empty = (): GeoJSONSourceSpecification => ({ type: 'geojson', data: { type: 'FeatureCollection', features: [] } });

/** Lines of latitude and longitude: every 5° when zoomed out, every degree from zoom 5. */
function graticule(): FeatureCollection {
  const features: Feature[] = [];
  for (let lon = -180; lon < 180; lon += 1) {
    const coords: [number, number][] = [];
    for (let lat = 30; lat <= 82; lat += 1) coords.push([lon, lat]);
    features.push({ type: 'Feature', properties: { major: lon % 5 === 0 }, geometry: { type: 'LineString', coordinates: coords } });
  }
  for (let lat = 30; lat <= 82; lat += 1) {
    const coords: [number, number][] = [];
    for (let lon = -170; lon <= -40; lon += 1) coords.push([lon, lat]);
    features.push({ type: 'Feature', properties: { major: lat % 5 === 0 }, geometry: { type: 'LineString', coordinates: coords } });
  }
  return { type: 'FeatureCollection', features };
}

export function mapStyle(): StyleSpecification {
  return {
    version: 8,
    projection: { type: 'globe' },
    glyphs: `${OFM}/fonts/{fontstack}/{range}.pbf`,
    sources: {
      ofm: { type: 'vector', url: `${OFM}/planet` },
      graticule: { type: 'geojson', data: graticule() },
      satellite: {
        type: 'raster',
        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
        tileSize: 256,
        maxzoom: 18,
        attribution: 'Imagery © Esri, Maxar, Earthstar Geographics, and the GIS User Community',
      },
      // Filled in by ReadingMap: the selected concept, its neighbours, and the canoe route.
      context: empty(),
      focus: empty(),
      route: empty(),
      landmarks: empty(),
      places: empty(),
    },
    layers: [
      { id: 'land', type: 'background', paint: { 'background-color': shell } },
      {
        // Off until the satellite button turns it on; then the drawn water and land below are hidden.
        id: 'satellite',
        type: 'raster',
        source: 'satellite',
        layout: { visibility: 'none' },
        paint: { 'raster-saturation': -0.15, 'raster-fade-duration': 150 },
      },
      {
        id: 'wetland',
        type: 'fill',
        source: 'ofm',
        'source-layer': 'landcover',
        minzoom: 6,
        filter: ['all', polygons, ['==', ['get', 'class'], 'wetland']],
        paint: { 'fill-color': '#e7eedf', 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 6, 0, 8, 0.8] },
      },
      {
        id: 'graticule',
        type: 'line',
        source: 'graticule',
        filter: ['any', ['get', 'major'], ['>=', ['zoom'], 5]],
        paint: {
          'line-color': waterDeep,
          'line-width': 0.6,
          'line-opacity': ['case', ['get', 'major'], 0.5, 0.28],
        },
      },
      {
        id: 'river',
        type: 'line',
        source: 'ofm',
        'source-layer': 'waterway',
        filter: ['all', lines, ['==', ['get', 'class'], 'river'], ['!=', ['get', 'brunnel'], 'tunnel']],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': waterDeep,
          'line-width': ['interpolate', ['exponential', 1.4], ['zoom'], 3, 0.5, 8, 1.3, 13, 3.5],
        },
      },
      {
        id: 'stream',
        type: 'line',
        source: 'ofm',
        'source-layer': 'waterway',
        minzoom: 9,
        filter: ['all', lines, ['!=', ['get', 'class'], 'river'], ['!=', ['get', 'brunnel'], 'tunnel']],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': waterDeep,
          'line-width': ['interpolate', ['linear'], ['zoom'], 9, 0.4, 14, 1.4],
          'line-opacity': ['case', ['==', ['get', 'intermittent'], 1], 0.5, 0.9],
        },
      },
      {
        id: 'water',
        type: 'fill',
        source: 'ofm',
        'source-layer': 'water',
        filter: ['all', polygons, ['!=', ['get', 'brunnel'], 'tunnel']],
        paint: { 'fill-color': water },
      },
      {
        id: 'shore',
        type: 'line',
        source: 'ofm',
        'source-layer': 'water',
        filter: ['all', polygons, ['!=', ['get', 'brunnel'], 'tunnel']],
        paint: {
          'line-color': ink,
          'line-width': ['interpolate', ['linear'], ['zoom'], 3, 0.3, 8, 0.6, 12, 0.9],
          'line-opacity': ['interpolate', ['linear'], ['zoom'], 3, 0.35, 8, 0.6],
        },
      },
      {
        id: 'province',
        type: 'line',
        source: 'ofm',
        'source-layer': 'boundary',
        filter: ['all', ['==', ['get', 'admin_level'], 4], ['!=', ['get', 'maritime'], 1]],
        paint: { 'line-color': ink, 'line-opacity': 0.22, 'line-width': 0.8 },
      },
      {
        id: 'country',
        type: 'line',
        source: 'ofm',
        'source-layer': 'boundary',
        filter: ['all', ['==', ['get', 'admin_level'], 2], ['!=', ['get', 'maritime'], 1]],
        paint: { 'line-color': ink, 'line-opacity': 0.55, 'line-width': 1, 'line-dasharray': [5, 3] },
      },
      {
        id: 'road',
        type: 'line',
        source: 'ofm',
        'source-layer': 'transportation',
        minzoom: 5,
        filter: [
          'all',
          lines,
          [
            'match',
            ['get', 'class'],
            ['motorway', 'trunk', 'primary', 'secondary', 'tertiary'],
            true,
            'minor',
            ['>=', ['zoom'], 10],
            false,
          ],
        ],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#b9a68a',
          'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.4, 10, 1, 14, 2],
          'line-opacity': 0.55,
        },
      },

      // The selected concept sits on the land and water but under every label.
      {
        id: 'context-area-line',
        type: 'line',
        source: 'context',
        filter: ['==', ['get', 'role'], 'area'],
        paint: { 'line-color': ['get', 'color'], 'line-width': 1.2, 'line-opacity': 0.55, 'line-dasharray': [3, 3] },
      },
      {
        id: 'focus-area-fill',
        type: 'fill',
        source: 'focus',
        filter: ['==', ['get', 'role'], 'area'],
        paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.16 },
      },
      {
        id: 'focus-area-glow',
        type: 'line',
        source: 'focus',
        filter: ['==', ['get', 'role'], 'area'],
        paint: { 'line-color': ['get', 'color'], 'line-width': 12, 'line-blur': 10, 'line-opacity': 0.3 },
      },
      {
        id: 'focus-area-line',
        type: 'line',
        source: 'focus',
        filter: ['==', ['get', 'role'], 'area'],
        paint: { 'line-color': ['get', 'color'], 'line-width': 1.6, 'line-dasharray': [4, 2] },
      },
      {
        id: 'focus-line-casing',
        type: 'line',
        source: 'focus',
        filter: ['==', ['get', 'role'], 'line'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': shell, 'line-width': 6, 'line-opacity': 0.85 },
      },
      {
        id: 'focus-line',
        type: 'line',
        source: 'focus',
        filter: ['==', ['get', 'role'], 'line'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': ['get', 'color'], 'line-width': 2.6, 'line-dasharray': [2, 1.4] },
      },
      {
        id: 'route-casing',
        type: 'line',
        source: 'route',
        filter: lines,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': shell, 'line-width': ['interpolate', ['linear'], ['zoom'], 4, 3.5, 10, 6.5] },
      },
      {
        id: 'route-line',
        type: 'line',
        source: 'route',
        filter: lines,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': robin, 'line-width': ['interpolate', ['linear'], ['zoom'], 4, 1.8, 10, 3.2] },
      },

      // Labels, lowest priority first.
      {
        id: 'river-label',
        type: 'symbol',
        source: 'ofm',
        'source-layer': 'waterway',
        minzoom: 6,
        filter: ['all', lines, ['==', ['get', 'class'], 'river']],
        layout: {
          'symbol-placement': 'line',
          'text-field': name,
          'text-font': ['Noto Sans Italic'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 6, 10.5, 12, 13],
          'text-letter-spacing': 0.04,
          'text-max-angle': 50,
          'symbol-spacing': 300,
        },
        paint: { 'text-color': waterText, 'text-halo-color': shell, 'text-halo-width': 1.4 },
      },
      {
        // Most lakes are named along a line through their long axis rather than at a point.
        id: 'lake-label-line',
        type: 'symbol',
        source: 'ofm',
        'source-layer': 'water_name',
        filter: lines,
        layout: {
          'symbol-placement': 'line',
          'symbol-spacing': 500,
          'text-field': name,
          'text-font': ['Noto Sans Italic'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 3, 10, 8, 12, 12, 14],
          'text-letter-spacing': 0.08,
          'text-max-angle': 50,
        },
        paint: { 'text-color': waterText, 'text-halo-color': water, 'text-halo-width': 1 },
      },
      {
        id: 'lake-label',
        type: 'symbol',
        source: 'ofm',
        'source-layer': 'water_name',
        filter: points,
        layout: {
          'text-field': name,
          'text-font': ['Noto Sans Italic'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 3, 10, 8, 12, 12, 13],
          'text-max-width': 7,
          'text-letter-spacing': 0.04,
        },
        paint: { 'text-color': waterText, 'text-halo-color': water, 'text-halo-width': 1 },
      },
      {
        id: 'province-label',
        type: 'symbol',
        source: 'ofm',
        'source-layer': 'place',
        minzoom: 3,
        maxzoom: 7,
        filter: ['==', ['get', 'class'], 'state'],
        layout: {
          'text-field': name,
          'text-font': ['Noto Sans Regular'],
          'text-transform': 'uppercase',
          'text-letter-spacing': 0.22,
          'text-size': ['interpolate', ['linear'], ['zoom'], 3, 9.5, 6, 12],
          'text-max-width': 8,
        },
        paint: { 'text-color': inkSoft, 'text-opacity': 0.75, 'text-halo-color': shell, 'text-halo-width': 1 },
      },
      {
        id: 'place',
        type: 'symbol',
        source: 'ofm',
        'source-layer': 'place',
        filter: [
          'all',
          points,
          [
            'match',
            ['get', 'class'],
            'city',
            true,
            'town',
            ['>=', ['zoom'], 5],
            'village',
            ['>=', ['zoom'], 7],
            'hamlet',
            ['>=', ['zoom'], 9],
            false,
          ],
        ],
        layout: {
          'symbol-sort-key': ['get', 'rank'],
          'icon-image': 'dot',
          'icon-size': ['match', ['get', 'class'], 'city', 1, 'town', 0.85, 0.7],
          'text-field': name,
          'text-font': ['match', ['get', 'class'], ['city', 'town'], ['literal', ['Noto Sans Bold']], ['literal', ['Noto Sans Regular']]],
          'text-size': ['match', ['get', 'class'], 'city', 13, 'town', 12, 'village', 11.5, 10.5],
          'text-max-width': 9,
          'text-variable-anchor': ['left', 'right', 'top', 'bottom'],
          'text-radial-offset': 0.55,
        },
        paint: {
          'icon-color': ink,
          'icon-halo-color': shell,
          'icon-halo-width': 1.5,
          'text-color': ink,
          'text-halo-color': shell,
          'text-halo-width': 1.5,
        },
      },
      {
        id: 'country-label',
        type: 'symbol',
        source: 'ofm',
        'source-layer': 'place',
        maxzoom: 5,
        filter: ['==', ['get', 'class'], 'country'],
        layout: {
          'text-field': name,
          'text-font': ['Noto Sans Bold'],
          'text-transform': 'uppercase',
          'text-letter-spacing': 0.3,
          'text-size': 12,
        },
        paint: { 'text-color': inkSoft, 'text-halo-color': shell, 'text-halo-width': 1.2 },
      },

      // Overlay labels and markers go over the basemap's own.
      {
        id: 'context-area-label',
        type: 'symbol',
        source: 'context',
        filter: ['==', ['get', 'role'], 'area-label'],
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Noto Sans Bold'],
          'text-transform': 'uppercase',
          'text-letter-spacing': 0.18,
          'text-size': 11,
          'text-max-width': 8,
        },
        paint: { 'text-color': ['get', 'color'], 'text-opacity': 0.7, 'text-halo-color': shell, 'text-halo-width': 1.5 },
      },
      {
        id: 'focus-area-label',
        type: 'symbol',
        source: 'focus',
        filter: ['==', ['get', 'role'], 'area-label'],
        layout: {
          'text-field': [
            'format',
            ['upcase', ['get', 'name']],
            { 'font-scale': 1 },
            ['case', ['has', 'sub'], ['concat', '\n', ['get', 'sub']], ''],
            { 'font-scale': 0.82, 'text-font': ['literal', ['Noto Sans Italic']] },
          ],
          'text-font': ['Noto Sans Bold'],
          'text-letter-spacing': 0.16,
          'text-size': ['interpolate', ['linear'], ['zoom'], 3, 12, 7, 15],
          'text-max-width': 10,
          'text-allow-overlap': true,
        },
        paint: { 'text-color': ['get', 'color'], 'text-halo-color': shell, 'text-halo-width': 2 },
      },
      {
        id: 'focus-line-label',
        type: 'symbol',
        source: 'focus',
        filter: ['==', ['get', 'role'], 'line'],
        layout: {
          'symbol-placement': 'line',
          'symbol-spacing': 360,
          'text-field': ['get', 'name'],
          'text-font': ['Noto Sans Bold'],
          'text-size': 11,
          'text-letter-spacing': 0.08,
          'text-offset': [0, -0.9],
        },
        paint: { 'text-color': ['get', 'color'], 'text-halo-color': shell, 'text-halo-width': 1.6 },
      },
      {
        id: 'route-stop',
        type: 'symbol',
        source: 'route',
        minzoom: 7,
        filter: points,
        layout: {
          'icon-image': ['get', 'icon'],
          'icon-size': 0.85,
          'text-field': ['get', 'name'],
          'text-font': ['case', ['==', ['get', 'kind'], 'lake'], ['literal', ['Noto Sans Italic']], ['literal', ['Noto Sans Bold']]],
          'text-size': 11,
          'text-variable-anchor': ['left', 'right', 'top', 'bottom'],
          'text-radial-offset': 0.75,
          'text-max-width': 9,
          'text-optional': true,
        },
        paint: {
          'icon-color': robin,
          'icon-halo-color': shell,
          'icon-halo-width': 1.5,
          'text-color': robinDeep,
          'text-halo-color': shell,
          'text-halo-width': 1.6,
        },
      },
      {
        id: 'focus-site',
        type: 'symbol',
        source: 'focus',
        filter: ['==', ['get', 'role'], 'site'],
        layout: {
          'icon-image': ['get', 'icon'],
          'icon-allow-overlap': true,
          'icon-size': 1.05,
          'text-field': [
            'format',
            ['get', 'name'],
            {},
            ['case', ['has', 'year'], ['concat', '  ', ['get', 'year']], ''],
            { 'font-scale': 0.88, 'text-font': ['literal', ['Noto Sans Regular']] },
          ],
          'text-font': ['Noto Sans Bold'],
          'text-size': 11.5,
          'text-variable-anchor': ['left', 'right', 'top', 'bottom'],
          'text-radial-offset': 0.85,
          'text-max-width': 12,
          'text-optional': true,
        },
        paint: {
          'icon-color': ['get', 'color'],
          'icon-halo-color': shell,
          'icon-halo-width': 1.8,
          'text-color': ['get', 'color'],
          'text-halo-color': shell,
          'text-halo-width': 1.8,
        },
      },
      {
        id: 'place-pin',
        type: 'symbol',
        source: 'places',
        minzoom: 8,
        layout: {
          'icon-image': 'ring',
          'icon-size': 0.9,
          'text-field': ['get', 'name'],
          'text-font': ['Noto Sans Italic'],
          'text-size': 11,
          'text-variable-anchor': ['left', 'right', 'top', 'bottom'],
          'text-radial-offset': 0.75,
          'text-optional': true,
        },
        paint: {
          'icon-color': inkSoft,
          'icon-halo-color': shell,
          'icon-halo-width': 1.5,
          'text-color': inkSoft,
          'text-halo-color': shell,
          'text-halo-width': 1.5,
        },
      },
      {
        // Landmarks along the route, from the first zoom where they don't crowd each other.
        id: 'landmark',
        type: 'symbol',
        source: 'landmarks',
        minzoom: 4.5,
        filter: ['!', ['get', 'end']],
        layout: {
          'icon-image': ['get', 'icon'],
          'icon-size': 0.95,
          'icon-allow-overlap': true,
          'text-field': ['get', 'name'],
          'text-font': ['Noto Sans Bold'],
          'text-size': 11.5,
          'text-variable-anchor': ['left', 'right', 'top', 'bottom'],
          'text-radial-offset': 0.8,
          'text-max-width': 9,
          'text-optional': true,
        },
        paint: {
          'icon-color': robin,
          'icon-halo-color': shell,
          'icon-halo-width': 1.6,
          'text-color': robinDeep,
          'text-halo-color': shell,
          'text-halo-width': 1.8,
        },
      },
      {
        // The trip's two ends, labelled at every zoom.
        id: 'landmark-end',
        type: 'symbol',
        source: 'landmarks',
        filter: ['get', 'end'],
        layout: {
          'icon-image': ['get', 'icon'],
          'icon-size': ['interpolate', ['linear'], ['zoom'], 2, 0.9, 6, 1.2],
          'icon-allow-overlap': true,
          'text-allow-overlap': true,
          'text-field': ['get', 'name'],
          'text-font': ['Noto Sans Bold'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 2, 11, 6, 13.5],
          'text-variable-anchor': ['left', 'right', 'top', 'bottom'],
          'text-radial-offset': 0.9,
        },
        paint: {
          'icon-color': robin,
          'icon-halo-color': shell,
          'icon-halo-width': 1.8,
          'text-color': robinDeep,
          'text-halo-color': shell,
          'text-halo-width': 2,
        },
      },
      {
        // The minor place last chosen from the list, at any zoom.
        id: 'place-selected',
        type: 'symbol',
        source: 'places',
        filter: ['==', ['get', 'id'], ''],
        layout: {
          'icon-image': 'ring',
          'icon-size': 1.6,
          'icon-allow-overlap': true,
          'text-allow-overlap': true,
          'text-field': ['get', 'name'],
          'text-font': ['Noto Sans Bold'],
          'text-size': 13,
          'text-variable-anchor': ['left', 'right', 'top', 'bottom'],
          'text-radial-offset': 1.1,
        },
        paint: {
          'icon-color': ink,
          'icon-halo-color': shell,
          'icon-halo-width': 2,
          'text-color': ink,
          'text-halo-color': shell,
          'text-halo-width': 2,
        },
      },
    ],
  };
}
