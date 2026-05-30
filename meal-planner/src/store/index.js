/**
 * File store helpers — the only place that touches disk, so the rest of the code
 * stays pure and testable.
 *
 * Two roots (see VISION.md §10):
 *   knowledge/   shared "food brain" (individual-agnostic)
 *   individuals/<id>/periods/<id>/   everything personal, per life-phase
 */
import { readFile, writeFile, mkdir, appendFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

export const paths = {
  root,
  // Shared knowledge base
  recipes: resolve(root, "knowledge/recipes/recipes.jsonl"),
  recipeSchema: resolve(root, "knowledge/recipes/recipe.schema.json"),
  ingredients: resolve(root, "knowledge/ingredients/ingredients.json"),
  taxonomy: resolve(root, "knowledge/taxonomy"),
  // Individuals
  individuals: resolve(root, "individuals"),
};

/** Resolve a period directory: individuals/<individualId>/periods/<periodId>/ */
export function periodDir(individualId, periodId) {
  return resolve(paths.individuals, individualId, "periods", periodId);
}

/** The personal files that live inside one period. */
export function periodFiles(individualId, periodId) {
  const dir = periodDir(individualId, periodId);
  return {
    dir,
    meta: resolve(dir, "period.json"),
    profile: resolve(dir, "profile.json"),
    targets: resolve(dir, "targets.json"),
    prefs: resolve(dir, "prefs.json"),
    feedback: resolve(dir, "feedback.jsonl"),
    plans: resolve(dir, "plans"),
    shopping: resolve(dir, "shopping"),
  };
}

/**
 * Resolve the active individual + period.
 * Reads individuals/<id>/individual.json#activePeriod. Defaults to the committed
 * "example" individual so things work out of the box.
 */
export async function activePeriod(individualId = "example") {
  const individual = await readJSON(resolve(paths.individuals, individualId, "individual.json"));
  if (!individual) throw new Error(`No individual '${individualId}' (individuals/${individualId}/individual.json)`);
  const periodId = individual.activePeriod;
  return { individualId, periodId, individual, files: periodFiles(individualId, periodId) };
}

export async function readJSON(path, fallback = null) {
  try { return JSON.parse(await readFile(path, "utf8")); }
  catch (e) { if (e.code === "ENOENT") return fallback; throw e; }
}

export async function writeJSON(path, data) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(data, null, 2) + "\n");
}

/** Read a .jsonl file into an array of parsed objects. */
export async function readJSONL(path) {
  const text = await readFile(path, "utf8").catch(e => { if (e.code === "ENOENT") return ""; throw e; });
  return text.split("\n").filter(Boolean).map(line => JSON.parse(line));
}

/** Append one record to a .jsonl file (e.g. a feedback event). */
export async function appendJSONL(path, record) {
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, JSON.stringify(record) + "\n");
}
