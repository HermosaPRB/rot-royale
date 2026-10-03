import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { detailPlaza } from './plaza.js?v=detail-6';
import { createWoodenCharacter } from './wooden-character.js?v=polish-46';
import { createNeegyCharacter } from './neegy-character.js?v=polish-46';
import { createHeldGun, createFirstPersonWeapon, createMeleeBat, createMeleeKnife } from './combat-models.js?v=gun-design-41';
import { mergeRigidParts } from './surface-details.js?v=detail-6';
import { buildNeonTown, createPickupMesh } from './neon-town.js?v=polish-46';
import { buildMozzarellaFactory, factoryConveyorAt, factorySteamBlocksSight, updateFactoryEffects } from './mozzarella-factory.js?v=polish-46';
import { buildSurfMap, SURF_FLOOR_Y, SURF_SPAWN, SURF_FINISH_Z, SURF_CHECKPOINTS } from './surf.js?v=surf-33';

const $ = (id) => document.getElementById(id);
const screens = ['home','settings','lobby','pause','results'];
const DEFAULT_BINDS={
  forward:'KeyW',back:'KeyS',left:'KeyA',right:'KeyD',jump:'Space',aim:'ShiftLeft',
  melee:'KeyF',reload:'KeyR',emote:'KeyE',build:'KeyB',buildType:'KeyT',inspect:'KeyI',
  slide:'ControlLeft',sound:'KeyM',capture:'KeyL',turnLeft:'ArrowLeft',turnRight:'ArrowRight',
  loadout1:'Digit1',loadout2:'Digit2',loadout3:'Digit3',loadout4:'Digit4'
};
const BIND_LABELS={
  forward:'Move forward',back:'Move backward',left:'Move left',right:'Move right',jump:'Jump / bunny hop',
  aim:'Aim',melee:'Gun / bat',reload:'Reload / rotate build',emote:'Emote / interact',build:'Build mode',
  buildType:'Change build piece',inspect:'Inspect weapon',slide:'Slide',sound:'Toggle sound',
  capture:'Capture mouse',turnLeft:'Keyboard turn left',turnRight:'Keyboard turn right',
  loadout1:'Death loadout 1',loadout2:'Death loadout 2',loadout3:'Death loadout 3',loadout4:'Death loadout 4'
};
function loadKeybinds(){try{const saved=JSON.parse(localStorage.getItem('rot-royale-keybinds')||'{}');return Object.fromEntries(Object.entries(DEFAULT_BINDS).map(([action,code])=>[action,typeof saved[action]==='string'?saved[action]:code]))}catch{return{...DEFAULT_BINDS}}}
let keybinds=loadKeybinds(),rebindingAction=null;
function keyName(code){return code.replace(/^Key/,'').replace(/^Digit/,'').replace('ControlLeft','Left Ctrl').replace('ControlRight','Right Ctrl').replace('ShiftLeft','Left Shift').replace('ShiftRight','Right Shift').replace('Arrow','').replace('Space','Spacebar')}
function actionForPhysical(code){
  const found=Object.keys(keybinds).find(action=>keybinds[action]===code);if(found)return found;
  if(code==='ShiftRight'&&keybinds.aim==='ShiftLeft')return'aim';
  if(code==='ControlRight'&&keybinds.slide==='ControlLeft')return'slide';
  return null;
}
function canonicalCode(code){
  const action=actionForPhysical(code);if(action)return DEFAULT_BINDS[action];
  return Object.values(DEFAULT_BINDS).includes(code)?`Unbound:${code}`:code;
}
function saveKeybinds(){try{localStorage.setItem('rot-royale-keybinds',JSON.stringify(keybinds))}catch{}}
function renderKeybinds(){
  const root=$('keybind-list');if(!root)return;
  root.innerHTML=Object.keys(DEFAULT_BINDS).map(action=>`<div class="keybind-row"><span>${BIND_LABELS[action]}</span><button type="button" class="keybind-button${rebindingAction===action?' listening':''}" data-bind="${action}">${rebindingAction===action?'Press a key…':keyName(keybinds[action])}</button></div>`).join('');
  updateBindLabels();
}
function updateBindLabels(){
  document.querySelectorAll?.('[data-bind-action]').forEach(node=>node.textContent=keyName(keybinds[node.dataset.bindAction]));
  if($('control-hint'))$('control-hint').textContent=`${keyName(keybinds.forward)}/${keyName(keybinds.left)}/${keyName(keybinds.back)}/${keyName(keybinds.right)} TO MOVE · CLICK TO CAPTURE MOUSE`;
}
function setKeybind(action,code){
  const old=keybinds[action],conflict=Object.keys(keybinds).find(other=>other!==action&&keybinds[other]===code);
  if(conflict)keybinds[conflict]=old;
  keybinds[action]=code;rebindingAction=null;saveKeybinds();renderKeybinds();
}
const CHARACTERS = [
  {id:'wooden',name:'Wooden Bonker',emoji:'🪵',portrait:'./assets/wooden-bonker.png',color:0xc18a43,shape:'wooden'},
  {id:'neegy',name:'Neegy',emoji:'🥇',color:0xe5ac24,shape:'neegy'}
];
const WEAPONS = {
  ar:{name:'Espresso AR',icon:'☕',automatic:true,damage:18,rate:115,mag:30,reserve:90,reload:1450,spread:.006,pellets:1,range:72,color:0xe85b39,move:1},
  shotgun:{name:'Biscotti Boomstick',icon:'🥨',damage:10,rate:720,mag:6,reserve:30,reload:1900,spread:.085,pellets:10,range:22,color:0xd9ad6b,move:.94},
  sniper:{name:'Lungo Sniper',icon:'🥄',damage:82,rate:1050,mag:5,reserve:20,reload:2100,spread:.045,adsSpread:.0005,pellets:1,range:120,color:0x39bfc2,move:.88},
  smg:{name:'Ristretto SMG',icon:'⚡',automatic:true,damage:11,rate:72,mag:40,reserve:120,reload:1350,spread:.015,pellets:1,range:52,color:0xea4f8f,move:1.14}
};

const state = {
  mode:'home',host:false,practice:false,peer:null,conn:null,connections:new Map(),room:'',id:'',
  players:{},selectedChar:'wooden',selectedWeapon:'ar',keys:{},health:100,kills:0,deaths:0,alive:true,map:'neon',arsenal:{},pickups:[],lootNoticeUntil:0,
  ammo:30,reserve:Infinity,reloading:false,lastShot:0,matchEnd:0,matchActive:false,lastNet:0,velocityY:0,onGround:true,
  pointerLockFailed:false,capturePending:false,mouseX:null,mouseY:null,mouseOver:false,velocityX:0,velocityZ:0,hopChain:0,pendingWeapon:'ar',climbing:null,emoteUntil:0,emoteYaw:0,emoteEquipment:'gun',
  meleeStart:-Infinity,lastMelee:-Infinity,reloadStart:0,aiming:false,aimProgress:0,aimBlend:0,equipped:'gun',headshotAt:-Infinity,fireHeld:false,respawnAt:0,slideUntil:0,slideCooldown:0,onRamp:false,jumpQueued:false,surfStart:0,surfCheckpoint:0,surfBest:Infinity,
  switchStart:-Infinity,switchPending:null,switchSwapped:false,inspectStart:-Infinity
};

let scene,camera,renderer,controls,clock,world,playerMeshes=new Map(),raycaster,weaponModel,meleeModel;
const MELEE={damage:50,range:2.8,cooldown:800,duration:520,cone:.65};
const SWITCH_DURATION=320,INSPECT_DURATION=1300;
const meleeCooldowns=new Map(),meleeVisuals=new Map();
const shotCooldowns=new Map(),hitModels=new Map(),hitReactions=new Map();
const coffeeBursts=[];let coffeeGeometry,coffeeMaterial;
const impactTransform=new THREE.Object3D();
const tracerSlots=Array.from({length:96},()=>({start:new THREE.Vector3(),end:new THREE.Vector3(),born:-Infinity}));
let tracerMesh,tracerCursor=0;
const tracerTransform=new THREE.Object3D(),tracerDirection=new THREE.Vector3(),tracerUp=new THREE.Vector3(0,1,0);
const weaponRigs=new Map();
const EMOTE_DURATION=4000;let emoteCamera,emoteActor,emoteCharacter;
const buildObjects=new Map(),buildTemplates=new Map(),buildCooldowns=new Map();let buildSerial=0,buildGhost,buildPreviewAt=-Infinity;
const BUILD_LIFETIME=30000;
let audioContext,soundMuted=false,eliminationUntil=0,landingKick=0,shotShake=0,slideView=0,targetCheckAt=0,damageSerial=0;
const remoteShotTimes=new Map();
const botBrains=new Map();
let lastLeaderboardSignature='';
let audioMaster,audioLimiter,reloadSoundStage=0;
const soundBuffers=new Map(),soundVoices=new Set();
function unlockAudio(){try{const Audio=globalThis.AudioContext||globalThis.webkitAudioContext;if(!Audio)return;if(!audioContext){audioContext=new Audio();audioMaster=audioContext.createGain();audioMaster.gain.value=.65;audioLimiter=audioContext.createDynamicsCompressor();audioLimiter.threshold.value=-10;audioLimiter.knee.value=8;audioLimiter.ratio.value=8;audioLimiter.attack.value=.003;audioLimiter.release.value=.12;audioMaster.connect(audioLimiter);audioLimiter.connect(audioContext.destination);for(const type of ['ar','smg','shotgun','sniper','magout','magin','bolt'])for(let variant=0;variant<3;variant++)makeSoundBuffer(type,variant)}if(audioContext.state==='suspended')audioContext.resume().catch(()=>{})}catch{}}
// Original procedural recordings: cached once, never synthesized in the render loop.
function makeSoundBuffer(type,variant=0){
  const key=type+variant;if(soundBuffers.has(key))return soundBuffers.get(key);
  const profiles={ar:[.48,135,.058,.15],smg:[.32,185,.035,.09],shotgun:[.85,78,.12,.26],sniper:[1.05,105,.095,.34]},p=profiles[type],duration=p?p[0]:.18,sr=audioContext.sampleRate,buffer=audioContext.createBuffer(1,Math.ceil(sr*duration),sr),data=buffer.getChannelData(0);
  let seed=7919+variant*1777+type.charCodeAt(0)*101,low=0,air=0,previous=0,phase=0,peak=0;
  const noise=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2147483648-1};
  for(let i=0;i<data.length;i++){
    const t=i/sr,n=noise();low+=.035*(n-low);air+=.3*(n-air);const high=n-air;let sample;
    if(p){
      phase+=2*Math.PI*(p[1]*(1+.65*Math.exp(-t*75)))/sr;
      const crack=(high*.85+n*.35)*Math.exp(-t/(type==='shotgun'?.032:.012));
      const blast=(low*4.8+Math.sin(phase)*.26)*Math.exp(-t/p[2]);
      const tail=(air*.28+low*.8)*Math.exp(-t/p[3])*(1-Math.exp(-t*90));
      const actionTime=type==='shotgun'?.32:type==='sniper'?.42:.035,at=t-actionTime;
      const action=at>0?(high*.15+Math.sin(at*6200)*.045)*Math.exp(-at/.019):0;
      const echoAt=t-.085,echo=echoAt>0?low*.4*Math.exp(-echoAt/(p[3]*.8)):0;
      sample=(crack+blast+tail+action+echo)*Math.min(1,t/.0007);
    }else{
      const heavy=type==='magin',bolt=type==='bolt',second=t-(bolt?.047:.029);
      sample=(high*.5+low*(heavy?4:1.5)+Math.sin(t*(heavy?1900:3400))*.13)*Math.exp(-t/(bolt?.022:.012));
      if(second>0)sample+=(n*.4+Math.sin(second*5100)*.16)*Math.exp(-second/.016);
      sample*=Math.min(1,t/.0005);
    }
    // DC rejection and short release avoid clicks, including when buffers overlap.
    const dc=sample-previous+.995*(i?data[i-1]:0);previous=sample;data[i]=dc*Math.min(1,(duration-t)/.015);peak=Math.max(peak,Math.abs(data[i]));
  }
  for(let i=0;i<data.length;i++)data[i]*=.85/Math.max(.01,peak);
  soundBuffers.set(key,buffer);return buffer;
}
function playSoundBuffer(type,volume=1,pan=0,distance=0,rate=1){
  if(soundMuted||!audioContext||audioContext.state!=='running')return;
  if(soundVoices.size>=24){const oldest=soundVoices.values().next().value;oldest.stop();soundVoices.delete(oldest)}
  const source=audioContext.createBufferSource(),gain=audioContext.createGain(),filter=audioContext.createBiquadFilter(),stereo=audioContext.createStereoPanner();source.buffer=makeSoundBuffer(type,Math.floor(Math.random()*3));source.playbackRate.value=rate*(.97+Math.random()*.06);gain.gain.value=volume;filter.type='lowpass';filter.frequency.value=Math.max(1400,18000/(1+distance*.13));stereo.pan.value=Math.max(-1,Math.min(1,pan));source.connect(filter);filter.connect(gain);gain.connect(stereo);stereo.connect(audioMaster);soundVoices.add(source);source.onended=()=>{soundVoices.delete(source);source.disconnect();filter.disconnect();gain.disconnect();stereo.disconnect()};source.start();
}
function tone(frequency,duration=.06,gain=.04,type='sine',delay=0,end=frequency){
  if(soundMuted||!audioContext||audioContext.state!=='running')return;
  const start=audioContext.currentTime+delay,osc=audioContext.createOscillator(),volume=audioContext.createGain();osc.type=type;osc.frequency.setValueAtTime(frequency,start);osc.frequency.exponentialRampToValueAtTime(Math.max(20,end),start+duration);volume.gain.setValueAtTime(.001,start);volume.gain.linearRampToValueAtTime(gain,start+.004);volume.gain.exponentialRampToValueAtTime(.001,start+duration);osc.connect(volume);volume.connect(audioMaster||audioContext.destination);osc.start(start);osc.stop(start+duration+.01);osc.onended=()=>{osc.disconnect();volume.disconnect()};
}
function weaponSound(type,tier=0,volume=1,pan=0,distance=0){playSoundBuffer(type,volume*({ar:.58,smg:.43,shotgun:.78,sniper:.8}[type]||.5),pan,distance,tier?.96:1)}
function damageFeedback(d){
  if(!state.matchActive)return;const root=$('damage-numbers'),item=document.createElement('span');item.className='damage-number'+(d.headshot?' headshot':'')+(d.killed?' kill':'');item.textContent=String(Math.round(d.amount));item.style.marginLeft=`${((damageSerial++%3)-1)*28}px`;root.prepend(item);while(root.children?.length>8)root.lastElementChild.remove();setTimeout(()=>item.remove?.(),720);
  tone(d.headshot?1250:760,.055,.035,'sine');if(d.headshot)tone(1680,.065,.025,'sine',.045);
  if(d.killed){$('elimination-name').textContent=d.name||'Opponent';$('elimination-banner').classList.add('show');eliminationUntil=performance.now()+1500;tone(660,.12,.045,'triangle');tone(880,.14,.04,'triangle',.09);tone(1320,.18,.035,'sine',.18)}
}
function markEliminated(id){hitReactions.set(id,{...(hitReactions.get(id)||{}),killed:true,time:performance.now()})}
const SLIDE_DURATION=950,SLIDE_DROP=.78;
function beginSlide(){if(!isPlaying()||!state.onGround||state.climbing!==null||performance.now()<state.slideCooldown||Math.hypot(state.velocityX,state.velocityZ)<7)return;stopEmote();const speed=Math.hypot(state.velocityX,state.velocityZ),boost=Math.max(14,speed*1.10)/speed;state.velocityX*=boost;state.velocityZ*=boost;state.slideUntil=performance.now()+SLIDE_DURATION;state.slideCooldown=performance.now()+1250;tone(130,.18,.025,'triangle',0,45)}
function slideVelocity(vx,vz,wx,wz,age,dt){
  // Glide in the entry direction. Steering bends the path, never snaps/reverses it.
  const speed=Math.hypot(vx,vz)*Math.exp(-(.28+1.35*age*age)*dt);
  let angle=Math.atan2(vz,vx);
  if(wx*wx+wz*wz>.01){const target=Math.atan2(wz,wx),delta=Math.atan2(Math.sin(target-angle),Math.cos(target-angle));angle+=clamp(delta,-.85*dt,.85*dt)}
  return {x:Math.cos(angle)*speed,z:Math.sin(angle)*speed};
}
function movementSpeed(){return state.equipped==='bat'?1.08:WEAPONS[state.selectedWeapon].move||1}
function updateTargetCard(now){
  if(!isPlaying()||state.emoteUntil){$('target-card').classList.remove('visible');return}if(now-targetCheckAt<80)return;targetCheckAt=now;
  const forward=new THREE.Vector3();camera.getWorldDirection(forward);let target=null,best=.965;world.updateMatrixWorld(true);
  for(const p of Object.values(state.players)){if(p.id===state.id||p.alive===false)continue;const point=new THREE.Vector3(p.x,(p.y??1.7)-.35,p.z),delta=point.clone().sub(camera.position),distance=delta.length(),dot=delta.normalize().dot(forward);if(distance<50&&dot>best&&hasClearShot(camera.position,point)){target=p;best=dot}}
  $('target-card').classList.toggle('visible',!!target);if(target){$('target-name').textContent=target.name;$('target-health').style.width=`${clamp(target.health,0,100)}%`;$('target-health').style.background=target.health<30?'#ff826c':'#72ef9c'}
}
function updateFeel(dt,now){
  updateTargetCard(now);if(now>=eliminationUntil)$('elimination-banner').classList.remove('show');
  const reduced=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  $('speed-lines').classList.toggle('active',isPlaying()&&!state.aiming&&!reduced&&Math.hypot(state.velocityX,state.velocityZ)>17);
  const sliding=isPlaying()&&state.slideUntil>now;
  slideView=THREE.MathUtils.lerp(slideView,sliding?SLIDE_DROP:0,1-Math.exp(-(sliding?23:9)*dt));landingKick*=Math.exp(-14*dt);shotShake*=Math.exp(-23*dt);
  const gap=state.selectedWeapon==='shotgun'?1.55:state.selectedWeapon==='smg'?1.15:1;$('crosshair').style.transform=`translate(-50%,-50%) scale(${gap+weaponMotion.kick*.12+localHeat(now)*28})`;
}
function renderGameplay(now){
  const view=gameplayCamera();if(view!==camera||!isPlaying()){renderer.render(scene,view);return}
  const y=camera.position.y,pitch=camera.rotation.x,roll=camera.rotation.z,reduced=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  camera.position.y-=slideView+(reduced?0:landingKick);if(!reduced&&state.aimBlend<.1){camera.rotation.x+=Math.sin(now*.09)*shotShake;camera.rotation.z+=Math.cos(now*.07)*shotShake*.35+slideView/SLIDE_DROP*.035}
  renderer.render(scene,camera);camera.position.y=y;camera.rotation.x=pitch;camera.rotation.z=roll;camera.updateMatrixWorld(true);
}
state.buildHeld=false;state.lastBuildAttempt=-Infinity;state.buildMode=false;state.buildType='wall';state.buildRotation=0;state.builds=[];
const ghostMaterial=new THREE.MeshBasicMaterial({color:0x55efb4,transparent:true,opacity:.35,depthWrite:false});
const weaponMotion={kick:0,walk:0,phase:0,yaw:null,pitch:null,swayX:0,swayY:0,dip:0,aimKick:0,aimWas:false,roll:0,flashSpin:0};
const AIM_PROFILES={
  ar:{fov:58,raise:.20,lower:.14,kick:.052,settle:17,label:'IRON SIGHTS'},
  smg:{fov:64,raise:.13,lower:.11,kick:.035,settle:22,label:'QUICK SIGHTS'},
  shotgun:{fov:68,raise:.24,lower:.16,kick:.09,settle:12,label:'BEAD SIGHT'},
  sniper:{fov:22,raise:.34,lower:.17,kick:.075,settle:10,label:'4× SCOPE'}
};
// Per-gun identity. pitch/yaw: camera punch per shot (rad); recover: return speed once you stop firing;
// bloom: spread added per sustained shot (host-authoritative); back/rise/roll/jitter: viewmodel motion.
const WEAPON_FEEL={
  ar:{pitch:.0075,yaw:.0028,yawBias:.55,recover:6,bloom:.003,bloomMax:.022,heatDecay:1.8,back:.085,rise:1,roll:.025,rollRandom:false,jitter:0,flash:[1.15,1.4],flashMs:42,tracer:[0xffd575,.016,120],remoteKick:.085},
  smg:{pitch:.0032,yaw:.0062,yawBias:0,recover:10,bloom:.0016,bloomMax:.016,heatDecay:2.6,back:.045,rise:.5,roll:.05,rollRandom:true,jitter:.011,flash:[.75,.85],flashMs:28,tracer:[0xff9ec0,.009,85],remoteKick:.05},
  shotgun:{pitch:.06,yaw:.012,yawBias:0,recover:4,bloom:0,bloomMax:0,heatDecay:1,back:.19,rise:1.7,roll:.07,rollRandom:true,jitter:0,flash:[2.4,1.2],flashMs:70,tracer:[0xffa24a,.011,80],thump:62,push:3,remoteKick:.17},
  sniper:{pitch:.085,yaw:.007,yawBias:.35,recover:2.4,bloom:0,bloomMax:0,heatDecay:1,back:.23,rise:1.4,roll:-.045,rollRandom:false,jitter:0,flash:[1,2.9],flashMs:55,tracer:[0x8deaff,.03,320],thump:46,remoteKick:.19}
};
const aimRecoil={target:{x:0,y:0},applied:{x:0,y:0}};
const shotHeat=new Map();
function decayedHeat(id,now,feel){const h=shotHeat.get(id);return h?h.v*Math.exp(-(now-h.t)/1000*feel.heatDecay):0}
function localHeat(now){return (state.localHeat||0)*Math.exp(-(now-(state.localHeatAt||0))/1000*WEAPON_FEEL[state.selectedWeapon].heatDecay)}
function updateAimRecoil(dt,now){
  const feel=WEAPON_FEEL[state.selectedWeapon],w=weaponStats(state.selectedWeapon),t=aimRecoil.target,a=aimRecoil.applied;
  if(now-state.lastShot>Math.min(w.rate*1.25,170)){const k=Math.exp(-feel.recover*dt);t.x*=k;t.y*=k}
  const follow=1-Math.exp(-38*dt),nx=a.x+(t.x-a.x)*follow,ny=a.y+(t.y-a.y)*follow;
  if(isPlaying()){camera.rotation.x=clamp(camera.rotation.x+nx-a.x,-1.45,1.45);camera.rotation.y+=ny-a.y}
  a.x=nx;a.y=ny;
}
function resetAimRecoil(){aimRecoil.target.x=aimRecoil.target.y=aimRecoil.applied.x=aimRecoil.applied.y=0}
let lobbyRenderer,lobbyScene,lobbyCamera,lobbyFighter;
const lobbyFighters=new Map();
const lobbyLook={x:0,y:0};
function trackLobbyPointer(e){if(state.mode!=='home'||e.pointerType==='touch')return;const rect=$('fighter-stage').getBoundingClientRect();lobbyLook.x=clamp((e.clientX-rect.left-rect.width/2)/Math.max(200,innerWidth*.4),-1,1);lobbyLook.y=clamp((e.clientY-rect.top-rect.height*.4)/Math.max(160,innerHeight*.4),-1,1)}
function updateLobbyLook(dt){if(!lobbyFighter)return;const blend=1-Math.exp(-10*dt),now=performance.now(),breath=Math.sin(now*.0022)*.006;lobbyFighter.rotation.y=THREE.MathUtils.lerp(lobbyFighter.rotation.y,-.2+lobbyLook.x*.85,blend);lobbyFighter.position.y=THREE.MathUtils.lerp(lobbyFighter.position.y,breath,blend);const torso=lobbyFighter.userData.avatar?.userData.danceTorso;if(torso){torso.rotation.x=THREE.MathUtils.lerp(torso.rotation.x,-lobbyLook.y*.12+Math.sin(now*.0016)*.008,blend);torso.rotation.y=THREE.MathUtils.lerp(torso.rotation.y,lobbyLook.x*.06,blend)}const gun=lobbyFighter.userData.gun;if(gun){gun.position.y=THREE.MathUtils.lerp(gun.position.y,breath*.8,blend);gun.rotation.z=THREE.MathUtils.lerp(gun.rotation.z,Math.sin(now*.0018)*.006,blend)}}

