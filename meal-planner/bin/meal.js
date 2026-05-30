#!/usr/bin/env node
/**
 * `meal` — CLI entry point.
 *
 * Working today:
 *   meal init                 run the full layered interview (active period)
 *   meal ask <layer>          (re)answer one layer, e.g. `meal ask activity`
 *   meal who                  show the active individual + period
 *   meal who new --id X --name "Y"   create an individual and make it active
 *   meal period new --label "Cut"    start a fresh period (archives current)
 *   meal targets [--example]  compute & print targets for the active period
 *   meal help
 *
 * Planned (see VISION.md §11): ingest, plan, swap, shopping, feedback, status.
 */
import { computeTargets } from "../src/engine/targets.js";
import {
  activePeriod, readJSON, getActiveIndividualId,
  createIndividual, startNewPeriod,
} from "../src/store/index.js";
import { runInit, runAsk } from "../src/questionnaire/run.js";

const [, , cmd, sub, ...rest] = process.argv;
const args = [sub, ...rest].filter(Boolean);
const flag = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };

const HELP = `meal — personal meal & shopping intelligence

  meal init                       run the full layered interview
  meal ask <layer>                re-answer one layer (body, activity, goals, …)
  meal who                        show the active individual + period
  meal who new --id X --name "Y"  create an individual, make it active
  meal period new --label "Cut"   start a fresh period (archives the current one)
  meal targets [--example]        compute calorie & macro targets
  meal help

Planned: ingest, plan, swap, shopping, feedback, status. See VISION.md.`;

async function showTargets(useExample) {
  const id = useExample ? "example" : await getActiveIndividualId();
  const { files, periodId, individualId } = await activePeriod(id);
  const profile = await readJSON(files.profile);
  if (!profile) {
    console.error(`No profile.json for '${individualId}' / period '${periodId}'. Run \`meal init\`,\n` +
      "or try `meal targets --example` to see it on the committed example.");
    process.exit(1);
  }
  console.log(JSON.stringify(computeTargets(profile), null, 2));
}

switch (cmd) {
  case "init":
    await runInit();
    break;
  case "ask":
    if (!sub) { console.error("Usage: meal ask <layer>"); process.exit(1); }
    await runAsk(sub);
    break;
  case "who":
    if (sub === "new") {
      const { id, periodId } = await createIndividual({ id: flag("id"), name: flag("name"), periodLabel: flag("label") || "first period" });
      console.log(`Created individual '${id}' (active), period '${periodId}'.`);
    } else {
      const id = await getActiveIndividualId();
      const { individual, periodId } = await activePeriod(id);
      console.log(`Active individual: ${individual.name} (${id})\nActive period:     ${periodId}`);
    }
    break;
  case "period":
    if (sub === "new") {
      const id = await getActiveIndividualId();
      const { periodId } = await startNewPeriod(id, { label: flag("label") || "new period", whyNew: flag("why") || "" });
      console.log(`Started period '${periodId}' for '${id}'. Run \`meal init\` to fill it in.`);
    } else {
      console.error("Usage: meal period new --label \"...\"");
      process.exit(1);
    }
    break;
  case "targets":
    await showTargets(args.includes("--example"));
    break;
  case "help":
  case "--help":
  case "-h":
  case undefined:
    console.log(HELP);
    break;
  default:
    console.error(`Unknown command: ${cmd}\n\n${HELP}`);
    process.exit(1);
}
