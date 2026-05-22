# TRNDIE — Pipeline Build Plan

**Version:** 2.0
**Project:** TRNDIE (trendy-vivid.vercel.app)
**Repo:** github.com/safmike/trndie
**Companion documents:** TRENDING_METHODOLOGY.md (the spec),
UX_PRINCIPLES.md, CLAUDE.md
**Last updated:** 2026-05-22

---

## Changelog — v1.0 → v2.0

Major reframe following two discoveries and one strategic decision:

- **A pipeline already exists.** update-trends.js (in
  city-generator/trendy/scripts/) already does discovery, trend
  validation, scoring, retention, mock-mode, and weekly scheduling —
  but writes the OLD v2.0 schema and is orphaned (nothing live reads
  it). This plan is now salvage-and-evolve, not build-from-scratch.
- **TikTok is not a viable foundation.** TRNDIE has no reliable/
  legitimate access to TikTok data (Apify scraping is fragile and
  ToS-violating). TikTok is demoted from core signal to optional future
  enrichment. The pipeline is rebuilt on accessible signals: editorial,
  Google Trends, Google Places.
- **Editorial-first, for three reasons at once:** fraud-resistance,
  data accessibility, and alignment with the product vision
  (aggregation + collective collaboration).
- **Attribution is now first-class.** Per the collective-collaboration
  principle, the pipeline captures and the UI surfaces who surfaced each
  venue — crediting the ecosystem rather than extracting from it.

---

## What this document is

The build plan: sequencing, architecture, what to salvage, milestones.
It does NOT re-specify scoring/stage logic in detail —
TRENDING_METHODOLOGY.md is the source of truth for that (and needs a
v2.2 update to match the decisions here). Read both together.

---

## Guiding principles (from the product vision)

1. **Aggregation, not origination.** TRNDIE is "one place, see it all,
   live." Value = synthesising accessible signal into one fresh
   browsable place, not owning proprietary data.
2. **Accessible data only.** Build on what TRNDIE can legitimately and
   reliably access: editorial (RSS/newsletter/manual), Google Trends,
   Google Places. No foundation dependency on inaccessible sources.
3. **Collective collaboration.** Credit sources and creators; drive
   traffic to venues. Pipeline captures attribution; UI surfaces it.
   Amplify the ecosystem, never parasitise it.
4. **Curation integrity is sacred.** The ranked list is earned, never
   bought. No pay-to-play, ever. The taste is the asset.
5. **Liveness without thrashing.** Fresh enough to feel alive (twice
   weekly), stable run-to-run (inertia keeps rankings from whipsawing).

---

## Current state — what already exists (to salvage)

| Component | File | Verdict |
|---|---|---|
| Orchestrator | scripts/update-trends.js | Salvage structure; re-point output |
| Scoring | scripts/scorer.js | Salvage framework; reconcile weights |
| I/O layer | scripts/lib/cityData.js | Salvage; re-point cityData → ranked_*.json |
| Trends fetch | scripts/fetchers.js (Trends) | Salvage |
| TikTok fetch | scripts/fetchers.js (TikTok) | Set aside — optional future only |
| Candidate extraction | scripts/extractor.js | Set aside — TikTok-specific |
| Retention logic | update-trends.js | Salvage |
| Mock mode | fetchers.js / update-trends.js | Salvage — essential for safe testing |
| Scheduler | .github/workflows/update-trends.yml | Salvage; adapt |