const weaponLabels={ar:'AR',shotgun:'SHOTGUN',sniper:'SNIPER',smg:'SMG'};
const weaponDescriptions={ar:'Climbs up-right / tap for pinpoint accuracy',shotgun:'10-pellet blast / huge kick + shoves you back',sniper:'Heavy punch / scope for precision',smg:'Jittery spray / +14% movement'};
// Shared sensitivity keeps captured and embedded-browser mouse look consistent.
const LOOK_RADIANS_PER_PIXEL=.00656;
const colliders=[];
const ladders=[];
const shotBlockers=[];
const materials=new Map();
const MAPS={neon:{name:'NEON TOWN',description:'Two houses · vehicle choke · garden flanks',spawns:[[-18,-27],[18,27],[-27,0],[27,0],[-4,-28],[4,28]],pickups:[['case',-22,25],['case',22,-25],['health',0,-20],['health',0,20],['health',-14,0]],sky:0x96cfeb},piazza:{name:'PIAZZA PANIC',description:'Italian plaza · markets · fountain cover',spawns:[[-25,-29],[25,23],[-23,24],[25,-29],[0,30],[0,-30]],pickups:[['case',-30,0],['case',30,0],['health',0,26],['health',0,-26],['health',-22,5]],sky:0x82c9e8},factory:{name:'MIDNIGHT MOZZARELLA',description:'Compact three-floor factory · twin belts · dense machinery cover',spawns:[[-18,-20],[18,20],[-18,20],[18,-20],[0,-22],[0,22]],pickups:[['case',-21.5,0],['case',21.5,0],['health',0,-22],['health',0,22]],sky:0x142b43},surf:{name:'SURF CIRCUIT',description:'Four stages · banked ramps · air-strafe course',spawns:[[0,0]],pickups:[],sky:0x081a2c}};
const RARITIES=[{name:'STANDARD',color:0xb9c5d1,damage:1,rate:1,reload:1},{name:'RARE',color:0x5bbbff,damage:1.06,rate:.97,reload:.96},{name:'EPIC',color:0xcf83ff,damage:1.12,rate:.94,reload:.92},{name:'LEGENDARY',color:0xffce62,damage:1.18,rate:.90,reload:.88}];
const CYBER_NAMES={ar:'Ion Pulse AR',shotgun:'Nova Scattergun',sniper:'Prism Rail Sniper',smg:'Volt Shredder'};
const pickupMeshes=new Map(),mapCache=new Map();let builtMap=null;
const weaponStatsCache=new Map();
function weaponTier(type,arsenal=state.arsenal){return clamp(arsenal?.[type]||0,0,3)|0}
function weaponStats(type,arsenal=state.arsenal){const tier=weaponTier(type,arsenal),key=type+':'+tier;if(!weaponStatsCache.has(key)){const base=WEAPONS[type],r=RARITIES[tier];weaponStatsCache.set(key,{...base,name:tier?CYBER_NAMES[type]:base.name,damage:base.damage*r.damage,rate:base.rate*r.rate,reload:base.reload*r.reload,color:tier?r.color:base.color,spread:base.spread*(tier?(type==='ar'?.55:type==='shotgun'?.82:1):1),pellets:base.pellets+(tier&&type==='shotgun'?2:0),tier})}return weaponStatsCache.get(key)}
function setMap(id){
  if(!Object.hasOwn(MAPS,id))id='neon';state.map=id;$('map-select').value=id;$('map-title').textContent=MAPS[id].name;$('map-description').textContent=MAPS[id].description;
  if(!world||builtMap===id)return;
  syncBuilds([]);if(buildGhost)world.remove(buildGhost);buildGhost=null;state.buildMode=false;
  for(const burst of coffeeBursts)burst.mesh.dispose();if(tracerMesh){tracerMesh.dispose();tracerMesh.geometry.dispose();tracerMesh.material.dispose()}
  world.clear();playerMeshes.clear();hitModels.clear();pickupMeshes.clear();coffeeBursts.length=0;tracerMesh=null;tracerSlots.forEach(s=>s.born=-Infinity);colliders.length=shotBlockers.length=ladders.length=0;state.climbing=null;
  if(mapCache.has(id)){const saved=mapCache.get(id);world.add(...saved.children);colliders.push(...saved.colliders);shotBlockers.push(...saved.blockers);ladders.push(...saved.ladders)}else{if(id==='neon')buildNeonTown({world,colliders,shotBlockers,mat,ladders});else if(id==='factory')buildMozzarellaFactory({world,colliders,shotBlockers,mat,ladders});else if(id==='surf')buildSurfMap({world,colliders,shotBlockers,mat,ladders});else makePlaza();mapCache.set(id,{children:[...world.children],colliders:[...colliders],blockers:[...shotBlockers],ladders:[...ladders]})}
  builtMap=id;
  scene.background.set(MAPS[id].sky||0x82c9e8);scene.fog.color.copy(scene.background);
  const sun=scene.getObjectByName('arena-sun'),ambient=scene.getObjectByName('arena-ambient');if(sun)sun.intensity=id==='factory'?1.3:3.2;if(ambient)ambient.intensity=id==='factory'?1.5:2.2;
  const cached=mapCache.get(id);cached.pickups??=MAPS[id].pickups.map(([kind,x,z])=>{const mesh=createPickupMesh(kind);mesh.position.set(x,0,z);return mesh});cached.pickups.forEach((mesh,i)=>{world.add(mesh);pickupMeshes.set(i,mesh)});
}
function resetPickups(){state.pickups=MAPS[state.map].pickups.map(([kind,x,z],id)=>({id,kind,x,z,readyAt:Date.now()+(kind==='case'?20000:0)}))}
function applyLootAward(d){
  if(!state.matchActive||!Object.hasOwn(WEAPONS,d.weapon))return;
  stopEmote();
  state.arsenal={...d.arsenal};state.selectedWeapon=d.weapon;state.pendingWeapon=d.weapon;state.equipped='gun';state.reloading=false;state.fireHeld=false;resetAim();state.ammo=WEAPONS[d.weapon].mag;
  const me=state.players[state.id];if(me)Object.assign(me,{weapon:d.weapon,nextWeapon:d.weapon,arsenal:{...state.arsenal},equipped:'gun'});
  updateWeaponModel();updateHud();const w=weaponStats(d.weapon),r=RARITIES[w.tier];
  $('loot-notice').textContent=`${r.name} UNLOCK · ${w.name} · +${Math.round((r.damage-1)*100)}% damage`;$('loot-notice').style.color='#'+r.color.toString(16).padStart(6,'0');state.lootNoticeUntil=performance.now()+4200;
}
function updatePickups(now){
  if(!state.matchActive)return;
  if(state.host){
    // The host owns availability, proximity, rarity rolls and health; clients cannot claim rewards.
    for(const item of state.pickups){if(Date.now()<item.readyAt)continue;
      for(const p of Object.values(state.players)){
        if(!p.alive||(p.y??1.7)>2.7||Math.hypot(p.x-item.x,p.z-item.z)>1.35)continue;
        if(item.kind==='health'){
          if(p.health>=100)continue;item.readyAt=Date.now()+35000;p.health=Math.min(100,p.health+35);
          if(p.id===state.id){state.health=p.health;toast('HEALTH RESTORED');updateHud()}else state.connections.get(p.id)?.send({t:'healed',health:p.health});
        }else{
          if(p.bot)continue;
          const roll=Math.random(),tier=roll<.6?1:roll<.9?2:3,types=Object.keys(WEAPONS),available=types.filter(type=>weaponTier(type,p.arsenal)<3);if(!available.length)continue;
          const type=available[Math.floor(Math.random()*available.length)],current=weaponTier(type,p.arsenal);
          p.arsenal={...p.arsenal,[type]:Math.max(tier,current+1)};p.weapon=p.nextWeapon=type;p.equipped='gun';item.readyAt=Date.now()+65000;
          const award={t:'loot',weapon:type,arsenal:p.arsenal};if(p.id===state.id)applyLootAward(award);else state.connections.get(p.id)?.send(award);
          addFeed(`${p.name} found ${RARITIES[p.arsenal[type]].name.toLowerCase()} ${CYBER_NAMES[type]}`);broadcast({t:'event',text:`${p.name} found ${RARITIES[p.arsenal[type]].name.toLowerCase()} ${CYBER_NAMES[type]}`});
        }
        broadcast({t:'pickups',pickups:state.pickups});hostSnapshot();break;
      }
    }
  }
  for(const item of state.pickups){const mesh=pickupMeshes.get(item.id);if(!mesh)continue;mesh.visible=Date.now()>=item.readyAt;if(mesh.visible){mesh.userData.body.position.y=.7+Math.sin(now*.002+item.id)*.10;mesh.userData.body.rotation.y=now*.0007}}
  $('loot-notice').style.opacity=now<state.lootNoticeUntil?'1':'0';
}

