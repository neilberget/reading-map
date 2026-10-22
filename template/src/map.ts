import type { Feature, FeatureCollection, LineString } from 'geojson';
import { LngLatBounds, Map, Popup, ScaleControl, setWorkerUrl, type GeoJSONSource, type MapLayerMouseEvent } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
// Bundled by Vite with the shared module it imports; left to itself, MapLibre's worker loses that
// module in a production build and the map never draws.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { picture, places, prose } from './content';
import { landmarks } from './content/landmarks';
import { waypointPictures } from './content/waypoints';
import type { Concept, Icon, LonLat, OldMap, PathStep, Pic, Place } from './content/types';
import { dms, middle, ring, smooth } from './geo';
import { book } from './book';
import { creditLine, pictureButton } from './lightbox';
import { mapStyle } from './style';

setWorkerUrl(workerUrl);

export interface Padding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Icons are drawn as signed distance fields so they take any colour and a halo. */
const ICON_RATIO = 2;
const ICON_BUFFER = 6;

function box(x: number, y: number, hx: number, hy: number) {
  const dx = Math.abs(x) - hx;
  const dy = Math.abs(y) - hy;
  return Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0);
}

/** Distance from (x, y) to the edge of each shape, in CSS pixels, negative inside. */
const SHAPES: Record<Icon, (x: number, y: number) => number> = {
  dot: (x, y) => Math.hypot(x, y) - 3.2,
  ring: (x, y) => Math.abs(Math.hypot(x, y) - 4) - 1.2,
  square: (x, y) => box(x, y, 3.8, 3.8),
  diamond: (x, y) => (Math.abs(x) + Math.abs(y) - 5.2) / Math.SQRT2,
  cross: (x, y) => Math.min(box(x, y, 1.25, 6), box(x, y + 1.9, 4.3, 1.25)),
  // Pointing down, the way the water goes over a rapid.
  triangle: (x, y) => {
    const k = Math.sqrt(3);
    const r = 4.8;
    let px = Math.abs(x) - r;
    let py = y + r / k - 0.8;
    if (px + k * py > 0) [px, py] = [(px - k * py) / 2, (-k * px - py) / 2];
    px -= Math.min(Math.max(px, -2 * r), 0);
    return -Math.hypot(px, py) * Math.sign(py);
  },
};

function drawIcon(shape: Icon) {
  const half = 7 + ICON_BUFFER;
  const size = half * 2 * ICON_RATIO;
  const data = new Uint8Array(size * size * 4);
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const d = SHAPES[shape]((i + 0.5) / ICON_RATIO - half, (j + 0.5) / ICON_RATIO - half) * ICON_RATIO;
      // MapLibre reads the edge at 3/4 alpha and fades out over the buffer.
      const a = 255 - 255 * (d / (ICON_BUFFER * ICON_RATIO * 1.33) + 0.25);
      const o = (j * size + i) * 4;
      data[o] = data[o + 1] = data[o + 2] = 255;
      data[o + 3] = Math.max(0, Math.min(255, Math.round(a)));
    }
  }
  return { width: size, height: size, data };
}

const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

interface PopupText {
  name: string;
  year?: string;
  kind?: string;
  note?: string;
  /** Key of a picture in ReadingMap.pics. */
  pic?: string;
}

const point = (at: LonLat, properties: Record<string, unknown>): Feature => ({
  type: 'Feature',
  properties,
  geometry: { type: 'Point', coordinates: at },
});

export class ReadingMap {
  readonly map: Map;
  private popup = new Popup({ maxWidth: '290px', offset: 14, focusAfterOpen: false });
  private route: LonLat[] = [];
  /** Pictures for map features, by file; features carry the file name, since their properties must be plain values. */
  private pics = new globalThis.Map<string, Pic>();
  private ready: Promise<void>;
  /** Room the panel takes over the map, so fitted views land in the open part. */
  padding: Padding = { top: 24, right: 24, bottom: 24, left: 24 };

