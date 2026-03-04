import * as tf from "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-core@4.20.0/+esm";
import "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-webgl@4.20.0/+esm";
import * as faceLandmarks from "https://cdn.jsdelivr.net/npm/@tensorflow-models/face-landmarks-detection@1.0.6/+esm";

const video = document.getElementById("video");
const statusEl = document.getElementById("status");
const startBtn = document.getElementById("startBtn");

const eyes = [
  { el: document.querySelector("#eyeL .pupil"), eyeBox: document.getElementById("eyeL") },
  { el: document.querySelector("#eyeR .pupil"), eyeBox: document.getElementById("eyeR") },
];

// Max pupil travel (px)
const MAX_TRAVEL = 26;

let model = null;
let running = false;

function clamp(n, min, max){ return Math.max(min, Math.min(max, n)); }

function setPupil(dx, dy){
  dx = clamp(dx, -MAX_TRAVEL, MAX_TRAVEL);
  dy = clamp(dy, -MAX_TRAVEL, MAX_TRAVEL);
  for (const e of eyes){
    e.el.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  }
}

async function setupCamera(){
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "user" },
    audio: false
  });
  video.srcObject = stream;
  await new Promise(res => video.onloadedmetadata = res);
  await video.play();
}

async function loadModel(){
  await tf.setBackend("webgl");
  await tf.ready();

  model = await faceLandmarks.createDetector(
    faceLandmarks.SupportedModels.MediaPipeFaceMesh,
    {
      runtime: "tfjs",
      refineLandmarks: true,
      maxFaces: 1
    }
  );
}

function getFaceCenter(keypoints){
  // Use nose tip-ish landmark if available; fall back to average of keypoints
  // MediaPipe keypoints include names sometimes; tfjs version gives array with x,y
  // We'll take a stable point: midpoint between left and right eye centers using indices.
  // Indices: 33 (left eye outer), 263 (right eye outer) are common in FaceMesh.
  const left = keypoints[33];
  const right = keypoints[263];
  if (left && right){
    return { x: (left.x + right.x) / 2, y: (left.y + right.y) / 2 };
  }

  let sx=0, sy=0;
  for (const p of keypoints){ sx += p.x; sy += p.y; }
  return { x: sx/keypoints.length, y: sy/keypoints.length };
}

async function loop(){
  if (!running) return;

  try{
    const faces = await model.estimateFaces(video, { flipHorizontal: true });

    if (!faces || faces.length === 0){
      statusEl.textContent = "No face found (more light / face in frame)";
      setPupil(0, 0);
    } else {
      const kp = faces[0].keypoints;
      const c = getFaceCenter(kp);

      // Map face center position to pupil travel
      const nx = (c.x / video.videoWidth) * 2 - 1;   // -1..1
      const ny = (c.y / video.videoHeight) * 2 - 1;  // -1..1

      // Invert a bit so it feels like "watching you"
      const dx = clamp(nx * MAX_TRAVEL, -MAX_TRAVEL, MAX_TRAVEL);
      const dy = clamp(ny * MAX_TRAVEL, -MAX_TRAVEL, MAX_TRAVEL);

      setPupil(dx, dy);
      statusEl.textContent = "Tracking…";
    }
  } catch (err){
    console.error(err);
    statusEl.textContent = "Tracking error (try reload)";
  }

  requestAnimationFrame(loop);
}

startBtn.addEventListener("click", async () => {
  try{
    startBtn.disabled = true;
    statusEl.textContent = "Starting camera…";

    await setupCamera();

    statusEl.textContent = "Loading model… (first time can be slow)";
    await loadModel();

    running = true;
    startBtn.style.display = "none";
    statusEl.textContent = "Tracking…";
    loop();
  } catch (e){
    console.error(e);
    statusEl.textContent = "Camera blocked / not supported";
    startBtn.disabled = false;
  }
});
