# Meal & Shopping Intelligence — Vision

> A personal, file-based system that turns *who you are and what you want* into
> **macro targets → meal plans → a consolidated shopping list**, and gets smarter
> every time you give it feedback.
>
> Status: **vision / design**. This document is the contract we refine *before*
> building the heavy machinery. Nothing here is locked until you say so.

---

## 1. What this is (and isn't)

- **Is:** a local toolkit driven through Claude Code. Your data lives as plain,
  human-readable JSON / Markdown files in this folder. You own all of it. No app,
  no server, no account, no cloud.
- **Isn't (yet):** a mobile app or website. If it works well for you here, we can
  later wrap the same engine in a PWA or app — the file-based core is designed so
  that transition is cheap.

**Mental model:** you answer layered questionnaires once (and refine over time).
The system computes your daily energy + macro targets, selects/assembles recipes
that hit those targets *while respecting your time, tastes, allergies and budget*,
then rolls the chosen recipes into an aisle-sorted shopping list. The selection is
**fluid** — it learns from your ratings, what you actually cooked, and your weight
trend, then re-weights future choices.

### Vision vs. app functions (don't conflate them)

- **The vision = the system itself** — the "food brain": a comprehensive knowledge
  base, the ingestion engines that feed it, the personalization intelligence that
  reasons over it, and the file-based architecture that holds it all. *This* is what
  we design and refine.
- **App functions = what it does at runtime** — the layered questionnaire, "plan my
  week", "build my list", "I rate this meal". These are *features* that consume your
  inputs. The questionnaire (§3) is one such function; the *answers* you'd give it
  (weight, units, budget, allergies) are runtime data — **not** vision decisions.

### The five pillars (this is the vision)

1. **Food & recipe knowledge base — "big data".** A comprehensive, ever-growing,
   multi-source **food knowledge graph**: recipes + a deep ingredient layer (macros +
   a curated set of **essential** nutrients — fibre, sodium, saturated fat, sugar,
   omega-3 — plus cost, substitutions, seasonality, allergens). *No full RDA / vitamin
   panel* — just the macros and essentials that matter. Designed to serve *any* diet,
   goal, restriction or cuisine; source-agnostic, deduplicated, with provenance and a
   canonical taxonomy. (§5, §6)
2. **Ingestion & document handling.** Engines that pull knowledge in from anywhere —
   web pages, recipe APIs/datasets, PDFs, photos of recipes or nutrition labels, your
   own written notes — normalise it and merge it into the knowledge base. (§5)
3. **Personalization intelligence — the adaptive brain.** Turns who-you-are into
   targets, composes meals to hit them, and *learns* — adaptive TDEE, taste learning,
   variety, periodisation. (§4, §7, §9)
4. **Generation & outputs.** Meal plans, shopping lists, and (later) cooking guidance,
   produced as files you own. (§7, §8)
5. **File-system data architecture.** Everything as plain, versioned, portable files;
   clean separation of *knowledge* (shareable) vs. *profile* (personal) vs. *generated
   output*; built so it can later become a real app without re-architecting. (§10)

Refining the vision = shaping these five pillars. Everything below is detail in
service of them.

### Target scope: a Full food OS (phased)

The agreed outer boundary is a **personal food OS**. Beyond planning, the target
system reasons about **ingredient substitutions** as a first-class capability (§7b),
optimises **grocery cost**, and tracks the **essential** nutrients that matter — while
ingesting knowledge from *any* channel we can imagine (web, APIs/datasets, PDFs,
photo/label OCR, and whatever comes next). We **phase up** to this; the schemas and
architecture are built for it now so nothing has to be re-architected later.

**Explicitly out of scope** (by decision): no pantry/inventory tracking and no
"use-up-what's-in-the-fridge" loop. Each plan and shopping list is computed **from
zero** — you buy what the plan needs. (A static "staples I always own" skip-list stays
available as a questionnaire convenience, but the system never models a live inventory.)

### Individuals & periods (a core architecture decision)

The system is **multi-individual** and, within each individual, **multi-period**.

- An **individual** is a person the system plans for (you today; possibly others later).
- A **period** is a coherent phase of that person's life — a specific body state, goal,
  and set of preferences. It owns its **own questionnaire answers, targets, learned
  prefs, feedback, meal plans and shopping lists**.
