# CLAUDE.md

Operating guide for Claude Code (claude.ai/code) and any agent working in
this repo. **Read this first every session.** It is the day-to-day "how";
the companion docs below own the deeper detail.

> **Source-of-truth map** — which doc is authoritative for what:
> - **CLAUDE.md** *(this file)* — operating guide: commands, conventions, do/don't, gotchas
> - **PROJECT_CONTEXT.md** — the *why* + current state + known issues / tech debt
> - **ARCHITECTURE.md** — the *technical shape*: structure, data flow, build/deploy
> - **TRENDING_METHODOLOGY.md** — the *data spec*: sourcing, scoring, the v2.1 JSON schema (authoritative for the schema)
> - **UX_PRINCIPLES.md** — *design*: voice, vibe taxonomy, card/page anatomy
> - **PIPELINE_BUILD.md** — the *pipeline plan*: salvage-and-evolve phases
> - **COLLABORATION_NOTES.md** — how to work with Mike
>
> At the start of any **city/data or pipeline** task, also read
> TRENDING_METHODOLOGY.md. For any **visual/voice/component** task, also read
> UX_PRINCIPLES.md.

---

## The one-minute orientation

- **One live site.** An Eleventy (11ty) static site in
  `city-generator/trendy/`, built by **Vercel**, served at **trndie.co**.
- **The data is JSON.** Repo-root `data/ranked_<slug>.json` (v2.1 schema) is
  what the site renders. No backend, no database.
- **The renderer is `city-v2.njk`.** It paginates the `rankedCities` global
  (loaded from `data/` by `src/_data/rankedCities.js`) into `/{slug}/` pages.
- **Deploy = push to `main`.** Vercel auto-builds from `vercel.json`. There
  is no active GitHub Pages deploy.
- A previous root-`src/` second site (GitHub Pages) has been
  **decommissioned** — it no longer exists. Older docs that mention "two
  synced sites" are stale (see PROJECT_CONTEXT "Known issues").

For the full map, data flow, and deploy chain, read **ARCHITECTURE.md**.

---

## Commands

All build/serve/pipeline commands run from **`city-generator/trendy/`**
(that's where `package.json` lives). There is no root-level npm project.

```bash
cd city-generator/trendy
npm install                              # first time / fresh container

npm run build                            # Eleventy build → _site/  (verifies full render path)
npm run serve                            # local dev server + live reload

# Pipeline (Phase 1 "bridge" — deterministic, NO external network calls):
npm run update-trends                    # all cities: read → score (inertia-only) → write data/ranked_*.json
npm run update-trends -- --city sydney   # single city
npm run update-trends -- --dry-run       # report changes, write nothing  (alias: npm run update-trends:dry)
```

Verified working on Node 20+ (container has v22). The build emits one page
per **published** city (Newcastle is hidden) plus `/` and `/venues/`.

**No mock mode / no API keys needed today.** Phase 1 carries
`composite_score` forward unchanged and makes no external calls. The TikTok
(Apify) and Google Trends fetchers (`scripts/lib/fetchers.js`,
`extractor.js`) are intentionally **not imported** by the current pipeline.
External sources arrive in Pipeline Phases 2–5 (see PIPELINE_BUILD.md).

---

## Directory map (essentials)

```
data/ranked_*.json                     LIVE DATA (v2.1). Edit here to change the site.
config/vibe_tags.json                  canonical vibe-tag vocabulary (single source of truth)
vercel.json                            Vercel build config (builds the trendy site)
.github/workflows/update-trends.yml    weekly pipeline runner (cron PAUSED; manual only; see gotcha below)

city-generator/trendy/
  .eleventy.js                         Eleventy config: filters, passthrough, dirs
  package.json                         build + pipeline scripts
  scripts/update-trends.js             pipeline orchestrator (Phase 1 bridge)
  scripts/lib/cityData.js              I/O → repo-root data/ranked_*.json
  scripts/lib/scorer.js                Phase 1 inertia-only scoring
  scripts/lib/{fetchers,extractor}.js  TikTok/Trends — SET ASIDE (not imported)
  src/_data/rankedCities.js            loads data/ → `rankedCities` global  (LIVE)
  src/_data/site.json                  GA id, email, newsletter url
  src/index.njk / city-v2.njk / venues.njk   the three live templates
  src/_includes/base.njk               master layout
  src/css/  src/js/                    static assets (passthrough)
```

RETIRED (deleted in the legacy-cleanup pass): `src/city.njk`,
`src/_data/cities.js`, `src/_data/cityData/*.json`,
`.claude/commands/migrate-city.md`.

DEAD/ORPHANED (present, unused — documented in PROJECT_CONTEXT, do not rely
on them): `src/_includes/venue-links.njk`, `src/js/filter.js` (now fully
orphaned — only `city.njk` used them), the `uniqueBy` filter in `.eleventy.js`
(now unused), `city-generator/trendy/.github/workflows/deploy.yml`,
`city-generator/template.html`.

---

## v2.1 data schema (the only schema)

`TRENDING_METHODOLOGY.md` Stage 7 is authoritative. In brief:

```jsonc
{
  "city": "Melbourne",
  "tier": 1,
  "last_updated": "2026-05-18T06:00:00+10:00",
  "next_update":  "2026-05-21T06:00:00+10:00",
  "methodology_version": "2.1",
  "published": false,              // OMIT to publish; "published": false hides the city
  "venues": [
    {
      "rank": 1,
      "venue_name": "Groove",
      "suburb": "Abbotsford",
      "canonical_address": "17 Lithgow St, Abbotsford VIC 3067",
      "lat": null, "lng": null, "rating": null,
      "composite_score": 0.9,      // 0–1, backend ordering ONLY — never rendered
      "first_discovered": "2026-03-19",
      "newness_boost_applied": false,
      "trends_unavailable": false,
      "cover_photo_url": null,
      "trending_copy": "Two sentences, in voice.",
      "vibe_tags": ["Vietnamese-Coded", "Matcha-Pilled"],   // labels from config/vibe_tags.json
      "must_try": "Salted cream coffee, ...",                // NO prices / $ symbols
      "google_place_id": null,
      "source_urls": []            // attribution: [{ "source": "...", "tier": 1, "url": "..." }]
    }
  ]
}
```

> Note: this is **not** the old v2.0 `cityData` shape (`name`/`slug`/`vibe`/
> `ranking_score` 0–10/`viral`). That schema's store
> (`src/_data/cityData/*.json`) has been deleted in the legacy cleanup.

---

## Conventions & rules

**Do**
- Treat `data/ranked_*.json` as the live database. Edit a city there (or run
  the pipeline), then `npm run build` to verify.
- Add any new vibe tag to `config/vibe_tags.json` **before** using its label
  in a venue's `vibe_tags`. Unknown labels get a slugified fallback value.
- Keep `composite_score` in JSON only; it orders cards, it is never shown.
- Write `trending_copy` in TRNDIE voice: exactly 2 sentences, wry, lightly
  Australian, particulars over adjectives. Honour the banned-phrase list in
  UX_PRINCIPLES.md.
- Strip all prices from `must_try` (no `$`).
- Match the existing JSON house style (2-space indent; primitive arrays kept
  inline) — the pipeline writer (`lib/cityData.js`) already does this, so
  no-op runs stay byte-clean.
- For pipeline (backend) changes: human review every time — never auto-merge.

**Don't**
- Don't render scores, rank numbers, or star ratings on cards (UX_PRINCIPLES
  "Forbidden on cards").
