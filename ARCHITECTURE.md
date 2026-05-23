# TRNDIE — Architecture

**Status:** Authoritative for the **technical shape** of the repo — the map a
fresh agent or developer reads to orient before touching code.
**Last updated:** 2026-05-23 (verified against the live repo)

> **Source-of-truth map** (which doc owns what):
> - **PROJECT_CONTEXT.md** — the *why* and current state (vision, decisions, tech debt)
> - **ARCHITECTURE.md** *(this file)* — the *technical shape* (structure, data flow, deploy)
> - **CLAUDE.md** — the *operating guide* (read first every session; commands, conventions, do/don't)
> - **TRENDING_METHODOLOGY.md** — the *data spec* (sourcing, scoring, the v2.1 JSON schema — authoritative for the schema)
> - **UX_PRINCIPLES.md** — *design* (voice, vibe taxonomy, card/page anatomy)
> - **PIPELINE_BUILD.md** — the *pipeline plan* (salvage-and-evolve phases)
> - **COLLABORATION_NOTES.md** — how to work with Mike

This file is orientation, not duplication. Where another doc owns the detail,
this file points to it.

---

## TL;DR — the one-site reality

There is **one** live site. It is an [Eleventy](https://www.11ty.dev/)
(11ty) static site in `city-generator/trendy/`, built by **Vercel** and
served at **trndie.co**.

A previous "dual-site" arrangement (a second Eleventy site at repo-root
`src/` deploying to GitHub Pages) has been **decommissioned**. There is no
root `src/` anymore, and the GitHub Pages deploy no longer runs. If you read
an older description of two synced sites, it is stale — see PROJECT_CONTEXT
"Known issues."

The data the site renders lives at **repo-root `data/ranked_*.json`** (v2.1
schema). The pipeline that maintains those files lives in
`city-generator/trendy/scripts/`.

---

## Repository map

```
trndie/
├── data/                              # ← LIVE DATA (v2.1). One file per city.
│   ├── ranked_adelaide.json
│   ├── ranked_brisbane.json
│   ├── ranked_canberra.json
│   ├── ranked_goldcoast.json
│   ├── ranked_melbourne.json
│   ├── ranked_newcastle.json          #   published:false (hidden)
│   ├── ranked_perth.json
│   └── ranked_sydney.json
│
├── config/
│   └── vibe_tags.json                 # canonical vibe-tag vocabulary (single source of truth)
│
├── .github/workflows/
│   └── update-trends.yml              # weekly pipeline runner (cron PAUSED; manual only)
│
├── .claude/commands/
│   └── migrate-city.md                # /migrate-city slash command (VESTIGIAL — all cities migrated)
│
├── vercel.json                        # Vercel build config → builds the trendy site
│
├── city-generator/
│   ├── template.html                  # pre-Eleventy standalone mock (VESTIGIAL, unused)
│   └── trendy/                        # ← THE LIVE SITE (Eleventy)
│       ├── .eleventy.js               # Eleventy config: filters, passthrough, dirs
│       ├── package.json               # build + pipeline npm scripts
│       ├── .github/workflows/
│       │   └── deploy.yml             # GitHub Pages build — DEAD (nested dir never runs)
│       ├── scripts/                   # ← THE PIPELINE
│       │   ├── update-trends.js       #   orchestrator (Phase 1 bridge: read→score→write)
│       │   └── lib/
│       │       ├── cityData.js        #   I/O layer → repo-root data/ranked_*.json
│       │       ├── scorer.js          #   Phase 1: inertia-only (carry composite_score forward)
│       │       ├── fetchers.js        #   TikTok(Apify) + Google Trends — SET ASIDE (not imported)
│       │       └── extractor.js       #   TikTok name extraction — SET ASIDE
│       └── src/                       # ← ELEVENTY INPUT
│           ├── _data/
│           │   ├── rankedCities.js    #   LOADS data/ranked_*.json → `rankedCities` global  (LIVE)
│           │   ├── cities.js          #   legacy loader for cityData/ — excludes all 8 (returns []) (DEAD)
│           │   ├── cityData/*.json    #   v2.0 store — ORPHANED (nothing reads it)
│           │   └── site.json          #   global config (GA id, email, newsletter url)
│           ├── _includes/
│           │   ├── base.njk           #   master layout (GA, fonts, stylesheet hooks)
│           │   └── venue-links.njk    #   legacy partial (used only by city.njk) (DEAD)
│           ├── index.njk              #   home page (city grid + Trending Now)        (LIVE)
│           ├── city-v2.njk            #   city detail renderer → /{slug}/             (LIVE)
│           ├── venues.njk             #   "All venues" page → /venues/                (LIVE)
│           ├── city.njk               #   legacy city renderer (emits 0 pages)        (DEAD)
│           ├── css/   (style.css, city-v2.css)
│           └── js/    (home.js, venues.js, city-v2.js, filter.js[legacy])
│
├── CLAUDE.md  PROJECT_CONTEXT.md  ARCHITECTURE.md
├── TRENDING_METHODOLOGY.md  UX_PRINCIPLES.md  PIPELINE_BUILD.md  COLLABORATION_NOTES.md
```

LIVE = on the rendered path. DEAD/ORPHANED/VESTIGIAL = present but unused;
documented as tech debt in PROJECT_CONTEXT.md, not cleaned up here.

---

## Tech stack

- **Static site generator:** Eleventy v3 (`@11ty/eleventy`), Nunjucks (`.njk`) templates.
- **Pipeline:** Node.js (no build step; plain CommonJS). Deps: `google-trends-api`,
  `apify-client` (both only used by the set-aside fetchers, not by the live Phase 1 path).
- **Hosting/CDN:** Vercel.
- **Domain/DNS:** trndie.co, registered via Squarespace, DNS pointed at Vercel.
- **Analytics:** Google Analytics (gtag), id in `src/_data/site.json` (`gaId`).
- **No backend, no database.** The "database" is the set of JSON files in `data/`.

---

## Data flow (the core path)

```
data/ranked_<slug>.json   (v2.1, one per city; source of truth for the site)
        │
        ▼
src/_data/rankedCities.js  (Eleventy global data file)
        │   • reads every data/ranked_*.json
        │   • drops any city with "published": false   (→ Newcastle hidden)
        │   • derives name / slug / tagline / lastUpdatedDisplay
        │   • loads config/vibe_tags.json and maps each venue's
        │     vibe_tags labels → {value,label}  (vibe_tag_objs)
        ▼
   `rankedCities`  (global, available to all templates)
        │
        ├─► city-v2.njk   pagination over rankedCities (size 1) → /{city.slug}/   (one page per city)
        │
        ├─► index.njk     city grid + `rankedCities | trendingData` → window.TRNDIE_TRENDING → js/home.js
        │
        └─► venues.njk    `rankedCities | allVenuesFlat` (flatten + sort by composite_score) → /venues/ → js/venues.js
```

Key Eleventy filters (defined in `.eleventy.js`):
- `trendingData` — serialises the top-3 venues per city to JSON for the homepage "Trending Now" rotator.
- `allVenuesFlat` — flattens all cities' venues into one array annotated with `cityName`/`citySlug`, sorted by `composite_score` desc.
- `flatVenues`, `uniqueBy` — helpers (the latter used by the legacy `city.njk` only).

**Important contract:** templates read v2.1 field names (`venue_name`,
`suburb`, `composite_score`, `trending_copy`, `vibe_tags`, `must_try`,
`cover_photo_url`, `source_urls`). `composite_score` is used only for
ordering — it is **never rendered** (see UX_PRINCIPLES "no visible scores").

---

## v2.1 data shape

`TRENDING_METHODOLOGY.md` Stage 7 is **authoritative** for the schema. Quick
orientation only:

- **City object:** `city`, `tier`, `last_updated`, `next_update`,
  `methodology_version`, optional `published` (omit = published; `false` = hidden), `venues[]`.
- **Venue object:** `rank`, `venue_name`, `suburb`, `canonical_address`,
  `lat`/`lng`, `rating`, `composite_score` (0–1), `first_discovered`,
  `newness_boost_applied`, `trends_unavailable`, `cover_photo_url`,
  `trending_copy` (2 sentences, in voice), `vibe_tags` (labels from
  `config/vibe_tags.json`), `must_try` (no prices), `google_place_id`,
  `source_urls[]` (attribution — the collaboration principle).

Most venues currently have `lat/lng/rating/google_place_id = null` and
`cover_photo_url = null` and `source_urls = []` — those fields fill in as
Pipeline Phases 3–5 land.

---

## Build & deploy chain

```
git push → main (github.com/safmike/trndie)
        │
        ▼
Vercel (configured by vercel.json)
   buildCommand:  cd city-generator/trendy && npm install && npm run build
   outputDir:     city-generator/trendy/_site
        │   (npm run build = `eleventy`; Eleventy input=src, output=_site)
        ▼
trndie.co   (Squarespace-registered domain, DNS → Vercel; auto-deploys on push)
```

There is **no** active GitHub Pages deployment. The `deploy.yml` inside
`city-generator/trendy/.github/workflows/` is dead weight: GitHub Actions
only executes workflows under the **repo-root** `.github/workflows/`, so a
nested one never runs.

---

## The pipeline (current: Phase 1 — "the Bridge")

`PIPELINE_BUILD.md` is authoritative for the plan. What exists **today**:

```
npm run update-trends            (city-generator/trendy)
        │  scripts/update-trends.js  — orchestrator
        ▼
listCities() ─► for each city:  readCity() ─► scoreVenue()/rankVenues() ─► writeCity()
   (lib/cityData.js)              (lib/cityData.js)   (lib/scorer.js)        (lib/cityData.js)
        │                                                                        │
        └───────────────── all I/O targets repo-root data/ranked_*.json ────────┘
```

- **Phase 1 is a deliberate near-no-op.** `scorer.js` carries
  `composite_score` forward unchanged and re-derives `rank`; no randomness,
  **no external network calls**. The TikTok/Trends fetchers
  (`fetchers.js`, `extractor.js`) are intentionally **not imported**, so the
  pipeline cannot make an external call in this phase.
- Commands: `npm run update-trends` (all cities), `... -- --city <slug>`,
  `... -- --dry-run` (or the `update-trends:dry` script). It writes JSON in
  the house style (2-space indent, inline primitive arrays) to keep no-op
  runs byte-clean.
- **Phases 2–5** (editorial signal + attribution, Trends/Places/geo,
  Claude synthesis, orchestration + "what's new") are not started. See
  PIPELINE_BUILD.md for the sequence and the target `lib/sources/` layout.

> **Pipeline caveat (verified):** the weekly workflow
> `.github/workflows/update-trends.yml` still commits the **old**
> `city-generator/trendy/src/_data/cityData/` path, not `data/`. So a manual
> run writes the new files but commits nothing useful. Treat the workflow as
> not-yet-wired for publishing until Phase 5. (PROJECT_CONTEXT "Known issues.")

---

## Eleventy specifics worth knowing

- Config dirs (`.eleventy.js`): `input: src`, `output: _site`,
  `includes: _includes`, `data: _data`.
- `eleventyConfig.addPassthroughCopy("src/css")` and `"src/js"` copy static
  assets verbatim.
- Global data files in `src/_data/` are auto-exposed by filename:
  `rankedCities.js` → `rankedCities`, `site.json` → `site`, `cities.js` →
  `cities` (empty, legacy).
- `city-v2.njk` and the dead `city.njk` both declare
  `permalink: "/{{ city.slug }}/"`. There is no collision **only because**
  `cities.js` returns an empty array, so `city.njk` paginates over nothing.
  If you ever re-populate `cities`, the two will fight for the same URLs.

---

## Legacy / orphaned layer (documented, not removed here)

Retained but off the live path — full detail in PROJECT_CONTEXT.md "Known
issues / tech debt":

| Artifact | Why it's dead | Disposition |
|---|---|---|
| `src/_data/cityData/*.json` | v2.0 store; `cities.js` excludes all 8 | delete (separate task) |
| `src/_data/cities.js` | excludes every city → empty collection | retire with city.njk |
| `src/city.njk` | paginates empty `cities` → 0 pages | retire |
| `src/_includes/venue-links.njk`, `src/js/filter.js` | only used by `city.njk` | retire with city.njk |
| `.claude/commands/migrate-city.md` | all cities migrated; edits frozen routing | repurpose/remove |
| `city-generator/trendy/.github/workflows/deploy.yml` | nested → never runs; Pages decommissioned | delete |
| `city-generator/template.html` | pre-Eleventy mock; unused | delete |

---

## Newcomer quickstart

```bash
cd city-generator/trendy
npm install
npm run build          # → _site/  (verifies the whole render path)
npm run serve          # local dev with live reload

# pipeline (safe, no network in Phase 1):
npm run update-trends -- --dry-run     # show what would change, write nothing
npm run update-trends -- --city sydney # one city
```

To change what the site shows, edit `data/ranked_<slug>.json` (or run the
pipeline) and rebuild. To add a vibe tag, add it to `config/vibe_tags.json`
**before** using it in a venue's `vibe_tags`.

---
*Technical shape only. For why it's built this way, read PROJECT_CONTEXT.md;
for how to operate day-to-day, read CLAUDE.md.*
