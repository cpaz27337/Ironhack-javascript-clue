import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyBodyShape } from '../js/bodyShape.js';

function kp(name, x, y, score = 0.9) {
  return { name, x, y, score };
}

test('classifyBodyShape reports unavailable when key joints are missing', () => {
  const result = classifyBodyShape([kp('nose', 100, 50)]);
  assert.equal(result.available, false);
});

test('classifyBodyShape labels a broad-shoulder frame as shoulder-dominant', () => {
  const keypoints = [
    kp('left_shoulder', 60, 100),
    kp('right_shoulder', 140, 100), // shoulder width 80
    kp('left_hip', 85, 200),
    kp('right_hip', 115, 200), // hip width 30 -> ratio ~2.67
    kp('left_ankle', 85, 350),
    kp('right_ankle', 115, 350),
  ];
  const result = classifyBodyShape(keypoints);
  assert.equal(result.available, true);
  assert.equal(result.label, 'shoulder-dominant (V-taper) build');
  assert.equal(result.trainingBias, 'lower_emphasis');
});

test('classifyBodyShape labels a narrow-shoulder frame as hip-dominant', () => {
  const keypoints = [
    kp('left_shoulder', 90, 100),
    kp('right_shoulder', 110, 100), // shoulder width 20
    kp('left_hip', 60, 200),
    kp('right_hip', 140, 200), // hip width 80 -> ratio 0.25
  ];
  const result = classifyBodyShape(keypoints);
  assert.equal(result.trainingBias, 'upper_emphasis');
});

test('classifyBodyShape ignores low-confidence keypoints', () => {
  const keypoints = [
    kp('left_shoulder', 60, 100),
    kp('right_shoulder', 140, 100),
    kp('left_hip', 85, 200, 0.1), // below confidence threshold
    kp('right_hip', 115, 200, 0.1),
  ];
  const result = classifyBodyShape(keypoints);
  assert.equal(result.available, false);
});

test('classifyBodyShape labels near-equal ratio as balanced', () => {
  const keypoints = [
    kp('left_shoulder', 60, 100),
    kp('right_shoulder', 140, 100), // width 80
    kp('left_hip', 62, 200),
    kp('right_hip', 142, 200), // width 80 -> ratio 1.0
  ];
  const result = classifyBodyShape(keypoints);
  assert.equal(result.trainingBias, 'balanced');
});
