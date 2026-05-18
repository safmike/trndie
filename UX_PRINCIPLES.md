# TRNDIE — UX Principles & Design Brief

**Version:** 1.0
**Project:** TRNDIE (trendy-vivid.vercel.app)
**Repo:** github.com/safmike/trendy
**Companion document:** TRENDING_METHODOLOGY.md
**Last updated:** 2026-05-18

---

## Core thesis

TRNDIE is not a cafe-finding utility. Cafe-finding utilities die on retention — once a user finds the cafe, they're done.

TRNDIE is a **discovery magazine** whose value is the pleasure of being in-the-know about eight Australian cities at once. The user we design for browses Melbourne cafes from a couch in Perth, scrolls Hobart's matcha scene knowing they'll never visit, and feels a frisson of taste-confidence when they walk into one of the cafes they've been tracking from across the country.

Marketing brings users in. This feeling brings them back.

Every UI and UX decision in TRNDIE serves this thesis. If a feature optimises for utility at the cost of feeling, strip it.

---

## The six design pillars (in priority order)

### 1. Voice & Curation
**The highest-leverage layer. Free to fix. Currently the weakest.**

Cards must speak with a point of view, not describe a category. The reader should feel a friend with great taste is leaning across the table.

#### Voice spec
- Wry, confident, lightly Australian
- Never tries too hard
- Particulars over adjectives — name a booth, a barista's signature drink, a specific time of day
- Opinionated — willing to commit to a take
- Short sentences. Earned adjectives only.
- No marketing language ("discover," "experience," "elevate," "curated for you")

#### In-voice vs off-voice examples
| Off-voice | In-voice |
|---|---|
| "A trendy matcha cafe in Carlton, popular on TikTok." | "The matcha here is annoyingly good — Patricia-level discipline applied to one drink." |
| "Great vibes and friendly service." | "Sit in the second booth from the back. The light at 10am is the point." |
| "Discover the best of Melbourne's specialty coffee scene." | "Melbourne's best week, refreshed every Thursday." |
| "A must-visit for cafe enthusiasts." | "The queue at 8:15 is real. Worth it on a Tuesday, not a Saturday." |
| "Cozy atmosphere with a chic interior." | "Looks like a converted laundry. Probably was a converted laundry." |
| "Their signature dish is the smashed avo." | "The smashed avo is fine. Order the eggs Sardou." |

#### Synthesis prompt integration
The Stage 6 prompt in `TRENDING_METHODOLOGY.md` must include this voice spec verbatim. Future agent runs read both documents and apply the voice consistently. If a generated card reads off-voice, the fix is to strengthen the voice block in the prompt, not to hand-edit the card.

---

### 2. Atmosphere
**The visual layer. Carries everything voice doesn't.**

- **One curated cover photo per cafe, treated as a hero.** Not always interior. Sometimes a single coffee from above, sometimes a hand on a door, sometimes the queue at 8am. Aesthetic logic of a *Cereal* magazine spread, not a Yelp listing.
- **Consistent photo treatment.** Same crop ratio per surface (square for grid, 16:9 for hero, 3:4 for vertical card). Same warmth/temperature pass on every image — even mixed-source photos cohere if processed identically.
- **Per-city palette nudges.** Each city page shifts a base tint or accent. A returning user has a somatic sense of *which city they're in* before reading text. Melbourne reads slightly warmer; Hobart reads cooler; Cairns reads tropical. Subtle, not costumey.
- **No stock photography.** Ever. If a venue lacks usable imagery, surface a typography card instead — name, vibe tag, sentence of copy — and treat the absence as a design choice. Stock is the death of magazine feeling.

---

### 3. Discovery surface
**How the user wanders. Highest retention leverage after voice.**

- **Vibe-first browsing as a peer of city-first browsing.** A user can arrive at "Matcha-Pilled" as a home page and see all matcha cafes across all cities. Cross-city pull.
- **"From here, try also..." rail on every cafe card.** Three suggestions, same vibe, *different city*. This single mechanic converts a one-Melbourne visit into a four-city wander. Highest individual retention lever in the app.
- **Map view per city as a toggle.** Not default — list is more readable. But voyeurs love spatial browsing, and the toggle costs little.
- **Time/context filters alongside vibe.** "Where to work for 4 hours," "where to take a date," "where to nurse a hangover," "where to bring out-of-town friends." Context maps to *use-intent*, and use-intent is what makes a non-resident imagine themselves there.

