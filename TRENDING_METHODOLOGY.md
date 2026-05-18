# TRNDIE — Data Pipeline & Scoring Methodology

**Version:** 2.1
**Project:** TRNDIE (trendy-vivid.vercel.app)
**Repo:** github.com/safmike/trendy
**Stack:** Static HTML/CSS/JS (frontend) + Python pipeline (backend data generation)
**Last updated:** 2026-05-18

---

## Changelog — v2.0 → v2.1

- **Apify trigger rewritten** to explicitly target editorial gaps (high search interest, no editorial coverage) rather than reinforcing already-hot venues
- **Tier-2 editorial sources added** (Concrete Playground, Urban List, Good Food) to reduce concentration risk on Broadsheet + Timeout
- **City tiering introduced** — Tier 1, 2, 3 cities run different signal weights based on editorial coverage depth
- **Newness boost** — venues discovered within the last 30 days get a +10% composite score modifier
- **Source independence weighting** — second mention from a different source family weighted at 0.7×, third+ at 0.5×
- **Model reference updated** from Sonnet 4 to Haiku 4.5 (sufficient for structured synthesis, materially cheaper)
- **Closure detection** — monthly Mapbox re-geocode sweep flags likely-closed venues
- **pytrends graceful degradation** — trend failures redistribute weights instead of blocking the pipeline
- **Resilience & Migration Plan** new section — fallback story for editorial scraping ToS risk

---

## Overview

TRNDIE surfaces trending Australian cafes organised by city. The data pipeline runs on a **Thursday/Sunday cadence** (twice weekly), producing a refreshed ranked list per city written to static JSON files consumed by the frontend.

The pipeline is deliberately cost-minimised: Google Maps/Places API is avoided for routine operations. Discovery and scoring rely on free or free-tier sources, with Claude used as the final synthesis and copywriting layer.

---

## Pipeline Architecture

```
DISCOVERY                  VALIDATION          SCORING                       SYNTHESIS           PUBLISH
─────────────              ──────────────      ─────────────────────         ──────────────      ─────────
Tier 1 sources                                  Editorial score  ─┐
(Broadsheet,         ──┐                        Trends score    ──┤
Timeout)               │                        Rating baseline  ─┤
                       ├──► Deduplicate ──┬──►  Review baseline  ─┤───► Claude API ────► ranked_<city>.json
Tier 2 sources         │   & normalise    │     Newness modifier ─┘     (rank + copy)
(Concrete Playground,  │   venue list     │
Urban List, Good Food) │                  │
                       │                  │     Apply CITY TIER WEIGHTS
Mapbox / TomTom      ──┘                  │
(existence + rating                       │
 + closure check)                         │
```

**Update schedule:** Pipeline runs Wednesday night and Saturday night, publishing Thursday AM and Sunday AM (AEST). A separate **monthly maintenance pass** runs on the 1st of each month for closure detection.

---

## City Tiering

Cities vary dramatically in editorial coverage depth. Without explicit tiering, ranking quality silently degrades for smaller cities because the editorial signal (45% weight) is structurally weaker there. Tiering makes this explicit.

| Tier | Cities | Editorial coverage | Weight strategy |
|---|---|---|---|
| **Tier 1** | Melbourne, Sydney | Deep (Broadsheet + Timeout + Good Food daily) | Editorial 45 / Trends 30 / Rating 15 / Reviews 10 |
| **Tier 2** | Brisbane, Perth, Adelaide, Gold Coast | Moderate (Broadsheet weekly, Timeout occasional) | Editorial 35 / Trends 40 / Rating 15 / Reviews 10 |
| **Tier 3** | Canberra, Newcastle, Wollongong, Hobart, Darwin, Cairns | Thin to nil | Editorial 20 / Trends 50 / Rating 15 / Reviews 15. Apify trigger expected to fire more often. |

When adding a new city, classify it into a tier explicitly in `/config/cities.json`. Default to **Tier 3** for any city not in the named lists above.

