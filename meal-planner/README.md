# Meal & Shopping Intelligence

A personal, **file-based** system (driven through Claude Code) that turns your body,
goals and tastes into **macro targets → meal plans → a consolidated shopping list**,
and adapts as you give feedback. No app, no server, no account — your data is plain
JSON/Markdown in this folder.

📖 **Read [`VISION.md`](VISION.md) first** — it's the detailed design we're refining.

## Status

Early scaffolding. Working today:

- ✅ Full layered questionnaire definition — [`src/questionnaire/layers.js`](src/questionnaire/layers.js)
- ✅ Energy & macro engine (BMR → TDEE → goal → macros, per-meal split) — [`src/engine/targets.js`](src/engine/targets.js)
- 🚧 Recipe scraper, matcher, shopping-list builder, adaptive loop — designed in VISION.md, not built yet

## Try the engine

```bash
cd meal-planner
node src/engine/demo.js     # prints computed targets for an example profile
```

## Layout

```
bin/meal.js          CLI entry (planned commands)
src/
  questionnaire/       layer definitions + interview runner
  engine/              calorie/macro math  ← working
  matcher/             recipe selection (planned)
  shopping/            list builder (planned)
  ingest/              knowledge ingestion: web/api/pdf/ocr (planned)
  store/               file helpers
knowledge/           ← shared "food brain" (individual-agnostic)
  recipes/             recipe DB + schema + cached sources
  ingredients/         food knowledge graph (macros+micros, price, subs, allergens)
  taxonomy/            canonical vocab (cuisines, aisles, diet flags)
individuals/         ← everything personal, per individual / per period
  <id>/individual.json
  <id>/periods/<period>/   profile · targets · prefs · feedback · plans/ · shopping/
```

See [`VISION.md` §10](VISION.md) for why personal data is split per individual / per period.

## Privacy

Everything stays local. Real individuals under `individuals/` are git-ignored; only the
committed `example` individual is tracked so the structure is visible — see
[`.gitignore`](.gitignore).
