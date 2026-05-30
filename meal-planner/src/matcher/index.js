/**
 * Recipe matcher — selection & plan assembly. (PLANNED — see VISION.md §7)
 *
 * Contract (to implement):
 *   buildPlan({ targets, recipes, profile, prefs, days }) -> Plan
 *
 * Pipeline:
 *   1. hardFilter(recipes, profile)         drop allergen/restriction/appliance/time/never violations
 *   2. scoreCandidate(recipe, slotTarget)   weighted: macroFit + preference + variety + time + cost + learned
 *   3. assembleDay(slots)                    greedy pick + local-search swap/portion-scale to hit daily macros
 *   4. enforceVariety(plan, profile)         no repeat within N days; cuisine rotation; batch/leftover logic
 *
 * Output: { days: [{ date, meals: [{ slot, recipeId, servings, macros }] }], totals, fit }
 */

export function buildPlan() {
  throw new Error("matcher not implemented yet — see VISION.md §7 for the design");
}
