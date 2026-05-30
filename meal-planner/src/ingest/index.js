/**
 * Ingestion engine — pillar 2. (PLANNED — see VISION.md §5)
 *
 * One normaliser, many source adapters. Each adapter only turns a raw source into a
 * common intermediate shape; the normaliser maps to recipe.schema.json, resolves
 * ingredient names -> canonicalId via the knowledge graph, fills/estimates nutrition,
 * dedups by content hash, records provenance, and appends to
 * knowledge/recipes/recipes.jsonl.
 *
 * Run manually:
 *   npm run ingest -- --url <page>        web page (schema.org Recipe JSON-LD)
 *   npm run ingest -- --source <name>     a registered API / dataset adapter
 *   npm run ingest -- --pdf <file>        parse a recipe PDF
 *   npm run ingest -- --photo <file>      OCR a recipe / nutrition-label photo
 *
 * Adapters are pluggable — adding source #40 should cost almost nothing. Hygiene:
 * respect robots.txt, rate-limit, cache raw payloads in knowledge/recipes/sources/.
 *
 * Phasing: seed our diet style first for fast tests; flip on breadth later (VISION §5).
 */

console.log("ingestion engine not implemented yet — see VISION.md §5 for the design.");
