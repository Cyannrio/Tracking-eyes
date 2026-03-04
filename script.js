import { FaceLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";

const video = document.getElementById("video");
const startBtn = document.getElementById("startBtn");
const statusEl = document.getElementById("status");
const pupils = [...document.querySelectorAll(".pupil")];
const eyes = [...document.querySelectorAll(".eye")];

let faceLandmarker = null;
let running = false;

function setStatus(msg){ statusEl.textContent = msg; }

function clamp(v, min, max){ return Math.max(min, Math.min(max, v)); }

function movePupilsToward(screenX, screenY){
  pupils.forEach((p, i) => {
    const eye = eyes[i];
    const r = eye.getBoundingClientRect();
    const cx = r.left + r.width/2;
    const cy = r.top + r.height/2;

    const dx = screenX - cx;
    const dy = screenY - cy;

    // limit pupil travel
    const max = r.width * 0.22; // tweak for scarier/smaller movement
    const dist = Math.hypot(dx, dy) || 1;
    const nx = (dx / dist) * clamp(dist, 0, max);
    const ny = (dy / dist) * clamp(dist, 0, max);

    p.style.transform = `translate(calc(-50% + ${nx}px), calc(-50% + ${ny}px))`;
  });
}

async function initModel(){
  setStatus("Loading tracker…");
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
  );

  faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"
    },
    outputFaceBlendshapes: false,
    runningMode: "VIDEO",
    numFaces: 1
  });

  setStatus("Ready. Tap Start.");
}

async function startCamera(){
  // front camera on iPad
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "user" },
    audio: false
  });

  video.srcObject = stream;
  await video.play();
}

function estimateAndUpdate(){
  if (!running) return;

  const now = performance.now();
  const result = faceLandmarker.detectForVideo(video, now);

  if (result.faceLandmarks && result.faceLandmarks.length){
    // Use nose tip landmark as “where to look”
    // Landmarks are normalized [0..1] in video space
    const lm = result.faceLandmarks[0];
    const nose = lm[1]; // works well enough; if not, we can swap index

    const vx = (1 - nose.x) * window.innerWidth;
    const vy = nose.y * window.innerHeight;

    movePupilsToward(vx, vy);
    setStatus("");
  } else {
    setStatus("No face found — move closer / face the camera");
  }

  requestAnimationFrame(estimateAndUpdate);
}

startBtn.addEventListener("click", async () => {
  try{
    startBtn.disabled = true;
    setStatus("Starting camera…");

    if (!faceLandmarker) await initModel();
    await startCamera();

    running = true;
    setStatus("Tracking…");
    estimateAndUpdate();
  } catch(err){
    console.error(err);
    setStatus("Camera/Model failed. Check permissions + use GitHub Pages link.");
    startBtn.disabled = false;
  }
});

// load model in advance so Start feels instant
initModel();
