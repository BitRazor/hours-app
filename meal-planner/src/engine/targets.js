/**
 * Energy & macro engine.
 *
 * Pure functions, no I/O — given a profile (the questionnaire answers) it returns
 * the daily and per-meal calorie + macronutrient targets. Every formula is
 * transparent so the numbers can be checked by hand. See VISION.md §4.
 *
 * Units: internally everything is metric (kg, cm). Convert imperial on the way in.
 */

const KCAL_PER_KG_BODY = 7700;        // approx energy in 1 kg of body mass
const KCAL_PER_G = { protein: 4, fat: 9, carb: 4 };

/** Mifflin-St Jeor basal metabolic rate (kcal/day). */
export function bmrMifflin({ sex, weightKg, heightCm, age }) {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return Math.round(base + (sex === "male" ? 5 : -161));
}

/** Katch-McArdle BMR (kcal/day) — uses lean mass, better when body-fat % is known. */
export function bmrKatch({ weightKg, bodyFatPct }) {
  const lean = weightKg * (1 - bodyFatPct / 100);
  return Math.round(370 + 21.6 * lean);
}

/** Baseline activity multiplier, refined by training volume. */
export function activityMultiplier(activity = {}) {
  const baseMap = {
    "sedentary (desk job, little walking)": 1.2,
    "light (some walking, on feet sometimes)": 1.375,
    "moderate (on feet a lot / active job)": 1.55,
    "heavy (manual labour)": 1.725,
  };
  let m = baseMap[activity.baseline] ?? 1.375;
  // Each training day nudges the multiplier up, scaled by intensity.
  const intensityBump = { easy: 0.01, moderate: 0.02, hard: 0.03 }[activity.intensity] ?? 0.02;
  m += (activity.trainingDays ?? 0) * intensityBump;
  return Math.min(Number(m.toFixed(3)), 1.95); // cap at "extra active"
}

/** Daily calorie delta from goal + rate, clamped to safe floors. */
export function goalDelta({ goals = {}, tdee, bmr }) {
  if (goals.primary === "maintain" || !goals.primary) return 0;
  const sign = goals.primary === "lose fat" ? -1 : 1;
  // Map rate → kg/week, then → daily kcal.
  const kgPerWeek = { "slow & sustainable": 0.25, "moderate": 0.5, "aggressive": 0.75 }[goals.rate] ?? 0.4;
  let delta = sign * (kgPerWeek * KCAL_PER_KG_BODY) / 7;
  // Recomp: keep near maintenance, tiny deficit.
  if (goals.primary === "body recomposition") delta = -0.075 * tdee;
  // Safety floors: never eat below BMR, and cap deficit/surplus at ±25% of TDEE.
  const maxCut = -0.25 * tdee;
  const maxBulk = 0.2 * tdee;
  delta = Math.max(Math.min(delta, maxBulk), maxCut);
  const floor = bmr - tdee; // delta that would put intake at BMR
  if (delta < floor) delta = floor;
  return Math.round(delta);
}

/** Protein grams from basis + level. */
export function proteinGrams({ macros = {}, weightKg, bodyFatPct }) {
  const perKg = { "standard (~1.6 g/kg)": 1.6, "high (~2.0 g/kg)": 2.0, "very high (~2.4 g/kg)": 2.4 }[macros.proteinLevel] ?? 2.0;
  const useLean = macros.proteinBasis?.includes("lean") && bodyFatPct != null;
  const mass = useLean ? weightKg * (1 - bodyFatPct / 100) : weightKg;
  return Math.round(perKg * mass);
}

/** Fat grams from floor choice (g/kg bodyweight). */
export function fatGrams({ macros = {}, weightKg }) {
  const perKg = { "lower (~0.6 g/kg)": 0.6, "moderate (~0.8 g/kg)": 0.8, "higher (~1.0 g/kg)": 1.0 }[macros.fatFloor] ?? 0.8;
  return Math.round(perKg * weightKg);
}

/** Full daily target computation. */
export function computeTargets(profile = {}) {
  const { body = {}, activity = {}, goals = {}, macros = {}, meals = {} } = profile;
  const weightKg = body.weight; // assumed already normalised to kg upstream
  const bmr = body.bodyFatPct != null
    ? bmrKatch({ weightKg, bodyFatPct: body.bodyFatPct })
    : bmrMifflin({ sex: body.sex, weightKg, heightCm: body.height, age: body.age });

  const mult = activityMultiplier(activity);
  const tdee = Math.round(bmr * mult);
  const delta = goalDelta({ goals, tdee, bmr });
  const kcal = tdee + delta;

  const protein_g = proteinGrams({ macros, weightKg, bodyFatPct: body.bodyFatPct });
  const fat_g = fatGrams({ macros, weightKg });
  const proteinKcal = protein_g * KCAL_PER_G.protein;
  const fatKcal = fat_g * KCAL_PER_G.fat;
  let carb_g = Math.max(0, Math.round((kcal - proteinKcal - fatKcal) / KCAL_PER_G.carb));

  // Low-carb / keto override: cap carbs, push remainder to fat.
  if (macros.dietStyle === "keto") carb_g = Math.min(carb_g, 30);
  else if (macros.dietStyle === "low-carb") carb_g = Math.min(carb_g, Math.round(weightKg)); // ~1 g/kg

  const fiber_g = macros.fiberTarget === "standard"
    ? Math.round((kcal / 1000) * 14)            // ~14 g per 1000 kcal
    : Math.max(30, Math.round((kcal / 1000) * 16));

  return {
    computedAt: new Date().toISOString().slice(0, 10),
    method: { bmr: body.bodyFatPct != null ? "katch-mcardle" : "mifflin", bmrValue: bmr, activity: mult, tdee, goalDelta: delta },
    daily: { kcal, protein_g, fat_g, carb_g, fiber_g },
    perMeal: splitPerMeal({ kcal, protein_g, fat_g, carb_g }, meals),
  };
}

/** Distribute daily targets across meals + snacks per the meal-shape layer. */
export function splitPerMeal(daily, meals = {}) {
  const nMeals = meals.mealsPerDay ?? 3;
  const nSnacks = meals.snacksPerDay ?? 0;
  // Snacks get ~60% the share of a full meal.
  const snackShare = 0.6;
  const totalShares = nMeals + nSnacks * snackShare;
  const slots = [];
  const mealNames = ["breakfast", "lunch", "dinner", "meal 4", "meal 5", "meal 6"];

  // Weighting for uneven distributions.
  const weights = Array(nMeals).fill(1);
  if (meals.distribution === "bigger dinner") weights[Math.min(2, nMeals - 1)] = 1.4;
  if (meals.distribution === "bigger breakfast") weights[0] = 1.4;
  const wSum = weights.reduce((a, b) => a + b, 0);

  for (let i = 0; i < nMeals; i++) {
    const frac = (weights[i] / wSum) * (nMeals / totalShares);
    slots.push(mkSlot(mealNames[i], frac, daily, 12));
  }
  for (let i = 0; i < nSnacks; i++) {
    const frac = (snackShare / totalShares);
    slots.push(mkSlot(`snack ${i + 1}`, frac, daily, 15));
  }
  return slots;
}

function mkSlot(slot, frac, daily, tolerancePct) {
  return {
    slot,
    kcal: Math.round(daily.kcal * frac),
    protein_g: Math.round(daily.protein_g * frac),
    fat_g: Math.round(daily.fat_g * frac),
    carb_g: Math.round(daily.carb_g * frac),
    tolerancePct,
  };
}
