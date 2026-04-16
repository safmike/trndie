#!/usr/bin/env node
/**
 * update-trends.js
 * ─────────────────────────────────────────────────────────────────
 * Weekly script that refreshes venue ranking scores by fetching trend
 * signals, re-scoring every venue, and writing the results back to the
 * per-city JSON files.  After it runs, a site rebuild picks up the new
 * rankings automatically.
 *
 * USAGE
 * ─────
 *   npm run update-trends                  # all cities, mock data
 *   npm run update-trends -- --city sydney # single city
 *   npm run update-trends -- --category cafe
 *   npm run update-trends -- --city melbourne --category bakery
 *
 *   # Live APIs (requires APIFY_TOKEN in environment)
 *   TRENDS_MOCK=false npm run update-trends
 *
 * HOW IT WORKS
 * ────────────
 *   1. Read every city JSON file (or just the requested one)
 *   2. Run ONE Apify actor call per city with discovery queries
 *      (e.g. "best cafes melbourne", "#melbournecafe", …)
 *   3. Map returned videos → per-venue mention counts
 *   4. Fetch Google Trends per-venue (state-level geo, 7-day window)
 *   5. Blend signals into a new ranking_score via scorer.js
 *   6. Sort by new score, keep top 10 per city
 *   7. Write the updated city JSON back to disk
 */

"use strict";

const { listCities, readCity, writeCity }                                      = require("./lib/cityData");
const { fetchCityTikTokSignals, fetchGoogleTrends, getTikTokFromMap, MOCK_MODE } = require("./lib/fetchers");
const { scoreVenue, rankVenues }                                                 = require("./lib/scorer");

// ── Concurrency helper ────────────────────────────────────────────────────────

/**
 * Like Promise.all(arr.map(fn)) but limits how many calls run at once.
 * When limit === Infinity it behaves identically to Promise.all.
 *
 * @param {any[]}    arr
 * @param {number}   limit  max concurrent executions
 * @param {Function} fn     async (item, index) => result
 * @returns {Promise<any[]>} results in input order
 */
async function mapWithConcurrency(arr, limit, fn) {
  const results = new Array(arr.length);
  let next = 0;

  async function worker() {
    while (next < arr.length) {
      const i = next++;
      results[i] = await fn(arr[i], i);
    }
  }

  const workers = Array.from(
    { length: Math.min(limit, arr.length) },
    worker
  );
  await Promise.all(workers);
  return results;
}

// ── CLI argument parsing ──────────────────────────────────────────────────────

/**
 * Parses --city and --category flags from process.argv.
 * Returns { city: string|null, category: string|null }
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { city: null, category: null };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--city"     && args[i + 1]) opts.city     = args[++i];
    if (args[i] === "--category" && args[i + 1]) opts.category = args[++i];
  }

  return opts;
}

// ── Trend signal fetching ─────────────────────────────────────────────────────

/**
 * Fetches signals for a single venue.
 * TikTok is supplied pre-fetched (from the city-level map) rather than
 * triggering a separate Apify run per venue.
 *
 * @param {object}           venue
 * @param {string}           citySlug
 * @param {Map|null}         tiktokMap  pre-fetched city TikTok data, or null for mock
 * @returns {Promise<{ googleTrends: number, tiktokMentions: number }>}
 */
async function fetchSignals(venue, citySlug, tiktokMap) {
  const [googleTrends, tiktokMentions] = await Promise.all([
    fetchGoogleTrends(venue.name, citySlug, venue.viral),
    Promise.resolve(getTikTokFromMap(tiktokMap, venue.name, citySlug, venue.viral)),
  ]);
  return { googleTrends, tiktokMentions };
}

// ── Per-city processing ───────────────────────────────────────────────────────

/**
 * Scores all venues in a city, selects the top 10, and writes the
 * result back to the JSON file.
 *
 * If --category is supplied, only venues in that category are re-scored
 * and ranked; all other venues are left exactly as they are (preserving
 * their existing scores and order relative to each other).
 *
 * @param {string} citySlug
 * @param {object} opts     { category: string|null }
 */
