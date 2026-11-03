import {LaneTracker, smoothPoint, defaultLines} from './tracking.js';

// Shared by the combined page and the dedicated operator window.
export function createMotionControls({settings, onAction = () => {}, onLane = () => {}, onInvalidate = () => {}, onPose = () => {}}) {
const $ = id => document.getElementById(id);
const video = $('video'), sk = $('skeleton'), sc = sk.getContext('2d');
sk.width = 1280; sk.height = 720;
let model, stream, base = null, samples = [], calibrating = false, calStart = 0, lastPose = 0,
    lastVideo = -1, jumpReady = true, duckReady = true, cameraBusy = false;
const status = text => { $('status').textContent = text; };
const act = onAction;
const snapshot = () => ({calibrated: !!base, lane: floorTracker.current, lastPose, camera: !!stream});
$('calibrate').onclick=()=>{base=null;samples=[];filtered=null;calibrating=true;calStart=performance.now();onInvalidate();status('Stand upright and still, centered, with feet visible. Hold for 3 seconds.');};
async function enableCamera(){if(cameraBusy)return;if(stream){stream.getTracks().forEach(t=>t.stop());stream=null;cameraEpoch++;clearTimeout(poseTimer);video.srcObject=null;base=null;lastPose=0;renderTracking(null);$('calibrate').disabled=true;$('camera').textContent='Enable camera';$('cameraLabel').textContent='CAMERA OFF';if($('mode').value==='body')onInvalidate();return;}cameraBusy=true;const requestEpoch=++cameraEpoch;$('camera').disabled=true;try{status('Loading local pose tracking…');if(!model)await startTrackingWorker();if(requestEpoch!==cameraEpoch)return;status('Tracking model ready. Allow camera access when prompted. If this browser does not show a prompt, open http://127.0.0.1:5173 in Chrome or Edge.');stream=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:1280},height:{ideal:720},frameRate:{ideal:30}},audio:false});if(requestEpoch!==cameraEpoch){stream.getTracks().forEach(t=>t.stop());stream=null;return;}video.srcObject=stream;await video.play();cameraEpoch++;lastVideo=-1;$('camera').textContent='Stop camera';$('calibrate').disabled=false;$('cameraLabel').textContent='LIVE · LOCAL PROCESSING';status('Camera ready. Stand back until your feet are visible, then calibrate.');poseLoop();}catch(e){if(stream)stream.getTracks().forEach(t=>t.stop());stream=null;status('Camera could not start: '+e.message+'. Keyboard mode is available.');}finally{if(!stream&&requestEpoch!==cameraEpoch){worker?.terminate();worker=null;model=null;framePending=false;}cameraBusy=false;$('camera').disabled=false;}}
$('camera').onclick=enableCamera;
let filtered=null,filterTime=0,groundY=.9,lastLanePose=0;
let floorLines=defaultLines();
function loadSavedLines(){try{const saved=JSON.parse(localStorage.getItem('motion-floor-v1'));if(saved&&['top','bottom','far','near'].every(k=>k in saved)&&saved.far.length===3&&saved.near.length===3&&[saved.top,saved.bottom,...saved.far,...saved.near].every(v=>Number.isFinite(v)&&v>=0&&v<=1)&&saved.top+.1<saved.bottom&&[saved.far,saved.near].every(a=>a[0]+.04<a[1]&&a[1]+.04<a[2]))floorLines=saved;}catch{}}
loadSavedLines();
const floorTracker=new LaneTracker();
function saveLines(){renderTracking(null);try{localStorage.setItem('motion-floor-v1',JSON.stringify(floorLines));}catch{}base=null;status('Floor alignment updated. Calibrate standing posture before playing.');onInvalidate();}
function controls(){const host=$('laneControls');host.replaceChildren();for(const [key,names] of [['far',['Left far end','Middle far end','Right far end']],['near',['Left near end','Middle near end','Right near end']]])names.forEach((name,i)=>{const label=document.createElement('label');label.textContent=name;const input=document.createElement('input');input.type='range';input.min=.02;input.max=.98;input.step=.005;input.value=floorLines[key][i];input.oninput=()=>{floorLines[key][i]=Math.max(i?floorLines[key][i-1]+.05:.02,Math.min(i<2?floorLines[key][i+1]-.05:.98,+input.value));input.value=floorLines[key][i];saveLines();};label.append(input);host.append(label);});for(const key of ['top','bottom']){const label=document.createElement('label');label.textContent=key==='top'?'Far end height':'Near end height';const input=document.createElement('input');Object.assign(input,{type:'range',min:'.1',max:'.98',step:'.01',value:floorLines[key]});input.oninput=()=>{floorLines[key]=key==='top'?Math.min(+input.value,floorLines.bottom-.1):Math.max(+input.value,floorLines.top+.1);input.value=floorLines[key];saveLines();};label.append(input);host.append(label);}}
controls();$('resetLines').onclick=()=>{floorLines=defaultLines();saveLines();controls();};$('expandPreview').onclick=()=>document.querySelector('.preview').classList.toggle('expanded');document.querySelector('.preview').onclick=()=>document.querySelector('.preview').classList.remove('expanded');
function renderTracking(points){if(video.videoWidth){if(sk.width!==video.videoWidth||sk.height!==video.videoHeight){sk.width=video.videoWidth;sk.height=video.videoHeight;}document.querySelector('.preview').style.aspectRatio=video.videoWidth+'/'+video.videoHeight;}sc.clearRect(0,0,sk.width,sk.height);for(let i=0;i<3;i++){sc.strokeStyle=i-1===floorTracker.current?'#ceff53':'#ff5555';sc.lineWidth=5;sc.beginPath();sc.moveTo(floorLines.far[i]*sk.width,floorLines.top*sk.height);sc.lineTo(floorLines.near[i]*sk.width,floorLines.bottom*sk.height);sc.stroke();sc.font='bold 22px sans-serif';sc.fillStyle=sc.strokeStyle;sc.fillText(['LEFT','MIDDLE','RIGHT'][i],floorLines.near[i]*sk.width-25,floorLines.bottom*sk.height-12);}if(!points)return;for(const [a,b] of [[11,12],[11,23],[12,24],[23,24],[23,25],[25,27],[24,26],[26,28],[11,13],[13,15],[12,14],[14,16]]){if(points[a].visibility<.3||points[b].visibility<.3)continue;sc.strokeStyle='#79ebff';sc.lineWidth=4;sc.beginPath();sc.moveTo((1-points[a].x)*sk.width,points[a].y*sk.height);sc.lineTo((1-points[b].x)*sk.width,points[b].y*sk.height);sc.stroke();}}
function processPose(points,now){
 if(calibrating&&now-calStart>12000){calibrating=false;status('Calibration timed out. Stand upright in good light and retry.');}
 const usable=points&&[23,24].every(i=>(points[i].visibility??0)>.35)&&[11,12].some(i=>(points[i].visibility??0)>.35);
 if(!usable){$('trackingState').textContent=now-lastPose<1800?'Brief occlusion — holding':'Player not visible';renderTracking(null);if(calibrating)samples=[];return;}
 const dt=Math.max(.001,(now-filterTime)/1000);if(now-lastPose>700)filtered=null;
 filtered=points.map((p,i)=>smoothPoint(filtered?.[i],p,dt));filterTime=now;lastPose=now;const p=filtered;
 const hip=(p[23].y+p[24].y)/2,x=1-(p[23].x+p[24].x)/2;
 const shoulders=[11,12].filter(i=>p[i].visibility>.35),shoulder=shoulders.reduce((s,i)=>s+p[i].y,0)/shoulders.length;
 const visibleFeet=[27,28].filter(i=>(points[i].visibility??0)>.35),feet=visibleFeet.length?visibleFeet.reduce((s,i)=>s+p[i].y,0)/visibleFeet.length:null;
 const rise=base?base.hip-hip:0,drop=base?shoulder-base.shoulder:0;
 if(feet!==null&&Math.abs(rise)<settings.jump*.55&&drop<.07)groundY=groundY*.8+feet*.2;
 const footX=visibleFeet.length===2?1-(p[27].x+p[28].x)/2:x; const laneX=Math.abs(rise)<settings.jump*.55&&visibleFeet.length===2?footX*.7+x*.3:x; const physical=floorTracker.update(laneX,groundY,floorLines,now,settings.lean);lastLanePose=now;
 $('physicalLane').textContent=['LEFT','MIDDLE','RIGHT'][physical+1];$('trackingState').textContent=feet===null?'Torso tracked · feet hidden':'Tracking stable';
 if($('mode').value==='body'&&base)onLane(physical);
 renderTracking(p);
 if(calibrating){if(feet===null||shoulders.length!==2){samples=[];status('Calibration needs shoulders and feet visible.');return;}samples.push({hip,x,feet,shoulder});if(samples.length>90)samples.shift();if(samples.length>=35&&now-calStart>=2500){const stable=['hip','x','shoulder'].every(k=>Math.max(...samples.map(s=>s[k]))-Math.min(...samples.map(s=>s[k]))<.035);if(!stable){status('Hold still briefly to finish calibration.');return;}base={};for(const k of ['hip','x','feet','shoulder']){const sorted=samples.map(s=>s[k]).sort((a,b)=>a-b);base[k]=sorted[Math.floor(sorted.length/2)];}groundY=base.feet;calibrating=false;jumpReady=duckReady=true;status('Calibrated. Stand on any tape line to select its lane.');}return;}
 if(!base||$('mode').value!=='body')return;
 if(rise<settings.jump*.35)jumpReady=true;
 if(jumpReady&&rise>settings.jump&&drop<0&&(feet===null||base.feet-feet>settings.jump*.15)){act('jump');jumpReady=false;}
 if(drop<.04)duckReady=true;if(duckReady&&drop>.10){act('duck');duckReady=false;}
}
let worker=null,framePending=false,cameraEpoch=0,poseTimer=0;
function stopTrackingError(message){if(stream)stream.getTracks().forEach(t=>t.stop());stream=null;cameraEpoch++;framePending=false;base=null;model=null;worker?.terminate();worker=null;$('camera').textContent='Enable camera';$('calibrate').disabled=true;status('Tracking stopped: '+message);if($('mode').value==='body')onInvalidate();}
function startTrackingWorker(){return new Promise((resolve,reject)=>{worker=new Worker('./pose-worker.js');const timeout=setTimeout(()=>{worker?.terminate();worker=null;reject(new Error('Local tracking startup timed out'));},45000);worker.onerror=e=>{clearTimeout(timeout);reject(new Error(e.message));stopTrackingError(e.message);};worker.onmessage=({data:d})=>{if(d.type==='ready'){clearTimeout(timeout);model=true;resolve();}else if(d.type==='error'){clearTimeout(timeout);reject(new Error(d.message));stopTrackingError(d.message);}else if(d.type==='pose'){framePending=false;if(stream&&d.epoch===cameraEpoch){const age=performance.now()-d.timestamp;$('latency').textContent=Math.round(d.ms)+' ms · age '+Math.round(age)+' ms';if(age<400){processPose(d.points,performance.now());onPose(snapshot());}}}};worker.postMessage({type:'init'});});}
async function poseLoop(){clearTimeout(poseTimer);if(!stream)return;if(!framePending&&video.readyState>=2&&lastVideo!==video.currentTime){lastVideo=video.currentTime;framePending=true;const epoch=cameraEpoch,timestamp=performance.now();try{const bitmap=await createImageBitmap(video,{resizeWidth:640,resizeHeight:Math.round(640*video.videoHeight/video.videoWidth)});if(!stream||epoch!==cameraEpoch){bitmap.close();framePending=false;}else worker.postMessage({type:'frame',bitmap,timestamp,epoch},[bitmap]);}catch(e){stopTrackingError(e.message);return;}}poseTimer=setTimeout(poseLoop,16);}

renderTracking(null);
addEventListener('storage', event => {
  if(event.key !== 'motion-floor-v1') return;
  loadSavedLines(); base=null; controls(); renderTracking(null);
  if(stream) onInvalidate();
});
return {
  get state() { return snapshot(); },
  stop() {
    cameraEpoch++; clearTimeout(poseTimer);
    if(!cameraBusy){worker?.terminate();worker=null;model=null;framePending=false;}
    stream?.getTracks().forEach(track => track.stop()); stream = null;
    video.srcObject = null; base = null; lastPose = 0; calibrating = false;
    $('camera').textContent = 'Enable camera'; $('calibrate').disabled = true;
    $('cameraLabel').textContent = 'CAMERA OFF'; renderTracking(null); onInvalidate();
  },
};
}