---

## Stage 1: Discovery — Editorial Sources

### Purpose
Identify newly trending or newly opened cafes via human-curated editorial coverage. Editorial mention is the strongest fraud-resistant signal in the cafe space — TikTok views can be bought, but a Broadsheet feature reflects expert human curation.

### Tier 1 sources (primary)
| Source | URL targets | Coverage |
|---|---|---|
| Broadsheet | broadsheet.com.au/melbourne/food-and-drink, /sydney, /brisbane, /perth, /adelaide | National, strong on Melbourne/Sydney |
| Timeout Australia | timeout.com/australia/restaurants | Sydney, Melbourne primary |

### Tier 2 sources (secondary, source_weight 0.5×)
| Source | URL targets | Coverage |
|---|---|---|
| Concrete Playground | concreteplayground.com/[city]/eat-drink | Sydney, Melbourne, Brisbane |
| Urban List | theurbanlist.com/[city]/a-list/food-and-drink | National, lifestyle-focused |
| Good Food (SMH/Age) | goodfood.com.au/melbourne, /sydney | Sydney, Melbourne |
| Local food blogs (configurable) | defined per-city in `/config/sources.json` | Variable |

Tier 2 sources count toward the editorial signal but at half weight. This diversifies away from concentration risk on Broadsheet + Timeout without changing the core editorial-first philosophy.

### Source independence ladder
A single venue may appear across multiple sources in the same window. To avoid double-counting correlated editorial pickups:

- First mention from any source: full weight (1.0×)
- Second mention from a *different source* within the same 14-day window: 0.7×
- Third mention from yet another source: 0.5×
- Fourth+: 0.3×
- Multiple mentions from the *same source* within 14 days: collapse to one (use most recent)

This handles the common case where Timeout follows Broadsheet on a hot opening — they're not truly independent signals.

### What to scrape
- Listicle pages: "Best new cafes in [City]", "Where to eat this week", "Hot right now"
- Individual venue review pages published in the last 14 days
- Extract: **venue name**, **suburb/area**, **short descriptor**, **publication date**, **URL**, **source**, **source_tier**

### Scraping implementation
- Use `requests` + `BeautifulSoup` (Python)
- Polite rate limiting: 5–10 second delay between requests
- Rotating user-agent strings
- Cache raw HTML locally per run — only re-scrape if >12 hours old
- Per-domain exponential backoff on 403/429: 1hr → 4hr → 24hr → escalate to Resilience plan
- All sites have ToS prohibiting scraping; keep request volume low and non-commercial. See **Resilience & Migration Plan** for fallbacks.

### Output
```json
{
  "venue_name": "Patricia Coffee Brewers",
  "city": "Melbourne",
  "suburb": "CBD",
  "source": "broadsheet",
  "source_tier": 1,
  "mention_date": "2026-05-15",
  "source_url": "https://broadsheet.com.au/...",
  "descriptor": "Standing-room espresso bar beloved by industry locals"
}
```

---

## Stage 2: Validation — Mapbox + TomTom (Free Tiers)

### Purpose
Confirm discovered venues exist, capture canonical addresses, snapshot ratings as a **quality floor filter** (not as a ranker), and detect closures over time.

### Free tier budget (Thu/Sun cadence + monthly closure pass)
| Source | Free tier | Monthly usage | Headroom |
|---|---|---|---|
| Mapbox Geocoding | 100,000/month | ~8,500 | 91,500 remaining |
| TomTom Search | 75,000/month | ~8,500 | 66,500 remaining |

Use **Mapbox as primary**, TomTom as fallback if Mapbox returns no result.

### Mapbox endpoint
```
GET https://api.mapbox.com/geocoding/v5/mapbox.places/{venue_name},{suburb},{city},Australia.json
    ?access_token={MAPBOX_TOKEN}
    &country=AU
    &types=poi
    &limit=1
```

