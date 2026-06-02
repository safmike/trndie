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
 *   --as-of <ISO>       reference date for recency math (default: wall-clock now in live mode,
 *                       derived from the latest fixture mention_date in fixtures mode — so
 *                       fixture runs are reproducible regardless of when they're invoked)
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

// Cost guardrail. The runner processes at most this many articles per feed
// per run — each article is one Claude call in live mode. At 20 articles ×
// 3 sources × ~2k input / ~1k output tokens per call against Haiku 4.5 this
// is well under a dollar per run; raise the cap if real Melbourne feeds are
// shown to publish more than ~20 fresh items per cycle.
const MAX_ARTICLES_PER_FEED = 20;

// ── CLI args ──────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    city:        "melbourne",
    mode:        null, // "live" | "fixtures"
    extractor:   null, // "claude" | "fixture"
    asOf:        null, // ISO string or null
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
    else if (a === "--as-of" && args[i + 1]) opts.asOf = args[++i];
    else if (a === "--out" && args[i + 1]) opts.out = args[++i];
    else if (a === "--no-write" || a === "--noWrite") opts.write = false;
    else if (a === "--verify-feeds") opts.verifyFeeds = true;
  }
  if (!opts.mode)      opts.mode      = "fixtures";
  if (!opts.extractor) opts.extractor = opts.mode === "fixtures" ? "fixture" : "claude";
  return opts;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function resolveAsOf(opts, mentionStream) {
  if (opts.asOf) {
    const d = new Date(opts.asOf);
    if (isNaN(d.getTime())) throw new Error(`--as-of: invalid date ${opts.asOf}`);
    return d;
  }
  if (opts.mode === "fixtures") {
    const dates = mentionStream
      .map((m) => (m.mention_date ? new Date(m.mention_date) : null))
      .filter((d) => d && !isNaN(d.getTime()));
    if (dates.length > 0) {
      const maxMs = Math.max(...dates.map((d) => d.getTime()));
      return new Date(maxMs + 4 * 86400000); // latest mention + 4 days
    }
  }
  return new Date();
}

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
    const cap = s.items_capped ? ` (capped from ${s.items_in_feed})` : "";
    console.log(
      `  ${tag}  ${s.source.padEnd(20)} items=${s.items_fetched}${cap} extracted=${s.items_extracted} mentions=${s.mentions}${
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

// ── Markdown report ───────────────────────────────────────────────────────────

function md(s) {
  // Escape pipe / backtick characters for table-safe rendering.
  return String(s == null ? "" : s).replace(/\|/g, "\\|").replace(/`/g, "ʼ");
}

