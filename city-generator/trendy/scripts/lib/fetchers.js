/**
 * fetchers.js
 * ─────────────────────────────────────────────────────────────────
 * Retrieves trend signals from external sources.
 *
 * MODE
 * ────
 * MOCK (default) — returns deterministic fake data seeded on the
 *   venue name + ISO week, so results are consistent within a week
 *   but change each week.  No API keys or network calls needed.
 *
 * LIVE — routes to the real implementation stubs below.
 *   Set the environment variable  TRENDS_MOCK=false  to enable.
 *
 * PLUGGING IN A REAL API
 * ───────────────────────
 * 1. Install the relevant package (see comments inside each function).
 * 2. Add your credentials to a .env file (never commit this).
 * 3. Uncomment the implementation block.
 * 4. Set TRENDS_MOCK=false when running the script.
 */

"use strict";

// ── Mode toggle ───────────────────────────────────────────────────────────────

// Default to mock unless caller explicitly opts out
const MOCK_MODE = process.env.TRENDS_MOCK !== "false";

// ── Shared helpers ────────────────────────────────────────────────────────────

/**
 * Returns the ISO week number of a given date.
 * Used to make mock scores change weekly while staying stable
 * within the same week (idempotent reruns produce the same scores).
 *
 * @param {Date} date
 * @returns {number} 1–53
 */
function isoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

/**
 * Deterministic pseudo-random number (0–1) for a given string seed.
 * Based on djb2 hash — not cryptographic, but gives good distribution.
 *
 * @param {string} seed
 * @returns {number} float in [0, 1)
 */
function seededRandom(seed) {
  let hash = 5381;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) + hash) ^ seed.charCodeAt(i);
    hash = hash >>> 0; // keep it 32-bit unsigned
  }
  return (hash % 10000) / 10000;
}

/**
 * Builds a stable weekly seed string for a venue.
 * Incorporating the year+week means scores shift each Monday.
 */
function weekSeed(venueName, citySlug) {
  const now  = new Date();
  const week = `${now.getFullYear()}-W${isoWeek(now)}`;
  return `${venueName}::${citySlug}::${week}`;
}

// ── Mock implementations ──────────────────────────────────────────────────────

/**
 * Mock Google Trends score (0–100).
 *
 * Viral venues start from a higher base so the mock roughly mirrors
 * the real world distribution.  Weekly jitter ensures re-runs on the
 * same Monday return identical numbers (idempotent).
 */
function mockGoogleTrends(venueName, citySlug, isViral) {
  const base   = isViral ? 58 : 22;
  const spread = isViral ? 30 : 28;
  const rand   = seededRandom(weekSeed(venueName, citySlug) + "::gt");
  return Math.min(100, Math.round(base + rand * spread));
}

/**
 * Mock TikTok mention count.
 *
 * Uses a separate seed suffix ("::tt") so the TikTok and Google Trends
 * values for the same venue are independent from each other.
 */
function mockTikTokMentions(venueName, citySlug, isViral) {
  const base   = isViral ? 700 : 100;
  const spread = isViral ? 600 : 250;
  const rand   = seededRandom(weekSeed(venueName, citySlug) + "::tt");
  return Math.round(base + rand * spread);
}

// ── Real API stubs ────────────────────────────────────────────────────────────
// Each function below mirrors the signature of its mock counterpart.
// Uncomment and fill in once you have credentials.

/**
 * Fetch interest score from Google Trends (0–100).
 *
 * Package:  npm install google-trends-api
 * Docs:     https://www.npmjs.com/package/google-trends-api
 *
 * Note: google-trends-api is unofficial. For reliable production use,
 * consider SerpAPI (https://serpapi.com) which has a paid tier.
 */
async function realGoogleTrends(venueName, citySlug) {
  // const googleTrends = require("google-trends-api");
  //
  // const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  // const result = await googleTrends.interestOverTime({
  //   keyword:   `${venueName} ${citySlug}`,
  //   startTime: sevenDaysAgo,
  //   geo:       "AU",
  // });
  //
  // const timeline = JSON.parse(result).default.timelineData;
  // const latest   = timeline[timeline.length - 1]?.value[0] ?? 0;
  // return latest; // already 0–100
  throw new Error(
    'Google Trends API not configured. Set TRENDS_MOCK=false only after uncommenting the implementation.'
  );
}

/**
 * Fetch TikTok mention count via Apify's free TikTok scraper.
 *
 * Package:  npm install apify-client
 * Env var:  APIFY_TOKEN  (from https://console.apify.com)
 * Docs:     https://apify.com/clockworks/free-tiktok-scraper
 */
async function realTikTokMentions(venueName) {
  // const { ApifyClient } = require("apify-client");
  //
  // const client = new ApifyClient({ token: process.env.APIFY_TOKEN });
  // const run    = await client.actor("clockworks/free-tiktok-scraper").call({
  //   keywords:       [venueName],
  //   resultsPerPage: 30,
  // });
  //
  // const { items } = await client.dataset(run.defaultDatasetId).listItems();
  // return items.length;
  throw new Error(
    'TikTok (Apify) not configured. Add APIFY_TOKEN to your .env and uncomment the implementation.'
  );
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns a Google Trends interest score (0–100) for a venue this week.
 *
 * @param {string}  venueName
 * @param {string}  citySlug
 * @param {boolean} isViral   — hint used by mock to set realistic base
 * @returns {Promise<number>}
 */
async function fetchGoogleTrends(venueName, citySlug, isViral) {
  if (MOCK_MODE) return mockGoogleTrends(venueName, citySlug, isViral);
  return realGoogleTrends(venueName, citySlug);
}

/**
 * Returns a TikTok mention count for a venue this week.
 *
 * @param {string}  venueName
 * @param {string}  citySlug
 * @param {boolean} isViral
 * @returns {Promise<number>}
 */
async function fetchTikTokMentions(venueName, citySlug, isViral) {
  if (MOCK_MODE) return mockTikTokMentions(venueName, citySlug, isViral);
  return realTikTokMentions(venueName);
}

module.exports = { fetchGoogleTrends, fetchTikTokMentions, MOCK_MODE };
