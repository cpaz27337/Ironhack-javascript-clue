import { generatePlan } from './planGenerator.js';
import { classifyBodyShape } from './bodyShape.js';
import { startCamera, stopCamera, captureFrame, readFileAsDataURL, loadImage } from './camera.js';
import { detectKeypoints } from './poseAnalysis.js';
import { saveScan, listScans, deleteScan, clearAllData } from './storage.js';

const state = {
  profile: null,
  photoDataUrl: null,
  bodyShape: null,
  plan: null,
  cameraStream: null,
};

const steps = ['profile', 'photos', 'review', 'plan', 'history'];

function showStep(name) {
  steps.forEach((s) => {
    document.getElementById(`step-${s}`).classList.toggle('hidden', s !== name);
  });
}

// --- Step 1: Profile form + unit conversion ------------------------------

const unitsSelect = document.getElementById('units');
const heightUnitLabel = document.getElementById('height-unit');
const weightUnitLabel = document.getElementById('weight-unit');

unitsSelect.addEventListener('change', () => {
  const imperial = unitsSelect.value === 'imperial';
  heightUnitLabel.textContent = imperial ? 'in' : 'cm';
  weightUnitLabel.textContent = imperial ? 'lb' : 'kg';
});

document.getElementById('profile-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const form = new FormData(event.target);
  const imperial = form.get('units') === 'imperial';
  const heightRaw = Number(form.get('height'));
  const weightRaw = Number(form.get('weight'));

  state.profile = {
    sex: form.get('sex'),
    age: Number(form.get('age')),
    heightCm: imperial ? heightRaw * 2.54 : heightRaw,
    weightKg: imperial ? weightRaw * 0.453592 : weightRaw,
    activityLevel: form.get('activityLevel'),
    goal: form.get('goal'),
    daysPerWeek: Number(form.get('daysPerWeek')),
  };

  resetPhotoStep();
  showStep('photos');
});

// --- Step 2: Photos -------------------------------------------------------

const videoEl = document.getElementById('camera-preview');
const photoPreview = document.getElementById('photo-preview');
const startCameraBtn = document.getElementById('start-camera');
const captureBtn = document.getElementById('capture-photo');
const retakeBtn = document.getElementById('retake-photo');
const uploadInput = document.getElementById('upload-photo');
const photoStatus = document.getElementById('photo-status');

function resetPhotoStep() {
  state.photoDataUrl = null;
  videoEl.classList.add('hidden');
  photoPreview.classList.add('hidden');
  captureBtn.classList.add('hidden');
  retakeBtn.classList.add('hidden');
  startCameraBtn.classList.remove('hidden');
  photoStatus.textContent = '';
  if (state.cameraStream) {
    stopCamera(state.cameraStream);
    state.cameraStream = null;
  }
}

startCameraBtn.addEventListener('click', async () => {
  try {
    photoStatus.textContent = 'Requesting camera access...';
    state.cameraStream = await startCamera(videoEl);
    videoEl.classList.remove('hidden');
    photoPreview.classList.add('hidden');
    startCameraBtn.classList.add('hidden');
    captureBtn.classList.remove('hidden');
    photoStatus.textContent = 'Stand facing the camera, full body in frame.';
  } catch (err) {
    photoStatus.textContent = `Could not access camera: ${err.message}. Try uploading a photo instead.`;
  }
});

captureBtn.addEventListener('click', () => {
  state.photoDataUrl = captureFrame(videoEl);
  photoPreview.src = state.photoDataUrl;
  photoPreview.classList.remove('hidden');
  videoEl.classList.add('hidden');
  captureBtn.classList.add('hidden');
  retakeBtn.classList.remove('hidden');
  if (state.cameraStream) {
    stopCamera(state.cameraStream);
    state.cameraStream = null;
  }
  photoStatus.textContent = 'Photo captured.';
});

retakeBtn.addEventListener('click', () => {
  resetPhotoStep();
});

uploadInput.addEventListener('change', async () => {
  const file = uploadInput.files[0];
  if (!file) return;
  state.photoDataUrl = await readFileAsDataURL(file);
  photoPreview.src = state.photoDataUrl;
  photoPreview.classList.remove('hidden');
  videoEl.classList.add('hidden');
  startCameraBtn.classList.add('hidden');
  captureBtn.classList.add('hidden');
  retakeBtn.classList.remove('hidden');
  photoStatus.textContent = 'Photo uploaded.';
});

document.getElementById('photos-back').addEventListener('click', () => {
  resetPhotoStep();
  showStep('profile');
});

document.getElementById('photos-skip').addEventListener('click', async () => {
  state.photoDataUrl = null;
  state.bodyShape = { available: false, reason: 'Skipped photo analysis.' };
  resetPhotoStep();
  await goToReview();
});

document.getElementById('photos-next').addEventListener('click', async () => {
  await goToReview();
});

