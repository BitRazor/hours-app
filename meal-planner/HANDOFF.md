# PROJECT HANDOFF — read me first

> **Purpose of this file.** Drop a brand-new Claude Code session in front of this and it
> will understand (a) what this project *is* and where it's going, (b) exactly what is
> built vs. not, (c) the live state of the work, and (d) the single next action to take.
> It is a **cold-start brief**, not the design doc. The authoritative design is
> [`VISION.md`](VISION.md) — read this file, then read that.
>
> Last updated: **2026-05-31** · Branch: `claude/meals-shopping-list-system-tDOuB`

---

## 0. TL;DR for the next session

- We are building a **personal, file-based meal & shopping intelligence** system, driven
  through Claude Code. Pipeline: **questionnaire → macro targets → weekly meal plan →
  shopping list**, adaptive over time. No app/server/account — data is plain JSON/MD.
- **Built and working:** the layered questionnaire + interview runner, the
  individuals×periods file plumbing, and the energy/macro engine (BMR→TDEE→goal→macros,
  per-meal split). CLI: `meal init | ask | who | period | targets`.
- **Designed but NOT built (the real work ahead):** recipe **ingestion**, the week
  **builder/matcher** (this is the core, VISION §7), the **shopping-list** builder, the
  **adaptive** feedback loop, and the **ingredient knowledge graph** data.
- **This session's accomplishment:** ran the whole 10-layer questionnaire *on the real
  user* (individual `arnoldas`, period `2026-05_fat-loss`), wrote his `profile.json`, and
  computed his `targets.json` (goal: moderate fat loss, high-protein, 4 meals/day).
- **Immediate next step (what the user wants next):** build his **7-day meal plan** from
  those targets. That requires the matcher + at least a seed recipe corpus, neither of
  which exists yet — see §6 "Next actions".
- **Persistence caveat:** the user's data lives under `individuals/` which is **git-ignored
  by design**, and this is an **ephemeral cloud container**. The actual numbers are NOT
  embedded in this committed file (privacy) — they live in the git-ignored `profile.json`
  and in a copy delivered to the user directly. See §5.

---

## 1. The vision (one paragraph)

A "food brain" that turns *who you are and what you want* into a **correct week of meals
and one consolidated shopping list**, and gets smarter from your feedback. Five pillars:
(1) a multi-source **food/recipe knowledge base** — macros + *essential* nutrients only
(fibre, sodium, sat-fat, sugar, omega-3; **no full RDA/vitamin panel**); (2) **ingestion**
from anywhere (web JSON-LD, recipe APIs/datasets, PDFs, photo/label OCR, notes) behind one
normaliser; (3) **personalization intelligence** (targets, meal composition, learning,
adaptive TDEE); (4) **generation** (plans, lists, later cooking guidance) as files you
own; (5) a **file-system architecture** that can later become a real app without
re-architecting. Full detail: [`VISION.md`](VISION.md) §1.

### Locked decisions (don't relitigate without the user)
- **Scope:** a personal **Full food OS**, *phased*. **No pantry/inventory tracking and no
  "use up the fridge" loop** — every plan & list is computed **from zero**. (A static
  "staples I always own" skip-list is allowed as a convenience only.)
- **Nutrition depth:** macros + the five essentials above. No micronutrient/RDA modelling.
- **Objective function:** macro precision + health quality + variety are **always-on**;
  **cost vs. time are per-period weights** set by the questionnaire.
- **Substitution** (rice→potato, salmon→mackerel, allergen/over-budget swaps) is a
  **first-class** gap-closer in the builder, not an afterthought. (VISION §7)
- **Architecture:** **multi-individual × multi-period**. A "period" is a life-phase with
  its own goal/body/prefs; a fundamental change → **new period, fresh questionnaire, old
  period archived (never overwritten)**.
