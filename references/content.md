# Writing content

The contract is `src/content/types.ts`; this covers how to fill it well. The worked example is `~/Projects/reading-maps/the-lonely-land/src/content/chapter-01.ts`.

## A concept

```ts
{
  id: 'hbc',                                  // short, unique across all chapters; used in [[hbc]] links
  title: 'Hudson’s Bay Company',              // the book's name for it
  aka: 'The Bay, the HBC',                    // own name, other names (italic line under the title)
  kind: 'Fur trade',                          // short label: People, Church, Fur trade, Person, Route, Village…
  group: 'fur-trade',                         // optional: siblings show each other's areas faintly
  color: '#36454f',
  body: [
    'Charles II chartered the Hudson’s Bay Company in 1670 and granted it Rupert’s Land… [[crees|Cree]] and [[chipewyans|Chipewyan]] traders brought the furs down to it…',
    'The Churchill runs to Hudson Bay, so all of Olson’s route lies inside Rupert’s Land…',
  ],
  areas: [{ name: 'Rupert’s Land', sub: 'granted to the HBC, 1670', label: [-97.5, 56.2], outline: [[-117.4, 52.2], /* … */] }],
  sites: [{ name: 'York Factory', at: [-92.3, 57.0], year: '1684', icon: 'square', note: 'The company’s main depot on Hudson Bay.' }],
  sources: [{ label: 'DCB: George Simpson', url: 'http://www.biographi.ca/en/bio/simpson_george_8E.html' }],
}
```

- **Body:** one or two paragraphs. The first says what it is and how it touches the book (the route, the setting, the people in it). The second gives the history that makes the book's mention mean something. Prefer dates, names and places to adjectives. Don't retell the author's own passage; give what he leaves out.
- **People in the book's party:** the author usually gives each a paragraph. Write who the person was outside the book: birth and death years, career, what they were known for. Then one line on their part in the trip if known. Give them a shared `group` (e.g. `party`), `kind: 'The party'` and one colour, and add a hub concept (`id: 'party'`) that names and links everyone.
- **Icons:** `cross` mission, `square` post, fort, settlement or depot, `diamond` portage, `triangle` rapids or falls, `ring` landmark or minor feature, `dot` community or person's place.
- **Site notes** are one sentence and may contain `[[links]]`. Use `year` for a founding date or span ('1774', 'c. 1849', '1820–21', 'to 1803').
- **Areas** (a people's homeland, a charter territory): 10–25 points, clockwise or not, no closing point needed. Give a label point where the name won't sit on the journey. Say "around 1800", "approximate" or similar in the text; homelands overlapped and moved.
- **Colours used so far** (avoid them within a group): plum `#86357a`, claret `#a3323f`, mustard `#a8840f`, spruce `#2f7a4f`, copper `#b4522f`, violet `#5b4fa0`, brown `#7d6450`, indigo `#2f4a8a`, magenta `#b0256a`, brick `#8b3a2e`, charcoal `#36454f`, olive `#5e6b1f`, tobacco `#8c6a2f`, lake teal `#2c6a62`, party blue `#1f5c7a`.

## A place

```ts
{ id: 'gagnons-island', name: 'Gagnon’s Island', at: [-89.6598, 47.9529], zoom: 12.5,
  note: 'Off Hat Point at the mouth of Grand Portage Bay. Mapped today as Grand Portage Island; most likely the island Olson means.' }
```

Find coordinates with `npm run tiles -- names <w,s,e,n> "<regex>"`. If the book's name isn't in OpenStreetMap (old names often aren't), use `islands`, nearby names and the book's description to find the most likely spot, and say in the note that the identification is likely rather than certain. Zoom: about 12–13 for an island or point, 9–10 for a lake, 5–6 for a great lake.

## A quote

```ts
{ text: 'I went along to iron out the wrinkles in my soul.', by: '[[solandt|Omond Solandt]]' }
{ text: 'Said one of these men, long past 70 years of age: “I could carry, paddle…”', about: 'voyageurs' }
```

Word for word. Inner quotes become “ ”, apostrophes ’. Don't correct anything; ask about a likely typo instead.

## A landmark

```ts
{ name: 'Stanley Mission', at: [-104.55, 55.42], icon: 'square', note: '[[anglicans|Holy Trinity Church]], built 1854–60…' }
```

`end: true` for the journey's two ends (always labelled). Others show from zoom 4.5. If a landmark's name matches a route waypoint, the waypoint's duplicate marker is hidden automatically.

## Fact-check agent prompt (for batches)

Spawn a general-purpose agent in the background with a prompt shaped like this, then draft while it runs:

> I'm building a reading-companion map for <Author>'s "<Title>" (<year>), about <one line>. Chapter <N> mentions: <list>. For each I'll write one or two paragraphs and draw an overlay (sites, an approximate territory, or a route). I need a verified fact sheet so I don't put errors in front of the reader. Use web search and fetch; prefer authoritative sources (Dictionary of Canadian Biography, The Canadian Encyclopedia, Encyclopedia of Saskatchewan, Parks Canada, nations' own sites).
> Verify or correct each claim below, and fill the gaps: <your draft claims per item, with dates and places>.
> Give coordinates as [lon, lat] to 2 decimals for each site. Return a compact fact sheet by item, in bullets, under 1,800 words, marking each fact verified (with a short source name) or uncertain. List corrections to my claims first. Don't write any files.

Put your own draft claims in the prompt: the agent is much better at checking specific statements than at open-ended research, and the corrections are what you need.

## Pictures

```ts
images: [{ file: 'Sir George Simpson, 1850.jpg', caption: 'Sir George Simpson, photographed by William Notman, about 1857', portrait: true }]
image: { file: 'Grand Portage National Monument stockade.jpg', caption: 'The reconstructed stockade and Great Hall at Grand Portage' }
image: { file: 'basswood-1998.jpg', own: true, caption: 'Basswood Lake, 1998' }
```

`file` is the Wikimedia file name without "File:". Run `npm run images` after adding any. The credit and licence come from Wikimedia; the caption is yours, so write it from what you verified (subject, date, artist and title for artworks).

### Picture-finding agent prompt

> I'm adding pictures to a personal reading-companion map for <Author>'s "<Title>" (<one line>). I need freely licensed images from Wikimedia Commons, each checked to really show what it claims, so I never put a wrong portrait or mislabelled place in front of the reader. Please find 0–3 images for each target: <targets with concept ids>. Search Commons through its API (list=search, srnamespace=6; prop=imageinfo with iiprop=url|extmetadata|size), sending a User-Agent header. Rules: only public domain, CC0, CC BY or CC BY-SA; check that the description, source institution and date agree with the target, and reject anything doubtful; for peoples, prefer documented historical photographs or artworks with named subjects, places, artists and titles, and return nothing rather than something generic or staged. Write JSON to <scratchpad>/images-plan.json as an array of { target: "concept:<id>" | "place:<id>" | "site:<concept id>/<site name>" | "landmark:<name>" | "waypoint:<name>", file, wiki: "commons" | "en", caption, portrait?, verified }. Report counts per target, the targets with none, and anything you rejected that I might be tempted to use.
