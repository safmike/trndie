#!/usr/bin/env node
/**
 * update-trends.js
 * ─────────────────────────────────────────────────────────────────
 * Weekly script that refreshes venue rankings.
 *
 * LIVE MODE  (TRENDS_MOCK=false)
 * ──────────────────────────────
 * Runs the full discovery engine:
 *   1. Fetch TikTok videos for the city (one Apify actor run)
 *   2. Extract candidate venue names from hashtags + @mentions
 *   3. Validate candidates with Google Trends (drop zero-interest noise)
 *   4. Merge candidates with retained existing venues
 *   5. Score all via scorer.js
 *   6. Keep top 10 — write back to city JSON
 *
 * Venues not rediscovered this week remain in the candidate pool and
 * survive via INERTIA (50 % carry-forward) unless they've gone quiet.
 * Newly discovered venues start with minimal metadata (description and
 * mustTry empty); curate them once they prove persistent.
 *
 * MOCK MODE  (default)
 * ─────────────────────
 * No external calls.  Scores the existing venue list with seeded-random
 * signals — useful for local development and CI.
 *
 * USAGE
 * ─────
 *   npm run update-trends
 *   npm run update-trends -- --city sydney
 *   TRENDS_MOCK=false npm run update-trends
 */

"use strict";

const { listCities, readCity, writeCity }         = require("./lib/cityData");
const { fetchCityTikTokSignals, fetchGoogleTrends,
        getTikTokFromMap, MENTION_SCALE, MOCK_MODE } = require("./lib/fetchers");
const { scoreVenue, rankVenues }                   = require("./lib/scorer");
const { extractCandidates, inferCategory, dedupKey } = require("./lib/extractor");

// ── Concurrency limiter ───────────────────────────────────────────────────────

async function mapWithConcurrency(arr, limit, fn) {
  const results = new Array(arr.length);
  let next = 0;
  async function worker() {
    while (next < arr.length) {
      const i = next++;
      results[i] = await fn(arr[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, arr.length) }, worker));
  return results;
}

// ── CLI args ──────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { city: null };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--city" && args[i + 1]) opts.city = args[++i];
  }
  return opts;
}

// ── Retention policy ─────────────────────────────────────────────────────────
//
// Venues not rediscovered this week are only kept if they clear both gates:
//   1. Score floor  — must have ranking_score >= RETENTION_MIN_SCORE
//      (with INERTIA=0.50 a retained venue scores score×0.5 next week,
//       so anything below ~4 will fall out after one grace week anyway)
//   2. Count cap    — only the top MAX_RETAINED by score are kept
//      (guarantees at least half the top-10 comes from live discovery)
//
const RETENTION_MIN_SCORE = 4.0;
const MAX_RETAINED        = 5;

// ── Venue pool builder ────────────────────────────────────────────────────────

/**
 * Builds the candidate pool that will be scored this run.
 *
 * Pool members come from two sources:
 *   A. Extracted candidates (discovered from TikTok this week)
 *   B. Retained existing venues (not rediscovered — kept for inertia)
 *
 * For each extracted candidate:
 *   - If a matching existing venue is found (fuzzy name match), its
 *     full metadata (description, mustTry, tags, etc.) is preserved.
 *   - If no match, a minimal stub is created for the new discovery.
 *
 * Each pool member gets a `_tiktokMentions` annotation (raw-scaled count)
 * that the scoring step reads before deleting it.
 *
 * @param {{ name: string, mentions: number }[]} candidates
 * @param {object[]}  existingVenues
 * @param {string}    citySlug
 * @param {object[]}  items   raw TikTok video objects (for category inference)
 * @returns {object[]}
 */
function buildVenuePool(candidates, existingVenues, citySlug, items) {
  const pool        = [];
  const usedExisting = new Set(); // track which existing venues were matched

  for (const candidate of candidates) {
    const scaled   = Math.round(Math.min(1000, candidate.mentions * MENTION_SCALE));
    const existing = findExisting(candidate.name, existingVenues);

    if (existing) {
      usedExisting.add(existing.name);
      pool.push({ ...existing, _tiktokMentions: scaled });
    } else {
      // Genuinely new discovery — minimal stub
      pool.push({
        name:          candidate.name,
        city:          citySlug,
        category:      inferCategory(candidate.name, items),
        ranking_score: 5.0,    // neutral start; scorer applies INERTIA
        location:      "",
        area:          "",
        vibe:          "",
        viral:         false,
        instagram_url: null,
        tiktok_url:    null,
        website_url:   null,
        description:   "",
        mustTry:       "",
        tags:          [],
        trend_signals: null,
        _tiktokMentions: scaled,
      });
    }
  }

  // Retain existing venues not rediscovered this week — subject to both gates.
  const notRediscovered = existingVenues.filter((v) => !usedExisting.has(v.name));
  const aboveFloor      = notRediscovered.filter((v) => v.ranking_score >= RETENTION_MIN_SCORE);
  const retained        = aboveFloor
    .sort((a, b) => b.ranking_score - a.ranking_score)
    .slice(0, MAX_RETAINED);

  for (const venue of retained) {
    pool.push({ ...venue, _tiktokMentions: 0 });
  }

  const droppedFromRetention = notRediscovered.length - retained.length;
  if (droppedFromRetention > 0) {
    console.log(`     ↩  ${retained.length} retained  · ${droppedFromRetention} dropped (weak/excess signals)`);
  }

  return pool;
}

/**
 * Finds the best matching venue in `existing` for a discovered name.
 * Matches on the same canonical dedup key (lowercase, suffix-stripped,
 * space-removed) used by the extractor.
 *
 * @param {string}   name
 * @param {object[]} existing
 * @returns {object|null}
 */