### TomTom fallback endpoint
```
GET https://api.tomtom.com/search/2/search/{venue_name} {suburb} {city}.json
    ?key={TOMTOM_KEY}
    &countrySet=AU
    &limit=1
    &categorySet=7315
```

### Output fields
```json
{
  "venue_name": "Patricia Coffee Brewers",
  "canonical_address": "493 Little Bourke St, Melbourne VIC 3000",
  "lat": -37.8152,
  "lng": 144.9558,
  "rating": 4.6,
  "review_count": 1240,
  "geocode_source": "mapbox",
  "place_id_mapbox": "poi.abc123"
}
```

### Quality floor filter
Drop any venue where:
- Geocoding returns no result from both Mapbox AND TomTom (likely name mismatch or closure — see closure detection)
- Rating is present and below 3.5★

### Closure detection
On the **1st of each month**, re-geocode every venue currently in the database:
- One monthly "no result" → mark `closure_candidate: true`
- Two consecutive monthly "no result" → flag `likely_closed: true`
- Flagged venues drop out of ranking but remain in DB for a 60-day grace period (in case of API anomaly or temporary rename)
- After 60 days flagged with no recovery, purge unless manually un-flagged

---

## Stage 3: Google Places API — New Venue Onboarding Only

Google Places API is **not used in the routine pipeline**. Reserved for first-time onboarding of newly confirmed venues to retrieve:
- Google Place ID (stored permanently)
- Canonical name as Google knows it
- A cover photo URL

### Endpoint (Places API New)
```
POST https://places.googleapis.com/v1/places:searchText
Headers: X-Goog-FieldMask: places.id,places.displayName,places.photos
Body: { "textQuery": "Patricia Coffee Brewers Melbourne" }
```

### Field mask discipline
Only request `places.id`, `places.displayName`, `places.photos`. Do **not** include `rating`, `userRatingCount`, `reviews`, or atmosphere fields — these trigger expensive SKUs unnecessarily.

### Cost expectation
~20–30 new venues onboarded per week ≈ ~240 calls/month ≈ **$4.80/month**.

---

## Stage 4: Google Trends Scoring

### Purpose
Detect search interest spikes for tracked venue names. A geo-targeted search velocity spike is a strong leading indicator of trending status.

### Implementation
Use `pytrends` (unofficial Python wrapper, free, no billing required):

```python
from pytrends.request import TrendReq

pytrends = TrendReq(hl='en-AU', tz=600)  # AEST

def get_trend_score(venue_name: str, city: str) -> float | None:
    try:
        pytrends.build_payload(
            [f"{venue_name} {city}"],   # city suffix sharpens geo-intent
            cat=0,
            timeframe='now 7-d',
            geo=f'AU-{city_to_state[city]}'
        )
        df = pytrends.interest_over_time()
        if df.empty:
            return 0.0
        return float(df.iloc[:, 0].mean())   # 0–100 scale
    except Exception as e:
        log.warning(f"pytrends failure for {venue_name}: {e}")
        return None   # signals trends_unavailable downstream
```

### Graceful degradation
pytrends is unofficial infrastructure — Google can break it without notice. When it fails:
- `get_trend_score` returns `None`
- Composite scoring detects `None` and redistributes the Trends weight proportionally to remaining signals (see Stage 5)
- Venue is marked `trends_unavailable: true` in output JSON
- Pipeline never blocks on Trends failure

### Limitations
- pytrends rate-limits aggressively; add 60-second delays between calls
- Returns relative interest (0–100), not absolute volume — normalise within city cohort
- Geo-targeting is state-level only; appending the city name to the query mitigates spillover from regional NSW into Sydney scores

---

## Stage 5: Composite Scoring

