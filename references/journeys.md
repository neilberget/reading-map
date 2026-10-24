# Tracing a journey

The book's route is `public/data/route.geojson`, and `book.route` points at it. The map draws it in robin orange at every zoom. Its waypoints show from zoom 7, except those already marked as landmarks. Lines in concepts can splice it in with the `'route'` step.

## Format

```json
{ "type": "FeatureCollection", "features": [
  { "type": "Feature", "properties": { "id": "route", "name": "Olson's route, 1955" },
    "geometry": { "type": "LineString", "coordinates": [[-107.89344, 55.4339], "…"] } },
  { "type": "Feature", "properties": { "name": "Drum Rapids", "kind": "rapids", "note": "One short factual sentence." },
    "geometry": { "type": "Point", "coordinates": [-107.64172, 56.01065] } }
] }
```

- Run the line from the start of the journey to its end, in travel order, starting where the book's journey starts. A round trip is still one line: trace the way out first and write the file, then go on with the way back, which may run back over the way out.
- Use 1,500–3,000 vertices, rounded to 5 decimals.
- `kind` is one of: settlement, rapids, portage, lake, landmark.
- Include 15–30 named waypoints that the book or the classic route mentions.

## Workflow (good to hand to a background agent)

1. **Sequence.** List the waypoints in order from the book (its chapter titles help) and the historical route. Confirm the order with a quick web search. Follow the author's route where it differs from the classic one.
2. **Coordinates.** `npm run tiles -- names <w,s,e,n> "<regex>"` finds named lakes, rapids, portages and villages in the tiles. The Canadian Geographical Names Database is good for Canadian features the tiles lack.
3. **Trace.** Pick the tool by the kind of way:
   - **Chains of lakes and rivers** (canoe routes): `npm run tiles -- water <w,s,e,n> --via lon,lat --via lon,lat ...`.
     - Pass a `--via` at every point where the route must go a particular way: each portage, each fork, each lake where a wrong turn is possible.
     - The tool paints lakes and rivers onto a grid (`--cell` metres, default 100) and finds the cheapest path between vias. Water costs 1 and land costs `--land` (default 30), so the path crosses land only at portages and at gaps in the map.
     - It reports how much of the path is on land. Anything beyond the known portages is a gap: unmapped creeks or narrows. Add vias there or hand-place a few points.
     - The Stanley Mission → Pelican Narrows leg took 9 s at the defaults. The whole Lonely Land route at `--cell 120` fits comfortably. Split very long routes into legs and join them.
   - **A named line** (a river with a continuous centreline, a trail, a border): `npm run tiles -- trace <w,s,e,n> --layer <layer> --where key=value --from lon,lat --to lon,lat`. Examples:
     - The Grand Portage Trail: `--layer transportation_name --where "name=Grand Portage Trail" --zoom 14`.
     - The Minnesota–Ontario border: `--layer boundary --where admin_level=2 --not maritime=1 --zoom 11`.
     - Pieces are stitched with a shortest-path search, bridging gaps under `--bridge` metres (default 100).
     - Rivers broken up by lakes won't connect this way; use `water` for those.
   - **Overland with no mapped way** (a pass crossed on horseback, a trail long since lost): hand-place a point every few kilometres along the valleys and ridges the sources describe, checked against a satellite screenshot (`npm run shot -- … --sat --no-panel`). Say in a nearby waypoint's note that the stretch is approximate.
4. **Write the file**, overwriting in place, as soon as a reasonable version exists. Then refine the gaps; the map picks up each new version on reload.
5. **Check it:** take a screenshot at the overview and at zoom ~9.5 over a tricky stretch (portages, river forks). In dev you can add a test line with `window.__map.addSource/addLayer` to compare a candidate against the current route.
6. **Report.** The route is done when it runs start to end in travel order on the right waters and ways, with its waypoints where the book puts them. Report then, or at your deadline with what you have: what's traced, what's hand-placed or approximate, and anything for the reader to confirm. Don't keep refining without reporting.

## Other traced geometry

Routes that belong to a concept, not the book's own journey, go in a module under `src/content/traced/`. An example is the La Vérendrye route from Grand Portage to Fort Frances: the trail plus the border, 279 miles. Export a `LonLat[]` and use it as `{ traced: thatArray }` in a line's `path`. Note in a comment how it was traced.

## Overpass

`https://overpass-api.de/api/interpreter` gives full OSM detail when it's up. It needs a User-Agent header (`curl -A '<project>/0.1'`) or it returns 406, and it is often "at capacity" (502), and so are its mirrors. Use the tiles first.

Save any downloads in the session scratchpad, not the project, and run Python on them with `python3 -I`.
