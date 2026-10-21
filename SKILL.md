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
   - Fill in `src/book.ts`: title, author, year, a one-line tagline about where the book goes, `home` bounds framing the setting, and `route` (`'/data/route.geojson'` if there's a journey, else `null`).
   - Replace the placeholders in `package.json` (`__SLUG__`) and `CLAUDE.md`.
   - Give `vite.config.ts` its own `server.port` and `preview.port`. The Lonely Land uses 5180 and 5181, so take the next free pair, and keep them, so Neil's bookmark lasts.
3. **Landmarks first:** put the journey's start and end (or the book's anchor places) in `src/content/landmarks.ts` with `end: true`, so the map is useful at once.
4. **The journey** (if any): hand it to a background agent so Neil isn't waiting. Give the agent `references/journeys.md` and the waypoints you know from the book. The route draws itself when `public/data/route.geojson` appears.
5. **Run it:** `npm run dev` in the background, then give Neil the URL. `git init` only if he asks.

To show someone else the map for a while, run `npm run build`, then `npm run preview` and `ngrok http <preview port>` in the background. Give Neil the tunnel URL from `curl -s localhost:4040/api/tunnels`. Don't make an artifact for this: the artifact host blocks the outside map tiles, so it would need all the tiles bundled.

Chapters are added as he reads. Ask for a chapter's title once if you don't know it; never invent one.

## The reading loop

Decide what each thing he sends is. Most messages are one of these:

| He sends | It becomes | Where |
|---|---|---|
| A people, institution, person, route, event, town with a story | **Concept**: 1–2 paragraphs plus an overlay | `chapter.concepts` |
| An island, point, lake, minor spot ("a minor landmark I can click") | **Place**: a name, a note, and a fly-to | `chapter.places` |
| "chN quote: …" | **Quote**, word for word | `chapter.quotes` |
| "always show X" / "so I can find my bearings" | **Landmark** | `src/content/landmarks.ts` |
| Trip members, companions, crew | Concepts in a `party` group, plus a hub concept that links them all | `chapter.concepts` |

For a bare name, decide from the book: a big subject with history becomes a concept; a spot on the shore becomes a place. If unsure, make it a place and offer to promote it. Add things in the order he sends them, to the chapter he's on (the one he names, else the last chapter he added to).

For each concept:

1. **Research and check facts** (see Accuracy). For four or more at once, spawn a fact-check agent with the prompt pattern in `references/content.md` and draft while it works.
2. **Write the text.** Give the context the book doesn't: who, what, when, where it touches the book's route or story. Don't paraphrase the author: Neil is reading him. Use plain, specific sentences. Give peoples' own names alongside the book's.
3. **Draw the overlay**: areas, sites, lines (`references/content.md` covers how). Places need real coordinates: `npm run tiles -- names <bbox> "<regex>"`, or `islands` for unnamed islands.
4. **Link both ways.** Write `[[id]]` or `[[id|words]]` in the new text wherever another concept is mentioned, and add links to the new concept from existing text that mentions it. "Linked from" lists are generated automatically.
5. **Check it:** `npx tsc --noEmit`. Take a screenshot when the overlay is new or unusual (see Checking).

**Quotes** go in exactly as sent; only straight quotes and apostrophes become curly. If something looks like a typo ("it makes a little difference"), keep his wording and ask. Set `by` for a speaker other than the author, as a `[[link]]` if that person is a concept. Set `about` to the concept the quote bears on.

**Reply** in a few lines: what you added, what you assumed or couldn't confirm (an identification, a likely typo, a disputed date), and "reload to see". The dev server hot-reloads; no restart needed.

## Pictures

Pictures make the map come alive. Concepts take `images` (the first is shown large; a `portrait: true` first image also appears round beside the name in the list). Sites, places and landmarks take `image`, as do route waypoints via `src/content/waypoints.ts`. Each is a `Pic`: a Wikimedia `file` name plus your own `caption`. Run `npm run images` to download new ones into `public/images/` and record their credit and licence in `src/content/images.json`. Neil's own photos go in `public/images/own/` with `own: true`.

- Use only public domain, CC0, CC BY or CC BY-SA. A non-free Wikipedia upload (`wiki: 'en'`) is acceptable because the map is private.
- Check that every picture shows what it claims. Read the file's description, source institution and date. Wikimedia titles are often wrong: "Sir George Simpson, 1850" is a William Notman photograph, and Notman opened his studio in 1856. Write the caption from what you verified, not from the file title.
- Peoples: prefer documented historical photographs or artworks with named subjects, places, artists and titles. Use none rather than a generic or staged image.
- For more than a few pictures, hand the search to a background agent with the prompt in `references/content.md`.
- Wikimedia throttles downloads (HTTP 429) after about ten files; `npm run images` waits and retries on its own, so run it in the background for a big batch.
- When Wikimedia's credit metadata is a mess (a URL, a catalogue record), set `credit` on the Pic by hand.

The satellite button (under the zoom controls) swaps the drawn land and water for Esri World Imagery, keeping the route, labels and overlays. Nothing to set up.

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
- Headless screenshot: Chrome with `--use-angle=swiftshader --enable-unsafe-swiftshader`, via `puppeteer-core` (in `~/Projects/geo-bird/node_modules`). Clear localStorage first, wait about 3 s after load, then click `[data-id="<id>"] .concept-head` or `.place-row[data-id="<id>"]`.
- `scripts/tiles.mjs` reads OpenStreetMap geometry from the same vector tiles the map uses, so it works when Overpass is overloaded (it often is). Its commands are `names`, `islands`, `trace` and `water`; see `references/journeys.md`.

## Files in a project

```
src/book.ts               title, author, year, tagline, home view, route file
src/content/chapter-NN.ts one per chapter: concepts, places, quotes (register in index.ts)
src/content/landmarks.ts  always-on markers
src/content/waypoints.ts  pictures for route waypoints, by name
src/content/images.json   generated by `npm run images`: credit, licence, size of each picture
public/images/            downloaded pictures (own/ for Neil's)
src/content/types.ts      the content contract; read it before writing content
src/content/routes.ts     shared hand-placed line stretches (create when needed)
src/content/traced/       traced geometry modules (create when needed)
public/data/route.geojson the journey: one LineString plus waypoint Points
scripts/tiles.mjs         OSM-from-tiles helper
scripts/images.mjs        picture fetcher
src/{main,map,style,geo,lightbox}.ts, styles.css   the app; same in every book
```

When you improve the app itself (not the content), copy the changed files back into `~/.claude/skills/reading-map/template/` so the next book gets the improvement.
