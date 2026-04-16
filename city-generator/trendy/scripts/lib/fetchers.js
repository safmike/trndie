/**
 * fetchers.js
 * ─────────────────────────────────────────────────────────────────
 * Retrieves trend signals from external sources.
 *
 * SOURCES
 * ───────
 * 1. TikTok via Apify  — city-level discovery queries, one actor run
 *    per city.  Results are mapped back to individual venues by
 *    scanning video text for name mentions.
 *
 * 2. Google Trends  — unofficial google-trends-api npm package.
 *    Per-venue, state-level geo (AU-NSW etc).  Free, no auth needed.
 *
 * TIKTOK QUERY STRATEGY
 * ─────────────────────
 * Rather than one query per venue, we run discovery queries that
 * reflect how users actually search TikTok:
 *
 *   Tier 1 (every city):  "{city} cafe", "trending food {city}",
 *                          "#{city}cafe", "#{city}food"
 *   Tier 2 (per category): "best cafes {city}", "#{city}brunch" …
 *
 * All queries for a city are bundled into a single Apify actor run,
 * returning ~150–300 videos.  Each venue is then scored by how many
 * of those videos mention it by name.
 *
 * Efficiency: 80 actor runs (old) → 8 actor runs (new).
 *
 * FALLBACK
 * ────────
 * Each signal fails independently.  If a real fetch throws, that
 * venue's signal falls back to mock — the run continues unaffected.
 *
 * MODE
 * ────
 * TRENDS_MOCK=false  → real APIs (requires APIFY_TOKEN)
 * TRENDS_MOCK=true   → mock data (default)
 */

"use strict";

// ── Mode toggle ───────────────────────────────────────────────────────────────

const MOCK_MODE = process.env.TRENDS_MOCK !== "false";

// ── Google Trends geo map ─────────────────────────────────────────────────────

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

// ── TikTok query templates ────────────────────────────────────────────────────

// Tier 1: always generated for every city
const CITY_QUERIES = [
  "{city} cafe",
  "trending food {city}",
  "#{city}cafe",
  "#{city}food",
];

// Tier 2: generated once per unique category present in the city
const CATEGORY_QUERIES = {
  cafe:   ["best cafes {city}", "#{city}brunch", "{city} coffee spot"],
  bakery: ["best bakery {city}", "#{city}bakery", "{city} croissant"],
  deli:   ["{city} best sandwich", "#{city}deli"],
};

// Apify actor + fetch limits
const TIKTOK_ACTOR    = "clockworks/free-tiktok-scraper";
const TIKTOK_MAX_EACH = 20;  // videos per query (free-tier friendly)

// Scale raw mention count → scorer's 0–1000 range.
// 20 mentions across ~200 videos = strongly viral → 1000.
const MENTION_SCALE = 50;

// ── Query builder ─────────────────────────────────────────────────────────────

/**
 * Generates all TikTok search queries for a city.
 *
 * @param {string}   citySlug    e.g. "melbourne"
 * @param {string[]} categories  unique categories in the city, e.g. ["cafe","bakery"]
 * @returns {string[]}
 *
 * @example
 * generateCityQueries("perth", ["cafe","bakery","deli"])
 * // → ["perth cafe", "trending food perth", "#perthcafe", "#perthfood",
 * //    "best cafes perth", "#perthbrunch", "perth coffee spot",
 * //    "best bakery perth", "#perthbakery", "perth croissant",
 * //    "perth best sandwich", "#perthdeli"]
 */
function generateCityQueries(citySlug, categories) {
  const fill = (t) => t.replace(/\{city\}/g, citySlug);

  const tier1 = CITY_QUERIES.map(fill);

  const tier2 = categories.flatMap((cat) =>
    (CATEGORY_QUERIES[cat] || []).map(fill)
  );

  // Deduplicate while preserving order
  return [...new Set([...tier1, ...tier2])];
}

// ── Mention counter ───────────────────────────────────────────────────────────

/**
 * Counts how many videos in the dataset mention the venue name.
 *
 * Matches against the video description, hashtag names, and author
 * display name — all lowercased.  Also tries a spaceless version of
 * the name to catch hashtag-style concatenations like "#theglassden".
 *
 * Short names (≤ 4 chars) require an exact word-boundary match to
 * avoid false positives from common words.
 *
 * @param {object[]} items     TikTok video objects from Apify
 * @param {string}   venueName e.g. "The Glass Den"
 * @returns {number}           raw mention count (not yet scaled)
 */