async function goToReview() {
  const reviewContent = document.getElementById('review-content');
  reviewContent.innerHTML = '';

  if (!state.photoDataUrl) {
    state.bodyShape = state.bodyShape ?? { available: false, reason: 'No photo provided.' };
    reviewContent.appendChild(
      renderReviewMessage('No photo analyzed. Your plan will use a balanced training split.')
    );
    showStep('review');
    return;
  }

  reviewContent.appendChild(renderReviewMessage('Analyzing your photo in the browser...'));
  showStep('review');

  try {
    const img = await loadImage(state.photoDataUrl);
    const keypoints = await detectKeypoints(img);
    state.bodyShape = classifyBodyShape(keypoints);
  } catch (err) {
    state.bodyShape = { available: false, reason: `Analysis failed: ${err.message}` };
  }

  reviewContent.innerHTML = '';
  if (state.bodyShape.available) {
    reviewContent.appendChild(
      renderReviewMessage(
        `Estimated build: ${state.bodyShape.label} (shoulder/hip ratio ${state.bodyShape.shoulderToHipRatio}). ` +
          `This only nudges workout balance — it is not a body-fat or health measurement.`
      )
    );
  } else {
    reviewContent.appendChild(
      renderReviewMessage(
        `${state.bodyShape.reason} Your plan will use a balanced training split.`
      )
    );
  }
}

function renderReviewMessage(text) {
  const p = document.createElement('p');
  p.textContent = text;
  return p;
}

document.getElementById('review-back').addEventListener('click', () => {
  showStep('photos');
});

document.getElementById('review-generate').addEventListener('click', () => {
  state.plan = generatePlan(state.profile, state.bodyShape);
  renderPlan();
  showStep('plan');
});

// --- Step 4: Plan ---------------------------------------------------------

function renderPlan() {
  const { nutrition, workout } = state.plan;
  const container = document.getElementById('plan-content');
  container.innerHTML = '';

  const nutritionHeading = document.createElement('h3');
  nutritionHeading.textContent = 'Nutrition Targets (daily)';
  container.appendChild(nutritionHeading);

  const macroGrid = document.createElement('div');
  macroGrid.className = 'macro-grid';
  macroGrid.appendChild(macroTile(nutrition.calories, 'Calories'));
  macroGrid.appendChild(macroTile(`${nutrition.proteinG} g`, 'Protein'));
  macroGrid.appendChild(macroTile(`${nutrition.carbsG} g`, 'Carbs'));
  macroGrid.appendChild(macroTile(`${nutrition.fatG} g`, 'Fat'));
  container.appendChild(macroGrid);

  const workoutHeading = document.createElement('h3');
  workoutHeading.textContent = 'Weekly Workout Split';
  container.appendChild(workoutHeading);

  workout.forEach((day) => {
    const dayHeading = document.createElement('h4');
    dayHeading.textContent = `Day ${day.day}: ${day.focus}`;
    container.appendChild(dayHeading);

    const table = document.createElement('table');
    const thead = document.createElement('thead');
    thead.innerHTML = '<tr><th>Exercise</th><th>Sets</th><th>Reps</th></tr>';
    table.appendChild(thead);
    const tbody = document.createElement('tbody');
    day.exercises.forEach((ex) => {
      const tr = document.createElement('tr');
      const nameTd = document.createElement('td');
      nameTd.textContent = ex.name;
      const setsTd = document.createElement('td');
      setsTd.textContent = ex.sets;
      const repsTd = document.createElement('td');
      repsTd.textContent = ex.reps;
      tr.append(nameTd, setsTd, repsTd);
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    container.appendChild(table);
  });
}

function macroTile(value, label) {
  const tile = document.createElement('div');
  tile.className = 'macro-tile';
  const valueEl = document.createElement('div');
  valueEl.className = 'value';
  valueEl.textContent = value;
  const labelEl = document.createElement('div');
  labelEl.className = 'label';
  labelEl.textContent = label;
  tile.append(valueEl, labelEl);
  return tile;
}

document.getElementById('plan-save').addEventListener('click', async () => {
  await saveScan({
    profile: state.profile,
    bodyShape: state.bodyShape,
    plan: state.plan,
    photoDataUrl: state.photoDataUrl,
  });
  await renderHistory();
  showStep('history');
});

document.getElementById('plan-restart').addEventListener('click', () => {
  state.profile = null;
  state.photoDataUrl = null;
  state.bodyShape = null;
  state.plan = null;
  document.getElementById('profile-form').reset();
  resetPhotoStep();
  showStep('profile');
});

// --- History ---------------------------------------------------------------

async function renderHistory() {
  const scans = await listScans();
  const container = document.getElementById('history-content');
  container.innerHTML = '';

  if (scans.length === 0) {
    const empty = document.createElement('p');
    empty.textContent = 'No saved scans yet.';
    container.appendChild(empty);
    return;
  }

  scans.forEach((scan) => {
    const item = document.createElement('div');
    item.className = 'history-item';

    const info = document.createElement('div');
    const date = new Date(scan.createdAt).toLocaleString();
    const dateEl = document.createElement('div');
    dateEl.textContent = date;
    const summaryEl = document.createElement('div');
    summaryEl.textContent = `${scan.profile.goal.replace('_', ' ')} — ${scan.plan.nutrition.calories} kcal/day`;
    info.append(dateEl, summaryEl);

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', async () => {
      await deleteScan(scan.id);
      await renderHistory();
    });

    item.append(info, deleteBtn);
    container.appendChild(item);
  });
}

document.getElementById('history-clear').addEventListener('click', async () => {
  if (confirm('Delete all saved scans from this device? This cannot be undone.')) {
    await clearAllData();
    await renderHistory();
  }
});

document.getElementById('nav-new-scan').addEventListener('click', () => {
  showStep('profile');
});

document.getElementById('nav-history').addEventListener('click', async () => {
  await renderHistory();
  showStep('history');
});

showStep('profile');
