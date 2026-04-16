/**
 * extractor.js
 * ─────────────────────────────────────────────────────────────────
 * Extracts candidate venue names from raw TikTok video items.
 *
 * SOURCES
 * ───────
 * 1. Hashtags   — #SpeedosCafe, #TheGlassDen appearing in ≥ MIN_MENTIONS
 *    videos are strong signals.  City/category generics are filtered.
 * 2. @mentions  — venue TikTok handles tagged in captions; normalised
 *    identically to hashtags.
 *
 * DEDUPLICATION
 * ─────────────
 * Names are reduced to a canonical key before counting:
 *   lowercase → strip venue-type suffix → remove spaces
 *
 * "Up South" / "Up South Cafe" / "upsouthcafe" → key "upsouth"
 * Counts are merged; the longest name form is kept for display.
 *
 * VALIDATION GATE
 * ───────────────
 * Callers pass each candidate through Google Trends.  Candidates with
 * zero Trends interest AND no existing record are dropped as noise.
 * See update-trends.js for the validation step.
 */

"use strict";

// ── Configuration ─────────────────────────────────────────────────────────────

// Minimum number of distinct videos a candidate must appear in
const MIN_MENTIONS = 3;

// Venue-type suffixes stripped when computing dedup keys
const VENUE_SUFFIXES = [
  "cafe", "coffee", "bakery", "bakehouse", "restaurant",
  "bistro", "bar", "eatery", "kitchen", "patisserie",
  "deli", "roastery", "canteen", "bake",
];

// Terms that should never become venue candidates
const GENERIC_WORDS = new Set([
  "food", "cafe", "coffee", "bakery", "brunch", "breakfast", "lunch",
  "dinner", "eat", "eating", "foodie", "foodporn", "trending", "viral",
  "new", "best", "must", "try", "love", "life", "wow", "amazing",
  "australia", "australian", "au", "cbd", "city", "inner", "north",
  "south", "east", "west", "tiktok", "instagram", "reels", "fyp",
  "foryou", "foryoupage", "explore",
]);

// ── Normalisation helpers ─────────────────────────────────────────────────────

/**
 * Splits PascalCase / camelCase into space-separated words.
 * "TheGlassDen" → "The Glass Den"
 * "upsouthcafe" → "upsouthcafe"  (no capitals → unchanged)
 */
function splitCamelCase(str) {
  return str.replace(/([A-Z])/g, " $1").replace(/\s+/g, " ").trim();
}

