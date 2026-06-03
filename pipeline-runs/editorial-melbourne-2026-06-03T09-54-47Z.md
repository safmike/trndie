# Editorial pipeline run — melbourne

- **Mode:** `live`  (extractor: `claude`, model: `claude-haiku-4-5-20251001`)
- **Generated at:** `2026-06-03T09:55:17.577Z`
- **As-of (recency reference):** `2026-06-03T09:55:17.576Z`
- **Phase:** 2 (observe-only, editorial signal MVP)
- **Per-feed article cap:** 20
- **Cafe scope (IN):** `cafe` `espresso_bar` `coffee_roaster` `brunch_spot` `cafe_bakery`
- **City suburb whitelist:** `config/city_suburbs.json` · 104 suburbs for `melbourne`
- **Existing ranked venues in `ranked_melbourne.json`:** 10

> **OBSERVE-ONLY.** No `ranked_*.json` was modified by this run. The aggregated venues, candidates, and reinforcements below are observations only — they are listed, not injected into live data.

## Per source

| Source | Feed used | Attempts | In feed | Processed | Capped | Extracted | Kept | Rejected | Held | Status |
|---|---|---:|---:|---:|:---:|---:|---:|---:|---:|---|
| broadsheet | _(none worked)_ | 4 | 0 | 0 | – | 0 | 0 | 0 | 0 | **FAIL**: `http_4xx` — all 4 candidate feeds failed for broadsheet |
| concrete_playground | `https://concreteplayground.com/melbourne/feed` | 2 | 10 | 10 | – | 2 | 1 | 0 | 0 | ok |
| time_out | _(none worked)_ | 5 | 0 | 0 | – | 0 | 0 | 0 | 0 | **FAIL**: `parse_error` — all 5 candidate feeds failed for time_out |

### Feed URL attempts (per source)

#### broadsheet

| # | URL | Status | OK? | Error |
|---:|---|---|:---:|---|
| 1 | `https://www.broadsheet.com.au/melbourne/food-and-drink/feed` | 404 Not Found | ❌ | HTTP 404 Not Found for https://www.broadsheet.com.au/melbourne/food-and-drink/feed |
| 2 | `https://www.broadsheet.com.au/melbourne/food-and-drink/feed/` | 404 Not Found | ❌ | HTTP 404 Not Found for https://www.broadsheet.com.au/melbourne/food-and-drink/feed/ |
| 3 | `https://www.broadsheet.com.au/melbourne/feed` | 404 Not Found | ❌ | HTTP 404 Not Found for https://www.broadsheet.com.au/melbourne/feed |
| 4 | `https://www.broadsheet.com.au/feed` | 404 Not Found | ❌ | HTTP 404 Not Found for https://www.broadsheet.com.au/feed |

#### concrete_playground

| # | URL | Status | OK? | Error |
|---:|---|---|:---:|---|
| 1 | `https://concreteplayground.com/melbourne/eat-drink/feed` | 404 Not Found | ❌ | HTTP 404 Not Found for https://concreteplayground.com/melbourne/eat-drink/feed |
| 2 | `https://concreteplayground.com/melbourne/feed` | 200 OK | ✅ |  |

#### time_out

| # | URL | Status | OK? | Error |
|---:|---|---|:---:|---|
| 1 | `https://www.timeout.com/melbourne/restaurants/rss` | 404 Not Found | ❌ | HTTP 404 Not Found for https://www.timeout.com/melbourne/restaurants/rss |
| 2 | `https://www.timeout.com/melbourne/restaurants/feed` | 404 Not Found | ❌ | HTTP 404 Not Found for https://www.timeout.com/melbourne/restaurants/feed |
| 3 | `https://www.timeout.com/melbourne/news/rss.xml` | 404 Not Found | ❌ | HTTP 404 Not Found for https://www.timeout.com/melbourne/news/rss.xml |
| 4 | `https://www.timeout.com/melbourne/feed` | 404 Not Found | ❌ | HTTP 404 Not Found for https://www.timeout.com/melbourne/feed |
| 5 | `https://au.timeout.com/melbourne/xmlapi/public` | 200 OK | ❌ | response did not look like RSS/Atom XML |

## Extracted, kept venue mentions

### broadsheet

> Feed failed: `http_4xx` — all 4 candidate feeds failed for broadsheet

### concrete_playground

