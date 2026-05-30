#!/usr/bin/env node
/**
 * `meal` — CLI entry point.
 *
 * Working today:
 *   meal targets            compute & print targets from data/profile/profile.json
 *   meal targets --example  compute from the example profile (no profile.json needed)
 *   meal help               this help
 *
 * Planned (see VISION.md §11): init, ask, scrape, plan, shopping, feedback, status.
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { computeTargets } from "../src/engine/targets.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const [, , cmd, ...args] = process.argv;

async function loadProfile(useExample) {
  const path = resolve(root, "data/profile", useExample ? "profile.example.json" : "profile.json");
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (e) {
    if (e.code === "ENOENT" && !useExample) {
      console.error("No data/profile/profile.json yet. Run `meal init` (coming soon),\n" +
        "or try `meal targets --example` to see it work on the sample profile.");
      process.exit(1);
    }
    throw e;
  }
}

const HELP = `meal — personal meal & shopping intelligence

  meal targets [--example]   compute calorie & macro targets
  meal help                  show this help

Planned: init, ask <layer>, scrape, plan, shopping, feedback, status.
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