function showScreen(id){ screens.forEach(s=>$(s).classList.toggle('active',s===id)); }
function toast(msg){$('toast').textContent=msg;$('toast').classList.add('show');setTimeout(()=>$('toast').classList.remove('show'),1700)}
function safeName(){return ($('player-name').value.trim()||'Mysterious Rot').slice(0,16)}
function roomCode(){const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';return Array.from({length:6},()=>chars[Math.floor(Math.random()*chars.length)]).join('')}

function buildChoices(){
  $('character-list').innerHTML=CHARACTERS.map((c,i)=>`<button class="character ${i===0?'selected':''}" data-char="${c.id}" role="radio" aria-label="${c.name}${i===0?' · Default character':''}" aria-checked="${i===0}"><span class="avatar">${c.portrait?`<img src="${c.portrait}" alt="${c.name}" width="64" height="64">`:c.emoji}</span><small>${c.name}</small>${i===0?'<span class="default-label">DEFAULT</span>':''}</button>`).join('');
  $('weapon-list').innerHTML=Object.entries(WEAPONS).map(([id,w],i)=>`<button class="weapon ${i===0?'selected':''}" data-weapon="${id}" role="radio" aria-label="${w.name}: ${weaponDescriptions[id]}" aria-checked="${i===0}"><span class="weapon-icon" aria-hidden="true">${w.icon}</span><strong>${weaponLabels[id]}</strong></button>`).join('');
  document.querySelectorAll('[data-char]').forEach(b=>b.onclick=()=>{state.selectedChar=b.dataset.char;document.querySelectorAll('[data-char]').forEach(x=>{x.classList.toggle('selected',x===b);x.setAttribute('aria-checked',x===b)});updateLobbyPreview()});
  document.querySelectorAll('[data-weapon]').forEach(b=>b.onclick=()=>{state.selectedWeapon=b.dataset.weapon;document.querySelectorAll('[data-weapon]').forEach(x=>{x.classList.toggle('selected',x===b);x.setAttribute('aria-checked',x===b)});updateLobbyPreview()});
}

function initLobbyPreview(){
  const stage=$('fighter-stage');$('home').addEventListener('pointermove',trackLobbyPointer);$('home').addEventListener('pointerleave',()=>{lobbyLook.x=lobbyLook.y=0});
  lobbyRenderer=new THREE.WebGLRenderer({alpha:true,antialias:true});
  lobbyRenderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
  lobbyRenderer.setClearColor(0x000000,0);stage.appendChild(lobbyRenderer.domElement);
  lobbyScene=new THREE.Scene();lobbyCamera=new THREE.PerspectiveCamera(34,1,.1,30);
  lobbyCamera.position.set(-.15,1.55,-5.8);lobbyCamera.lookAt(0,1.18,0);
  lobbyScene.add(new THREE.HemisphereLight(0xfff7dc,0x416c83,2.8));
  const key=new THREE.DirectionalLight(0xffe6b7,3);key.position.set(-3,5,-4);lobbyScene.add(key);
  const pedestal=new THREE.Mesh(new THREE.CylinderGeometry(.95,1.1,.10,32),mat(0x6babb7));pedestal.position.y=-.08;lobbyScene.add(pedestal);
  new ResizeObserver(()=>{const {width,height}=stage.getBoundingClientRect();if(!width||!height)return;lobbyRenderer.setSize(width,height,false);lobbyCamera.aspect=width/height;lobbyCamera.updateProjectionMatrix()}).observe(stage);
  updateLobbyPreview();
}
function updateLobbyPreview(){
  const c=CHARACTERS.find(c=>c.id===state.selectedChar),w=WEAPONS[state.selectedWeapon];
  $('fighter-name').textContent=c.name;$('loadout-caption').textContent=`${w.name} · ${weaponDescriptions[state.selectedWeapon]}`;
  $('fighter-stage').setAttribute('aria-label',`3D preview of ${c.name} with ${w.name}`);
  if(!lobbyScene)return;
  if(lobbyFighter)lobbyScene.remove(lobbyFighter);
  const key=`${c.id}:${state.selectedWeapon}`;
  if(!lobbyFighters.has(key))lobbyFighters.set(key,createPlayerMesh({id:'preview',char:c.id,weapon:state.selectedWeapon},false));
  lobbyFighter=lobbyFighters.get(key);lobbyFighter.rotation.y=-.35;lobbyScene.add(lobbyFighter);
}

function initWorld(){
  scene=new THREE.Scene();scene.background=new THREE.Color(0x82c9e8);scene.fog=new THREE.Fog(0x92c9dc,55,125);
  camera=new THREE.PerspectiveCamera(76,innerWidth/innerHeight,.08,160);camera.position.set(0,1.7,12);
  renderer=new THREE.WebGLRenderer({canvas:$('game'),antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  controls=new PointerLockControls(camera,$('game'));controls.pointerSpeed=0;camera.rotation.order='YXZ';controls.addEventListener('lock',()=>{state.capturePending=false;state.pointerLockFailed=false;state.mouseX=state.mouseY=null;if(!isPlaying()){controls.unlock();return}$('control-hint').classList.add('hidden');$('capture-mouse').hidden=true});controls.addEventListener('unlock',()=>{if(isPlaying())pauseGame()});
  document.addEventListener('pointerlockerror',useFallbackControls);
  clock=new THREE.Clock();raycaster=new THREE.Raycaster();world=new THREE.Group();scene.add(world);
  const ambient=new THREE.HemisphereLight(0xfff3c4,0x6c645b,2.2);ambient.name='arena-ambient';scene.add(ambient);const sun=new THREE.DirectionalLight(0xfff1cf,3.2);sun.name='arena-sun';sun.position.set(-25,38,20);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-55;sun.shadow.camera.right=55;sun.shadow.camera.top=55;sun.shadow.camera.bottom=-55;scene.add(sun);
  setMap(state.map);makeWeapon();initLobbyPreview();window.addEventListener('resize',resize);animate();
}
function mat(color,rough=.82){const key=`${color}:${rough}`;if(!materials.has(key))materials.set(key,new THREE.MeshStandardMaterial({color,roughness:rough}));return materials.get(key)}
function box(x,y,z,sx,sy,sz,color,collide=true){const m=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),mat(color));m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;world.add(m);shotBlockers.push(m);if(collide)colliders.push({minX:x-sx/2,maxX:x+sx/2,minZ:z-sz/2,maxZ:z+sz/2});return m}
function makePlaza(){
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(110,110),new THREE.MeshStandardMaterial({color:0xd9b878,roughness:1}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;world.add(ground);
  const buildings=[[-42,8,-28,20,16,28,0xf09b68],[-41,10,16,22,20,24,0xe7c079],[-18,8,-45,26,16,18,0xe86b4f],[18,9,-46,30,18,18,0xf0c879],[44,9,-25,18,18,27,0xd87c69],[43,7,18,22,14,25,0xf2a85c],[-23,9,45,28,18,18,0xe9bd72],[20,8,46,28,16,18,0xd46f55]];
  buildings.forEach(([x,y,z,sx,sy,sz,c],i)=>{box(x,y,z,sx,sy,sz,c);box(x,sy+.35,z,sx+1,.7,sz+1,i%2?0x8c3931:0xb64c39,false)});
  [[-12,-10],[14,-13],[-18,15],[19,17]].forEach(([x,z],i)=>{const canopy=box(x,2.7,z,8,.35,5,i%2?0xe74831:0x57c5be,false);for(let n=-1;n<=1;n+=2)box(x+n*3.2,1.3,z+n*.2,.16,2.7,.16,0x4e3329,false)});
  // Fountain and useful cover.
  const basin=new THREE.Mesh(new THREE.CylinderGeometry(5.5,6,1,24),mat(0xe9dfc8));basin.position.set(0,.45,1);basin.castShadow=true;world.add(basin);shotBlockers.push(basin);colliders.push({minX:-5.6,maxX:5.6,minZ:-4.6,maxZ:6.6});
  const water=new THREE.Mesh(new THREE.CylinderGeometry(4.8,4.8,.12,24),new THREE.MeshStandardMaterial({color:0x52bed0,metalness:.1,roughness:.2}));water.position.set(0,1,1);world.add(water);box(0,2.3,1,1.1,3.1,1.1,0xe9dfc8,false);
  [[-26,-18],[25,-23],[-28,27],[29,29],[-10,31],[13,-31]].forEach(([x,z],i)=>{box(x,1.3,z,3.8,2.6,3.8,i%2?0x57c5be:0xe74831);box(x+.8,3,z-.4,2.2,1.5,2.2,0xf2b84b)});
  detailPlaza({world,box,mat,shotBlockers,colliders,buildings});
}
function meleeLabel(char=state.selectedChar){return char==='neegy'?'KNIFE':'WOODEN BAT'}
// Wooden Bonker swings a bat; Neegy carries a knife — same melee slot, different mesh.
function updateMeleeModel(){
  if(!meleeModel)return;
  const knife=state.selectedChar==='neegy';if(meleeModel.userData.knife===knife)return;
  const old=meleeModel.getObjectByName('melee-bat')||meleeModel.getObjectByName('melee-knife');if(old)meleeModel.remove(old);
  meleeModel.add(knife?createMeleeKnife():createMeleeBat());meleeModel.userData.knife=knife;
}
function makeWeapon(){
  weaponModel=new THREE.Group();camera.add(weaponModel);scene.add(camera);
  updateWeaponModel();
  const skin=mat(0xe49b52,.55);
  meleeModel=new THREE.Group();camera.add(meleeModel);updateMeleeModel();
  const fist=new THREE.Mesh(new THREE.SphereGeometry(.065,10,7),skin);fist.name='melee-hand';fist.position.set(0,.16,0);meleeModel.add(fist);meleeModel.visible=false;
}
function updateWeaponModel(){
  updateMeleeModel();
  const w=weaponStats(state.selectedWeapon),key=state.selectedWeapon+':'+w.tier;
  if(weaponModel.userData.key!==key){
    if(!weaponRigs.has(key))weaponRigs.set(key,createFirstPersonWeapon(w.color,state.selectedWeapon,w.tier));
    weaponModel.clear();weaponModel.add(weaponRigs.get(key));weaponModel.userData.type=state.selectedWeapon;weaponModel.userData.key=key;weaponModel.userData.rig=weaponRigs.get(key);
  }
  const goldHands=state.selectedChar==='neegy',color=goldHands?0xe5ac24:0xd8954d;
  for(const name of ['trigger','support'])weaponModel.userData.rig.userData[name].traverse(m=>{if(m.isMesh){m.material.color.set(color);m.material.metalness=goldHands?.55:0;m.material.roughness=goldHands?.32:.56}});
  const fist=meleeModel?.getObjectByName('melee-hand');if(fist){fist.material.color.set(color);fist.material.metalness=goldHands?.55:0;fist.material.roughness=goldHands?.32:.56}
  $('weapon-name').textContent=state.equipped==='bat'?meleeLabel():w.name.toUpperCase();$('ammo').textContent=state.ammo;$('reserve').textContent='∞';
  $('weapon-rarity').textContent=state.equipped==='bat'?'':w.tier?`${RARITIES[w.tier].name} · +${Math.round((RARITIES[w.tier].damage-1)*100)}% DAMAGE`:'STANDARD';$('weapon-rarity').style.color='#'+RARITIES[w.tier].color.toString(16).padStart(6,'0');
}

function createPlayerMesh(p,register=true,collisionOnly=false){
  const c=CHARACTERS.find(x=>x.id===p.char)||CHARACTERS[0],g=new THREE.Group();g.userData.playerId=p.id;
  if(c.shape==='wooden'||c.shape==='neegy'){
    const avatar=(c.shape==='neegy'?createNeegyCharacter:createWoodenCharacter)(register||collisionOnly?'game':'preview');g.add(avatar);g.userData.avatar=avatar;
    const torso=new THREE.Group();torso.position.y=.75;torso.name='dance-torso';
    for(const part of [...avatar.children])if(!avatar.userData.legs.includes(part)){part.position.y-=.75;torso.add(part)}
    avatar.add(torso);avatar.userData.danceTorso=torso;
  }else{
  const body=new THREE.Mesh(new THREE.CapsuleGeometry(.52,.9,5,9),mat(c.color));body.position.y=1.05;body.castShadow=true;body.userData.playerId=p.id;g.add(body);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.52,14,10),mat(c.color));head.position.y=2.05;head.castShadow=true;head.userData.playerId=p.id;g.add(head);
  const eyeMat=new THREE.MeshBasicMaterial({color:0x191218});[-.2,.2].forEach(x=>{const e=new THREE.Mesh(new THREE.SphereGeometry(.065,8,6),eyeMat);e.position.set(x,2.12,-.48);g.add(e)});
  }
  const tier=weaponTier(p.weapon,p.arsenal||{}),gun=createHeldGun(tier?RARITIES[tier].color:WEAPONS[p.weapon]?.color||0x333333,p.weapon||'ar',!register&&!collisionOnly,tier);g.add(gun);
  const bat=c.shape==='neegy'?createMeleeKnife():createMeleeBat();bat.visible=false;
  if(g.userData.avatar){const grip=g.userData.avatar.getObjectByName('trigger-hand');grip.add(bat);bat.position.y=-.13;bat.rotation.x=-.25}else{g.add(bat);bat.position.set(.35,1.25,-.45)}
  g.userData.bat=bat;g.traverse(m=>{if(m.isMesh)m.userData.playerId=p.id});
  g.userData.gun=gun;g.userData.weaponType=p.weapon;g.userData.weaponTier=tier;
if(register){const color=new THREE.Color().setHSL(((String(p.id).split('').reduce((n,c)=>n+c.charCodeAt(0),0)*47)%360)/360,.8,.62),halo=new THREE.Mesh(new THREE.RingGeometry(.58,.68,24),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.8,side:THREE.DoubleSide,depthWrite:false}));halo.rotation.x=-Math.PI/2;halo.position.y=.025;halo.userData.noHit=true;g.add(halo);g.userData.halo=halo;const band=new THREE.Mesh(new THREE.TorusGeometry(c.shape==='neegy'?.235:c.shape==='wooden'?.30:.54,.045,5,16),new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:.35,roughness:.5}));band.rotation.x=Math.PI/2;band.position.y=1.12;band.userData.noHit=true;(g.userData.avatar?.userData.danceTorso||g).add(band);if(g.userData.avatar)band.position.y-=.75}
  if(register){const tag=document.createElement('div');tag.className='name-tag';g.userData.tag=tag;world.add(g);playerMeshes.set(p.id,g)}return g;
}
// Bound animation cadence, never player velocity: fast bhops remain uncapped.
function strideAdvance(speed,dt){return Math.min(16,Math.max(0,speed)*2.6)*Math.max(0,dt)}
function syncMeshes(dt=1/60){
  const now=performance.now(),blend=1-Math.exp(-13*dt),poseBlend=1-Math.exp(-18*dt);
  const damp=(value,target,rate=18)=>THREE.MathUtils.lerp(value,target,1-Math.exp(-rate*dt));
  Object.values(state.players).forEach(p=>{
    if(p.id===state.id)return;const m=playerMeshes.get(p.id)||createPlayerMesh(p),u=m.userData,reaction=p.alive!==false&&hitReactions.get(p.id)?.killed?null:hitReactions.get(p.id),deathAge=reaction?.killed?now-reaction.time:Infinity;m.visible=p.alive!==false||deathAge<650;
    const tier=weaponTier(p.weapon,p.arsenal||{});if(WEAPONS[p.weapon]&&(u.weaponType!==p.weapon||u.weaponTier!==tier)){m.remove(u.gun);u.gun=createHeldGun(tier?RARITIES[tier].color:WEAPONS[p.weapon].color,p.weapon,false,tier);u.gun.traverse(part=>{if(part.isMesh)part.userData.playerId=p.id});m.add(u.gun);u.weaponType=p.weapon;u.weaponTier=tier}
    const x=p.x||0,z=p.z||0,dx=x-m.position.x,dz=z-m.position.z,teleport=!u.initialized||Math.hypot(dx,dz)>12;
    const distance=teleport?0:Math.hypot(dx,dz)*blend,y=Math.max(0,(p.y??1.7)-1.7);
    m.position.x=teleport?x:m.position.x+dx*blend;m.position.z=teleport?z:m.position.z+dz*blend;m.position.y=teleport?y:THREE.MathUtils.lerp(m.position.y,y,blend);
    const yaw=p.yaw||0,turn=Math.atan2(Math.sin(yaw-m.rotation.y),Math.cos(yaw-m.rotation.y));m.rotation.y+=teleport?turn:turn*blend;u.initialized=true;
    const speed=distance/Math.max(.001,dt);u.speed=damp(u.speed||0,speed,10);u.walk=damp(u.walk||0,Math.min(1,u.speed/5),11);u.air=damp(u.air||0,p.grounded===false?1:0,13);u.slide=damp(u.slide||0,p.sliding&&p.grounded!==false?1:0,p.sliding?19:11);
    if(teleport){u.speed=0;u.walk=0;u.landAt=-Infinity;u.wasGround=p.grounded}
    u.stride=((u.stride||0)+strideAdvance(u.speed,dt)*(1-u.air)*(1-u.slide))%(Math.PI*2);
    const avatar=u.avatar,elapsed=now-(meleeVisuals.get(p.id)??-Infinity),swing=elapsed>=0&&elapsed<MELEE.duration&&p.alive!==false;
    const holding=p.equipped==='bat';u.gun.visible=!swing&&!holding;u.bat.visible=swing||holding;
    const flinch=reaction?Math.max(0,1-(now-reaction.time)/380):0,deathT=reaction?.killed?smoothStep(Math.min(1,deathAge/650)):0;
    const sideSpeed=teleport?0:(dx*Math.cos(yaw)-dz*Math.sin(yaw))*blend/Math.max(dt,.001),turnLean=clamp(turn*.35,-.055,.055)*u.walk,moveLean=clamp(sideSpeed*.006,-.06,.06),hitPitch=-Math.sin(flinch*Math.PI)*(reaction?.headshot?.16:.07);
    m.rotation.x=damp(m.rotation.x,reaction?.killed?Math.PI/2*deathT:hitPitch,reaction?.killed?10:22);m.rotation.z=damp(m.rotation.z,reaction?.killed?0:Math.sin(flinch*Math.PI)*.045-turnLean-moveLean,15);
    if(reaction?.killed)m.position.y=y-.6*deathT;
    if(u.wasGround===false&&p.grounded!==false)u.landAt=now;u.wasGround=p.grounded;
    const landAge=now-(u.landAt??-Infinity),landing=landAge<260?Math.sin(Math.min(1,landAge/260)*Math.PI):0,slide=u.slide;
    m.scale.y=damp(m.scale.y,1-landing*.025,16);if(u.halo)u.halo.visible=p.alive!==false;
    // Breathing, recoil and footfalls use damped values so low-rate network snapshots never pop.
    const step=Math.sin(u.stride),gait=u.walk*(1-u.air)*(1-slide),lift=Math.sin(now*.002+p.id.length)*.006+(1-Math.cos(u.stride*2))*.009*gait-landing*.055;
    const shotAge=now-(remoteShotTimes.get(p.id)??-Infinity),recoil=shotAge<220?Math.sin(Math.min(1,shotAge/220)*Math.PI)*(WEAPON_FEEL[p.weapon]?.remoteKick??.085):0;
    if(p.reloading&&!u.wasReloading)u.reloadAt=now;u.wasReloading=!!p.reloading;const reloadT=p.reloading?(now-(u.reloadAt||now))/900:0,reloadDip=p.reloading?Math.sin(Math.min(1,reloadT)*Math.PI):0;
    u.gun.position.y=damp(u.gun.position.y,lift-reloadDip*.05-slide*.62,22);u.gun.rotation.x=damp(u.gun.rotation.x,p.reloading?-.38:slide*.08,14);u.gun.rotation.z=damp(u.gun.rotation.z,p.reloading?-.10:slide*.13,14);u.gun.position.z=damp(u.gun.position.z,recoil+slide*.10,28);
    if(!u.gun.userData.flash){const flash=new THREE.Mesh(new THREE.ConeGeometry(.10,.22,5),new THREE.MeshBasicMaterial({color:tier?RARITIES[tier].color:0xffd875,transparent:true,opacity:.85,depthWrite:false}));flash.rotation.x=-Math.PI/2;flash.position.z=-.07;flash.userData.noHit=true;u.gun.userData.muzzle.add(flash);u.gun.userData.flash=flash}u.gun.userData.flash.visible=now-(remoteShotTimes.get(p.id)??-Infinity)<65&&p.alive!==false;
    if(avatar){avatar.position.y=damp(avatar.position.y,lift-slide*.64,20);
      const torso=avatar.userData.danceTorso,emoting=p.emoteUntil>Date.now();if(torso&&!emoting){torso.position.x=damp(torso.position.x,step*.008*gait,12);torso.position.y=damp(torso.position.y,.75-slide*.04,16);torso.position.z=damp(torso.position.z,slide*.09,16);torso.rotation.x=damp(torso.rotation.x,slide*.30-landing*.055-.035*gait,16);torso.rotation.y=damp(torso.rotation.y,step*.012*gait*(p.aiming?.25:1),12);torso.rotation.z=damp(torso.rotation.z,-step*.012*gait+slide*.045,12)}
      avatar.userData.legs.forEach((leg,i)=>{const phase=u.stride+i*Math.PI,walkX=Math.sin(phase)*.58*u.walk*(1-u.air)*(1-slide),airX=(-.30+(i?-.08:.04))*u.air,targetX=walkX+airX+landing*(i?-.12:.12)+slide*(i?1.28:1.40);leg.rotation.x=damp(leg.rotation.x,targetX,20);leg.rotation.z=damp(leg.rotation.z,u.air*(i?-.13:.13)+landing*(i?-.045:.045)+slide*(i?-.16:.12),18)});
      avatar.userData.arms.forEach((arm,i)=>{const arc=swing?Math.sin(Math.min(1,elapsed/MELEE.duration)*Math.PI):0,walkArm=Math.sin(u.stride+i*Math.PI)*.045*u.walk*(1-slide);let targetX=walkArm,targetZ=0;if(swing){targetX=i===1?-1.05+arc*1.95:.38-arc*.16;targetZ=i===1?-.52*arc:.08*arc}else if(holding){targetX=i===1?-.50:.30}else if(p.reloading){targetX=i===1?-.34+reloadDip*.18:.62-reloadDip*.2;targetZ=i===1?-.10*reloadDip:.08*reloadDip}else if(p.aiming){targetX=i===1?-.035:.03}targetX-=slide*.24;targetZ+=slide*(i?-.025:.025);arm.rotation.x=THREE.MathUtils.lerp(arm.rotation.x,targetX,poseBlend);arm.rotation.z=THREE.MathUtils.lerp(arm.rotation.z,targetZ,poseBlend)});
    }
    poseEmote(m,p);
  });
  for(const [id,m] of playerMeshes)if(!state.players[id]){world.remove(m);playerMeshes.delete(id)}
}

function myPublic(){return{id:state.id,name:safeName(),char:state.selectedChar,weapon:state.selectedWeapon,nextWeapon:state.pendingWeapon,arsenal:{...state.arsenal},equipped:state.equipped,aiming:state.aimBlend>.55,grounded:state.onGround,reloading:state.reloading,sliding:state.slideUntil>performance.now(),emoteUntil:state.emoteUntil,x:camera.position.x,y:camera.position.y,z:camera.position.z,yaw:state.emoteUntil>Date.now()?state.emoteYaw:camera.rotation.y,pitch:camera.rotation.x,health:state.health,kills:state.kills,deaths:state.deaths,alive:state.alive,respawnAt:state.respawnAt}}
function seedSelf(){state.players[state.id]=myPublic();}
function broadcast(msg){if(!state.host)return;state.connections.forEach(c=>{if(c.open)c.send(msg)})}
function sendHost(msg){if(state.host)handleHostMessage(msg,state.id);else if(state.conn?.open)state.conn.send(msg)}
function hostSnapshot(){state.players[state.id]=myPublic();broadcast({t:'snapshot',players:state.players,end:state.matchEnd,active:state.matchActive,map:state.map,pickups:state.pickups,builds:state.builds})}

function createRoom(){
  state.host=true;state.practice=false;state.room=roomCode();state.id='host';resetPeer();setError('');
  const peerId=`rot-royale-${state.room.toLowerCase()}`;state.peer=new Peer(peerId);
  state.peer.on('open',()=>{state.id=peerId;state.players={};seedSelf();enterLobby();state.peer.on('connection',acceptConnection)});
  state.peer.on('error',peerError);
}
function joinRoom(){
  const code=$('room-code-input').value.trim().toUpperCase();if(code.length!==6){setError('Enter the 6-character room code.');return}
  state.host=false;state.practice=false;state.room=code;resetPeer();setError('Connecting to the plaza…');state.peer=new Peer();
  state.peer.on('open',id=>{state.id=id;const c=state.peer.connect(`rot-royale-${code.toLowerCase()}`,{reliable:true,metadata:{name:safeName(),char:state.selectedChar,weapon:state.selectedWeapon}});state.conn=c;wireClient(c);setTimeout(()=>{if(state.mode==='home'&&$('connection-error').textContent.includes('Connecting'))leaveToHome('Could not reach that room. Check that the host is still in the lobby.')},9000)});state.peer.on('error',peerError);
}
function acceptConnection(c){
  if(Object.keys(state.players).length>=6){c.on('open',()=>{c.send({t:'reject',reason:'That room is full.'});setTimeout(()=>c.close(),100)});return}
  c.on('open',()=>{const requestedChar=c.metadata?.char,char=CHARACTERS.some(x=>x.id===requestedChar)?requestedChar:'wooden';state.connections.set(c.peer,c);state.players[c.peer]={id:c.peer,name:(c.metadata?.name||'New Rot').slice(0,16),char,weapon:Object.hasOwn(WEAPONS,c.metadata?.weapon)?c.metadata.weapon:'ar',...spawnFor(state.connections.size),kills:0,deaths:0,health:100,alive:true,arsenal:{}};c.send({t:'welcome',id:c.peer,room:state.room,players:state.players,host:state.id,map:state.map});hostSnapshot();updateLobby()});
  c.on('data',d=>handleHostMessage(d,c.peer));c.on('close',()=>{state.connections.delete(c.peer);delete state.players[c.peer];broadcast({t:'snapshot',players:state.players,end:state.matchEnd,active:state.matchActive});updateLobby()});
}
function wireClient(c){c.on('open',()=>setError(''));c.on('data',d=>handleClientMessage(d));c.on('close',()=>leaveToHome('The host closed the room.'));c.on('error',peerError)}
function handleHostMessage(d,from){
  if(!d||typeof d.t!=='string')return;
  if(d.t==='emote'&&state.players[from]){const p=state.players[from];if(d.active&&(!state.matchActive||!p.alive))return;p.emoteUntil=d.active?Date.now()+EMOTE_DURATION:0;if(d.active)p.equipped='bat';broadcast({t:'emote',id:from,until:p.emoteUntil});if(from===state.id)state.emoteUntil=p.emoteUntil}
  if(d.t==='build')placeBuild(from,d);
  if(d.t==='state'&&state.players[from]){const p=state.players[from];p.x=clamp(d.x,-34,34);p.z=clamp(d.z,-35,35);p.y=clamp(d.y??1.7,1.7,64);p.yaw=Number.isFinite(d.yaw)?d.yaw:0;p.pitch=clamp(d.pitch??0,-1.45,1.45);p.equipped=d.equipped==='bat'?'bat':'gun';p.aiming=!!d.aiming;p.grounded=d.grounded!==false;p.reloading=!!d.reloading;p.sliding=!!d.sliding}
  if(d.t==='shot')resolveShot(from);
  if(d.t==='loadout'&&state.matchActive&&state.players[from]?.alive===false&&Object.hasOwn(WEAPONS,d.weapon))state.players[from].nextWeapon=d.weapon;
  if(d.t==='melee')resolveMelee(from);
  if(d.t==='ready')updateLobby();
}
function handleClientMessage(d){
  if(!d)return;
  if(d.t==='emote'){if(state.players[d.id])state.players[d.id].emoteUntil=d.until;if(d.id===state.id&&state.emoteUntil)state.emoteUntil=d.until}
  if(d.t==='builds')syncBuilds(d.builds||[]);
  if(d.t==='buildError')toast(d.message);
  if(d.t==='welcome'){state.players=d.players;if(d.map)setMap(d.map);enterLobby()}
  if(d.t==='snapshot'){state.players=d.players||{};state.matchEnd=d.end||0;if(d.map)setMap(d.map);if(d.pickups)state.pickups=d.pickups;if(d.active&&!state.matchActive)beginMatch(false);if(d.builds)syncBuilds(d.builds);syncLocalFromSnapshot()}
  if(d.t==='start'){state.matchEnd=d.end;state.players=d.players;if(d.map)setMap(d.map);state.pickups=d.pickups||[];beginMatch(false)}
  if(d.t==='pickups')state.pickups=d.pickups||[];
  if(d.t==='loot')applyLootAward(d);
  if(d.t==='healed'&&state.matchActive&&state.alive){state.health=clamp(d.health,0,100);if(state.players[state.id])state.players[state.id].health=state.health;toast('HEALTH RESTORED');updateHud()}
  if(d.t==='event'){addFeed(d.text);if(d.killed)markEliminated(d.victim);if(d.victim===state.id)takeDamageResult(d)}
  if(d.t==='damageDealt'&&d.id===state.id)damageFeedback(d);
  if(d.t==='meleeSwing'&&d.id!==state.id)meleeVisuals.set(d.id,performance.now());
  if(d.t==='meleeHit'&&d.id===state.id)showHitmarker();
  if(d.t==='shotResult'&&d.id===state.id)showShotFeedback(!!d.headshot);
  if(d.t==='impact')showImpact(d);
  if(d.t==='tracers')showTracers(d);
  if(d.t==='respawn'&&d.id===state.id)doRespawn(d.x,d.z,d.weapon)
  if(d.t==='end')finishMatch(d.players)
  if(d.t==='lobby'){state.matchActive=false;state.players=d.players;enterLobby()}
  if(d.t==='reject')leaveToHome(d.reason)
}
function syncLocalFromSnapshot(){
  const me=state.players[state.id];if(!me)return;state.kills=me.kills||0;state.deaths=me.deaths||0;
  if(state.matchActive){const changed=Object.keys(WEAPONS).some(type=>weaponTier(type,me.arsenal||{})>weaponTier(type));state.arsenal={...me.arsenal};if(changed&&me.alive&&state.alive)applyLootAward({weapon:me.weapon,arsenal:me.arsenal});if(!state.alive&&changed)renderRespawnLoadout()}
  if(state.matchActive&&me.alive===false&&state.alive)takeDamageResult({killed:true,respawnAt:me.respawnAt});
  else if(state.matchActive&&me.alive===true&&!state.alive)doRespawn(me.x,me.z,me.weapon);
  else state.health=me.health??state.health;
  updateHud();
}
function peerError(err){const msg=err.type==='peer-unavailable'?'Room not found. Check the code and try again.':'Connection trouble. Try creating or joining the room again.';leaveToHome(msg)}
function resetPeer(){if(state.peer&&!state.peer.destroyed)state.peer.destroy();state.peer=null;state.conn=null;state.connections.clear()}
function setError(s){$('connection-error').textContent=s}

