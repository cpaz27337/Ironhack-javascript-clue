// Loads TensorFlow.js + the MoveNet pose-detection model from a CDN and
// runs it on an in-memory image element. The image itself is never sent
// anywhere — only the already-loaded <img> element is handed to the model,
// which runs entirely inside the browser (WebGL/CPU backend).

const TFJS_URL = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.20.0/dist/tf.min.js';
const POSE_DETECTION_URL =
  'https://cdn.jsdelivr.net/npm/@tensorflow-models/pose-detection@2.1.3/dist/pose-detection.min.js';

let detectorPromise = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

async function ensureLibrariesLoaded() {
  if (!window.tf) await loadScript(TFJS_URL);
  if (!window.poseDetection) await loadScript(POSE_DETECTION_URL);
}

async function getDetector() {
  if (!detectorPromise) {
    detectorPromise = (async () => {
      await ensureLibrariesLoaded();
      return window.poseDetection.createDetector(window.poseDetection.SupportedModels.MoveNet, {
        modelType: window.poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
      });
    })();
  }
  return detectorPromise;
}

/**
 * @param {HTMLImageElement} imageEl
 * @returns {Promise<Array<{x:number,y:number,score:number,name:string}>>}
 */
export async function detectKeypoints(imageEl) {
  const detector = await getDetector();
  const poses = await detector.estimatePoses(imageEl);
  return poses.length ? poses[0].keypoints : [];
}
