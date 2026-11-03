import {STEP,jumpHeight,hitsObstacle} from './physics.js';
import {createScene} from './scene.js';
import {spawnZ} from './motion.js';
import {createMotionControls} from './motion-controls.js';
import {createGameScreens} from './game-screens.js';
import {StartCountdown} from './countdown.js';
import {createGameAudio} from './audio.js';
import {EnergyCellRound, laneClearOfEnergyCell} from './powerups.js';
const $=id=>document.getElementById(id), canvas=$('game'),view=createScene(canvas);
const localSound=createGameAudio(),countdown=new StartCountdown();let goUntil=0,screens,screenNotice='';
const sound={
 get settings(){return localSound.settings;},
 unlock(){return screens?.remote?Promise.resolve(true):localSound.unlock();},
 setPreference(key,value){localSound.setPreference(key,value);},
 effect(name,value){if(screens?.remote)screens.send('audio',{name,value});else localSound.effect(name,value);},
 setPlaying(playing){localSound.setPlaying(screens?.remote?false:playing);if(screens?.remote)screens.send('music',{playing});}
};
const energyRound=new EnergyCellRound();
function collectEnergyLife(gained){lives+=gained;sound.effect('energy');$('action').textContent='+1 LIFE · ENERGY CELL';$('lives').textContent='♥ '.repeat(lives);$('powerupNotice').classList.remove('hidden');$('lives').parentElement.animate([{boxShadow:'0 0 0 #b9ff4a00',transform:'scale(1)'},{boxShadow:'0 0 32px #b9ff4aaa',transform:'scale(1.12)'},{boxShadow:'0 0 0 #b9ff4a00',transform:'scale(1)'}],{duration:650});}
$('powerupNotice').onanimationend=()=>$('powerupNotice').classList.add('hidden');
function audioControls(){const prefs=sound.settings;for(const [id,key,label] of [['musicToggle','music','Music'],['effectsToggle','effects','Effects']]){$(id).textContent=label+(prefs[key]?' on':' off');$(id).setAttribute('aria-pressed',String(prefs[key]));} $('volume').value=Math.round(prefs.volume*100);}
for(const [id,key] of [['musicToggle','music'],['effectsToggle','effects']])$(id).onclick=()=>{void sound.unlock();sound.setPreference(key,!sound.settings[key]);audioControls();};
$('volume').oninput=()=>{void sound.unlock();sound.setPreference('volume',+$('volume').value/100);};audioControls();
let assetsReady=false;const startLabel=$('start').textContent;$('start').disabled=$('restart').disabled=true;$('start').textContent='Loading human runner…';view.ready.then(()=>{assetsReady=true;$('start').disabled=$('restart').disabled=false;$('start').textContent=startLabel;}).catch(()=>{$('start').textContent='Character could not load';});
const settings={};for(const id of ['speed','gap','jump','lean','duration']){const el=$(id);const update=()=>{settings[id]=+el.value;$(id+'Out').textContent=id==='speed'?el.value+' m/s':id==='gap'||id==='duration'?el.value+' s':Math.round(el.value*100)+'%';};el.oninput=update;update();}
let jumpStart=-10,jumpDuration=1,bodyY=0,previousX=0,previousY=0,previousDistance=0,previousElapsed=0,accumulator=0,frameSamples=[],lastHud=0,frameMs=16;
let running=false,paused=false,lane=0,visualLane=0,elapsed=0,distance=0,lives=3,obstacles=[],spawn=1,jumpUntil=0,duckUntil=0,invincible=0,last=performance.now(),w=800,h=700;
const motion=createMotionControls({settings,onAction:act,onLane:physical=>{if(screens?.remote)return;if(lane!==physical&&running&&!paused&&!countdown.active)sound.effect('lane');lane=physical;},onInvalidate:()=>{if(running&&!paused)pause();}});
const motionState=()=>screens?.remote?screens.motion:motion.state;
function resize(){const box=canvas.getBoundingClientRect();w=box.width;h=box.height;view.resize(w,h);}new ResizeObserver(resize).observe(canvas);
function status(t){screenNotice=t;$('status').textContent=t;}function overlay(title,message){$('overlay').classList.remove('hidden');$('overlay').querySelector('h1').innerHTML=title;$('message').textContent=message;}
function showCount(value){$('countdownValue').textContent=value||'GO!';$('countdown').classList.toggle('go',!value);$('countdown').classList.remove('hidden');$('countdown').setAttribute('aria-label',value?'Starting in '+value:'Go');$('countdownNote').textContent=value?'Find your lane. Get ready.':'Move. Jump. Collect.';}
function beginCountdown(){countdown.start();goUntil=0;accumulator=0;last=performance.now();sound.setPlaying(false);void sound.unlock().then(ok=>{if(ok&&countdown.active&&!paused)sound.effect('countdown',countdown.value);});$('overlay').classList.add('hidden');showCount(3);$('action').textContent='GET READY';}
function start(){if(!assetsReady)return;if(screens?.remote&&!screens.connected){status('Open the control window before starting.');return;}screenNotice='';document.activeElement?.blur();frameSamples=[];frameMs=16.67;if($('mode').value==='body'&&(!motionState().calibrated||performance.now()-motionState().lastPose>600)){status('Enable camera and calibrate with your full body visible first.');return;}running=true;paused=false;lane=visualLane=$('mode').value==='body'?motionState().lane:0;elapsed=distance=previousDistance=previousElapsed=0;bodyY=0;jumpStart=-10;accumulator=0;previousX=visualLane;previousY=0;chips=[];chipCount=0;chipSpawn=1;lives=3;obstacles=[];spawn=2;energyRound.reset();$('powerupNotice').classList.add('hidden');jumpUntil=duckUntil=invincible=0;beginCountdown();}
function pause(){if(!running)return;if(paused&&screens?.remote&&!screens.connected){status('Reopen the control window before resuming.');return;}if(paused&&$('mode').value==='body'&&(!motionState().calibrated||performance.now()-motionState().lastPose>600)){status('Step back into view before resuming.');return;}paused=!paused;screenNotice='';sound.setPlaying(false);if(paused){$('countdown').classList.add('hidden');goUntil=0;overlay('Take a<br><em>breath.</em>','Press P or Pause / resume to continue.');}else beginCountdown();}
function act(a){if(!running||paused||countdown.active)return;const oldLane=lane;if(a==='left')lane=Math.max(-1,lane-1);if(a==='right')lane=Math.min(1,lane+1);if(lane!==oldLane)sound.effect('lane');if(a==='jump'&&bodyY<=.001){jumpStart=elapsed;jumpDuration=settings.duration;jumpUntil=elapsed+jumpDuration;duckUntil=0;sound.effect('jump');}if(a==='duck'&&bodyY<=.001&&elapsed>=duckUntil){duckUntil=elapsed+settings.duration;jumpUntil=0;sound.effect('duck');}$('action').textContent=a.toUpperCase();}
$('start').onclick=start;$('restart').onclick=start;$('pause').onclick=pause;$('fullscreen').onclick=()=>document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen();
addEventListener('keydown',e=>{if(['INPUT','SELECT','BUTTON'].includes(document.activeElement.tagName))return;const map={ArrowLeft:'left',a:'left',ArrowRight:'right',d:'right',ArrowUp:'jump',' ':'jump',w:'jump',ArrowDown:'duck',s:'duck'};if(map[e.key]){e.preventDefault();if(!e.repeat&&$('mode').value==='keyboard')act(map[e.key]);}if(e.key.toLowerCase()==='p')pause();if(e.key==='Enter'&&!running)start();});
$('mode').onchange=()=>{if(running&&!paused)pause();$('start').textContent=$('mode').value==='body'?'Start body-controlled run →':'Start keyboard run →';};
document.addEventListener('visibilitychange',()=>{if(document.hidden&&running&&!paused)pause();});
let chips=[],chipCount=0,chipSpawn=1;
$('theme').onchange=()=>view.setTheme($('theme').value);
function simulate(dt){previousX=visualLane;previousY=bodyY;previousDistance=distance;previousElapsed=elapsed;elapsed+=dt;distance+=dt*settings.speed;visualLane+=(lane-visualLane)*(1-Math.exp(-14*dt));bodyY=jumpHeight(elapsed,jumpStart,jumpDuration);spawn-=dt;chipSpawn-=dt;
 if(chipSpawn<=0){const z=spawnZ(settings.speed),lanes=[-1,0,1].filter(n=>laneClearOfEnergyCell(n,z,energyRound.cells,settings.speed,.35));chips.push({lane:lanes[Math.floor(Math.random()*lanes.length)],z});chipSpawn=.75;}
 for(const chip of chips){chip.z-=settings.speed*dt;if(chip.z<8.6&&chip.z>7.4&&Math.abs(chip.lane*3-visualLane*3)<.65&&bodyY<1.3){chip.collected=true;chipCount++;sound.effect('coin');$('action').textContent='+1 CIRCUIT COIN';$('chips').parentElement.classList.remove('coin-pickup');void $('chips').offsetWidth;$('chips').parentElement.classList.add('coin-pickup');}}chips=chips.filter(c=>c.z>-5&&!c.collected);
 if(spawn<=0){const z=spawnZ(settings.speed),lanes=[-1,0,1].filter(n=>laneClearOfEnergyCell(n,z,energyRound.cells,settings.speed));obstacles.push({lane:lanes[Math.floor(Math.random()*lanes.length)],z,type:['jump','duck','block'][Math.floor(Math.random()*3)]});spawn=settings.gap;}
 for(const o of obstacles){const previousZ=o.z;o.z-=settings.speed*dt;if(!o.hit&&elapsed>=invincible&&hitsObstacle(o,previousZ,visualLane*3,bodyY,elapsed<duckUntil)){lives--;invincible=elapsed+1.2;o.hit=true;sound.effect('hit');$('action').textContent='HIT — KEEP MOVING';}}
 const gainedLife=energyRound.update({elapsed,dt,speed:settings.speed,obstacles,x:visualLane*3,y:bodyY,duck:elapsed<duckUntil});if(gainedLife)collectEnergyLife(gainedLife);
 chips=chips.filter(chip=>laneClearOfEnergyCell(chip.lane,chip.z,energyRound.cells,settings.speed,.35));
 obstacles=obstacles.filter(o=>o.z>-5);if(lives<=0||elapsed>=60){running=false;countdown.cancel();$('countdown').classList.add('hidden');sound.setPlaying(false);sound.effect(lives<=0?'end':'finish');overlay(lives<=0?'Good<br><em>run.</em>':'Round<br><em>complete.</em>',Math.floor(distance)+' metres · '+chipCount+' coins');$('start').textContent='Run again →';}
}
function tick(now){if(screens?.remote&&$('mode').value==='body'&&motionState().calibrated){const physical=motionState().lane;if(lane!==physical&&running&&!paused&&!countdown.active)sound.effect('lane');lane=physical;}if(document.hidden){last=now;requestAnimationFrame(tick);return;}const delta=(now-last)/1000;last=now;frameMs=frameMs*.95+delta*1000*.05;frameSamples.push(delta*1000);if(frameSamples.length>120)frameSamples.shift();
 if(running&&!paused){if(delta>.25){pause();status('Rendering stalled; round paused to keep collisions fair.');}else if($('mode').value==='body'&&now-motionState().lastPose>1800){pause();status('Tracking lost. Step into view, then resume.');}else if(countdown.active){const count=countdown.advance(delta);if(count.changed){showCount(count.value);sound.effect(count.complete?'go':'countdown',count.value);}if(count.complete){goUntil=now+550;sound.setPlaying(true);$('action').textContent='LET’S MOVE';}}else{accumulator+=delta;let steps=0;while(accumulator>=STEP&&running&&!paused&&steps++<30){simulate(STEP);accumulator-=STEP;}}}else accumulator=0;
 if(goUntil&&now>=goUntil){$('countdown').classList.add('hidden');goUntil=0;}
 const moving=running&&!paused&&!countdown.active,blend=accumulator/STEP,renderDistance=moving?previousDistance+(distance-previousDistance)*blend:distance,renderElapsed=moving?previousElapsed+(elapsed-previousElapsed)*blend:elapsed,renderLane=moving?previousX+(visualLane-previousX)*blend:visualLane,renderY=moving?previousY+(bodyY-previousY)*blend:bodyY;
 if(now-lastHud>200){lastHud=now;$('score').textContent=String(Math.floor(distance)).padStart(4,'0');$('time').textContent=Math.max(0,Math.ceil(60-elapsed))+'s';$('lives').textContent='♥ '.repeat(Math.max(0,lives));$('chips').textContent=chipCount;const sorted=[...frameSamples].sort((a,b)=>a-b);$('performance').textContent=Math.round(1000/frameMs)+' FPS · p95 '+Math.round(sorted[Math.floor(sorted.length*.95)]||0)+' ms';}
 view.render({distance:renderDistance,simulationDistance:distance,elapsed:renderElapsed,visualLane:renderLane,lane,obstacles,chips,energyCells:energyRound.cells,running:running&&!countdown.active,paused,jumpUntil,duckUntil,invincible,duration:jumpDuration,bodyY:renderY,dt:Math.min(delta,.05),speed:settings.speed});requestAnimationFrame(tick);
}requestAnimationFrame(tick);

