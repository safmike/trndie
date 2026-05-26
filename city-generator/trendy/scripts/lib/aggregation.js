/**
 * aggregation.js
 * ─────────────────────────────────────────────────────────────────
 * Phase 2 — cross-source aggregation + editorial-signal scoring.
 *
 * Input: a flat stream of mention rows, one per (venue × article):
 *   { source, source_tier, url, title, mention_date, venue_name, suburb, why }
 *
 * Output: per-venue aggregates with
 *   - distinct_sources       : list of tier-1 sources that surfaced the venue
 *   - distinct_source_count
 *   - lock_in                : true when distinct_source_count >= LOCK_IN_DISTINCT_SOURCES
 *   - editorial_signal       : recency × source-weight × independence-ladder, capped at 1.0
 *   - mentions               : surviving (within-window, deduped) mention details
 *
 * Weights are EXPLICIT constants on PHASE2_WEIGHTS so we can tune them
 * cheaply during the feel-it-out phase. They are deliberately NOT the
 * final composite blend — Phase 3+ folds editorial_signal into the
 * methodology's full composite_score alongside trends + places + inertia.
 */

"use strict";

/**
 * WIP weights. Mirror TRENDING_METHODOLOGY.md v2.1 Stage 5 where
 * applicable; deviate only where Phase 2's narrower scope demands it.
 * Treat every entry as tunable.
 */
const PHASE2_WEIGHTS = Object.freeze({
  // Mentions older than this drop out of the signal entirely.
  RECENCY_WINDOW_DAYS: 14,

  // nth distinct-source mention is multiplied by INDEPENDENCE_LADDER[n-1].
  // Past the array end, mentions get the trailing value.
  INDEPENDENCE_LADDER: [1.0, 0.7, 0.5, 0.3, 0.2],

  // Per-source quality nudge. All three Phase 2 sources are tier-1, but
  // Broadsheet's editorial reputation justifies a small lift (per the
  // methodology's source_weight=1.2 for Broadsheet). Tunable.
  SOURCE_WEIGHT: {
    broadsheet:          1.2,
    concrete_playground: 1.0,
    time_out:            1.0,
  },
  DEFAULT_SOURCE_WEIGHT: 1.0,

  // Lock-in fires when N+ independent tier-1 sources surface a venue
  // inside the recency window.
  LOCK_IN_DISTINCT_SOURCES: 2,
});

/**
 * Canonicalise a venue name for cross-source matching. Lowercases, drops
 * smart-quotes/punctuation, normalises ampersands, collapses whitespace,
 * and strips a leading "the". Keep this tight — string-matching is the
 * known weak link; Phase 3+ plans to move to place_id-based identity.
 */
function venueKey(name) {
  if (!name) return "";
  let k = String(name).toLowerCase().trim();
  k = k.replace(/[‘’']/g, "");
  k = k.replace(/&/g, " and ");
  k = k.replace(/[^a-z0-9 ]+/g, " ");
  k = k.replace(/\s+/g, " ").trim();
  k = k.replace(/^the /, "");
  return k;
}

function parseMentionDate(s) {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function daysBetween(later, earlier) {
  return Math.floor((later.getTime() - earlier.getTime()) / 86400000);
}

function round3(n) {
  return Math.round(n * 1000) / 1000;
}

/**
 * Aggregate a mention stream into per-venue records.
 *
 * @param {Array<object>} stream
 * @param {Date}          [now]
 * @returns {Array<object>}  sorted by editorial_signal desc
 */
function aggregate(stream, now = new Date()) {
  const buckets = new Map();

  for (const m of stream) {
    const key = venueKey(m.venue_name);
    if (!key) continue;
    if (!buckets.has(key)) {
      buckets.set(key, {
        venue_name: m.venue_name,
        suburb:     m.suburb || null,
        venue_key:  key,
        mentions:   [],
      });
    }
    const bucket = buckets.get(key);
    if (!bucket.suburb && m.suburb) bucket.suburb = m.suburb;
    bucket.mentions.push(m);
  }

  const results = [];
  for (const bucket of buckets.values()) {
    // 1) Same-source dedupe within the recency window — keep most recent.
    const bySource = new Map();
    for (const m of bucket.mentions) {
      const d = parseMentionDate(m.mention_date);
      if (!d) continue;
      const age = daysBetween(now, d);
      if (age < 0) continue;                                    // future-dated; skip
      if (age > PHASE2_WEIGHTS.RECENCY_WINDOW_DAYS) continue;   // stale; drops out
      const prev = bySource.get(m.source);
      if (!prev || parseMentionDate(prev.mention_date) < d) {
        bySource.set(m.source, m);
      }
    }

    // 2) Sort surviving mentions by recency (newest first).
    const survivors = [...bySource.values()].sort(
      (a, b) =>
        parseMentionDate(b.mention_date) - parseMentionDate(a.mention_date),
    );

    // 3) Score: Σ ( recency × source_weight × independence )
    let signal = 0;
    const surviving_mentions = survivors.map((m, i) => {
      const d   = parseMentionDate(m.mention_date);
      const age = daysBetween(now, d);
      const recency_weight = Math.max(
        0,
        1 - age / PHASE2_WEIGHTS.RECENCY_WINDOW_DAYS,
      );
      const source_weight =
        PHASE2_WEIGHTS.SOURCE_WEIGHT[m.source] ||
        PHASE2_WEIGHTS.DEFAULT_SOURCE_WEIGHT;
      const ladder = PHASE2_WEIGHTS.INDEPENDENCE_LADDER;
      const independence_factor =
        i < ladder.length ? ladder[i] : ladder[ladder.length - 1];
      const contribution = recency_weight * source_weight * independence_factor;
      signal += contribution;
      return {
        source: m.source,
        url:    m.url,
        title:  m.title,
        mention_date: m.mention_date,
        why:    m.why || null,
        age_days: age,
        recency_weight:      round3(recency_weight),
        source_weight,
        independence_factor,
        contribution:        round3(contribution),
      };
    });

    const distinct_sources      = survivors.map((m) => m.source);
    const distinct_source_count = distinct_sources.length;
    const editorial_signal      = Math.min(signal, 1.0);

    results.push({
      venue_name:               bucket.venue_name,
      suburb:                   bucket.suburb,
      venue_key:                bucket.venue_key,
      distinct_sources,
      distinct_source_count,
      lock_in:
        distinct_source_count >= PHASE2_WEIGHTS.LOCK_IN_DISTINCT_SOURCES,
      editorial_signal:         round3(editorial_signal),
      editorial_signal_uncapped: round3(signal),
      surviving_mentions,
      all_mentions_count:       bucket.mentions.length,
    });
  }

  return results.sort((a, b) => b.editorial_signal - a.editorial_signal);
}

module.exports = { aggregate, venueKey, PHASE2_WEIGHTS };
