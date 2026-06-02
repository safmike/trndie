# Editorial pipeline run — melbourne

- **Mode:** `live`  (extractor: `claude`, model: `claude-haiku-4-5-20251001`)
- **Generated at:** `2026-06-02T12:27:23.604Z`
- **As-of (recency reference):** `2026-06-02T12:27:23.602Z`
- **Phase:** 2 (observe-only, editorial signal MVP)
- **Per-feed article cap:** 20
- **Existing ranked venues in `ranked_melbourne.json`:** 10

> **OBSERVE-ONLY.** No `ranked_*.json` was modified by this run. The aggregated venues, candidates, and reinforcements below are observations only — they are listed, not injected into live data.

## Per source

| Source | Feed | In feed | Processed | Capped | Extracted | Failed | Mentions | Status |
|---|---|---:|---:|:---:|---:|---:|---:|---|
| broadsheet | `https://www.broadsheet.com.au/melbourne/food-and-drink/feed` | 0 | 0 | – | 0 | 0 | 0 | **FAIL**: HTTP 404 Not Found for https://www.broadsheet.com.au/melbourne/food-and-drink/feed |
| concrete_playground | `https://concreteplayground.com/melbourne/feed` | 10 | 10 | – | 9 | 1 | 19 | ok |
| time_out | `https://www.timeout.com/melbourne/restaurants/rss` | 0 | 0 | – | 0 | 0 | 0 | **FAIL**: HTTP 404 Not Found for https://www.timeout.com/melbourne/restaurants/rss |

## Extracted venue mentions

### broadsheet

> Feed failed: HTTP 404 Not Found for https://www.broadsheet.com.au/melbourne/food-and-drink/feed

### concrete_playground

- **The World&#039;s Best Shiraz Has Been Crowned — This Trophy-Winning Drop From McLaren Vale&#039;s Beresford Estate Costs Just $25**
  - Date: `Tue, 02 Jun 2026 05:38:07 +0000`
  - URL: <https://concreteplayground.com/melbourne/news-2/beresford-estate-classic-shiraz>
  - Mentions extracted: 0
- **Hotel Railway Brunswick**
  - Date: `Tue, 02 Jun 2026 03:57:00 +0000`
  - URL: <https://concreteplayground.com/melbourne/pubs/hotel-railway-brunswick>
  - Mentions extracted: 1
    - **Hotel Railway** (Brunswick) — The article profiles this 140-year-old pub as a community hub, detailing its refreshed space, menu offerings including a Saturday steak-and-chips special, and winter dog-friendly promotions.
- ❌ **KĀYA Health Clubs Has Opened a Massive New Sanctuary Inside Chadstone, Designed as an All-in-One Wellness Escape** — json_parse: Unexpected non-whitespace character after JSON at position 21
- **From Morning Hot-Air Ballooning to Moonlit Kayaking: These Are Melbourne&#039;s Coolest Winter Adventures**
  - Date: `Tue, 02 Jun 2026 01:09:03 +0000`
  - URL: <https://concreteplayground.com/melbourne/travel-leisure/from-morning-hot-air-ballooning-to-moonlit-kayaking-these-are-melbournes-coolest-winter-adventures>
  - Mentions extracted: 0
- **At Carlton&#039;s Historic Malt Store, Birkenstock&#039;s New Flagship Celebrates Heritage and Gives Old Sandals a Second Life**
  - Date: `Tue, 02 Jun 2026 00:59:57 +0000`
  - URL: <https://concreteplayground.com/melbourne/design-style/birkenstock-carlton-malt-store>
  - Mentions extracted: 0
- **Guinness Is More Popular Than Ever — Here&#039;s Where to Find a Pint in Melbourne**
  - Date: `Mon, 01 Jun 2026 03:09:02 +0000`
  - URL: <https://concreteplayground.com/melbourne/food-drink/guinness-is-more-popular-than-ever-heres-where-to-find-a-pint-in-melbourne>
  - Mentions extracted: 6
    - **The Fifth Province** (St Kilda) — Featured as an Irish pub on Fitzroy Street offering expertly poured Guinness, live music, and pub classics.
    - **Jimmy O'Neill's** (St Kilda) — Highlighted for carefully poured Guinness, pub essentials menu, and a strong live music program on Acland Street.
    - **Bridie O'Reilly's** (South Yarra) — Profiled as a high-energy Irish pub with well-poured Guinness, beer garden, and weekend entertainment.
    - **P.J.O'Brien's** (Southbank) — Presented as a long-standing Irish pub offering well-poured Guinness and weekday specials including complimentary pints.
    - **The Drunken Poet** (West Melbourne) — Featured as a traditional Irish pub named by The Irish Times as one of the best outside Ireland, known for beautifully kept Guinness and live music.
    - **The Irish Times** (Melbourne) — Showcased as a Little Collins Street pub offering atmospheric two-level space, live music, and hearty pub fare alongside Guinness.
