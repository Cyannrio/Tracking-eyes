// Camera-based "eyes follow viewer" using TensorFlow.js + Face Landmarks Detection.
// Works on GitHub Pages (https) and iOS Safari (needs camera permission).

const statusEl = document.getElementById("status");
const startBtn  = document.getElementById("startBtn");
const video = document.getElementById("cam");
const debugCanvas = document.getElementById("debug");
const debugCtx = debugCanvas.getContext("2d", { willReadFrequently: false });

const pupilL = document.querySelector("#eyeL .pupil");
const pupilR = document.querySelector("#eyeR .pupil");

let detector = null;
let rafId = null;

function setStatus(msg){
  statusEl.textContent = msg;
}

function clamp(v, min, max){ return Math.max(min, Math.min(max, v)); }

function resizeDebug(){
  debugCanvas.width  = window.innerWidth  * devicePixelRatio;
  debugCanvas.height = window.innerHeight * devicePixelRatio;
}
window.addEventListener("resize", resizeDebug);
resizeDebug();

async function loadModels(){
  // ESM imports from CDN
  const tf = await import("https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.20.0/+esm");
  const faceLandmarksDetection = await import("https://cdn.jsdelivr.net/npm/@tensorflow-models/face-landmarks-detection@1.0.5/+esm");

  setStatus("Loading tracker…");

  // Prefer WebGL for speed
  try {
    await tf.setBackend("webgl");
  } catch (e) {
    // fallback is okay
  }
  await tf.ready();

  detector = await faceLandmarksDetection.createDetector(
    faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh,
    {
      runtime: "tfjs",
      refineLandmarks: true, // enables iris landmarks on many devices
      maxFaces: 1
    }
  );

  setStatus("Tracker loaded. Starting camera…");
}

async function startCamera(){
  // Front camera
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      facingMode: "user",
      width: { ideal: 640 },
      height: { ideal: 480 }
    }
  });

  video.srcObject = stream;
  await video.play();

  setStatus("Camera on. Tracking…");
}

function movePupilsFromFace(faceXNorm, faceYNorm){
  // faceXNorm/faceYNorm range ~ [-1, 1] (0 is center)
  const root = getComputedStyle(document.documentElement);
  const maxMove = parseFloat(root.getPropertyValue("--pupilMax")) || 34;

  // Map: left/right & up/down
  const x = clamp(faceXNorm, -1, 1) * maxMove;
  const y = clamp(faceYNorm, -1, 1) * maxMove;

  pupilL.style.transform = `translate(${x}px, ${y}px)`;
  pupilR.style.transform = `translate(${x}px, ${y}px)`;
}

function drawDebug(face){
  // Keep hidden by default in CSS; turn on opacity if you want.
  const w = window.innerWidth;
  const h = window.innerHeight;
  debugCtx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);
  debugCtx.clearRect(0,0,w,h);

  if (!face) return;

  // Draw a dot where we think the face center is (approx)
  debugCtx.fillStyle = "rgba(255,255,255,.9)";
  debugCtx.beginPath();
  debugCtx.arc(w/2 + face.dx*(w/2), h/2 + face.dy*(h/2), 6, 0, Math.PI*2);
  debugCtx.fill();
}

async function loop(){
  if (!detector || video.readyState < 2){
    rafId = requestAnimationFrame(loop);
    return;
  }

  // Estimate faces from the video
  const faces = await detector.estimateFaces(video, { flipHorizontal: true });

  if (!faces || faces.length === 0){
    // If no face detected, relax to center
    movePupilsFromFace(0, 0);
    drawDebug(null);
    rafId = requestAnimationFrame(loop);
    return;
  }

  const face = faces[0];

  // We use the face bounding box center as "where the viewer is"
  // bbox is in pixels of the video frame
  const box = face.box; // {xMin, xMax, yMin, yMax, width, height}
  const cx = box.xMin + box.width  / 2;
  const cy = box.yMin + box.height / 2;

  // Normalize relative to video center into [-1, 1]
  // flipHorizontal=true already, so direction feels natural
  const dx = (cx - video.videoWidth  / 2) / (video.videoWidth  / 2);
  const dy = (cy - video.videoHeight / 2) / (video.videoHeight / 2);

  // Small smoothing to prevent jitter
  const smooth = 0.35;
  loop.prevDx = loop.prevDx ?? dx;
  loop.prevDy = loop.prevDy ?? dy;
  const sdx = loop.prevDx + (dx - loop.prevDx) * smooth;
  const sdy = loop.prevDy + (dy - loop.prevDy) * smooth;
  loop.prevDx = sdx;
  loop.prevDy = sdy;

  movePupilsFromFace(sdx, sdy);
  drawDebug({ dx: sdx, dy: sdy });

  rafId = requestAnimationFrame(loop);
}

async function main(){
  if (!("mediaDevices" in navigator) || !navigator.mediaDevices.getUserMedia){
    setStatus("Camera not available in this browser.");
    startBtn.disabled = true;
    return;
  }

  startBtn.addEventListener("click", async () => {
    try{
      startBtn.disabled = true;
      setStatus("Preparing…");

      await loadModels();
      await startCamera();

      cancelAnimationFrame(rafId);
      loop();
    } catch (err){
      console.error(err);
      setStatus("Couldn’t start. Check camera permissions + reload.");
      startBtn.disabled = false;
    }
  });
}

main();