---
name: reading-map
description: Build and grow Neil's interactive reading-companion maps for the books he reads, a local MapLibre map in the Flyway look of ../geo-bird, with a chapter-by-chapter panel of linked concepts, places, quotes and landmarks, and the book's journey traced on real lakes and rivers. Use this whenever Neil starts a new book and wants a map ("make a reading map for X", "set up a map for my next book"), and inside any reading-map project (one with src/book.ts and src/content/chapter-NN.ts, e.g. ~/Projects/the-lonely-land) whenever he sends things from his reading, even with no instructions. That includes a bare name or list of names, "chN quote: …", a person, place, island or lake to add, a landmark to always show, the trip's members, a chapter title, or a route to trace.
---

# Reading map

Neil reads a book and wants a map open beside it. He names things as he reads, often in a few words, and expects them on the map with a short, accurate explanation, linked to everything related. The reference build is `~/Projects/the-lonely-land` (Sigurd Olson, *The Lonely Land*): open it when unsure how something should look or be written.

Two modes:

- **New book:** scaffold a project from `template/` (below). Takes a few minutes; Neil should be able to start reading straight away.
- **Reading loop:** he sends names, quotes, places. Add them, check them, reply in a few lines.

## Starting a new book

1. **Work out the book yourself:** title, author, year, where it's set, and whether it follows a journey (start, end, the waters or trails between). Use what you know and a quick web search. Ask Neil only for what you can't find; usually nothing.
2. **Scaffold:**
   ```bash
   cp -R ~/.claude/skills/reading-map/template ~/Projects/<book-slug>
   cd ~/Projects/<book-slug> && npm install
   ```
   Then:
   - Fill in `src/book.ts`: title, author, year, a one-line tagline about where the book goes, `home` bounds framing the setting, `route` (`'/data/route.geojson'` if there's a journey, else `null`), and `units` for the scale bar (`'imperial'` if the book counts in miles).
   - Replace the placeholders in `package.json` (`__SLUG__`) and `CLAUDE.md`.
   - Give `vite.config.ts` its own `server.port` and `preview.port`. The Lonely Land uses 5180 and 5181, so take the next free pair, and keep them, so Neil's bookmark lasts.
3. **Landmarks first:** put the journey's start and end (or the book's anchor places) in `src/content/landmarks.ts` with `end: true`, so the map is useful at once.
4. **The journey** (if any): hand it to a background agent so Neil isn't waiting. Give the agent `references/journeys.md` and the waypoints you know from the book. The route draws itself when `public/data/route.geojson` appears.
5. **Run it:** `npm run dev` in the background, then give Neil the URL. `git init` only if he asks.

To show someone else the map for a while, run `npm run build`, then `npm run preview` and `ngrok http <preview port>` in the background. Give Neil the tunnel URL from `curl -s localhost:4040/api/tunnels`. Don't make an artifact for this: the artifact host blocks the outside map tiles, so it would need all the tiles bundled.

Chapters are added as he reads. Ask for a chapter's title once if you don't know it; never invent one. When a chapter covers a stretch of the journey ("this chapter is their first day, to a camp ten miles out"), give it a `view`, the [south-west, north-east] corners of that country, so opening the chapter frames it. An introduction, prologue or epilogue is a chapter without a `number` (e.g. `src/content/introduction.ts`, `title: 'Introduction'`), listed in `index.ts` in book order; its tab shows its title. Ask which part of the book he's in when it isn't clear. In *The Lonely Land*, everything first filed as chapter 1 turned out to be the introduction.

## The reading loop

Decide what each thing he sends is. Most messages are one of these:

| He sends | It becomes | Where |
|---|---|---|
| A people, institution, person, route, event, town with a story | **Concept**: 1–2 paragraphs plus an overlay | `chapter.concepts` |
| An island, point, lake, minor spot ("a minor landmark I can click") | **Place**: a name, a note, and a fly-to | `chapter.places` |
| "chN quote: …", "intro quote: …" | **Quote**, word for word | `chapter.quotes` |
| "always show X" / "so I can find my bearings" | **Landmark** | `src/content/landmarks.ts` |
| Trip members, companions, crew | Concepts in a `party` group, plus a hub concept that links them all | `chapter.concepts` |

For a bare name, decide from the book: a big subject with history becomes a concept; a spot on the shore becomes a place. If unsure, make it a place and offer to promote it. Add things in the order he sends them, to the chapter he's on (the one he names, else the last chapter he added to). When a concept or place from an earlier chapter comes up again ("add the Crees to ch1 as well", "list the Drum in this chapter too"), put its id in that chapter's `again` list rather than copying it: it shows in both, opens in place, and notes where it was first named.

For each concept:

