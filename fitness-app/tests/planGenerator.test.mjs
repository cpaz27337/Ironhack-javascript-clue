import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateBMR,
  calculateTDEE,
  calculateCalorieTarget,
  calculateMacros,
  generateWorkoutPlan,
  generatePlan,
} from '../js/planGenerator.js';

test('calculateBMR matches Mifflin-St Jeor for male', () => {
  const bmr = calculateBMR({ sex: 'male', weightKg: 80, heightCm: 180, age: 30 });
  assert.equal(bmr, 10 * 80 + 6.25 * 180 - 5 * 30 + 5);
});

test('calculateBMR matches Mifflin-St Jeor for female', () => {
  const bmr = calculateBMR({ sex: 'female', weightKg: 60, heightCm: 165, age: 25 });
  assert.equal(bmr, 10 * 60 + 6.25 * 165 - 5 * 25 - 161);
});

test('calculateTDEE applies the activity multiplier', () => {
  assert.equal(calculateTDEE(1500, 'sedentary'), 1500 * 1.2);
  assert.equal(calculateTDEE(1500, 'very_active'), 1500 * 1.9);
});

test('calculateCalorieTarget applies goal adjustment and never drops below BMR', () => {
  const bmr = 1500;
  const tdee = 2000;
  assert.equal(calculateCalorieTarget(tdee, bmr, 'lose_fat'), 2000 * 0.8);
  assert.equal(calculateCalorieTarget(tdee, bmr, 'build_muscle'), 2000 * 1.12);
  assert.equal(calculateCalorieTarget(tdee, bmr, 'maintain'), 2000);
  // Extreme deficit case should be floored at BMR.
  assert.equal(calculateCalorieTarget(1000, bmr, 'lose_fat'), bmr);
});

test('calculateMacros protein/fat/carbs add up to roughly total calories', () => {
  const macros = calculateMacros({ weightKg: 80, calories: 2400, goal: 'build_muscle' });
  const proteinCal = macros.proteinG * 4;
  const fatCal = macros.fatG * 9;
  const carbCal = macros.carbsG * 4;
  assert.ok(Math.abs(proteinCal + fatCal + carbCal - 2400) < 20);
  assert.equal(macros.proteinG, Math.round(80 * 1.8));
});

test('generateWorkoutPlan picks the closest supported split for odd day counts', () => {
  const plan = generateWorkoutPlan({ daysPerWeek: 7, goal: 'maintain' });
  assert.equal(plan.length, 6); // clamps to the 6-day split, the closest supported option
});

test('generateWorkoutPlan produces one entry per day with exercises', () => {
  const plan = generateWorkoutPlan({ daysPerWeek: 4, goal: 'lose_fat' });
  assert.equal(plan.length, 4);
  plan.forEach((day) => {
    assert.ok(day.exercises.length > 0);
    day.exercises.forEach((ex) => {
      assert.equal(ex.reps, '12-15');
    });
  });
});

test('generateWorkoutPlan adds a lower-body accessory when trainingBias is lower_emphasis', () => {
  const plan = generateWorkoutPlan({ daysPerWeek: 4, goal: 'maintain', trainingBias: 'lower_emphasis' });
  const lowerDay = plan.find((d) => d.focus === 'Lower Body A');
  assert.ok(lowerDay.exercises.some((ex) => ex.name.includes('Extra Leg Accessory')));
});

test('generatePlan returns both nutrition and workout sections', () => {
  const plan = generatePlan(
    {
      sex: 'male',
      weightKg: 85,
      heightCm: 178,
      age: 28,
      activityLevel: 'moderate',
      goal: 'recomp',
      daysPerWeek: 5,
    },
    { trainingBias: 'balanced' }
  );
  assert.ok(plan.nutrition.calories > 0);
  assert.ok(plan.nutrition.proteinG > 0);
  assert.equal(plan.workout.length, 5);
});
