/**
 * scorer.js
 * ─────────────────────────────────────────────────────────────────
 * Phase 1 (the bridge): inertia-only scoring on the v2.1 schema.
 *
 * The composite_score (0–1) is carried forward UNCHANGED. There are no
 * external signals (Google Trends / TikTok are bypassed in Phase 1) and
 * no seeded-random mock scoring. rank is re-derived from composite_score
 * descending — which, given scores are unchanged and the input is already
 * ranked, leaves the order untouched.
 *
 * Net effect is a near-no-op: it proves the read → score → write loop on
 * live v2.1 data without injecting any noise. The reconciled multi-signal
 * model (editorial + inertia + trends + rating/reviews) lands in later
 * phases per PIPELINE_BUILD.md.
 */

"use strict";

/**
 * Returns the scoring fields to merge back into a venue.
 * Phase 1: composite_score is carried forward exactly as-is.
 *
 * @param {object} venue  v2.1 venue object
 * @returns {{ composite_score: number }}
 */
function scoreVenue(venue) {
  const composite_score =
    typeof venue.composite_score === "number" ? venue.composite_score : 0;
  return { composite_score };
}

/**
 * Sorts venues by composite_score (highest first) and re-derives `rank`
 * (1-based). Array.prototype.sort is stable, so venues with equal scores
 * keep their input order — keeping a no-op run a true no-op.
 * Does not mutate the input array.
 *
 * @param {object[]} venues
 * @returns {object[]}
 */
function rankVenues(venues) {
  return [...venues]
    .sort((a, b) => b.composite_score - a.composite_score)
    .map((venue, i) => ({ ...venue, rank: i + 1 }));
}

module.exports = { scoreVenue, rankVenues };