1. **Research and check facts** (see Accuracy). For four or more at once, spawn a fact-check agent with the prompt pattern in `references/content.md` and draft while it works.
2. **Write the text.** Give the context the book doesn't: who, what, when, where it touches the book's route or story. Don't paraphrase the author: Neil is reading him. Use plain, specific sentences. Give peoples' own names alongside the book's. Give distances, areas and heights in the book's units (`book.units`), so they compare with what he's reading.
3. **Draw the overlay**: areas, sites, lines (`references/content.md` covers how). Places need real coordinates: `npm run tiles -- names <bbox> "<regex>"`, or `islands` for unnamed islands.
4. **Link both ways.** Write `[[id]]` or `[[id|words]]` in the new text wherever another concept is mentioned, and add links to the new concept from existing text that mentions it. "Linked from" lists are generated automatically.
5. **Check it:** `npx tsc --noEmit`. Take a screenshot when the overlay is new or unusual (see Checking).

**Quotes** go in exactly as sent; only straight quotes and apostrophes become curly. If something looks like a typo ("it makes a little difference"), keep his wording and ask. Verse keeps its lines: put `\n` between them. Set `by` for a speaker other than the author, as a `[[link]]` if that person is a concept. Set `about` to the concept the quote bears on.

**Reply** in a few lines: what you added, what you assumed or couldn't confirm (an identification, a likely typo, a disputed date), and "reload to see". The dev server hot-reloads; no restart needed.

**Keep the project's CLAUDE.md current as you go**, so a new session can pick up mid-book without the old conversation. It should say where Neil is (the chapter he's on, anything he said he'd send), one entry per chapter in book order (what it covers, its places, what it brings back, its colours), the identifications he hasn't confirmed, and the questions waiting on him. A session's scratchpad doesn't survive: anything worth reusing goes in `scripts/` or the skill.

## Finding a spot from the text

Neil often asks where something in the text was: a night's camp, a lunch stop, "a long point a mile away". Work it out, pin your best guess as a place, and say how sure you are.

