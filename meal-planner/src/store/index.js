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
  active: resolve(root, "individuals/.active"), // plain-text file holding the active individual id
};

/** Turn a name into a filesystem-safe id. */
export function slug(s) {
  return String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "me";
}

/** Read the active individual id (falls back to the committed example). */
export async function getActiveIndividualId() {
  try { return (await readFile(paths.active, "utf8")).trim() || "example"; }
  catch (e) { if (e.code === "ENOENT") return "example"; throw e; }
}

export async function setActiveIndividualId(id) {
  await mkdir(paths.individuals, { recursive: true });
  await writeFile(paths.active, id + "\n");
}

const individualFile = (id) => resolve(paths.individuals, id, "individual.json");

/** Create an individual with a first active period. Returns {id, periodId}. */
export async function createIndividual({ id, name, unitsDefault = "metric (kg/cm)", periodLabel = "first period" }) {
  id = slug(id || name);
  const periodId = newPeriodId(periodLabel);
  await writeJSON(individualFile(id), {
    id, name: name || id, unitsDefault,
    createdAt: today(), activePeriod: periodId,
  });
  await writePeriodMeta(id, periodId, { label: periodLabel, whyNew: "first period", status: "active" });
  await setActiveIndividualId(id);
  return { id, periodId };
}

/** Start a fresh period: archive the current one, create + activate a new one. */
export async function startNewPeriod(individualId, { label = "new period", whyNew = "" } = {}) {
  const ind = await readJSON(individualFile(individualId));
  if (!ind) throw new Error(`No individual '${individualId}'`);
  if (ind.activePeriod) {
    const prev = await readJSON(periodFiles(individualId, ind.activePeriod).meta, {});
    await writeJSON(periodFiles(individualId, ind.activePeriod).meta, { ...prev, status: "archived" });
  }
  const periodId = newPeriodId(label);
  await writePeriodMeta(individualId, periodId, { label, whyNew, status: "active" });
  ind.activePeriod = periodId;
  await writeJSON(individualFile(individualId), ind);
  return { individualId, periodId };
}

function newPeriodId(label) {
  return `${today().slice(0, 7)}_${slug(label)}`;
}

async function writePeriodMeta(individualId, periodId, meta) {
  await writeJSON(periodFiles(individualId, periodId).meta, {
    id: periodId, startDate: today(), ...meta,
  });
}

function today() { return new Date().toISOString().slice(0, 10); }

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