- When something fundamental changes (new goal, big weight change, new constraints),
  you **start a new period**: the questionnaire runs **fresh**, and the previous period
  is **archived as history** (never overwritten). This is why every meal plan is filed
  **per individual, per period** — see the layout in §10.

Consequence for the objective function: a period carries *its own* priorities. Macro
precision and health quality are always-on, but **how much that period cares about cost
vs. time** is captured by the questionnaire and can differ from the next period.

---

## 2. The pipeline (one glance)

```
            ┌──────────────────────────────────────────────────────┐
            │                  LAYERED QUESTIONNAIRE                 │
            │  body · activity · goals · macro style · meal shape    │
            │  time/skill · likes/dislikes · restrictions · budget   │
            └───────────────────────────┬──────────────────────────┘
                                         │ profile.json
                                         ▼
            ┌──────────────────────────────────────────────────────┐
            │                 ENERGY + MACRO ENGINE                  │
            │  BMR → TDEE → goal delta → kcal + protein/fat/carb     │
            │  per-day & per-meal targets, with tolerance bands      │
            └───────────────────────────┬──────────────────────────┘
                                         │ targets.json
        recipes.jsonl ──────────────────┤
        (built by scraper)              ▼
            ┌──────────────────────────────────────────────────────┐
            │                    RECIPE MATCHER                      │
            │  hard filters → score candidates → assemble day/week   │
            │  → portion-scale to close macro gaps → enforce variety │
            └───────────────────────────┬──────────────────────────┘
                                         │ plan.json
                                         ▼
            ┌──────────────────────────────────────────────────────┐
            │                  SHOPPING LIST BUILDER                 │
            │  expand × servings → unit-normalize → merge → minus    │
            │  pantry → group by aisle → Markdown with checkboxes    │
            └───────────────────────────┬──────────────────────────┘
                                         │ shopping.md
                                         ▼
            ┌──────────────────────────────────────────────────────┐
            │            FEEDBACK  →  ADAPTIVE RE-WEIGHTING          │
            │  ratings · cooked? · portions · weight trend           │
            │  → prefs.json (learned weights + adaptive TDEE)        │
            └──────────────────────────────────────────────────────┘
```

---

## 3. The layered questionnaire

Questions are organised into **layers**. Each layer is self-contained, resumable,
and re-runnable (you can re-do just "Activity" without redoing everything). Answers
are stored under their layer key in the **active period's** `profile.json` (see §10) —
starting a new period runs the whole questionnaire **fresh**. Full machine-readable
definitions live in [`src/questionnaire/layers.js`](src/questionnaire/layers.js) — the
list below is the human summary.

| # | Layer | Captures | Feeds |
|---|-------|----------|-------|
| L1 | **Identity & Body** | sex (for BMR), age/DOB, height, weight, optional body-fat %, waist, unit system | BMR |
| L2 | **Activity** | baseline activity level, job type, daily steps, training type/freq/duration/intensity | activity multiplier → TDEE |
| L3 | **Goals** | lose / maintain / gain / recomp, target weight, target rate, timeline, performance goals | kcal delta |
| L4 | **Macro strategy** | diet style, protein basis (g/kg), fat floor, carb handling, fibre target | macro split |
| L5 | **Meal shape** | meals/day, snacks, eating window (IF), per-meal calorie distribution | per-meal targets |
| L6 | **Time & skill** | weekday/weekend prep-time cap, cooking skill, batch-cook willingness, appliances | matcher filters |
| L7 | **Tastes** | liked/disliked ingredients, favourite cuisines, spice tolerance, texture aversions, repeat tolerance | matcher scoring |
| L8 | **Restrictions** | allergies/intolerances (hard), dietary law (vegan/veg/halal/kosher), medical (low-sodium, low-GI, low-FODMAP) | hard filters |
| L9 | **Budget & pantry** | weekly budget + currency, preferred stores, pantry staples already owned, bulk/organic prefs, waste sensitivity | shopping list |
| L10 | **Logistics** | household servings, fridge/freezer space, shop-every-N-days, list unit system | plan size & list |

**Why layers?** It lets the system ask in a natural order (who you are → what you
do → what you want → how you like to eat → what you can't/won't eat → money/logistics),
and it lets you refine one slice without a full re-interview. Each answer also records
*when* it was set, so the adaptive layer knows what's stale.