function toMarkdown(report) {
  const w = report.weights || {};
  const lockInThreshold = w.LOCK_IN_DISTINCT_SOURCES ?? 2;
  const lines = [];

  lines.push(`# Editorial pipeline run — ${report.city}`);
  lines.push("");
  lines.push(`- **Mode:** \`${report.mode}\`  (extractor: \`${report.extractor}\`${report.extraction_model ? `, model: \`${report.extraction_model}\`` : ""})`);
  lines.push(`- **Generated at:** \`${report.generated_at}\``);
  lines.push(`- **As-of (recency reference):** \`${report.as_of}\``);
  lines.push(`- **Phase:** ${report.methodology_phase}`);
  lines.push(`- **Per-feed article cap:** ${report.max_articles_per_feed}`);
  lines.push(`- **Existing ranked venues in \`ranked_${report.city}.json\`:** ${report.existing_ranked_city?.venues_in_ranked ?? 0}`);
  lines.push("");

  if (report.mode === "live") {
    lines.push("> **OBSERVE-ONLY.** No `ranked_*.json` was modified by this run. The aggregated venues, candidates, and reinforcements below are observations only — they are listed, not injected into live data.");
  } else {
    lines.push("> **SYNTHETIC TEST DATA.** This is a fixture self-test, not a live editorial run. Venue names prefixed `Fixture Cafe …` are synthetic markers. Real signal requires a live run.");
  }
  lines.push("");

  // Per-source summary
  lines.push("## Per source");
  lines.push("");
  lines.push("| Source | Feed | In feed | Processed | Capped | Extracted | Failed | Mentions | Status |");
  lines.push("|---|---|---:|---:|:---:|---:|---:|---:|---|");
  for (const s of report.sources_summary) {
    const feed = (report.per_source.find((p) => p.source === s.source) || {}).feed_url || "";
    const status = s.ok ? "ok" : `**FAIL**: ${md(s.error || "unknown")}`;
    lines.push(
      `| ${md(s.source)} | \`${md(feed)}\` | ${s.items_in_feed ?? 0} | ${s.items_processed ?? 0} | ${s.items_capped ? "✂︎" : "–"} | ${s.items_extracted ?? 0} | ${s.items_failed ?? 0} | ${s.mentions ?? 0} | ${status} |`,
    );
  }
  lines.push("");

  // Extracted mentions per source, per article
  lines.push("## Extracted venue mentions");
  lines.push("");
  for (const s of report.per_source) {
    lines.push(`### ${s.source}`);
    lines.push("");
    if (!s.ok) {
      lines.push(`> Feed failed: ${s.error}`);
      lines.push("");
      continue;
    }
    if (!s.articles || s.articles.length === 0) {
      lines.push("_no articles processed_");
      lines.push("");
      continue;
    }
    for (const a of s.articles) {
      if (!a.ok) {
        lines.push(`- ❌ **${a.title || "(untitled)"}** — ${a.error}`);
        continue;
      }
      lines.push(`- **${a.title || "(untitled)"}**`);
      lines.push(`  - Date: \`${a.mention_date || "(unknown)"}\``);
      if (a.link) lines.push(`  - URL: <${a.link}>`);
      lines.push(`  - Mentions extracted: ${a.mentions_count}`);
      const articleMentions = (s.mentions || []).filter((m) => m.url === a.link);
      for (const m of articleMentions) {
        lines.push(`    - **${m.venue_name}** (${m.suburb || "?"}) — ${m.why || "_(no why)_"}`);
      }
    }
    lines.push("");
  }

  // Aggregated table
  lines.push("## Aggregated signal");
  lines.push("");
  lines.push("| Venue | Suburb | Distinct sources | Signal | Lock-in? | Classification |");
  lines.push("|---|---|---|---:|:---:|---|");
  const reinforcedKeys = new Set((report.reinforced_existing || []).map((v) => v.venue_key));
  for (const v of report.aggregated) {
    const classification = reinforcedKeys.has(v.venue_key)
      ? "Reinforces existing"
      : "NEW candidate";
    lines.push(
      `| ${md(v.venue_name)} | ${md(v.suburb || "?")} | ${md(v.distinct_sources.join(", ") || "(none in window)")} | ${v.editorial_signal} | ${v.lock_in ? "✅" : "–"} | ${classification} |`,
    );
  }
  lines.push("");

  // Lock-ins
  lines.push(`## Multi-source lock-ins (≥${lockInThreshold} distinct tier-1 sources)`);
  lines.push("");
  if (!report.lock_ins || report.lock_ins.length === 0) {
    lines.push("_none in this run_");
  } else {
    for (const v of report.lock_ins) {
      lines.push(
        `- **${v.venue_name}** (${v.suburb || "?"}) — ${v.distinct_source_count} sources: ${v.distinct_sources.join(", ")} · signal ${v.editorial_signal}`,
      );
    }
  }
  lines.push("");

  // NEW candidates
  lines.push(`## NEW candidates (not in \`ranked_${report.city}.json\`) — listed, NOT injected`);
  lines.push("");
  if (!report.new_candidates || report.new_candidates.length === 0) {
    lines.push("_none in this run_");
  } else {
    for (const v of report.new_candidates) {
      const lock = v.lock_in ? "  **[LOCK-IN]**" : "";
      lines.push(
        `- **${v.venue_name}** (${v.suburb || "?"}) — sources: ${v.distinct_sources.join(", ") || "(none in window)"} · signal ${v.editorial_signal}${lock}`,
      );
    }
  }
  lines.push("");

  // Reinforced existing
  lines.push("## Reinforces existing ranked venues");
  lines.push("");
  if (!report.reinforced_existing || report.reinforced_existing.length === 0) {
    lines.push("_none in this run_");
  } else {
    for (const v of report.reinforced_existing) {
      lines.push(
        `- **${v.venue_name}** — sources: ${v.distinct_sources.join(", ") || "(none in window)"} · signal ${v.editorial_signal}`,
      );
    }
  }
  lines.push("");

  // Attribution preview
  lines.push("## Sample `source_urls` attribution preview (v2.1 schema)");
  lines.push("");
  lines.push("```json");
  lines.push(JSON.stringify((report.attribution_preview || []).slice(0, 5), null, 2));
  lines.push("```");
  lines.push("");

  // Weights
  lines.push("## Weights (WIP, tunable on `PHASE2_WEIGHTS`)");
  lines.push("");
  lines.push("```json");
  lines.push(JSON.stringify(w, null, 2));
  lines.push("```");
  lines.push("");

  // Notes
  lines.push("## Notes");
  lines.push("");
  for (const n of (report.notes || [])) lines.push(`- ${n}`);
  lines.push("");

  return lines.join("\n");
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

  // Resolve the extraction model once so it gets recorded on the report.
  // Fixture mode does not call Claude.
  const extractionModel =
    opts.extractor === "fixture"
      ? null
      : process.env.PHASE2_EXTRACTION_MODEL || DEFAULT_MODEL;

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
      items_in_feed:   feed.items.length,
      items_processed: 0,
      items_capped:    feed.items.length > MAX_ARTICLES_PER_FEED,
      items_fetched:   0,
      items_extracted: 0,
      items_failed:    0,
      mentions:        [],
      articles:        [],
    };

    const processedItems = feed.items.slice(0, MAX_ARTICLES_PER_FEED);
    sourceReport.items_processed = processedItems.length;
    if (sourceReport.items_capped) {
      console.log(
        `     ! capped at ${MAX_ARTICLES_PER_FEED} of ${feed.items.length} items (MAX_ARTICLES_PER_FEED guardrail)`,
      );
    }
    sourceReport.items_fetched = processedItems.length;

    for (const item of processedItems) {
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
          model:      extractionModel,
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
  // Pick the reference "now" for recency math. Live mode defaults to wall-clock.
  // Fixture mode defaults to (latest mention_date + 4 days) so the findings
  // report is reproducible regardless of when the fixtures are run.
  const asOf = resolveAsOf(opts, mentionStream);
  const aggregated = aggregate(mentionStream, asOf);

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
    as_of:               asOf.toISOString(),
    city:                opts.city,
    mode:                opts.mode,
    extractor:           opts.extractor,
    extraction_model:    extractionModel,
    max_articles_per_feed: MAX_ARTICLES_PER_FEED,
    methodology_phase:   "2 (observe-only, editorial signal MVP)",
    weights:             PHASE2_WEIGHTS,
    sources_count:       sources.length,
    sources_summary: perSource.map((s) => ({
      source:          s.source,
      ok:              s.ok,
      items_in_feed:   s.items_in_feed,
      items_processed: s.items_processed,
      items_capped:    s.items_capped,
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

  const stamp   = report.generated_at.replace(/[:.]/g, "-");
  const outPath = opts.out || path.join(REPORTS_DIR, `phase2-${opts.city}-${stamp}.json`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const isMarkdown = /\.md$/i.test(outPath);
  const body = isMarkdown ? toMarkdown(report) : JSON.stringify(report, null, 2) + "\n";
  fs.writeFileSync(outPath, body, "utf-8");
  console.log(`\n📝  Report written: ${path.relative(REPO_ROOT, outPath)}  [${isMarkdown ? "markdown" : "json"}]\n`);
}

main().catch((err) => {
  console.error("\nFATAL:", err.message);
  console.error(err.stack);
  process.exit(1);
});