function enterLobby(){state.mode='lobby';showScreen('lobby');$('room-code').textContent=state.room;$('lobby-title').textContent=MAPS[state.map].name+' lobby';updateLobby()}
function updateLobby(){
  const ps=Object.values(state.players);$('player-list').innerHTML=ps.map((p,i)=>{const c=CHARACTERS.find(c=>c.id===p.char)||CHARACTERS[0];return `<div class="player-pill"><span class="dot"></span><strong>${escapeHtml(p.name)}</strong><span>${c.portrait?`<img class="lobby-portrait" src="${c.portrait}" alt="${c.name}">`:c.emoji}</span><small>${i===0?'HOST':WEAPONS[p.weapon]?.name||'PLAYER'}</small></div>`}).join('');
  $('start-match').style.display=state.host?'block':'none';if(state.host){$('start-match').disabled=ps.length<2&&!state.practice;$('start-match').textContent=ps.length<2?'Waiting for another player…':`Start match · ${ps.length} players`}
}
function startMatch(){
  if(!state.host)return;
  state.matchEnd=state.map==='surf'?Infinity:Date.now()+180000;state.arsenal={};
  const slots=MAPS[state.map].spawns.map((_,i)=>i);for(let i=slots.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[slots[i],slots[j]]=[slots[j],slots[i]]}
  Object.values(state.players).forEach((p,i)=>Object.assign(p,{kills:0,deaths:0,health:100,alive:true,arsenal:{},nextWeapon:p.weapon,...(state.map==='surf'?{x:SURF_SPAWN[0],y:SURF_SPAWN[1],z:SURF_SPAWN[2]}:spawnFor(slots[i%slots.length]))}));
  resetPickups();broadcast({t:'start',end:state.matchEnd,players:state.players,map:state.map,pickups:state.pickups});beginMatch(true)
}
function beginMatch(asHost){
  stopEmote(false);
  syncBuilds([]);state.buildMode=false;buildCooldowns.clear();
  state.climbing=null;
  state.arsenal={...state.players[state.id]?.arsenal};if(Object.hasOwn(WEAPONS,state.players[state.id]?.weapon))state.selectedWeapon=state.players[state.id].weapon;state.lootNoticeUntil=0;
  state.velocityX=state.velocityZ=state.hopChain=0;state.onRamp=false;state.pendingWeapon=state.selectedWeapon;
  state.meleeStart=state.lastMelee=-Infinity;meleeCooldowns.clear();meleeVisuals.clear();shotCooldowns.clear();shotHeat.clear();hitModels.clear();hitReactions.clear();state.equipped=state.map==='surf'?'bat':'gun';state.headshotAt=-Infinity;state.respawnAt=0;state.fireHeld=false;resetAim();$('respawn').classList.remove('active');
  state.switchStart=state.inspectStart=-Infinity;state.switchPending=null;state.switchSwapped=false;weaponMotion.dip=weaponMotion.aimKick=0;
  state.matchActive=true;state.mode='game';state.health=100;state.kills=0;state.deaths=0;state.alive=true;const w=WEAPONS[state.selectedWeapon];state.ammo=w.mag;state.reserve=Infinity;state.reloading=false;
  if(state.map==='surf'){state.surfStart=Date.now();state.surfCheckpoint=0}
  const me=state.players[state.id];if(me){camera.position.set(me.x||0,me.y||1.7,me.z||12)}else camera.position.set(0,1.7,12);
  state.keys={};state.velocityY=0;state.onGround=true;if(state.map==='surf')camera.lookAt(-3,SURF_SPAWN[1]-12,SURF_SPAWN[2]+30);else camera.lookAt(0,1.7,1);showScreen(null);focusGame();$('hud').classList.add('active');$('control-hint').classList.remove('hidden');updateWeaponModel();updateHud();requestMouseCapture();if(asHost)hostSnapshot();
}
function practice(){
  state.practice=true;state.host=true;state.room='SOLO';state.id='solo';state.players={};seedSelf();
  if(state.map==='surf'){startMatch();return}
  botBrains.clear();const botWeapons=Object.keys(WEAPONS);for(let i=botWeapons.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[botWeapons[i],botWeapons[j]]=[botWeapons[j],botWeapons[i]]}for(let i=0;i<3;i++){const id=`bot${i}`;state.players[id]={id,name:['Bonker Bot','Neegy.exe','Caffè Hunter'][i],char:CHARACTERS[i%2].id,weapon:botWeapons[i],kills:0,deaths:0,health:100,alive:true,...spawnFor(i+1),bot:true}}startMatch()
}

function resetSurfRun(full=false,announce=true){
  if(state.map!=='surf')return;
  const checkpoint=!full&&state.surfCheckpoint>0?SURF_CHECKPOINTS[state.surfCheckpoint-1]:null;
  const spawn=checkpoint?.spawn||SURF_SPAWN;
  camera.position.set(...spawn);camera.rotation.set(0,Math.PI,0);
  state.velocityX=state.velocityY=state.velocityZ=0;state.onGround=true;state.onRamp=false;state.jumpQueued=false;state.hopChain=0;state.keys={};
  if(full){state.surfCheckpoint=0;state.surfStart=Date.now();if(announce)toast('Surf run restarted')}
  else if(announce)toast(checkpoint?`Stage ${state.surfCheckpoint+1} checkpoint`:'Back to start');
}

function applyHit(shooterId,targetId,damage,headshot=false){
  const target=state.players[targetId],shooter=state.players[shooterId];if(!target||!shooter||!target.alive)return;const oldHealth=target.health;target.health=Math.max(0,target.health-Math.min(100,Math.max(1,damage||1)));
  const killed=target.health<=0,feedback={t:'damageDealt',id:shooterId,amount:oldHealth-target.health,headshot,killed,name:target.name};if(shooterId===state.id)damageFeedback(feedback);else state.connections.get(shooterId)?.send(feedback);
  if(killed){
    markEliminated(targetId);target.alive=false;target.respawnAt=Date.now()+3000;target.deaths=(target.deaths||0)+1;shooter.kills=(shooter.kills||0)+1;
    if(shooterId===state.id)state.kills=shooter.kills;if(targetId===state.id)state.deaths=target.deaths;
    const text=headshot?`${shooter.name} headshot ${target.name} ☕`:`${shooter.name} spilled ${target.name}'s coffee`;
    broadcast({t:'event',text,victim:targetId,killer:shooterId,killed:true,headshot,respawnAt:target.respawnAt});addFeed(text);if(targetId===state.id)takeDamageResult({killed:true,respawnAt:target.respawnAt});
    // Snapshots replace player objects. Resolve by stable ID, round and death number instead.
    const roundEnd=state.matchEnd,deathNumber=target.deaths;
    setTimeout(()=>{
      const current=state.players[targetId];
      if(!state.host||!state.matchActive||state.matchEnd!==roundEnd||!current||current.alive!==false||current.deaths!==deathNumber)return;
      const weapon=Object.hasOwn(WEAPONS,current.nextWeapon)?current.nextWeapon:current.weapon;
      Object.assign(current,{health:100,alive:true,respawnAt:0,y:1.7,weapon,equipped:'gun',...spawnFor(Math.floor(Math.random()*6))});
      if(targetId===state.id)doRespawn(current.x,current.z,weapon);else state.connections.get(targetId)?.send({t:'respawn',id:targetId,x:current.x,z:current.z,weapon});hostSnapshot();
    },3000);
  }else{
    state.connections.get(targetId)?.send({t:'event',text:'',victim:targetId,killer:shooterId,damage:true,health:target.health});
    if(targetId===state.id){state.health=target.health;flashDamage()}
  }
  hostSnapshot();
}
function takeDamageResult(d){
  if(!state.matchActive)return;const me=state.players[state.id];
  if(d.killed){
    if(!state.alive)return;state.alive=false;state.health=0;state.respawnAt=Number.isFinite(d.respawnAt)&&d.respawnAt>0?d.respawnAt:Date.now()+3000;state.reloading=false;clearInput();
    if(me)Object.assign(me,{health:0,alive:false,respawnAt:state.respawnAt});
    state.pendingWeapon=state.selectedWeapon;if(me)me.nextWeapon=state.pendingWeapon;renderRespawnLoadout();
    $('respawn').classList.add('active');updateRespawnCountdown();controls.unlock();updateCursor();
  }else{state.health=d.health??me?.health??state.health;if(me)me.health=state.health;flashDamage()}
  updateHud();
}
function updateRespawnCountdown(){if(state.matchActive&&!state.alive)$('respawn-time').textContent=Math.max(0,Math.ceil((state.respawnAt-Date.now())/1000))}
function renderRespawnLoadout(){
  $('respawn-weapons').innerHTML=Object.keys(WEAPONS).map((id,i)=>{const w=weaponStats(id);return `<button type="button" data-respawn-weapon="${id}" aria-pressed="${state.pendingWeapon===id}" class="respawn-weapon ${state.pendingWeapon===id?'selected':''}"><kbd>${i+1} · ${RARITIES[w.tier].name}</kbd><strong>${weaponLabels[id]}</strong><small>${w.name}</small></button>`}).join('');
  $('respawn-loadout-note').textContent=`Next spawn: ${weaponStats(state.pendingWeapon).name} · unlocks last this match`;
}
function chooseRespawnWeapon(weapon){
  if(!state.matchActive||state.alive||!Object.hasOwn(WEAPONS,weapon))return;
  state.pendingWeapon=weapon;renderRespawnLoadout();sendHost({t:'loadout',weapon});
}
function doRespawn(x,z,weapon=state.players[state.id]?.weapon){
  if(!state.matchActive)return;if(Object.hasOwn(WEAPONS,weapon))state.selectedWeapon=weapon;state.pendingWeapon=state.selectedWeapon;state.equipped='gun';
  if(!state.matchActive)return;state.alive=true;state.health=100;state.respawnAt=0;state.reloading=false;state.ammo=WEAPONS[state.selectedWeapon].mag;
  camera.position.set(x??0,1.7,z??12);state.velocityY=0;state.onGround=true;clearInput();
  // Update both stores before HUD/snapshot reads can put the old zero health back.
  const me=state.players[state.id];if(me)Object.assign(me,{health:100,alive:true,respawnAt:0,weapon:state.selectedWeapon,nextWeapon:state.selectedWeapon,equipped:'gun',x:camera.position.x,y:1.7,z:camera.position.z});
  $('respawn').classList.remove('active');updateWeaponModel();updateHud();updateCursor();if(isPlaying()){focusGame();requestMouseCapture()}
}
function flashDamage(){$('damage-flash').classList.add('show');setTimeout(()=>$('damage-flash').classList.remove('show'),190)}

