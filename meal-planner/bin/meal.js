#!/usr/bin/env node
/**
 * `meal` — CLI entry point.
 *
 * Working today:
 *   meal targets            compute targets for the active individual+period
 *   meal targets --example  compute from the committed example period
 *   meal help               this help
 *
 * Planned (see VISION.md §11): who, period, init, ask, ingest, plan, shopping,
 * feedback, status.
 */
import { computeTargets } from "../src/engine/targets.js";
import { activePeriod, readJSON } from "../src/store/index.js";

const [, , cmd, ...args] = process.argv;

async function loadProfile(useExample) {
  const individualId = useExample ? "example" : "example"; // TODO: a real active-individual pointer
  const { files, periodId } = await activePeriod(individualId);
  const profile = await readJSON(files.profile);
  if (!profile) {
    console.error(`No profile.json in period '${periodId}'. Run \`meal init\` (coming soon),\n` +
      "or try `meal targets --example` to see it work on the committed example.");
    process.exit(1);
  }
  return profile;
}

const HELP = `meal — personal meal & shopping intelligence

  meal targets [--example]   compute calorie & macro targets (active period)
  meal help                  show this help

Planned: who, period, init, ask <layer>, ingest, plan, shopping, feedback, status.
See VISION.md for the full design.`;

switch (cmd) {
  case "targets": {
    const profile = await loadProfile(args.includes("--example"));
    console.log(JSON.stringify(computeTargets(profile), null, 2));
    break;
  }
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