async function processCity(citySlug, opts) {
  const cityData = readCity(citySlug);

  // Decide which venues to re-score
  const toScore = opts.category
    ? cityData.venues.filter((v) => v.category === opts.category)
    : cityData.venues;

  if (toScore.length === 0) {
    console.log(`     no venues match category "${opts.category}" — skipped`);
    return;
  }

  // ── Pre-fetch TikTok signals for the whole city (1 Apify run) ─────
  // In live mode this runs one actor call covering all discovery queries
  // for this city, returning a Map<venueName, scaledCount>.
  // In mock mode (or on failure) returns null → per-venue mock fallback.
  const tiktokMap = await fetchCityTikTokSignals(citySlug, toScore);

  // ── Score all target venues ───────────────────────────────────────
  // TikTok is now pre-fetched — only Google Trends runs per-venue.
  // In live mode: cap at 3 concurrent to respect Google Trends rate limits.
  // In mock mode: all parallel (no rate-limit risk).
  const CONCURRENCY = MOCK_MODE ? Infinity : 3;
  const scored = await mapWithConcurrency(toScore, CONCURRENCY, async (venue) => {
    const signals = await fetchSignals(venue, citySlug, tiktokMap);
    const updates = scoreVenue(venue, signals);
    return { ...venue, ...updates };
  });

  // ── Rank and trim to top 10 ───────────────────────────────────────
  const top10 = rankVenues(scored, 10);

  // ── Rebuild the full venue list ───────────────────────────────────
  // Venues that were excluded by --category are appended after the
  // ranked top 10 so nothing is silently dropped from the file.
  const untouched = opts.category
    ? cityData.venues.filter((v) => v.category !== opts.category)
    : [];

  cityData.venues    = [...top10, ...untouched];
  cityData.updatedAt = formatDate(new Date());

  writeCity(citySlug, cityData);

  // ── Console summary ───────────────────────────────────────────────
  const scoreChanges = scored.filter((v, i) => {
    const original = toScore.find((o) => o.name === v.name);
    return original && original.ranking_score !== v.ranking_score;
  }).length;

  const newViral = scored.filter(
    (v) => v.viral && !toScore.find((o) => o.name === v.name)?.viral
  ).length;

  console.log(
    `     ✓ ${top10.length} venues ranked  ` +
    `· ${scoreChanges} score${scoreChanges !== 1 ? "s" : ""} changed` +
    (newViral ? `  · 🔥 ${newViral} newly viral` : "")
  );
}

// ── Formatting helpers ────────────────────────────────────────────────────────

/**
 * Returns a human-friendly month + year string, e.g. "April 2026".
 * Matches the existing format used in the city JSON files.
 *
 * @param {Date} date
 * @returns {string}
 */
function formatDate(date) {
  return date.toLocaleDateString("en-AU", { month: "long", year: "numeric" });
}

// ── Entry point ───────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs();

  const modeLabel = MOCK_MODE ? "MOCK DATA" : "LIVE APIs";
  const filter    = [
    opts.city     ? `city=${opts.city}`         : null,
    opts.category ? `category=${opts.category}` : null,
  ].filter(Boolean).join("  ") || "all cities, all categories";

  console.log(`\n🔄  TRNDIE trend update  [${modeLabel}]`);
  console.log(`    ${filter}\n`);

  const cities = opts.city ? [opts.city] : listCities();

  let errors = 0;

  for (const slug of cities) {
    const label = opts.category ? `${slug}  (${opts.category})` : slug;
    process.stdout.write(`📍  ${label}\n`);

    try {
      await processCity(slug, opts);
    } catch (err) {
      console.error(`     ✗ ${err.message}`);
      errors++;
    }
  }

  console.log(`\n${ errors ? `⚠️  Finished with ${errors} error(s).` : "✅  Done." }`);
  console.log(`    Run  npm run build  to rebuild the site with the new rankings.\n`);

  // Exit with non-zero code so CI catches failures
  if (errors) process.exit(1);
}

main();