function shoot(){
  stopEmote();
  if(state.buildMode||state.map==='surf')return;
  if(!isPlaying()||state.equipped==='bat'||state.reloading||performance.now()-state.meleeStart<MELEE.duration||performance.now()-state.switchStart<SWITCH_DURATION||performance.now()-state.inspectStart<INSPECT_DURATION)return;const w=weaponStats(state.selectedWeapon),now=performance.now();if(now-state.lastShot<w.rate)return;if(state.ammo<=0){reload();return}state.lastShot=now;state.ammo--;updateHud();weaponMotion.kick=Math.min(1.4,weaponMotion.kick+({ar:.65,shotgun:1.3,sniper:1.1,smg:.45}[state.selectedWeapon]));
  weaponSound(state.selectedWeapon,w.tier);shotShake=Math.min(.008,shotShake+({ar:.002,smg:.0015,shotgun:.008,sniper:.006}[state.selectedWeapon]));publishCombatPose();sendHost({t:'shot'});
  // Recoil lands after the pose is published, so this shot goes where you aimed and the next one climbs.
  const feel=WEAPON_FEEL[state.selectedWeapon],steady=1-.35*state.aimBlend,vary=.85+Math.random()*.3;
  aimRecoil.target.x+=feel.pitch*steady*vary;aimRecoil.target.y-=(feel.yawBias+(Math.random()-.5)*2)*feel.yaw*steady;
  weaponMotion.roll+=feel.roll*(feel.rollRandom&&Math.random()<.5?-1:1);weaponMotion.flashSpin=Math.random()*Math.PI*2;
  state.localHeat=Math.min(feel.bloomMax,localHeat(now)+feel.bloom);state.localHeatAt=now;
  if(feel.thump)tone(feel.thump,.2,.06,'sine',0,feel.thump*.45);
  if(feel.push){const f=new THREE.Vector3();camera.getWorldDirection(f);f.y=0;if(f.lengthSq()>1e-6){f.normalize();const push=feel.push*(state.onGround?1:1.5);state.velocityX-=f.x*push;state.velocityZ-=f.z*push}}
}
function updateAutomaticFire(){if(state.fireHeld&&WEAPONS[state.selectedWeapon].automatic)shoot()}
function publishCombatPose(){const p=myPublic();if(state.host)state.players[state.id]=p;else sendHost({t:'state',x:p.x,y:p.y,z:p.z,yaw:p.yaw,pitch:p.pitch,equipped:p.equipped,aiming:p.aiming,grounded:p.grounded,reloading:p.reloading,sliding:p.sliding})}
// The host raycasts the actual character geometry, including its own player, and decides damage.
function resolveShot(id,now=performance.now()){
  const attacker=state.players[id],w=Object.hasOwn(WEAPONS,attacker?.weapon)?weaponStats(attacker.weapon,attacker.arsenal||{}):null;
  if(!state.host||!state.matchActive||!attacker||attacker.alive===false||attacker.equipped==='bat'||!w||now-(shotCooldowns.get(id)??-Infinity)<w.rate)return;
  shotCooldowns.set(id,now);const targets=[...shotBlockers],hits=new Map(),structureHits=new Map();world.updateMatrixWorld(true);
  for(const p of Object.values(state.players)){
    if(p.id===id||p.alive===false)continue;
    let model=hitModels.get(p.id);if(!model){model=createPlayerMesh(p,false,true);model.userData.hitMeshes=[];model.traverse(m=>{if(m.isMesh&&!m.userData.noHit)model.userData.hitMeshes.push(m)});hitModels.set(p.id,model)}
    model.position.set(p.x||0,(p.y??1.7)-1.7,p.z||0);model.rotation.set(0,p.yaw||0,0);model.scale.y=p.sliding?.78:1;poseEmote(model,p);model.updateMatrixWorld(true);targets.push(...model.userData.hitMeshes);
  }
  const origin=new THREE.Vector3(attacker.x,(attacker.y??1.7)-(attacker.sliding ? .42 : 0),attacker.z),rotation=new THREE.Quaternion().setFromEuler(new THREE.Euler(attacker.pitch||0,attacker.yaw||0,0,'YXZ')),ends=[],impacts=[];
  const feel=WEAPON_FEEL[attacker.weapon],heat=decayedHeat(id,now,feel);shotHeat.set(id,{v:Math.min(feel.bloomMax,heat+feel.bloom),t:now});
  const spread=(attacker.aiming?(w.adsSpread??w.spread*.55):w.spread)+heat*(attacker.aiming?.4:1);
  const recordHit=(first,multiplier=1)=>{const targetId=first.object.userData.playerId,targetModel=hitModels.get(targetId);if(!targetModel)return;const torso=targetModel.userData.avatar?.userData.danceTorso,local=(torso||targetModel).worldToLocal(first.point.clone()),headshot=local.y+(torso?.75:0)>=1.80,hit=hits.get(targetId)||{damage:0,headshot:false,point:first.point},falloff=attacker.weapon==='shotgun'?clamp(1-Math.max(0,first.distance-7)/22,.35,1):attacker.weapon==='smg'?clamp(1-Math.max(0,first.distance-20)/60,.6,1):1;hit.damage+=w.damage*falloff*multiplier*(headshot?2:1);hit.headshot||=headshot;if(headshot)hit.point=first.point;hits.set(targetId,hit)};
  for(let n=0;n<w.pellets;n++){
    const angle=n*2.399963,radius=Math.sqrt((n+.5)/w.pellets)*spread*.5,dx=w.pellets>1?Math.cos(angle)*radius:(Math.random()-.5)*spread,dy=w.pellets>1?Math.sin(angle)*radius:(Math.random()-.5)*spread;
    const dir=new THREE.Vector3(dx,dy,-1).normalize().applyQuaternion(rotation);raycaster.set(origin,dir);raycaster.far=w.range;
    const intersections=raycaster.intersectObjects(targets,false),first=intersections[0],targetId=first?.object.userData.playerId;let endpoint=first?first.point:origin.clone().addScaledVector(dir,w.range);
    const buildId=first?.object.userData.buildId;if(buildId)structureHits.set(buildId,(structureHits.get(buildId)||0)+w.damage);
    if(targetId){recordHit(first);if(attacker.weapon==='sniper'&&w.tier){const next=intersections.find(hit=>hit.object.userData.playerId!==targetId);if(next){endpoint=next.point;if(next.object.userData.playerId)recordHit(next,.65)}}}else if(first&&impacts.length<4)impacts.push({x:first.point.x,y:first.point.y,z:first.point.z});
    ends.push(endpoint.toArray());
  }
  const trail={t:'tracers',id,tier:w.tier,weapon:attacker.weapon,origin:origin.clone().add(new THREE.Vector3(.24,-.18,-.65).applyQuaternion(rotation)).toArray(),ends,impacts};showTracers(trail);broadcast(trail);
  let anyHeadshot=false;
  for(const [target,hit] of hits){
    anyHeadshot||=hit.headshot;const impact={t:'impact',id:target,headshot:hit.headshot,x:hit.point.x,y:hit.point.y,z:hit.point.z};showImpact(impact);broadcast(impact);applyHit(id,target,hit.damage,hit.headshot);
  }
  for(const [buildId,damage] of structureHits)damageBuild(buildId,damage);
  if(hits.size||structureHits.size){if(id===state.id)showShotFeedback(anyHeadshot);else state.connections.get(id)?.send({t:'shotResult',id,headshot:anyHeadshot})}
}
function showTracers(message){
  const valid=p=>Array.isArray(p)&&p.length===3&&p.every(Number.isFinite);
  if(!valid(message.origin)||!Array.isArray(message.ends))return;
  if(!tracerMesh){tracerMesh=new THREE.InstancedMesh(new THREE.CylinderGeometry(1,1,1,5),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.82,depthWrite:false}),tracerSlots.length);tracerMesh.frustumCulled=false;tracerMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);world.add(tracerMesh)}
  const start=new THREE.Vector3().fromArray(message.origin);
  const muzzle=weaponModel?.userData.rig?.userData.gun?.userData.muzzle;
  if(message.id===state.id&&muzzle){camera.updateMatrixWorld(true);muzzle.getWorldPosition(start)}
  for(const end of message.ends.slice(0,12)){if(!valid(end))continue;const slot=tracerSlots[tracerCursor++%tracerSlots.length];slot.start.copy(start);slot.end.fromArray(end);const look=(WEAPON_FEEL[message.weapon]||WEAPON_FEEL.ar).tracer;slot.born=performance.now();slot.life=look[2];slot.width=look[1];tracerMesh.setColorAt((tracerCursor-1)%tracerSlots.length,new THREE.Color(message.tier?RARITIES[message.tier]?.color||0x66ddff:look[0]))}
  if(tracerMesh.instanceColor)tracerMesh.instanceColor.needsUpdate=true;remoteShotTimes.set(message.id,performance.now());if(message.id!==state.id){const offset=start.clone().sub(camera.position),distance=offset.length(),right=new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion),pan=distance?offset.dot(right)/distance:0;if(distance<85)weaponSound(message.weapon,message.tier,.65/(1+distance*.07),pan,distance)}for(const point of (message.impacts||[]).slice(0,4))showImpact({...point,spark:true});tracerMesh.visible=true;updateTracers(performance.now());
}
function updateTracers(now){
  if(!tracerMesh?.visible)return;let active=false;
  for(let i=0;i<tracerSlots.length;i++){const s=tracerSlots[i],age=(now-s.born)/s.life;
    if(age>=0&&age<1){active=true;tracerDirection.subVectors(s.end,s.start);const length=tracerDirection.length();tracerTransform.position.copy(s.start).add(s.end).multiplyScalar(.5);tracerTransform.quaternion.setFromUnitVectors(tracerUp,tracerDirection.normalize());tracerTransform.scale.set((s.width||.014)*(1-age*.8),length,(s.width||.014)*(1-age*.8))}else tracerTransform.scale.setScalar(0);
    tracerTransform.updateMatrix();tracerMesh.setMatrixAt(i,tracerTransform.matrix);
  }tracerMesh.visible=active;tracerMesh.instanceMatrix.needsUpdate=true;
}
function showShotFeedback(headshot){$('hitmarker').classList.toggle('headshot',headshot);showHitmarker();if(headshot)state.headshotAt=performance.now()}
function showImpact(impact){
  if(impact.id)hitReactions.set(impact.id,{time:performance.now(),headshot:impact.headshot});
  let burst=coffeeBursts.find(b=>!b.mesh.visible);
  if(!burst&&coffeeBursts.length<6){coffeeGeometry??=new THREE.SphereGeometry(.035,6,4);coffeeMaterial??=new THREE.MeshBasicMaterial({color:0xffffff});const mesh=new THREE.InstancedMesh(coffeeGeometry,coffeeMaterial,8);mesh.frustumCulled=false;world.add(mesh);burst={mesh,start:0};coffeeBursts.push(burst)}
  burst??=coffeeBursts.reduce((a,b)=>a.start<b.start?a:b);burst.start=performance.now();burst.mesh.position.set(impact.x,impact.y,impact.z);for(let i=0;i<8;i++)burst.mesh.setColorAt(i,new THREE.Color(impact.spark?0xffdc80:0xa9692f));burst.mesh.instanceColor.needsUpdate=true;burst.mesh.visible=true;
}
function updateImpacts(now){
  updateTracers(now);
  for(const burst of coffeeBursts){if(!burst.mesh.visible)continue;const t=(now-burst.start)/500;if(t>=1){burst.mesh.visible=false;continue}
    for(let i=0;i<8;i++){const a=i*Math.PI/4;impactTransform.position.set(Math.cos(a)*t*.6,t*.65-t*t*.85,Math.sin(a)*t*.6);impactTransform.scale.setScalar(1-t*.7);impactTransform.updateMatrix();burst.mesh.setMatrixAt(i,impactTransform.matrix)}burst.mesh.instanceMatrix.needsUpdate=true;
  }
  const t=(now-state.headshotAt)/650;$('headshot-callout').style.opacity=t>=0&&t<1?String(Math.min(1,(1-t)*3)):'0';$('headshot-callout').style.transform=`translate(-50%,0) scale(${t>=0&&t<1?1+Math.exp(-t*9)*.3:1})`;
}
function showHitmarker(){$('hitmarker').classList.add('show');setTimeout(()=>$('hitmarker').classList.remove('show'),140)}
function meleeAttack(){
  stopEmote();
  if(state.map==='surf')return;
  const now=performance.now();if(!isPlaying()||state.equipped!=='bat'||state.reloading||now-state.lastMelee<MELEE.cooldown||now-state.switchStart<SWITCH_DURATION)return;
  state.lastMelee=state.meleeStart=now;$('weapon-name').textContent='BAT SWING';
  publishCombatPose();
  // The client requests a swing, never a victim or an amount of damage.
  sendHost({t:'melee'});updateCombatVisuals(now);
}
function chooseMeleeTarget(attacker){
  const origin=new THREE.Vector3(attacker.x,attacker.y??1.7,attacker.z),pitch=attacker.pitch||0,yaw=attacker.yaw||0;
  const forward=new THREE.Vector3(-Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch));
  let closest=null,nearest=MELEE.range;world.updateMatrixWorld(true);
  for(const p of Object.values(state.players)){
    if(p.id===attacker.id||p.alive===false)continue;
    const target=new THREE.Vector3(p.x,(p.y??1.7)-.2,p.z),offset=target.clone().sub(origin),distance=offset.length();
    if(distance<.01||distance>nearest||offset.normalize().dot(forward)<MELEE.cone||!hasClearShot(origin,target))continue;
    closest=p;nearest=distance;
  }
  return closest;
}
function resolveMelee(id,now=performance.now()){
  const attacker=state.players[id];if(!state.host||!state.matchActive||!attacker||attacker.alive===false||attacker.equipped!=='bat'||now-(meleeCooldowns.get(id)??-Infinity)<MELEE.cooldown)return;
  meleeCooldowns.set(id,now);meleeVisuals.set(id,now);broadcast({t:'meleeSwing',id});
  const target=chooseMeleeTarget(attacker);if(!target){const origin=new THREE.Vector3(attacker.x,attacker.y??1.7,attacker.z),dir=new THREE.Vector3(0,0,-1).applyEuler(new THREE.Euler(attacker.pitch||0,attacker.yaw||0,0,'YXZ'));raycaster.set(origin,dir);raycaster.far=MELEE.range;const hit=raycaster.intersectObjects(shotBlockers,false)[0];if(hit?.object.userData.buildId){damageBuild(hit.object.userData.buildId,MELEE.damage);if(id===state.id)showHitmarker();else state.connections.get(id)?.send({t:'meleeHit',id})}return}
  applyHit(id,target.id,MELEE.damage);if(id===state.id)showHitmarker();else state.connections.get(id)?.send({t:'meleeHit',id});
}
// Weapon-switch (equip/holster) is a timed dip: models drop out of view, swap at the midpoint, then rise back.
function updateSwitch(now){
  if(!state.switchPending){weaponMotion.dip=0;return 0}
  const t=(now-state.switchStart)/SWITCH_DURATION;
  if(!state.switchSwapped&&t>=.5){state.equipped=state.switchPending;publishCombatPose();updateWeaponModel();updateHud();state.switchSwapped=true}
  if(t>=1){state.switchPending=null;weaponMotion.dip=0;return 0}
  const dip=t<.5?smoothStep(t/.5):1-smoothStep((t-.5)/.5);weaponMotion.dip=dip;return dip;
}
function updateCombatVisuals(now){
  if(!meleeModel)return;
  const dip=updateSwitch(now),switching=state.switchPending!==null;
  const t=(now-state.meleeStart)/MELEE.duration,swing=isPlaying()&&t>=0&&t<1;
  const holding=state.equipped==='bat';meleeModel.visible=holding&&state.alive;weaponModel.visible=!holding&&state.alive;
  if(swing){const arc=t<.18?-smoothStep(t/.18)*.18:t<.55?-.18+smoothStep((t-.18)/.37)*1.18:1-smoothStep((t-.55)/.45);meleeModel.position.set(.48-arc*.78,-.55+arc*.12,-.65-arc*.15);meleeModel.rotation.set(-.45+arc*.6,-arc*.25,-.7+arc*1.8)}
  else{meleeModel.position.set(.47,-.51+Math.sin(now*.003)*.012,-.70);meleeModel.rotation.set(-.25,0,-.36)}
  meleeModel.position.y-=dip*.85+slideView*.22;meleeModel.rotation.x-=dip*.55;meleeModel.rotation.z-=slideView*.16;
  if(state.map==='surf')$('weapon-name').textContent=`SURF · STAGE ${state.surfCheckpoint+1}/4`;
  else if(!swing&&!state.reloading&&!switching)$('weapon-name').textContent=holding?meleeLabel():weaponStats(state.selectedWeapon).name.toUpperCase();
  else if(switching)$('weapon-name').textContent=(state.switchPending==='bat'?meleeLabel():weaponStats(state.selectedWeapon).name.toUpperCase())+'…';
  $('melee-status').textContent=state.map==='surf'?'A / D + MOUSE · TAP JUMP · R RESTART':switching?'':holding?(now-state.lastMelee<MELEE.cooldown?'RECOVERING · F GUN':'CLICK SWING · F GUN'):`F · EQUIP ${meleeLabel()}`;
}
function toggleBat(){
  const now=performance.now();
  if(state.map==='surf')return;if(!isPlaying()||now-state.meleeStart<MELEE.duration||now-state.switchStart<SWITCH_DURATION||now-state.inspectStart<INSPECT_DURATION)return;
  state.switchPending=state.equipped==='bat'?'gun':'bat';state.switchStart=now;state.switchSwapped=false;
  state.fireHeld=false;state.reloading=false;state.aiming=false;weaponMotion.kick=0;
  tone(state.switchPending==='bat'?170:230,.05,.02,'square',0,state.switchPending==='bat'?110:170);
}
function reload(){if(state.map==='surf')return;const w=WEAPONS[state.selectedWeapon];if(!isPlaying()||state.equipped==='bat'||performance.now()-state.meleeStart<MELEE.duration||performance.now()-state.switchStart<SWITCH_DURATION||performance.now()-state.inspectStart<INSPECT_DURATION||state.reloading||state.ammo>=w.mag)return;state.reloading=true;state.reloadStart=performance.now();reloadSoundStage=0;playSoundBuffer('magout',.22);publishCombatPose();$('weapon-name').textContent='RELOADING…'}
function inspectWeapon(){
  const now=performance.now();
  if(!isPlaying()||state.equipped!=='gun'||state.reloading||state.aiming||now-state.meleeStart<MELEE.duration||now-state.switchStart<SWITCH_DURATION||now-state.inspectStart<INSPECT_DURATION)return;
  state.inspectStart=now;state.fireHeld=false;tone(320,.05,.015,'sine',0,260);
}
function smoothStep(t){t=THREE.MathUtils.clamp(t,0,1);return t*t*(3-2*t)}
function updateAimAssist(dt){
  if(state.map==='surf'||!state.aiming||state.aimBlend<.28||state.equipped!=='gun'||!isPlaying()||state.reloading)return;
  const forward=new THREE.Vector3();camera.getWorldDirection(forward);
  const cone=THREE.MathUtils.degToRad({sniper:4.5,ar:6.5,smg:7.5,shotgun:8}[state.selectedWeapon]||6),minimum=Math.cos(cone),origin=camera.position,best={score:-Infinity,dot:0,target:null};
  for(const p of Object.values(state.players)){
    if(p.id===state.id||p.alive===false)continue;
    const point=new THREE.Vector3(p.x,(p.y??1.7)-.30,p.z),offset=point.clone().sub(origin),distance=offset.length();if(distance<.1||distance>weaponStats(state.selectedWeapon).range)continue;
    const dot=offset.normalize().dot(forward),score=dot-distance*.000002;
    if(dot>minimum&&score>best.score&&hasClearShot(origin,point)){best.score=score;best.dot=dot;best.target=point}
  }
  if(!best.target)return;
  const direction=best.target.sub(origin).normalize(),desiredYaw=Math.atan2(-direction.x,-direction.z),desiredPitch=Math.asin(clamp(direction.y,-1,1));
  const yawDelta=Math.atan2(Math.sin(desiredYaw-camera.rotation.y),Math.cos(desiredYaw-camera.rotation.y)),pitchDelta=desiredPitch-camera.rotation.x;
  const closeness=clamp((best.dot-minimum)/(1-minimum),0,1),magnet=(.34+.66*smoothStep(closeness))*state.aimBlend;
  const rate=state.selectedWeapon==='sniper'?3.8:5,step=(1-Math.exp(-rate*dt))*magnet;
  camera.rotation.y+=yawDelta*step;camera.rotation.x=clamp(camera.rotation.x+pitchDelta*step,-1.45,1.45);camera.rotation.z=0;
}
function updateAim(dt){
  const profile=AIM_PROFILES[state.selectedWeapon],now=performance.now(),inspecting=now-state.inspectStart<INSPECT_DURATION;
  const target=state.aiming&&state.equipped!=='bat'&&isPlaying()&&!state.reloading&&!inspecting&&now-state.meleeStart>=MELEE.duration&&now-state.switchStart>=SWITCH_DURATION;
  if(target!==weaponMotion.aimWas){weaponMotion.aimKick=1;weaponMotion.aimWas=target}
  state.aimProgress=clamp(state.aimProgress+(target?dt/profile.raise:-dt/profile.lower),0,1);state.aimBlend=smoothStep(state.aimProgress);
  const fov=THREE.MathUtils.lerp(76,profile.fov,state.aimBlend);
  if(Math.abs(camera.fov-fov)>.001){camera.fov=fov;camera.updateProjectionMatrix()}
  updateAimAssist(dt);
  controls.pointerSpeed=0;
  const scoped=state.selectedWeapon==='sniper'&&state.aimBlend>.78;
  $('scope-overlay').hidden=!scoped;$('scope-overlay').style.opacity=String(smoothStep((state.aimBlend-.78)/.22));
  $('crosshair').style.opacity=String(1-smoothStep(state.aimBlend/.7));
  $('aim-status').textContent=state.equipped==='bat'?'50 DAMAGE':inspecting?'INSPECTING':state.aimBlend>.1?profile.label+' · AIM MAGNET':'SHIFT / RMB · AIM · I INSPECT';
}
function aimSensitivity(){return state.aimBlend?Math.tan(THREE.MathUtils.degToRad(camera.fov/2))/Math.tan(THREE.MathUtils.degToRad(38)):1}
function resetAim(){
  state.aiming=false;state.aimProgress=state.aimBlend=0;state.localHeat=0;resetAimRecoil();
  if(camera){camera.fov=76;camera.updateProjectionMatrix()}
  if(controls)controls.pointerSpeed=0;
  $('scope-overlay').hidden=true;$('crosshair').style.opacity='1';
}
function updateWeaponMotion(dt,now){
  const w=weaponStats(state.selectedWeapon),rig=weaponModel.userData.rig,profile=AIM_PROFILES[state.selectedWeapon],aim=state.aimBlend;
  if((!state.alive||!state.matchActive)&&state.reloading){state.reloading=false;updateWeaponModel()}
  if(state.reloading&&now-state.reloadStart>=w.reload){state.ammo=w.mag;state.reserve=Infinity;state.reloading=false;updateWeaponModel()}
  if(isPlaying()&&!state.reloading&&state.ammo===0&&now-state.lastShot>160)reload();
  if(!rig)return;
  const m=weaponMotion,blend=1-Math.exp(-12*dt),active=isPlaying(),distance=Math.hypot(camera.position.x-(m.x??camera.position.x),camera.position.z-(m.z??camera.position.z)),moving=active&&state.onGround&&distance>.001;
  m.x=camera.position.x;m.z=camera.position.z;
  m.walk=THREE.MathUtils.lerp(m.walk,moving?Math.min(1,distance/Math.max(dt,.001)/5):0,blend);m.phase+=moving?strideAdvance(distance/Math.max(dt,.001),dt):dt*2;
  const dy=m.yaw===null?0:Math.atan2(Math.sin(camera.rotation.y-m.yaw),Math.cos(camera.rotation.y-m.yaw)),dp=m.pitch===null?0:camera.rotation.x-m.pitch;
  m.yaw=camera.rotation.y;m.pitch=camera.rotation.x;
  m.swayX=THREE.MathUtils.lerp(m.swayX,clamp(dy*.18/Math.max(dt,.001),-.05,.05),blend);m.swayY=THREE.MathUtils.lerp(m.swayY,clamp(dp*.12/Math.max(dt,.001),-.035,.035),blend);
  m.kick*=Math.exp(-profile.settle*dt);m.aimKick*=Math.exp(-9*dt);m.roll*=Math.exp(-profile.settle*dt);
  const feel=WEAPON_FEEL[state.selectedWeapon],jx=feel.jitter*m.kick*(Math.random()-.5),jy=feel.jitter*m.kick*(Math.random()-.5);
  const t=state.reloading?(now-state.reloadStart)/w.reload:0,tilt=state.reloading?smoothStep(t/.22)*(1-smoothStep((t-.76)/.24)):0;
  if(state.reloading){if(t>=.24&&reloadSoundStage<1){playSoundBuffer('magout',.3);reloadSoundStage=1}if(t>=.58&&reloadSoundStage<2){playSoundBuffer('magin',.4);reloadSoundStage=2}if(t>=.83&&reloadSoundStage<3){playSoundBuffer('bolt',.32);reloadSoundStage=3}}
  const breath=Math.sin(now*.002)*.0025,bob=Math.sin(m.phase),mag=state.reloading?smoothStep((t-.20)/.16)*(1-smoothStep((t-.57)/.17)):0;
  // Both hands travel with the gun into its real sight line; aiming never rotates the camera.
  const free=1-aim,sight=rig.userData.gun.userData.sight.position;
  const inspectT=(now-state.inspectStart)/INSPECT_DURATION,inspect=inspectT>=0&&inspectT<1?Math.sin(inspectT*Math.PI):0;
  rig.position.set(THREE.MathUtils.lerp(.16,-.28,aim),THREE.MathUtils.lerp(-.06,1.74-sight.y,aim),THREE.MathUtils.lerp(-.28,.05,aim)-m.aimKick*.045*free);
  rig.rotation.y=.20*free+inspect*1.2;rig.rotation.x=-inspect*.42;
  rig.position.y+=inspect*.06;rig.position.x+=inspect>0?Math.sin(inspectT*Math.PI*4)*.02*inspect:0;
  rig.visible=!(state.selectedWeapon==='sniper'&&aim>.78);
  const slide=clamp(slideView/SLIDE_DROP,0,1);
  weaponModel.position.set((bob*.012*m.walk*(1-slide)-m.swayX)*free+jx,(-Math.abs(Math.cos(m.phase))*.010*m.walk*(1-slide)+breath)*free-.12*tilt-m.dip*.85-slide*.16*free+jy,feel.back*m.kick*(1-.4*aim)+.10*tilt);
  weaponModel.rotation.set(profile.kick*feel.rise*m.kick+m.swayY*free-.24*tilt+m.dip*.55+slide*.10*free,m.swayX*.3*free,-bob*.012*m.walk*free-.35*tilt-slide*.22*free+m.roll);
  rig.userData.support.position.set(-.10*mag,-.16*mag,.16*mag);
  rig.userData.gun.userData.magazine.position.y=1.36-.23*mag;
  const since=(now-state.lastShot)/1000,action=rig.userData.gun.userData.action;
  const cycle=state.selectedWeapon==='shotgun'?smoothStep((since-.13)/.14)*(1-smoothStep((since-.34)/.17)):state.selectedWeapon==='sniper'?smoothStep((since-.18)/.16)*(1-smoothStep((since-.58)/.22)):0;
  action.position.z=.12*cycle;
  if(state.selectedWeapon==='shotgun')rig.userData.support.position.z+=.12*cycle;
  if(state.selectedWeapon==='sniper'){rig.userData.trigger.position.z=.10*cycle;rig.userData.trigger.position.x=.045*cycle}else rig.userData.trigger.position.set(0,0,0);
  const flashAge=now-state.lastShot,flash=rig.userData.flash;
  flash.visible=active&&!state.reloading&&flashAge<feel.flashMs;flash.material.color.set(w.tier?RARITIES[w.tier].color:0xffdf92);
  const flicker=.88+Math.random()*.24,grow=1+clamp(flashAge/feel.flashMs,0,1)*.35;
  flash.scale.set(feel.flash[0]*flicker,feel.flash[1]*flicker*grow,feel.flash[0]*flicker);flash.rotation.y=m.flashSpin;
}

