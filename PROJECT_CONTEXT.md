# TRNDIE — Project Context & Handoff

**Status:** Authoritative source for the project's vision, decisions, and
reasoning (the "why").
**Live:** trndie.co — domain registered via Squarespace (DNS → Vercel),
published by Vercel from this repo (auto-deploys on push to main).
**Companion docs:** CLAUDE.md (operating guide), ARCHITECTURE.md (technical
shape), TRENDING_METHODOLOGY.md (data spec), UX_PRINCIPLES.md (design),
PIPELINE_BUILD.md (pipeline plan).
**Last updated:** 2026-05-22

---

## What TRNDIE is
A taste-driven discovery magazine for trending Australian cafes. It
surfaces what's worth knowing, organised by city, with editorial voice and
a browsable, modern feel, refreshed twice weekly so it feels live.
"Trending" is the hook; the substance is curation and judgment —
aggregating what credible sources are already surfacing, in one place,
with a voice nobody else has.

## Why it exists (the origin)
Born from a real frustration: social media serves food content one video
at a time — enjoyable but narrow and time-expensive (the time compounds).
Broadsheet-style editorial is authentic but felt slow and too bespoke. The
gap: no single place that aggregates what's trending and just shows it to
you, live. TRNDIE is that place. One destination, see it all, fresh.

## The two answers that must cohere — product and sales
**Product:** a curated discovery magazine. Value = curation + voice +
browsable beauty + the in-the-know feeling. People come to discover and
enjoy the browse; they stay because they trust the taste.
**Sales:** a media/audience play. The defensible asset is trust in the
taste (brand + voice), NOT proprietary data. Monetisation (later) runs
standard media routes: tasteful partnerships, clearly-labelled
sponsorship, affiliate, possibly B2B trend digests for hospitality.
They cohere because both rest on trust in curation, not secret data — like
Eater, The Infatuation, or Broadsheet, none of which win on proprietary
feeds.

## The keystone principle: collective collaboration
TRNDIE amplifies the ecosystem rather than extracting from it — crediting
the sources and creators who surface venues, and driving traffic to the
cafes. This is the strategic centre, not a nicety:
- Crediting + driving traffic makes TRNDIE a friend to sources and
  creators, not a parasite — partnerships become natural, not adversarial.
- Being the trusted hub of a value-add ecosystem is monetisable without
  corruption.
- Social media extracts attention; TRNDIE gives back (traffic, credit,
  discovery).
