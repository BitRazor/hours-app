/**
 * File store helpers — the only place that touches disk, so the rest of the code
 * stays pure and testable. (Lightweight today; grows as commands land.)
 */
import { readFile, writeFile, mkdir, appendFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

export const paths = {
  root,
  profile: resolve(root, "data/profile/profile.json"),
  targets: resolve(root, "data/profile/targets.json"),
  feedback: resolve(root, "data/profile/feedback.jsonl"),
  prefs: resolve(root, "data/profile/prefs.json"),
  recipes: resolve(root, "data/recipes/recipes.jsonl"),
  catalog: resolve(root, "data/units/ingredients.json"),
};

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
