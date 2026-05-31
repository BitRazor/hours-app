/**
 * Shopping-list builder. (PLANNED — see VISION.md §8)
 *
 * Contract (to implement):
 *   buildShoppingList({ plan, recipes, catalog, profile }) -> { byAisle, markdown, totalCost }
 *
 * Pipeline:
 *   1. expand    every recipe's ingredients x servings actually cooked
 *   2. normalize units -> canonical unit per ingredient (via ingredient catalog)
 *   3. merge     identical canonicalId across all meals
 *   4. subtract  pantry staples the user already owns (profile.budget.pantryStaples)
 *   5. group     by aisle, sort by typical store layout
 *   6. render    Markdown with checkboxes, quantities, per-line + total est. cost
 */

export function buildShoppingList() {
  throw new Error("shopping-list builder not implemented yet — see VISION.md §8");
}
