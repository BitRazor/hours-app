/**
 * Interview runner — powers `meal init` and `meal ask <layer>`.
 *
 * Walks the layer definitions (layers.js), prompts on the terminal, validates by
 * question type, applies defaults, honours `when` predicates, and writes the answers
 * into the active individual's active period (profile.json). Re-running pre-fills from
 * existing answers so you can just hit Enter to keep them.
 *
 * Also exports normaliseProfile() — converts imperial input to the metric the engine
 * expects — and saveProfile() so answers can be persisted programmatically.
 */
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { LAYERS, getLayer } from "./layers.js";
import { resolve } from "node:path";
import { paths, readJSON, writeJSON, activePeriod, getActiveIndividualId, createIndividual } from "../store/index.js";
import { computeTargets } from "../engine/targets.js";

const LB_TO_KG = 0.453592;
const IN_TO_CM = 2.54;

const individualPath = (id) => resolve(paths.individuals, id, "individual.json");

/** Ensure there is an active individual + period; create one (asking a name) if not. */
async function ensureIndividual(rl) {
  const id = await getActiveIndividualId();
  if (await readJSON(individualPath(id))) return id;
  const name = (await rl.question("Looks like a fresh setup. What's your name? ")).trim() || "Me";
  const created = await createIndividual({ id: name, name });
  console.log(`Created individual '${created.id}', period '${created.periodId}'.\n`);
  return created.id;
}

/** Ask via readline; if the input stream has closed (EOF/Ctrl-D), fall back to "". */
async function prompt(rl, text) {
  try { return (await rl.question(text)).trim(); }
  catch (e) { if (e?.code === "ERR_USE_AFTER_CLOSE") return ""; throw e; }
}

/** Prompt one question; returns the parsed value (or undefined to skip). */
async function ask(rl, q, current) {
  const def = current !== undefined ? current : q.default;
  const defHint = def !== undefined ? ` [${Array.isArray(def) ? def.join(", ") : def}]` : q.optional ? " [skip]" : "";
  const unit = q.unit ? ` (${q.unit})` : "";

  if (q.type === "choice" || q.type === "multi") {
    console.log(`\n${q.prompt || q.id}${unit}`);
    q.options.forEach((o, i) => console.log(`  ${i + 1}. ${o}`));
    const raw = await prompt(rl, `> ${q.type === "multi" ? "numbers comma-separated" : "number or text"}${defHint}: `);
    if (!raw) return def;
    if (q.type === "multi") {
      return raw.split(",").map(s => pickOption(s.trim(), q.options)).filter(Boolean);
    }
    return pickOption(raw, q.options);
  }

  const raw = await prompt(rl, `\n${q.prompt || q.id}${unit}${defHint}: `);
  if (!raw) return def;
  switch (q.type) {
    case "number": { const n = Number(raw); return Number.isFinite(n) ? n : def; }
    case "bool": return /^(y|yes|true|1)$/i.test(raw);
    case "tags": return raw.split(",").map(s => s.trim()).filter(Boolean);
    default: return raw; // text
  }
}

/** Resolve "2" or a typed option string to the canonical option. */
function pickOption(token, options) {
  const idx = Number(token);
  if (Number.isInteger(idx) && idx >= 1 && idx <= options.length) return options[idx - 1];
  const hit = options.find(o => o.toLowerCase().startsWith(token.toLowerCase()));
  return hit || token;
}

/** Run a set of layers, mutating+returning the answers object. */
async function runLayers(rl, layers, answers) {
  for (const layer of layers) {
    console.log(`\n=== ${layer.title} ===${layer.intro ? `\n${layer.intro}` : ""}`);
    for (const q of layer.questions) {
      if (q.when && !q.when(answers)) continue;
      const val = await ask(rl, q, answers[layer.key]?.[q.id]);
      if (val === undefined || (Array.isArray(val) && val.length === 0)) continue;
      (answers[layer.key] ||= {})[q.id] = val;
    }
  }
  return answers;
}

/** Convert imperial body inputs to the metric the engine reads; keep the rest as-is. */
export function normaliseProfile(answers) {
  const b = answers.body;
  if (b && /imperial/i.test(b.units || "")) {
    if (typeof b.weight === "number") b.weight = round1(b.weight * LB_TO_KG);
    if (typeof b.height === "number") b.height = round1(b.height * IN_TO_CM);
    if (typeof b.waist === "number") b.waist = round1(b.waist * IN_TO_CM);
    b._enteredAs = "imperial"; // engine now sees metric numbers
  }
  return answers;
}

const round1 = n => Math.round(n * 10) / 10;

/** Persist answers + recomputed targets to the active period. */
export async function saveProfile(answers) {
  normaliseProfile(answers);
  const { files, periodId } = await activePeriod(await getActiveIndividualId());
  await writeJSON(files.profile, answers);
  const targets = computeTargets(answers);
  await writeJSON(files.targets, targets);
  return { periodId, files, targets };
}

/** `meal init` — full interview. */
export async function runInit() {
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    await ensureIndividual(rl);
    const { files } = await activePeriod(await getActiveIndividualId());
    const answers = (await readJSON(files.profile)) || {};
    await runLayers(rl, LAYERS, answers);
    const { targets, periodId } = await saveProfile(answers);
    console.log(`\nSaved profile + targets to period '${periodId}'.`);
    console.log(`Daily target: ${targets.daily.kcal} kcal · ${targets.daily.protein_g}P / ${targets.daily.fat_g}F / ${targets.daily.carb_g}C`);
  } finally {
    rl.close();
  }
}

/** `meal ask <layer>` — re-run a single layer. */
export async function runAsk(layerKey) {
  const layer = getLayer(layerKey);
  if (!layer) { console.error(`Unknown layer '${layerKey}'. Options: ${LAYERS.map(l => l.key).join(", ")}`); process.exit(1); }
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    await ensureIndividual(rl);
    const { files } = await activePeriod(await getActiveIndividualId());
    const answers = (await readJSON(files.profile)) || {};
    await runLayers(rl, [layer], answers);
    const { targets, periodId } = await saveProfile(answers);
    console.log(`\nUpdated '${layer.title}' in period '${periodId}'. Recomputed: ${targets.daily.kcal} kcal.`);
  } finally {
    rl.close();
  }
}
