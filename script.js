import { FaceLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";

const video = document.getElementById("video");
const startBtn = document.getElementById("startBtn");
const statusEl = document.getElementById("status");

const pupilLeft = document.getElementById("pupilLeft");
const pupilRight = document.getElementById("pupilRight");
const eyesWrap = document.querySelector(".eyesWrap");

let faceLandmarker = null;
let running = false;

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function movePupilsToward(screenX, screenY) {
  const r = eyesWrap.getBoundingClientRect();

  const centerX = r.left + r.width / 2;
  const centerY = r.top + r.height / 2;

  const dx = screenX - centerX;
  const dy = screenY - centerY;

  const offsetX = clamp(dx * 0.08, -16, 16);
  const offsetY = clamp(dy * 0.05, -10, 10);

  pupilLeft.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
  pupilRight.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
}

async function initModel() {
  statusEl.textContent = "Loading tracker...";

  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
  );

  faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"
    },
    runningMode: "VIDEO",
    numFaces: 1
  });

  statusEl.textContent = "Ready.";
}

async function startCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "user" },
    audio: false
  });

  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  video.setAttribute("playsinline", "");
  video.setAttribute("muted", "");
  video.setAttribute("autoplay", "");

  await new Promise((resolve) => {
    if (video.readyState >= 1) return resolve();
    video.onloadedmetadata = () => resolve();
  });

  await video.play();
}

function estimateAndUpdate() {
  if (!running) return;

  if (video.readyState < 2) {
    requestAnimationFrame(estimateAndUpdate);
    return;
  }

  const now = performance.now();
  const result = faceLandmarker.detectForVideo(video, now);

  if (result.faceLandmarks && result.faceLandmarks.length) {
    const lm = result.faceLandmarks[0];
    const nose = lm[4] || lm[1];

    const x = (1 - nose.x) * window.innerWidth;
    const y = nose.y * window.innerHeight;

    movePupilsToward(x, y);
    statusEl.textContent = "";
  } else {
    statusEl.textContent = "No face found";
  }

  requestAnimationFrame(estimateAndUpdate);
}

startBtn.addEventListener("click", async () => {
  try {
    startBtn.disabled = true;
    statusEl.textContent = "Starting...";

    if (!faceLandmarker) {
      await initModel();
    }

    await startCamera();

    running = true;
    statusEl.textContent = "Tracking...";
    estimateAndUpdate();
  } catch (err) {
    console.error(err);
    statusEl.textContent = "Camera failed";
    startBtn.disabled = false;
  }
});

initModel();
