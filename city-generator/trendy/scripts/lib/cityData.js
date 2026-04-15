/**
 * cityData.js
 * ─────────────────────────────────────────────────────────────────
 * File I/O layer for per-city JSON files.
 *
 * All other modules call these functions instead of touching the
 * filesystem directly, so the data path is only defined in one place.
 */

"use strict";

const fs   = require("fs");
const path = require("path");

// Resolved once at startup — keeps the rest of the code path-free
const DATA_DIR = path.resolve(__dirname, "../../src/_data/cityData");

/**
 * Returns every city slug derived from the filenames in the data dir.
 * Example return: ["adelaide", "brisbane", "melbourne", ...]
 *
 * @returns {string[]}
 */
function listCities() {
  return fs
    .readdirSync(DATA_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => path.basename(f, ".json"))
    .sort();
}

/**
 * Reads and parses a single city JSON file.
 *
 * @param {string} slug  e.g. "melbourne"
 * @returns {object}     full city data object
 */
function readCity(slug) {
  const filePath = path.join(DATA_DIR, `${slug}.json`);

  if (!fs.existsSync(filePath)) {
    throw new Error(`City file not found: ${filePath}`);
  }

  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

/**
 * Serialises and writes a city object back to its JSON file.
 * Always pretty-prints with 2-space indent to keep diffs readable.
 *
 * @param {string} slug
 * @param {object} data
 */
function writeCity(slug, data) {
  const filePath = path.join(DATA_DIR, `${slug}.json`);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

module.exports = { listCities, readCity, writeCity };