---

### 4. Cadence
**The reason to come back. Make the Thu/Sun pipeline felt, not just functional.**

- **Visible "updated this Thursday" timestamp in the header.** Proud, not buried in metadata. The user should know they're reading the freshest dispatch.
- **"What's new this week" surface per city.** Three entries arriving, two falling off, one re-emerging. Diff is content. Diff is drama. This is the single most-clickable element TRNDIE can have.
- **Thursday-morning email digest (future).** One per subscribed city. Single best retention mechanism for any publish-cadence product — the Substack pattern.
- **Seasonal and thematic features.** "Winter sunshine-chasers." "Where the chefs eat on Mondays." "Cafes that broke in 2026." "Where to eat alone." Returning-visitor bait, and editorial firepower beyond pure trending.

---

### 5. Light retention mechanics
**Friction-free. Anonymous-first.**

- **Save/heart any cafe to a personal list — no login required.** localStorage. Login only when a user wants to sync across devices. Login walls kill voyeur mode.
- **Shareable cafe cards.** Clean OG image per cafe. DM-friendly. *"Look at this Melbourne place"* is the most valuable share a discovery app can produce — every cafe is its own social object.
- **No accounts, no ads, no popups, no email-gate.** As long as humanly possible. Friction-free is itself a quality signal and a real competitive moat.

---

### 6. Subtraction
**Design is also removal.**

Strip anything that reads as boilerplate or template-filler:
- Generic intros ("Discover the best of Melbourne") — they read AI-generated even when written by a human
- Filter chips nobody uses (gut-feel for now; instrument later)
- Footers, sidebars, "About TRNDIE" blocks repeated on every page
- Explanatory paragraphs about what TRNDIE is — *the cafes should explain TRNDIE*
- Any visual element that exists because a template expects it

If a section of a city page doesn't actively earn its space, delete it.

---

## Vibe tag taxonomy

Vibe tags are TRNDIE's filter system and a major surface for voice. A weak vibe tag is a wasted retention opportunity.

### Renaming principles
- **Commit to a vibe over describing a category.** "Specialty Coffee" describes; "Coffee-Forward" commits; "Coffee-Pilled" commits harder.
- **Internet-native phrasing welcome.** `-pilled`, `-coded`, `-core`, `-maxxing` suffixes carry voice without explanation.
- **Strong consonants where possible.** "Heaven," "Cult," "Hunt," "Den," "Pit."
- **Australian-inflected over American-borrowed where it lands naturally.**
- **The text-to-friend test.** Would you text this phrase to a friend? If no, rename.

### Current → suggested rename examples
| Current | Suggested |
|---|---|
| Matcha Lovers | Matcha-Pilled |
| Asian Fusion | East-Asian Coded *(or split: Banh Mi Cult, Dumpling Den, Hawker Hits)* |
| Bakery | Pastry Pit *(or)* Bread Heaven |
| Instagram-Worthy | Camera-Bait *(less try-hard than "Instagram-Worthy")* |
| Toastie Heaven | *(already strong, keep)* |

Full audit pending — see "Unicorn city refinement" below.

### Canonical list location
The single source of truth for vibe tags is `/config/vibe_tags.json`. Claude (via Stage 6 synthesis) may only assign from this list. No model-driven drift.

---

## Cafe card anatomy

Every cafe card across every city, every surface, must contain:

**Required**
- Cover photo (treated per the Atmosphere pillar)
- Venue name
- Suburb
- 2-sentence trending copy (in voice, per Stage 6 of methodology)
- 2–3 vibe tags from canonical list
- Save/heart affordance

