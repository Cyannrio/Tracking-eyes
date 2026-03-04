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

    const max = r.width * 0.12;          // travel limit
    const dist = Math.hypot(dx, dy) || 1;

    const amt = clamp(dist, 0, max);
    const nx = (dx / dist) * amt;
    const ny = (dy / dist) * amt;

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
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"
    },
    runningMode: "VIDEO",
    numFaces: 1
  });

  setStatus("Ready.");
}

async function startCamera(){
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

  // iOS Safari sometimes needs a tiny delay before play()
  await new Promise(r => setTimeout(r, 120));
  await video.play();
}

function estimateAndUpdate(){
  if (!running) return;

  const now = performance.now();
  const result = faceLandmarker.detectForVideo(video, now);

  if (result.faceLandmarks && result.faceLandmarks.length){
    const lm = result.faceLandmarks[0];

    // Try a more reliable nose point (4 is commonly more "nose tip" than 1)
    const nose = lm[4] || lm[1];

    const MIRROR_X = true; // front camera mirroring
    const nx = MIRROR_X ? (1 - nose.x) : nose.x;

    // Map directly to the screen
   const stage = document.querySelector(".stage").getBoundingClientRect();
   const vx = stage.left + nx * stage.width;
   const vy = stage.top  + nose.y * stage.height;

    movePupilsToward(vx, vy);
    setStatus("");
  } else {
    setStatus("No face found — move closer / more light");
  }

  requestAnimationFrame(estimateAndUpdate);
}

startBtn.addEventListener("click", async () => {
  try{
    startBtn.disabled = true;
    setStatus("Starting…");

    if (!faceLandmarker) await initModel();
    await startCamera();

    running = true;
    setStatus("Tracking…");
    estimateAndUpdate();
  } catch(err){
    console.error(err);
    setStatus("Failed: check permissions + use the GitHub Pages link");
    startBtn.disabled = false;
  }
});

// preload model
initModel();
