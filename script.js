import { FaceLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";

const video = document.getElementById("video");
const startBtn = document.getElementById("startBtn");
const statusEl = document.getElementById("status");
const pupils = [...document.querySelectorAll(".pupil")];
const eyes = [...document.querySelectorAll(".eye")];

let faceLandmarker = null;
let running = false;

function setStatus(msg){ statusEl.textContent = msg; }

function clamp(v, min, max){
  return Math.max(min, Math.min(max, v));
}

/* smoothing state */
const smooth = eyes.map(() => ({x:0,y:0}));
const SMOOTH = 0.10; // smaller = slower / smoother

function movePupilsToward(screenX, screenY){

  pupils.forEach((p,i)=>{

    const eye = eyes[i];
    const r = eye.getBoundingClientRect();

    const cx = r.left + r.width/2;
    const cy = r.top + r.height/2;

    let dx = screenX - cx;
    let dy = screenY - cy;

    const max = r.width * 0.20;

    const dist = Math.hypot(dx,dy) || 1;

    const desiredX = (dx/dist) * clamp(dist,0,max);
    const desiredY = (dy/dist) * clamp(dist,0,max);

    smooth[i].x += (desiredX - smooth[i].x) * SMOOTH;
    smooth[i].y += (desiredY - smooth[i].y) * SMOOTH;

    p.style.transform =
      `translate(calc(-50% + ${smooth[i].x}px), calc(-50% + ${smooth[i].y}px))`;
  });

}

async function initModel(){

  setStatus("Loading tracker…");

  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
  );

  faceLandmarker = await FaceLandmarker.createFromOptions(vision,{
    baseOptions:{
      modelAssetPath:
      "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"
    },
    runningMode:"VIDEO",
    numFaces:1
  });

  setStatus("Ready. Tap Start.");

}

async function startCamera(){

  const stream = await navigator.mediaDevices.getUserMedia({
    video:{facingMode:"user"},
    audio:false
  });

  video.srcObject = stream;
  await video.play();

}

function estimateAndUpdate(){

  if(!running) return;

  const now = performance.now();
  const result = faceLandmarker.detectForVideo(video, now);

  if(result.faceLandmarks && result.faceLandmarks.length){

    const lm = result.faceLandmarks[0];
    const nose = lm[1];

    const vr = video.getBoundingClientRect();

    /* flip this if the eyes look the wrong direction */
    const MIRROR_X = true;

    const nx = MIRROR_X ? (1 - nose.x) : nose.x;

    const vx = vr.left + nx * vr.width;
    const vy = vr.top + nose.y * vr.height;

    movePupilsToward(vx,vy);

    setStatus("");

  } else {

    setStatus("No face found — move closer");

  }

  requestAnimationFrame(estimateAndUpdate);

}

startBtn.addEventListener("click", async()=>{

  try{

    startBtn.disabled = true;

    setStatus("Starting camera…");

    if(!faceLandmarker)
      await initModel();

    await startCamera();

    running = true;

    setStatus("Tracking…");

    estimateAndUpdate();

  }
  catch(err){

    console.error(err);

    setStatus("Camera failed");

    startBtn.disabled = false;

  }

});

initModel();