/** "up south cafe" → "Up South Cafe" */
function toTitleCase(str) {
  return str.replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Strips a trailing venue-type suffix from a lowercased name string.
 * "up south cafe"  → "up south"
 * "the glass den"  → "the glass den"  (no suffix present)
 */
function stripSuffix(lower) {
  for (const s of VENUE_SUFFIXES) {
    if (lower.endsWith(" " + s)) return lower.slice(0, -(s.length + 1)).trim();
    // Handle concatenated form: "upsouthcafe" → "upsouth"
    if (lower.endsWith(s) && lower.length > s.length + 3) {
      return lower.slice(0, -s.length).trim();
    }
  }
  return lower;
}

/**
 * Returns the canonical dedup key for a display name.
 * "Up South Cafe" → "upsouth"
 * "upsouthcafe"  → "upsouth"
 */
function dedupKey(displayName) {
  return stripSuffix(displayName.toLowerCase()).replace(/\s+/g, "");
}

/**
 * Returns true if the raw string should be rejected as generic / noise.
 */
function isGeneric(name, citySlug) {
  const lower = name.toLowerCase().trim();
  if (lower.length < 3 || lower.length > 40) return true;
  if (GENERIC_WORDS.has(lower)) return true;
  if (lower.includes(citySlug.toLowerCase())) return true;
  // Reject pure stop-words and short common words
  if (/^(the|a|an|this|that|my|your|our)$/.test(lower)) return true;
  return false;
}

/**
 * Converts a raw hashtag or @mention string to a display-ready venue name.
 * Returns null if the tag is generic, too short, or too long.
 *
 * Examples:
 *   "TheGlassDen"   → "The Glass Den"
 *   "SpeedosCafe"   → "Speedos Cafe"
 *   "upsouthcafe"   → "Upsouthcafe"   (no split possible — still usable)
 *   "sydneycafe"    → null            (contains city slug)
 *   "cafe"          → null            (generic)
 */
function normaliseTag(raw, citySlug) {
  if (!raw || raw.length < 3 || raw.length > 45) return null;
  const display = toTitleCase(splitCamelCase(raw.trim()));
  if (isGeneric(display, citySlug)) return null;
  if (isGeneric(stripSuffix(display.toLowerCase()), citySlug)) return null;
  return display;
}

// ── Source 1: hashtag extraction ─────────────────────────────────────────────

/**
 * Collects hashtag-derived candidates.
 * Returns Map<displayName, Set<videoId>> — one Set entry per unique video.
 */
function extractFromHashtags(items, citySlug) {
  const counts = new Map();

  for (const video of items) {
    const vid = video.id || video.videoId || String(Math.random());
    for (const ht of (video.hashtags || [])) {
      const name = normaliseTag((ht.name || "").trim(), citySlug);
      if (!name) continue;
      if (!counts.has(name)) counts.set(name, new Set());
      counts.get(name).add(vid);
    }
  }

  return counts;
}

// ── Source 2: @mention extraction ────────────────────────────────────────────

// Matches @handle at word boundaries in caption text
const MENTION_RE = /@([A-Za-z][A-Za-z0-9_.]{2,38})/g;

/**
 * Collects @mention-derived candidates from video captions.
 * Returns Map<displayName, Set<videoId>>.
 */
function extractFromMentions(items, citySlug) {
  const counts = new Map();

  for (const video of items) {
    const text = video.text || "";
    const vid  = video.id || video.videoId || String(Math.random());
    let match;
    MENTION_RE.lastIndex = 0;

    while ((match = MENTION_RE.exec(text)) !== null) {
      const name = normaliseTag(match[1], citySlug);
      if (!name) continue;
      if (!counts.has(name)) counts.set(name, new Set());
      counts.get(name).add(vid);
    }
  }

  return counts;
}

// ── Merge and dedup ───────────────────────────────────────────────────────────

/** Merges two Map<name, Set<vid>> maps, combining sets for same keys. */
function mergeMaps(a, b) {
  const out = new Map(a);
  for (const [name, ids] of b) {
    if (out.has(name)) {
      for (const id of ids) out.get(name).add(id);
    } else {
      out.set(name, new Set(ids));
    }
  }
  return out;
}

/**
 * Groups display names that share a dedup key, merges their video sets,
 * and keeps the longest display name as the canonical form.
 *
 * "Up South" (3 vids) + "Up South Cafe" (4 vids) → "Up South Cafe" (7 vids)
 */
function deduplicateByKey(nameMap) {
  // key → { bestName: string, ids: Set }
  const groups = new Map();

  for (const [name, ids] of nameMap) {
    const key = dedupKey(name);
    if (!groups.has(key)) {
      groups.set(key, { bestName: name, ids: new Set(ids) });
    } else {
      const g = groups.get(key);
      for (const id of ids) g.ids.add(id);
      if (name.length > g.bestName.length) g.bestName = name;
    }
  }

  // Return as Map<bestName, count>
  const result = new Map();
  for (const { bestName, ids } of groups.values()) {
    result.set(bestName, ids.size);
  }
  return result;
}

// ── Category inference ────────────────────────────────────────────────────────

/**
 * Infers a venue category from the videos that mentioned it.
 * Falls back to "cafe".
 */
function inferCategory(venueName, items) {
  const key      = dedupKey(venueName);
  const relevant = items.filter((v) => {
    const text = (v.text || "").toLowerCase();
    const tags  = (v.hashtags || []).map((h) => (h.name || "").toLowerCase()).join(" ");
    return text.includes(key) || tags.includes(key);
  });

  const combined = relevant
    .flatMap((v) => [v.text || "", ...(v.hashtags || []).map((h) => h.name || "")])
    .join(" ")
    .toLowerCase();

  if (/bakery|bakehouse|pastry|croissant|bread|scroll|sourdough|bake/.test(combined)) return "bakery";
  if (/deli|sandwich|charcuterie/.test(combined)) return "deli";
  return "cafe";
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Main entry point.
 *
 * Given the raw TikTok video items for a city, returns a deduplicated,
 * frequency-filtered list of candidate venue names sorted by mention count.
 *
 * @param {object[]} items     raw Apify video objects
 * @param {string}   citySlug  e.g. "brisbane"
 * @returns {{ name: string, mentions: number }[]}
 */
function extractCandidates(items, citySlug) {
  if (!items || items.length === 0) return [];

  const hashtagMap  = extractFromHashtags(items, citySlug);
  const mentionMap  = extractFromMentions(items, citySlug);
  const merged      = mergeMaps(hashtagMap, mentionMap);
  const deduped     = deduplicateByKey(merged);

  return [...deduped.entries()]
    .filter(([, count]) => count >= MIN_MENTIONS)
    .map(([name, mentions]) => ({ name, mentions }))
    .sort((a, b) => b.mentions - a.mentions);
}

module.exports = { extractCandidates, inferCategory, dedupKey };
