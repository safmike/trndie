/**
 * fetchers.js
 * ─────────────────────────────────────────────────────────────────
 * Retrieves trend signals from external sources.
 *
 * SOURCES
 * ───────
 * 1. Google Trends  — unofficial google-trends-api npm package.
 *    Free, no auth required.  Returns 0–100 interest score per region.
 *
 * 2. TikTok via Apify — clockworks/free-tiktok-scraper actor.
 *    Requires APIFY_TOKEN env var (free tier: $5/month credit).
 *    Returns video objects; we use total play count as the signal.
 *
 * FALLBACK
 * ────────
 * Each signal fails independently.  If a real fetch throws, that
 * venue's signal falls back to mock for that run only — the other
 * signal and other venues are unaffected.
 *
 * MODE
 * ────
 * TRENDS_MOCK=false  → real APIs (requires APIFY_TOKEN for TikTok)
 * TRENDS_MOCK=true   → mock data (default, no credentials needed)
 *
 * The mode is set automatically by the GitHub Actions workflow based
 * on whether APIFY_TOKEN secret is present.
 */

"use strict";

// ── Mode toggle ───────────────────────────────────────────────────────────────

const MOCK_MODE = process.env.TRENDS_MOCK !== "false";

// ── Google Trends geo map ─────────────────────────────────────────────────────
// State-level geo codes give more relevant signals than national "AU".

const GEO = {
  sydney:    "AU-NSW",
  newcastle: "AU-NSW",
  melbourne: "AU-VIC",
  brisbane:  "AU-QLD",
  goldcoast: "AU-QLD",
  perth:     "AU-WA",
  adelaide:  "AU-SA",
  canberra:  "AU-ACT",
};

// ── Apify actor config ────────────────────────────────────────────────────────

const TIKTOK_ACTOR   = "clockworks/free-tiktok-scraper";
const TIKTOK_MAX     = 30;   // videos per search — free-tier friendly
// Scale: 30 results = fully viral = 1000 "mentions" (scorer's soft cap)
const TIKTOK_SCALE   = 1000 / TIKTOK_MAX;

// ── Shared mock helpers ───────────────────────────────────────────────────────

function isoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

function seededRandom(seed) {
  let hash = 5381;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) + hash) ^ seed.charCodeAt(i);
    hash = hash >>> 0;
  }
  return (hash % 10000) / 10000;
}

function weekSeed(venueName, citySlug) {
  const now  = new Date();
  const week = `${now.getFullYear()}-W${isoWeek(now)}`;
  return `${venueName}::${citySlug}::${week}`;
}

function mockGoogleTrends(venueName, citySlug, isViral) {
  const base   = isViral ? 58 : 22;
  const spread = isViral ? 30 : 28;
  return Math.min(100, Math.round(base + seededRandom(weekSeed(venueName, citySlug) + "::gt") * spread));
}

function mockTikTokMentions(venueName, citySlug, isViral) {
  const base   = isViral ? 700 : 100;
  const spread = isViral ? 600 : 250;
  return Math.round(base + seededRandom(weekSeed(venueName, citySlug) + "::tt") * spread);
}

// ── Real: Google Trends ───────────────────────────────────────────────────────

/**
 * Fetches a Google Trends interest score (0–100) for the venue name
 * within the appropriate Australian state over the past 7 days.
 *
 * Uses the unofficial google-trends-api package.  Falls back to mock
 * automatically via withFallback() if Google blocks the request.
 */
async function realGoogleTrends(venueName, citySlug) {
  const googleTrends = require("google-trends-api");
  const geo = GEO[citySlug] || "AU";
  const startTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const raw = await googleTrends.interestOverTime({
    keyword:   venueName,
    startTime,
    geo,
  });

  const timeline = JSON.parse(raw).default?.timelineData;
  if (!timeline || timeline.length === 0) return 0;

  // Average last 3 points — smooths out single-day spikes
  const recent = timeline.slice(-3);
  const avg = recent.reduce((sum, p) => sum + (p.value?.[0] ?? 0), 0) / recent.length;
  return Math.round(avg); // 0–100
}

// ── Real: TikTok via Apify ────────────────────────────────────────────────────

/**
 * Searches TikTok for the venue name + city via Apify's free TikTok
 * scraper and returns a scaled mention count.
 *
 * Metric: number of videos returned (capped at TIKTOK_MAX) × TIKTOK_SCALE.
 * More videos in search results = more content creation = higher trending signal.
 * 30 results (max) → 1000 "mentions" (scorer's soft cap = peak score).
 *
 * Requires APIFY_TOKEN env var.
 */
async function realTikTokMentions(venueName, citySlug) {
  const { ApifyClient } = require("apify-client");
  const client = new ApifyClient({ token: process.env.APIFY_TOKEN });

  const run = await client.actor(TIKTOK_ACTOR).call(
    {
      searchQueries:   [`${venueName} ${citySlug}`],
      maxItems:        TIKTOK_MAX,
      proxyCountryCode: "AU",
    },
    { waitSecs: 180 } // wait up to 3 minutes for the actor run
  );

  const { items } = await client.dataset(run.defaultDatasetId).listItems();
  return Math.round(Math.min(items.length, TIKTOK_MAX) * TIKTOK_SCALE);
}

// ── Fallback wrapper ──────────────────────────────────────────────────────────

/**
 * Runs realFn; if it throws, logs a warning and returns mockFn() instead.
 * This makes each signal fail independently — one bad API call does not
 * abort the venue or the city.
 */
async function withFallback(realFn, mockFn, label) {
  try {
    return await realFn();
  } catch (err) {
    const msg = String(err.message || err).slice(0, 100);
    console.warn(`     ⚠️  ${label} — real API failed (${msg}), using mock`);
    return mockFn();
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns a Google Trends interest score (0–100) for a venue this week.
 * Uses real Google Trends in live mode, mock otherwise.
 * Falls back to mock automatically if the real call fails.
 */
async function fetchGoogleTrends(venueName, citySlug, isViral) {
  if (MOCK_MODE) return mockGoogleTrends(venueName, citySlug, isViral);
  return withFallback(
    ()  => realGoogleTrends(venueName, citySlug),
    ()  => mockGoogleTrends(venueName, citySlug, isViral),
    `Google Trends [${venueName}]`
  );
}

/**
 * Returns a scaled TikTok mention count (0–1000) for a venue this week.
 * Uses Apify in live mode, mock otherwise.
 * Falls back to mock automatically if the real call fails.
 */
async function fetchTikTokMentions(venueName, citySlug, isViral) {
  if (MOCK_MODE) return mockTikTokMentions(venueName, citySlug, isViral);
  return withFallback(
    ()  => realTikTokMentions(venueName, citySlug),
    ()  => mockTikTokMentions(venueName, citySlug, isViral),
    `TikTok/Apify [${venueName}]`
  );
}

module.exports = { fetchGoogleTrends, fetchTikTokMentions, MOCK_MODE };