function advanceMovement(dt){if(isPlaying()){camera.rotation.y+=((state.keys.ArrowLeft?1:0)-(state.keys.ArrowRight?1:0))*2.8*dt;}const steps=Math.max(1,Math.ceil(dt*120)),step=dt/steps;for(let i=0;i<steps;i++)updateMovement(step)}
function updateMovement(dt){
  if(!isPlaying())return;
  if(state.emoteUntil){if(Date.now()>=state.emoteUntil||['KeyW','KeyA','KeyS','KeyD','Space'].some(k=>state.keys[k]))stopEmote();else{updateVerticalMovement(dt);return}}
  updateLadderHint();if(state.climbing!==null){updateClimbing(dt);return}
  const forwardInput=(state.keys.KeyW?1:0)-(state.keys.KeyS?1:0),sideInput=(state.keys.KeyD?1:0)-(state.keys.KeyA?1:0),forward=new THREE.Vector3();camera.getWorldDirection(forward);forward.y=0;forward.normalize();
  const right=new THREE.Vector3().crossVectors(forward,camera.up).normalize(),wish=forward.multiplyScalar(forwardInput).addScaledVector(right,sideInput),moving=wish.lengthSq()>0;wish.normalize();
  const previousSpeed=Math.hypot(state.velocityX,state.velocityZ);
  state.landingGrace=Math.max(0,(state.landingGrace||0)-dt);
  const now=performance.now();
  if(state.slideUntil>now&&state.onGround&&!state.keys.Space){
    const age=clamp(1-(state.slideUntil-now)/SLIDE_DURATION,0,1),velocity=slideVelocity(state.velocityX,state.velocityZ,wish.x,wish.z,age,dt);state.velocityX=velocity.x;state.velocityZ=velocity.z;moveSweptAxis('x',state.velocityX*dt);moveSweptAxis('z',(state.velocityZ+(state.map==='factory'?factoryConveyorAt(camera.position.x,camera.position.z,camera.position.y-1.7):0))*dt);updateVerticalMovement(dt);if(Math.hypot(state.velocityX,state.velocityZ)<3||!state.onGround)state.slideUntil=0;return;
  }
  if(state.slideUntil&&state.slideUntil<=now&&state.onGround){state.landingGrace=Math.max(state.landingGrace,.22);state.slideUntil=0}
  if(state.keys.Space||!state.onGround)state.slideUntil=0;
  // ── CS:GO-style surf: player is ALWAYS AIRBORNE on the ramp surface ──
  // Gravity pulls down; ramp tangent projection converts it into slope-parallel speed.
  // Source AirAccelerate gives air-strafe control. Never press W to gain speed.
  // Trust state.onRamp — set by the precise landing check in updateVerticalMovement
  // (old>=top-.04&&next<=top). A loose "foot below the ramp's surface height at this
  // x/z" recheck here would also fire for anyone standing on ordinary ground that
  // merely happens to sit underneath the ramp's footprint, far from its actual surface.
  const surfRamp=state.onRamp?colliders.find(c=>c.ramp&&camera.position.x>=c.minX&&camera.position.x<=c.maxX&&camera.position.z>=c.minZ&&camera.position.z<=c.maxZ):null;
  if(surfRamp){
    const nx=surfRamp.normal.x,ny=surfRamp.normal.y,nz=surfRamp.normal.z;
    // Gravity.
    state.velocityY-=22*dt;
    // Project velocity onto ramp tangent plane (removes component going into surface).
    const vn=state.velocityX*nx+state.velocityY*ny+state.velocityZ*nz;
    state.velocityX-=vn*nx;state.velocityY-=vn*ny;state.velocityZ-=vn*nz;
    // Source AirAccelerate: project wish onto tangent plane, add bounded accel.
    if(moving){
      const AIR_ACCEL=10,AIR_MAX_WISHSPEED=30;
      let wx=wish.x,wy=0,wz=wish.z;
      const wn=wx*nx+wy*ny+wz*nz;
      wx-=wn*nx;wy-=wn*ny;wz-=wn*nz;
      const wl=Math.hypot(wx,wy,wz);if(wl>.001){wx/=wl;wy/=wl;wz/=wl}
      const cs=state.velocityX*wx+state.velocityY*wy+state.velocityZ*wz;
      const as=clamp(AIR_MAX_WISHSPEED-cs,0,AIR_ACCEL*AIR_MAX_WISHSPEED*dt);
      state.velocityX+=as*wx;state.velocityY+=as*wy;state.velocityZ+=as*wz;
    }
    // Reproject onto tangent after air-accel.
    const vn2=state.velocityX*nx+state.velocityY*ny+state.velocityZ*nz;
    state.velocityX-=vn2*nx;state.velocityY-=vn2*ny;state.velocityZ-=vn2*nz;
    // A fresh jump press launches from the bank. Holding jump from the start deck does
    // not repeat, so players can intentionally jump gaps without accidental pogoing.
    if(state.jumpQueued){
      state.jumpQueued=false;state.velocityY=Math.max(9,state.velocityY+6);state.velocityX+=nx*2;state.velocityZ+=nz*2;state.onGround=false;state.onRamp=false;
      moveSweptAxis('x',state.velocityX*dt);moveSweptAxis('z',state.velocityZ*dt);updateVerticalMovement(dt);return;
    }
    // Move horizontally (ramp colliders are skipped by swept-axis collision).
    // Holding jump is intentionally ignored while attached so a start jump does not
    // instantly bounce the player off the first bank.
    moveSweptAxis('x',state.velocityX*dt);moveSweptAxis('z',state.velocityZ*dt);
    const stillOn=colliders.find(c=>c.ramp&&camera.position.x>=c.minX&&camera.position.x<=c.maxX&&camera.position.z>=c.minZ&&camera.position.z<=c.maxZ);
    if(stillOn){
      const surf=rampHeight(stillOn,camera.position.x,camera.position.z);
      const newFoot=camera.position.y-1.7;
      if(newFoot<=surf+.3){
        camera.position.y=surf+1.7;
        state.onGround=false;state.onRamp=true;
      }else{
        state.onGround=false;state.onRamp=false;
      }
    }else{
      state.onGround=false;state.onRamp=false;
    }
    // Safety clamp.
    const sp=Math.hypot(state.velocityX,state.velocityZ);if(sp>2000){const sc=2000/sp;state.velocityX*=sc;state.velocityZ*=sc}
    return;
  }
  if(state.onGround&&!state.onRamp){
    const jumping=!!state.keys.Space,walk=8.5*movementSpeed(),speed=moving&&jumping?Math.max(11*movementSpeed(),previousSpeed)+(state.hopChain>0?2.6:0):walk;
    if(!jumping&&state.landingGrace>0&&previousSpeed>walk){const steer=1-Math.exp(-5*dt),drag=Math.exp(-1.1*dt);state.velocityX=THREE.MathUtils.lerp(state.velocityX*drag,moving?wish.x*walk:0,steer);state.velocityZ=THREE.MathUtils.lerp(state.velocityZ*drag,moving?wish.z*walk:0,steer)}
    else if(jumping){state.velocityX=wish.x*speed;state.velocityZ=wish.z*speed}
    else{const response=1-Math.exp(-(moving?24:18)*dt);state.velocityX=THREE.MathUtils.lerp(state.velocityX,wish.x*speed,response);state.velocityZ=THREE.MathUtils.lerp(state.velocityZ,wish.z*speed,response)}
    if(state.map==='factory')state.velocityZ+=factoryConveyorAt(camera.position.x,camera.position.z,camera.position.y-1.7);
    if(jumping){state.jumpQueued=false;state.velocityY=8;state.onGround=false;state.hopChain=moving?state.hopChain+1:0}else state.hopChain=0;
  }else if(moving){
    // Source-style AirAccelerate for normal airborne movement.
    const AIR_ACCEL=state.map==='surf'?7.5:2.2,AIR_MAX_WISHSPEED=state.map==='surf'?18:1.2;
    const currentspeed=state.velocityX*wish.x+state.velocityZ*wish.z;
    const addspeed=clamp(AIR_MAX_WISHSPEED-currentspeed,0,AIR_ACCEL*AIR_MAX_WISHSPEED*dt);
    state.velocityX+=addspeed*wish.x;state.velocityZ+=addspeed*wish.z;
  }else if(state.map!=='surf'){state.velocityX*=Math.exp(-.6*dt);state.velocityZ*=Math.exp(-.6*dt)}
  const safeSpeed=Math.hypot(state.velocityX,state.velocityZ);if(safeSpeed>2000){const s=2000/safeSpeed;state.velocityX*=s;state.velocityZ*=s}
  moveSweptAxis('x',state.velocityX*dt);moveSweptAxis('z',state.velocityZ*dt);
  updateVerticalMovement(dt);
}
function moveSweptAxis(axis,delta){
  // Check the entire path, not just the endpoint: uncapped speed cannot skip thin cover.
  // Ordered contacts allow a staircase to be climbed even during a fast frame.
  if(!delta)return;const other=axis==='x'?'z':'x',suffix=axis.toUpperCase(),cross=other.toUpperCase(),old=camera.position[axis],side=camera.position[other],bound=state.map==='surf'?220:state.map==='factory'?(axis==='x'?24:25):(axis==='x'?34:35);
  const requested=old+delta;let next=clamp(requested,-bound,bound);
  const radius=c=>c.stair&&(axis==='z'||c.stairEntrance)?0:.55;
  const crossRadius=c=>c.stair&&axis==='x'?0:.55;
  const contacts=colliders.filter(c=>!c.ramp&&side>c['min'+cross]-crossRadius(c)&&side<c['max'+cross]+crossRadius(c)).sort((a,b)=>delta>0?(a['min'+suffix]-radius(a))-(b['min'+suffix]-radius(b)):(b['max'+suffix]+radius(b))-(a['max'+suffix]+radius(a)));
  for(const c of contacts){
    const near=c['min'+suffix]-radius(c),far=c['max'+suffix]+radius(c);
    const crossing=delta>0?old<=near&&next>near:old>=far&&next<far;if(!crossing)continue;
    const foot=camera.position.y-1.7;if(!verticalOverlap(c,foot))continue;
    const contact=(delta>0?near:far)+Math.sign(delta)*.0001,x=axis==='x'?contact:side,z=axis==='z'?contact:side;
    if(state.onGround&&(!c.stair||axis==='z'||c.stairEntrance)&&!c.ramp&&Number.isFinite(c.maxY)&&c.maxY-foot<=.31&&!collides(x,z,c.maxY+.001)){camera.position.y=c.maxY+1.7;continue}
    if(delta>0)next=Math.min(next,near-.00001);else next=Math.max(next,far+.00001);
  }
  camera.position[axis]=next;if(next!==requested){state[axis==='x'?'velocityX':'velocityZ']=0;state.hopChain=0}
}
function verticalOverlap(c,foot){return foot<(c.maxY??Infinity)-.001&&foot+1.9>(c.minY??-Infinity)+.001}
function collides(x,z,foot=0){return colliders.some(c=>{const rx=c.stairEntrance?0:.55,rz=c.stair?0:.55;return verticalOverlap(c,foot)&&x>c.minX-rx&&x<c.maxX+rx&&z>c.minZ-rz&&z<c.maxZ+rz})}
function rampHeight(c,x,z){
  // heightAtMin/heightAtMax are the actual physical height at the min/max edge of the
  // collider's footprint — NOT the same as minY/maxY (which only give the box's flat
  // min/max, losing which edge is high vs low once the ramp descends as x/z increases).
  if(Number.isFinite(c.slopeX)||Number.isFinite(c.slopeZ))return c.centerY+(c.slopeX||0)*(x-c.centerX)+(c.slopeZ||0)*(z-c.centerZ);
  const t=c.axis==='x'?(x-c.minX)/(c.maxX-c.minX):(z-c.minZ)/(c.maxZ-c.minZ);
  const a=c.heightAtMin??c.minY,b=c.heightAtMax??c.maxY;
  return a+clamp(t,0,1)*(b-a);
}
function updateVerticalMovement(dt){
  const wasGround=state.onGround,impactSpeed=-state.velocityY,old=camera.position.y-1.7;state.velocityY-=22*dt;let next=old+state.velocityY*dt,ground=state.map==='surf'?SURF_FLOOR_Y:0;state.onRamp=false;
  for(const c of colliders){
    const margin=c.stair||c.ramp?0:.20;
    if(camera.position.x<c.minX-margin||camera.position.x>c.maxX+margin||camera.position.z<c.minZ-margin||camera.position.z>c.maxZ+margin)continue;
    const top=c.ramp?rampHeight(c,camera.position.x,camera.position.z):c.maxY;
    if(!Number.isFinite(top))continue;
    if(state.velocityY<=0&&old>=top-.04&&next<=top){if(top>ground){ground=top;if(c.ramp)state.onRamp=true}else if(top===ground&&c.ramp)state.onRamp=true}
    if(state.velocityY>0&&!c.ramp&&Number.isFinite(c.minY)&&old+1.9<=c.minY+.001&&next+1.9>=c.minY){next=c.minY-1.9;state.velocityY=0}
  }
  state.onGround=next<=ground;if(state.onGround){if(!wasGround&&impactSpeed>3){state.landingGrace=.12;landingKick=Math.min(.12,impactSpeed*.008);tone(85,.065,.02,'triangle',0,35)}next=ground;state.velocityY=0}camera.position.y=next+1.7;
}
function nearbyLadder(){const foot=camera.position.y-1.7;return ladders.findIndex(l=>Math.hypot(camera.position.x-l.x,camera.position.z-l.z)<1.85&&foot>=l.bottom-.3&&foot<=l.top+.35)}
function updateLadderHint(){const near=nearbyLadder();$('ladder-hint').textContent=state.climbing!==null?'W / S · CLIMB   SPACE / E · LET GO':near>=0?`E · GRAB ${state.map==='factory'?'CATWALK':'ROOFTOP'} LADDER`:''}
function toggleLadder(){
  if(!isPlaying())return;if(state.climbing!==null){state.climbing=null;state.onGround=false;return}
  const index=nearbyLadder();if(index<0)return;const l=ladders[index];state.climbing=index;state.velocityX=state.velocityY=state.velocityZ=state.hopChain=0;state.onGround=false;camera.position.x=l.x;camera.position.z=l.z;
}
function interactOrEmote(){
  state.buildMode=false;
  if(state.climbing!==null||nearbyLadder()>=0){stopEmote();toggleLadder();return}
  if(state.emoteUntil){stopEmote();return}
  if(!isPlaying()||!state.onGround)return;
  state.emoteEquipment=state.equipped;state.emoteYaw=camera.rotation.y;state.emoteUntil=Date.now()+EMOTE_DURATION;state.equipped='bat';state.fireHeld=false;state.reloading=false;state.velocityX=state.velocityZ=state.hopChain=0;state.keys={};resetAim();publishCombatPose();sendHost({t:'emote',active:true});updateWeaponModel();
}
function stopEmote(notify=true){
  if(!state.emoteUntil)return;state.emoteUntil=0;state.equipped=state.emoteEquipment||'gun';if(emoteActor)emoteActor.visible=false;
  $('emote-hint').textContent='';if(weaponModel)updateWeaponModel();if(notify&&state.matchActive){sendHost({t:'emote',active:false});publishCombatPose()}
}
function poseEmote(model,p,now=Date.now()){
  const u=model.userData,avatar=u.avatar,torso=avatar?.userData.danceTorso,active=p.alive!==false&&p.emoteUntil>now;
  if(!active){u.dancing=false;return}
  const t=(now-(p.emoteUntil-EMOTE_DURATION))/1000,blend=smoothStep(t/.25)*smoothStep((p.emoteUntil-now)/250),beat=Math.sin(t*15),sway=Math.sin(t*7.5);
  u.dancing=true;u.gun.visible=false;u.bat.visible=true;
  if(torso){
    avatar.position.y=0;torso.position.set(sway*.09*blend,.75+(.07*beat-.08)*blend,.14*blend);torso.rotation.set((-.72+beat*.10)*blend,sway*.14*blend,sway*.08*blend);
    avatar.userData.legs.forEach((leg,i)=>{leg.rotation.x=(.18+Math.sin(t*15+i*Math.PI)*.13)*blend;leg.rotation.z=(i?-.14:.14)*blend});
    avatar.userData.arms.forEach((arm,i)=>{arm.rotation.x=(i?-.3+beat*.25:.45+sway*.2)*blend;arm.rotation.z=(i?-.3:.3)*blend});
  }else{model.rotation.x=(-.40+beat*.09)*blend;model.rotation.z=sway*.14*blend}
}
function gameplayCamera(){
  if(!isPlaying()||!state.emoteUntil){if(emoteActor)emoteActor.visible=false;return camera}
  if(Date.now()>=state.emoteUntil){stopEmote();return camera}
  if(!emoteActor||emoteCharacter!==state.selectedChar){if(emoteActor)world.remove(emoteActor);emoteActor=createPlayerMesh(myPublic(),false,true);emoteCharacter=state.selectedChar}
  if(emoteActor.parent!==world)world.add(emoteActor);emoteActor.visible=true;emoteActor.position.copy(camera.position);emoteActor.position.y-=1.7;emoteActor.rotation.set(0,state.emoteYaw,0);poseEmote(emoteActor,myPublic());
  emoteCamera??=new THREE.PerspectiveCamera(65,camera.aspect,.08,160);emoteCamera.aspect=camera.aspect;emoteCamera.updateProjectionMatrix();
  const target=camera.position.clone().add(new THREE.Vector3(0,-.45,0)),offset=new THREE.Vector3(2.5,1.1,3.5).applyAxisAngle(new THREE.Vector3(0,1,0),camera.rotation.y),length=offset.length();
  world.updateMatrixWorld(true);raycaster.set(target,offset.normalize());raycaster.far=length;const wall=raycaster.intersectObjects(shotBlockers,false)[0];emoteCamera.position.copy(target).addScaledVector(offset,wall?Math.max(.25,wall.distance-.18):length);emoteCamera.lookAt(target);
  weaponModel.visible=meleeModel.visible=false;$('crosshair').style.opacity='0';$('emote-hint').textContent='BAT SHAKE · E, MOVE OR ATTACK TO CANCEL';return emoteCamera;
}
function buildBoxes(piece){
  const local=piece.type==='wall'?[{x:0,y:1.4,z:0,w:4,h:2.8,d:.30}]:piece.type==='floor'?[{x:0,y:-.08,z:0,w:4,h:.16,d:4}]:Array.from({length:14},(_,i)=>({x:0,y:(i+1)*.10,z:2-(i+.5)*4/14,w:4,h:(i+1)*.2,d:4/14,stair:true}));
  const angle=piece.rotation*Math.PI/2,s=Math.round(Math.sin(angle)),c=Math.round(Math.cos(angle));
  return local.map(b=>{const x=piece.x+b.x*c+b.z*s,z=piece.z-b.x*s+b.z*c,w=Math.abs(c)?b.w:b.d,d=Math.abs(c)?b.d:b.w;return{minX:x-w/2,maxX:x+w/2,minZ:z-d/2,maxZ:z+d/2,minY:piece.y+b.y-b.h/2,maxY:piece.y+b.y+b.h/2,stair:!!b.stair,buildId:piece.id}});
}
function buildMesh(type){
  if(!buildTemplates.has(type)){const root=new THREE.Group(),panel=new THREE.MeshStandardMaterial({color:0x5a9ea8,roughness:.7,metalness:.2}),trim=new THREE.MeshStandardMaterial({color:0x253e54,roughness:.5});
    const add=(x,y,z,w,h,d,m)=>{const part=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);part.position.set(x,y,z);part.castShadow=part.receiveShadow=true;root.add(part)};
    const boxes=buildBoxes({type,x:0,y:0,z:0,rotation:0});for(const b of boxes)add((b.minX+b.maxX)/2,(b.minY+b.maxY)/2,(b.minZ+b.maxZ)/2,b.maxX-b.minX,b.maxY-b.minY,b.maxZ-b.minZ,panel);
    if(type==='wall'){for(const x of [-1.9,0,1.9])add(x,1.4,0,.12,2.85,.36,trim);for(const y of [.08,1.4,2.72])add(0,y,0,4,.12,.36,trim)}else if(type==='ramp')for(let i=0;i<14;i++)add(0,(i+1)*.2+.01,2-i*4/14,4,.03,.04,trim);else for(const x of [-1.9,0,1.9])add(x,-.08,0,.08,.18,4,trim);
    mergeRigidParts(root);buildTemplates.set(type,root)}return buildTemplates.get(type).clone(true);
}
function syncBuilds(records){
  state.builds=records;const keep=new Set(records.map(p=>p.id));
  for(const [id,o] of buildObjects)if(!keep.has(id)){world.remove(o.root);for(let i=colliders.length-1;i>=0;i--)if(colliders[i].buildId===id)colliders.splice(i,1);for(let i=shotBlockers.length-1;i>=0;i--)if(shotBlockers[i].userData.buildId===id)shotBlockers.splice(i,1);buildObjects.delete(id)}
  for(const p of records)if(!buildObjects.has(p.id)){const root=buildMesh(p.type);root.position.set(p.x,p.y,p.z);root.rotation.y=p.rotation*Math.PI/2;root.traverse(m=>{if(m.isMesh){m.userData.buildId=p.id;shotBlockers.push(m)}});colliders.push(...buildBoxes(p));world.add(root);buildObjects.set(p.id,{root})}
}
// Shared sockets make preview and host validation use identical attachment rules.
function buildOptions(player,type,rotation){
  if(!['wall','ramp','floor'].includes(type)||!Number.isInteger(rotation)||rotation<0||rotation>3)return[];
  const options=[],feet=(player.y??1.7)-1.7,add=(x,y,z,support=null)=>{
    if(y<0||y+2.8>56||Math.hypot(x-player.x,z-player.z,y-feet)>9)return;
    options.push({type,x,y:Math.round(y*100)/100,z,rotation,support});
  };
  const gx=Math.round(player.x/4)*4,gz=Math.round(player.z/4)*4;
  for(let dx=-2;dx<=2;dx++)for(let dz=-2;dz<=2;dz++){
    const x=gx+dx*4,z=gz+dz*4;let y=0;
    for(const c of colliders)if(!c.buildId&&Number.isFinite(c.maxY)&&c.maxY<=feet+.35&&x>=c.minX&&x<=c.maxX&&z>=c.minZ&&z<=c.maxZ)y=Math.max(y,c.maxY);
    add(x,y,z);
  }
  for(const p of state.builds){
    if(p.type==='wall'){
      if(type==='wall')add(p.x,p.y+2.8,p.z,p.id);
      else{const nx=Math.round(Math.sin(p.rotation*Math.PI/2)),nz=Math.round(Math.cos(p.rotation*Math.PI/2));for(const side of [-1,1])add(p.x+nx*2*side,p.y+2.8,p.z+nz*2*side,p.id)}
    }else if(p.type==='ramp'){
      const fx=-Math.round(Math.sin(p.rotation*Math.PI/2)),fz=-Math.round(Math.cos(p.rotation*Math.PI/2));
      if(type==='wall')add(p.x+fx*2,p.y+2.8,p.z+fz*2,p.id);
      else add(p.x+fx*4,p.y+2.8,p.z+fz*4,p.id);
    }else{
      if(type==='wall'){for(const side of [-1,1])add(p.x+Math.round(Math.sin(rotation*Math.PI/2))*2*side,p.y,p.z+Math.round(Math.cos(rotation*Math.PI/2))*2*side,p.id)}
      else if(type==='ramp')add(p.x,p.y,p.z,p.id);
      else for(const [dx,dz]of [[4,0],[-4,0],[0,4],[0,-4]])add(p.x+dx,p.y,p.z+dz,p.id);
    }
  }
  return options;
}
function candidateBuild(player,type,x,z,rotation,y){
  if(![x,z,rotation].every(Number.isFinite)||(y!==undefined&&!Number.isFinite(y)))return null;
  return buildOptions(player,type,rotation).find(p=>Math.abs(p.x-x)<.02&&Math.abs(p.z-z)<.02&&(y===undefined||Math.abs(p.y-y)<.02))||null;
}
function buildError(p,player){
  if(!p)return'Aim at nearby ground or a build edge';const boxes=buildBoxes(p);
  if(boxes.some(b=>b.minX<-32||b.maxX>32||b.minZ<-33||b.maxZ>33||b.maxY>56))return'Outside the build area';
  if(Date.now()-(buildCooldowns.get(player.id)??-Infinity)<250)return'Build cooling down';
  for(const b of boxes)for(const c of colliders){
    // Floors sit just below the socket height and may meet their supporting piece.
    if(c.buildId===p.support&&p.type==='floor')continue;
    if((c.maxY??Infinity)>b.minY+.025&&(c.minY??-Infinity)<b.maxY-.025&&b.minX<c.maxX-.03&&b.maxX>c.minX+.03&&b.minZ<c.maxZ-.03&&b.maxZ>c.minZ+.03)return'Space is blocked';
  }
  for(const b of boxes)for(const other of Object.values(state.players))if(other.alive&&other.x>b.minX-.55&&other.x<b.maxX+.55&&other.z>b.minZ-.55&&other.z<b.maxZ+.55&&(other.y??1.7)-1.7<b.maxY-.25&&(other.y??1.7)+.7>b.minY)return'Player in the way';
  if(p.y<3)for(const b of boxes)for(const [x,z]of MAPS[state.map].spawns)if(x>b.minX-1.5&&x<b.maxX+1.5&&z>b.minZ-1.5&&z<b.maxZ+1.5)return'Keep spawn points clear';
  const from=new THREE.Vector3(player.x,player.y??1.7,player.z),to=new THREE.Vector3(p.x,p.y+(p.type==='floor'?.2:1.4),p.z),direction=to.sub(from);raycaster.set(from,direction.clone().normalize());raycaster.far=direction.length();
  if(raycaster.intersectObjects(shotBlockers,false).some(hit=>hit.object.userData.buildId!==p.support))return'Placement is behind cover';
  return'';
}
function placeBuild(id,d){
  const player=state.players[id];if(!state.host||!state.matchActive||!player?.alive)return;
  world.updateMatrixWorld(true);const piece=candidateBuild(player,d.kind,d.x,d.z,d.rotation,d.y),error=buildError(piece,player);
  if(error){if(id===state.id)toast(error);else state.connections.get(id)?.send({t:'buildError',message:error});return}
  buildCooldowns.set(id,Date.now());Object.assign(piece,{id:'build-'+(++buildSerial),owner:id,health:150,expiresAt:Date.now()+BUILD_LIFETIME});syncBuilds([...state.builds,piece]);broadcast({t:'builds',builds:state.builds});
}
function damageBuild(id,damage){if(!state.host)return;const p=state.builds.find(b=>b.id===id);if(!p)return;p.health-=damage;if(p.health<=0)syncBuilds(state.builds.filter(b=>b.id!==id));broadcast({t:'builds',builds:state.builds})}
function toggleBuilding(){stopEmote();state.buildHeld=false;state.buildMode=!state.buildMode;state.buildRotation=((Math.round(camera.rotation.y/(Math.PI/2))%4)+4)%4;state.fireHeld=false;state.reloading=false;resetAim()}
function localBuildCandidate(){
  const player=myPublic(),direction=new THREE.Vector3(0,0,-1).applyEuler(camera.rotation),origin=camera.position;
  const ranked=buildOptions(player,state.buildType,state.buildRotation).map(p=>{
    const delta=new THREE.Vector3(p.x,p.y+(p.type==='floor'?0:1.4),p.z).sub(origin),distance=delta.length(),along=delta.dot(direction);
    return{p,score:along<.5?Infinity:(1-along/Math.max(.01,distance))*25+Math.abs(distance-4)*.12};
  }).filter(o=>Number.isFinite(o.score)).sort((a,b)=>a.score-b.score);
  // Only validate the nearest crosshair choices, not every socket in the map.
  for(const {p}of ranked.slice(0,8)){const error=buildError(p,player);if(!error||error==='Build cooling down')return p}
  return ranked[0]?.p||null;
}
function requestBuild(){if(Date.now()-state.lastBuildAttempt<260)return;state.lastBuildAttempt=Date.now();const p=localBuildCandidate();if(!p||buildError(p,myPublic()))return;publishCombatPose();sendHost({t:'build',kind:p.type,x:p.x,y:p.y,z:p.z,rotation:p.rotation})}
function updateBuilding(){
  if(state.host&&state.matchActive&&state.builds.some(p=>p.expiresAt<=Date.now())){syncBuilds(state.builds.filter(p=>p.expiresAt>Date.now()));broadcast({t:'builds',builds:state.builds})}
  if(!state.buildMode||!isPlaying()){if(buildGhost)buildGhost.visible=false;$('build-hint').textContent='';return}
  if(!buildGhost||buildGhost.userData.type!==state.buildType){if(buildGhost)world.remove(buildGhost);buildGhost=buildMesh(state.buildType);buildGhost.userData.type=state.buildType;buildGhost.traverse(m=>{if(m.isMesh){m.material=ghostMaterial;m.castShadow=false}});world.add(buildGhost)}
  if(state.buildHeld)requestBuild();if(performance.now()-buildPreviewAt<50){weaponModel.visible=meleeModel.visible=false;return}buildPreviewAt=performance.now();const p=localBuildCandidate(),error=buildError(p,myPublic());buildGhost.visible=!!p;if(p){buildGhost.position.set(p.x,p.y,p.z);buildGhost.rotation.y=p.rotation*Math.PI/2;ghostMaterial.color.set(error?0xff685c:0x55efb4)}
  weaponModel.visible=meleeModel.visible=false;$('build-hint').textContent=`${state.buildType.toUpperCase()} · UNLIMITED · 30s · T SWITCH · R ROTATE · HOLD CLICK BUILD · B EXIT${error?' — '+error:''}`;
}
function updateClimbing(dt){
  const l=ladders[state.climbing];if(!l){state.climbing=null;return}
  if(state.keys.Space){state.climbing=null;state.velocityY=5;return}
  const direction=(state.keys.KeyW?1:0)-(state.keys.KeyS?1:0),foot=clamp(camera.position.y-1.7+direction*3.6*dt,l.bottom,l.top);camera.position.set(l.x,foot+1.7,l.z);
  if((direction>0&&foot>=l.top)||(direction<0&&foot<=l.bottom)){camera.position.set(l.exitX,foot+1.7,l.exitZ);state.climbing=null;state.onGround=true;state.velocityY=0}
}
function hasClearShot(from,to){if(state.map==='factory'&&factorySteamBlocksSight(from,to))return false;const direction=new THREE.Vector3().subVectors(to,from),distance=direction.length();if(distance<.01)return false;raycaster.set(from,direction.normalize());raycaster.far=distance;return raycaster.intersectObjects(shotBlockers,false).length===0}
function makeBotBrain(p,i,now){
  const skill=.82+Math.random()*.46;
  return{skill,wob:{sniper:.008,ar:.016,smg:.02,shotgun:.026}[p.weapon]||.018,tau:(.045+Math.random()*.06)/skill,react:(160+Math.random()*220)/skill,turnTrack:2.4*skill,turnFlick:7.5*skill,strafeDir:i%2?1:-1,strafeActive:true,nextSense:0,nextShot:now+400+Math.random()*400,nextHop:now+1400+Math.random()*1600,nextSlide:now+3500+Math.random()*3000,slideUntil:0,burstLeft:2+Math.floor(Math.random()*6),burstUntil:0,ammo:WEAPONS[p.weapon].mag,vx:0,vz:0,stuck:0,targetId:null,visible:false,lastSeenAt:-Infinity,lastX:p.x,lastZ:p.z,engagedAt:now,aimX:p.x,aimY:1.45,aimZ:p.z,wobT:Math.random()*9,wobFY:2+Math.random()*2.6,wobPY:Math.random()*6.3,wobFP:1.3+Math.random()*1.7,wobPP:Math.random()*6.3,strafeUntil:0,commitAt:0,goalX:p.x,goalZ:p.z,goalUntil:0,pauseUntil:0,lookYaw:0,detour:0,detourUntil:0,reloadUntil:0,prevTX:null,prevTZ:null,prevAt:0,tSpeed:0,rangeNow:16}
}
function updateBots(dt){
  if(!state.practice||!state.matchActive||state.map==='surf')return;
  const now=performance.now(),players=Object.values(state.players),bots=players.filter(p=>p.bot&&p.alive);
  for(const [i,p] of bots.entries()){
    let b=botBrains.get(p.id);if(!b){b=makeBotBrain(p,i,now);botBrains.set(p.id,b)}
    const w=weaponStats(p.weapon,p.arsenal||{});
    p.equipped='gun';p.sliding=now<(b.slideUntil||0);
    const eye=new THREE.Vector3(p.x,(p.y??1.7)-(p.sliding?.42:0),p.z);
    if(p.reloading){if(now>=b.reloadUntil){p.reloading=false;b.ammo=w.mag}}else if(b.ammo<=0){p.reloading=true;b.reloadUntil=now+w.reload;b.burstUntil=now+w.reload+120}
    // Sight is honest: only players actually in line of sight are acquired; a lost target is remembered for 1.7s.
    if(now>=b.nextSense){
      b.nextSense=now+90+Math.random()*70;
      if(b.targetId&&state.players[b.targetId]?.alive===false)b.targetId=null;
      let best=null,bestScore=Infinity;
      for(const q of players){
        if(q.id===p.id||q.alive===false)continue;
        const point=new THREE.Vector3(q.x,(q.y??1.7)-.25,q.z),d=eye.distanceTo(point);
        if(!hasClearShot(eye,point))continue;
        const score=d+(q.id===b.targetId?-6:0)+(q.id===state.id?-1.5:0);
        if(score<bestScore){best=q;bestScore=score}
      }
      if(best){
        if(best.id!==b.targetId){b.prevTX=null;b.prevTZ=null;b.prevAt=0;b.tSpeed=0}
        if(best.id!==b.targetId||!b.visible){b.targetId=best.id;b.engagedAt=now;b.aimX=best.x;b.aimY=(best.y??1.7)-.25;b.aimZ=best.z}
        if(b.prevTX!==null&&now>b.prevAt)b.tSpeed=Math.hypot(best.x-b.prevTX,best.z-b.prevTZ)/((now-b.prevAt)/1000);
        b.prevTX=best.x;b.prevTZ=best.z;b.prevAt=now;
        b.lastSeenAt=now;b.lastX=best.x;b.lastZ=best.z;b.visible=true;
      }else{b.visible=false;if(b.targetId&&now-b.lastSeenAt>1700)b.targetId=null}
    }
    const target=b.targetId?state.players[b.targetId]:null;
    let wishX=0,wishZ=0,speed=0,aimErr=Infinity,canShoot=false,fightHop=false;
    if(target&&target.alive!==false){
      const dx=target.x-p.x,dz=target.z-p.z,distance=Math.max(.01,Math.hypot(dx,dz));
      const rangeBase={shotgun:7,smg:12,ar:19,sniper:29}[p.weapon]||16;
      let goalX=b.goalX,goalZ=b.goalZ,healing=false;
      if(p.health<58){const health=state.pickups.filter(x=>x.kind==='health'&&Date.now()>=x.readyAt).sort((a,c)=>Math.hypot(p.x-a.x,p.z-a.z)-Math.hypot(p.x-c.x,p.z-c.z))[0];if(health){goalX=health.x;goalZ=health.z;healing=true}}
      if(healing)speed=5.9;
      else if(!b.visible){goalX=b.lastX;goalZ=b.lastZ;speed=5.5}
      else{
        // Commit to a flanking spot around the target for ~1s instead of orbiting on rails.
        if(now>=b.commitAt){
          b.rangeNow=rangeBase*(.82+Math.random()*.4);
          const off=(Math.random()<.5?-1:1)*(.45+Math.random()*.85),bearing=Math.atan2(dx,dz);
          b.goalX=target.x+Math.sin(bearing+off)*b.rangeNow;
          b.goalZ=target.z+Math.cos(bearing+off)*b.rangeNow;
          b.commitAt=now+650+Math.random()*750;
          if(Math.random()<.3)b.strafeDir*=-1;
        }
        goalX=b.goalX;goalZ=b.goalZ;
        if(now>=b.strafeUntil){const r=Math.random();if(r<.32)b.strafeDir*=-1;b.strafeActive=r>=.32&&r<.44?false:true;b.strafeUntil=now+240+Math.random()*430}
        speed=p.weapon==='sniper'?4.3:5.1;
        if(distance>rangeBase+6)speed=5.5;
        if(p.reloading)speed=4.5;
        if(!p.reloading&&distance>12&&distance<26&&p.grounded!==false&&now>=b.nextSlide){b.slideUntil=now+520;b.nextSlide=now+5000+Math.random()*3500;p.sliding=true;speed=6.4}
      }
      const gx=goalX-p.x,gz=goalZ-p.z,gd=Math.max(.01,Math.hypot(gx,gz));
      let mx=gx/gd,mz=gz/gd;
      if(b.visible&&!healing){const s=(b.strafeActive?b.strafeDir:0)*.82;mx+=gz/gd*s;mz-=gx/gd*s}
      wishX=mx;wishZ=mz;fightHop=b.visible&&distance<24;canShoot=b.visible&&distance<w.range;
      // Human aim: the aim point lags a moving target, the crosshair wobbles, flicks are fast and tracking is slow.
      const lagK=1-Math.exp(-dt/b.tau),ax=b.visible?target.x:b.lastX,az=b.visible?target.z:b.lastZ,ay=b.visible?((target.y??1.7)-.25):1.45;
      b.aimX+=(ax-b.aimX)*lagK;b.aimY+=(ay-b.aimY)*lagK;b.aimZ+=(az-b.aimZ)*lagK;
      const tdx=b.aimX-p.x,tdz=b.aimZ-p.z,td=Math.max(.01,Math.hypot(tdx,tdz));
      const wobS=b.wob*(1+td/34)*(b.tSpeed>2.2?1.35:1);b.wobT+=dt;
      const wobYaw=Math.sin(b.wobT*b.wobFY+b.wobPY)*wobS,wobPitch=Math.sin(b.wobT*b.wobFP+b.wobPP)*wobS*.7;
      const desiredYaw=Math.atan2(-tdx,-tdz),desiredPitch=Math.atan2(b.aimY-eye.y,td);
      const yawErr=Math.atan2(Math.sin(desiredYaw+wobYaw-(p.yaw||0)),Math.cos(desiredYaw+wobYaw-(p.yaw||0)));
      const rate=Math.abs(yawErr)>.55?b.turnFlick:b.turnTrack;
      p.yaw=(p.yaw||0)+clamp(yawErr,-rate*dt,rate*dt);
      const pitchGoal=desiredPitch+wobPitch;
      p.pitch=THREE.MathUtils.lerp(p.pitch||0,pitchGoal,1-Math.exp(-4.2*dt));
      p.aiming=b.visible&&(p.weapon==='sniper'||p.weapon==='ar'&&td>18);
      aimErr=Math.hypot(yawErr,pitchGoal-(p.pitch||0));
    }else{
      // No target: wander to fresh goals, pause to look around, hop while traveling.
      p.aiming=false;
      if(now>=b.goalUntil||Math.hypot(b.goalX-p.x,b.goalZ-p.z)<1.8){
        for(let t=0;t<8;t++){const hx=(Math.random()*2-1)*(state.map==='factory'?20:27),hz=(Math.random()*2-1)*(state.map==='factory'?21:27);if(!collides(hx,hz)){b.goalX=hx;b.goalZ=hz;break}}
        b.goalUntil=now+2600+Math.random()*3200;
        b.pauseUntil=Math.random()<.35?now+450+Math.random()*700:0;
        b.lookYaw=(Math.random()*2-1)*Math.PI;
      }
      const gx=b.goalX-p.x,gz=b.goalZ-p.z,gd=Math.max(.01,Math.hypot(gx,gz));
      if(now<b.pauseUntil){
        const err=Math.atan2(Math.sin(b.lookYaw-(p.yaw||0)),Math.cos(b.lookYaw-(p.yaw||0)));
        p.yaw=(p.yaw||0)+clamp(err,-1.6*dt,1.6*dt);
      }else{wishX=gx/gd;wishZ=gz/gd;speed=4.4}
      if(speed&&gd>7&&now>=b.nextHop){b.nextHop=now+900+Math.random()*1400;if(Math.random()<.55){b.jumpStart=now;b.jumpUntil=now+650}}
      p.pitch=THREE.MathUtils.lerp(p.pitch||0,0,1-Math.exp(-3*dt));
    }
    if(speed){
      let wx=wishX,wz=wishZ;
      const len=Math.max(.001,Math.hypot(wx,wz));wx=wx/len*speed;wz=wz/len*speed;
      // Hold a detour for half a second so the bot rounds corners instead of wall-sliding frame by frame.
      if(now<b.detourUntil){const s=b.detour,px=-wz*s,pz=wx*s;wx=wx*.4+px*.75;wz=wz*.4+pz*.75}
      for(const q of bots)if(q!==p){const ox=p.x-q.x,oz=p.z-q.z,d=Math.hypot(ox,oz);if(d<1.6&&d>.01){wx+=ox/d*(1.6-d)*3;wz+=oz/d*(1.6-d)*3}}
      b.vx=THREE.MathUtils.lerp(b.vx,wx,1-Math.exp(-7*dt));b.vz=THREE.MathUtils.lerp(b.vz,wz,1-Math.exp(-7*dt));
      const attempts=[[b.vx,b.vz],[b.vz,-b.vx],[-b.vz,b.vx],[-b.vx,-b.vz]];let moved=false;
      for(const [vx,vz] of attempts){const bx=state.map==='factory'?21.8:31.5,bz=state.map==='factory'?22.8:31.5,nx=clamp(p.x+vx*dt,-bx,bx),nz=clamp(p.z+vz*dt,-bz,bz);if(!collides(nx,nz)){p.x=nx;p.z=nz;moved=true;break}}
      b.stuck=moved?Math.max(0,b.stuck-dt*2):b.stuck+dt;
      if(b.stuck>.3){b.detour=Math.random()<.5?1:-1;b.detourUntil=now+500+Math.random()*500;b.stuck=0;if(Math.random()<.6){b.jumpStart=now;b.jumpUntil=now+650}}
    }else{b.vx*=.8;b.vz*=.8;b.stuck=0}
    if(fightHop&&now>=b.nextHop){b.nextHop=now+1700+Math.random()*1800;if(Math.random()<.46){b.jumpStart=now;b.jumpUntil=now+650}}
    if(now<(b.jumpUntil||0)){const t=(now-b.jumpStart)/650;p.y=1.7+Math.sin(Math.max(0,Math.min(1,t))*Math.PI)*1.05;p.grounded=false}else{p.y=1.7;p.grounded=true}
    if(canShoot&&!p.reloading){
      const tolerance={shotgun:.16,smg:.085,ar:.060,sniper:.032}[p.weapon]||.07;
      if(now>=b.engagedAt+b.react*(p.weapon==='sniper'?1.7:1)&&now>=b.burstUntil&&now>=b.nextShot&&aimErr<tolerance){
        resolveShot(p.id,now);b.ammo--;
        b.nextShot=now+w.rate*(w.automatic?.95+Math.random()*.28:1.05+Math.random()*.18);
        if(w.automatic){if(--b.burstLeft<=0){b.burstLeft=2+Math.floor(Math.random()*7);b.burstUntil=now+200+Math.random()*480}}
        else if(Math.random()<.3)b.burstUntil=now+240+Math.random()*400;
      }
    }
  }
}
function updateNetwork(now){if(now-state.lastNet<65)return;state.lastNet=now;if(state.host)hostSnapshot();else publishCombatPose()}
function updateTimer(){
  if(!state.matchActive)return;
  if(state.map==='surf'){
    const elapsed=Math.floor((Date.now()-state.surfStart)/1000);$('timer').textContent=`${Math.floor(elapsed/60)}:${String(elapsed%60).padStart(2,'0')}`;
    while(state.surfCheckpoint<SURF_CHECKPOINTS.length&&camera.position.z>=SURF_CHECKPOINTS[state.surfCheckpoint].triggerZ){state.surfCheckpoint++;toast(`Checkpoint ${state.surfCheckpoint}/${SURF_CHECKPOINTS.length}`)}
    if(camera.position.z>=SURF_FINISH_Z){
      const run=(Date.now()-state.surfStart)/1000;state.surfBest=Math.min(state.surfBest,run);resetSurfRun(true,false);toast(`Finish · ${run.toFixed(2)}s${run===state.surfBest?' · BEST':''}`);
    }else if(camera.position.y-1.7<SURF_FLOOR_Y+1||camera.position.z>228||camera.position.z<-32||Math.abs(camera.position.x)>34)resetSurfRun(false);
    return;
  }
  const left=Math.max(0,state.matchEnd-Date.now()),s=Math.ceil(left/1000);$('timer').textContent=`${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;if(left<=0&&state.host)finishMatch(state.players)
}
function finishMatch(players){if(!state.matchActive)return;state.matchActive=false;controls.unlock();$('hud').classList.remove('active');const ranked=Object.values(players||state.players).sort((a,b)=>(b.kills||0)-(a.kills||0));$('podium').innerHTML=ranked.map((p,i)=>`<div class="rank-row"><span>#${i+1}</span><span>${escapeHtml(p.name)}</span><strong>${p.kills||0} K</strong></div>`).join('');showScreen('results');state.mode='results';if(state.host)broadcast({t:'end',players:state.players})}
function returnLobby(){if(state.practice){leaveToHome();return}Object.values(state.players).forEach(p=>Object.assign(p,{kills:0,deaths:0,health:100,alive:true}));if(state.host)broadcast({t:'lobby',players:state.players});enterLobby()}

function updateLeaderboard(){
  const ranked=Object.values(state.players).sort((a,b)=>(b.kills||0)-(a.kills||0)||(a.deaths||0)-(b.deaths||0)||String(a.name||'').localeCompare(String(b.name||'')));
  const signature=JSON.stringify(ranked.map(p=>[p.id,p.name,p.kills,p.deaths,state.id]));
  if(signature===lastLeaderboardSignature)return;
  lastLeaderboardSignature=signature;
  const shown=ranked.slice(0,4),me=ranked.find(p=>p.id===state.id);
  if(me&&!shown.includes(me))shown.push(me);
  $('leaderboard-rows').innerHTML=shown.map(p=>`<div class="leaderboard-row${p.id===state.id?' me':''}"><span class="leaderboard-rank">${ranked.indexOf(p)+1}</span><span class="leaderboard-name">${escapeHtml(p.name||'Player')}</span><span class="leaderboard-score">${p.kills||0}</span></div>`).join('');
}
function updateHud(){
  if(state.map==='surf'){
    // Hide combat HUD, show speed and time.
    $('leaderboard').style.display='none';$('total-kills-label').textContent='STAGE';$('timer-label').textContent='RUN TIME';
    $('ammo-readout').style.display='none';$('weapon-rarity').textContent='';$('weapon-name').textContent='SURF';$('aim-status').textContent='';$('melee-status').textContent='';
    $('health-number').textContent=Math.round(Math.hypot(state.velocityX,state.velocityZ)*10)/10;$('health-bar').style.width='100%';
    $('kills').textContent=`${state.surfCheckpoint+1}/4`;
    $('weapon-name').textContent=`SURF · STAGE ${state.surfCheckpoint+1}/4`;
    return;
  }
  $('leaderboard').style.display='';$('total-kills-label').textContent='TOTAL KILLS';$('timer-label').textContent='TIME LEFT';
  const me=state.players[state.id];if(me){state.kills=me.kills??state.kills;state.health=me.health??state.health}$('kills').textContent=state.kills;$('health-number').textContent=Math.ceil(state.health);$('health-bar').style.width=`${state.health}%`;$('ammo').textContent=state.ammo;$('reserve').textContent='∞';$('ammo-readout').style.display=state.equipped==='bat'?'none':'';updateLeaderboard()
}
function addFeed(text){if(!text)return;const d=document.createElement('div');d.textContent=text;$('kill-feed').prepend(d);setTimeout(()=>d.remove(),4000)}
function spawnFor(i){const pts=MAPS[state.map].spawns,p=pts[i%pts.length];return{x:p[0],z:p[1]}}
function animate(){requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.04),now=performance.now();updateCursor();if(state.mode==='home'&&lobbyRenderer){updateLobbyLook(dt);lobbyRenderer.render(lobbyScene,lobbyCamera);return}updateAim(dt);if(state.matchActive){advanceMovement(dt);updateBots(dt);if(state.host){const me=state.players[state.id];if(me)Object.assign(me,{x:camera.position.x,y:camera.position.y,z:camera.position.z})}updatePickups(now);updateNetwork(now);updateTimer();syncMeshes(dt);updateHud()}if(state.map==='factory')updateFactoryEffects();updateWeaponMotion(dt,now);updateAimRecoil(dt,now);updateAutomaticFire();updateCombatVisuals(now);updateImpacts(now);updateRespawnCountdown();updateBuilding();updateFeel(dt,now);renderGameplay(now)}
function resize(){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)}
function clamp(v,a,b){return Math.max(a,Math.min(b,Number(v)||0))}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function leaveToHome(message=''){state.matchActive=false;state.practice=false;clearInput();controls.unlock();resetPeer();state.players={};playerMeshes.forEach(m=>world.remove(m));playerMeshes.clear();$('hud').classList.remove('active');$('respawn').classList.remove('active');showScreen('home');state.mode='home';document.querySelectorAll('[data-weapon]').forEach(b=>{b.classList.toggle('selected',b.dataset.weapon===state.selectedWeapon);b.setAttribute('aria-checked',b.dataset.weapon===state.selectedWeapon)});updateLobbyPreview();setError(message)}
function isPlaying(){return state.matchActive&&state.alive&&state.mode==='game'}
function clearInput(){stopEmote();state.slideUntil=0;state.landingGrace=0;slideView=landingKick=shotShake=0;$('speed-lines').classList.remove('active');$('target-card').classList.remove('visible');state.buildHeld=false;state.buildMode=false;if(buildGhost)buildGhost.visible=false;$('build-hint').textContent='';state.keys={};state.climbing=null;$('ladder-hint').textContent='';state.velocityX=state.velocityZ=state.hopChain=0;state.onRamp=false;state.jumpQueued=false;state.fireHeld=false;state.mouseX=null;state.mouseY=null;state.mouseOver=false;state.meleeStart=-Infinity;state.switchStart=state.inspectStart=-Infinity;state.switchPending=null;state.switchSwapped=false;weaponMotion.yaw=weaponMotion.pitch=null;weaponMotion.kick=0;weaponMotion.dip=weaponMotion.aimKick=0;resetAim()}
function focusGame(){$('game').focus({preventScroll:true})}
function updateCursor(){$('game').style.cursor=isPlaying()?'none':'auto';$('capture-mouse').hidden=!isPlaying()||controls.isLocked}
function useFallbackControls(){state.capturePending=false;state.pointerLockFailed=true;$('control-hint').textContent='MOUSE CAPTURE BLOCKED · OPEN THIS URL IN CHROME / EDGE FOR UNLIMITED MOUSE LOOK · ← / → ALSO TURN';$('control-hint').classList.remove('hidden')}
function handleMouseLook(e){
  // One rotation owner for both capture and fallback: no competing pitch limits.
  if(!isPlaying()||(!controls.isLocked&&e.target!==$('game')))return;
  let dx=0,dy=0;
  if(controls.isLocked){dx=Number.isFinite(e.movementX)?e.movementX:0;dy=Number.isFinite(e.movementY)?e.movementY:0;}
  else{
    // Embedded browsers can report zero or inconsistent movementX/Y. Screen
    // coordinates are stable here; re-entry only establishes a new baseline.
    if(Number.isFinite(e.clientX)&&Number.isFinite(e.clientY)){
      if(state.mouseX!==null&&state.mouseY!==null){dx=e.clientX-state.mouseX;dy=e.clientY-state.mouseY}
      state.mouseX=e.clientX;state.mouseY=e.clientY;
      if(Math.abs(dx)>innerWidth*.5||Math.abs(dy)>innerHeight*.5){dx=dy=0}
    }else{dx=Number.isFinite(e.movementX)?e.movementX:0;dy=Number.isFinite(e.movementY)?e.movementY:0}
  }
  state.mouseOver=true;
  const sensitivity=LOOK_RADIANS_PER_PIXEL*aimSensitivity();
  camera.rotation.order='YXZ';camera.rotation.y-=dx*sensitivity;
  camera.rotation.x=clamp(camera.rotation.x-dy*sensitivity,-1.45,1.45);camera.rotation.z=0;
}
function requestMouseCapture(){
  unlockAudio();
  if(isPlaying())focusGame();
  if(!isPlaying()||state.capturePending||controls.isLocked)return;
  if(!$('game').requestPointerLock){useFallbackControls();return}
  state.capturePending=true;
  try{const pending=$('game').requestPointerLock();if(pending?.catch)pending.catch(useFallbackControls);setTimeout(()=>{if(state.capturePending&&!controls.isLocked)useFallbackControls()},1500)}catch{useFallbackControls()}
}
function pauseGame(){if(!state.matchActive)return;state.mode='pause';clearInput();showScreen('pause');if(controls.isLocked)controls.unlock()}