### Baseline weights (Tier 1 cities)
| Signal | Weight | Source | Notes |
|---|---|---|---|
| Editorial mentions | 45% | Tier 1 + Tier 2 scraping | Recency + source-independence weighted |
| Google Trends score | 30% | pytrends | 7-day average, normalised within city |
| Rating validation | 15% | Mapbox / TomTom | Mapped 0–5★ → 0–1 |
| Review count baseline | 10% | Mapbox / TomTom | Log-normalised; rewards established-but-not-oversaturated venues |

For **Tier 2 / Tier 3** cities, use the rebalanced weights from the City Tiering table.

### Editorial mention scoring
```python
INDEPENDENCE = [1.0, 0.7, 0.5, 0.3, 0.2]

def editorial_score(mentions: list[dict]) -> float:
    # Step 1: collapse same-source duplicates within 14 days (keep most recent)
    by_source = {}
    for m in mentions:
        days_ago = (today - m['date']).days
        if days_ago > 14:
            continue
        if m['source'] not in by_source or m['date'] > by_source[m['source']]['date']:
            by_source[m['source']] = m

    # Step 2: order surviving mentions by recency
    sorted_mentions = sorted(by_source.values(), key=lambda x: x['date'], reverse=True)

    # Step 3: apply source-independence ladder + source weight + recency decay
    score = 0.0
    for i, m in enumerate(sorted_mentions):
        days_ago = (today - m['date']).days
        recency_weight = max(0, 1 - (days_ago / 14))
        if m['source'] == 'broadsheet':
            source_weight = 1.2
        elif m['source_tier'] == 1:
            source_weight = 1.0
        else:
            source_weight = 0.5
        independence = INDEPENDENCE[i] if i < len(INDEPENDENCE) else 0.1
        score += recency_weight * source_weight * independence

    return min(score, 1.0)
```

### Newness modifier
```python
def newness_modifier(first_discovered: date) -> float:
    days_since = (today - first_discovered).days
    return 1.10 if days_since <= 30 else 1.0
```

This captures the discovery angle — a brand-new cafe with one strong editorial mention should rank competitively against a 3-month-old cafe with sustained editorial love.

### Final composite (Tier 1 baseline)
```python
final_score = (
    editorial_score  * 0.45 +
    trends_score     * 0.30 +
    rating_score     * 0.15 +
    review_baseline  * 0.10
) * newness_modifier(venue.first_discovered)

final_score = min(final_score, 1.0)
```

### Composite when trends unavailable
If `trends_score is None`, redistribute the 30% weight proportionally across remaining signals:
```
editorial:  45% + 30% × (45/70) = 64.3%
rating:     15% + 30% × (15/70) = 21.4%
reviews:    10% + 30% × (10/70) = 14.3%
```

For Tier 2 / Tier 3 cities, apply the same proportional redistribution to that tier's weights.

---

## Stage 6: Claude API — Synthesis and Copywriting

### Purpose
Claude takes the scored, ranked venue list and produces:
1. The final ranked top-10 per city
2. A 2-sentence "why it's trending" description per venue
3. Vibe tags for the filter system

### Model selection
Use `claude-haiku-4-5-20251001`. Structured JSON synthesis with a tight prompt is well within Haiku's capability and costs materially less than Sonnet. If quality drift is observed in trending copy, escalate to `claude-sonnet-4-6`.

### Prompt structure
```python
prompt = f"""
You are a cafe trend analyst for TRNDIE, an Australian trending cafe discovery app.

Below is a ranked list of cafes in {city} with their scores and editorial context.
For each cafe, write exactly 2 sentences explaining why it's trending right now.
Be specific, energetic, and grounded in the editorial signals provided.
Also assign 2–3 vibe tags from this list: {VIBE_TAGS}

Respond only in JSON matching this schema:
[
  {{
    "rank": 1,
    "venue_name": "...",
    "suburb": "...",
    "trending_copy": "...",
    "vibe_tags": ["...", "..."]
  }}
]

Venues to process:
{json.dumps(ranked_venues, indent=2)}
"""
```

