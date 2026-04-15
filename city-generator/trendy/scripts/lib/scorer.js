/**
 * scorer.js
 * ─────────────────────────────────────────────────────────────────
 * Converts raw trend signals into a normalised ranking score and
 * determines the viral flag for each venue.
 *
 * FORMULA
 * ───────
 *   new_score = (existing_score  × INERTIA)
 *             + (google_trends   × WEIGHT_TRENDS)   ← normalised to 0–10
 *             + (tiktok_mentions × WEIGHT_TIKTOK)   ← normalised to 0–10
 *
 * Weights are configurable below. They must sum to 1.0.
 *
 * INERTIA keeps a well-established venue from crashing because it had
 * one quiet week. Reduce it (e.g. 0.3) if you want rankings to move
 * faster, or increase it (e.g. 0.7) for more stability.
 */

"use strict";

// ── Configurable weights ──────────────────────────────────────────────────────

const WEIGHTS = {
  INERTIA:  0.50, // carry-forward weight of last week's score
  TRENDS:   0.30, // Google Trends signal weight
  TIKTOK:   0.20, // TikTok mention weight
  // Must sum to 1.0 ↑
};

// A venue is marked viral if its new score meets or exceeds this threshold
const VIRAL_THRESHOLD = 7.5;

// TikTok mention count that maps to a perfect 10/10 signal
// (counts above this soft-cap are treated as equivalent)
const TIKTOK_SOFT_CAP = 1000;

// ── Normalisation helpers ─────────────────────────────────────────────────────

/**
 * Normalises a Google Trends score (0–100) to the 0–10 scale used
 * throughout the scoring system.
 *
 * @param {number} raw  0–100
 * @returns {number}    0–10
 */
function normaliseTrends(raw) {
  return (Math.min(100, Math.max(0, raw)) / 100) * 10;
}

/**
 * Normalises a TikTok mention count to 0–10 using a soft cap so that
 * a viral venue with 5 000 mentions doesn't dwarf one with 1 100.
 *
 * @param {number} count  raw mention count
 * @returns {number}      0–10
 */
function normaliseTikTok(count) {
  return Math.min(10, (Math.max(0, count) / TIKTOK_SOFT_CAP) * 10);
}

// ── Core scoring ──────────────────────────────────────────────────────────────

/**
 * Calculates updated fields for a single venue.
 *
 * If the venue has an `override_score` set by a curator, auto-scoring
 * is skipped entirely — the override wins.
 *
 * @param {object} venue    - venue object as stored in the JSON
 * @param {object} signals  - { googleTrends: number, tiktokMentions: number }
 * @returns {object} fields to merge back into the venue:
 *                   { ranking_score, viral, trend_signals }
 */
function scoreVenue(venue, signals) {
  // ── Curator override: respect manual scores without touching them ──
  if (venue.override_score != null) {
    return {
      ranking_score: venue.override_score,
      viral:         venue.override_score >= VIRAL_THRESHOLD,
      trend_signals: venue.trend_signals ?? null, // preserve existing audit data
    };
  }

  // ── Auto-score ────────────────────────────────────────────────────
  const existing = typeof venue.ranking_score === "number" ? venue.ranking_score : 5.0;

  const blended =
    existing                              * WEIGHTS.INERTIA +
    normaliseTrends(signals.googleTrends) * WEIGHTS.TRENDS  +
    normaliseTikTok(signals.tiktokMentions) * WEIGHTS.TIKTOK;

  // Clamp to [1.0, 10.0] and round to one decimal place
  const ranking_score = Math.round(Math.min(10, Math.max(1, blended)) * 10) / 10;

  return {
    ranking_score,
    viral: ranking_score >= VIRAL_THRESHOLD,
    trend_signals: {
      google_trends:    signals.googleTrends,
      tiktok_mentions:  signals.tiktokMentions,
      last_scored:      new Date().toISOString().split("T")[0], // "YYYY-MM-DD"
    },
  };
}

/**
 * Sorts an array of venues by ranking_score (highest first) and returns
 * the top N.  Does not mutate the original array.
 *
 * @param {object[]} venues
 * @param {number}   limit   default 10
 * @returns {object[]}
 */
function rankVenues(venues, limit = 10) {
  return [...venues]
    .sort((a, b) => b.ranking_score - a.ranking_score)
    .slice(0, limit);
}

module.exports = { scoreVenue, rankVenues, VIRAL_THRESHOLD };
