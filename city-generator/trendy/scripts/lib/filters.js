/**
 * filters.js
 * ─────────────────────────────────────────────────────────────────
 * Phase 2 — post-extraction scope filters.
 *
 * Two filters run sequentially on every Claude-extracted mention:
 *
 *   1. CAFE TYPE — keep only `venue_type` ∈ CAFE_IN_SCOPE.
 *        Drops pubs, bars, wine bars, dinner/fine-dining restaurants,
 *        nightclubs, and pure dessert / gelato / ice-cream shops.
 *        The reference edge cases (per the brief) are cafe-bakeries that
 *        serve coffee + daytime food (e.g. Paddock Bakery, Bam Bam
 *        Bakehouse) — captured by the cafe_bakery type.
 *
 *   2. GEO — accept the mention's suburb only if it's in the city's
 *        Greater-Metro whitelist (config/city_suburbs.json).
 *        Non-matching suburbs are REJECTED outright. Missing suburb is
 *        HELD as "needs_location_check" — surfaced in the report,
 *        excluded from aggregation, never auto-included.
 *
 * The two filters intentionally distinguish REJECT (out of scope and
 * not coming back) from HOLD (in scope but needs more info). Held
 * mentions get a queue of their own in the report so Mike can decide.
 */

"use strict";

const fs = require("fs");

/** venue_type values that count as in-scope cafes. */
const CAFE_IN_SCOPE = new Set([
  "cafe",
  "espresso_bar",
  "coffee_roaster",
  "brunch_spot",
  "cafe_bakery",
]);

/** venue_type values that are explicitly out of scope. Anything not on the
 *  IN list is rejected — this is here only for clearer error messages /
 *  report categorisation when Claude returns one of these labels. */
const KNOWN_OUT_OF_SCOPE = new Set([
  "pub",
  "bar",
  "wine_bar",
  "cocktail_bar",
  "restaurant",
  "fine_dining",
  "nightclub",
  "dessert_shop",
  "gelato_shop",
  "ice_cream_shop",
  "bakery",          // pure bakery (no coffee/daytime food) — narrower than cafe_bakery
  "other",
]);

// ── Suburb whitelist ──────────────────────────────────────────────────────────

/**
 * Normalise a suburb name for whitelist matching.
 *   - lowercase
 *   - strip non-alphanumeric (collapses "St Kilda" / "St. Kilda" / "St-Kilda")
 *   - collapse whitespace
 *   - drop a leading "melbourne " (catches "Melbourne CBD" → "cbd")
 */
function normaliseSuburb(s) {
  if (!s) return "";
  let k = String(s).toLowerCase().trim();
  k = k.replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
  if (k.startsWith("melbourne ")) k = k.slice("melbourne ".length);
  return k;
}

/**
 * Load the Greater Melbourne suburb whitelist into a Set of normalised
 * keys, plus a fast lookup function. Throws if the configured `city`
 * doesn't match the requested one.
 */
function loadCitySuburbs(configPath, city) {
  const cfg = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  if (cfg.city !== city) {
    throw new Error(
      `city_suburbs.json: configured city "${cfg.city}" does not match requested city "${city}"`,
    );
  }
  const set = new Set();
  for (const s of cfg.suburbs || []) set.add(normaliseSuburb(s));
  return {
    city,
    raw_count: (cfg.suburbs || []).length,
    set,
    has(suburb) {
      return set.has(normaliseSuburb(suburb));
    },
  };
}

// ── Filter pipeline ───────────────────────────────────────────────────────────

/**
 * Apply cafe-type and geo filters to a flat array of extracted mentions.
 * Returns { kept, rejected, held } — three disjoint arrays.
 *
 * Each rejected/held entry carries a `reject_reason` / `hold_reason`
 * so the report can surface why.
 *
 * @param {Array<object>} mentions  extracted mentions
 * @param {{ citySuburbs: ReturnType<typeof loadCitySuburbs> }} opts
 */
function applyScopeFilters(mentions, { citySuburbs }) {
  const kept     = [];
  const rejected = [];
  const held     = [];

  for (const m of mentions) {
    // Cafe-type check
    const raw       = String(m.venue_type || "").trim().toLowerCase();
    const venueType = raw.replace(/\s+/g, "_").replace(/-/g, "_");

    if (!venueType) {
      // No type → cannot determine scope; hold for review.
      held.push({ ...m, venue_type: null, hold_reason: "missing_venue_type" });
      continue;
    }
    if (!CAFE_IN_SCOPE.has(venueType)) {
      rejected.push({
        ...m,
        venue_type:     venueType,
        reject_reason:  KNOWN_OUT_OF_SCOPE.has(venueType)
          ? "out_of_scope_type"
          : "unknown_venue_type",
      });
      continue;
    }

    // Geo check
    if (!m.suburb) {
      held.push({ ...m, venue_type: venueType, hold_reason: "missing_suburb" });
      continue;
    }
    if (!citySuburbs.has(m.suburb)) {
      rejected.push({
        ...m,
        venue_type:        venueType,
        reject_reason:     "suburb_not_in_whitelist",
        suburb_normalised: normaliseSuburb(m.suburb),
      });
      continue;
    }

    kept.push({ ...m, venue_type: venueType });
  }

  return { kept, rejected, held };
}

module.exports = {
  CAFE_IN_SCOPE,
  KNOWN_OUT_OF_SCOPE,
  normaliseSuburb,
  loadCitySuburbs,
  applyScopeFilters,
};
