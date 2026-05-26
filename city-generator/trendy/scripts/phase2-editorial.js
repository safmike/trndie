#!/usr/bin/env node
/**
 * phase2-editorial.js
 * ─────────────────────────────────────────────────────────────────
 * PHASE 2 — Editorial signal MVP, OBSERVE-ONLY.
 *
 * Standalone runner that exercises the new editorial pipeline against
 * a single pilot city (Melbourne) and produces a findings report. It
 * does NOT modify any ranked_*.json. It is NOT wired into
 * update-trends.js yet — that is the next step, gated on this run
 * being reviewed (see PIPELINE_BUILD.md Phase 2).
 *
 * Stages:
 *   1) Read config/editorial_sources.json → tier-1 feeds for the city.
 *   2) Load each feed (live HTTP or fixture file).
 *   3) Resolve full article text per feed item.
 *   4) Extract venue mentions via Claude (live) or fixture sidecar JSON.
 *   5) Aggregate cross-source: distinct-source count, recency-weighted
 *      editorial_signal, lock-in flag (2+ tier-1 sources).
 *   6) Map mentions → v2.1 source_urls (preview only).
 *   7) Cross-reference current ranked_<city>.json: NEW candidates vs.
 *      reinforcement of already-ranked venues.
 *   8) Write a JSON findings report under pipeline-reports/.
 *
 * USAGE
 * ─────
 *   node scripts/phase2-editorial.js                       # default: --fixtures
 *   node scripts/phase2-editorial.js --live                # requires network + ANTHROPIC_API_KEY
 *   node scripts/phase2-editorial.js --verify-feeds        # just HEAD the configured feed URLs
 *   node scripts/phase2-editorial.js --city melbourne --out path/to/report.json
 *
 * Flags:
 *   --city <slug>       pilot city (default: melbourne)
 *   --fixtures          use fixtures/editorial/<city>/ (default if --live not set)
 *   --live              fetch real feeds and call Claude
 *   --extractor claude|fixture
 *                       extractor mode; defaults to "fixture" with --fixtures, "claude" otherwise
 *   --out <path>        override report path
 *   --no-write          print only; persist nothing
 *   --verify-feeds      HEAD/GET each feed URL and report status; skip extraction
 */

"use strict";

const fs   = require("fs");
const path = require("path");

const {
  readConfig,
  selectSourcesForCity,
  loadFeed,
  loadArticleText,
} = require("./lib/sources/editorial");
const {
  extractWithClaude,
  extractFromFixtureSidecar,
  DEFAULT_MODEL,
} = require("./lib/extraction");
const { aggregate, venueKey, PHASE2_WEIGHTS } = require("./lib/aggregation");
const { toSourceUrls } = require("./lib/attribution");

const REPO_ROOT     = path.resolve(__dirname, "../../..");
const CONFIG_PATH   = path.join(REPO_ROOT, "config/editorial_sources.json");
const FIXTURES_BASE = path.join(__dirname, "..", "fixtures", "editorial");
const DATA_DIR      = path.join(REPO_ROOT, "data");
const REPORTS_DIR   = path.join(REPO_ROOT, "pipeline-reports");