function findExisting(name, existing) {
  const key = dedupKey(name);
  return existing.find((v) => dedupKey(v.name) === key) || null;
}

// ── Per-city processing ───────────────────────────────────────────────────────

/**
 * LIVE MODE: runs the discovery engine for one city.
 */
async function processCityLive(citySlug, cityData) {
  const existingVenues = cityData.venues;
  const categories     = [...new Set(existingVenues.map((v) => v.category).filter(Boolean))];
  // Always include base categories so queries are generated even for fresh cities
  const allCategories  = [...new Set([...categories, "cafe", "bakery"])];

  // ── 1. Fetch TikTok videos ────────────────────────────────────────
  const result = await fetchCityTikTokSignals(citySlug, allCategories, existingVenues);

  if (!result) {
    console.log("     ⚠️  TikTok fetch failed — scoring existing venues with mock signals");
    return processCityMock(citySlug, cityData);
  }

  const { items } = result;

  // ── 2. Extract candidates ─────────────────────────────────────────
  const candidates = extractCandidates(items, citySlug);
  console.log(`     🔍 ${candidates.length} raw candidates extracted`);

  if (candidates.length === 0) {
    console.log("     ⚠️  No candidates found — scoring existing venues");
    return processCityMock(citySlug, cityData);
  }

  // ── 3. Build pool ─────────────────────────────────────────────────
  const pool = buildVenuePool(candidates, existingVenues, citySlug, items);

  // ── 4. Score (Google Trends per venue, TikTok from discovery) ─────
  // Limit concurrency to respect Google Trends rate limits
  const scored = await mapWithConcurrency(pool, 3, async (venue) => {
    const tiktokMentions = venue._tiktokMentions;
    delete venue._tiktokMentions;

    // Google Trends validation: new stubs with zero GT interest are
    // likely noise (common words, person names, etc.).  Drop them
    // before they make it into the ranking.
    const googleTrends = await fetchGoogleTrends(venue.name, citySlug, venue.viral);

    const isNewStub   = !venue.trend_signals;
    if (isNewStub && googleTrends === 0 && tiktokMentions < 200) {
      return null; // filtered — not a real/notable venue
    }

    const updates = scoreVenue(venue, { googleTrends, tiktokMentions });
    return { ...venue, ...updates };
  });

  // Remove null entries (filtered noise) then rank
  const valid = scored.filter(Boolean);
  const top10 = rankVenues(valid, 10);

  // ── 5. Count new discoveries ──────────────────────────────────────
  const existingNames = new Set(existingVenues.map((v) => dedupKey(v.name)));
  const newCount      = top10.filter((v) => !existingNames.has(dedupKey(v.name))).length;
  const dropped       = existingVenues.filter((v) => !top10.find((t) => dedupKey(t.name) === dedupKey(v.name))).length;

  console.log(
    `     ✓ ${top10.length} venues ranked` +
    (newCount  ? `  · ${newCount} new discover${newCount  !== 1 ? "ies" : "y"}`  : "") +
    (dropped   ? `  · ${dropped} dropped`   : "")
  );

  cityData.venues    = top10;
  cityData.updatedAt = formatDate(new Date());
  writeCity(citySlug, cityData);
}

/**
 * MOCK MODE (and live fallback): scores existing fixed venue list
 * using mock / seeded-random signals.  No discovery.
 */
async function processCityMock(citySlug, cityData) {
  const toScore = cityData.venues;
  if (toScore.length === 0) return;

  const scored = await Promise.all(toScore.map(async (venue) => {
    const signals = {
      googleTrends:   await fetchGoogleTrends(venue.name, citySlug, venue.viral),
      tiktokMentions: getTikTokFromMap(null, venue.name, citySlug, venue.viral),
    };
    return { ...venue, ...scoreVenue(venue, signals) };
  }));

  const top10 = rankVenues(scored, 10);

  const scoreChanges = scored.filter((v) => {
    const orig = toScore.find((o) => o.name === v.name);
    return orig && orig.ranking_score !== v.ranking_score;
  }).length;

  console.log(`     ✓ ${top10.length} venues ranked  · ${scoreChanges} score${scoreChanges !== 1 ? "s" : ""} changed`);

  cityData.venues    = top10;
  cityData.updatedAt = formatDate(new Date());
  writeCity(citySlug, cityData);
}

// ── Dispatch ──────────────────────────────────────────────────────────────────

async function processCity(citySlug) {
  const cityData = readCity(citySlug);
  if (MOCK_MODE) {
    return processCityMock(citySlug, cityData);
  }
  return processCityLive(citySlug, cityData);
}

// ── Formatting ────────────────────────────────────────────────────────────────

function formatDate(date) {
  return date.toLocaleDateString("en-AU", { month: "long", year: "numeric" });
}

// ── Entry point ───────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs();

  const modeLabel = MOCK_MODE ? "MOCK DATA" : "LIVE DISCOVERY";
  const filter    = opts.city ? `city=${opts.city}` : "all cities";

  console.log(`\n🔄  TRNDIE trend update  [${modeLabel}]`);
  console.log(`    ${filter}\n`);

  const cities = opts.city ? [opts.city] : listCities();
  let errors = 0;

  for (const slug of cities) {
    process.stdout.write(`📍  ${slug}\n`);
    try {
      await processCity(slug);
    } catch (err) {
      console.error(`     ✗ ${err.message}`);
      errors++;
    }
  }

  console.log(`\n${errors ? `⚠️  Finished with ${errors} error(s).` : "✅  Done."}`);
  console.log(`    Run  npm run build  to rebuild the site with the new rankings.\n`);

  if (errors) process.exit(1);
}

main();