  constructor(container: HTMLElement, readout: HTMLElement, view?: { center: LonLat; zoom: number }) {
    this.map = new Map({
      container,
      style: mapStyle(),
      bounds: view ? undefined : book.home,
      center: view?.center,
      zoom: view?.zoom,
      minZoom: 1.5,
      maxZoom: 15,
      attributionControl: { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
    });
    this.map.touchZoomRotate.disableRotation();
    this.map.keyboard.disableRotation();
    this.map.addControl(new ScaleControl({ unit: book.units, maxWidth: 110 }), 'bottom-right');

    this.map.setMissingStyleImageResolver((id) => {
      if (id in SHAPES) this.map.addImage(id, drawIcon(id as Icon), { sdf: true, pixelRatio: ICON_RATIO });
    });

    this.map.on('mousemove', (e) => {
      readout.textContent = dms(e.lngLat.lng, e.lngLat.lat);
    });
    this.map.getCanvasContainer().addEventListener('mouseleave', () => (readout.textContent = ''));

    for (const layer of ['focus-site', 'route-stop', 'landmark', 'landmark-end', 'place-pin', 'place-selected']) {
      this.map.on('click', layer, (e) => this.openPopup(e));
      this.map.on('mouseenter', layer, () => (this.map.getCanvas().style.cursor = 'pointer'));
      this.map.on('mouseleave', layer, () => (this.map.getCanvas().style.cursor = ''));
    }

    this.ready = new Promise((resolve) =>
      this.map.once('load', () => {
        this.source('landmarks').setData({
          type: 'FeatureCollection',
          features: landmarks.map((l) =>
            point(l.at, {
              name: l.name,
              end: !!l.end,
              icon: l.icon ?? 'square',
              ...(l.note ? { note: l.note } : {}),
              ...this.picProp(l.image),
            }),
          ),
        });
        this.source('places').setData({
          type: 'FeatureCollection',
          features: [...places.values()].map(({ place: p }) =>
            point(p.at, { id: p.id, name: p.name, ...(p.note ? { note: p.note } : {}), ...this.picProp(p.image) }),
          ),
        });
        resolve();
      }),
    );
  }

  private openPopup(e: MapLayerMouseEvent) {
    const f = e.features?.[0];
    if (!f || f.geometry.type !== 'Point') return;
    this.popupAt(f.geometry.coordinates as LonLat, f.properties as PopupText);
  }

  private picProp(pic: Pic | undefined) {
    if (!pic) return {};
    this.pics.set(pic.file, pic);
    return { pic: pic.file };
  }

  private popupAt(at: LonLat, p: PopupText) {
    const tag = p.year ?? p.kind;
    const pic = p.pic ? picture(this.pics.get(p.pic)) : null;
    this.popup
      .setLngLat(at)
      .setHTML(
        (pic
          ? `<figure class="pop-figure">${pictureButton(pic, 'pop-pic')}<figcaption>${escape(pic.caption)} · ${creditLine(pic)}</figcaption></figure>`
          : '') +
          `<p class="pop-name">${escape(p.name)}${tag ? `<span class="pop-year">${escape(tag)}</span>` : ''}</p>` +
          (p.note ? `<p class="pop-note">${prose(p.note)}</p>` : ''),
      )
      .addTo(this.map);
  }

  private source(id: string) {
    return this.map.getSource(id) as GeoJSONSource;
  }

  async setRoute(data: FeatureCollection) {
    await this.ready;
    const line = data.features.find((f) => f.geometry.type === 'LineString');
    this.route = line ? ((line.geometry as LineString).coordinates as LonLat[]) : [];
    // Landmarks already mark some of the route's stops, and are always shown.
    const marked = new Set(landmarks.map((l) => l.name.toLowerCase()));
    const icons: Record<string, Icon> = { settlement: 'square', rapids: 'triangle', portage: 'diamond', landmark: 'ring' };
    const stops = data.features
      .filter((f) => f.geometry.type === 'Point' && !marked.has(String(f.properties?.name).toLowerCase()))
      .map((f) => ({
        ...f,
        properties: {
          ...f.properties,
          icon: icons[f.properties?.kind] ?? 'dot',
          ...this.picProp(waypointPictures[String(f.properties?.name)]),
        },
      }));
    this.source('route').setData({ type: 'FeatureCollection', features: [...(line ? [line] : []), ...stops] });
  }

  /** Smooths hand-placed points, keeps traced runs exact, and splices in the book's route turned to fit. */
  private linePath(path: PathStep[]): LonLat[] {
    const out: LonLat[] = [];
    let run: LonLat[] = [];
    const near = (a: LonLat, b: LonLat) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    path.forEach((step, i) => {
      if (Array.isArray(step)) {
        run.push(step);
        return;
      }
      let exact: LonLat[];
      if (step === 'route') {
        // Turn the route to leave from the point before it, or, when it comes first, to arrive at the point after it.
        const before = run[run.length - 1];
        const next = path[i + 1];
        const [start, end] = [this.route[0], this.route[this.route.length - 1]];
        const flip = before
          ? near(before, end) < near(before, start)
          : Array.isArray(next) && near(next, start) < near(next, end);
        exact = end && flip ? [...this.route].reverse() : this.route;
      } else {
        exact = step.traced;
      }
      if (exact.length === 0) return;
      if (run.length) out.push(...smooth([...run, exact[0]], false));
      out.push(...exact);
      run = [exact[exact.length - 1]];
    });
    if (run.length > 1) out.push(...smooth(run, false));
    return out;
  }

  private features(concept: Concept, focus: boolean): Feature[] {
    const color = concept.color;
    const features: Feature[] = [];
    for (const area of concept.areas ?? []) {
      features.push({
        type: 'Feature',
        properties: { role: 'area', color, name: area.name },
        geometry: { type: 'Polygon', coordinates: [ring(area.outline)] },
      });
      features.push(
        point(area.label ?? middle(area.outline), {
          role: 'area-label',
          color,
          name: area.name,
          ...(focus && area.sub ? { sub: area.sub } : {}),
        }),
      );
    }
    if (!focus) return features;
    for (const line of concept.lines ?? []) {
      features.push({
        type: 'Feature',
        properties: { role: 'line', color, name: line.name },
        geometry: { type: 'LineString', coordinates: this.linePath(line.path) },
      });
    }
    for (const site of concept.sites ?? []) {
      features.push(
        point(site.at, {
          role: 'site',
          color,
          name: site.name,
          icon: site.icon ?? 'dot',
          ...(site.year ? { year: site.year } : {}),
          ...(site.note ? { note: site.note } : {}),
          ...this.picProp(site.image),
        }),
      );
    }
    return features;
  }

  async show(concept: Concept | null, neighbours: Concept[] = [], fly = true) {
    await this.ready;
    this.popup.remove();
    const focus = concept ? this.features(concept, true) : [];
    this.source('focus').setData({ type: 'FeatureCollection', features: focus });
    this.source('context').setData({
      type: 'FeatureCollection',
      features: neighbours.flatMap((c) => this.features(c, false)),
    });
    if (!concept || !fly) return;

    const b = new LngLatBounds();
    for (const f of focus) {
      const g = f.geometry;
      if (g.type === 'Point') b.extend(g.coordinates as LonLat);
      else if (g.type === 'LineString') for (const c of g.coordinates) b.extend(c as LonLat);
      else if (g.type === 'Polygon') for (const c of g.coordinates[0]) b.extend(c as LonLat);
    }
    if (b.isEmpty()) return;
    this.map.fitBounds(b, { padding: this.padding, maxZoom: concept.zoom ?? 7.5, duration: reducedMotion() ? 0 : 1100 });
  }

  /** Marks one minor place, flies to it and opens its note; null clears the mark. */
  async showPlace(place: Place | null) {
    await this.ready;
    this.map.setFilter('place-selected', ['==', ['get', 'id'], place?.id ?? '']);
    if (!place) return;
    // An offset, not padding: flyTo keeps padding on the map afterwards, which skews every later fit.
    const { top, right, bottom, left } = this.padding;
    this.map.flyTo({
      center: place.at,
      zoom: place.zoom ?? 11,
      offset: [(left - right) / 2, (top - bottom) / 2],
      duration: reducedMotion() ? 0 : 1600,
    });
    this.map.once('moveend', () => this.popupAt(place.at, { ...place, ...this.picProp(place.image) }));
  }

  /** Swaps the drawn land and water for satellite imagery, keeping the route, labels and overlays. */
  async setSatellite(on: boolean) {
    await this.ready;
    this.map.setLayoutProperty('satellite', 'visibility', on ? 'visible' : 'none');
    for (const id of ['wetland', 'graticule', 'river', 'stream', 'water', 'shore']) {
      this.map.setLayoutProperty(id, 'visibility', on ? 'none' : 'visible');
    }
  }

  /**
   * Lays a historical map over the land and water, under the overlays, route and labels; null takes it
   * away. Only one at a time.
   */
  async setOldMap(old: OldMap | null, opacity: number) {
    await this.ready;
    if (this.map.getLayer('old-map')) this.map.removeLayer('old-map');
    if (this.map.getSource('old-map')) this.map.removeSource('old-map');
    if (!old) return;
    const [w, s, e, n] = old.bounds ?? [-180, -85, 180, 85];
    this.map.addSource(
      'old-map',
      old.tiles
        ? { type: 'raster', tiles: [old.tiles], tileSize: 256, bounds: old.bounds, maxzoom: old.maxzoom ?? 18, attribution: old.credit }
        : { type: 'image', url: `/${old.image}`, coordinates: [[w, n], [e, n], [e, s], [w, s]] },
    );
    const below = this.map.getStyle().layers.find((l) => l.id.startsWith('context'))?.id;
    this.map.addLayer({ id: 'old-map', type: 'raster', source: 'old-map', paint: { 'raster-opacity': opacity } }, below);
  }

  /** Shows or hides the book's journey line and its stops, e.g. to read an old map underneath. */
  async setRouteVisible(on: boolean) {
    await this.ready;
    for (const id of ['route-casing', 'route-line', 'route-stop']) {
      if (this.map.getLayer(id)) this.map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
    }
  }

  async setOldMapOpacity(opacity: number) {
    await this.ready;
    if (this.map.getLayer('old-map')) this.map.setPaintProperty('old-map', 'raster-opacity', opacity);
  }

  /** Back to the whole journey, framed beside the panel; the book's setting when there is no route. */
  home(animate = true) {
    const bounds = this.route.length
      ? this.route.reduce((b, p) => b.extend(p), new LngLatBounds(this.route[0], this.route[0]))
      : new LngLatBounds(book.home);
    this.fit(bounds, 9, animate);
  }

  /** Frames a chapter's stretch of country beside the panel. */
  frame(view: [LonLat, LonLat], animate = true) {
    this.fit(new LngLatBounds(view), 14, animate);
  }

  private fit(bounds: LngLatBounds, maxZoom: number, animate: boolean) {
    const pad = 36;
    const { top, right, bottom, left } = this.padding;
    this.map.fitBounds(bounds, {
      padding: { top: top + pad, right: right + pad, bottom: bottom + pad, left: left + pad },
      maxZoom,
      duration: animate && !reducedMotion() ? 1400 : 0,
    });
  }


  zoomBy(delta: number) {
    this.map.easeTo({ zoom: this.map.getZoom() + delta, duration: reducedMotion() ? 0 : 300 });
  }

  view(): { center: LonLat; zoom: number } {
    const c = this.map.getCenter();
    return { center: [c.lng, c.lat], zoom: this.map.getZoom() };
  }
}
