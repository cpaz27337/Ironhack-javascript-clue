// Rule-based nutrition + workout plan generation.
// Pure functions only — no DOM access — so this module can run in the
// browser (imported by app.js) and under plain Node (for tests).

export const ACTIVITY_MULTIPLIERS = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export const GOAL_CALORIE_ADJUSTMENT = {
  lose_fat: -0.2,
  build_muscle: 0.12,
  maintain: 0,
  recomp: -0.05,
};

export const GOAL_PROTEIN_PER_KG = {
  lose_fat: 2.2,
  build_muscle: 1.8,
  maintain: 1.6,
  recomp: 2.0,
};

const FAT_PERCENT_OF_CALORIES = 0.28;

export function calculateBMR({ sex, weightKg, heightCm, age }) {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  if (sex === 'male') return base + 5;
  if (sex === 'female') return base - 161;
  return base - 78; // midpoint offset for "other"/unspecified
}

export function calculateTDEE(bmr, activityLevel) {
  const multiplier = ACTIVITY_MULTIPLIERS[activityLevel] ?? ACTIVITY_MULTIPLIERS.sedentary;
  return bmr * multiplier;
}

export function calculateCalorieTarget(tdee, bmr, goal) {
  const adjustment = GOAL_CALORIE_ADJUSTMENT[goal] ?? 0;
  const target = tdee * (1 + adjustment);
  // Safety floor: never recommend eating below estimated BMR.
  return Math.max(target, bmr);
}

export function calculateMacros({ weightKg, calories, goal }) {
  const proteinPerKg = GOAL_PROTEIN_PER_KG[goal] ?? GOAL_PROTEIN_PER_KG.maintain;
  const proteinG = Math.round(weightKg * proteinPerKg);
  const proteinCal = proteinG * 4;

  const fatCal = calories * FAT_PERCENT_OF_CALORIES;
  const fatG = Math.round(fatCal / 9);

  const carbsCal = Math.max(calories - proteinCal - fatCal, 0);
  const carbsG = Math.round(carbsCal / 4);

  return { proteinG, fatG, carbsG, calories: Math.round(calories) };
}

export function buildNutritionPlan(profile) {
  const bmr = calculateBMR(profile);
  const tdee = calculateTDEE(bmr, profile.activityLevel);
  const calories = calculateCalorieTarget(tdee, bmr, profile.goal);
  const macros = calculateMacros({ weightKg: profile.weightKg, calories, goal: profile.goal });
  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    ...macros,
  };
}

// --- Workout templates -------------------------------------------------

const REP_RANGE_BY_GOAL = {
  lose_fat: { sets: 3, reps: '12-15' },
  recomp: { sets: 3, reps: '10-12' },
  build_muscle: { sets: 4, reps: '8-12' },
  maintain: { sets: 3, reps: '10-12' },
};

const EXERCISES = {
  full_body_a: ['Squat', 'Bench Press', 'Bent-Over Row', 'Plank'],
  full_body_b: ['Deadlift', 'Overhead Press', 'Lat Pulldown', 'Side Plank'],
  full_body_c: ['Goblet Squat', 'Incline Dumbbell Press', 'Seated Cable Row', 'Hanging Knee Raise'],
  upper_a: ['Bench Press', 'Bent-Over Row', 'Overhead Press', 'Lat Pulldown', 'Bicep Curl', 'Tricep Pushdown'],
  upper_b: ['Incline Dumbbell Press', 'Seated Cable Row', 'Lateral Raise', 'Face Pull', 'Hammer Curl', 'Skull Crusher'],
  lower_a: ['Squat', 'Romanian Deadlift', 'Walking Lunge', 'Calf Raise', 'Hanging Knee Raise'],
  lower_b: ['Leg Press', 'Deadlift', 'Bulgarian Split Squat', 'Seated Calf Raise', 'Cable Crunch'],
  push: ['Bench Press', 'Overhead Press', 'Incline Dumbbell Press', 'Lateral Raise', 'Tricep Pushdown'],
  pull: ['Deadlift', 'Bent-Over Row', 'Lat Pulldown', 'Face Pull', 'Bicep Curl'],
  legs: ['Squat', 'Romanian Deadlift', 'Leg Press', 'Calf Raise', 'Hanging Knee Raise'],
};

const SPLIT_BY_DAYS = {
  3: ['full_body_a', 'full_body_b', 'full_body_c'],
  4: ['upper_a', 'lower_a', 'upper_b', 'lower_b'],
  5: ['push', 'pull', 'legs', 'upper_a', 'lower_a'],
  6: ['push', 'pull', 'legs', 'push', 'pull', 'legs'],
};

const DAY_LABELS = {
  full_body_a: 'Full Body A',
  full_body_b: 'Full Body B',
  full_body_c: 'Full Body C',
  upper_a: 'Upper Body A',
  upper_b: 'Upper Body B',
  lower_a: 'Lower Body A',
  lower_b: 'Lower Body B',
  push: 'Push',
  pull: 'Pull',
  legs: 'Legs',
};

const LOWER_DAY_TYPES = new Set(['lower_a', 'lower_b', 'legs', 'full_body_a', 'full_body_b', 'full_body_c']);
const UPPER_DAY_TYPES = new Set(['upper_a', 'upper_b', 'push', 'pull', 'full_body_a', 'full_body_b', 'full_body_c']);

function clampDays(daysPerWeek) {
  const supported = Object.keys(SPLIT_BY_DAYS).map(Number);
  return supported.reduce((closest, d) =>
    Math.abs(d - daysPerWeek) < Math.abs(closest - daysPerWeek) ? d : closest
  );
}

export function generateWorkoutPlan({ daysPerWeek, goal, trainingBias = 'balanced' }) {
  const days = clampDays(daysPerWeek);
  const dayTypes = SPLIT_BY_DAYS[days];
  const repRange = REP_RANGE_BY_GOAL[goal] ?? REP_RANGE_BY_GOAL.maintain;

  return dayTypes.map((dayType, index) => {
    const exercises = [...EXERCISES[dayType]].map((name) => ({
      name,
      sets: repRange.sets,
      reps: repRange.reps,
    }));

    // Aesthetic-balance nudge from the estimated body shape: add one extra
    // exercise on the side that's under-emphasized. This is a coarse,
    // optional bias — not a correction of any deficiency.
    if (trainingBias === 'lower_emphasis' && LOWER_DAY_TYPES.has(dayType)) {
      exercises.push({ name: 'Extra Leg Accessory (e.g. Leg Curl)', sets: 2, reps: '12-15' });
    }
    if (trainingBias === 'upper_emphasis' && UPPER_DAY_TYPES.has(dayType)) {
      exercises.push({ name: 'Extra Upper Accessory (e.g. Rear Delt Fly)', sets: 2, reps: '12-15' });
    }

    return {
      day: index + 1,
      focus: DAY_LABELS[dayType],
      exercises,
    };
  });
}

export function generatePlan(profile, bodyShape) {
  return {
    nutrition: buildNutritionPlan(profile),
    workout: generateWorkoutPlan({
      daysPerWeek: profile.daysPerWeek,
      goal: profile.goal,
      trainingBias: bodyShape?.trainingBias ?? 'balanced',
    }),
  };
}
