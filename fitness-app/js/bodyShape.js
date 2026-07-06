// Turns pose-detection keypoints (MoveNet format: {x, y, score, name}) into
// a coarse body-proportion estimate. This is NOT a body-fat or health
// measurement — it only looks at joint-to-joint ratios (shoulder/hip width,
// leg/torso length) to suggest a mild training-volume balance nudge.

const MIN_KEYPOINT_SCORE = 0.3;

function findPoint(keypoints, name) {
  const point = keypoints.find((k) => k.name === name);
  if (!point || (point.score ?? 0) < MIN_KEYPOINT_SCORE) return null;
  return point;
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function midpoint(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function classifyBodyShape(keypoints) {
  const leftShoulder = findPoint(keypoints, 'left_shoulder');
  const rightShoulder = findPoint(keypoints, 'right_shoulder');
  const leftHip = findPoint(keypoints, 'left_hip');
  const rightHip = findPoint(keypoints, 'right_hip');
  const leftAnkle = findPoint(keypoints, 'left_ankle');
  const rightAnkle = findPoint(keypoints, 'right_ankle');

  if (!leftShoulder || !rightShoulder || !leftHip || !rightHip) {
    return { available: false, reason: 'Could not confidently detect shoulders/hips in the photo.' };
  }

  const shoulderWidth = distance(leftShoulder, rightShoulder);
  const hipWidth = distance(leftHip, rightHip);
  const shoulderToHipRatio = shoulderWidth / hipWidth;

  const shoulderMid = midpoint(leftShoulder, rightShoulder);
  const hipMid = midpoint(leftHip, rightHip);
  const torsoLength = distance(shoulderMid, hipMid);

  let legToTorsoRatio = null;
  if (leftAnkle && rightAnkle) {
    const ankleMid = midpoint(leftAnkle, rightAnkle);
    const legLength = distance(hipMid, ankleMid);
    legToTorsoRatio = legLength / torsoLength;
  }

  let label = 'balanced build';
  let trainingBias = 'balanced';
  if (shoulderToHipRatio > 1.15) {
    label = 'shoulder-dominant (V-taper) build';
    trainingBias = 'lower_emphasis';
  } else if (shoulderToHipRatio < 0.95) {
    label = 'hip-dominant build';
    trainingBias = 'upper_emphasis';
  }

  return {
    available: true,
    shoulderToHipRatio: Number(shoulderToHipRatio.toFixed(2)),
    legToTorsoRatio: legToTorsoRatio !== null ? Number(legToTorsoRatio.toFixed(2)) : null,
    label,
    trainingBias,
  };
}
