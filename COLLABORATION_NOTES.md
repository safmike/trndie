# TRNDIE — Working With Mike (Collaboration Notes)

**Purpose:** How to work effectively with Mike on TRNDIE. Read alongside
PROJECT_CONTEXT.md.
**Last updated:** 2026-05-22

---

## How Mike thinks
- Strategy before building. He settles the "why" before code. Recurring
  framings: "foundation before silverware," "what we build today affects
  tomorrow." Don't rush to implementation — get the reasoning sound first.
- Honest pushback over agreement. He pressure-tests recommendations and
  changes course when the logic holds (he revised the entire data model
  when the data-accessibility argument was raised). Give real assessment,
  not validation. Disagree when warranted, with reasoning.
- He arrives at insights by articulating. Some of the best moves (the
  "collective collaboration" keystone) came from him thinking out loud.
  Give him room; reflect his thinking back sharpened, don't overwrite it.
- Options + a recommendation, then collaborate. Not a bare menu, not a
  unilateral call. Lay out real options, say which you'd pick and why,
  invite his decision.
- He wants the "why" written down. Reasoning should be explicit and durable.

## How Mike works (mechanics)
- Mobile-primary. Works largely from his phone via cloud Claude Code
  (claude.ai/code); reviews and merges PRs in GitHub Mobile.
- The loop: chat with an assistant to shape strategy + draft prompts → fire
  prompts at a cloud Code session → review the PR → merge.
- Files into the repo: the assistant provides content; Mike pastes it into
  a cloud Code session with a "create/replace this file, commit, push"
  wrapper. He does NOT download from the assistant and re-upload — cloud
  Code writes everything.
- One cloud session per logical unit of work (≈ one PR). Same session for
  revisions; fresh session for new work.

## Prompt patterns that work (for cloud Code tasks)
- Structure: Context → Objective → (Pre-flight checks) → Steps/Deliverables
  → Self-validation → PR workflow → Out-of-scope.
- Start with "read CLAUDE.md + [relevant docs] first."
- Pre-flight checks (does source exist? already done?) — fail fast.
- Self-validation: explicit pass/fail criteria the agent runs before the PR.
- Investigation-first: for anything touching existing structure, have the
  agent investigate and REPORT before changing. This repeatedly caught
  problems blind action would have caused (a "merged" PR that wasn't, a
  hidden second site, an orphaned pipeline). Never trust upstream
  assumptions; verify repo state.
- Explicit out-of-scope sections.
- Don't specify git branch names — cloud Code auto-assigns each session a
  branch. Specify the PR title instead.
- Banned-phrase lists for voice/copy work.

## Merge policy
- Auto-merge (gh pr merge --squash) for mechanical, deterministic, low-risk
  work: data migrations, cleanups, doc updates.
- DRAFT PR + human review for judgment work (voice, design — anything only
  a human can verify visually) and ALL pipeline phases (backend logic that
  can corrupt data is reviewed every time).

## Tone
- Substantive strategic engagement lands well — Mike is a genuine thinking
  partner, not someone who wants tasks done silently.
- Direct, honest, opinionated-but-collaborative.
- Reinforce genuinely good instincts (he's building real product
  intuition); push back honestly when something's off. Don't flatter.

---
*Read with PROJECT_CONTEXT.md (what/why) and CLAUDE.md (operating guide).*
