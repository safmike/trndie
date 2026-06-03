/**
 * editorial.js
 * ─────────────────────────────────────────────────────────────────
 * Phase 2 — editorial ingestion for tier-1 sources.
 *
 *   1. Read configured feeds from config/editorial_sources.json.
 *   2. For each source, walk `feed_urls` in order and use the first
 *      URL that returns a valid feed. Capture the HTTP status of
 *      EVERY attempt so failures aren't blind.
 *   3. Resolve full article text per feed item (fall back to
 *      <content:encoded> / <description> when present).
 *
 * Fetch hardening (added after the first live run blanked Broadsheet
 * and Time Out at default fetcher UA):
 *   - Realistic identifying User-Agent (NOT impersonating a browser).
 *   - Explicit Accept / Accept-Language headers for RSS/Atom XML.
 *   - 15s per-request timeout via AbortSignal.
 *   - Classifies failures (http_4xx / http_5xx / dns / timeout /
 *     parse_error) so the report says WHY, not just THAT.
 *
 * Live and fixture modes are symmetric: fixture mode reads feed.xml
 * + articles/<basename>.html from city-generator/trendy/fixtures/
 * editorial/<city>/<source>/.
 */

"use strict";

const fs   = require("fs");
const path = require("path");

// Realistic, identifying UA. Honest about who we are (links to bot page).
// Browser-impersonating UAs got dropped in favour of this so that publishers
// who block obvious scrapers can either allow us by policy or block us
// explicitly — either way we'll know.
const USER_AGENT =
  "Mozilla/5.0 (compatible; TRNDIE-EditorialBot/0.2; +https://trndie.co/about/bot) feed-aggregator";
const ACCEPT_HEADER =
  "application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5";
const ACCEPT_LANG = "en-AU,en;q=0.9";

const FETCH_TIMEOUT_MS = 15_000;

// ── Config ────────────────────────────────────────────────────────────────────

function readConfig(configPath) {
  return JSON.parse(fs.readFileSync(configPath, "utf-8"));
}

function selectSourcesForCity(config, city) {
  return (config.sources || []).filter((s) => s.city === city);
}

function feedUrlsFor(source) {
  if (Array.isArray(source.feed_urls) && source.feed_urls.length > 0) {
    return source.feed_urls;
  }
  if (source.feed_url) return [source.feed_url];   // back-compat
  return [];
}

// ── Network ───────────────────────────────────────────────────────────────────

function classifyFetchError(err, res) {
  if (res) {
    if (res.status >= 400 && res.status < 500) return "http_4xx";
    if (res.status >= 500)                     return "http_5xx";
    return "http_other";
  }
  const msg = String(err && err.message || err || "").toLowerCase();
  if (msg.includes("aborted") || msg.includes("timeout") || err?.name === "AbortError") return "timeout";
  if (msg.includes("enotfound") || msg.includes("eai_again") || msg.includes("getaddrinfo")) return "dns";
  if (msg.includes("econnrefused") || msg.includes("econnreset")) return "connection";
  if (msg.includes("certificate") || msg.includes("ssl"))         return "tls";
  return "network";
}

async function fetchText(url) {
  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(url, {
      headers: {
        "User-Agent":      USER_AGENT,
        "Accept":          ACCEPT_HEADER,
        "Accept-Language": ACCEPT_LANG,
      },
      signal: controller.signal,
      redirect: "follow",
    });
  } catch (err) {
    clearTimeout(timer);
    const e = new Error(`fetch failed for ${url}: ${err.message}`);
    e.url = url;
    e.error_class = classifyFetchError(err, null);
    throw e;
  }
  clearTimeout(timer);
  if (!res.ok) {
    const e = new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
    e.url = url;
    e.status = res.status;
    e.status_text = res.statusText;
    e.error_class = classifyFetchError(null, res);
    throw e;
  }
  const body = await res.text();
  return { body, status: res.status, status_text: res.statusText, final_url: res.url };
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
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i");
  const m  = re.exec(xml);
  return m ? stripCdata(m[1]) : null;
}

