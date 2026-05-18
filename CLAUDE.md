# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Root site (src/)
```bash
npm run build        # builds to _site/
npm run serve        # builds + live-reload dev server
```

### Trend updater (city-generator/trendy/)
```bash
cd city-generator/trendy
npm run update-trends                        # mock mode (no API calls)
npm run update-trends -- --city sydney       # single city, mock mode
TRENDS_MOCK=false npm run update-trends      # live mode (requires APIFY_TOKEN)
npm run build                                # rebuild site after trend update
```
Trending methodology: All cafe sourcing, scoring, and ranking logic is defined in TRENDING_METHODOLOGY.md. Read that file at the start of any city-generation or pipeline task.

UX & design brief: All visual and editorial decisions follow UX_PRINCIPLES.md. Read at the start of any city-generation, refinement, or component task.

## Architecture

### Dual-site layout

There are **two Eleventy sites** in this repo:

| Directory | Used by | Purpose |
|---|---|---|
| `src/` | GitHub Actions deploy.yml → GitHub Pages | Canonical source |
| `city-generator/trendy/src/` | Vercel (`vercel.json`) | Production deployment |

**Vercel is the live site.** `city-generator/trendy/` is the authoritative site for production. The root `src/` is a mirror — changes to templates and city JSON must be kept in sync. The city JSON files in `city-generator/trendy/src/_data/cityData/` are the ones the weekly trend updater writes to.

### Site structure (city-generator/trendy/src/)

- `_data/cityData/*.json` — one JSON file per city; the trend updater reads/writes these
- `_data/cities.js` — auto-loads all city JSONs into the `cities` collection
- `_data/site.json` — global config (GA ID, email, newsletter URL)
- `_includes/base.njk` — master layout (GA, fonts, CSS)
- `index.njk` — home page, city grid
- `city.njk` — paginated city detail pages (one page per city slug)
- `css/style.css`, `js/filter.js` — static assets (passed through by Eleventy)

### City JSON schema

```json
{
  "name": "Sydney",
  "slug": "sydney",
  "state": "NSW",
  "country": "AU",
  "icon": "🌊",
  "updatedAt": "January 2026",
  "filters": {
    "areas": [{ "value": "CBD", "label": "CBD & Surry Hills" }],
    "vibes": [{ "value": "aesthetic", "label": "Aesthetic" }]
  },
  "venues": [{
    "name": "Up South",
    "location": "Bondi Beach",
    "area": "Bondi",
    "vibe": "aesthetic",
    "viral": true,
    "description": "...",
    "mustTry": "...",
    "tags": ["TikTok Legend"],
    "ranking_score": 8.2,
    "trend_signals": { ... }
  }]
}
```

`area` and `vibe` must match a `value` in the city's `filters` object for the client-side filter (`js/filter.js`) to work. `viral: true` renders a red badge.

### Trend update engine (city-generator/trendy/scripts/)

**MOCK MODE** (default, `TRENDS_MOCK` unset or `true`): re-scores existing venues with seeded-random signals. No external calls. Safe for local dev and CI.

**LIVE MODE** (`TRENDS_MOCK=false`, requires `APIFY_TOKEN` secret): full discovery pipeline — TikTok via Apify → extract candidate venue names → validate with Google Trends → merge with retained existing venues → score → keep top 10.

Retention policy constants in `update-trends.js`:
- `RETENTION_MIN_SCORE = 4.0` — venues below this are dropped even if not rediscovered
- `MAX_RETAINED = 5` — at most 5 carry-forward venues; ensures ≥5 spots come from live discovery

New venues discovered by the engine get empty `description`, `mustTry`, and `tags` — these must be hand-curated once a venue proves persistent across multiple weekly runs.

### Automation

Weekly GitHub Actions workflow (`.github/workflows/update-trends.yml`) runs every Monday 9am AEST. It runs the trend updater, commits changed city JSONs with `[skip ci]` in the message, and pushes. Can be triggered manually with optional `--city` and `--category` filters.

Deployment workflow (`.github/workflows/deploy.yml`) builds from root `src/` to GitHub Pages on every push to `main`.

## Workflow & Conventions

### Deploy flow

1. Edit files locally
2. `git add` **both** the new/changed page file **and** `index.html` (or whichever index links to it)
3. Commit and push — Vercel auto-deploys from `city-generator/trendy/`

**Critical:** omitting `index.html` from the commit makes a new page unreachable at deploy time even though the page file itself deployed correctly. Always stage both together.

### Cafe / venue selection criteria

- TikTok or Instagram-verifiable virality (tagged posts, reels, hauls)
- Recent buzz — not just historically popular
- Notable follower counts or engagement on venue-specific content

### Vibe filters

Filters are city-specific but draw from a recurring tag vocabulary:

`Matcha Lovers` · `Asian Fusion` · `Bakery` · `Instagram-Worthy` · `Toastie Heaven` · `Aesthetic` · `Korean` · `Waterfront` · `Brunch` · `Late Night`

Add new vibe values to a city's `filters.vibes` array before assigning them to venues.

### Cities

| # | City | Status |
|---|---|---|
| 1 | Sydney | Done |
| 2 | Melbourne | Done |
| 3 | Brisbane | Done |
| 4 | Perth | Done |
| 5 | Adelaide | Done |
| 6 | Gold Coast | Done |
| 7 | Canberra | Done |
| 8 | Newcastle | Done |
| 9 | Wollongong | Next |

### References

- Live site: `trendy-vivid.vercel.app`
- Repo: `github.com/safmike/trndie`