- ❌ **Good Nature Hotel** — json_parse: Unexpected non-whitespace character after JSON at position 21
- ❌ **&#039;ENCORE!&#039; Presents 50 Unforgettable Aussie Performance Treasures, From Kylie&#039;s Hot Pants to Jackman&#039;s Stage Costumes** — json_parse: Unexpected non-whitespace character after JSON at position 21
- **This Takes the Cake: To Celebrate 125 Years in Business, This Bakery is Handing Out 10,000 Free Slices of Cake**
  - Date: `Wed, 03 Jun 2026 05:55:28 +0000`
  - URL: <https://concreteplayground.com/melbourne/news-2/ferguson-plarre-125-years>
  - Mentions: raw=1, kept=1, rejected=0, held=0
    - **Ferguson Plarre's Bakehouses** (Moonee Ponds, `cafe_bakery`) — The article profiles this 125-year-old family bakery chain celebrating its milestone with free cake giveaways and special pricing on legacy items.
- **This Melbourne Product Developer Has Made the Ultimate Aesthetic Hot Pilates Towel — Because Sweating Should Be Chic, Too**
  - Date: `Wed, 03 Jun 2026 04:08:14 +0000`
  - URL: <https://concreteplayground.com/melbourne/design-style/fashion/this-melbourne-product-developer-got-sick-of-her-pilates-towel-and-did-something-about-it>
  - Mentions: raw=0, kept=0, rejected=0, held=0
- ❌ **Peninsula Pass for World Bathing Day** — json_parse: Unexpected non-whitespace character after JSON at position 21
- ❌ **Electronic Heavyweights Barry Can&#039;t Swim, Interplanetary Criminal and Richie Hawtin Lead This East Coast Festival Triple-Header** — json_parse: Unexpected non-whitespace character after JSON at position 21
- ❌ **The World&#039;s Best Shiraz Has Been Crowned — This Trophy-Winning Drop From McLaren Vale&#039;s Beresford Estate Costs Just $25** — json_parse: Unexpected non-whitespace character after JSON at position 21
- ❌ **Hotel Railway Brunswick** — json_parse: Unexpected non-whitespace character after JSON at position 21
- ❌ **KĀYA Health Clubs Has Opened a Massive New Sanctuary Inside Chadstone, Designed as an All-in-One Wellness Escape** — json_parse: Unexpected non-whitespace character after JSON at position 21
- ❌ **Take the Scenic Route Minus the Crowds — These Five Australian Road Trips Will Get You Off-the-Beaten Path** — json_parse: Unexpected non-whitespace character after JSON at position 21

### time_out

> Feed failed: `parse_error` — all 5 candidate feeds failed for time_out

## Aggregated signal

| Venue | Suburb | Distinct sources | Signal | Lock-in? | Classification |
|---|---|---|---:|:---:|---|
| Ferguson Plarre's Bakehouses | Moonee Ponds | concrete_playground | 1 | – | NEW candidate |

## Multi-source lock-ins (≥2 distinct tier-1 sources)

_none in this run_

## NEW candidates (not in `ranked_melbourne.json`) — listed, NOT injected

- **Ferguson Plarre's Bakehouses** (Moonee Ponds) — sources: concrete_playground · signal 1

## Reinforces existing ranked venues

_none in this run_

## Sample `source_urls` attribution preview (v2.1 schema)

```json
[
  {
    "venue_name": "Ferguson Plarre's Bakehouses",
    "suburb": "Moonee Ponds",
    "proposed_source_urls": [
      {
        "source": "concrete_playground",
        "tier": 1,
        "url": "https://concreteplayground.com/melbourne/news-2/ferguson-plarre-125-years"
      }
    ]
  }
]
```

## Weights (WIP, tunable on `PHASE2_WEIGHTS`)

```json
{
  "RECENCY_WINDOW_DAYS": 14,
  "INDEPENDENCE_LADDER": [
    1,
    0.7,
    0.5,
    0.3,
    0.2
  ],
  "SOURCE_WEIGHT": {
    "broadsheet": 1.2,
    "concrete_playground": 1,
    "time_out": 1
  },
  "DEFAULT_SOURCE_WEIGHT": 1,
  "LOCK_IN_DISTINCT_SOURCES": 2
}
```

## Notes

- OBSERVE-ONLY: no ranked_*.json was modified.
- Cafe-only scope is enforced at extraction (prompt) AND post-extraction (filters.js). Held mentions need a location check; rejected mentions are out of scope.
- Geo filter checks the suburb against config/city_suburbs.json. Missing or unknown suburbs are HELD, not auto-included.
- Each source's `tried_feed_urls` shows the exact HTTP status of every feed URL attempt — so a blanked source is no longer a black box.
- Weights in `weights` are WIP — Phase 2 explores signal quality; the final composite blend lands in Phase 3+.
- attribution_preview entries match v2.1 schema exactly: {source, tier, url}. mention_date is captured upstream for recency scoring but is intentionally NOT injected into source_urls — schema extension belongs to v2.2.
- In fixture mode, the extractor reads sidecar `<article>.mentions.json` files. Real (non-fixture) runs use Claude.