function parseFeed(xml) {
  const items = [];
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
      const altMatch =
        /<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i.exec(body) ||
        /<link[^>]*href=["']([^"']+)["']/i.exec(body);
      link = altMatch ? decodeEntities(altMatch[1]).trim() : null;
    }

    const title = decodeEntities(extractTag(body, "title") || "").trim();
    const summary = decodeEntities(
      extractTag(body, "description") || extractTag(body, "summary") || "",
    ).trim();
    const content = decodeEntities(
      extractTag(body, "content:encoded") || extractTag(body, "content") || "",
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

function looksLikeFeedXml(body) {
  if (!body) return false;
  const head = body.slice(0, 2048).toLowerCase();
  return /<(rss|feed|channel)\b/.test(head);
}

function htmlToText(html) {
  if (!html) return "";
  return decodeEntities(
    String(html)
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

// ── Source ingestion ──────────────────────────────────────────────────────────

/**
 * Load a feed for a source. Tries each candidate URL in order, captures the
 * HTTP status of every attempt, and uses the first URL that returns a valid
 * RSS/Atom body. Returns
 *   { ok, items?, feed_url_used?, tried, source?, error?, error_class? }
 *
 * `tried` is an array of per-URL attempt records — surfaced in the report
 * so a blanked source is no longer a black box.
 */
async function loadFeed(source, { mode, fixturesDir }) {
  if (mode === "fixtures") {
    const file = path.join(fixturesDir, sourceDirName(source), "feed.xml");
    try {
      const xml = fs.readFileSync(file, "utf-8");
      return {
        ok:    true,
        items: parseFeed(xml),
        feed_url_used: file,
        tried: [{ url: file, ok: true, source: "fixture" }],
        source: file,
      };
    } catch (err) {
      return {
        ok:    false,
        items: [],
        feed_url_used: null,
        tried: [{ url: file, ok: false, error: err.message, source: "fixture" }],
        source: file,
        error: err.message,
        error_class: "fixture_missing",
      };
    }
  }

  const candidates = feedUrlsFor(source);
  if (candidates.length === 0) {
    return {
      ok:    false,
      items: [],
      feed_url_used: null,
      tried: [],
      source: null,
      error: `no feed_urls configured for source "${source.source}"`,
      error_class: "config",
    };
  }

  const tried = [];
  for (const url of candidates) {
    try {
      const { body, status, status_text, final_url } = await fetchText(url);
      const ok_xml = looksLikeFeedXml(body);
      if (!ok_xml) {
        tried.push({
          url,
          status,
          status_text,
          ok: false,
          error: "response did not look like RSS/Atom XML",
          error_class: "parse_error",
          final_url,
        });
        continue;
      }
      const items = parseFeed(body);
      tried.push({ url, status, status_text, ok: true, items: items.length, final_url });
      return {
        ok:    true,
        items,
        feed_url_used: url,
        tried,
        source: url,
      };
    } catch (err) {
      tried.push({
        url,
        status:      err.status ?? null,
        status_text: err.status_text ?? null,
        ok:          false,
        error:       err.message,
        error_class: err.error_class || "unknown",
      });
    }
  }

  // All candidates failed. Surface the LAST error_class as the source-level
  // classifier — usually the most informative (the publisher is consistent).
  const last = tried[tried.length - 1] || {};
  return {
    ok:    false,
    items: [],
    feed_url_used: null,
    tried,
    source: null,
    error: `all ${candidates.length} candidate feeds failed for ${source.source}`,
    error_class: last.error_class || "unknown",
  };
}

/**
 * Resolve full article text for a feed item.
 *   1. Inline content from the feed entry (if substantial).
 *   2. Fixture HTML / live fetch.
 *
 * Returns { ok, text?, source, error? }. `source` is the on-disk path
 * (fixtures) or the URL (live), used by the fixture extractor to
 * locate the sidecar.
 */
async function loadArticleText(source, item, { mode, fixturesDir }) {
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
    const { body } = await fetchText(item.link);
    return { ok: true, text: htmlToText(body), source: item.link };
  } catch (err) {
    return {
      ok: false,
      source: item.link,
      error: err.message,
      error_class: err.error_class || "unknown",
    };
  }
}

function sourceDirName(source) {
  return String(source.source).replace(/_/g, "-");
}

module.exports = {
  USER_AGENT,
  FETCH_TIMEOUT_MS,
  readConfig,
  selectSourcesForCity,
  feedUrlsFor,
  loadFeed,
  loadArticleText,
  parseFeed,
  htmlToText,
  classifyFetchError,
};