- **Pidapipo Just Dropped Seven Limited-Edition Flavours, Including Green Apple Sorbet and Banana, Peanut Butter and Malt**
  - Date: `Mon, 01 Jun 2026 02:45:18 +0000`
  - URL: <https://concreteplayground.com/melbourne/food-drink/pidapipo-specials>
  - Mentions extracted: 1
    - **Pidapipo** (?) — The article profiles Pidapipo's launch of seven limited-edition gelato flavours available in June, highlighting its Italian gelato and seasonal offerings.
- **This Just in: The World&#039;s Best Burgers List Has Been Revealed, and We&#039;re Sorry, Melbourne, But Sydney Has Dominated This Round**
  - Date: `Mon, 01 Jun 2026 02:45:18 +0000`
  - URL: <https://concreteplayground.com/melbourne/news-2/worlds-best-burgers-list>
  - Mentions extracted: 10
    - **Cafe Margaret** (Double Bay) — Ranked third in the World's 101 Best Burgers List, featuring an American cheeseburger with CopperTree Farms beef patty and rose mayo.
    - **Margaret** (Double Bay) — Neil Perry's preeminent restaurant, mentioned for context as the parent establishment of Cafe Margaret and its recent accolade as second-best steak restaurant in the world.
    - **The International** (?) — Ranked tenth in the World's 101 Best Burgers List, featuring an 180-gram O'Connor beef patty with Australian cheddar and cognac-flambeed caramelised onions.
    - **Charrd** (Brunswick East) — Melbourne's highest-ranked burger venue at position 13 in the World's 101 Best Burgers List, a takeout joint with two cherry patties featuring truffle mayo and chilli jam.
    - **Will's** (Coogee) — Ranked 14th in the World's 101 Best Burgers List.
    - **Hubert** (?) — Sydney CBD burger venue ranked 16th in the World's 101 Best Burgers List.
    - **Bar Julius** (Redfern) — Ranked 17th in the World's 101 Best Burgers List.
    - **The Gidley** (?) — Ranked 19th in the World's 101 Best Burgers List.
    - **Seoul Tiger** (?) — Melbourne burger venue ranked 37th in the World's 101 Best Burgers List.
    - **Arkhe** (Adelaide) — Adelaide burger venue ranked 45th in the World's 101 Best Burgers List.
- **You Can Get up to 44% Off Portable Power Stations in This EOFY Sale**
  - Date: `Mon, 01 Jun 2026 00:06:40 +0000`
  - URL: <https://concreteplayground.com/melbourne/promotion/bluettie-eofy-sale>
  - Mentions extracted: 0
- **This Just in: Brooki Bakehouse&#039;s Cookie Empire Continues to Expand, with Plans for Its Next Pop-Up Just Announced**
  - Date: `Sun, 31 May 2026 23:24:07 +0000`
  - URL: <https://concreteplayground.com/melbourne/news-2/brooki-bakehouse-newcastle>
  - Mentions extracted: 1
    - **Brooki Bakehouse** (?) — The article announces the bakery's expansion to a Newcastle pop-up at Westfield Kotara and previous successful openings at Chadstone Shopping Centre and Adelaide.

### time_out

> Feed failed: HTTP 404 Not Found for https://www.timeout.com/melbourne/restaurants/rss

## Aggregated signal

| Venue | Suburb | Distinct sources | Signal | Lock-in? | Classification |
|---|---|---|---:|:---:|---|
| Hotel Railway | Brunswick | concrete_playground | 1 | – | NEW candidate |
| The Fifth Province | St Kilda | concrete_playground | 0.929 | – | NEW candidate |
| Jimmy O'Neill's | St Kilda | concrete_playground | 0.929 | – | NEW candidate |
| Bridie O'Reilly's | South Yarra | concrete_playground | 0.929 | – | NEW candidate |
| P.J.O'Brien's | Southbank | concrete_playground | 0.929 | – | NEW candidate |
| The Drunken Poet | West Melbourne | concrete_playground | 0.929 | – | NEW candidate |
| The Irish Times | Melbourne | concrete_playground | 0.929 | – | NEW candidate |
| Pidapipo | ? | concrete_playground | 0.929 | – | NEW candidate |
| Cafe Margaret | Double Bay | concrete_playground | 0.929 | – | NEW candidate |
| Margaret | Double Bay | concrete_playground | 0.929 | – | NEW candidate |
| The International | ? | concrete_playground | 0.929 | – | NEW candidate |
| Charrd | Brunswick East | concrete_playground | 0.929 | – | NEW candidate |
| Will's | Coogee | concrete_playground | 0.929 | – | NEW candidate |
| Hubert | ? | concrete_playground | 0.929 | – | NEW candidate |
| Bar Julius | Redfern | concrete_playground | 0.929 | – | NEW candidate |
| The Gidley | ? | concrete_playground | 0.929 | – | NEW candidate |
| Seoul Tiger | ? | concrete_playground | 0.929 | – | NEW candidate |
| Arkhe | Adelaide | concrete_playground | 0.929 | – | NEW candidate |
| Brooki Bakehouse | ? | concrete_playground | 0.929 | – | NEW candidate |

