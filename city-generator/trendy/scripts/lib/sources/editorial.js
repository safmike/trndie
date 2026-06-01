/**
 * editorial.js
 * ─────────────────────────────────────────────────────────────────
 * Phase 2 — Editorial signal MVP (observe-only).
 *
 * Ingestion for tier-1 editorial sources:
 *   1. Read configured feeds from config/editorial_sources.json.
 *   2. Fetch + parse RSS (or Atom) for the chosen city.
 *   3. For each entry, resolve full article text — falling back to the
 *      feed's <content:encoded> / <description> when present, otherwise
 *      fetching the article URL.
 *
 * Live and fixture modes are symmetric: fixture mode reads feed.xml
 * and articles/<basename>.html from city-generator/trendy/fixtures/
 * editorial/<city>/<source>/, so the full chain (parse → extract →
 * aggregate → signal → attribution) runs end-to-end with no network
 * and no Claude calls. See scripts/phase2-editorial.js.
 *
 * RSS parsing here is intentionally a small hand-rolled XML scrape:
 * Phase 2 is a feel-it-out MVP and a single regex parser is easier to
 * audit (and easier to delete) than pulling in a feed-parser dep. If
 * field coverage grows, swap to a dep then.
 */

"use strict";

const fs   = require("fs");
const path = require("path");

const DEFAULT_USER_AGENT =
  "TRNDIE-Pipeline/0.2 (+https://trndie.co; editorial-aggregator)";

// ── Config ────────────────────────────────────────────────────────────────────

function readConfig(configPath) {
  return JSON.parse(fs.readFileSync(configPath, "utf-8"));
}

function selectSourcesForCity(config, city) {
  return (config.sources || []).filter((s) => s.city === city);
}

// ── Network ───────────────────────────────────────────────────────────────────

async function fetchText(url, opts = {}) {
  const headers = { "User-Agent": DEFAULT_USER_AGENT, ...(opts.headers || {}) };
  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
  }
  return await res.text();
}

// ── RSS/Atom parsing ──────────────────────────────────────────────────────────

function decodeEntities(s) {
  return String(s)
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function stripCdata(s) {
  if (s == null) return s;
  const m = /^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/.exec(s);
  return m ? m[1] : s;
}

function extractTag(xml, tag) {
  // Allow optional attributes; `i` for case-insensitive (Atom + RSS variants).
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i");
  const m = re.exec(xml);
  return m ? stripCdata(m[1]) : null;
}

function parseFeed(xml) {
  const items = [];
  // RSS 2.0 <item> or Atom <entry>.
  const itemRe = /<(item|entry)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi;
  let m;
  while ((m = itemRe.exec(xml)) !== null) {
    const tagName = m[1].toLowerCase();
    const body    = m[2];

    let link;
    if (tagName === "item") {
      const raw = extractTag(body, "link");
      link = raw ? decodeEntities(raw).trim() : null;
    } else {
      // Atom: <link href="..."/>. Prefer rel="alternate" if present.
      const altMatch =
        /<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i.exec(body) ||
        /<link[^>]*href=["']([^"']+)["']/i.exec(body);
      link = altMatch ? decodeEntities(altMatch[1]).trim() : null;
    }

    const title = decodeEntities(extractTag(body, "title") || "").trim();
    const summary = decodeEntities(
      extractTag(body, "description") || extractTag(body, "summary") || ""
    ).trim();
    const content = decodeEntities(
      extractTag(body, "content:encoded") || extractTag(body, "content") || ""
    ).trim();
    const pubDateRaw =
      extractTag(body, "pubDate") ||
      extractTag(body, "published") ||
      extractTag(body, "updated") ||
      null;
    const pub_date = pubDateRaw ? decodeEntities(pubDateRaw).trim() : null;

    items.push({ title, link, summary, content, pub_date });
  }
  return items;
}

/**
 * Reduce HTML to plain text. Strips <script> / <style> blocks first,
 * then all remaining tags, then collapses whitespace. Good enough for
 * the extractor; we don't render this anywhere.
 */
function htmlToText(html) {
  if (!html) return "";
  return decodeEntities(
    String(html)
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\s+/g, " ")
    .trim();
}

// ── Source ingestion ──────────────────────────────────────────────────────────

/**
 * Load and parse a configured feed. Returns
 *   { ok, items?, source, error? }
 * - In `fixtures` mode reads `<fixturesDir>/<source>/feed.xml`.
 * - In `live` mode fetches `source.feed_url`.
 *
 * Errors do NOT throw — Phase 2 must degrade gracefully when a feed is
 * down (per task spec). The caller surfaces the failure in the report
 * and continues with the remaining sources.
 */
async function loadFeed(source, { mode, fixturesDir }) {
  if (mode === "fixtures") {
    const file = path.join(fixturesDir, sourceDirName(source), "feed.xml");
    try {
      const xml = fs.readFileSync(file, "utf-8");
      return { ok: true, items: parseFeed(xml), source: file };
    } catch (err) {
      return { ok: false, items: [], source: file, error: err.message };
    }
  }
  try {
    const xml = await fetchText(source.feed_url);
    return { ok: true, items: parseFeed(xml), source: source.feed_url };
  } catch (err) {
    return { ok: false, items: [], source: source.feed_url, error: err.message };
  }
}

/**
 * Resolve full article text for a feed item.
 * Order of preference:
 *   1. Inline content from the feed entry (if substantial).
 *   2. Fixture HTML at <fixturesDir>/<source>/articles/<basename>.html
 *      (fixture mode), or live fetch of item.link (live mode).
 *
 * Returns { ok, text?, source, error? }. `source` is the on-disk path or
 * URL the text came from — used by the fixture extractor to locate the
 * sidecar `<article>.mentions.json`.
 */
async function loadArticleText(source, item, { mode, fixturesDir }) {
  // Prefer feed-inline content when present and substantial.
  const inline = htmlToText(item.content);
  if (inline && inline.length >= 400) {
    return { ok: true, text: inline, source: "feed_inline" };
  }

  if (mode === "fixtures") {
    let fname = path.basename(item.link || "");
    if (!fname) return { ok: false, source: null, error: "no link in feed item" };
    if (!/\.html?$/i.test(fname)) fname += ".html";
    const file = path.join(fixturesDir, sourceDirName(source), "articles", fname);
    try {
      const html = fs.readFileSync(file, "utf-8");
      return { ok: true, text: htmlToText(html), source: file };
    } catch (err) {
      return { ok: false, source: file, error: err.message };
    }
  }

  try {
    const html = await fetchText(item.link);
    return { ok: true, text: htmlToText(html), source: item.link };
  } catch (err) {
    return { ok: false, source: item.link, error: err.message };
  }
}

function sourceDirName(source) {
  // "concrete_playground" → "concrete-playground", "time_out" → "time-out".
  return String(source.source).replace(/_/g, "-");
}

module.exports = {
  DEFAULT_USER_AGENT,
  readConfig,
  selectSourcesForCity,
  loadFeed,
  loadArticleText,
  parseFeed,
  htmlToText,
};
