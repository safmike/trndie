#!/usr/bin/env node
/**
 * update-trends.js
 * ─────────────────────────────────────────────────────────────────
 * PHASE 1 — THE BRIDGE
 *
 * Re-points the salvaged trend pipeline at the live v2.1 data store
 * (repo-root data/ranked_<slug>.json) and runs a deterministic,
 * inertia-only pass: read → score → write.
 *
 *   1. Read each city's v2.1 ranked JSON (lib/cityData.js)
 *   2. Carry composite_score forward unchanged; re-derive rank
 *      (lib/scorer.js) — no external signals, no randomness
 *   3. Write valid v2.1 JSON back, preserving every other field
 *      (tier, published, trending_copy, vibe_tags, must_try,
 *       source_urls, first_discovered, methodology_version, …)
 *
 * This is intentionally a near-no-op: it proves the loop on live data
 * with NO external network calls. The TikTok/Apify and Google Trends
 * fetchers are deliberately NOT imported here, so no external call can
 * happen. Editorial / Trends / Places signals arrive in later phases.
 *
 * USAGE
 * ─────
 *   npm run update-trends                  # all cities, write
 *   npm run update-trends -- --city sydney # single city
 *   npm run update-trends -- --dry-run     # print what would change, write nothing
 */

"use strict";

const { listCities, readCity, writeCity } = require("./lib/cityData");
const { scoreVenue, rankVenues }          = require("./lib/scorer");

// ── CLI args ──────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { city: null, dryRun: false };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--city" && args[i + 1]) opts.city = args[++i];
    else if (a === "--dry-run" || a === "--dryRun") opts.dryRun = true;
    // --category is accepted (workflow_dispatch passes it) but unused in Phase 1
    else if (a === "--category" && args[i + 1]) i++;
  }
  return opts;
}

// ── Per-city processing ───────────────────────────────────────────────────────

/**
 * Reads one city, applies inertia-only scoring, and (unless dry-run)
 * writes the result back. Returns a small drift report so the run can
 * prove it was a near-no-op.
 */
function processCity(citySlug, opts) {
  const cityData = readCity(citySlug);
  const venues   = cityData.venues || [];

  const scored = venues.map((v) => ({ ...v, ...scoreVenue(v) }));
  const ranked = rankVenues(scored);

  // Drift check vs. input — Phase 1 must not change scores or order.
  let scoreChanges = 0;
  let rankChanges  = 0;
  for (const v of ranked) {
    const orig = venues.find((o) => o.venue_name === v.venue_name);
    if (!orig) continue;
    if (orig.composite_score !== v.composite_score) scoreChanges++;
    if (orig.rank !== v.rank) rankChanges++;
  }

  // Spread keeps original key order; `venues` is overwritten in place.
  const output = { ...cityData, venues: ranked };

  const summary =
    `${ranked.length} venues · ${scoreChanges} score change(s) · ${rankChanges} rank change(s)`;

  if (opts.dryRun) {
    console.log(`     ↳ would write ${summary}  [dry-run, nothing written]`);
  } else {
    writeCity(citySlug, output);
    console.log(`     ✓ ${summary}`);
  }
}

// ── Entry point ───────────────────────────────────────────────────────────────

function main() {
  const opts = parseArgs();

  console.log(`\n🔄  TRNDIE trend update  [PHASE 1 — bridge · inertia-only · no external calls]`);
  console.log(`    ${opts.city ? `city=${opts.city}` : "all cities"}${opts.dryRun ? " · dry-run" : ""}\n`);

  const cities = opts.city ? [opts.city] : listCities();
  let errors = 0;

  for (const slug of cities) {
    process.stdout.write(`📍  ${slug}\n`);
    try {
      processCity(slug, opts);
    } catch (err) {
      console.error(`     ✗ ${err.message}`);
      errors++;
    }
  }

  console.log(`\n${errors ? `⚠️  Finished with ${errors} error(s).` : "✅  Done."}`);
  if (!opts.dryRun) {
    console.log(`    Run  npm run build  to rebuild the site with the new rankings.`);
  }
  console.log("");

  if (errors) process.exit(1);
}

main();