## Multi-source lock-ins (≥2 distinct tier-1 sources)

_none in this run_

## NEW candidates (not in `ranked_melbourne.json`) — listed, NOT injected

- **Hotel Railway** (Brunswick) — sources: concrete_playground · signal 1
- **The Fifth Province** (St Kilda) — sources: concrete_playground · signal 0.929
- **Jimmy O'Neill's** (St Kilda) — sources: concrete_playground · signal 0.929
- **Bridie O'Reilly's** (South Yarra) — sources: concrete_playground · signal 0.929
- **P.J.O'Brien's** (Southbank) — sources: concrete_playground · signal 0.929
- **The Drunken Poet** (West Melbourne) — sources: concrete_playground · signal 0.929
- **The Irish Times** (Melbourne) — sources: concrete_playground · signal 0.929
- **Pidapipo** (?) — sources: concrete_playground · signal 0.929
- **Cafe Margaret** (Double Bay) — sources: concrete_playground · signal 0.929
- **Margaret** (Double Bay) — sources: concrete_playground · signal 0.929
- **The International** (?) — sources: concrete_playground · signal 0.929
- **Charrd** (Brunswick East) — sources: concrete_playground · signal 0.929
- **Will's** (Coogee) — sources: concrete_playground · signal 0.929
- **Hubert** (?) — sources: concrete_playground · signal 0.929
- **Bar Julius** (Redfern) — sources: concrete_playground · signal 0.929
- **The Gidley** (?) — sources: concrete_playground · signal 0.929
- **Seoul Tiger** (?) — sources: concrete_playground · signal 0.929
- **Arkhe** (Adelaide) — sources: concrete_playground · signal 0.929
- **Brooki Bakehouse** (?) — sources: concrete_playground · signal 0.929

## Reinforces existing ranked venues

_none in this run_

## Sample `source_urls` attribution preview (v2.1 schema)

```json
[
  {
    "venue_name": "Hotel Railway",
    "suburb": "Brunswick",
    "proposed_source_urls": [
      {
        "source": "concrete_playground",
        "tier": 1,
        "url": "https://concreteplayground.com/melbourne/pubs/hotel-railway-brunswick"
      }
    ]
  },
  {
    "venue_name": "The Fifth Province",
    "suburb": "St Kilda",
    "proposed_source_urls": [
      {
        "source": "concrete_playground",
        "tier": 1,
        "url": "https://concreteplayground.com/melbourne/food-drink/guinness-is-more-popular-than-ever-heres-where-to-find-a-pint-in-melbourne"
      }
    ]
  },
  {
    "venue_name": "Jimmy O'Neill's",
    "suburb": "St Kilda",
    "proposed_source_urls": [
      {
        "source": "concrete_playground",
        "tier": 1,
        "url": "https://concreteplayground.com/melbourne/food-drink/guinness-is-more-popular-than-ever-heres-where-to-find-a-pint-in-melbourne"
      }
    ]
  },
  {
    "venue_name": "Bridie O'Reilly's",
    "suburb": "South Yarra",
    "proposed_source_urls": [
      {
        "source": "concrete_playground",
        "tier": 1,
        "url": "https://concreteplayground.com/melbourne/food-drink/guinness-is-more-popular-than-ever-heres-where-to-find-a-pint-in-melbourne"
      }
    ]
  },
  {
    "venue_name": "P.J.O'Brien's",
    "suburb": "Southbank",
    "proposed_source_urls": [
      {
        "source": "concrete_playground",
        "tier": 1,
        "url": "https://concreteplayground.com/melbourne/food-drink/guinness-is-more-popular-than-ever-heres-where-to-find-a-pint-in-melbourne"
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
- Weights in `weights` are WIP — Phase 2 explores signal quality; the final composite blend lands in Phase 3+.
- attribution_preview entries match v2.1 schema exactly: {source, tier, url}. mention_date is captured upstream for recency scoring but is intentionally NOT injected into source_urls — schema extension belongs to v2.2.
- In fixture mode, the extractor reads sidecar `<article>.mentions.json` files. Real (non-fixture) runs use Claude. Fixture sidecars are the EXPECTED extraction for the fixture article and serve as a regression check on the aggregator/attribution code.