function gameConfig(){return {settings:{...settings},mode:$('mode').value,theme:$('theme').value,quality:$('quality').value,audio:sound.settings};}
function applyGameConfig(next){
 for(const [key,value] of Object.entries(next.settings)){$(key).value=value;$(key).oninput();}
 if($('mode').value!==next.mode){$('mode').value=next.mode;$('mode').onchange();}
 if($('theme').value!==next.theme){$('theme').value=next.theme;view.setTheme(next.theme);}
 if($('quality').value!==next.quality){$('quality').value=next.quality;view.setQuality(next.quality);}
 for(const [key,value] of Object.entries(next.audio))if(sound.settings[key]!==value)sound.setPreference(key,value);
 audioControls();
}
screens=createGameScreens({
 snapshot:()=>({ready:assetsReady,running,paused,countdown:countdown.active?countdown.value:0,distance:Math.floor(distance),remaining:Math.max(0,Math.ceil(60-elapsed)),coins:chipCount,lives,action:$('action').textContent,performance:$('performance').textContent,notice:screenNotice}),
 config:gameConfig,configure:applyGameConfig,
 command:name=>name==='pause'?pause():start(),
 action:name=>{if(['jump','duck'].includes(name)||$('mode').value==='keyboard')act(name);},
 pause:()=>{if(running&&!paused)pause();},stopCamera:()=>motion.stop(),audio:localSound,status,
});
for(const id of ['speed','gap','jump','lean','duration','mode','theme','quality','musicToggle','effectsToggle','volume']){
 $(id).addEventListener(['musicToggle','effectsToggle'].includes(id)?'click':'change',()=>screens.saveConfig());
}