### API call
```python
import anthropic

client = anthropic.Anthropic()

response = client.messages.create(
    model="claude-haiku-4-5-20251001",
    max_tokens=2000,
    messages=[{"role": "user", "content": prompt}]
)

result = json.loads(response.content[0].text)
```

### Canonical vibe tags
The `VIBE_TAGS` list is maintained in `/config/vibe_tags.json` as the single source of truth. Claude is instructed to assign only from this list — no model-driven drift. New tags require explicit config addition.

### Cost estimate
~2,000 tokens in + ~1,500 tokens out per city × 8 cities × 8 runs/month ≈ ~176,000 tokens/month. At Haiku 4.5 pricing: **under $0.50/month**.

---

## Stage 7: Output — Static JSON

The pipeline writes one JSON file per city, consumed directly by the frontend (no backend server required).

### File naming
```
/data/ranked_melbourne.json
/data/ranked_sydney.json
/data/ranked_brisbane.json
... etc
```

### Schema (v2.1)
```json
{
  "city": "Melbourne",
  "tier": 1,
  "last_updated": "2026-05-18T06:00:00+10:00",
  "next_update": "2026-05-21T06:00:00+10:00",
  "methodology_version": "2.1",
  "venues": [
    {
      "rank": 1,
      "venue_name": "Patricia Coffee Brewers",
      "suburb": "CBD",
      "canonical_address": "493 Little Bourke St, Melbourne VIC 3000",
      "lat": -37.8152,
      "lng": 144.9558,
      "rating": 4.6,
      "composite_score": 0.87,
      "first_discovered": "2026-04-22",
      "newness_boost_applied": true,
      "trends_unavailable": false,
      "trending_copy": "Patricia has re-emerged as Melbourne's most-talked-about espresso bar after a wave of Broadsheet coverage this week. The no-seating format is back in fashion, and the queues out front are the proof.",
      "vibe_tags": ["Specialty Coffee", "Standing Room", "Industry Fave"],
      "google_place_id": "ChIJ...",
      "source_urls": [
        {"source": "broadsheet", "tier": 1, "url": "https://broadsheet.com.au/..."},
        {"source": "urban_list", "tier": 2, "url": "https://theurbanlist.com/..."}
      ]
    }
  ]
}
```

---

## TikTok / Apify — Conditional Use

Apify TikTok scraping is **not part of the routine pipeline** due to cost. It is triggered to catch socially viral cafes editorial has missed — the precise gap a TikTok scan is meant to fill.

### Trigger condition (v2.1 revision)
Fire Apify when **both** of the following hold for a venue in a single pipeline run:
- `trends_score > 0.6` (high search interest)
- `editorial_score < 0.2` (little or no editorial coverage)

This explicitly targets the editorial gap. v2.0's trigger required composite ≥ 0.75 across two runs, but composite is 45% editorial — so the old trigger structurally biased Apify toward venues that were *already* editorially hot. The new trigger goes the other way on purpose.

### Action
Run a targeted Apify scrape for `{venue_name} {city} cafe` on TikTok. Count posts and aggregate view counts over the last 7 days. Incorporate as a score modifier:
- 5–15 posts in 7 days: +10% composite
- 16+ posts in 7 days: +20% composite

