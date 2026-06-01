/**
 * extraction.js
 * ─────────────────────────────────────────────────────────────────
 * Phase 2 — venue-mention extraction from a single editorial article.
 *
 * Two extractor paths share one output contract:
 *
 *   extractWithClaude({ apiKey, model, articleText, articleMeta })
 *     → live Claude messages API call returning strict JSON
 *       { mentions: [{ venue_name, suburb, why }, ...] }.
 *
 *   extractFromFixtureSidecar(articlePath)
 *     → reads a sidecar `<article>.mentions.json` shipped next to the
 *       fixture HTML. The sidecar represents the expected Claude output
 *       for that fixture article and lets the rest of the chain run
 *       end-to-end with no API calls. Real (non-fixture) runs always
 *       use the Claude path.
 *
 * Both return { ok, mentions, raw?, error? } so the runner doesn't care
 * which one produced the result.
 */

"use strict";

const fs   = require("fs");
const path = require("path");

// Per TRENDING_METHODOLOGY.md — Haiku 4.5 is plenty for structured JSON
// extraction and materially cheaper than Sonnet. Override via the
// PHASE2_EXTRACTION_MODEL env var when experimenting.
const DEFAULT_MODEL = "claude-haiku-4-5-20251001";

const EXTRACTION_SYSTEM_PROMPT = `
You are extracting cafe / restaurant venue mentions from a single Australian
editorial article (e.g. Broadsheet, Concrete Playground, Time Out). Return
strict JSON only — no prose, no markdown fence — matching this schema:

{
  "mentions": [
    {
      "venue_name": "the venue's name as written in the article",
      "suburb": "Melbourne suburb / inner-city area, or null if unclear",
      "why": "one short neutral sentence summarising why the article surfaces this venue"
    }
  ]
}

Rules:
- Only include venues the article actively surfaces, profiles or recommends.
  Skip passing references, the author's previous work, generic chains, and
  honourable-mention asides without dedicated coverage.
- One entry per distinct venue. Collapse repeated mentions of the same venue.
- Keep "why" to one sentence, plain neutral tone. Editorial voice happens
  in a later synthesis step, not here.
- If the article qualifies zero venues, return {"mentions": []}.
- Do not invent venues. If unsure about the venue name or suburb, leave that
  field as null rather than guessing.
`.trim();

// ── Claude messages API ───────────────────────────────────────────────────────

async function callClaude({ apiKey, model, system, user, maxTokens }) {
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not set");
  }
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key":         apiKey,
      "anthropic-version": "2023-06-01",
      "content-type":      "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Claude API ${res.status}: ${body.slice(0, 500)}`);
  }
  const json  = await res.json();
  const block = (json.content || []).find((b) => b.type === "text");
  if (!block) throw new Error("Claude response had no text block");
  return block.text;
}

function parseExtractionJson(text) {
  // Tolerate a leading/trailing code-fence if Claude wrapped the JSON
  // despite being told not to.
  const cleaned = String(text)
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
  return JSON.parse(cleaned);
}

async function extractWithClaude({ apiKey, model, articleText, articleMeta }) {
  const user = [
    `Publication: ${articleMeta.publication}`,
    `Article title: ${articleMeta.title}`,
    `Article date:  ${articleMeta.date || "(unknown)"}`,
    "",
    "Article body:",
    "",
    String(articleText || "").slice(0, 12000), // safety cap; articles rarely need more
  ].join("\n");

  let raw;
  try {
    raw = await callClaude({
      apiKey,
      model:     model || DEFAULT_MODEL,
      system:    EXTRACTION_SYSTEM_PROMPT,
      user,
      maxTokens: 1200,
    });
  } catch (err) {
    return { ok: false, mentions: [], error: `claude_call: ${err.message}` };
  }

  try {
    const parsed   = parseExtractionJson(raw);
    const mentions = Array.isArray(parsed.mentions) ? parsed.mentions : [];
    return { ok: true, mentions, raw };
  } catch (err) {
    return { ok: false, mentions: [], raw, error: `json_parse: ${err.message}` };
  }
}

// ── Fixture sidecar ───────────────────────────────────────────────────────────

/**
 * Read the sidecar `<articlePath>.mentions.json` (replacing the trailing
 * .html / .htm extension). The sidecar is the expected Claude output for
 * the fixture article — it lets the rest of the chain run repeatedly
 * with no live API quota, and serves as a regression check on the
 * aggregator + attribution code once a real Claude run lands.
 */
function extractFromFixtureSidecar(articlePath) {
  if (!articlePath || typeof articlePath !== "string") {
    return { ok: false, mentions: [], error: "no article path (cannot locate sidecar)" };
  }
  const sidecar = articlePath.replace(/\.html?$/i, ".mentions.json");
  if (!fs.existsSync(sidecar)) {
    return { ok: false, mentions: [], error: `no sidecar at ${path.basename(sidecar)}` };
  }
  try {
    const parsed   = JSON.parse(fs.readFileSync(sidecar, "utf-8"));
    const mentions = Array.isArray(parsed.mentions) ? parsed.mentions : [];
    return { ok: true, mentions, sidecar };
  } catch (err) {
    return { ok: false, mentions: [], error: `sidecar_parse: ${err.message}` };
  }
}

module.exports = {
  DEFAULT_MODEL,
  EXTRACTION_SYSTEM_PROMPT,
  extractWithClaude,
  extractFromFixtureSidecar,
};
