/**
 * Substitution & synergy engine — a first-class capability. (PLANNED — VISION.md §7b)
 *
 * Contract (to implement):
 *   substitutes(target, { catalog, constraint, n }) -> [{ canonicalId, why, deltas }]
 *
 * `target`     an ingredient (or recipe item) to replace.
 * `constraint` what's forcing the swap, e.g.
 *                { type: "allergen", value: "milk" }
 *                { type: "macro",    keep: ["protein_g","kcal"] }
 *                { type: "budget",   ceiling: 1.2 }
 *                { type: "season" | "dislike" | "availability" }
 *
 * Ranks candidates by a similarity metric over: subRole (culinary role) + macro
 * profile + allergen-safety + cost, so a swap is nutritionally AND culinarily sensible
 * — salmon -> mackerel, rice -> potato, dairy -> lactose-free — not just same-aisle.
 *
 * Runs in two places: inside plan assembly (close a macro/budget gap) and on demand
 * ("swap the salmon").
 */

export function substitutes() {
  throw new Error("substitution engine not implemented yet — see VISION.md §7b");
}