### Cost expectation
~10–30 venues triggered per month across all cities. Expected: **$0–10/month** (higher than v2.0's $0–5 because the new trigger fires more readily by design — this is intended).

---

## Resilience & Migration Plan

The strongest signal in this methodology — editorial scraping — operates against Broadsheet and Timeout ToS. This is a known risk. The plan below ensures graceful degradation and provides a migration path if blocked.

### Defence in depth

**Layer 1 — Polite scraping (current):**
- Per-domain rate limits (5–10s between requests)
- HTML caching (12-hour TTL)
- Exponential backoff on 403/429 (1hr → 4hr → 24hr)
- Rotating user-agent strings
- Non-commercial, low volume

**Layer 2 — RSS where available:**
- Broadsheet publishes RSS feeds for some categories — subscribe directly, no scraping required
- Where RSS exists, prefer it over scraping the HTML page

**Layer 3 — Newsletter subscription parsing:**
- Subscribe a dedicated TRNDIE email address to Broadsheet and Timeout daily/weekly newsletters
- Parse incoming emails with Claude (via Gmail MCP or email-forwarding webhook)
- Newsletters are explicitly distributed to subscribers — parsing them avoids the scraping ToS issue entirely

**Layer 4 — Manual curation backstop:**
- If scraping is blocked and RSS/newsletters insufficient, expose an `/admin/add-mention` form
- Mike pastes in venue names + sources from manual reading
- Pipeline continues running on manually-curated editorial signal

**Layer 5 — Publisher partnership (long-term):**
- Once TRNDIE has visible audience, approach Broadsheet/Timeout about official data partnership
- Offer attribution + backlinks in exchange for sanctioned feed access

### Graceful degradation triggers
| Condition | Response |
|---|---|
| Single 403/429 from a Tier 1 source | Local backoff; continue run using cached data + Tier 2 sources |
| Sustained block (>48hr) from a Tier 1 source | Auto-elevate Tier 2 source weights from 0.5× → 0.8× until block resolves |
| Both Tier 1 sources blocked | Switch to RSS/newsletter parsing; alert Mike |
| pytrends 429 / failure | Skip Trends for that venue; redistribute weights (see Stage 4) |
| Mapbox + TomTom both unavailable | Skip new venue discovery for that run; use cached venue list |

---

## Environment Variables Required

```env
MAPBOX_TOKEN=pk.xxx
TOMTOM_KEY=xxx
GOOGLE_PLACES_API_KEY=xxx       # used only for onboarding
ANTHROPIC_API_KEY=sk-ant-xxx
APIFY_API_TOKEN=xxx              # optional, conditional use only
# Tier 2 source API keys (if/when any move to API access)
```

---

## Monthly Cost Summary (800 venues, Thu/Sun cadence)

| Service | Usage | Cost |
|---|---|---|
| Mapbox Geocoding | ~8,500 calls (incl. monthly closure pass) | **$0** (free tier) |
| TomTom Search | Fallback only | **$0** (free tier) |
| Google Places API | ~240 onboarding calls | **~$4.80** |
| pytrends (Google Trends) | Unlimited | **$0** |
| Claude API (Haiku 4.5) | ~176k tokens/month | **<$0.50** |
| Apify TikTok | Conditional, higher trigger rate than v2.0 | **~$0–10** |
| **Total** | | **~$5–15/month** |

---

## Integration with TRNDIE Automation

This document is the **single source of truth** for trending methodology. Automation that lives in `.claude/commands/` (e.g. `new-city.md`) references this file rather than re-implementing logic inline.

When the methodology evolves:

1. Edit this file
2. Bump the version
3. Update the changelog
4. Commit + push
5. Future agent runs (slash commands, Claude Code sessions, claude.ai/code) automatically pick up the new methodology

The slash command `/new-city <city>` will:
- Read this document
- Identify the target city's tier
- Apply that tier's signal weights
- Execute the pipeline stages
- Generate the city page using the resulting ranked JSON

---

## Open questions / v2.2 candidates

- **Reddit + Instagram location tag signals for Tier 3 cities** — currently Tier 3 relies on rebalanced existing signals; adding Reddit `r/[city]` post scanning and IG location-tag velocity would meaningfully improve smaller-city ranking quality
- **Click-through validation loop** — instrument the frontend to track which ranked venues users actually engage with; use as soft validation of methodology over time
- **Venue identity by place_id, not string-matched name** — current deduplication relies on venue name matching; move to Mapbox / Google place_id once onboarded
- **Per-vibe trending sub-rankings** — rather than a single ranked list per city, generate top-N per vibe tag for the filter UI

---

*v2.1 — May 2026*