---

## 4. Energy & macro engine (the math)

All formulas are transparent and live in [`src/engine/`](src/engine/) so you can check
the numbers by hand.

1. **BMR** — Mifflin-St Jeor by default:
   - men: `10·kg + 6.25·cm − 5·age + 5`
   - women: `10·kg + 6.25·cm − 5·age − 161`
   - If body-fat % is known → **Katch-McArdle**: `370 + 21.6·leanMassKg` (often more accurate for lean/muscular people).
2. **TDEE** = BMR × activity multiplier. Baseline multipliers (sedentary 1.2 →
   extra-active 1.9), refined by training volume and steps from L2.
3. **Goal delta** — target rate of weight change → daily kcal delta
   (≈ 7700 kcal per kg of body mass). Clamped to safe floors (never below BMR, and a
   sane % of TDEE) so a "lose fast" answer can't produce a crash diet.
4. **Protein** — `g/kg` of bodyweight (or lean mass), higher on a cut to protect
   muscle; from L4.
5. **Fat** — floor as % of kcal or g/kg (hormonal/essential-fat floor); from L4.
6. **Carbs** — remaining calories after protein + fat.
7. **Per-meal split** — distribute the daily targets across L5's meals/snacks, each
   with a **tolerance band** (e.g. ±10 %) the matcher must land inside.

Output → `data/profile/targets.json`:
```json
{
  "computedAt": "2026-05-30",
  "method": { "bmr": "mifflin", "activity": 1.55 },
  "daily": { "kcal": 2480, "protein_g": 185, "fat_g": 69, "carb_g": 263, "fiber_g": 35 },
  "perMeal": [
    { "slot": "breakfast", "kcal": 620, "protein_g": 46, "tolerancePct": 12 },
    { "slot": "lunch",     "kcal": 740, "protein_g": 55, "tolerancePct": 12 },
    { "slot": "dinner",    "kcal": 740, "protein_g": 55, "tolerancePct": 12 },
    { "slot": "snack",     "kcal": 380, "protein_g": 29, "tolerancePct": 15 }
  ]
}
```

---

## 5. Recipe data, ingestion & the scraper

**Ambition (pillar 1 & 2):** the knowledge base is meant to grow toward *universal* —
**dozens of sources, no hard limits**, eventually covering every diet, goal,
restriction and cuisine. So the ingestion layer is designed source-agnostic from day
one: many adapters feeding one normaliser, with provenance, dedup and a canonical
taxonomy, so adding source #40 costs almost nothing.

**Phasing (so we can move fast now):**
- **Now / test corpus** — seed only *our* diet style (a few hundred relevant recipes)
  so the matcher has something real to work with and we can iterate quickly.
- **Later / full database** — flip on the breadth: many adapters, large volume,
  background re-runs. The schema, dedup, provenance and taxonomy below are built for
  that scale *today* so nothing has to be re-architected — we're "preparing the
  grounds," just not filling them all yet.

**Ingestion channels** (pillar 2 — added incrementally behind one normaliser):
web pages (schema.org `Recipe` JSON-LD), open recipe **APIs/datasets**, **PDFs**,
**photos** of recipes or nutrition labels (OCR), and your own **written notes**. Each
adapter's only job is "raw source → common intermediate shape"; the normaliser does
the rest.

We build the corpus with a **standalone ingestion script** (`npm run ingest`) —
run manually, never inside the runtime — that writes normalised records into
`knowledge/recipes/recipes.jsonl` (one JSON per line, git-friendly, append-only).

**Approach:**
- Primary signal: most recipe pages embed **schema.org `Recipe` JSON-LD**. We parse
  that structured data → normalise → store. This is robust and avoids brittle HTML
  scraping.
- **Macros:** use the source's nutrition block when present; otherwise *estimate* from
  ingredients via the ingredient catalog (see §6) and a nutrition reference
  (e.g. Open Food Facts). Every record records whether macros are `declared` or `estimated`.
- **Hygiene:** respect `robots.txt`, rate-limit, cache raw payloads in
  `knowledge/recipes/sources/`, dedupe by content hash, record `source` + `sourceUrl` +
  license note. Modes: `--url <page>`, `--source <name>`, `--pdf <file>`, `--photo <file>`.