// ── CLI args ──────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    city:        "melbourne",
    mode:        null, // "live" | "fixtures"
    extractor:   null, // "claude" | "fixture"
    out:         null,
    write:       true,
    verifyFeeds: false,
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--city" && args[i + 1]) opts.city = args[++i];
    else if (a === "--fixtures") opts.mode = "fixtures";
    else if (a === "--live") opts.mode = "live";
    else if (a === "--extractor" && args[i + 1]) opts.extractor = args[++i];
    else if (a === "--out" && args[i + 1]) opts.out = args[++i];
    else if (a === "--no-write" || a === "--noWrite") opts.write = false;
    else if (a === "--verify-feeds") opts.verifyFeeds = true;
  }
  if (!opts.mode)      opts.mode      = "fixtures";
  if (!opts.extractor) opts.extractor = opts.mode === "fixtures" ? "fixture" : "claude";
  return opts;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function readRankedCity(city) {
  const file = path.join(DATA_DIR, `ranked_${city}.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

async function verifyFeedsOnly(sources) {
  console.log("\n🔎  feed verification (live HTTP GET):\n");
  for (const s of sources) {
    process.stdout.write(`   ${s.source.padEnd(20)} ${s.feed_url} … `);
    try {
      const res = await fetch(s.feed_url, {
        method:  "GET",
        headers: { "User-Agent": "TRNDIE-Pipeline/0.2" },
      });
      console.log(`${res.status} ${res.statusText}`);
    } catch (err) {
      console.log(`error: ${err.message}`);
    }
  }
  console.log("");
}

function printConsoleSummary(report) {
  console.log("\n──── findings ────────────────────────────────────────────────");
  console.log(`Sources processed:  ${report.sources_count}`);
  for (const s of report.sources_summary) {
    const tag = s.ok ? "ok " : "FAIL";
    console.log(
      `  ${tag}  ${s.source.padEnd(20)} items=${s.items_fetched} extracted=${s.items_extracted} mentions=${s.mentions}${
        s.error ? "  · " + s.error : ""
      }`,
    );
  }
  console.log(`Aggregated venues:  ${report.aggregated.length}`);
  console.log(
    `Lock-ins (≥${PHASE2_WEIGHTS.LOCK_IN_DISTINCT_SOURCES} distinct tier-1 sources): ${report.lock_ins.length}`,
  );
  for (const v of report.lock_ins) {
    console.log(
      `   • ${v.venue_name} (${v.suburb || "?"}) — sources [${v.distinct_sources.join(", ")}], signal=${v.editorial_signal}`,
    );
  }
  console.log(`NEW candidates (not in ranked_${report.city}.json): ${report.new_candidates.length}`);
  for (const v of report.new_candidates) {
    console.log(
      `   • ${v.venue_name} (${v.suburb || "?"}) — sources [${v.distinct_sources.join(", ")}], signal=${v.editorial_signal}${v.lock_in ? "  [LOCK-IN]" : ""}`,
    );
  }
  console.log(`Reinforced existing: ${report.reinforced_existing.length}`);
  for (const v of report.reinforced_existing) {
    console.log(
      `   • ${v.venue_name} — sources [${v.distinct_sources.join(", ")}], signal=${v.editorial_signal}`,
    );
  }
  console.log("──────────────────────────────────────────────────────────────");
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs();
  console.log(`\n🔭  TRNDIE Phase 2 — editorial signal MVP  [OBSERVE-ONLY · ${opts.mode}]`);
  console.log(`    city=${opts.city}  extractor=${opts.extractor}`);

  const config = readConfig(CONFIG_PATH);
  const sources = selectSourcesForCity(config, opts.city);
  if (sources.length === 0) {
    console.error(`No editorial sources configured for city "${opts.city}" in ${CONFIG_PATH}.`);
    process.exit(1);
  }
  const fixturesDir = path.join(FIXTURES_BASE, opts.city);
  const sourceTiers = Object.fromEntries(sources.map((s) => [s.source, s.tier ?? 1]));

  if (opts.verifyFeeds) {
    await verifyFeedsOnly(sources);
    return;
  }

  // ── Stages 1–4: load + extract per source ───────────────────────────────────
  const perSource     = [];
  const mentionStream = [];

  for (const source of sources) {
    process.stdout.write(`\n📰  ${source.source} <${source.feed_url}>\n`);

    const feed = await loadFeed(source, { mode: opts.mode, fixturesDir });
    if (!feed.ok) {
      console.log(`     ✗ feed failed: ${feed.error}`);
      perSource.push({
        source:          source.source,
        feed_url:        source.feed_url,
        feed_source:     feed.source,
        ok:              false,
        error:           feed.error,
        items_fetched:   0,
        items_extracted: 0,
        items_failed:    0,
        mentions:        [],
        articles:        [],
      });
      continue;
    }
    console.log(`     ↳ feed ok · ${feed.items.length} item(s)`);

    const sourceReport = {
      source:          source.source,
      feed_url:        source.feed_url,
      feed_source:     feed.source,
      ok:              true,
      items_fetched:   feed.items.length,
      items_extracted: 0,
      items_failed:    0,
      mentions:        [],
      articles:        [],
    };

    for (const item of feed.items) {
      const articleMeta = {
        publication: source.source,
        title:       item.title,
        date:        item.pub_date,
      };

      const loaded = await loadArticleText(source, item, {
        mode: opts.mode,
        fixturesDir,
      });
      if (!loaded.ok) {
        console.log(`     ✗ "${item.title}" — article load failed: ${loaded.error}`);
        sourceReport.items_failed++;
        sourceReport.articles.push({
          title: item.title, link: item.link, ok: false, error: loaded.error,
        });
        continue;
      }

      let ext;
      if (opts.extractor === "fixture") {
        ext = extractFromFixtureSidecar(loaded.source);
      } else {
        ext = await extractWithClaude({
          apiKey:     process.env.ANTHROPIC_API_KEY,
          model:      process.env.PHASE2_EXTRACTION_MODEL || DEFAULT_MODEL,
          articleText: loaded.text,
          articleMeta,
        });
      }
      if (!ext.ok) {
        console.log(`     ✗ "${item.title}" — extraction failed: ${ext.error}`);
        sourceReport.items_failed++;
        sourceReport.articles.push({
          title: item.title, link: item.link, ok: false, error: ext.error,
        });
        continue;
      }

      sourceReport.items_extracted++;
      sourceReport.articles.push({
        title:          item.title,
        link:           item.link,
        mention_date:   item.pub_date,
        ok:             true,
        mentions_count: ext.mentions.length,
      });

      for (const m of ext.mentions) {
        const row = {
          source:       source.source,
          source_tier:  source.tier ?? 1,
          url:          item.link,
          title:        item.title,
          mention_date: item.pub_date,
          venue_name:   m.venue_name,
          suburb:       m.suburb || null,
          why:          m.why || null,
        };
        sourceReport.mentions.push(row);
        mentionStream.push(row);
      }
    }

    console.log(
      `     ↳ extracted ${sourceReport.items_extracted}/${sourceReport.items_fetched} · ${sourceReport.mentions.length} mention(s)`,
    );
    perSource.push(sourceReport);
  }

  // ── Stage 5: aggregation + signal ───────────────────────────────────────────
  const aggregated = aggregate(mentionStream, new Date());

  // ── Stage 6: attribution preview (v2.1 source_urls shape) ──────────────────
  const attributionPreview = aggregated.slice(0, 8).map((v) => ({
    venue_name:           v.venue_name,
    suburb:               v.suburb,
    proposed_source_urls: toSourceUrls(v, { sourceTiers }),
  }));

  // ── Stage 7: cross-ref existing ranked_<city>.json ─────────────────────────
  const ranked = readRankedCity(opts.city);
  const existingKeys = new Set(
    (ranked?.venues || []).map((v) => venueKey(v.venue_name)),
  );
  const candidates = aggregated.filter(
    (v) => !existingKeys.has(v.venue_key),
  );
  const reinforced = aggregated.filter((v) => existingKeys.has(v.venue_key));

  // ── Stage 8: write findings report ──────────────────────────────────────────
  const report = {
    generated_at:        new Date().toISOString(),
    city:                opts.city,
    mode:                opts.mode,
    extractor:           opts.extractor,
    methodology_phase:   "2 (observe-only, editorial signal MVP)",
    weights:             PHASE2_WEIGHTS,
    sources_count:       sources.length,
    sources_summary: perSource.map((s) => ({
      source:          s.source,
      ok:              s.ok,
      items_fetched:   s.items_fetched,
      items_extracted: s.items_extracted,
      items_failed:    s.items_failed,
      mentions:        s.mentions.length,
      error:           s.error,
    })),
    per_source:          perSource,
    aggregated,
    lock_ins:            aggregated.filter((v) => v.lock_in),
    new_candidates:      candidates,
    reinforced_existing: reinforced,
    attribution_preview: attributionPreview,
    existing_ranked_city: ranked
      ? { city: ranked.city, venues_in_ranked: ranked.venues?.length ?? 0 }
      : { city: opts.city, venues_in_ranked: 0, note: "no ranked_*.json on disk" },
    notes: [
      "OBSERVE-ONLY: no ranked_*.json was modified.",
      "Weights in `weights` are WIP — Phase 2 explores signal quality; the final composite blend lands in Phase 3+.",
      "attribution_preview entries match v2.1 schema exactly: {source, tier, url}. mention_date is captured upstream for recency scoring but is intentionally NOT injected into source_urls — schema extension belongs to v2.2.",
      "In fixture mode, the extractor reads sidecar `<article>.mentions.json` files. Real (non-fixture) runs use Claude. Fixture sidecars are the EXPECTED extraction for the fixture article and serve as a regression check on the aggregator/attribution code.",
    ],
  };

  printConsoleSummary(report);

  if (!opts.write) {
    console.log("\n[--no-write]  report not persisted.\n");
    return;
  }

  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  const stamp   = report.generated_at.replace(/[:.]/g, "-");
  const outPath = opts.out || path.join(REPORTS_DIR, `phase2-${opts.city}-${stamp}.json`);
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + "\n", "utf-8");
  console.log(`\n📝  Report written: ${path.relative(REPO_ROOT, outPath)}\n`);
}

main().catch((err) => {
  console.error("\nFATAL:", err.message);
  console.error(err.stack);
  process.exit(1);
});