Key problem being fixed: the existing pipeline writes v2.0
trendy/cityData/*.json, which neither live site reads. The Vercel site
reads data/ranked_*.json (v2.1). The bridge connects them.

---

## Architecture

- **Runs on:** GitHub Actions (cloud Claude Code builds; Actions runs).
- **Schedule:** twice weekly per methodology (existing Monday cron adapted).
- **Produces:** data/ranked_<city>.json conforming to v2.1 schema.
- **Ships via:** Action commits updated JSON to main → Vercel auto-deploys.
- **Language:** Node.js (the existing pipeline is JS — we stay in JS;
  the methodology's Python examples are illustrative, not binding).

### Target file structure

city-generator/trendy/scripts/
update-trends.js       # orchestrator (salvaged, re-pointed)
scorer.js              # reconciled scoring
lib/
cityData.js          # re-pointed to data/ranked_*.json
sources/
editorial.js       # NEW — editorial ingestion
trends.js          # salvaged Google Trends
places.js          # NEW — Google Places (rating/reviews/geo)
synthesis.js         # NEW — Claude voice copywriting
attribution.js       # NEW — capture/format source credit
config/
vibe_tags.json         # existing
city_suburbs.json      # NEW — geo whitelist
.github/workflows/
update-trends.yml      # salvaged, adapted to write v2.1 + cadence

---

## Scoring model (reconciled)

The built model (inertia 50 + trends 30 + tiktok 20) and the methodology
model (editorial 45 + trends 30 + rating 15 + reviews 10) reconcile into
one editorial-first model that KEEPS inertia for stability and DROPS
TikTok from the core:

- **Editorial** — primary (fraud-resistant, accessible)
- **Inertia** — stability (prevents run-to-run thrashing; the good idea
  from the built pipeline the methodology lacked)
- **Google Trends** — supporting buzz signal
- **Rating / review velocity** — quality + popularity floor (Places)
- **TikTok** — removed from core; optional future enrichment only

Exact weights + per-tier variants are a TRENDING_METHODOLOGY.md v2.2
deliverable, not specified here. The build implements whatever the
methodology lands on.

---

## Attribution model (first-class — the collaboration principle)

Every venue carries provenance: which editorial source(s) surfaced it,
with links. The v2.1 schema's source_urls field is the seed.

- **Pipeline captures:** for each venue, the source(s) that featured it
  (publication, URL, date) → source_urls.
- **UI surfaces:** a "featured in / spotted by" credit + a path to the
  cafe on each card.
- **Future:** creator-level attribution when creator signal is accessible.

Collaboration made concrete — TRNDIE visibly amplifying the ecosystem it
draws from.

---

## Output contract (non-negotiable)

Pipeline output MUST conform to the v2.1 schema (methodology Stage 7),
byte-compatible with what city-v2.njk + rankedCities.js consume. The
frontend never changes because of pipeline output. Every phase produces
valid v2.1 JSON.

---

## Build phases (salvage-and-evolve, bridge-first)

### Phase 1 — The Bridge (connect, don't enrich yet)
**Goal:** salvaged pipeline reads + writes data/ranked_*.json (v2.1),
connected to the live site, deterministic scoring, zero external deps.
**Deliverables:** re-point cityData.js I/O from trendy/cityData (v2.0)
to data/ranked_*.json (v2.1, composite_score 0–1 etc.); scoring runs
inertia-only for now (stable, no randomness, no external signals —
proves plumbing without injecting noise); update-trends.js orchestrates
read → score → write against v2.1; mock/dry-run preserved.
**Done when:** pipeline reads ranked_*.json, re-writes valid
ranked_*.json (frontend renders identically), NO external calls. The
orphaned automation is now connected. TikTok code bypassed, not invoked.
**Dependencies:** none external.

### Phase 2 — Editorial signal (the new core)
**Goal:** editorial as primary signal + attribution capture.
**Deliverables:** lib/sources/editorial.js (Broadsheet/Timeout/Good Food
via RSS where available, newsletter parsing, or manual-curation fallback
per methodology resilience plan); editorial scoring (recency +
source-independence); attribution.js (capture source → source_urls);
TRENDING_METHODOLOGY.md bumped to v2.2 (reconciled scoring + editorial-
first + TikTok demotion documented).
**Done when:** venues scored primarily on editorial; every venue carries
source attribution.
**Dependencies:** editorial access (RSS/newsletter; manual fallback always).

### Phase 3 — Trends + Places + Geo
**Goal:** supporting signals + validation.
**Deliverables:** lib/sources/trends.js (salvaged Trends, graceful
degradation); lib/sources/places.js (rating + review velocity);
Mapbox/TomTom geocoding + config/city_suburbs.json whitelist enforcement
(v2.2 geo-validation); reconciled composite scoring fully implemented.
**Done when:** composite reflects the full reconciled model; venues
validated against suburb whitelists; misplaced venues auto-rejected.
**Dependencies:** MAPBOX_TOKEN, TOMTOM_KEY (free tiers),
GOOGLE_PLACES_API_KEY (onboarding-scoped).

### Phase 4 — Synthesis (the voice layer)
**Goal:** generate trending_copy + vibe_tags in TRNDIE's voice.
**Deliverables:** lib/synthesis.js (Claude API copywriting using
UX_PRINCIPLES voice spec; assigns vibe_tags from config/vibe_tags.json);
programmatic banned-phrase validation.
**Done when:** newly-scored venues get in-voice copy automatically; no
banned phrases.
**Dependencies:** ANTHROPIC_API_KEY.

### Phase 5 — Surface attribution + "What's new" + Orchestration
**Goal:** make collaboration visible, mark freshness, run unattended.
**Deliverables:** UI "featured in / spotted by" credit + path-to-cafe on
each card (city-v2.njk reading source_urls); "what's new this week" diff
surface (homepage, deferred earlier); update-trends.yml adapted (writes
v2.1, twice-weekly cadence, commits ranked_*.json, triggers Vercel,
failure alerting).
**Done when:** pipeline runs automatically twice weekly; live site shows
fresh venues, credits sources, shows what changed — zero manual steps.
**Dependencies:** all prior phases; GitHub Actions secrets.

---

## Testing approach

- Each source module independently testable; mock/dry-run preserved.
- Phase 1 establishes the golden-output test: output validates against
  v2.1 schema and renders in the frontend.
- API-dependent modules (Phases 2–4) include cached-fixture/dry-run
  modes — test without burning quota or hitting live sources.
- A phase merges only when output still produces frontend-renderable JSON.

---

## Guardrails

- **Frontend contract sacred** — pipeline changes never force frontend
  changes (except the deliberate Phase 5 UI work).
- **Curation integrity sacred** — no pay-to-play; ranked list always earned.
- **Accessible data only** — no foundation dependency on TikTok/IG.
- **Cost discipline** per methodology (~$5–15/month); free tiers.
- **ToS-respectful** — editorial prefers RSS/newsletter/partnership over
  scraping; follows methodology resilience plan; never escalates to evasion.
- **Pipeline phases are NOT auto-merged** — backend logic that can corrupt
  data is human-reviewed every time.

---

## Out of current scope (future)

- TikTok/IG enrichment (revisit only if access becomes legitimate)
- Creator-level attribution (when creator signal is accessible)
- International expansion (Australia is the proving ground first)
- Premium / B2B trend digests (post audience)

---

## Changelog — v2.0
- Reframed from build-from-scratch to salvage-and-evolve. TikTok demoted
  from core to optional-future. Editorial-first confirmed (fraud-
  resistance, accessibility, vision-alignment). Attribution promoted to
  first-class per collective-collaboration. Language corrected to Node.
  Five bridge-first phases defined.

## Changelog — v1.0
- Initial build plan (from-scratch, Python, output-first). Superseded by v2.0.

---

*v2.0 — May 2026*
