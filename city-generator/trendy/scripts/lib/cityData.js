/**
 * cityData.js
 * ─────────────────────────────────────────────────────────────────
 * File I/O layer for per-city ranked JSON files.
 *
 * Phase 1 (the bridge): re-pointed from the orphaned v2.0 store
 * (trendy/src/_data/cityData/<slug>.json) to the live v2.1 store
 * (repo-root data/ranked_<slug>.json) — the files the Vercel frontend
 * actually reads via src/_data/rankedCities.js.
 *
 * All other modules call these functions instead of touching the
 * filesystem directly, so the data path is only defined in one place.
 */

"use strict";

const fs   = require("fs");
const path = require("path");

// Repo-root data/ directory, where the live v2.1 ranked_<slug>.json live.
// lib → scripts → trendy → city-generator → repo root → data
const DATA_DIR = path.resolve(__dirname, "../../../../data");

/** Absolute path to a city's ranked JSON file. */
function fileFor(slug) {
  return path.join(DATA_DIR, `ranked_${slug}.json`);
}

/**
 * Serialises a value to JSON matching the existing ranked_*.json house
 * style: 2-space indent, but arrays whose elements are all primitives
 * (or empty) are kept inline on a single line — e.g.
 *   "vibe_tags": ["Pastry Pit", "FYP Legend"]
 *   "source_urls": []
 * Arrays of objects and nested objects are expanded as usual. Matching
 * the source formatting keeps a no-op run a true byte-for-byte no-op
 * and avoids whitespace churn in the diff.
 */
function serialize(value, indent = "") {
  const next = indent + "  ";

  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    const allPrimitive = value.every(
      (el) => el === null || typeof el !== "object"
    );
    if (allPrimitive) {
      return "[" + value.map((el) => JSON.stringify(el)).join(", ") + "]";
    }
    const items = value.map((el) => next + serialize(el, next));
    return "[\n" + items.join(",\n") + "\n" + indent + "]";
  }

  if (value && typeof value === "object") {
    const keys = Object.keys(value);
    if (keys.length === 0) return "{}";
    const entries = keys.map(
      (k) => next + JSON.stringify(k) + ": " + serialize(value[k], next)
    );
    return "{\n" + entries.join(",\n") + "\n" + indent + "}";
  }

  return JSON.stringify(value);
}

/**
 * Returns every city slug derived from the ranked_*.json filenames.
 * Example return: ["adelaide", "brisbane", "goldcoast", ...]
 *
 * @returns {string[]}
 */
function listCities() {
  return fs
    .readdirSync(DATA_DIR)
    .filter((f) => /^ranked_.+\.json$/.test(f))
    .map((f) => f.replace(/^ranked_/, "").replace(/\.json$/, ""))
    .sort();
}

/**
 * Reads and parses a single city's v2.1 ranked JSON file.
 *
 * @param {string} slug  e.g. "melbourne"
 * @returns {object}     full city data object (v2.1 schema)
 */
function readCity(slug) {
  const filePath = fileFor(slug);

  if (!fs.existsSync(filePath)) {
    throw new Error(`City file not found: ${filePath}`);
  }

  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

/**
 * Serialises and writes a city object back to its v2.1 ranked JSON file,
 * using the house-style serializer (2-space indent, inline primitive
 * arrays, trailing newline) so output matches the existing files.
 *
 * @param {string} slug
 * @param {object} data
 */
function writeCity(slug, data) {
  fs.writeFileSync(fileFor(slug), serialize(data) + "\n", "utf-8");
}

module.exports = { listCities, readCity, writeCity };
