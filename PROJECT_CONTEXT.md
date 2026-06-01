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

## Sourcing evolution — the staircase
Editorial-first via RSS is the foundation, not the destination. Sourcing
climbs a staircase, each step built on the one below:
1. Now — accessible editorial (RSS + manual). Tier-1 publications via RSS,
   manual curation as fallback. Reliable, legitimate, automatable today.
2. Next — editorial partnerships. Formal relationships with the publications
   we already credit, deepening access and trust.
3. Then — influencer / local trend-spotters. Partnerships with the people
   best placed to spot a venue before it breaks — the most valuable signal,
   but only accessible once there's an audience/brand to offer them.
4. Eventually — legitimate social/TikTok signal. Direct API access (via the
   platforms or partnership) if/when it becomes legitimately available — the
   original aspiration, deferred until access exists.
Today's RSS approach is deliberately not the forever solution; it's step one.
This is also why scoring weights stay WIP (see Open questions): the model
firms up as we climb the staircase and sourcing stabilises.

## Current state
Working / live (Vercel, trndie.co): 8 cities on v2.1, 7 published,
Newcastle hidden (2 venues, published:false); city-v2.njk renderer with
vibe filter, save/heart (localStorage), per-city palette; homepage
Trending Now + All Venues working; cycling slogans with keyword emphasis;
logo shimmer; scores removed from cards; Brisbane geocoding corrected;
legacy GitHub Pages site decommissioned; Pipeline Phase 1 (the Bridge)
merged (PR #20) — the salvaged pipeline now reads/writes data/ranked_*.json,
inertia-only, with no external dependencies.
Nothing else is actively in progress.
Not started: Pipeline Phases 2–5 (editorial → trends+places+geo →
synthesis → orchestration).

## Known issues / tech debt / gotchas
*Verified against the live repo on 2026-05-23 (branch state after Phase 1
merged, PR #20). Each item below is confirmed against actual files unless
flagged otherwise. ARCHITECTURE.md "Tech debt map" mirrors this list with
file paths.*

- **Orphaned v2.0 data store — RETIRED.**
  `city-generator/trendy/src/_data/cityData/*.json` (8 files) have been
  deleted. They were read only by `cities.js` (also retired), which excluded
  all 8 by filename, so they fed nothing. The live data is repo-root
  `data/ranked_*.json`, written by the bridge.
- **Legacy renderer — RETIRED.** `city-generator/trendy/src/city.njk` and its
  loader `src/_data/cities.js` have been deleted. `city.njk` paginated the
  `cities` collection, which was always empty (cities.js excluded every
  city), so it emitted zero pages — its removal leaves the build output
  byte-for-byte identical. Now fully orphaned by that deletion but left in
  place (minor follow-up, not done here): `_includes/venue-links.njk` and
  `js/filter.js` (were used only by `city.njk`), plus the `uniqueBy` filter
  in `.eleventy.js` (defined but no longer referenced). `css/style.css` is
  kept — index/base still use it.
- **/migrate-city — RETIRED.** `.claude/commands/migrate-city.md` has been
  deleted (its directory `.claude/commands/` is now empty/gone). It migrated
  a city from v2.0 cityData → v2.1; all 8 cities are migrated, it read the
  now-deleted cityData store, and its Step 4 edited the retired `cities.js`.
  If an "add new city" command is wanted later, write a fresh one targeting
  `data/ranked_*.json` directly.
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
- **Weekly workflow commits the wrong path — CONFIRMED, real bug (now
  worse).** `.github/workflows/update-trends.yml` runs the bridge (which
  writes `data/ranked_*.json`) but its commit step still stages
  `git add city-generator/trendy/src/_data/cityData/` — a path that no
  longer exists (the cityData store was deleted in the legacy cleanup). A
  manual `workflow_dispatch` run would now **error** at that `git add`
  instead of silently committing nothing useful. Its `TRENDS_MOCK`/
  `APIFY_TOKEN` env is also stale (Phase 1 makes no external calls). The cron
  schedule is intentionally commented out (paused). Left untouched by the
  cleanup (the workflow rewire is Phase 5, out of scope) — do **not** rely on
  it to publish ranking changes until then.
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
- **Email domain — FIXED in this PR.** `site.json` previously used
  `hello@trndie.com`; corrected to `hello@trndie.co` to match the canonical
  domain (and `city-generator/template.html`, which was already correct).
- **Vestigial standalone template.** `city-generator/template.html` is a
  pre-Eleventy standalone HTML mock; neither build uses it. Harmless legacy
  artifact.
- **Fragile external inputs (future phases).** Editorial scraping is
  ToS-grey and the Trends wrapper is unofficial — see the resilience plan in
  TRENDING_METHODOLOGY.md (prefer RSS / newsletter / partnership, manual
  fallback). Not active today (Phase 1 makes no external calls).

## Near-term roadmap
1. Pipeline Phases 2–5
2. TRENDING_METHODOLOGY v2.2 — geo-validation/suburb whitelist + the
   reconciled scoring STRUCTURE (editorial-first + inertia). Precise
   weights remain tunable as data sources stabilise (see Open questions).
3. ~~Legacy cleanup (orphaned cityData, within-trendy legacy renderer,
   vestigial /migrate-city)~~ — **DONE.** Remaining minor orphans
   (`_includes/venue-links.njk`, `js/filter.js`, the `uniqueBy` filter,
   `deploy.yml`, `template.html`) can go in a follow-up.
4. Deferred features once the pipeline is solid: cover photos, "from here,
   try also" cross-city rail, "what's new this week" diff surface
5. Future: more cities; eventually international (Australia is the proving
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
