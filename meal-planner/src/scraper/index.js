/**
 * Recipe scraper / importer. (PLANNED — see VISION.md §5)
 *
 * Run manually:  npm run scrape -- --url <page>
 *                npm run scrape -- --seed <file-of-urls>
 *
 * Strategy:
 *   - Fetch page, extract schema.org `Recipe` JSON-LD (robust vs. brittle HTML scraping).
 *   - Normalize -> recipe.schema.json shape; map ingredient names -> canonicalId via catalog.
 *   - Nutrition: use declared values; else ESTIMATE from ingredient catalog macrosPer100g.
 *   - Hygiene: respect robots.txt, rate-limit, cache raw payload in data/recipes/sources/,
 *     dedupe by content hash, record source/sourceUrl/license.
 *   - Append normalized records to data/recipes/recipes.jsonl.
 */

console.log("scraper not implemented yet — see VISION.md §5 for the design.");