- Don't add a city by editing templates — add a `data/ranked_<slug>.json`
  and a tagline entry in `rankedCities.js` `TAGLINES`.
- Don't introduce TikTok/IG as a core dependency (accessibility + ToS — see
  PIPELINE_BUILD.md). Editorial-first.

---

## Common mistakes specific to this repo

- **Wrong working dir.** npm commands fail from repo root — there's no root
  `package.json`. `cd city-generator/trendy` first.
- **Expecting a root `src/`.** It was decommissioned. The site lives under
  `city-generator/trendy/src/`.
- **Trusting the weekly workflow to publish.** `.github/workflows/update-trends.yml`
  still stages the **old** `city-generator/trendy/src/_data/cityData/` path,
  not `data/` — and that path no longer exists (deleted in the legacy
  cleanup), so a manual `workflow_dispatch` run now errors at `git add`. Its
  cron is paused. Don't rely on it until Phase 5 rewires it. (PROJECT_CONTEXT
  "Known issues.")
- **Assuming a city is published.** `rankedCities.js` drops any city with
  `"published": false`. Newcastle is currently hidden.
- **`city-v2.njk` is the renderer.** It is the sole `/{slug}/` renderer; the
  legacy `city.njk` has been retired.

---

## Environment / setup

- **Node 20+** (CI uses 20; container has 22). `npm install` in
  `city-generator/trendy`.
- **No secrets required** for build or the Phase 1 pipeline. Future phases
  will need `MAPBOX_TOKEN`, `TOMTOM_KEY`, `GOOGLE_PLACES_API_KEY`,
  `ANTHROPIC_API_KEY`, optionally `APIFY_TOKEN` (TRENDING_METHODOLOGY.md
  "Environment Variables").
- **Global config** lives in `src/_data/site.json` (GA id, contact email,
  newsletter URL).

---

## Deploy flow

1. Edit `data/ranked_*.json` and/or templates under `city-generator/trendy/src/`.
2. `npm run build` locally to confirm it renders.
3. Commit and push to `main`. **Vercel auto-deploys** from `vercel.json`
   (`cd city-generator/trendy && npm install && npm run build`, output
   `city-generator/trendy/_site`).

No manual index-page wiring is needed — `index.njk` and `venues.njk`
enumerate cities/venues from `rankedCities` automatically. Adding a
`data/ranked_<slug>.json` (published) makes the city appear on the home grid,
the All Venues page, and its own `/{slug}/` page on the next build.

---

## Cafe / venue selection criteria

Per the editorial-first methodology (TRENDING_METHODOLOGY.md):
- Editorial coverage is the primary, fraud-resistant signal (Broadsheet,
  Timeout, Good Food, etc.).
- Google Trends + Places (rating/reviews/geo) are supporting signals.
- Recent buzz over historical popularity.
- Attribution is first-class — capture who surfaced a venue into `source_urls`.

(TikTok/IG virality is **optional-future** enrichment, not a core source.)

---

## Cities

8 cities live on v2.1 (7 published; Newcastle hidden until it has more venues).

| City | Tier | Status |
|---|---|---|
| Sydney | 1 | Live |
| Melbourne | 1 | Live |
| Brisbane | 2 | Live |
| Perth | 2 | Live |
| Adelaide | 2 | Live |
| Gold Coast | 2 | Live (thin — 2 venues; see PROJECT_CONTEXT) |
| Canberra | 3 | Live |
| Newcastle | 3 | Hidden (`published:false`, 2 venues) |
| Wollongong | 3 | Next (not yet created) |

---

## References

- Live site: **trndie.co** (Vercel; DNS via Squarespace)
- Repo: `github.com/safmike/trndie`