Made concrete: attribution is first-class (source_urls; a "featured in /
spotted by" credit + a path to each cafe).

## Major strategic decisions and their reasoning
1. Editorial-first signal; TikTok demoted to optional-future. Three
   reasons at once: editorial is the hardest signal to game (fraud-
   resistance); TRNDIE has no reliable/legitimate access to TikTok data
   (accessibility); editorial aggregation IS the product (vision). Build
   on accessible sources: editorial (RSS/newsletter/manual), Google
   Trends, Google Places.
2. Curation integrity is sacred — no pay-to-play, ever. The ranked list is
   earned, never bought. If a cafe could pay to rank, the taste — the
   entire asset — erodes, and the ecosystem's trust with it.
3. Salvage-and-evolve the pipeline, don't rebuild. An existing pipeline
   (update-trends.js) already does discovery, trends, scoring, retention,
   scheduling — but was orphaned (wrote the old schema nothing reads).
   Reuse its infrastructure; rebuild the signal layer on accessible
   sources. See PIPELINE_BUILD.md.
4. v2.1 data + single renderer + single site. Migrated from v2.0
   (cityData/*.json, 0–10 scores on cards) to v2.1 (data/ranked_*.json,
   composite_score 0–1, scores backend-only). One renderer (city-v2.njk),
   one deployment (Vercel). The legacy GitHub Pages site was decommissioned.
5. No visible scores on cards. TRNDIE is a magazine, not a comparison
   utility. Position encodes ranking; numeric scores invited hover-
   comparison that cheapened curation. composite_score stays backend-only.
6. Inertia in scoring. Carried from the existing pipeline — keeps rankings
   stable run-to-run so the list doesn't thrash. A good idea the original
   methodology lacked; being folded into the reconciled model.

## Current state
Working / live (Vercel, trndie.co): 8 cities on v2.1, 7 published,
Newcastle hidden (2 venues, published:false); city-v2.njk renderer with
vibe filter, save/heart (localStorage), per-city palette; homepage
Trending Now + All Venues working; cycling slogans with keyword emphasis;
logo shimmer; scores removed from cards; Brisbane geocoding corrected;
legacy GitHub Pages site decommissioned.
In progress: Pipeline Phase 1 (the Bridge) — repointing the salvaged
pipeline to read/write data/ranked_*.json, inertia-only, no external deps.
Not started: Pipeline Phases 2–5 (editorial → trends+places+geo →
synthesis → orchestration).

## Known issues / tech debt / gotchas
*Verified against the live repo on 2026-05-23 (branch state after Phase 1
merged, PR #20). Each item below is confirmed against actual files unless
flagged otherwise. ARCHITECTURE.md "Tech debt map" mirrors this list with
file paths.*

- **Orphaned v2.0 data store — CONFIRMED, live now (not "once Phase 1
  lands").** Phase 1 has merged. `city-generator/trendy/src/_data/cityData/*.json`
  (8 files) are already orphaned: the only loader that reads them,
  `cities.js`, explicitly excludes all 8 by filename, so they feed nothing.
  The bridge writes the live data to repo-root `data/ranked_*.json`. Safe to
  delete the cityData directory (separate cleanup task — out of scope here).
- **Legacy renderer not retired — CONFIRMED.** `city-generator/trendy/src/city.njk`
  (paginates the `cities` collection) and its loader `cities.js` still exist.
  Because `cities.js` excludes every city, the `cities` collection is empty,
  so `city.njk` currently emits **zero** pages (verified via build output) —
  no permalink collision with `city-v2.njk`. It is dead weight, safe to
  retire. Also vestigial in the same file set: `_includes/venue-links.njk`,
  `js/filter.js`, `css/style.css`'s legacy-card rules, and `index.njk`'s
  reliance on `style.css` (kept — index/base still use it).
- **/migrate-city is vestigial — CONFIRMED.** `.claude/commands/migrate-city.md`
  migrates a city from v2.0 cityData → v2.1. All 8 cities are migrated and
  its Step 4 edits the now-frozen `cities.js`/`rankedCities.js` routing.
  Repurpose (e.g. an "add new city" command writing `data/ranked_*.json`
  directly) or remove.
- **Methodology ≠ code on scoring — CONFIRMED, with nuance.**
  TRENDING_METHODOLOGY v2.1 Stage 5 specifies editorial 45 / trends 30 /
  rating 15 / reviews 10 (no inertia). `scripts/lib/scorer.js` is Phase-1
  **inertia-only** — it carries `composite_score` forward unchanged and
  re-derives rank. So the live code is neither the methodology model nor the
  old build model; it is a deliberate near-no-op bridge. The reconciled
  model (editorial + inertia + trends + rating/reviews, TikTok dropped) is a
  TRENDING_METHODOLOGY v2.2 + Pipeline Phase 2–3 deliverable.
- **Stale Google Trends wrapper reference.** The methodology doc's code
  examples use `pytrends` (Python). The actual pipeline is **Node** and
  depends on `google-trends-api` (see `package.json`, used by
  `scripts/lib/fetchers.js`). Both are unofficial, equally fragile. The
  fetcher is currently **set aside** — not imported by the Phase 1
  `update-trends.js`, so no external Trends call happens today.
- **Weekly workflow commits the wrong path — CONFIRMED, real bug.**
  `.github/workflows/update-trends.yml` runs the bridge (which now writes
  `data/ranked_*.json`) but its commit step still stages the **old**
  `git add city-generator/trendy/src/_data/cityData/`. A manual
  `workflow_dispatch` run today would write the new files yet commit
  nothing. Its `TRENDS_MOCK`/`APIFY_TOKEN` env is also stale (Phase 1 makes
  no external calls). The cron schedule is intentionally commented out
  (paused). Phase 5 rebuilds this workflow — until then, do **not** rely on
  it to publish ranking changes.
- **Dead nested deploy workflow — CONFIRMED.**
  `city-generator/trendy/.github/workflows/deploy.yml` is a GitHub Pages
  build. GitHub Actions only runs workflows under the **repo-root**
  `.github/workflows/`, so this nested one never executes; GitHub Pages was
  also decommissioned. The live deploy path is **Vercel** (`vercel.json`).
  Vestigial file — safe to delete.
- **Newcastle hidden — CONFIRMED.** `data/ranked_newcastle.json` has
  `"published": false` and 2 venues; `rankedCities.js` filters out
  `published === false`. Unhide once it reaches the bar (target ≥8 venues).
- **Gold Coast is thin but published — NEEDS CONFIRMATION.**
  `data/ranked_goldcoast.json` has only **2** venues and no
  `published: false`, so it ships live with 2 cards. If the same ≥8 bar
  applied to Newcastle is intended, Gold Coast may want hiding too — confirm
  with Mike.
- **Gold Coast slug contains a space — minor.** `rankedCities.js` derives
  the slug as `city.toLowerCase()`, so "Gold Coast" → `gold coast`, building
  to `/gold coast/` (a URL with a space, served as `%20`). Works but ugly;
  consider a slug-safe transform in a future cleanup.
- **Stale CLAUDE.md dual-site description — being fixed in this PR.** The
  pre-handoff CLAUDE.md described a root `src/` Eleventy site deploying to
  GitHub Pages. That root `src/` no longer exists (decommissioned). CLAUDE.md
  is corrected as part of this documentation pass.
- **Sparse `config/`.** Only `config/vibe_tags.json` exists. The methodology
  references `config/cities.json`, `config/sources.json`,
  `config/city_suburbs.json` — none exist yet; they are Phase 2–3 future
  work. Don't assume they're present.
- **`config/vibe_tags.json` is the single source of truth for vibe tags.**
  `rankedCities.js` maps each venue's `vibe_tags` label → `{value,label}`
  via this file; an unknown label falls back to a slugified value. Add new
  tags here before assigning them in `data/ranked_*.json`.
- **Email domain mismatch — NEEDS CONFIRMATION.** `site.json` uses
  `hello@trndie.com` while the canonical domain is `trndie.co` (and
  `city-generator/template.html` uses `hello@trndie.co`). Confirm the
  correct address with Mike (not changed here — out of scope).
- **Vestigial standalone template.** `city-generator/template.html` is a
  pre-Eleventy standalone HTML mock; neither build uses it. Harmless legacy
  artifact.
- **Fragile external inputs (future phases).** Editorial scraping is
  ToS-grey and the Trends wrapper is unofficial — see the resilience plan in
  TRENDING_METHODOLOGY.md (prefer RSS / newsletter / partnership, manual
  fallback). Not active today (Phase 1 makes no external calls).

## Near-term roadmap
1. Finish Pipeline Phase 1 (bridge)
2. Pipeline Phases 2–5
3. TRENDING_METHODOLOGY v2.2 — geo-validation/suburb whitelist + the
   reconciled scoring STRUCTURE (editorial-first + inertia). Precise
   weights remain tunable as data sources stabilise (see Open questions).
4. Legacy cleanup (orphaned cityData, within-trendy legacy renderer,
   vestigial /migrate-city)
5. Deferred features once the pipeline is solid: cover photos, "from here,
   try also" cross-city rail, "what's new this week" diff surface
6. Future: more cities; eventually international (Australia is the proving
   ground)

## Open questions (deliberately unresolved — not gaps to fill)
These are intentionally fluid, not missing information to rush to resolve:
- Monetisation model and timeline. TBD and needs more thought, but
  deliberately deferred: it does not constrain the structure being built
  now. The audience/trust asset comes first; monetisation routes
  (partnerships, sponsorship, affiliate, B2B digests) layer on later
  without architectural impact.
- Final scoring weights (including inertia). Intentionally a work in
  progress. The weights can't sensibly be locked until data SOURCING
  stabilises into a repeatable method — precisely what Pipeline Phases 2–3
  (editorial, Trends, Places) establish. Until then the model stays as-is
  and is refined iteratively. Do NOT prematurely finalise the weights; that
  work is downstream of source stabilisation.

---
*Authoritative for the "why." For the "how," see the companion docs.*
