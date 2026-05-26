/**
 * attribution.js
 * ─────────────────────────────────────────────────────────────────
 * Phase 2 — map aggregated mentions to v2.1 `source_urls` entries.
 *
 * v2.1 source_urls element shape (TRENDING_METHODOLOGY.md Stage 7):
 *
 *   { "source": "broadsheet", "tier": 1, "url": "https://..." }
 *
 * Schema-vs-Phase-2 reconciliation:
 * The Phase 2 task brief speaks of "(publication, url, date)" attribution
 * but the v2.1 schema only carries (source, tier, url). Phase 2 captures
 * mention_date upstream (it's needed for recency scoring) but does NOT
 * inject it into source_urls — extending the schema is a deliberate
 * decision we'd land in v2.2, not silently here. If/when source_urls
 * grows a date field, this module is the single point that needs to
 * learn about it; the rest of the pipeline already carries the date.
 *
 * No ranked_*.json is touched by Phase 2 — the runner only previews the
 * source_urls block per venue in its findings report.
 */

"use strict";

/**
 * Map an aggregated venue record's surviving mentions to a v2.1
 * `source_urls` array. Deduplicates by URL and preserves the tier from
 * config/editorial_sources.json (via the sourceTiers lookup).
 *
 * @param {object} aggregatedVenue  output of aggregation.aggregate()
 * @param {{ sourceTiers: Record<string, number> }} opts
 * @returns {Array<{source: string, tier: number, url: string}>}
 */
function toSourceUrls(aggregatedVenue, { sourceTiers = {} } = {}) {
  const seen = new Set();
  const out  = [];
  for (const m of aggregatedVenue.surviving_mentions || []) {
    if (!m.url) continue;
    if (seen.has(m.url)) continue;
    seen.add(m.url);
    out.push({
      source: m.source,
      tier:   sourceTiers[m.source] ?? 1,
      url:    m.url,
    });
  }
  return out;
}

module.exports = { toSourceUrls };