function openSettings(){rebindingAction=null;state.mode='settings';renderKeybinds();showScreen('settings')}
function closeSettings(){rebindingAction=null;state.mode='home';showScreen('home');renderKeybinds()}
function remapKeyboardEvent(e){
  if(e.type==='keydown'&&rebindingAction){
    e.preventDefault();e.stopImmediatePropagation();
    if(e.code==='Escape'){rebindingAction=null;renderKeybinds()}else if(!e.repeat)setKeybind(rebindingAction,e.code);
    return;
  }
  if(e.type==='keydown'&&state.mode==='settings'&&e.code==='Escape'){e.preventDefault();e.stopImmediatePropagation();closeSettings();return}
  const mapped=canonicalCode(e.code);if(e.type==='keydown'&&mapped==='Space'&&!e.repeat&&isPlaying())state.jumpQueued=true;
  if(mapped!==e.code)try{Object.defineProperty(e,'code',{value:mapped})}catch{}
}
addEventListener('keydown',remapKeyboardEvent,true);addEventListener('keyup',remapKeyboardEvent,true);
addEventListener('keydown',e=>{if(state.matchActive&&!state.alive&&/^(Digit|Numpad)[1-4]$/.test(e.code)){e.preventDefault();chooseRespawnWeapon(Object.keys(WEAPONS)[Number(e.code.slice(-1))-1]);return}if(e.code==='Escape'&&state.matchActive&&state.mode==='game'){pauseGame();return}if(!isPlaying())return;if(['KeyW','KeyA','KeyS','KeyD','Space','KeyR','KeyF','KeyE','KeyB','KeyT','KeyL','KeyM','KeyI','ControlLeft','ControlRight','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight'].includes(e.code))e.preventDefault();state.keys[e.code]=true;if(e.code==='KeyM'&&!e.repeat){soundMuted=!soundMuted;if(audioMaster)audioMaster.gain.setTargetAtTime(soundMuted?0:.65,audioContext.currentTime,.012);toast(soundMuted?'Sound muted':'Sound on');unlockAudio();return}if(['ControlLeft','ControlRight'].includes(e.code)&&!e.repeat){beginSlide();return}if(e.code==='KeyL'&&!e.repeat){requestMouseCapture();return}if(e.code==='KeyB'&&!e.repeat){toggleBuilding();return}if(e.code==='KeyE'&&!e.repeat){interactOrEmote();return}if(e.code==='KeyI'&&!e.repeat){inspectWeapon();return}if(state.buildMode){if(e.code==='KeyT'&&!e.repeat)state.buildType=['wall','ramp','floor'][(['wall','ramp','floor'].indexOf(state.buildType)+1)%3];if(e.code==='KeyR'&&!e.repeat)state.buildRotation=(state.buildRotation+1)%4;return}if(['KeyR','KeyF','ShiftLeft','ShiftRight'].includes(e.code))stopEmote();if(e.code==='KeyR')reload();if(e.code==='KeyF'&&!e.repeat)toggleBat();if(['ShiftLeft','ShiftRight'].includes(e.code)&&!e.repeat&&state.equipped==='gun')state.aiming=!state.aiming});addEventListener('keyup',e=>state.keys[e.code]=false);
addEventListener('blur',clearInput);document.addEventListener('visibilitychange',()=>{if(document.hidden)clearInput()});
addEventListener('keydown',e=>{if(isPlaying()&&state.map==='surf'&&e.code==='KeyR'&&!e.repeat){e.preventDefault();resetSurfRun(true)}});
addEventListener('mousedown',e=>{if(!isPlaying()||(!controls.isLocked&&e.target!==$('game')))return;if(!controls.isLocked)requestMouseCapture();if(state.buildMode){if(e.button===0){focusGame();state.buildHeld=true;requestBuild()}if(e.button===2){e.preventDefault();toggleBuilding()}return}if(e.button===0||e.button===2)stopEmote();if(e.button===2){e.preventDefault();if(state.equipped==='gun')state.aiming=true;focusGame()}if(e.button===0){focusGame();if(!controls.isLocked)requestMouseCapture();if(state.equipped==='bat')meleeAttack();else{state.fireHeld=true;shoot()}}});addEventListener('mouseup',e=>{if(e.button===0){state.fireHeld=false;state.buildHeld=false;}if(e.button===2)state.aiming=false});document.addEventListener('contextmenu',e=>{if(state.matchActive)e.preventDefault()});addEventListener('mousemove',handleMouseLook);$('game').addEventListener('mouseleave',()=>{state.mouseOver=false;state.mouseX=null;state.mouseY=null;if(!controls.isLocked){state.aiming=false;state.fireHeld=false}});
$('capture-mouse').onclick=requestMouseCapture;
$('settings-open').onclick=openSettings;$('settings-close').onclick=closeSettings;
$('settings-reset').onclick=()=>{keybinds={...DEFAULT_BINDS};rebindingAction=null;saveKeybinds();renderKeybinds();toast('Default controls restored')};
$('keybind-list').onclick=e=>{const button=e.target.closest?.('[data-bind]');if(!button)return;rebindingAction=button.dataset.bind;renderKeybinds()};
$('create-room').onclick=createRoom;$('join-room').onclick=joinRoom;$('room-code-input').onkeydown=e=>{if(e.key==='Enter')joinRoom()};$('practice').onclick=practice;$('start-match').onclick=startMatch;$('copy-code').onclick=async()=>{try{await navigator.clipboard.writeText(state.room);toast('Room code copied')}catch{toast(`Room code: ${state.room}`)}};$('leave-lobby').onclick=()=>leaveToHome();$('resume').onclick=()=>{showScreen(null);state.mode='game';requestMouseCapture()};$('leave-match').onclick=()=>leaveToHome();$('play-again').onclick=returnLobby;$('results-home').onclick=()=>leaveToHome();

