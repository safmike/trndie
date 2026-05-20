const fs   = require("fs");
const path = require("path");

const REPO_ROOT      = path.join(__dirname, "..", "..", "..", "..");
const DATA_DIR       = path.join(REPO_ROOT, "data");
const VIBE_TAGS_FILE = path.join(REPO_ROOT, "config", "vibe_tags.json");

// In-voice taglines keyed by city slug.
// Add an entry each time a city migrates to the v2.1 schema.
const TAGLINES = {
  melbourne: "Melbourne's best week, refreshed every Thursday.",
  sydney: "Sydney's best week, refreshed every Thursday.",
  brisbane: "Brisbane's best week, refreshed every Thursday.",
  adelaide: "Adelaide's best week, refreshed every Thursday.",
  "gold coast": "Gold Coast's best week, refreshed every Thursday.",
  canberra: "Canberra's best week, refreshed every Thursday.",
  perth: "Perth's best week, refreshed every Thursday.",
  newcastle: "Newcastle's best week, refreshed every Thursday.",
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Parse ISO date string without timezone math: "2026-05-18T06:00:00+10:00" → "18 May 2026"
function formatDate(iso) {
  const parts = String(iso).slice(0, 10).split("-");
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!y || !m || !d) return "";
  return d + " " + MONTHS[m - 1] + " " + y;
}

module.exports = function () {
  const vibeTags    = JSON.parse(fs.readFileSync(VIBE_TAGS_FILE, "utf-8")).tags || [];
  const labelToVal  = {};
  vibeTags.forEach(function (t) { labelToVal[t.label] = t.value; });

  if (!fs.existsSync(DATA_DIR)) return [];

  return fs
    .readdirSync(DATA_DIR)
    .filter(function (f) { return /^ranked_.+\.json$/.test(f); })
    .map(function (f) {
      const city = JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), "utf-8"));

      // Fields consumed by base.njk and city-v2.njk
      city.name     = city.city;
      city.slug     = city.city.toLowerCase();
      city.tagline  = TAGLINES[city.slug] || (city.city + ", refreshed twice a week.");
      city.lastUpdatedDisplay = formatDate(city.last_updated);
      city.vibeTags = vibeTags;

      // Enrich each venue with {value,label} vibe objects for template use
      city.venues = (city.venues || []).map(function (v) {
        const tagObjs = (v.vibe_tags || []).map(function (label) {
          return {
            label: label,
            value: labelToVal[label] || label.toLowerCase().replace(/\s+/g, "-"),
          };
        });
        return Object.assign({}, v, { vibe_tag_objs: tagObjs });
      });

      return city;
    });
};
