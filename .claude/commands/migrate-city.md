# Task: Migrate $ARGUMENTS to v2.1 (data + routing, auto-merge on success)

## Context
You are migrating $ARGUMENTS from v2.0 to v2.1 in the trndie repo. This is
the proven formula encoded as automation — Melbourne and Sydney have been
migrated manually and serve as working references.

Source-of-truth documents (READ FIRST):
- CLAUDE.md
- TRENDING_METHODOLOGY.md (v2.1 schema, scoring, output spec)
- UX_PRINCIPLES.md (v1.0 voice spec, vibe taxonomy, card anatomy)

Working references (READ BEFORE WRITING):
- data/ranked_melbourne.json — canonical v2.1 output shape
- data/ranked_sydney.json — confirms the pattern generalises
- config/vibe_tags.json — canonical vibe taxonomy

The Melbourne renderer (city-v2.njk + supporting files) already exists on
main. You only need to migrate data and wire routing.

## Step 0: Pre-flight checks (fail fast)
- Source file must exist: city-generator/trendy/src/_data/cityData/$ARGUMENTS.json
  If missing, STOP and report.
- Target file must NOT exist: data/ranked_$ARGUMENTS.json
  If present, STOP and report — refuse to overwrite an already-migrated city.

## Step 1: Investigate
Read all three source-of-truth docs. Read both ranked_melbourne.json and
ranked_sydney.json — match their shape exactly. Read the source file and
note venue count + any unusual fields. Read current config/vibe_tags.json
and the current cities.js to understand routing.

## Step 2: Determine city tier
Per TRENDING_METHODOLOGY.md:
- Tier 1: Melbourne, Sydney (already done)
- Tier 2: Brisbane, Perth, Adelaide, Gold Coast
  → editorial 35 / trends 40 / rating 15 / reviews 10
- Tier 3: Canberra, Newcastle, Wollongong, Hobart, Darwin, Cairns
  → editorial 20 / trends 50 / rating 15 / reviews 15

Set the "tier" field on output accordingly.

## Step 3: Migrate data
Create data/ranked_$ARGUMENTS.json. Per-venue transformations:
- ranking_score (0–10) → composite_score (0–1)
- mustTry → must_try, ALL prices stripped (no $ symbols)
- description → DO NOT REUSE. Regenerate trending_copy from scratch in
  voice (see Voice Rules below).
- vibe_tags: 2–3 per venue from config/vibe_tags.json. ADD new tags if
  $ARGUMENTS needs vibes not yet in the file — apply UX_PRINCIPLES naming
  principles. Never remove or rename existing tags.
- first_discovered: placeholder = last_scored minus 60 days
- cover_photo_url: null
- source_urls: []
- newness_boost_applied: false, trends_unavailable: false
- rank: assigned 1..N by descending composite_score

City-level fields:
- city: "$ARGUMENTS" — capitalised correctly (e.g. "Brisbane", "Gold Coast")
- tier: per the tier table above
- last_updated: today's ISO date (AEST)
- next_update: next Thursday or Sunday, whichever is sooner
- methodology_version: "2.1"

## Step 4: Wire routing
- Update city-generator/trendy/src/_data/cities.js to exclude
  $ARGUMENTS.json from the legacy collection (add && f !== "$ARGUMENTS.json"
  to the filter, following the Melbourne/Sydney pattern).
- Update city-generator/trendy/src/_data/rankedCities.js TAGLINES map:
  add a $ARGUMENTS entry with an in-voice tagline. Read Melbourne's and
  Sydney's taglines first; match register. Short, confident, no marketing-
  speak.

## Voice Rules — STRICT
Every trending_copy must:
- Be exactly 2 sentences
- Be wry, confident, lightly Australian
- Lead with particulars (dish, booth, time of day, specific quality)
  over adjectives
- Match Melbourne and Sydney's voice register exactly. Read 3–5 of their
  trending_copy entries before writing $ARGUMENTS's first card.

BANNED phrases (any presence will fail validation):
- "cozy"
- "Instagram-worthy", "absolutely", "must-visit"
- "vibes are immaculate", "creative drinks", "creative flavour combinations"
- "showstopper", "making waves", "bringing new energy"
- "small but perfectly formed", "as beautiful as they are delicious"
- "discover", "experience", "elevate", "curated"
- "TRNDIE" used as an adjective inside copy

## Step 5: Self-validation (before merging)
Run these checks. If ANY fail, leave the PR open and report; do not merge.

1. data/ranked_$ARGUMENTS.json parses as valid JSON
2. All venues from source are present in output
3. Venues ranked 1..N with no gaps or duplicates
4. composite_score values all between 0 and 1
5. No prices remain in any must_try field (grep for "$")
6. Grep every trending_copy for banned phrases — must return zero hits
7. Every venue has 2–3 vibe_tags
8. All vibe_tags exist in config/vibe_tags.json
9. cities.js filter excludes $ARGUMENTS.json
10. rankedCities.js TAGLINES has a $ARGUMENTS entry

Report the full self-validation results in the PR body.

## Step 6: Open PR and auto-merge
- Branch: migrate-$ARGUMENTS-v2.1
- PR title: "$ARGUMENTS v2.1 migration"
- PR body must include:
  - Self-validation results (all 10 checks, pass/fail per item)
  - The tagline written for $ARGUMENTS
  - Any new vibe_tags added and reasoning
  - Anything unusual found in the source data
- Open as a regular (non-draft) PR
- If self-validation passed: auto-merge with `gh pr merge --squash`
- If self-validation failed: leave the PR open, do not merge, report failures

## Out of scope — do not do these
- Do not modify Melbourne, Sydney, or any city other than $ARGUMENTS
- Do not modify city-v2.njk, city-v2.css, city-v2.js
- Do not modify rankedCities.js other than adding the $ARGUMENTS TAGLINES entry
- Do not modify CLAUDE.md, TRENDING_METHODOLOGY.md, or UX_PRINCIPLES.md
- Do not source photos or populate cover_photo_url
- Do not add new dependencies