**Optional, surface-dependent**
- "From here, try also" rail (cross-city)
- Map pin link
- Source attribution (small, footer of card)
- Rating (only if it adds — usually doesn't)

**Forbidden on cards**
- Price ranges in dollar-sign notation ($$, $$$)
- Star ratings displayed prominently (we're not Yelp)
- "Sponsored" or any commercial markers
- Generic categorical descriptors ("Cafe," "Restaurant," "Coffee Shop")

---

## City page anatomy

Order from top to bottom:

1. **City name + tagline** (one line, in voice, city-specific)
2. **"Updated this Thursday"** timestamp + city tier badge
3. **"What's new this week"** rail — 3 in, 2 out, 1 re-emerging
4. **Main ranked grid** — cafe cards, per anatomy spec above
5. **Vibe filter strip** (sticky on scroll on desktop)
6. **Map view toggle**

What's deliberately absent:
- No "About this city" intro paragraph
- No "Why we love [city]" block
- No footer beyond a minimal one shared across the site

---

## Anti-patterns — explicit do-nots

- **Don't explain TRNDIE on the city page.** The page IS TRNDIE.
- **Don't apologise for omissions.** ("This list isn't exhaustive..." — delete.)
- **Don't write hedged copy.** ("Some say the coffee is great..." — commit or cut.)
- **Don't pad the ranked list to round numbers.** Eight strong cafes beats ten with two weak ones.
- **Don't reuse cover photos across cards.** Every card gets its own image.
- **Don't allow generic vibe tags.** A vibe tag that could apply to half the database is not a vibe tag.
- **Don't surface scoring internals to the user.** Composite scores, weight breakdowns, "trends_unavailable" — all backend, never visible.

---

## The unicorn city refinement

The strategy: pick one existing city, refine it to the standard set above, then use that city as the canonical reference. All other cities (existing and future) are conformed to the unicorn. Future agents reference both this document AND the unicorn city's HTML as the working examples.

**Recommended unicorn:** Melbourne.

Reasons:
- Mike's home city — fastest ground-truth feedback loop
- Tier 1 — methodology runs at full strength, no compensating logic
- Deepest cafe culture in Australia — exercises every vibe tag and every voice register
- Strongest editorial coverage — densest signal to work with
- If the unicorn works for Melbourne, the standard transfers down cleanly to weaker-data cities

The unicorn refinement process:
1. Audit current Melbourne page against every pillar
2. Rewrite voice on every card (or regenerate via updated Stage 6 prompt)
3. Standardise photo treatment across all cards
4. Build the "what's new this week" surface
5. Implement the "from here, try also" rail (Melbourne → other cities only at first; reciprocal once other cities are refined)
6. Add the time/context filter strip
7. Tune the per-city palette nudge
8. Ship Melbourne. Pressure-test for a week.
9. Use the shipped Melbourne page as the working reference for refining the other seven, then for all future city builds via slash command.

---

## Integration with TRNDIE automation

This document is the **single source of truth** for design and UX decisions, alongside `TRENDING_METHODOLOGY.md` for sourcing and scoring.

When automation runs (slash commands, Claude Code sessions, claude.ai/code):

1. Read `CLAUDE.md` for project context
2. Read `TRENDING_METHODOLOGY.md` for what cafes to surface and how to rank
3. Read `UX_PRINCIPLES.md` for how the surface should look, feel, and read
4. Read the unicorn city's HTML for the working visual/structural reference
5. Execute

When UX principles evolve:

1. Edit this file
2. Bump version
3. Update changelog
4. Commit + push
5. All future runs pick up the new standard automatically

---

## Changelog — v1.0

- Initial design brief. Six pillars established. Voice spec, vibe taxonomy, card anatomy, page anatomy, anti-patterns codified. Melbourne nominated as unicorn city for refinement.

---

## Open questions / v1.1 candidates

- **Vibe tag full audit** — current 5 → refined ~12–15 tags, pending unicorn city work
- **Per-city tagline voice** — codify how Sydney's tagline differs in register from Hobart's
- **Map view styling** — when implemented, what's the visual standard? (Mapbox custom style probably)
- **Email digest template** — design and voice when the Thursday digest launches
- **Mobile-specific principles** — most browsing will be mobile; the pillars above are platform-agnostic but mobile may need its own anatomy section
- **Accessibility floor** — minimum contrast, alt text policy, keyboard nav. Not in v1.0 but mandatory before any wider launch

---

*v1.0 — May 2026*