- Measure: `npm run along -- <lon,lat> <lon,lat>` gives each point's distance along the route and the gap between them; `npm run along -- <lon,lat> +20` gives where "twenty miles on" lands. Authors' distances are often off (Olson's ran 25–30% high), so let the description decide: which shore, rock or sand, what could be seen from it, how long they paddled.
- Look: `npm run shot -- out.png --at <lon,lat> --zoom 13 --sat --no-panel --mark "a:<lon,lat>" --mark "b:<lon,lat>"`, and again with `--map toporama` for contours and names. Read the images before choosing.
- Names: in Canada, the CGNDB gazetteer has rapids, points and bays that OpenStreetMap lacks: `https://geogratis.gc.ca/services/geoname/en/geonames.json?q=<name>&bbox=W,S,E,N`, or `concise=RAP` (rapids), `FALL` or `LAKE` in place of `q`. `npm run tiles -- names` covers OpenStreetMap.
- Neil checks the satellite view himself and often spots it first (cabins across a channel, a rapid right after a bend). When he does, put the pin where he says.
- Record each guess and its reasoning in the project's CLAUDE.md, with the identifications he hasn't confirmed.

## Pictures

Pictures make the map come alive. Concepts take `images` (the first is shown large; a `portrait: true` first image also appears round beside the name in the list). Sites, places and landmarks take `image`, as do route waypoints via `src/content/waypoints.ts`. Each is a `Pic`: a Wikimedia `file` name plus your own `caption`. Run `npm run images` to download new ones into `public/images/` and record their credit and licence in `src/content/images.json`. Neil's own photos go in `public/images/own/` with `own: true`; add `credit` when someone else took them (a family member, the author).

- Use only public domain, CC0, CC BY or CC BY-SA. A non-free Wikipedia upload (`wiki: 'en'`) is acceptable because the map is private.
- Check that every picture shows what it claims. Read the file's description, source institution and date. Wikimedia titles are often wrong: "Sir George Simpson, 1850" is a William Notman photograph, and Notman opened his studio in 1856. Write the caption from what you verified, not from the file title.
- Peoples: prefer documented historical photographs or artworks with named subjects, places, artists and titles. Use none rather than a generic or staged image.
- For more than a few pictures, hand the search to a background agent with the prompt in `references/content.md`.
- Wikimedia throttles downloads (HTTP 429) after about ten files; `npm run images` waits and retries on its own, so run it in the background for a big batch.
- When Wikimedia's credit metadata is a mess (a URL, a catalogue record), set `credit` on the Pic by hand.
- When Neil says his map is private (only for him), photos can come from anywhere on the web: canoe trip reports, lodges, Flickr, archives. Give the Pic a `url` (the direct image address), a `page` (where it appears) and a `credit` (the photographer or site); `npm run images` saves a copy in `public/images/web/`, and the credit links back to the page. Look at every one before captioning it, and remind him that sharing the map (ngrok) shows these to others.

The satellite button (under the zoom controls) swaps the drawn land and water for Esri World Imagery, keeping the route, labels and overlays. Nothing to set up.

## Old maps

The map button under the satellite one opens a menu of maps to lay over the land and water (`src/content/oldmaps.ts`; it stays hidden while the list is empty), with a strength slider and a switch to hide the route. Present-day topographic maps go first with `today: true`: Esri World Topo (`https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}`) anywhere, and in Canada Natural Resources Canada's Toporama WMS (`https://maps.geogratis.gc.ca/wms/toporama_en?...&layers=WMS-Toporama&srs=EPSG:3857&bbox={bbox-epsg-3857}&width=256&height=256&format=image/png`). Give one `default: true` when it suits the book better than the drawn map (USGS Topo did for the Dakota prairie): it shows from the first visit until the reader picks another or None. Then historical ones. A map is either XYZ tiles someone has already georeferenced (`tiles`) or a scan warped into web mercator and saved in `public/oldmaps/` (`image` and `bounds`):

- Graticule: for maps with ruled latitude and longitude, estimate the crossings and refine them with `node scripts/graticule.mjs <img> <estimates.json>`, drop any that locked onto the frame, then `npm run oldmap -- <img> <cp.json> W S E N <px per degree> public/oldmaps/<id>.webp`. Check the fit's residual it prints; a few pixels is good.
- Survey sheets bounded by meridians and parallels: read the four corners and use `--order b`.
- Sketch maps (fur-trade era) whose own coordinates are wrong: match a dozen identifiable places by eye and use `--order 1 --pin`, which pins each place exactly. Say in the note that the land between them is only roughly placed.

Good sources: Natural Resources Canada's OSTR repository (Geological Survey maps, JPEG 2000), Wikimedia Commons, the Library of Congress (IIIF), David Rumsey. ImageMagick reads JPEG 2000.

## Accuracy

These maps are about real peoples and real history. Before writing a fact, check it. The Dictionary of Canadian Biography (`http://www.biographi.ca/en/bio/<slug>.html`) is reliable and fetchable with curl. Others: The Canadian Encyclopedia (blocks scripts; use WebFetch), Encyclopedia of Saskatchewan, Parks Canada, Wikipedia for orientation, and nations' own sites.

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
- Screenshot: `npm run shot -- out.png [--chapter 3] [--open <id>] [--at lon,lat --zoom 12] [--sat] [--map <id>]` with the dev server running, then read the image. It drives Chrome through `puppeteer-core` from `~/Projects/geo-bird/node_modules`, setting what the page restores on load. For anything it can't do, write a one-off from it: click `[data-id="<id>"] .concept-head` or `.place-row[data-id="<id>"]`.
- `scripts/tiles.mjs` reads OpenStreetMap geometry from the same vector tiles the map uses, so it works when Overpass is overloaded (it often is). Its commands are `names`, `islands`, `trace` and `water`; see `references/journeys.md`.

## Files in a project

```
src/book.ts               title, author, year, tagline, home view, route file
src/content/chapter-NN.ts one per chapter: concepts, places, quotes (register in index.ts)
src/content/introduction.ts  the same for an unnumbered part (introduction, prologue, epilogue), if any
src/content/landmarks.ts  always-on markers
src/content/waypoints.ts  pictures for route waypoints, by name
src/content/images.json   generated by `npm run images`: credit, licence, size of each picture
public/images/            downloaded pictures (own/ for Neil's)
src/content/types.ts      the content contract; read it before writing content
src/content/routes.ts     shared hand-placed line stretches (create when needed)
src/content/traced/       traced geometry modules (create when needed)
public/data/route.geojson the journey: one LineString plus waypoint Points
src/content/oldmaps.ts    the Maps menu: today's topographic maps and warped old ones
public/oldmaps/           warped old-map images
public/images/web/        web photos for a private map
scripts/tiles.mjs         OSM-from-tiles helper
scripts/images.mjs        picture fetcher
scripts/oldmap.mjs, graticule.mjs   warping old maps
scripts/along.mjs         distances along the route
scripts/shot.mjs          headless screenshots of the dev map
src/{main,map,style,geo,lightbox}.ts, styles.css   the app; same in every book
```

When you improve the app itself (not the content), copy the changed files back into `~/.claude/skills/reading-map/template/` so the next book gets the improvement. Another book's session may have improved the template too: diff the app files against it when you start, and take what's newer.

The skill is a public GitHub repo (`neilberget/reading-map`, MIT). Change it locally as the app improves; commit or push only when Neil says to.
