---
name: reading-map
description: Build and grow an interactive reading-companion map for a book the user is reading, a local MapLibre map beside a chapter-by-chapter panel of linked concepts, places, quotes and landmarks, with the book's journey traced on real lakes, rivers and trails. Use this whenever the user starts a book and wants a map ("make a reading map for X", "set up a map for my next book"), and inside any reading-map project (one with src/book.ts and src/content/chapter-NN.ts) whenever they send things from their reading, even with no instructions. That includes a bare name or list of names, "chN quote: …", a person, place, island or lake to add, a landmark to always show, the trip's members, a chapter title, or a route to trace.
---

# Reading map

The reader is reading a book and wants a map open beside it. They name things as they read, often in a few words, and expect them on the map with a short, accurate explanation, linked to everything related.

Two modes:

- **New book:** scaffold a project from this skill's `template/` (below). Takes a few minutes; the reader should be able to start reading straight away.
- **Reading loop:** they send names, quotes, places. Add them, check them, reply in a few lines.

**A library of books:** if `~/Projects/reading-maps/CLAUDE.md` exists, the reader keeps their books together there, served and shared its own way. Read it before starting a book, and follow it wherever it differs from this skill. (Inside a book there, it's already loaded.)

## Starting a new book

1. **Work out the book yourself:** title, author, year, where it's set, and whether it follows a journey (start, end, the waters or trails between). Use what you know and a quick web search. Ask the reader only for what you can't find; usually nothing. The map is of the real world: a novel set in real places works like any other book, but for an invented world, tell the reader the map can't show it.
2. **Scaffold** a folder for the book, `~/Projects/<book-slug>` unless the reader keeps projects elsewhere:
   ```bash
   mkdir -p ~/Projects && cp -R <this skill's directory>/template ~/Projects/<book-slug>
   cd ~/Projects/<book-slug> && npm install
   ```
   Then:
   - Fill in `src/book.ts`: title, author, year, a one-line tagline about where the book goes, `home` bounds framing the setting, `route` (`'/data/route.geojson'` if there's a journey, else `null`), and `units` for the scale bar (`'imperial'` if the book counts in miles).
   - Replace every placeholder in `package.json` and `CLAUDE.md` (`grep -n '__[A-Z_]*__' package.json CLAUDE.md` lists them; `__PORT__` is the `server.port` below).
   - Give `vite.config.ts` its own `server.port` and `preview.port`: the next free pair after the other books' (`find ~/Projects -maxdepth 2 -name vite.config.ts -not -path '*/<book-slug>/*' -exec grep -h 'port:' {} +`). With no other books, keep the template's 5180 and 5181. `server.port` is the map's address while reading; `preview.port` is for sharing (below).
3. **Landmarks first:** put the journey's start and end (or the book's anchor places) in `src/content/landmarks.ts` with `end: true`, so the map is useful at once.
4. **The journey** (if any): hand it to a background agent so the reader isn't waiting. Give the agent `references/journeys.md`, the waypoints you know from the book, and a deadline of about 20 minutes to report what it has. The route draws itself when `public/data/route.geojson` appears.
5. **Open it:** start `npm run dev` in the book in the background and give the reader the URL it prints. Tell them how to come back another day: open Claude Code in the book's folder and carry on sending things. `git init` only if they ask.

**Sharing:** to show someone else the map for a while, run `npm run build` in the book, then `npm run preview` and `ngrok http <preview port>` in the background; stop the preview when the reader is done sharing, since it's a second server. Give the reader the tunnel URL from `curl -s localhost:4040/api/tunnels`. Whoever has the link sees everything on the map, pictures included. Don't make an artifact for this: the artifact host blocks the outside map tiles, so it would need all the tiles bundled.

Chapters are added as the reader goes. The template's `src/content/chapter-01.ts` is a placeholder for the first chapter they send things from, which may be well into the book: rename the file and its export to that chapter (`chapter-16.ts`, `chapter16`, also in `index.ts`) and set its `number` and `title`. Ask for a chapter's title once if you don't know it; never invent one. A table of contents you find (the publisher's, a library catalogue's) is fine to offer for the reader to confirm, since editions differ. When a chapter covers a stretch of the journey ("this chapter is their first day, to a camp ten miles out"), give it a `view`, the [south-west, north-east] corners of that country, so opening the chapter frames it. An introduction, prologue or epilogue is a chapter without a `number` (e.g. `src/content/introduction.ts`, `title: 'Introduction'`), listed in `index.ts` in book order; its tab shows its title. Ask which part of the book they're in when it isn't clear. In *The Lonely Land*, everything first filed as chapter 1 turned out to be the introduction.

## The reading loop

First make sure the map is up: if nothing answers at the book's `server.port` (`curl -s localhost:<port>`), start `npm run dev` in the background. Then decide what each thing the reader sends is. Most messages are one of these:

| They send | It becomes | Where |
|---|---|---|
| A people, institution, person, route, event, town with a story | **Concept**: 1–2 paragraphs plus an overlay | `chapter.concepts` |
| An island, point, lake, minor spot ("a minor landmark I can click") | **Place**: a name, a note, and a fly-to | `chapter.places` |
| "chN quote: …", "intro quote: …" | **Quote**, word for word | `chapter.quotes` |
| "always show X" / "so I can find my bearings" | **Landmark** | `src/content/landmarks.ts` |
| Trip members, companions, crew | Concepts in a `party` group, plus a hub concept that links them all once there are two or more | `chapter.concepts` |

For a bare name, decide from the book: a big subject with history becomes a concept; a spot on the shore becomes a place. If unsure, make it a place and offer to promote it. Add things in the order they're sent, to the chapter the reader is on (the one they name, else the last chapter added to). When a concept or place from an earlier chapter comes up again ("add the Crees to ch1 as well", "list the Drum in this chapter too"), put its id in that chapter's `again` list rather than copying it: it shows in both, opens in place, and notes where it was first named.

For each concept:

1. **Research and check facts** (see Accuracy). For four or more at once, spawn a fact-check agent with the prompt pattern in `references/content.md` and draft while it works.
2. **Write the text.** Give the context the book doesn't: who, what, when, where it touches the book's route or story. Don't paraphrase the author: the reader has the book. Use plain, specific sentences. Give peoples' own names alongside the book's. Give distances, areas and heights in the book's units (`book.units`), so they compare with what the reader is reading.
3. **Draw the overlay**: areas, sites, lines (`references/content.md` covers how). Places need real coordinates: `npm run tiles -- names <bbox> "<regex>"`, or `islands` for unnamed islands.
4. **Link both ways.** Write `[[id]]` or `[[id|words]]` in the new text wherever another concept is mentioned, and add links to the new concept from existing text that mentions it. "Linked from" lists are generated automatically.
5. **Check it:** `npx tsc --noEmit`. Take a screenshot when the overlay is new or unusual (see Checking).

**Quotes** go in exactly as sent; only straight quotes and apostrophes become curly. If something looks like a typo ("it makes a little difference"), keep the reader's wording and ask. Verse keeps its lines: put `\n` between them. Set `by` for a speaker other than the author, as a `[[link]]` if that person is a concept. Set `about` to the concept the quote bears on.

**Reply** in a few lines: what you added, what you assumed or couldn't confirm (an identification, a likely typo, a disputed date), and "reload to see". The dev server hot-reloads; no restart needed.

**Keep the project's CLAUDE.md current as you go**, so a new session can pick up mid-book without the old conversation. It should say where the reader is (the chapter they're on, anything they said they'd send), one entry per chapter in book order (what it covers, its places, what it brings back, its colours), the identifications they haven't confirmed, and the questions waiting on them. A session's scratchpad doesn't survive: anything worth reusing goes in `scripts/`.

## Finding a spot from the text

Readers often ask where something in the text was: a night's camp, a lunch stop, "a long point a mile away". Work it out, pin your best guess as a place, and say how sure you are.

- Measure: `npm run along -- <lon,lat> <lon,lat>` gives each point's distance along the route and the gap between them; `npm run along -- <lon,lat> +20` gives where "twenty miles on" lands. Authors' distances are often off (Olson's ran 25–30% high), so let the description decide: which shore, rock or sand, what could be seen from it, how long they paddled.
- Look: `npm run shot -- out.png --at <lon,lat> --zoom 13 --sat --no-panel --mark "a:<lon,lat>" --mark "b:<lon,lat>"`, and again with a topographic map from the Maps menu (`--map <id>`) for contours and names. Read the images before choosing.
- Names: in Canada, the CGNDB gazetteer has rapids, points and bays that OpenStreetMap lacks: `https://geogratis.gc.ca/services/geoname/en/geonames.json?q=<name>&bbox=W,S,E,N`, or `concise=RAP` (rapids), `FALL` or `LAKE` in place of `q`. `npm run tiles -- names` covers OpenStreetMap anywhere.
- The reader may check the satellite view and spot it first (cabins across a channel, a rapid right after a bend). When they do, put the pin where they say.
- Record each guess and its reasoning in the project's CLAUDE.md, with the identifications the reader hasn't confirmed.

## Pictures

Pictures make the map come alive. Concepts take `images` (the first is shown large; a `portrait: true` first image also appears round beside the name in the list). Sites, places and landmarks take `image`, as do route waypoints via `src/content/waypoints.ts`. Each is a `Pic`: a Wikimedia `file` name plus your own `caption`. Run `npm run images` to download new ones into `public/images/` and record their credit and licence in `src/content/images.json`. The reader's own photos go in `public/images/own/` with `own: true`; give them a `credit` naming whoever took them.

- Prefer public domain, CC0, CC BY or CC BY-SA, which are fine to show anyone. A non-free Wikipedia upload (`wiki: 'en'`) is fine too, for the reader's own map.
- Check that every picture shows what it claims. Read the file's description, source institution and date. Wikimedia titles are often wrong: "Sir George Simpson, 1850" is a William Notman photograph, and Notman opened his studio in 1856. Write the caption from what you verified, not from the file title.
- Peoples: prefer documented historical photographs or artworks with named subjects, places, artists and titles. Use none rather than a generic or staged image.
- For more than a few pictures, hand the search to a background agent with the prompt in `references/content.md`.
- Wikimedia throttles downloads (HTTP 429) after about ten files; `npm run images` waits and retries on its own, so run it in the background for a big batch.
- When Wikimedia's credit metadata is a mess (a URL, a catalogue record), set `credit` on the Pic by hand.
- Photos can also come from anywhere on the web: trip reports, lodges, Flickr, archives. Give the Pic a `url` (the direct image address), a `page` (where it appears) and a `credit` (the photographer or site); `npm run images` saves a copy in `public/images/web/`, and the credit links back to the page. Look at every one before captioning it. They're for the reader's own map: a share shows them to whoever has the link. When you've confirmed one is free, say so with `license` (e.g. `license: 'Public domain'` on a crop of a public-domain scan).

The satellite button (under the zoom controls) swaps the drawn land and water for Esri World Imagery, keeping the route, labels and overlays. Nothing to set up.

## Old maps

The map button under the satellite one opens a menu of maps to lay over the land and water (`src/content/oldmaps.ts`; it stays hidden while the list is empty), with a strength slider and a switch to hide the route. Present-day topographic maps go first with `today: true`: Esri World Topo (`https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}`) anywhere, and in Canada Natural Resources Canada's Toporama WMS (`https://maps.geogratis.gc.ca/wms/toporama_en?...&layers=WMS-Toporama&srs=EPSG:3857&bbox={bbox-epsg-3857}&width=256&height=256&format=image/png`). Give one `default: true` when it suits the book better than the drawn map (USGS Topo did for the Dakota prairie): it shows from the first visit until the reader picks another or None. Then historical ones. A map is either XYZ tiles someone has already georeferenced (`tiles`) or a scan warped into web mercator and saved in `public/oldmaps/` (`image` and `bounds`). Warping needs ImageMagick 7 (`magick`):

- Graticule: for maps with ruled latitude and longitude, estimate the crossings and refine them with `node scripts/graticule.mjs <img> <estimates.json>`, drop any that locked onto the frame, then `npm run oldmap -- <img> <cp.json> W S E N <px per degree> public/oldmaps/<id>.webp`. Check the fit's residual it prints; a few pixels is good.
- Survey sheets bounded by meridians and parallels: read the four corners and use `--order b`.
- Sketch maps (fur-trade era) whose own coordinates are wrong: match a dozen identifiable places by eye and use `--order 1 --pin`, which pins each place exactly. Say in the note that the land between them is only roughly placed.

In the United States, every edition of every USGS topographic sheet since 1884 can be laid on with no georeferencing, through Esri's public image service: `tiles` = `https://historical1.arcgis.com/arcgis/rest/services/USA_Historical_Topo_Maps/ImageServer/exportImage?bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857&size=256,256&format=png32&transparent=true&f=image&mosaicRule=…`, with a URL-encoded mosaic rule such as `{"mosaicMethod":"esriMosaicAttribute","sortField":"DateCurrent","sortValue":"0","ascending":true,"where":"DateCurrent<1955 AND Map_Scale<=125000"}` (earliest edition on top). Query `…/ImageServer/query` first to see which sheets exist (`Primary_State` is the full state name; `DateCurrent` is the survey year, `Imprint_Year` the printing, and later reprints of old sheets may carry revisions). The service returns nothing at small scales, so set `minzoom: 11` and say so in the note. Good for country drowned since (reservoirs) or long since ploughed.

Good sources: Natural Resources Canada's OSTR repository (Geological Survey maps, JPEG 2000), Wikimedia Commons, the Library of Congress (IIIF), David Rumsey. ImageMagick reads JPEG 2000.

## Accuracy

These maps are about real peoples and real history. Before writing a fact, check it, using the best sources for the book's country and period. In Canada, the Dictionary of Canadian Biography (`http://www.biographi.ca/en/bio/<slug>.html`) is reliable and fetchable with curl; others there are The Canadian Encyclopedia (blocks scripts; use WebFetch), the Encyclopedia of Saskatchewan and Parks Canada. Anywhere: national biographies and encyclopedias, park services and historical societies, Wikipedia for orientation, and nations' own sites.

- When sources disagree or you're unsure, say so in the text ("accounts differ on the year", "most likely the island Olson means").
- Present a contested idea as contested (e.g. the "Cree westward migration").
- `sources` holds only URLs you have loaded and confirmed name the right thing.
- Identify people by their role in the book, then confirm the name. In *The Lonely Land*, Blair Fraser, a regular of the group, turned out not to be on the trip.

## Map conventions

- **Robin orange `#e5532a`** means the book's journey and its landmarks, nothing else.
- Each concept has its own colour, readable on cream land and teal water, distinct from the others in its `group`. Group concepts that should show each other's areas faintly: `peoples`, `fur-trade`, `party`.
- **Areas** are coarse outlines (10–25 points) that are smoothed when drawn. Call them approximate.
- **Lines** are built from steps: `[lon, lat]` points (hand-placed, smoothed), `{ traced: [...] }` (real geometry, drawn exactly), or `'route'` (the book's traced journey, turned to fit). Keep shared stretches in `src/content/routes.ts` and traced geometry in `src/content/traced/`.
- `zoom` on a concept caps how close the map zooms to fit its overlay (default 7.5; about 10 for one village). `zoom` on a place is how close the fly-to goes.

## Checking

- `npx tsc --noEmit` after every change.
- In dev, `window.__map` is the MapLibre map.
- Screenshot: `npm run shot -- out.png [--chapter 3] [--open <id>] [--at lon,lat --zoom 12] [--home] [--sat] [--map <id>]` with the map running, then read the image. `--home` frames the whole journey. It drives the installed Google Chrome (or the browser at `CHROME_PATH`) through `puppeteer-core`, setting what the page restores on load, and prints the page's warnings (an unknown id, a picture not fetched yet): fix them. For anything it can't do, write a one-off from it: click `[data-id="<id>"] .concept-head` or `.place-row[data-id="<id>"]`.
- `scripts/tiles.mjs` reads OpenStreetMap geometry from the same vector tiles the map uses, so it works when Overpass is overloaded (it often is). Its commands are `names`, `islands`, `trace` and `water`; see `references/journeys.md`.

## Files in a project

```
src/book.ts               title, author, year, tagline, home view, route file
src/content/chapter-NN.ts one per chapter: concepts, places, quotes (register in index.ts)
src/content/introduction.ts  the same for an unnumbered part (introduction, prologue, epilogue), if any
src/content/landmarks.ts  always-on markers
src/content/waypoints.ts  pictures for route waypoints, by name
src/content/images.json   generated by `npm run images`: credit, licence, size of each picture
public/images/            downloaded pictures (own/ for the reader's own)
src/content/types.ts      the content contract; read it before writing content
src/content/routes.ts     shared hand-placed line stretches (create when needed)
src/content/traced/       traced geometry modules (create when needed)
public/data/route.geojson the journey: one LineString plus waypoint Points
src/content/oldmaps.ts    the Maps menu: today's topographic maps and warped old ones
public/oldmaps/           warped old-map images
public/images/web/        web photos
scripts/tiles.mjs         OSM-from-tiles helper
scripts/images.mjs        picture fetcher
scripts/oldmap.mjs, graticule.mjs   warping old maps
scripts/along.mjs         distances along the route
scripts/shot.mjs          headless screenshots of the dev map
src/{main,map,style,geo,lightbox}.ts, styles.css   the app; same in every book
```

A book may be served from a path other than `/` (a library serves each under its folder), so app code reaches files in `public/` through `asset()` (`src/content/index.ts`); content keeps writing `/data/route.geojson` or `oldmaps/x.webp`. Change a book's app when the reader asks, in that book; leave this skill's own files alone unless they ask.
