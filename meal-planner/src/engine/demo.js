/**
 * Quick demo / smoke test for the macro engine.
 * Run: `npm run demo:targets` (or `node src/engine/demo.js`)
 *
 * Uses an example profile so you can see real numbers before building the rest.
 */
import { computeTargets } from "./targets.js";

const exampleProfile = {
  body: { units: "metric (kg/cm)", sex: "male", age: 32, height: 180, weight: 82, bodyFatPct: 18 },
  activity: { baseline: "light (some walking, on feet sometimes)", trainingType: ["weights/strength"], trainingDays: 4, intensity: "hard" },
  goals: { primary: "lose fat", rate: "moderate" },
  macros: { dietStyle: "high-protein", proteinBasis: "g per kg bodyweight", proteinLevel: "high (~2.0 g/kg)", fatFloor: "moderate (~0.8 g/kg)", fiberTarget: "high" },
  meals: { mealsPerDay: 3, snacksPerDay: 1, distribution: "even across meals" },
};

const t = computeTargets(exampleProfile);
console.log("Example profile → computed targets\n");
console.log(JSON.stringify(t, null, 2));
console.log("\nSanity check: protein+fat+carb kcal =",
  t.daily.protein_g * 4 + t.daily.fat_g * 9 + t.daily.carb_g * 4,
  "vs target kcal =", t.daily.kcal);
