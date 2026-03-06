import { FaceLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";

const video = document.getElementById("video");
const startBtn = document.getElementById("startBtn");
const statusEl = document.getElementById("status");

const pupils = [...document.querySelectorAll(".pupil")];
const eyes = [...document.querySelectorAll(".eye")];

let faceLandmarker = null;
let running = false;

function clamp(v,min,max){
return Math.max(min,Math.min(max,v));
}

function movePupilsToward(screenX,screenY){

const r1 = eyes[0].getBoundingClientRect();
const r2 = eyes[1].getBoundingClientRect();

const cx = (r1.left+r1.width/2+r2.left+r2.width/2)/2;
const cy = (r1.top+r1.height/2+r2.top+r2.height/2)/2;

const dx = screenX-cx;
const dy = screenY-cy;

const nx = clamp(dx*0.25,-r1.width*0.12,r1.width*0.12);
const ny = clamp(dy*0.15,-r1.height*0.08,r1.height*0.08);

pupils.forEach(p=>{
p.style.transform=`translate(calc(-50% + ${nx}px), calc(-50% + ${ny}px))`;
});

}

async function initModel(){

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

statusEl.textContent="Ready";

}

async function startCamera(){

const stream = await navigator.mediaDevices.getUserMedia({
video:{facingMode:"user"},
audio:false
});

video.srcObject=stream;

await new Promise(r=>{
if(video.readyState>=1)return r();
video.onloadedmetadata=()=>r();
});

await video.play();

}

function estimateAndUpdate(){

if(!running)return;

const now=performance.now();
const result=faceLandmarker.detectForVideo(video,now);

if(result.faceLandmarks && result.faceLandmarks.length){

const lm=result.faceLandmarks[0];
const nose=lm[4] || lm[1];

const nx=(1-nose.x);
const vx=nx*window.innerWidth;
const vy=nose.y*window.innerHeight;

movePupilsToward(vx,vy);

}

requestAnimationFrame(estimateAndUpdate);

}

startBtn.addEventListener("click",async()=>{

startBtn.disabled=true;

if(!faceLandmarker)await initModel();

await startCamera();

running=true;

estimateAndUpdate();

});

initModel();
