/**
 * Layered questionnaire — the full, reviewable definition of every question.
 *
 * This file IS the questionnaire spec. The interview runner (meal init / meal ask)
 * walks these layers in order and writes answers into data/profile/profile.json
 * under each layer's `key`. Re-running a single layer overwrites only that slice.
 *
 * Question `type`:
 *   number  → numeric input (with `unit`, `min`, `max`)
 *   choice  → pick one of `options`
 *   multi   → pick many of `options`
 *   text    → free text
 *   tags    → free-form list (e.g. liked ingredients)
 *   bool    → yes/no
 *
 * `when` (optional) → only ask if a predicate over prior answers is true.
 * `feeds` is documentation: which downstream calc consumes this answer.
 */

export const LAYERS = [
  // ─────────────────────────────────────────────────────────────────────────
  {
    key: "body",
    title: "Identity & Body",
    intro: "The basics needed to estimate your metabolism.",
    questions: [
      { id: "units", type: "choice", prompt: "Preferred unit system",
        options: ["metric (kg/cm)", "imperial (lb/in)"], default: "metric (kg/cm)",
        feeds: "all input/display" },
      { id: "sex", type: "choice", prompt: "Biological sex (for BMR formula)",
        options: ["male", "female"], feeds: "BMR" },
      { id: "age", type: "number", unit: "years", min: 13, max: 100, feeds: "BMR" },
      { id: "height", type: "number", unit: "cm|in", min: 120, max: 230, feeds: "BMR" },
      { id: "weight", type: "number", unit: "kg|lb", min: 35, max: 250, feeds: "BMR, protein, goal delta" },
      { id: "bodyFatPct", type: "number", unit: "%", min: 3, max: 60, optional: true,
        feeds: "Katch-McArdle BMR, lean-mass protein" },
      { id: "waist", type: "number", unit: "cm|in", optional: true, feeds: "progress tracking" },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    key: "activity",
    title: "Activity",
    intro: "How much you move drives total daily energy.",
    questions: [
      { id: "baseline", type: "choice", prompt: "Day-to-day activity (excluding training)",
        options: [
          "sedentary (desk job, little walking)",
          "light (some walking, on feet sometimes)",
          "moderate (on feet a lot / active job)",
          "heavy (manual labour)",
        ], feeds: "activity multiplier" },
      { id: "steps", type: "number", unit: "steps/day", min: 0, max: 40000, optional: true,
        feeds: "activity multiplier refinement" },
      { id: "trainingType", type: "multi", prompt: "Training you do",
        options: ["weights/strength", "cardio/endurance", "HIIT", "sports", "yoga/mobility", "none"],
        feeds: "activity multiplier, protein" },
      { id: "trainingDays", type: "number", unit: "days/week", min: 0, max: 14, feeds: "activity multiplier" },
      { id: "trainingMinutes", type: "number", unit: "min/session", min: 0, max: 300, optional: true,
        when: a => a.activity?.trainingDays > 0, feeds: "activity multiplier" },
      { id: "intensity", type: "choice", prompt: "Typical training intensity",
        options: ["easy", "moderate", "hard"], when: a => a.activity?.trainingDays > 0,
        feeds: "activity multiplier" },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    key: "goals",
    title: "Goals",
    intro: "What you want your body to do.",
    questions: [
      { id: "primary", type: "choice", prompt: "Primary goal",
        options: ["lose fat", "maintain", "gain muscle", "body recomposition"],
        feeds: "kcal delta" },
      { id: "targetWeight", type: "number", unit: "kg|lb", optional: true,
        when: a => a.goals?.primary === "lose fat" || a.goals?.primary === "gain muscle",
        feeds: "timeline" },
      { id: "rate", type: "choice", prompt: "How aggressive?",
        options: ["slow & sustainable", "moderate", "aggressive"],
        when: a => a.goals?.primary !== "maintain",
        feeds: "kcal delta (clamped to safe floors)" },
      { id: "performance", type: "multi", prompt: "Any performance goals?", optional: true,
        options: ["get stronger", "endurance", "more energy", "better sleep", "none"],
        feeds: "macro tuning" },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    key: "macros",
    title: "Macro strategy",
    intro: "How to split your calories into protein / fat / carbs.",
    questions: [
      { id: "dietStyle", type: "choice", prompt: "Eating style",
        options: ["balanced", "high-protein", "Mediterranean", "low-carb", "keto",
                  "plant-forward", "just hit my macros"], default: "high-protein",
        feeds: "macro split, matcher diet filter" },
      { id: "proteinBasis", type: "choice", prompt: "Protein target basis",
        options: ["g per kg bodyweight", "g per kg lean mass (needs body-fat %)"],
        default: "g per kg bodyweight", feeds: "protein grams" },
      { id: "proteinLevel", type: "choice", prompt: "Protein level",
        options: ["standard (~1.6 g/kg)", "high (~2.0 g/kg)", "very high (~2.4 g/kg)"],
        default: "high (~2.0 g/kg)", feeds: "protein grams" },
      { id: "fatFloor", type: "choice", prompt: "Minimum fat",
        options: ["lower (~0.6 g/kg)", "moderate (~0.8 g/kg)", "higher (~1.0 g/kg)"],
        default: "moderate (~0.8 g/kg)", feeds: "fat grams" },
      { id: "fiberTarget", type: "choice", prompt: "Fibre emphasis",
        options: ["standard", "high"], default: "high", feeds: "fibre target, matcher" },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    key: "meals",
    title: "Meal shape",
    intro: "How your day of eating is structured.",
    questions: [
      { id: "mealsPerDay", type: "number", unit: "meals", min: 1, max: 6, default: 3,
        feeds: "per-meal split" },
      { id: "snacksPerDay", type: "number", unit: "snacks", min: 0, max: 4, default: 1,
        feeds: "per-meal split" },
      { id: "fasting", type: "choice", prompt: "Eating window",
        options: ["no restriction", "16:8 intermittent fasting", "OMAD", "custom"],
        default: "no restriction", feeds: "meal timing" },
      { id: "distribution", type: "choice", prompt: "Calorie distribution",
        options: ["even across meals", "bigger dinner", "bigger breakfast", "biggest post-workout"],
        default: "even across meals", feeds: "per-meal split" },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    key: "time",
    title: "Time & skill",
    intro: "What you can realistically cook.",
    questions: [
      { id: "weekdayPrepCap", type: "number", unit: "min/meal", min: 5, max: 120, default: 30,
        feeds: "matcher time filter" },
      { id: "weekendPrepCap", type: "number", unit: "min/meal", min: 5, max: 180, default: 60,
        feeds: "matcher time filter" },
      { id: "skill", type: "choice", prompt: "Cooking skill",
        options: ["beginner", "comfortable", "advanced"], default: "comfortable",
        feeds: "matcher skill filter" },
      { id: "batchCook", type: "bool", prompt: "Happy to batch-cook / meal-prep?",
        default: true, feeds: "plan batch logic" },
      { id: "appliances", type: "multi", prompt: "Appliances you have",
        options: ["oven", "stovetop", "microwave", "air fryer", "blender",
                  "slow cooker", "instant pot", "grill"],
        default: ["oven", "stovetop", "microwave"], feeds: "matcher appliance filter" },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    key: "tastes",
    title: "Tastes",
    intro: "What you love and what you'd rather not see.",
    questions: [
      { id: "likedIngredients", type: "tags", prompt: "Ingredients you love", optional: true,
        feeds: "matcher preference score" },
      { id: "dislikedIngredients", type: "tags", prompt: "Ingredients you dislike (soft avoid)", optional: true,
        feeds: "matcher preference penalty" },
      { id: "neverIngredients", type: "tags", prompt: "Ingredients to NEVER include", optional: true,
        feeds: "matcher hard filter" },
      { id: "cuisines", type: "multi", prompt: "Favourite cuisines", optional: true,
        options: ["italian", "mexican", "indian", "thai", "japanese", "chinese",
                  "mediterranean", "middle-eastern", "american", "french", "korean"],
        feeds: "matcher preference score" },
      { id: "spice", type: "choice", prompt: "Spice tolerance",
        options: ["mild", "medium", "hot"], default: "medium", feeds: "matcher" },
      { id: "repeatTolerance", type: "choice", prompt: "How often can a meal repeat?",
        options: ["never repeat in a week", "twice a week ok", "I don't mind repeats"],
        default: "twice a week ok", feeds: "matcher variety constraint" },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    key: "restrictions",
    title: "Restrictions",
    intro: "Hard rules the plan must always respect.",
    questions: [
      { id: "allergies", type: "tags", prompt: "Allergies / intolerances", optional: true,
        feeds: "matcher HARD filter" },
      { id: "dietLaw", type: "multi", prompt: "Dietary rules", optional: true,
        options: ["vegetarian", "vegan", "pescatarian", "halal", "kosher", "none"],
        feeds: "matcher HARD filter" },
      { id: "medical", type: "multi", prompt: "Medical considerations", optional: true,
        options: ["low-sodium", "low-GI / diabetic-friendly", "low-FODMAP",
                  "low-cholesterol", "none"],
        feeds: "matcher filter + macro tuning" },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    key: "budget",
    title: "Budget & pantry",
    intro: "Money and what you already have.",
    questions: [
      { id: "currency", type: "choice", prompt: "Currency",
        options: ["EUR", "USD", "GBP", "other"], default: "EUR", feeds: "cost display" },
      { id: "weeklyBudget", type: "number", unit: "currency/week", optional: true,
        feeds: "matcher cost filter" },
      { id: "pantryStaples", type: "tags", prompt: "Staples you always have (skip on lists)",
        optional: true, default: ["salt", "pepper", "olive oil", "water"],
        feeds: "shopping list subtraction" },
      { id: "stores", type: "tags", prompt: "Preferred stores", optional: true, feeds: "shopping list" },
      { id: "preferences", type: "multi", prompt: "Shopping preferences", optional: true,
        options: ["buy in bulk", "prefer organic", "minimise food waste", "minimise cost"],
        feeds: "matcher + shopping list" },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    key: "logistics",
    title: "Logistics",
    intro: "Servings and shopping cadence.",
    questions: [
      { id: "servings", type: "number", unit: "people", min: 1, max: 10, default: 1,
        feeds: "plan portions, shopping quantities" },
      { id: "planHorizon", type: "choice", prompt: "How long should each plan cover?",
        options: ["1 day", "3 days", "1 week", "2 weeks"], default: "1 week",
        feeds: "plan length" },
      { id: "priorityBalance", type: "choice",
        prompt: "This period, what matters more when picking meals? (macros & health are always prioritised)",
        options: ["save money", "save time", "balance both", "neither — food I love"],
        default: "balance both", feeds: "matcher per-period w_cost / w_time" },
      { id: "shopEveryDays", type: "number", unit: "days", min: 1, max: 14, default: 7,
        feeds: "shopping cadence" },
      { id: "freezerSpace", type: "choice", prompt: "Freezer space for batch-cooking",
        options: ["little", "some", "lots"], default: "some", feeds: "batch logic" },
      { id: "listUnits", type: "choice", prompt: "Shopping-list units",
        options: ["metric", "imperial"], default: "metric", feeds: "shopping list display" },
    ],
  },
];

/** Flat list of {layerKey, ...question} for the runner. */
export function allQuestions() {
  return LAYERS.flatMap(l => l.questions.map(q => ({ layerKey: l.key, ...q })));
}

/** Look up a single layer by key (for `meal ask <layer>`). */
export function getLayer(key) {
  return LAYERS.find(l => l.key === key);
}