$('respawn-weapons').onclick=e=>{const button=e.target.closest('[data-respawn-weapon]');if(button)chooseRespawnWeapon(button.dataset.respawnWeapon)};
$('map-select').onchange=e=>{if(state.mode==='home'){setMap(e.target.value);updateLobbyModeUI()}};
function updateLobbyModeUI(){
  const surf=state.map==='surf';
  $('create-room').style.display=surf?'none':'';$('room-panel').style.display=surf?'none':'';
  $('practice').querySelector('span').textContent=surf?'Start Surfing':'Practice';
  $('practice').querySelector('small').textContent=surf?'Four-stage skill course · no combat':'Play against bots';
  $('match-badge').innerHTML=surf?'Solo <span>CS-style surf</span>':'Free-for-all <span>3-minute rounds</span>';
  $('match-summary').textContent=surf?'Jump in · hold A/D into the bank · tap jump to cross gaps · R restarts':state.map==='factory'?'Three floors: climb E-ladders from ground to mezzanines, then up to the bridge. Belts carry you; steam hides players but not bullets.':'Most eliminations wins. Respawn and keep playing.';
  $('win-rule').textContent=surf?'Reach the gold finish gate. Falling returns you to the latest checkpoint.':'Most eliminations in 3 minutes wins.';
}
renderKeybinds();buildChoices();initWorld();showScreen('home');