- **Default plan horizon:** **1 week** (adjustable in the questionnaire).
- **v1 = the core only:** questionnaire → daily targets → a 7-day plan meeting the §7
  acceptance criteria → one shopping list. Adaptive TDEE, learned prefs, periodisation,
  the broad ingestion breadth are **deferred** (architecture leaves room; don't build yet).

---

## 2. The pipeline & blueprint

```
QUESTIONNAIRE (10 layers)  →  profile.json
        ↓
ENERGY+MACRO ENGINE  (BMR→TDEE→goal delta→protein/fat/carb, per-meal split)  →  targets.json
        ↓                                   ↑ recipes.jsonl (from ingestion)
WEEK BUILDER / MATCHER  (hard-filter → score → assemble day → portion-scale/swap to hit macros → enforce variety)  →  plans/<range>.{json,md}
        ↓
SHOPPING-LIST BUILDER  (expand×servings → unit-normalise → merge → skip staples → group by aisle → Markdown)  →  shopping/<range>.md
        ↓
FEEDBACK → ADAPTIVE RE-WEIGHTING  (ratings/cooked/weight trend → prefs.json + adaptive TDEE)
```

**A weekly plan is "correct" when, for every day:** kcal within ±5% of target; protein
within tolerance and never materially short (priority macro); fat ≥ essential floor; carbs
fill the remainder; **zero** hard-constraint violations (allergens, diet law, "never"
foods, missing appliance, over that day's prep-time cap); and across 7 days no recipe
repeats beyond the user's tolerance. If a day can't be satisfied, the builder **explains
why** rather than shipping a bad day. (VISION §7 is the centre of gravity — read it before
touching the matcher.)

---

## 3. What is actually built (verified in code, 2026-05-31)

| Area | File(s) | Status |
|---|---|---|
| Vision/design doc | `VISION.md` | ✅ complete, authoritative |
| Questionnaire spec (10 layers, every Q) | `src/questionnaire/layers.js` | ✅ |
| Interview runner (`init`, `ask <layer>`) | `src/questionnaire/run.js` | ✅ |
| Individuals×periods file store | `src/store/index.js` | ✅ |
| Energy & macro engine | `src/engine/targets.js` | ✅ pure fns, hand-checkable |
| CLI entry | `bin/meal.js` | ✅ `init/ask/who/period/targets` only |
| Recipe schema | `knowledge/recipes/recipe.schema.json` | ✅ schema exists |
| Ingredient knowledge graph | `knowledge/ingredients/ingredients.json` | ⚠️ exists but essentially empty/seed |
| Recipe corpus | `knowledge/recipes/recipes.jsonl` | ❌ does **not** exist yet |
| Ingestion engine | `src/ingest/index.js` | ❌ stub (prints "not implemented") |
| Week builder / matcher | `src/matcher/index.js` + `substitute.js` | ❌ stub (`throw "not implemented"`) |
| Shopping-list builder | `src/shopping/index.js` | ❌ stub (`throw "not implemented"`) |
| Feedback / adaptive loop | — | ❌ not started |

**Engine specifics worth knowing** (`src/engine/targets.js`, all metric internally):
- BMR: Katch-McArdle if body-fat % known, else Mifflin-St Jeor.
- Activity multiplier: baseline map (sedentary 1.2 → heavy 1.725) + per-training-day bump
  by intensity, capped 1.95.
- Goal delta: rate→kg/week→kcal (7700 kcal/kg ÷ 7), clamped (never below BMR; ≤±25% TDEE).
- Protein g/kg (body or lean mass); fat g/kg floor; **carbs = remainder**; keto/low-carb
  cap carbs and the leftover stays as-is; fibre ~14–16 g per 1000 kcal (min 30 on "high").
- Per-meal split supports even / bigger-dinner / bigger-breakfast; snacks ~0.6× a meal.

**CLI quickstart for the new session:**
```bash
cd meal-planner
node bin/meal.js who                 # who's active
node bin/meal.js targets             # active period's targets (JSON)
node bin/meal.js targets --example   # safe demo on the committed example individual
node bin/meal.js help
```

---

## 4. Live state — what THIS session did

- Created/!populated individual **`arnoldas`**, active period **`2026-05_fat-loss`**.
- Ran all 10 questionnaire layers *interactively on the real user* and wrote:
  - `individuals/arnoldas/periods/2026-05_fat-loss/profile.json` (all 10 layers, validated)
  - `…/targets.json` (recomputed; macro kcal reconciles with target within rounding)
- Sent both files to the user via the app for safekeeping (container is ephemeral).
- **No git commit of personal data** was made (it's git-ignored; user had not chosen to
  commit health data to the repo). If the user later says "persist it", force-adding
  past `.gitignore` is the mechanism — confirm first, it's personal health data.

---

## 5. The user's profile (NOT embedded here — privacy)

The user's personal numbers (body stats, computed targets) are **intentionally not stored
in this committed file**, because `HANDOFF.md` lives in the tracked repo and the data is
personal health information.

Where the profile actually lives / how to restore it:
- **Primary copy:** `individuals/arnoldas/periods/2026-05_fat-loss/profile.json` — present
  in the working tree but **git-ignored**, so it survives only as long as this container.
- **Durable copy:** delivered to the user directly (downloaded file) at the end of the
  intake session. If the working copy is gone, ask the user to paste `profile.json` back.
- **To restore:** write the user's `profile.json` to the path above, then run
  `node bin/meal.js targets` (or call `computeTargets`) and save the result to
  `…/targets.json`. Confirm `node bin/meal.js who` shows `arnoldas` / `2026-05_fat-loss`.

Shape-only summary (no personal values): an active fat-loss period — high-protein diet
style, 4 meals/day, beginner cook with a tight weekday prep cap, Mediterranean-leaning
tastes (chicken/eggs/fish), no allergies, cooking for one, weekly shop, metric units.
The full per-layer schema is in `src/questionnaire/layers.js`.

---

## 6. Next actions (in priority order)

The user's next ask is **"build my 7-day meal plan."** That is blocked on two unbuilt
pieces. Recommended path:

1. **Seed a small recipe corpus** so the matcher has real data. Either implement a minimal
   slice of the ingestion engine (`src/ingest/index.js`, web schema.org JSON-LD adapter →
   `knowledge/recipes/recipes.jsonl`) **or** hand-author ~20–40 recipes that fit this user
   (high-protein, Mediterranean-leaning, ≤20 min weekday, chicken/eggs/fish, beginner,
   oven/stovetop/air-fryer/blender) directly into `recipes.jsonl` per
   `knowledge/recipes/recipe.schema.json`. Hand-authoring is the fastest way to a working
   demo plan; flag to the user which you're doing.
2. **Flesh out the ingredient knowledge graph** (`knowledge/ingredients/ingredients.json`)
   enough to cover those recipes: canonicalId+aliases, aisle, per-100g macros+essentials,
   unit conversions, allergens, cost. Needed for nutrition estimation, unit-merge,
   aisle-sort, and substitution.
3. **Implement the matcher** (`src/matcher/index.js`) to VISION §7: hard-filter → score →
   assemble day → portion-scale/swap to hit macros → enforce variety across 7 days.
   Output `plans/<range>.{json,md}` with per-day macro totals vs. target. Add `meal plan`
   to `bin/meal.js`.
4. **Implement the shopping-list builder** (`src/shopping/index.js`) to VISION §8 — from
   zero. Add `meal shopping --plan <id>`.
5. Only then: feedback/adaptive loop (VISION §9), broader ingestion adapters.

**Always:** operate on the **active individual + active period**; commit work to branch
`claude/meals-shopping-list-system-tDOuB`; keep personal data out of git unless the user
explicitly opts in.

---

## 7. Map of the repo

```
meal-planner/
  HANDOFF.md       ← this file (cold-start brief)
  VISION.md        ← authoritative design (READ §7 before building the matcher)
  README.md        ← short status + try-it
  bin/meal.js      ← CLI: init/ask/who/period/targets (plan/shopping/ingest = planned)
  src/
    questionnaire/  layers.js (spec) · run.js (interview runner)          ✅
    engine/         targets.js (BMR/TDEE/macros) · demo.js                 ✅
    store/          index.js (individuals×periods file I/O)                ✅
    matcher/        index.js · substitute.js                               ❌ stubs
    shopping/       index.js                                               ❌ stub
    ingest/         index.js                                               ❌ stub
  knowledge/        ← shared, individual-agnostic "food brain"
    recipes/        recipe.schema.json ✅ · recipes.jsonl ❌ · sources/
    ingredients/    ingredients.json ⚠️ seed/empty
    taxonomy/       (cuisines, aisles, diet flags, allergens) — placeholder
  individuals/      ← personal data, git-ignored (except `example/`)
    arnoldas/periods/2026-05_fat-loss/{profile,targets}.json   ← the live user
    example/...                                                ← committed sample
```

When in doubt about intent, **ask the user** — most "what should it do" answers are
already locked in VISION.md §13; most "what are *my* numbers" answers are runtime data in
the profile above.