function countMentions(items, venueName) {
  const nameLower    = venueName.toLowerCase().trim();
  const nameNoSpaces = nameLower.replace(/\s+/g, "");
  const isShort      = nameLower.length <= 4;

  return items.filter((video) => {
    const searchable = [
      video.text                    || "",
      video.authorMeta?.nickName    || "",
      video.authorMeta?.name        || "",
      ...(video.hashtags || []).map((h) => h.name || ""),
    ].join(" ").toLowerCase();

    if (isShort) {
      // Require word boundaries for short names to avoid noise
      const pattern = new RegExp(`\\b${nameLower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
      return pattern.test(searchable);
    }

    return searchable.includes(nameLower) || searchable.includes(nameNoSpaces);
  }).length;
}

// ── Mock helpers ──────────────────────────────────────────────────────────────

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

// ── Fallback wrapper ──────────────────────────────────────────────────────────

async function withFallback(realFn, mockFn, label) {
  try {
    return await realFn();
  } catch (err) {
    const msg = String(err.message || err).slice(0, 100);
    console.warn(`     ⚠️  ${label} — failed (${msg}), using mock`);
    return mockFn();
  }
}

// ── Real: TikTok city prefetch ────────────────────────────────────────────────

/**
 * Runs one Apify actor call for the entire city, fetching videos from
 * multiple discovery queries.  Returns a Map of venue name → scaled
 * TikTok mention count (0–1000, compatible with scorer.js).
 *
 * Call once per city before scoring the venue loop — vastly more
 * efficient than one actor run per venue.
 *
 * @param {string}   citySlug  e.g. "melbourne"
 * @param {object[]} venues    venue objects for this city
 * @returns {Promise<Map<string, number>>}  venueName → scaledCount
 */
async function prefetchCityTikTok(citySlug, venues) {
  const { ApifyClient } = require("apify-client");
  const client = new ApifyClient({ token: process.env.APIFY_TOKEN });

  const categories = [...new Set(venues.map((v) => v.category))];
  const queries    = generateCityQueries(citySlug, categories);

  console.log(`     🔍 TikTok: ${queries.length} queries → 1 actor run`);

  const run = await client.actor(TIKTOK_ACTOR).call(
    {
      searchQueries:    queries,
      maxItems:         TIKTOK_MAX_EACH,  // per query
      proxyCountryCode: "AU",
    },
    { waitSecs: 300 }  // up to 5 minutes for multi-query runs
  );

  const { items } = await client.dataset(run.defaultDatasetId).listItems();
  console.log(`     📦 ${items.length} videos fetched`);

  // Map each venue to its mention count across all fetched videos
  const mentionMap = new Map();
  for (const venue of venues) {
    const raw    = countMentions(items, venue.name);
    const scaled = Math.round(Math.min(1000, raw * MENTION_SCALE));
    mentionMap.set(venue.name, scaled);

    if (raw > 0) {
      console.log(`        ↳ ${venue.name}: ${raw} mention${raw !== 1 ? "s" : ""} → ${scaled}`);
    }
  }

  return mentionMap;
}

// ── Real: Google Trends ───────────────────────────────────────────────────────

/**
 * Fetches a Google Trends interest score (0–100) for the venue name
 * within the appropriate Australian state over the past 7 days.
 */
async function realGoogleTrends(venueName, citySlug) {
  const googleTrends = require("google-trends-api");
  const geo       = GEO[citySlug] || "AU";
  const startTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const raw      = await googleTrends.interestOverTime({ keyword: venueName, startTime, geo });
  const timeline = JSON.parse(raw).default?.timelineData;
  if (!timeline || timeline.length === 0) return 0;

  // Average last 3 data points for stability
  const recent = timeline.slice(-3);
  const avg    = recent.reduce((sum, p) => sum + (p.value?.[0] ?? 0), 0) / recent.length;
  return Math.round(avg);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Pre-fetches TikTok signals for an entire city in one Apify actor run.
 * Returns Map<venueName, scaledMentionCount> or null in mock mode.
 *
 * Call this once at the top of processCity() before the venue loop.
 * If it fails, returns null — the caller should fall back to per-venue mock.
 */
async function fetchCityTikTokSignals(citySlug, venues) {
  if (MOCK_MODE) return null;
  return withFallback(
    ()  => prefetchCityTikTok(citySlug, venues),
    ()  => null,   // null → caller uses mock per venue
    `TikTok prefetch [${citySlug}]`
  );
}

/**
 * Returns a Google Trends interest score (0–100) for a venue this week.
 * Falls back to mock if the real call fails.
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
 * Returns a TikTok mention count for a single venue.
 * Used as fallback when the city prefetch is unavailable (mock mode or error).
 */
function getTikTokFromMap(tiktokMap, venueName, citySlug, isViral) {
  if (tiktokMap) return tiktokMap.get(venueName) ?? 0;
  return mockTikTokMentions(venueName, citySlug, isViral);
}

module.exports = {
  fetchCityTikTokSignals,
  fetchGoogleTrends,
  getTikTokFromMap,
  generateCityQueries,  // exported for testing
  MOCK_MODE,
};
