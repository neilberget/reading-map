# reading-map

A Claude Code skill for building interactive reading-companion maps: a local MapLibre map beside a chapter-by-chapter panel of linked concepts, places, quotes and landmarks, with the book's journey traced on real lakes and rivers. The reference build is *The Lonely Land* (Sigurd F. Olson), the 1955 canoe trip from Île-à-la-Crosse to Cumberland House.

## Install

Clone it into your skills folder. You'll also need Node 22 or later.

```bash
git clone https://github.com/neilberget/reading-map.git ~/.claude/skills/reading-map
```

## Start a book

In Claude Code, from the folder where you keep projects:

> Make a reading map for The Lonely Land by Sigurd Olson

Claude works out the setting and the journey, scaffolds a project from `template/`, marks the start and end, and starts the dev server. Tracing the route runs in the background, so you can start reading straight away.

## While you read

Send things as you meet them, in as few words as you like. Claude decides what each one becomes, checks the facts, links it to everything related, and puts it on the map. Reload to see it.

**Concepts** are peoples, institutions, people, routes and events. Each gets a paragraph or two of context and a map overlay: a homeland, a territory, a set of sites or a route.

> Some more from the introduction: North West Company, Hudson's Bay Company, George Simpson, Simon McGillivray

> The author mentions the La Vérendrye route from Grand Portage to Fort Frances. Can you add it as a concept?

**People in the story** get a concept each, plus a hub that links them:

> Trip members would be great. Sigurd gave each a beautiful paragraph.

**Places** are minor spots you just want to find on the map: an island, a point, a lake. Clicking one flies the map there.

> Gagnon's Island (with Hat Point) off Grand Portage Bay. No need for an expanded concept, just a minor landmark I can click to see where it is.

> Great Slave Lake

**Quotes** go in word for word, under the chapter:

> Intro quote by Omond Solandt: "I went along to iron out the wrinkles in my soul."

**Landmarks** stay on the map at every zoom, so you can find your bearings:

> Always show Île-à-la-Crosse and Cumberland House

**Chapters** are added as you reach them, along with an introduction, prologue or epilogue if the book has one. Claude asks for a chapter's title rather than guessing:

> Chapter 1 is called "Île-à-la-Crosse"

**Pictures** come from Wikimedia Commons, checked to show what they claim, with credits:

> Can we add photos of the people and places?

## What it's like

- Concepts link to each other wiki-style, and each lists what links to it.
- A satellite button swaps in aerial imagery.
- Clicking the book's title zooms back out to the whole route.
- Everything runs locally at `npm run dev`. Nothing is deployed.

To show someone the map for a while, ask Claude to share it with ngrok. It builds the map and opens a temporary public link.

## What's in here

- `SKILL.md`: the workflow Claude follows.
- `references/`: how to write content and trace journeys.
- `template/`: the app each new book starts from (Vite, TypeScript, MapLibre, OpenFreeMap tiles).