**Recipe schema** (see [`knowledge/recipes/recipe.schema.json`](knowledge/recipes/recipe.schema.json)):
```json
{
  "id": "r_0001",
  "title": "Sheet-Pan Chicken & Broccoli",
  "source": "example.com", "sourceUrl": "https://…", "license": "…",
  "cuisine": "american", "tags": ["high-protein","one-pan","meal-prep"],
  "dietFlags": ["gluten-free"],
  "servings": 4, "prepMin": 10, "cookMin": 25, "totalMin": 35,
  "skill": "easy", "appliances": ["oven"],
  "ingredients": [
    { "name": "chicken breast", "canonicalId": "chicken_breast", "qty": 600, "unit": "g" },
    { "name": "broccoli florets", "canonicalId": "broccoli", "qty": 400, "unit": "g" }
  ],
  "steps": ["…"],
  "nutritionPerServing": { "kcal": 410, "protein_g": 48, "fat_g": 16, "carb_g": 14, "fiber_g": 5, "sodium_mg": 480, "basis": "declared" },
  "costEstimate": { "amount": 3.2, "currency": "EUR" },
  "repeatability": "weekly", "season": ["all"]
}
```

---

## 6. Ingredient catalog / knowledge graph (the glue)

A single source of truth for ingredients in
[`knowledge/ingredients/ingredients.json`](knowledge/ingredients/ingredients.json). Each
ingredient carries:
- **canonicalId** + aliases (so "chicken breast", "chicken breasts", "boneless skinless
  chicken breast" all merge),
- **aisle / category** (produce, meat, dairy, pantry, frozen…) — for shopping-list sorting,
- **unit conversions** (g↔ml density, "1 cup", "1 tbsp", "1 medium onion" → grams),
- **allergen tags** (for L8 hard filters),
- **per-100g nutrition** — macros + essentials only (fibre, sodium, saturated fat,
  sugar, omega-3); used to estimate recipe nutrition when undeclared,
- **cost** + **substitution metadata** (category, culinary role) — powering §7b.

This catalog is what makes unit-merging, allergen filtering, nutrition estimation,
aisle-sorting **and substitution** all possible from one place.

---

## 7. The matcher (core selection algorithm)

**Job:** choose meals for each slot, each day, so that the daily totals land inside the
target tolerance bands, *no* hard constraint is violated, and a weighted preference
score is maximised — without boring you.

1. **Hard filters** (drop candidates that violate): allergens/restrictions (L8),
   missing appliance (L6), over the prep-time cap (L6), contains a "never" disliked
   ingredient (L7), out of diet style (L4).
2. **Score each surviving candidate** for a slot:
   ```
   score = w_macro   · macroFit        // ALWAYS ON: closeness to the slot's macro target
         + w_health  · healthQuality   // ALWAYS ON: essentials (fibre, sodium, sat-fat, omega-3), whole foods
         + w_variety · varietyBonus    // ALWAYS ON: unlike what's recently been eaten
         + w_pref    · preferenceFit   // liked ingredients / cuisines (L7)
         + w_time    · timeFit         // PER-PERIOD weight (questionnaire): faster = better
         + w_cost    · costFit         // PER-PERIOD weight (questionnaire): within budget (L9)
         + w_learn   · learnedScore    // from feedback (prefs.json)
         − penalties(recentlyUsed, repetitionBeyondTolerance)
   ```
   **Objective composition.** `w_macro`, `w_health` and `w_variety` are always-on
   system defaults — the brain always wants you on-target, well-nourished and not bored.
   `w_cost` and `w_time` are **per-period** weights set from the questionnaire (how much
   *this* phase of your life cares about money vs. speed); they reset with a new period.
3. **Assemble the day:** greedy pick per slot, then a small local-search pass that
   swaps/【portion-scales】 recipes to close the remaining macro gap to the daily target.
   Portion scaling = adjusting servings (e.g. 1.25×) to fine-tune calories/protein.
4. **Variety + batch logic:** enforce "no repeat within N days" (L7 repeat tolerance),
   rotate cuisines, and honour L5/L6 batch-cooking (designate cook-days, reuse a
   batch-cooked dish across the plan's days to save time).

**Horizon.** A plan defaults to **one week**; the questionnaire can set a different
horizon (a single day, a few days, two weeks) and the shopping cadence follows it.

### 7b. Substitution & synergy engine (a first-class capability)

Swapping is core, not cosmetic. Given any chosen ingredient or recipe, the engine
proposes **substitutes that preserve what matters** while changing one axis:
- **macro-equivalent swaps** — salmon → mackerel, rice → potato at matched protein/carb/fat;
- **constraint swaps** — replace an allergen / disliked / out-of-season / over-budget
  item with the nearest safe match (dairy → lactose-free, beef → turkey to cut cost/fat);
- **availability swaps** — a missing item → the closest thing you'd realistically use.

It runs in two places: **inside assembly** (to close a macro or budget gap) and **on
demand** ("swap the salmon"). It's powered by the knowledge graph's per-ingredient
nutrition, allergen tags and cost, plus a similarity metric (category + macro profile +
culinary role), so a substitute is *nutritionally and culinarily* sensible — not just
same-aisle.

Output → the active period's `plans/<date>.json` + a readable `plans/<date>.md`
(see §10). The weights `w_*` start from sensible defaults and are **tunable** + later
**learned** (see §9).

---

## 8. Shopping list builder

Computed **from zero** — no inventory is assumed. Given a chosen plan:
1. **Expand** every recipe's ingredients × the servings you'll actually make.
2. **Normalise units** to a canonical unit per ingredient (via the catalog).
3. **Merge** identical `canonicalId`s across all meals into one line.
4. **Skip the always-own staples** (the static L9 list — salt, oil, etc.); everything
   else is on the list, because we don't track a live pantry.
5. **Group by aisle** and sort by typical store layout.
6. **Render Markdown** with checkboxes, quantities, per-line + total estimated cost,
   and a "make this week" recipe list. → the active period's `shopping/<range>.md` (§10).

---

## 9. The fluid / adaptive layer

This is what makes it *yours* instead of a generic calculator.

- **Feedback events** append to the active period's `feedback.jsonl`:
  `rating (1–5)`, `cooked? y/n`, `portion too much/too little`, `make again`,
  `weight log`, `energy/satiety`.
- **Learned preferences** live in the active period's `prefs.json`:
  per-ingredient, per-cuisine, per-recipe weights updated by a simple online rule
  (exponential moving average). Optionally an **ε-greedy bandit** so the matcher keeps
  exploring *new* recipes instead of locking onto your top 5.
- **Adaptive TDEE:** if your logged weight trend isn't moving toward the goal after
  ~2–3 weeks, the engine nudges the calorie delta (real-world TDEE rarely equals the
  textbook estimate). This closes the loop between *plan* and *outcome*.

Every plan generation **reads** prefs; every feedback event **updates** them.

---

## 10. Data architecture & file layout

The decisive split: **knowledge is shared and individual-agnostic; everything personal
is filed per individual → per period.** That keeps the big database reusable across
people and periods, while each life-phase's plans stay isolated and historical.

```
meal-planner/
  VISION.md                ← this document
  README.md
  package.json
  bin/meal.js              ← CLI entry (meal <command>)
  src/
    questionnaire/         layer definitions + interview runner
    engine/                BMR/TDEE/macro math → targets.json
    matcher/               recipe selection / plan assembly
    shopping/              list aggregation, unit math, aisle sort
    ingest/                source adapters → one normaliser (web, api, pdf, ocr, …)
    store/                 file read/write helpers

  knowledge/               ← PILLAR 1: shared "food brain", individual-agnostic
    recipes/
      recipes.jsonl          the recipe DB (append-only)
      recipe.schema.json     schema for a record
      sources/               cached raw ingestion payloads (per adapter)
    ingredients/
      ingredients.json       food knowledge graph: macros + micros, price, subs,
                             seasonality, allergens, units, aisle
    taxonomy/                canonical vocab: cuisines, aisles, diet flags, allergens

  individuals/             ← PILLAR 5: everything personal lives here
    <individualId>/
      individual.json        identity-level constants (name, created, units default)
      periods/
        <periodId>/          one life-phase; questionnaire runs FRESH per period
          period.json        meta: label, startDate, status (active|archived), why-new
          profile.json       THIS period's questionnaire answers
          targets.json       derived energy/macro targets for this period
          prefs.json         learned weights + adaptive state (this period)
          feedback.jsonl     event log (ratings, weight, cooked…) for this period
          plans/             generated meal plans   (.json + .md) — one file each
          shopping/          generated shopping lists (.md)        — one file each
```

- **Knowledge** (`knowledge/`) is the shareable brain — built by ingestion, reused by
  everyone, every period.
- **Individuals/periods** hold all personal data. Starting a new period creates a new
  `<periodId>/` with a fresh `profile.json`; the old one is marked `archived` and kept.
- Personal folders are git-ignored by default (the example individual is the exception,
  so the structure is visible). See [`.gitignore`](.gitignore).

---

## 11. CLI surface (planned)

| Command | Does |
|---------|------|
| `meal who` | list/select the active individual; `meal who new` creates one |
| `meal period new` | start a fresh period (fresh questionnaire); archives the current one |
| `meal period list` | show this individual's periods (active + history) |
| `meal init` | run the full layered interview for the active period (resumable) |
| `meal ask <layer>` | (re)answer one layer, e.g. `meal ask activity` |
| `meal targets` | (re)compute & show daily/per-meal targets for the active period |
| `meal ingest --url … / --source … / --pdf … / --photo …` | feed the knowledge base |
| `meal plan` | generate a meal plan for the period's horizon (default 1 week) |
| `meal swap <item>` | propose substitutions for an ingredient/recipe (§7b) |
| `meal shopping --plan <id>` | build the shopping list for a plan (from zero) |
| `meal feedback …` | log a rating / weight / note → retrains this period's prefs |
| `meal status` | weight trend vs goal, plan adherence (active period) |

The CLI always operates on the **active individual + active period**, so day-to-day you
don't pass IDs — you just `meal plan` and it lands in the right folder.

> In practice you'll often just *ask me* ("plan next week", "I hated the salmon one")
> and I'll run the right command — the CLI is the reproducible engine underneath.

---

## 12. Build order (proposed)

1. **★ Vision (this doc) + skeleton + questionnaire definitions + macro engine** ← here
   (engine works & is verifiable; individuals/periods scaffolding in place)
2. **`meal init`** — interview runner that writes a real period's `profile.json` + `targets.json`
3. **Ingredient knowledge graph** + unit-conversion library
4. **Ingestion normaliser** + first adapter (web JSON-LD) → seed our diet style into `recipes.jsonl`
5. **Matcher** → first generated week plan, with the **substitution engine (§7b)** in the loop
6. **Shopping list** builder (from zero)
7. **Feedback + adaptive** loop (incl. adaptive TDEE)
8. **Periods/individuals CLI** (`meal who`, `meal period new`) + more ingestion adapters (API/PDF/OCR)

Each step produces something usable on its own.

---

## 13. Vision decisions locked (so far)

What we've settled while refining the vision:

- **Outer scope:** a personal **Full food OS**, phased — *no* pantry/inventory or
  food-waste loop; shopping is computed **from zero**.
- **Knowledge base:** a full **food knowledge graph**; nutrition = **macros + essentials
  only** (fibre, sodium, sat-fat, sugar, omega-3), **no full RDA**.
- **Ingestion:** universal-but-phased — *many* pluggable adapters (web/API/PDF/OCR/…)
  behind one normaliser; seed our diet style first.
- **Objective:** macro precision + health quality + variety **always-on**; **cost & time
  are per-period** questionnaire weights.
- **Substitution (§7b):** a **first-class** capability, not a nicety.
- **Architecture:** **multi-individual × multi-period**; new life-phase = fresh
  questionnaire, old period archived as history; files split `knowledge/` vs.
  `individuals/<id>/periods/<id>/`.
- **Plan horizon:** default **one week**, adjustable via the questionnaire.

### Still-open vision threads

- How aggressive should **adaptive TDEE** be (how fast does it trust your weight trend
  over the textbook estimate)?
- Should plans support **diet periodisation** (planned refeeds / diet-breaks / bulk→cut
  phases *within* a period, or is that always a new period)?
- How much should **seasonality & locale** steer choices in v1 vs. later?

Everything that's a *runtime input* (units, diet style, protein basis, currency, budget,
household size, allergies) is **not** a vision decision — it's collected by `meal init`.
