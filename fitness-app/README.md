# Body Scan Fitness Planner

A client-side app that estimates rough body proportions from an optional
photo and generates a personalized workout split and nutrition targets from
your stats and goal.

## Running it

This is a plain HTML/CSS/JS app with no build step, but it uses ES modules
and (optionally) the camera, both of which require an http(s) origin rather
than opening the file directly. Serve it with any static file server, e.g.:

```sh
cd fitness-app
python3 -m http.server 8080
# then open http://localhost:8080
```

## How it works

1. **Your info & goal** — height, weight, age, sex, activity level, goal
   (lose fat / build muscle / maintain / recomp), and training days/week.
2. **Body photo (optional)** — capture via webcam or upload a file. The
   photo is analyzed **entirely in your browser** using TensorFlow.js +
   MoveNet (loaded from a CDN on demand) to estimate shoulder/hip/leg
   proportions. This is a coarse heuristic used only to nudge workout
   volume (e.g. a bit more leg work for a shoulder-dominant frame) — it is
   **not** a body-fat, health, or medical measurement. If the photo step is
   skipped, or analysis fails/isn't available, the app just uses a
   balanced default.
3. **Plan** — calorie target (Mifflin-St Jeor BMR × activity multiplier,
   adjusted for your goal, with a safety floor at BMR), a macro split, and
   a weekly workout split (full body / upper-lower / push-pull-legs
   depending on days per week) with exercises, sets, and reps.
4. **History** — saved scans (stats, plan, and photo) are stored locally in
   IndexedDB. Nothing is ever uploaded to a server. A "Clear All Data"
   button wipes everything.

## Privacy

All computation and storage happens on-device:
- Photos are only ever handed to an in-browser pose-detection model.
- Saved scans live in this browser's IndexedDB and can be cleared anytime
  from the History screen.
- The only network requests this app makes are to load the TensorFlow.js
  and pose-detection libraries from a CDN the first time you analyze a
  photo; if that fails (offline, blocked, etc.) the app degrades to the
  balanced default and still works.

## Disclaimer

This app produces rough, automated estimates for general fitness planning
only. It does not diagnose, measure body fat, or replace professional
advice — consult a doctor, registered dietitian, or certified trainer
before starting a new diet or exercise program.

## Tests

Pure calculation logic (BMR/TDEE/macros/workout templates, body-shape
ratio classification) is covered by Node's built-in test runner:

```sh
cd fitness-app
node --test
```
