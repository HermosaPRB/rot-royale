import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { detailPlaza } from './plaza.js?v=detail-6';
import { createWoodenCharacter } from './wooden-character.js?v=grip-62';
import { createNeegyCharacter } from './neegy-character.js?v=grip-62';
import { createHeldGun, createFirstPersonWeapon, createMeleeBat, createMeleeKnife } from './combat-models.js?v=airdrop-52';
import { createDinoPlane, createSupplyCrate, createParachute, createBeacon, createSpecialGun, animateSpecialGun, createRocket, createOrb, createBlastFx, createVortexFx, disposeFx } from './airdrop.js?v=airdrop-52';
import { mergeRigidParts } from './surface-details.js?v=detail-6';
import { buildNeonTown, createPickupMesh } from './neon-town.js?v=polish-46';
import { buildMozzarellaFactory, factoryConveyorAt, factorySteamBlocksSight, updateFactoryEffects } from './mozzarella-factory.js?v=polish-46';
import { buildSurfMap, SURF_FLOOR_Y, SURF_SPAWN, SURF_FINISH_Z, SURF_CHECKPOINTS } from './surf.js?v=surf-33';

const $ = (id) => document.getElementById(id);
const screens = ['home','settings','lobby','pause','results'];
const DEFAULT_PREFERENCES={sensitivity:1,ads:1,invertY:false,cameraShake:true};
function normalizePreferences(raw={}){raw=raw&&typeof raw==='object'?raw:{};return {sensitivity:Number.isFinite(raw.sensitivity)?Math.max(.2,Math.min(3,raw.sensitivity)):1,ads:Number.isFinite(raw.ads)?Math.max(.2,Math.min(2,raw.ads)):1,invertY:raw.invertY===true,cameraShake:raw.cameraShake!==false}}
let preferences={...DEFAULT_PREFERENCES};try{preferences=normalizePreferences(JSON.parse(localStorage.getItem('rot-preferences-v1')))}catch{}
function savePreferences(){try{localStorage.setItem('rot-preferences-v1',JSON.stringify(preferences))}catch{}}
function renderPreferences(){for(const key of Object.keys(DEFAULT_PREFERENCES)){const input=$('pref-'+key);if(!input)continue;if(input.type==='checkbox')input.checked=preferences[key];else{input.value=preferences[key];$('value-'+key).textContent=preferences[key].toFixed(2)+'×'}input.oninput=()=>{preferences[key]=input.type==='checkbox'?input.checked:Number(input.value);preferences=normalizePreferences(preferences);savePreferences();if(input.type!=='checkbox')$('value-'+key).textContent=preferences[key].toFixed(2)+'×'}}}
const DEFAULT_BINDS={
  forward:'KeyW',back:'KeyS',left:'KeyA',right:'KeyD',jump:'Space',aim:'ShiftLeft',
  melee:'KeyF',reload:'KeyR',emote:'KeyE',build:'KeyB',buildType:'KeyT',inspect:'KeyI',
  slide:'ControlLeft',sound:'KeyM',capture:'KeyL',turnLeft:'ArrowLeft',turnRight:'ArrowRight',
  loadout1:'Digit1',loadout2:'Digit2',loadout3:'Digit3',loadout4:'Digit4',voice:'KeyV',talk:'KeyG',airdropWeapon:'KeyQ'
};
const BIND_LABELS={
  forward:'Move forward',back:'Move backward',left:'Move left',right:'Move right',jump:'Jump / bunny hop',
  aim:'Aim',melee:'Gun / bat',reload:'Reload / rotate build',emote:'Emote / interact',build:'Build mode',
  buildType:'Change build piece',inspect:'Inspect weapon',slide:'Slide',sound:'Toggle sound',
  capture:'Capture mouse',turnLeft:'Keyboard turn left',turnRight:'Keyboard turn right',
  loadout1:'Death loadout 1',loadout2:'Death loadout 2',loadout3:'Death loadout 3',loadout4:'Death loadout 4',voice:'Voice chat on / off',talk:'Talk to bots (hold)',airdropWeapon:'Normal / airdrop gun'
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
  updateVoiceUi();
}
function setKeybind(action,code){
  const old=keybinds[action],conflict=Object.keys(keybinds).find(other=>other!==action&&keybinds[other]===code);
  if(conflict)keybinds[conflict]=old;
  keybinds[action]=code;rebindingAction=null;saveKeybinds();renderKeybinds();
}
const CHARACTERS = [
  {id:'wooden',name:'Bonkwood',emoji:'🪵',portrait:'./assets/wooden-bonker.png',color:0xc18a43,shape:'wooden'},
  {id:'neegy',name:'Neegy',emoji:'🥇',color:0xe5ac24,shape:'neegy'}
];
const WEAPONS = {
  ar:{name:'Espresso AR',icon:'☕',automatic:true,damage:18,rate:115,mag:30,reserve:90,reload:1450,spread:.006,pellets:1,range:72,color:0xe85b39,move:1},
  shotgun:{name:'Biscotti Boomstick',icon:'🥨',damage:10,rate:720,mag:6,reserve:30,reload:1900,spread:.085,pellets:10,range:22,color:0xd9ad6b,move:.94},
  sniper:{name:'Lungo Sniper',icon:'🥄',damage:95,rate:780,mag:5,reserve:20,reload:1900,spread:.09,adsSpread:.0005,pellets:1,range:120,color:0x39bfc2,move:.92},
  smg:{name:'Ristretto SMG',icon:'⚡',automatic:true,damage:11,rate:72,mag:40,reserve:120,reload:1350,spread:.015,pellets:1,range:52,color:0xea4f8f,move:1.14}
};

const state = {
  mode:'home',host:false,practice:false,voiceOn:false,peer:null,conn:null,connections:new Map(),room:'',id:'',
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
const combatHistory=new Map(),predictedShots=new Set();let shotSerial=0;
const NET_REWIND_MS=350;
function recordCombatHistory(now,players=state.players){
  for(const p of Object.values(players)){
    let h=combatHistory.get(p.id);if(!h){h=[];combatHistory.set(p.id,h)}
    const sample={time:now,x:p.x||0,y:p.y??1.7,z:p.z||0,yaw:p.yaw||0,sliding:!!p.sliding,deaths:p.deaths||0};
    if(h.at(-1)?.time===now)h[h.length-1]=sample;else h.push(sample);
    while(h.length>2&&h[1].time<now-600)h.shift();
  }
  for(const id of combatHistory.keys())if(!players[id])combatHistory.delete(id);
}
function rewindCombatPose(p,time,now){
  if(!Number.isFinite(time)||time>now+5||time<now-NET_REWIND_MS)return p;
  const h=combatHistory.get(p.id);if(!h?.length)return p;
  const valid=s=>s.deaths===(p.deaths||0);
  for(let i=1;i<h.length;i++)if(h[i].time>=time){
    const a=h[i-1],b=h[i];if(!valid(a)||!valid(b)||time<a.time||Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z)>12)return p;
    const t=(time-a.time)/Math.max(1,b.time-a.time);
    return {...p,sampleTime:time,x:THREE.MathUtils.lerp(a.x,b.x,t),y:THREE.MathUtils.lerp(a.y,b.y,t),z:THREE.MathUtils.lerp(a.z,b.z,t),yaw:a.yaw+Math.atan2(Math.sin(b.yaw-a.yaw),Math.cos(b.yaw-a.yaw))*t,sliding:t<.5?a.sliding:b.sliding};
  }
  return p;
}
const coffeeBursts=[],deathEffects=[];let coffeeGeometry,coffeeMaterial;
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
const DEATH_ANIMATION_MS=1050;
function markEliminated(id){
  if(hitReactions.get(id)?.killed)return;
  const side=String(id).split('').reduce((sum,c)=>sum+c.charCodeAt(0),0)%2?1:-1;
  hitReactions.set(id,{...(hitReactions.get(id)||{}),killed:true,time:performance.now(),side});
  const p=state.players[id];if(p&&world)showDeathEffect(p);
}
const SLIDE_DURATION=950,SLIDE_DROP=.78;
function beginSlide(){if(!isPlaying()||!state.onGround||state.climbing!==null||performance.now()<state.slideCooldown||Math.hypot(state.velocityX,state.velocityZ)<7)return;stopEmote();const speed=Math.hypot(state.velocityX,state.velocityZ),boost=Math.max(14,speed*1.10)/speed;state.velocityX*=boost;state.velocityZ*=boost;state.slideUntil=performance.now()+SLIDE_DURATION;state.slideCooldown=performance.now()+1250;tone(130,.18,.025,'triangle',0,45)}
function slideVelocity(vx,vz,wx,wz,age,dt){
  // Glide in the entry direction. Steering bends the path, never snaps/reverses it.
  const speed=Math.hypot(vx,vz)*Math.exp(-(.28+1.35*age*age)*dt);
  let angle=Math.atan2(vz,vx);
  if(wx*wx+wz*wz>.01){const target=Math.atan2(wz,wx),delta=Math.atan2(Math.sin(target-angle),Math.cos(target-angle));angle+=clamp(delta,-.85*dt,.85*dt)}
  return {x:Math.cos(angle)*speed,z:Math.sin(angle)*speed};
}
function movementSpeed(){return state.equipped==='bat'?1.08:gunStats().move||1}
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
  updateCrosshair(now);
}
// Gap = the real hip-fire cone in pixels, so the crosshair never lies about where shots can land.
const CROSSHAIR_MIN_GAP={ar:4,smg:7,shotgun:15,sniper:5,rpg:10,toilet:12};
function steadiness(now){return smoothStep((now-(state.stillSince??now)-120)/650)}
function updateCrosshair(now){
  const el=$('crosshair'),type=state.equipped==='bat'?'melee':activeType();
  const moving=!state.onGround||state.slideUntil>now||Math.hypot(state.velocityX,state.velocityZ)>1.2;
  if(moving||!isPlaying())state.stillSince=now;
  if(el.dataset.type!==type){el.className='crosshair ch-'+type;el.dataset.type=type}
  if(type==='melee')return;
  const w=gunStats(),steady=type==='sniper'?steadiness(now):0;
  const spread=THREE.MathUtils.lerp(w.spread,SNIPER_STILL_SPREAD,steady)+localHeat(now);
  const px=(spread/2)/Math.tan(THREE.MathUtils.degToRad(38))*innerHeight/2;
  el.style.setProperty('--gap',(Math.max(CROSSHAIR_MIN_GAP[type],px)+weaponMotion.kick*(type==='shotgun'?7:4)).toFixed(1)+'px');
  el.classList.toggle('settled',type==='sniper'&&steady>.95);
}
function renderGameplay(now){
  const view=gameplayCamera();if(view!==camera||!isPlaying()){renderer.render(scene,view);return}
  const y=camera.position.y,pitch=camera.rotation.x,roll=camera.rotation.z,reduced=!preferences.cameraShake||globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
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
  sniper:{fov:22,raise:.20,lower:.16,kick:.075,settle:10,label:'4× SCOPE'},
  rpg:{fov:62,raise:.28,lower:.17,kick:.1,settle:7,label:'ROCKET SIGHT'},
  toilet:{fov:66,raise:.22,lower:.15,kick:.07,settle:9,label:'FLUSH SIGHT'}
};
// Per-gun identity. pitch/yaw: camera punch per shot (rad); recover: return speed once you stop firing;
// bloom: spread added per sustained shot (host-authoritative); back/rise/roll/jitter: viewmodel motion.
const SNIPER_STILL_SPREAD=.004;
const WEAPON_FEEL={
  ar:{pitch:.0075,yaw:.0028,yawBias:.55,recover:6,bloom:.003,bloomMax:.022,heatDecay:1.8,back:.085,rise:1,roll:.025,rollRandom:false,jitter:0,flash:[1.15,1.4],flashMs:42,tracer:[0xffd575,.016,120],remoteKick:.085},
  smg:{pitch:.0032,yaw:.0062,yawBias:0,recover:10,bloom:.0016,bloomMax:.016,heatDecay:2.6,back:.045,rise:.5,roll:.05,rollRandom:true,jitter:.011,flash:[.75,.85],flashMs:28,tracer:[0xff9ec0,.009,85],remoteKick:.05},
  shotgun:{pitch:.06,yaw:.012,yawBias:0,recover:4,bloom:0,bloomMax:0,heatDecay:1,back:.19,rise:1.7,roll:.07,rollRandom:true,jitter:0,flash:[2.4,1.2],flashMs:70,tracer:[0xffa24a,.011,80],thump:62,push:3,remoteKick:.17},
  sniper:{pitch:.085,yaw:.007,yawBias:.35,recover:2.4,bloom:0,bloomMax:0,heatDecay:1,back:.23,rise:1.4,roll:-.045,rollRandom:false,jitter:0,flash:[1,2.9],flashMs:55,tracer:[0x8deaff,.03,320],thump:46,remoteKick:.19},
  rpg:{pitch:.11,yaw:.01,yawBias:0,recover:2.2,bloom:0,bloomMax:0,heatDecay:1,back:.26,rise:1.3,roll:.05,rollRandom:true,jitter:0,flash:[2.2,1.6],flashMs:90,tracer:[0xffa24a,.02,100],thump:48,push:2.2,remoteKick:.2},
  toilet:{pitch:.03,yaw:.006,yawBias:0,recover:4,bloom:0,bloomMax:0,heatDecay:1,back:.12,rise:.9,roll:.04,rollRandom:true,jitter:.006,flash:[1.6,1],flashMs:80,tracer:[0x5fd0ff,.02,100],remoteKick:.12}
};
const aimRecoil={target:{x:0,y:0},applied:{x:0,y:0}};
const shotHeat=new Map();
function decayedHeat(id,now,feel){const h=shotHeat.get(id);return h?h.v*Math.exp(-(now-h.t)/1000*feel.heatDecay):0}
function localHeat(now){return (state.localHeat||0)*Math.exp(-(now-(state.localHeatAt||0))/1000*WEAPON_FEEL[activeType()].heatDecay)}
function updateAimRecoil(dt,now){
  const feel=WEAPON_FEEL[activeType()],w=gunStats(),t=aimRecoil.target,a=aimRecoil.applied;
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
function updateLobbyLook(dt){if(!lobbyFighter)return;const blend=1-Math.exp(-10*dt),now=performance.now(),breath=Math.sin(now*.0022)*.006;lobbyFighter.rotation.y=THREE.MathUtils.lerp(lobbyFighter.rotation.y,-.2+lobbyLook.x*.85,blend);lobbyFighter.position.y=THREE.MathUtils.lerp(lobbyFighter.position.y,breath,blend);const torso=lobbyFighter.userData.avatar?.userData.danceTorso;if(torso){torso.rotation.x=THREE.MathUtils.lerp(torso.rotation.x,-lobbyLook.y*.12+Math.sin(now*.0016)*.008,blend);torso.rotation.y=THREE.MathUtils.lerp(torso.rotation.y,lobbyLook.x*.06,blend)}const gun=lobbyFighter.userData.gun;if(gun&&torso){gun.position.set(.06,(gun.userData.holdY||0)-.75,gun.userData.holdZ||0).applyEuler(torso.rotation);gun.position.y+=.75;gun.rotation.copy(torso.rotation)}}

const weaponLabels={ar:'AR',shotgun:'SHOTGUN',sniper:'SNIPER',smg:'SMG'};
const weaponDescriptions={ar:'Climbs up-right / tap for pinpoint accuracy',shotgun:'10-pellet blast / huge kick + shoves you back',sniper:'Quick scope / hard-hitting precision shots',smg:'Jittery spray / +14% movement'};
// Shared sensitivity keeps captured and embedded-browser mouse look consistent.
const LOOK_RADIANS_PER_PIXEL=.00656;
const colliders=[];
const ladders=[];
const shotBlockers=[];
const materials=new Map();
const MAPS={neon:{name:'NEON TOWN',description:'Two houses · vehicle choke · garden flanks',spawns:[[-18,-27],[18,27],[-27,0],[27,0],[-4,-28],[4,28]],pickups:[['case',-22,25],['case',22,-25],['health',0,-20],['health',0,20],['health',-14,0]],sky:0x96cfeb},piazza:{name:'PIAZZA PANIC',description:'Italian plaza · markets · fountain cover',spawns:[[-25,-29],[25,23],[-23,24],[25,-29],[0,30],[0,-30]],pickups:[['case',-30,0],['case',30,0],['health',0,26],['health',0,-26],['health',-22,5]],sky:0x82c9e8},factory:{name:'MIDNIGHT MOZZARELLA',description:'Compact three-floor factory · twin belts · dense machinery cover',spawns:[[-18,-20],[18,20],[-18,20],[18,-20],[0,-22],[0,22]],pickups:[['case',-21.5,0],['case',21.5,0],['health',0,-22],['health',0,22]],sky:0x142b43}};
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
  for(const burst of coffeeBursts)burst.mesh.dispose();for(const effect of deathEffects){effect.ring.geometry.dispose();effect.ring.material.dispose();effect.drops.geometry.dispose();effect.drops.material.dispose()}if(tracerMesh){tracerMesh.dispose();tracerMesh.geometry.dispose();tracerMesh.material.dispose()}
  world.clear();playerMeshes.clear();hitModels.clear();pickupMeshes.clear();coffeeBursts.length=deathEffects.length=0;tracerMesh=null;tracerSlots.forEach(s=>s.born=-Infinity);colliders.length=shotBlockers.length=ladders.length=0;state.climbing=null;
  if(mapCache.has(id)){const saved=mapCache.get(id);world.add(...saved.children);colliders.push(...saved.colliders);shotBlockers.push(...saved.blockers);ladders.push(...saved.ladders)}else{if(id==='neon')buildNeonTown({world,colliders,shotBlockers,mat,ladders});else if(id==='factory')buildMozzarellaFactory({world,colliders,shotBlockers,mat,ladders});else if(id==='surf')buildSurfMap({world,colliders,shotBlockers,mat,ladders});else makePlaza();mapCache.set(id,{children:[...world.children],colliders:[...colliders],blockers:[...shotBlockers],ladders:[...ladders]})}
  builtMap=id;
  scene.background.set(MAPS[id].sky||0x82c9e8);scene.fog.color.copy(scene.background);
  const sun=scene.getObjectByName('arena-sun'),ambient=scene.getObjectByName('arena-ambient');if(sun)sun.intensity=id==='factory'?1.3:3.2;if(ambient)ambient.intensity=id==='factory'?1.5:2.2;
  const cached=mapCache.get(id);cached.pickups??=MAPS[id].pickups.map(([kind,x,z])=>{const mesh=createPickupMesh(kind);mesh.position.set(x,0,z);return mesh});cached.pickups.forEach((mesh,i)=>{world.add(mesh);pickupMeshes.set(i,mesh)});
}
function resetPickups(){caseWaits.clear();state.pickups=MAPS[state.map].pickups.map(([kind,x,z],id)=>({id,kind,x,z,readyAt:Date.now()+(kind==='case'?20000:0)}))}
function applyLootAward(d){
  if(!state.matchActive||!Object.hasOwn(WEAPONS,d.weapon))return;
  stopEmote();
state.arsenal={...d.arsenal};state.selectedWeapon=d.weapon;state.pendingWeapon=d.weapon;state.equipped='gun';state.reloading=false;state.fireHeld=false;resetAim();state.normalGunAmmo=WEAPONS[d.weapon].mag;if(!state.special)state.ammo=state.normalGunAmmo;
  const me=state.players[state.id];if(me)Object.assign(me,{weapon:d.weapon,nextWeapon:d.weapon,arsenal:{...state.arsenal},equipped:'gun'});
  updateWeaponModel();updateHud();const w=weaponStats(d.weapon),r=RARITIES[w.tier];
  $('loot-notice').textContent=`${r.name} UNLOCK · ${w.name} · +${Math.round((r.damage-1)*100)}% damage`;$('loot-notice').style.color='#'+r.color.toString(16).padStart(6,'0');state.lootNoticeUntil=performance.now()+4200;
}
const caseWaits=new Map();
function caseReady(p,item,now){const key=p.id+':'+item.id,old=caseWaits.get(key);
  if(!p.alive||p.grounded===false||(p.y??1.7)>2.7||Math.hypot(p.x-item.x,p.z-item.z)>2){caseWaits.delete(key);return false}
  if(!old||Math.hypot(p.x-old.x,p.z-old.z)>.08||now-old.last>250){caseWaits.set(key,{x:p.x,z:p.z,since:now,last:now});return false}
  old.last=now;return now-old.since>=600;
}
function updatePickups(now){
  if(!state.matchActive||airdropFrozen())return;
  if(state.host){
    // The host owns availability, proximity, rarity rolls and health; clients cannot claim rewards.
    for(const item of state.pickups){if(Date.now()<item.readyAt)continue;
      for(const p of Object.values(state.players)){
        if(item.kind==='case'){if(p.bot||!caseReady(p,item,now))continue}
        else if(!p.alive||(p.y??1.7)>2.7||Math.hypot(p.x-item.x,p.z-item.z)>1.35)continue;
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
  // Capture the existing model once; the fighter tile needs no extra renderer or animation loop.
  const portraitScene=new THREE.Scene(),portraitCamera=new THREE.PerspectiveCamera(32,1,.1,10),portrait=createNeegyCharacter('preview');
  portraitScene.add(portrait,new THREE.HemisphereLight(0xfff7dc,0x416c83,2.8));const portraitKey=new THREE.DirectionalLight(0xffe6b7,3);portraitKey.position.set(-3,5,-4);portraitScene.add(portraitKey);
  portraitCamera.position.set(0,1.9,-2.7);portraitCamera.lookAt(0,1.9,0);lobbyRenderer.setSize(160,160,false);lobbyRenderer.render(portraitScene,portraitCamera);
  CHARACTERS.find(c=>c.id==='neegy').portrait=lobbyRenderer.domElement.toDataURL('image/png');buildChoices();
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
  const special=state.special?.type,w=gunStats(),key=special?'special:'+special:state.selectedWeapon+':'+w.tier;
  if(weaponModel.userData.key!==key){
    if(!weaponRigs.has(key))weaponRigs.set(key,special?createFirstPersonWeapon(w.color,'ar',0,createSpecialGun(special,true)):createFirstPersonWeapon(w.color,state.selectedWeapon,w.tier));
    weaponModel.clear();weaponModel.add(weaponRigs.get(key));weaponModel.userData.type=activeType();weaponModel.userData.key=key;weaponModel.userData.rig=weaponRigs.get(key);
  }
  const goldHands=state.selectedChar==='neegy',color=goldHands?0xe5ac24:0xd8954d;
  for(const name of ['trigger','support'])weaponModel.userData.rig.userData[name].traverse(m=>{if(m.isMesh){m.material.color.set(color);m.material.metalness=goldHands?.55:0;m.material.roughness=goldHands?.32:.56}});
  const fist=meleeModel?.getObjectByName('melee-hand');if(fist){fist.material.color.set(color);fist.material.metalness=goldHands?.55:0;fist.material.roughness=goldHands?.32:.56}
  $('weapon-name').textContent=state.equipped==='bat'?meleeLabel():w.name.toUpperCase();$('ammo').textContent=state.ammo;$('reserve').textContent=special&&Number.isFinite(state.special.reserve)?state.special.reserve:'∞';
  if(special&&state.equipped!=='bat'){$('weapon-rarity').textContent='AIRDROP · YOURS THIS MATCH';$('weapon-rarity').style.color='#ff9a3c';return}
  $('weapon-rarity').textContent=state.equipped==='bat'?'':w.tier?`${RARITIES[w.tier].name} · +${Math.round((RARITIES[w.tier].damage-1)*100)}% DAMAGE`:'STANDARD';$('weapon-rarity').style.color='#'+RARITIES[w.tier].color.toString(16).padStart(6,'0');
}

function createPlayerMesh(p,register=true,collisionOnly=false){
  const c=CHARACTERS.find(x=>x.id===p.char)||CHARACTERS[0],g=new THREE.Group();g.userData.playerId=p.id;g.userData.characterShape=c.shape;
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
  const tier=weaponTier(p.weapon,p.arsenal||{}),gun=createHeldGun(tier?RARITIES[tier].color:WEAPONS[p.weapon]?.color||0x333333,p.weapon||'ar',!register&&!collisionOnly,tier);poseHeldGun(gun,c.shape);g.add(gun);
  const bat=c.shape==='neegy'?createMeleeKnife():createMeleeBat();bat.visible=false;
  if(g.userData.avatar){const grip=g.userData.avatar.getObjectByName('trigger-hand');grip.add(bat);bat.position.y=-.13;bat.rotation.x=-.25}else{g.add(bat);bat.position.set(.35,1.25,-.45)}
  g.userData.bat=bat;g.traverse(m=>{if(m.isMesh)m.userData.playerId=p.id});
  g.userData.gun=gun;g.userData.weaponType=p.weapon;g.userData.weaponTier=tier;
if(register){const color=new THREE.Color().setHSL(((String(p.id).split('').reduce((n,c)=>n+c.charCodeAt(0),0)*47)%360)/360,.8,.62),halo=new THREE.Mesh(new THREE.RingGeometry(.58,.68,24),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.8,side:THREE.DoubleSide,depthWrite:false}));halo.rotation.x=-Math.PI/2;halo.position.y=.025;halo.userData.noHit=true;g.add(halo);g.userData.halo=halo;const band=new THREE.Mesh(new THREE.TorusGeometry(c.shape==='neegy'?.235:c.shape==='wooden'?.30:.54,.045,5,16),new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:.35,roughness:.5}));band.rotation.x=Math.PI/2;band.position.y=1.12;band.userData.noHit=true;(g.userData.avatar?.userData.danceTorso||g).add(band);if(g.userData.avatar)band.position.y-=.75}
  if(register){const tag=document.createElement('div');tag.className='name-tag';g.userData.tag=tag;world.add(g);playerMeshes.set(p.id,g)}return g;
}
function poseHeldGun(gun,shape){
  if(shape==='wooden'||shape==='neegy'){
    // Bring the rifle in front of the chest, with clearance behind the stock.
    gun.scale.setScalar(.78);
    gun.position.x=.06;
    gun.position.z=gun.userData.holdZ=-.60;
    gun.position.y=gun.userData.holdY=1.4*(1-.78);
    gun.rotation.y=0;
  }
}
// Bound animation cadence, never player velocity: fast bhops remain uncapped.
function strideAdvance(speed,dt){return Math.min(16,Math.max(0,speed)*2.6)*Math.max(0,dt)}
function syncMeshes(dt=1/60){
  const now=performance.now(),blend=1-Math.exp(-13*dt),poseBlend=1-Math.exp(-18*dt);
  const networked=!state.practice&&state.matchActive&&Number.isFinite(state.netSnapshotTime);
  const serverNow=state.host?now:state.netSnapshotTime+Math.min(100,now-(state.netReceivedAt??now));
  // Render from the same timestamped poses used for host hit checks. Extra
  // position damping would otherwise move the visible body off its hitbox.
  const viewTime=Math.min(state.netSnapshotTime,Math.max(state.netRenderTime??-Infinity,serverNow-65));
  if(networked)state.netRenderTime=viewTime;
  const damp=(value,target,rate=18)=>THREE.MathUtils.lerp(value,target,1-Math.exp(-rate*dt));
  Object.values(state.players).forEach(p=>{
    if(p.id===state.id)return;if(p.alive!==false&&hitReactions.get(p.id)?.killed)hitReactions.delete(p.id);if(p.alive===false&&!hitReactions.get(p.id)?.killed)markEliminated(p.id);const m=playerMeshes.get(p.id)||createPlayerMesh(p),u=m.userData,reaction=hitReactions.get(p.id),deathAge=reaction?.killed?now-reaction.time:Infinity;m.visible=p.alive!==false||deathAge<DEATH_ANIMATION_MS;
    const tier=weaponTier(p.weapon,p.arsenal||{}),held=SPECIALS[p.special]?p.special:p.weapon;if((WEAPONS[held]||SPECIALS[held])&&(u.weaponType!==held||u.weaponTier!==tier)){m.remove(u.gun);u.gun=SPECIALS[held]?createSpecialGun(held,false):createHeldGun(tier?RARITIES[tier].color:WEAPONS[held].color,held,false,tier);poseHeldGun(u.gun,u.characterShape);u.gun.traverse(part=>{if(part.isMesh)part.userData.playerId=p.id});m.add(u.gun);u.weaponType=held;u.weaponTier=tier}
    const shown=networked?rewindCombatPose(p,viewTime,serverNow):p;
    const x=shown.x||0,z=shown.z||0,dx=x-m.position.x,dz=z-m.position.z,teleport=!u.initialized||Math.hypot(dx,dz)>12;
    const distance=teleport?0:Math.hypot(dx,dz)*(networked?1:blend),y=Math.max(0,(shown.y??1.7)-1.7);
    m.position.x=teleport||networked?x:m.position.x+dx*blend;m.position.z=teleport||networked?z:m.position.z+dz*blend;m.position.y=teleport||networked?y:THREE.MathUtils.lerp(m.position.y,y,blend);
    if(networked)u.netTime=shown.sampleTime??state.netSnapshotTime;
    const yaw=shown.yaw||0,turn=Math.atan2(Math.sin(yaw-m.rotation.y),Math.cos(yaw-m.rotation.y));m.rotation.y+=teleport||networked?turn:turn*blend;u.initialized=true;
    const speed=distance/Math.max(.001,dt);u.speed=damp(u.speed||0,speed,10);u.walk=damp(u.walk||0,Math.min(1,u.speed/5),11);u.air=damp(u.air||0,p.grounded===false?1:0,13);u.slide=damp(u.slide||0,p.sliding&&p.grounded!==false?1:0,p.sliding?19:11);
    if(teleport){u.speed=0;u.walk=0;u.landAt=-Infinity;u.wasGround=p.grounded}
    u.stride=((u.stride||0)+strideAdvance(u.speed,dt)*(1-u.air)*(1-u.slide))%(Math.PI*2);
    const avatar=u.avatar,elapsed=now-(meleeVisuals.get(p.id)??-Infinity),swing=elapsed>=0&&elapsed<MELEE.duration&&p.alive!==false;
    const holding=p.equipped==='bat';u.gun.visible=!swing&&!holding;u.bat.visible=swing||holding;
    const flinch=reaction?Math.max(0,1-(now-reaction.time)/380):0,deathKneel=reaction?.killed?smoothStep(clamp(deathAge/150,0,1))*(1-smoothStep(clamp((deathAge-150)/650,0,1))):0,deathFall=reaction?.killed?smoothStep(clamp((deathAge-150)/720,0,1)):0;
    const sideSpeed=teleport?0:(dx*Math.cos(yaw)-dz*Math.sin(yaw))*blend/Math.max(dt,.001),turnLean=clamp(turn*.35,-.055,.055)*u.walk,moveLean=clamp(sideSpeed*.006,-.06,.06),hitPitch=-Math.sin(flinch*Math.PI)*(reaction?.headshot?.16:.07);
    m.rotation.x=damp(m.rotation.x,reaction?.killed?-.12*deathFall:hitPitch,reaction?.killed?11:22);m.rotation.z=damp(m.rotation.z,reaction?.killed?(reaction.side||1)*1.35*deathFall:Math.sin(flinch*Math.PI)*.045-turnLean-moveLean,15);
    if(reaction?.killed)m.position.y=y-.06*deathKneel+.3*deathFall;
    if(u.wasGround===false&&p.grounded!==false)u.landAt=now;u.wasGround=p.grounded;
    const landAge=now-(u.landAt??-Infinity),landing=landAge<260?Math.sin(Math.min(1,landAge/260)*Math.PI):0,slide=u.slide;
    m.scale.y=damp(m.scale.y,1-landing*.025,16);if(u.halo)u.halo.visible=p.alive!==false;
    // Breathing, recoil and footfalls use damped values so low-rate network snapshots never pop.
    const step=Math.sin(u.stride),gait=u.walk*(1-u.air)*(1-slide),lift=Math.sin(now*.002+p.id.length)*.006+(1-Math.cos(u.stride*2))*.009*gait-landing*.055;
    const shotAge=now-(remoteShotTimes.get(p.id)??-Infinity),recoil=shotAge<220?Math.sin(Math.min(1,shotAge/220)*Math.PI)*(WEAPON_FEEL[p.weapon]?.remoteKick??.085):0;
    if(p.reloading&&!u.wasReloading)u.reloadAt=now;u.wasReloading=!!p.reloading;const reloadT=p.reloading?(now-(u.reloadAt||now))/900:0,reloadDip=p.reloading?Math.sin(Math.min(1,reloadT)*Math.PI):0;
    u.gun.position.y=damp(u.gun.position.y,(u.gun.userData.holdY||0)+lift-reloadDip*.05-slide*.62-deathKneel*.15,22);u.gun.rotation.x=damp(u.gun.rotation.x,p.reloading?-.38:slide*.08+deathFall*.24,14);u.gun.rotation.z=damp(u.gun.rotation.z,p.reloading?-.10:slide*.13+deathFall*.18,14);u.gun.position.z=damp(u.gun.position.z,(u.gun.userData.holdZ||0)+recoil+slide*.10,28);
    if(!u.gun.userData.flash){const flash=new THREE.Mesh(new THREE.ConeGeometry(.10,.22,5),new THREE.MeshBasicMaterial({color:tier?RARITIES[tier].color:0xffd875,transparent:true,opacity:.85,depthWrite:false}));flash.rotation.x=-Math.PI/2;flash.position.z=-.07;flash.userData.noHit=true;u.gun.userData.muzzle.add(flash);u.gun.userData.flash=flash}u.gun.userData.flash.visible=now-(remoteShotTimes.get(p.id)??-Infinity)<65&&p.alive!==false;
    if(avatar){avatar.position.y=damp(avatar.position.y,lift-slide*.64-deathKneel*.16,20);
      const torso=avatar.userData.danceTorso,emoting=p.emoteUntil>Date.now();if(torso&&!emoting){torso.position.x=damp(torso.position.x,step*.008*gait,12);torso.position.y=damp(torso.position.y,.75-slide*.04-deathKneel*.08,16);torso.position.z=damp(torso.position.z,slide*.09+deathKneel*.12,16);torso.rotation.x=damp(torso.rotation.x,slide*.30-landing*.055-.035*gait-deathKneel*.25,16);torso.rotation.y=damp(torso.rotation.y,step*.012*gait*(p.aiming?.25:1),12);torso.rotation.z=damp(torso.rotation.z,-step*.012*gait+slide*.045+(reaction?.side||1)*deathKneel*.12,12)}
      avatar.userData.legs.forEach((leg,i)=>{const phase=u.stride+i*Math.PI,walkX=Math.sin(phase)*.58*u.walk*(1-u.air)*(1-slide),airX=(-.30+(i?-.08:.04))*u.air,targetX=walkX+airX+landing*(i?-.12:.12)+slide*(i?1.28:1.40)+deathKneel*(i?-.5:.8)+deathFall*(i?.25:-.35);leg.rotation.x=damp(leg.rotation.x,targetX,20);leg.rotation.z=damp(leg.rotation.z,u.air*(i?-.13:.13)+landing*(i?-.045:.045)+slide*(i?-.16:.12)+deathFall*(i?-.12:.12),18)});
      avatar.userData.arms.forEach((arm,i)=>{const arc=swing?Math.sin(Math.min(1,elapsed/MELEE.duration)*Math.PI):0,walkArm=Math.sin(u.stride+i*Math.PI)*.045*u.walk*(1-slide);let targetX=walkArm,targetZ=0;if(swing){targetX=i===1?-1.05+arc*1.95:.38-arc*.16;targetZ=i===1?-.52*arc:.08*arc}else if(holding){targetX=i===1?-.50:.30}else if(p.reloading){targetX=i===1?-.34+reloadDip*.18:.62-reloadDip*.2;targetZ=i===1?-.10*reloadDip:.08*reloadDip}else if(p.aiming){targetX=i===1?-.035:.03}targetX-=slide*.24+deathKneel*.35+deathFall*.25;targetZ+=slide*(i?-.025:.025)+deathKneel*(i?-.55:.55)+deathFall*(i?-.75:.75);arm.rotation.x=THREE.MathUtils.lerp(arm.rotation.x,targetX,poseBlend);arm.rotation.z=THREE.MathUtils.lerp(arm.rotation.z,targetZ,poseBlend)});
    }
    poseEmote(m,p);
  });
  for(const [id,m] of playerMeshes)if(!state.players[id]){world.remove(m);playerMeshes.delete(id)}
}

function myPublic(){return{voice:!!state.voiceOn,special:state.special?.type||null,steady:state.selectedWeapon==='sniper'?steadiness(performance.now()):0,id:state.id,name:safeName(),char:state.selectedChar,weapon:state.selectedWeapon,nextWeapon:state.pendingWeapon,arsenal:{...state.arsenal},equipped:state.equipped,aiming:state.aimBlend>.55,grounded:state.onGround,reloading:state.reloading,sliding:state.slideUntil>performance.now(),emoteUntil:state.emoteUntil,x:camera.position.x,y:camera.position.y,z:camera.position.z,yaw:state.emoteUntil>Date.now()?state.emoteYaw:camera.rotation.y,pitch:camera.rotation.x,health:state.health,kills:state.kills,deaths:state.deaths,alive:state.alive,respawnAt:state.respawnAt}}
function seedSelf(){state.players[state.id]=myPublic();}
function broadcast(msg){if(!state.host)return;state.connections.forEach(c=>{if(c.open)c.send(msg)})}
function sendHost(msg){if(state.host)handleHostMessage(msg,state.id);else if(state.conn?.open)state.conn.send(msg)}
function hostSnapshot(){state.players[state.id]=myPublic();const serverTime=performance.now();state.netSnapshotTime=serverTime;recordCombatHistory(serverTime);broadcast({t:'snapshot',serverTime,players:state.players,end:state.matchEnd,active:state.matchActive,map:state.map,pickups:state.pickups,builds:state.builds,airdrop:publicDrop()})}

let roomGeneration=0,roomConnecting=false,roomTimer=null;
const pendingConnections=new Set();
function setRoomConnecting(active){roomConnecting=active;for(const id of ['create-room','join-room','practice'])$(id).disabled=active}
function watchRoomConnection(generation){clearTimeout(roomTimer);roomTimer=setTimeout(()=>{if(generation===roomGeneration&&roomConnecting){const ice=state.conn?.peerConnection?.iceConnectionState;leaveToHome(ice==='checking'||ice==='failed'?'Room found, but the direct connection failed. Try another network or browser.':'Connection timed out. Check the room code and try again.')}},12000)}
function createRoom(){
  if(roomConnecting)return;
  state.host=true;state.practice=false;state.room=roomCode();state.id='host';resetPeer();setError('');
  const generation=roomGeneration,peerId=`rot-royale-${state.room.toLowerCase()}`;setRoomConnecting(true);setError('Creating your room…');watchRoomConnection(generation);state.peer=new Peer(peerId);const peer=state.peer;wireVoicePeer(peer);
  peer.on('open',()=>{if(generation!==roomGeneration)return;state.id=peerId;state.players={};seedSelf();setError('');enterLobby()});
  peer.on('connection',c=>{if(generation!==roomGeneration){c.close();return}acceptConnection(c)});
  peer.on('error',err=>{if(generation===roomGeneration)peerError(err)});
}
function joinRoom(){
  if(roomConnecting)return;
  const code=$('room-code-input').value.trim().toUpperCase();if(!/^[A-Z2-9]{6}$/.test(code)){setError('Enter the 6-character room code.');return}
  state.host=false;state.practice=false;state.room=code;resetPeer();setError('Connecting to the plaza…');state.peer=new Peer();wireVoicePeer(state.peer);
  const generation=roomGeneration;setRoomConnecting(true);watchRoomConnection(generation);
  state.peer.on('open',id=>{if(generation!==roomGeneration)return;state.id=id;const c=state.peer.connect(`rot-royale-${code.toLowerCase()}`,{reliable:true,metadata:{name:safeName(),char:state.selectedChar,weapon:state.selectedWeapon}});state.conn=c;wireClient(c,generation)});state.peer.on('error',err=>{if(generation===roomGeneration)peerError(err)});
}
function acceptConnection(c){
  const generation=roomGeneration;let admitted=false;
  const unavailable=()=>state.mode!=='lobby'?'This match has started. Ask the host to return to the lobby.':state.connections.has(c.peer)?'Already connected to this room.':Object.keys(state.players).length>=6?'That room is full.':null;
  const reject=reason=>{try{c.send({t:'reject',reason})}catch{}setTimeout(()=>c.close(),150)};
  // Reserve capacity while WebRTC finishes opening, then recheck atomically on admission.
  const reason=unavailable()||(Object.keys(state.players).length+pendingConnections.size>=6?'That room is full.':null);
  if(reason){c.on('open',()=>reject(reason));setTimeout(()=>c.close(),12000);return}
  pendingConnections.add(c);const timer=setTimeout(()=>{pendingConnections.delete(c);if(!admitted)c.close()},12000);
  c.on('open',()=>{pendingConnections.delete(c);clearTimeout(timer);if(generation!==roomGeneration){c.close();return}const reason=unavailable();if(reason){reject(reason);return}admitted=true;
    const requestedChar=c.metadata?.char,char=CHARACTERS.some(x=>x.id===requestedChar)?requestedChar:'wooden';state.connections.set(c.peer,c);state.players[c.peer]={id:c.peer,name:String(c.metadata?.name||'New Rot').slice(0,16),char,weapon:Object.hasOwn(WEAPONS,c.metadata?.weapon)?c.metadata.weapon:'ar',...spawnFor(state.connections.size),kills:0,deaths:0,health:100,alive:true,arsenal:{}};c.send({t:'welcome',id:c.peer,room:state.room,players:state.players,host:state.id,map:state.map});hostSnapshot();updateLobby()});
  c.on('data',d=>{if(generation===roomGeneration&&admitted&&state.connections.get(c.peer)===c)handleHostMessage(d,c.peer)});
  const cleanup=()=>{clearTimeout(timer);pendingConnections.delete(c);if(generation!==roomGeneration||state.connections.get(c.peer)!==c)return;state.connections.delete(c.peer);delete state.players[c.peer];hostSnapshot();updateLobby()};c.on('close',cleanup);c.on('error',()=>{cleanup();c.close()});
}
function wireClient(c,generation=roomGeneration){const current=()=>generation===roomGeneration&&state.conn===c;c.on('data',d=>{if(current())handleClientMessage(d)});c.on('close',()=>{if(current())leaveToHome('The host disconnected. Ask them to create a new room, then join again.')});c.on('error',err=>{if(current())peerError(err)})}
function handleHostMessage(d,from){
  if(!d||typeof d.t!=='string')return;
  if(d.t==='emote'&&state.players[from]){const p=state.players[from];if(d.active&&(!state.matchActive||!p.alive))return;p.emoteUntil=d.active?Date.now()+EMOTE_DURATION:0;if(d.active)p.equipped='bat';broadcast({t:'emote',id:from,until:p.emoteUntil});if(from===state.id)state.emoteUntil=p.emoteUntil}
  if(d.t==='build')placeBuild(from,d);
  if(d.t==='state'&&state.players[from]){const p=state.players[from];p.steady=clamp(+d.steady||0,0,1);p.special=specialOwners.get(from)?.stowed?null:specialOwners.get(from)?.type||null;p.x=clamp(d.x,-34,34);p.z=clamp(d.z,-35,35);p.y=clamp(d.y??1.7,1.7,64);p.yaw=Number.isFinite(d.yaw)?d.yaw:0;p.pitch=clamp(d.pitch??0,-1.45,1.45);p.equipped=d.equipped==='bat'?'bat':'gun';p.aiming=!!d.aiming;p.grounded=d.grounded!==false;p.reloading=!!d.reloading;p.sliding=!!d.sliding;if(openHolds.has(from)&&!playerNearDrop(p,.3))openHolds.delete(from)}
  if(d.t==='shot'){openHolds.delete(from);if(d.pose&&typeof d.pose==='object')handleHostMessage({...d.pose,t:'state'},from);resolveShot(from,performance.now(),d)}
  if(d.t==='loadout'&&state.matchActive&&state.players[from]?.alive===false&&Object.hasOwn(WEAPONS,d.weapon))state.players[from].nextWeapon=d.weapon;
  if(d.t==='melee'){openHolds.delete(from);resolveMelee(from)}
  if(d.t==='openStart')hostOpenStart(from);
  if(d.t==='openCancel')openHolds.delete(from);
  if(d.t==='openDrop')hostOpenDrop(from);
  if(d.t==='specialFire'){openHolds.delete(from);hostSpecialFire(from)}
  if(d.t==='specialReload')hostSpecialReload(from);
  if(d.t==='specialEquip'){const rec=specialOwners.get(from),p=state.players[from];if(rec&&p?.alive&&state.matchActive){rec.stowed=d.active!==true;rec.switchUntil=performance.now()+300;p.special=rec.stowed?null:rec.type}}
  if(d.t==='ready')updateLobby();
  if(d.t==='voice'&&state.players[from]){state.players[from].voice=!!d.on;hostSnapshot();if(state.mode==='lobby')updateLobby()}
}
function handleClientMessage(d){
  if(!d)return;
  if(d.t==='snapshot'&&Number.isFinite(d.serverTime)){state.netSnapshotTime=d.serverTime;state.netReceivedAt=performance.now();recordCombatHistory(d.serverTime,d.players||{})}
  if(d.t==='emote'){if(state.players[d.id])state.players[d.id].emoteUntil=d.until;if(d.id===state.id&&state.emoteUntil)state.emoteUntil=d.until}
  if(d.t==='builds')syncBuilds(d.builds||[]);
  if(d.t==='buildError')toast(d.message);
  if(d.t==='welcome'){state.players=d.players;if(d.map)setMap(d.map);enterLobby()}
  if(d.t==='snapshot'){state.players=d.players||{};state.matchEnd=d.end||0;if(d.map)setMap(d.map);if(d.pickups)state.pickups=d.pickups;if(d.active&&!state.matchActive)beginMatch(false);if(d.builds)syncBuilds(d.builds);if('airdrop' in d&&state.matchActive)applyDropState(d.airdrop);syncLocalFromSnapshot();if(state.mode==='lobby')updateLobby()}
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
  if(d.t==='airdrop'&&state.matchActive)applyDropState(d.drop);
  if(d.t==='special')grantSpecial(d.type);
  if(d.t==='proj')spawnProjectile(d,false);
  if(d.t==='projEnd'){const pr=projectiles.find(p=>p.id===d.id);if(pr)removeProjectile(pr)}
  if(d.t==='boom')onBoom(d);
  if(d.t==='vortex')spawnVortex(d,false);
  if(d.t==='vortexPop'){const v=vortices.find(v=>v.id===d.id);if(v)popVortex(v,true)}
  if(d.t==='notice')toast(d.message);
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
function resetPeer(){roomGeneration++;clearTimeout(roomTimer);setRoomConnecting(false);pendingConnections.forEach(c=>c.close());pendingConnections.clear();stopVoice(false);if(state.peer&&!state.peer.destroyed)state.peer.destroy();state.peer=null;state.conn=null;state.connections.clear()}
function setError(s){$('connection-error').textContent=s}

function enterLobby(){clearTimeout(roomTimer);setRoomConnecting(false);state.mode='lobby';showScreen('lobby');$('room-code').textContent=state.room;$('lobby-title').textContent=MAPS[state.map].name+' lobby';updateLobby()}
function updateLobby(){
  const ps=Object.values(state.players);$('player-list').innerHTML=ps.map((p,i)=>{const c=CHARACTERS.find(c=>c.id===p.char)||CHARACTERS[0];return `<div class="player-pill"><span class="dot"></span><strong>${escapeHtml(p.name)}${p.voice?' 🔊':''}</strong><span>${c.portrait?`<img class="lobby-portrait" src="${c.portrait}" alt="${c.name}">`:c.emoji}</span><small>${i===0?'HOST':WEAPONS[p.weapon]?.name||'PLAYER'}</small></div>`}).join('');
  $('start-match').style.display=state.host?'block':'none';if(state.host){$('start-match').disabled=ps.length<2&&!state.practice;$('start-match').textContent=ps.length<2?'Waiting for another player…':`Start match · ${ps.length} players`}
}
function startMatch(){
  if(!state.host||state.matchActive||(!state.practice&&(state.mode!=='lobby'||Object.keys(state.players).length<2)))return;
  state.matchEnd=state.map==='surf'?Infinity:Date.now()+180000;state.arsenal={};
  const slots=MAPS[state.map].spawns.map((_,i)=>i);for(let i=slots.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[slots[i],slots[j]]=[slots[j],slots[i]]}
  Object.values(state.players).forEach((p,i)=>Object.assign(p,{kills:0,deaths:0,health:100,alive:true,arsenal:{},nextWeapon:p.weapon,...(state.map==='surf'?{x:SURF_SPAWN[0],y:SURF_SPAWN[1],z:SURF_SPAWN[2]}:spawnFor(slots[i%slots.length]))}));
  resetPickups();scheduleAirdrop();broadcast({t:'start',end:state.matchEnd,players:state.players,map:state.map,pickups:state.pickups});beginMatch(true)
}
function beginMatch(asHost){
  combatHistory.clear();predictedShots.clear();state.netSnapshotTime=state.netRenderTime=undefined;
  stopEmote(false);resetAirdropState();resetBotBanter();updateVoiceUi();if(banterOn)setTimeout(()=>botBanterEvent('start'),2500);
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
  const target=state.players[targetId],shooter=state.players[shooterId];if(!target||!shooter||!target.alive)return;const oldHealth=target.health;target.health=Math.max(0,target.health-Math.min(100,Math.max(1,damage||1)));openHolds.delete(targetId);
  const killed=target.health<=0,feedback={t:'damageDealt',id:shooterId,amount:oldHealth-target.health,headshot,killed,name:target.name};if(shooterId===state.id)damageFeedback(feedback);else state.connections.get(shooterId)?.send(feedback);
  if(killed){
    markEliminated(targetId);target.alive=false;target.respawnAt=Date.now()+3000;target.deaths=(target.deaths||0)+1;shooter.kills=(shooter.kills||0)+1;
    if(shooterId===state.id)state.kills=shooter.kills;if(targetId===state.id)state.deaths=target.deaths;
    const text=headshot?`${shooter.name} headshot ${target.name} ☕`:`${shooter.name} spilled ${target.name}'s coffee`;
    broadcast({t:'event',text,victim:targetId,killer:shooterId,killed:true,headshot,respawnAt:target.respawnAt});addFeed(text);botBanterEvent('kill',{killer:shooterId,victim:targetId,headshot});if(targetId===state.id)takeDamageResult({killed:true,respawnAt:target.respawnAt});
    // Snapshots replace player objects. Resolve by stable ID, round and death number instead.
    const roundEnd=state.matchEnd,deathNumber=target.deaths;
    setTimeout(()=>{
      const current=state.players[targetId];
      if(!state.host||!state.matchActive||state.matchEnd!==roundEnd||!current||current.alive!==false||current.deaths!==deathNumber)return;
      const weapon=Object.hasOwn(WEAPONS,current.nextWeapon)?current.nextWeapon:current.weapon;
      Object.assign(current,{health:100,alive:true,respawnAt:0,y:1.7,weapon,equipped:'gun',...spawnFor(Math.floor(Math.random()*6))});
      refillSpecialOnRespawn(targetId);
      if(targetId===state.id)doRespawn(current.x,current.z,weapon);else state.connections.get(targetId)?.send({t:'respawn',id:targetId,x:current.x,z:current.z,weapon});hostSnapshot();
    },3000);
  }else{
    state.connections.get(targetId)?.send({t:'event',text:'',victim:targetId,killer:shooterId,damage:true,health:target.health});
    if(targetId===state.id){state.health=target.health;flashDamage(shooterId)}
  }
  hostSnapshot();
}
function takeDamageResult(d){
  if(!state.matchActive)return;const me=state.players[state.id];
  if(d.killed){
    if(!state.alive)return;state.specialCharge=0;state.openHold=0;state.alive=false;state.health=0;state.respawnAt=Number.isFinite(d.respawnAt)&&d.respawnAt>0?d.respawnAt:Date.now()+3000;state.reloading=false;clearInput();
    if(me)Object.assign(me,{health:0,alive:false,respawnAt:state.respawnAt});
    state.pendingWeapon=state.selectedWeapon;if(me)me.nextWeapon=state.pendingWeapon;renderRespawnLoadout();
    $('respawn').classList.add('active');updateRespawnCountdown();controls.unlock();updateCursor();
  }else{state.health=d.health??me?.health??state.health;if(me)me.health=state.health;flashDamage(d.killer)}
  updateHud();
}
function updateRespawnCountdown(){if(state.matchActive&&!state.alive){const remaining=Math.max(0,state.respawnAt-Date.now());$('respawn-time').textContent=Math.ceil(remaining/1000);$('respawn').style.setProperty('--respawn-progress',`${Math.min(1,remaining/3000)*360}deg`)}}
function renderRespawnLoadout(){
  $('respawn-weapons').innerHTML=Object.keys(WEAPONS).map((id,i)=>{const w=weaponStats(id);return `<button type="button" data-respawn-weapon="${id}" aria-pressed="${state.pendingWeapon===id}" class="respawn-weapon ${state.pendingWeapon===id?'selected':''}"><kbd>${i+1} · ${RARITIES[w.tier].name}</kbd><strong>${weaponLabels[id]}</strong><small>${w.name}</small></button>`}).join('');
  $('respawn-loadout-note').textContent=state.special?`${state.special.type==='rpg'?'Raptor RPG':'Skibidi Toilet Gun'} returns with a full magazine · preset stays ${weaponStats(state.pendingWeapon).name}`:`Next spawn: ${weaponStats(state.pendingWeapon).name} · unlocks last this match`;
}
function chooseRespawnWeapon(weapon){
  if(!state.matchActive||state.alive||!Object.hasOwn(WEAPONS,weapon))return;
  state.pendingWeapon=weapon;renderRespawnLoadout();sendHost({t:'loadout',weapon});
}
function doRespawn(x,z,weapon=state.players[state.id]?.weapon){
  if(!state.matchActive)return;state.specialCharge=0;if(Object.hasOwn(WEAPONS,weapon))state.selectedWeapon=weapon;state.pendingWeapon=state.selectedWeapon;state.equipped='gun';
  state.alive=true;state.health=100;state.respawnAt=0;state.reloading=false;state.ammo=state.special?SPECIALS[state.special.type].mag:WEAPONS[state.selectedWeapon].mag;state.normalGunAmmo=WEAPONS[state.selectedWeapon].mag;if(state.stowedSpecial)state.stowedSpecial.ammo=SPECIALS[state.stowedSpecial.type].mag;
  if(state.host)refillSpecialOnRespawn(state.id);
  camera.position.set(x??0,1.7,z??12);state.velocityY=0;state.onGround=true;clearInput();
  // Update both stores before HUD/snapshot reads can put the old zero health back.
  const me=state.players[state.id];if(me)Object.assign(me,{health:100,alive:true,respawnAt:0,weapon:state.selectedWeapon,nextWeapon:state.selectedWeapon,equipped:'gun',x:camera.position.x,y:1.7,z:camera.position.z});
  $('respawn').classList.remove('active');updateWeaponModel();updateHud();updateCursor();if(isPlaying()){focusGame();requestMouseCapture()}
}
let damageFeedbackSerial=0,nearMissAt=-Infinity,whizzBuffer;
function flashDamage(attacker){
  state.openHold=0;const el=$('damage-flash'),p=state.players[attacker];el.classList.add('show');
const direction=$('incoming-direction');if(direction){direction.classList.toggle('show',!!p);if(p){const angle=Math.atan2(p.x-camera.position.x,-(p.z-camera.position.z))+camera.rotation.y;direction.style.transform=`rotate(${angle}rad)`}}
  tone(95,.12,.10,'triangle',0,38);const serial=++damageFeedbackSerial;setTimeout(()=>{if(serial!==damageFeedbackSerial)return;el.classList.remove('show');direction?.classList.remove('show')},650);
}
function closestBulletPass(origin,end,listener){const delta=end.clone().sub(origin),length=delta.lengthSq();if(length<.01)return null;const t=listener.clone().sub(origin).dot(delta)/length;if(t<=0||t>=1)return null;const point=origin.clone().addScaledVector(delta,t);return {point,distance:point.distanceTo(listener)}}
function incomingShotAudio(message,start){
  if(message.id===state.id||!state.matchActive||!state.alive)return;
  const offset=start.clone().sub(camera.position),distance=offset.length(),right=new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion),pan=distance?offset.dot(right)/distance:0;
  if(distance<110)weaponSound(message.weapon,message.tier,.95/(1+distance*.045),pan,distance);
  let nearest=null;for(const end of message.ends.slice(0,12)){if(!Array.isArray(end)||end.length!==3||!end.every(Number.isFinite))continue;const pass=closestBulletPass(start,new THREE.Vector3().fromArray(end),camera.position);if(pass&&(!nearest||pass.distance<nearest.distance))nearest=pass}
  const now=performance.now();if(!nearest||nearest.distance>2.4||distance<2||now-nearMissAt<110||soundMuted||!audioContext||audioContext.state!=='running')return;nearMissAt=now;
  // One short noise sweep per shot, not per pellet; reuse the buffer and obey the voice cap.
  if(!whizzBuffer){whizzBuffer=audioContext.createBuffer(1,Math.ceil(audioContext.sampleRate*.16),audioContext.sampleRate);const data=whizzBuffer.getChannelData(0);for(let i=0;i<data.length;i++){const t=i/data.length;data[i]=(Math.random()*2-1)*Math.sin(Math.PI*t)*Math.exp(-t*2)}}
  if(soundVoices.size>=24)return;const source=audioContext.createBufferSource(),filter=audioContext.createBiquadFilter(),gain=audioContext.createGain(),stereo=audioContext.createStereoPanner(),t=audioContext.currentTime;
  source.buffer=whizzBuffer;filter.type='bandpass';filter.Q.value=1.8;filter.frequency.setValueAtTime(3400,t);filter.frequency.exponentialRampToValueAtTime(650,t+.16);gain.gain.value=.16*(1-nearest.distance/3);const side=nearest.point.clone().sub(camera.position).dot(right);stereo.pan.setValueAtTime(clamp(side,-1,1),t);stereo.pan.linearRampToValueAtTime(clamp(side*.45,-1,1),t+.16);source.connect(filter);filter.connect(gain);gain.connect(stereo);stereo.connect(audioMaster);soundVoices.add(source);source.onended=()=>{soundVoices.delete(source);source.disconnect();filter.disconnect();gain.disconnect();stereo.disconnect()};source.start();
}

function shoot(){
  stopEmote();
  if(state.buildMode||state.map==='surf'||airdropFrozen())return;
  if(state.special){const now=performance.now();if(isPlaying()&&state.equipped!=='bat'&&now-state.switchStart>=SWITCH_DURATION&&now-state.meleeStart>=MELEE.duration)fireSpecial(now);return}
  if(!isPlaying()||state.equipped==='bat'||state.reloading||performance.now()-state.meleeStart<MELEE.duration||performance.now()-state.switchStart<SWITCH_DURATION||performance.now()-state.inspectStart<INSPECT_DURATION)return;const w=weaponStats(state.selectedWeapon),now=performance.now();if(now-state.lastShot<w.rate)return;if(state.ammo<=0){reload();return}state.lastShot=now;state.ammo--;updateHud();weaponMotion.kick=Math.min(1.4,weaponMotion.kick+({ar:.65,shotgun:1.3,sniper:1.1,smg:.45}[state.selectedWeapon]));
  weaponSound(state.selectedWeapon,w.tier);shotShake=Math.min(.008,shotShake+({ar:.002,smg:.0015,shotgun:.008,sniper:.006}[state.selectedWeapon]));
  const shot={t:'shot',seq:++shotSerial,pose:myPublic(),viewTimes:{}};
  if(!state.practice)for(const [id,m] of playerMeshes)if(Number.isFinite(m.userData.netTime))shot.viewTimes[id]=m.userData.netTime;
  if(state.host)state.players[state.id]=shot.pose;else predictShotTracer(shot,w);
  sendHost(shot);
  applyShotFeel(state.selectedWeapon,now);
}
// Recoil lands after the pose is published, so this shot goes where you aimed and the next one climbs.
function applyShotFeel(type,now){
  const feel=WEAPON_FEEL[type],steady=1-.35*state.aimBlend,vary=.85+Math.random()*.3;
  aimRecoil.target.x+=feel.pitch*steady*vary;aimRecoil.target.y-=(feel.yawBias+(Math.random()-.5)*2)*feel.yaw*steady;
  weaponMotion.roll+=feel.roll*(feel.rollRandom&&Math.random()<.5?-1:1);weaponMotion.flashSpin=Math.random()*Math.PI*2;
  state.localHeat=Math.min(feel.bloomMax,localHeat(now)+feel.bloom);state.localHeatAt=now;
  if(feel.thump)tone(feel.thump,.2,.06,'sine',0,feel.thump*.45);
  if(feel.push){const f=new THREE.Vector3();camera.getWorldDirection(f);f.y=0;if(f.lengthSq()>1e-6){f.normalize();const push=feel.push*(state.onGround?1:1.5);state.velocityX-=f.x*push;state.velocityZ-=f.z*push}}
}
function updateAutomaticFire(){if(state.fireHeld&&!state.special&&WEAPONS[state.selectedWeapon].automatic)shoot()}
function publishCombatPose(){const p=myPublic();if(state.host)state.players[state.id]=p;else sendHost({t:'state',x:p.x,y:p.y,z:p.z,yaw:p.yaw,pitch:p.pitch,equipped:p.equipped,aiming:p.aiming,grounded:p.grounded,reloading:p.reloading,sliding:p.sliding,steady:p.steady})}
// The host raycasts the actual character geometry, including its own player, and decides damage.
function resolveShot(id,now=performance.now(),shot={}){
  const specialRecord=specialOwners.get(id);if(specialRecord&&(!specialRecord.stowed||now<(specialRecord.switchUntil||0)))return;
  if(airdropFrozen(now))return;
  const attacker=state.players[id],w=Object.hasOwn(WEAPONS,attacker?.weapon)?weaponStats(attacker.weapon,attacker.arsenal||{}):null;
  const last=shotCooldowns.get(id)??-Infinity,tolerance=id!==state.id&&!attacker?.bot?Math.min(45,(w?.rate||0)*.4):0;
  if(!state.host||!state.matchActive||!attacker||attacker.alive===false||attacker.equipped==='bat'||!w||now-last<w.rate-tolerance)return;
  shotCooldowns.set(id,Math.max(now,last+w.rate));recordCombatHistory(now);const targets=[...shotBlockers],hits=new Map(),structureHits=new Map();world.updateMatrixWorld(true);
  for(const p of Object.values(state.players)){
    if(p.id===id||p.alive===false)continue;
    let model=hitModels.get(p.id);if(!model){model=createPlayerMesh(p,false,true);model.userData.hitMeshes=[];model.traverse(m=>{if(m.isMesh&&!m.userData.noHit)model.userData.hitMeshes.push(m)});hitModels.set(p.id,model)}
    const pose=rewindCombatPose(p,shot.viewTimes?.[p.id],now);
    model.position.set(pose.x||0,(pose.y??1.7)-1.7,pose.z||0);model.rotation.set(0,pose.yaw||0,0);model.scale.y=pose.sliding?.78:1;poseEmote(model,pose);model.updateMatrixWorld(true);targets.push(...model.userData.hitMeshes);
  }
  const origin=new THREE.Vector3(attacker.x,(attacker.y??1.7)-(attacker.sliding ? .42 : 0),attacker.z),rotation=new THREE.Quaternion().setFromEuler(new THREE.Euler(attacker.pitch||0,attacker.yaw||0,0,'YXZ')),ends=[],impacts=[];
  const feel=WEAPON_FEEL[attacker.weapon],heat=decayedHeat(id,now,feel);shotHeat.set(id,{v:Math.min(feel.bloomMax,heat+feel.bloom),t:now});
  const hip=attacker.weapon==='sniper'?THREE.MathUtils.lerp(w.spread,SNIPER_STILL_SPREAD,attacker.steady||0):w.spread;
  const spread=(attacker.aiming?(w.adsSpread??w.spread*.55):hip)+heat*(attacker.aiming?.4:1);
  const recordHit=(first,multiplier=1)=>{const targetId=first.object.userData.playerId,targetModel=hitModels.get(targetId);if(!targetModel)return;const torso=targetModel.userData.avatar?.userData.danceTorso,local=(torso||targetModel).worldToLocal(first.point.clone()),headshot=local.y+(torso?.75:0)>=1.80,hit=hits.get(targetId)||{damage:0,headshot:false,point:first.point},falloff=attacker.weapon==='shotgun'?clamp(1-Math.max(0,first.distance-7)/22,.35,1):attacker.weapon==='smg'?clamp(1-Math.max(0,first.distance-20)/60,.6,1):1;hit.damage+=w.damage*falloff*multiplier*(headshot?2:1);hit.headshot||=headshot;if(headshot)hit.point=first.point;hits.set(targetId,hit)};
  for(let n=0;n<w.pellets;n++){
    const angle=n*2.399963,radius=Math.sqrt((n+.5)/w.pellets)*spread*.5,dx=w.pellets>1?Math.cos(angle)*radius:(Math.random()-.5)*spread,dy=w.pellets>1?Math.sin(angle)*radius:(Math.random()-.5)*spread;
    const dir=new THREE.Vector3(dx,dy,-1).normalize().applyQuaternion(rotation);raycaster.set(origin,dir);raycaster.far=w.range;
    const intersections=raycaster.intersectObjects(targets,false),first=intersections[0],targetId=first?.object.userData.playerId;let endpoint=first?first.point:origin.clone().addScaledVector(dir,w.range);
    const buildId=first?.object.userData.buildId;if(buildId)structureHits.set(buildId,(structureHits.get(buildId)||0)+w.damage);
    if(targetId){recordHit(first);if(attacker.weapon==='sniper'&&w.tier){const next=intersections.find(hit=>hit.object.userData.playerId!==targetId);if(next){endpoint=next.point;if(next.object.userData.playerId)recordHit(next,.65)}}}else if(first&&impacts.length<4)impacts.push({x:first.point.x,y:first.point.y,z:first.point.z});
    ends.push(endpoint.toArray());
  }
  const trail={t:'tracers',id,seq:shot.seq,tier:w.tier,weapon:attacker.weapon,origin:origin.clone().add(new THREE.Vector3(.24,-.18,-.65).applyQuaternion(rotation)).toArray(),ends,impacts};showTracers(trail);broadcast(trail);
  let anyHeadshot=false;
  for(const [target,hit] of hits){
    anyHeadshot||=hit.headshot;const impact={t:'impact',id:target,headshot:hit.headshot,x:hit.point.x,y:hit.point.y,z:hit.point.z};showImpact(impact);broadcast(impact);applyHit(id,target,hit.damage,hit.headshot);
  }
  for(const [buildId,damage] of structureHits)damageBuild(buildId,damage);
  if(hits.size||structureHits.size){if(id===state.id)showShotFeedback(anyHeadshot);else state.connections.get(id)?.send({t:'shotResult',id,headshot:anyHeadshot})}
}
function predictShotTracer(shot,w){
  const origin=camera.position.clone(),rotation=camera.quaternion.clone(),ends=[];
  if(shot.pose?.sliding)origin.y-=.42;
  const targets=[...shotBlockers];for(const m of playerMeshes.values())if(m.visible)m.traverse(part=>{if(part.isMesh&&!part.userData.noHit)targets.push(part)});
  world.updateMatrixWorld(true);camera.updateMatrixWorld(true);
  for(let n=0;n<w.pellets;n++){
    const angle=n*2.399963,radius=w.pellets>1?Math.sqrt((n+.5)/w.pellets)*w.spread*.5:0;
    const dir=new THREE.Vector3(Math.cos(angle)*radius,Math.sin(angle)*radius,-1).normalize().applyQuaternion(rotation);
    raycaster.set(origin,dir);raycaster.far=w.range;const hit=raycaster.intersectObjects(targets,false)[0];ends.push((hit?hit.point:origin.clone().addScaledVector(dir,w.range)).toArray());
  }
  predictedShots.add(shot.seq);while(predictedShots.size>128)predictedShots.delete(predictedShots.values().next().value);
  showTracers({id:state.id,weapon:state.selectedWeapon,tier:w.tier,origin:origin.toArray(),ends});
}
function showTracers(message){
  if(message.id===state.id&&predictedShots.delete(message.seq)){for(const point of (message.impacts||[]).slice(0,4))showImpact({...point,spark:true});return}
  const valid=p=>Array.isArray(p)&&p.length===3&&p.every(Number.isFinite);
  if(!valid(message.origin)||!Array.isArray(message.ends))return;
  if(!tracerMesh){tracerMesh=new THREE.InstancedMesh(new THREE.CylinderGeometry(1,1,1,5),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.82,depthWrite:false}),tracerSlots.length);tracerMesh.frustumCulled=false;tracerMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);world.add(tracerMesh)}
  const start=new THREE.Vector3().fromArray(message.origin);
  const muzzle=weaponModel?.userData.rig?.userData.gun?.userData.muzzle;
  if(message.id===state.id&&muzzle){camera.updateMatrixWorld(true);muzzle.getWorldPosition(start)}
  for(const end of message.ends.slice(0,12)){if(!valid(end))continue;const slot=tracerSlots[tracerCursor++%tracerSlots.length];slot.start.copy(start);slot.end.fromArray(end);const look=(WEAPON_FEEL[message.weapon]||WEAPON_FEEL.ar).tracer;slot.born=performance.now();slot.life=look[2];slot.width=look[1];tracerMesh.setColorAt((tracerCursor-1)%tracerSlots.length,new THREE.Color(message.tier?RARITIES[message.tier]?.color||0x66ddff:look[0]))}
  if(tracerMesh.instanceColor)tracerMesh.instanceColor.needsUpdate=true;remoteShotTimes.set(message.id,performance.now());incomingShotAudio(message,start);for(const point of (message.impacts||[]).slice(0,4))showImpact({...point,spark:true});tracerMesh.visible=true;updateTracers(performance.now());
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
function showDeathEffect(player){
  let effect=deathEffects.find(e=>!e.group.visible);
  if(!effect&&deathEffects.length<6){
    const group=new THREE.Group(),ring=new THREE.Mesh(new THREE.RingGeometry(.62,.75,28),new THREE.MeshBasicMaterial({color:0xd79852,transparent:true,opacity:.55,side:THREE.DoubleSide,depthWrite:false}));
    ring.rotation.x=-Math.PI/2;ring.position.y=.035;ring.userData.noHit=true;group.add(ring);
    const drops=new THREE.InstancedMesh(new THREE.SphereGeometry(.065,6,4),new THREE.MeshBasicMaterial({color:0x9b5b30,transparent:true,opacity:.9,depthWrite:false}),12);
    drops.frustumCulled=false;drops.userData.noHit=true;group.add(drops);world.add(group);
    effect={group,ring,drops,start:0};deathEffects.push(effect);
  }
  effect??=deathEffects.reduce((a,b)=>a.start<b.start?a:b);
  effect.start=performance.now();effect.group.position.set(player.x||0,Math.max(0,(player.y??1.7)-1.7),player.z||0);effect.group.visible=true;
}
function updateImpacts(now){
  updateTracers(now);
  for(const burst of coffeeBursts){if(!burst.mesh.visible)continue;const t=(now-burst.start)/500;if(t>=1){burst.mesh.visible=false;continue}
    for(let i=0;i<8;i++){const a=i*Math.PI/4;impactTransform.position.set(Math.cos(a)*t*.6,t*.65-t*t*.85,Math.sin(a)*t*.6);impactTransform.scale.setScalar(1-t*.7);impactTransform.updateMatrix();burst.mesh.setMatrixAt(i,impactTransform.matrix)}burst.mesh.instanceMatrix.needsUpdate=true;
  }
  for(const effect of deathEffects){if(!effect.group.visible)continue;const t=(now-effect.start)/900;if(t>=1){effect.group.visible=false;continue}
    effect.ring.scale.setScalar(1+t*1.9);effect.ring.material.opacity=.55*(1-t);effect.drops.material.opacity=.9*(1-t);
    for(let i=0;i<12;i++){const a=i*Math.PI/6,r=(.2+t*1.15)*(i%3?.85:1.15);impactTransform.position.set(Math.cos(a)*r,.12+Math.sin(t*Math.PI)*(i%3?.85:1.2),Math.sin(a)*r);impactTransform.scale.setScalar(1-t*.55);impactTransform.updateMatrix();effect.drops.setMatrixAt(i,impactTransform.matrix)}effect.drops.instanceMatrix.needsUpdate=true;
  }
  const t=(now-state.headshotAt)/650;$('headshot-callout').style.opacity=t>=0&&t<1?String(Math.min(1,(1-t)*3)):'0';$('headshot-callout').style.transform=`translate(-50%,0) scale(${t>=0&&t<1?1+Math.exp(-t*9)*.3:1})`;
}
function showHitmarker(){$('hitmarker').classList.add('show');setTimeout(()=>$('hitmarker').classList.remove('show'),140)}
function meleeAttack(){
  stopEmote();
  if(state.map==='surf'||airdropFrozen())return;
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
function resolveMelee(id,now=performance.now()){if(airdropFrozen(now))return;
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
  else if(!swing&&!state.reloading&&!switching)$('weapon-name').textContent=holding?meleeLabel():gunStats().name.toUpperCase();
  else if(switching)$('weapon-name').textContent=(state.switchPending==='bat'?meleeLabel():gunStats().name.toUpperCase())+'…';
  $('melee-status').textContent=state.map==='surf'?'A / D + MOUSE · TAP JUMP · R RESTART':switching?'':holding?(now-state.lastMelee<MELEE.cooldown?'RECOVERING · F GUN':'CLICK SWING · F GUN'):`F · EQUIP ${meleeLabel()}`;if(state.special||state.stowedSpecial)$('melee-status').textContent+=` · ${keyName(keybinds.airdropWeapon)} NORMAL / AIRDROP`;
}
function toggleBat(){
  const now=performance.now();
  if(state.map==='surf'||airdropFrozen())return;if(!isPlaying()||now-state.meleeStart<MELEE.duration||now-state.switchStart<SWITCH_DURATION||now-state.inspectStart<INSPECT_DURATION)return;
  state.switchPending=state.equipped==='bat'?'gun':'bat';state.switchStart=now;state.switchSwapped=false;
  state.fireHeld=false;state.reloading=false;state.aiming=false;weaponMotion.kick=0;
  tone(state.switchPending==='bat'?170:230,.05,.02,'square',0,state.switchPending==='bat'?110:170);
}
function reload(){if(state.map==='surf')return;const w=gunStats();if(state.special&&(!w.reload||state.special.reserve<=0))return;if(!isPlaying()||state.equipped==='bat'||performance.now()-state.meleeStart<MELEE.duration||performance.now()-state.switchStart<SWITCH_DURATION||performance.now()-state.inspectStart<INSPECT_DURATION||state.reloading||state.ammo>=w.mag)return;state.reloading=true;state.reloadStart=performance.now();reloadSoundStage=0;playSoundBuffer('magout',.22);if(state.special)sendHost({t:'specialReload'});publishCombatPose();$('weapon-name').textContent='RELOADING…'}
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
    const visible=playerMeshes.get(p.id),point=visible?.visible?visible.position.clone().add(new THREE.Vector3(0,p.sliding?.85:1.4,0)):new THREE.Vector3(p.x,(p.y??1.7)-.30,p.z),offset=point.clone().sub(origin),distance=offset.length();if(distance<.1||distance>weaponStats(state.selectedWeapon).range)continue;
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
  const profile=AIM_PROFILES[activeType()],now=performance.now(),inspecting=now-state.inspectStart<INSPECT_DURATION;
  const target=state.aiming&&state.equipped!=='bat'&&isPlaying()&&!state.reloading&&!inspecting&&now-state.meleeStart>=MELEE.duration&&now-state.switchStart>=SWITCH_DURATION;
  if(target!==weaponMotion.aimWas){weaponMotion.aimKick=1;weaponMotion.aimWas=target}
  state.aimProgress=clamp(state.aimProgress+(target?dt/profile.raise:-dt/profile.lower),0,1);state.aimBlend=smoothStep(state.aimProgress);
  const fov=THREE.MathUtils.lerp(76,profile.fov,state.aimBlend);
  if(Math.abs(camera.fov-fov)>.001){camera.fov=fov;camera.updateProjectionMatrix()}
  updateAimAssist(dt);
  controls.pointerSpeed=0;
  const scoped=activeType()==='sniper'&&state.aimBlend>.78;
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
  const type=activeType(),w=gunStats(),rig=weaponModel.userData.rig,profile=AIM_PROFILES[type],aim=state.aimBlend;
  if((!state.alive||!state.matchActive)&&state.reloading){state.reloading=false;updateWeaponModel()}
  if(state.reloading&&now-state.reloadStart>=w.reload){if(state.special){const n=Math.min(w.mag-state.ammo,state.special.reserve);state.ammo+=n;state.special.reserve-=n}else{state.ammo=w.mag;state.reserve=Infinity}state.reloading=false;updateWeaponModel()}
  if(isPlaying()&&!state.reloading&&state.ammo===0&&now-state.lastShot>160)reload();
  if(!rig)return;
  const m=weaponMotion,blend=1-Math.exp(-12*dt),active=isPlaying(),distance=Math.hypot(camera.position.x-(m.x??camera.position.x),camera.position.z-(m.z??camera.position.z)),moving=active&&state.onGround&&distance>.001;
  m.x=camera.position.x;m.z=camera.position.z;
  m.walk=THREE.MathUtils.lerp(m.walk,moving?Math.min(1,distance/Math.max(dt,.001)/5):0,blend);m.phase+=moving?strideAdvance(distance/Math.max(dt,.001),dt):dt*2;
  const dy=m.yaw===null?0:Math.atan2(Math.sin(camera.rotation.y-m.yaw),Math.cos(camera.rotation.y-m.yaw)),dp=m.pitch===null?0:camera.rotation.x-m.pitch;
  m.yaw=camera.rotation.y;m.pitch=camera.rotation.x;
  m.swayX=THREE.MathUtils.lerp(m.swayX,clamp(dy*.18/Math.max(dt,.001),-.05,.05),blend);m.swayY=THREE.MathUtils.lerp(m.swayY,clamp(dp*.12/Math.max(dt,.001),-.035,.035),blend);
  m.kick*=Math.exp(-profile.settle*dt);m.aimKick*=Math.exp(-9*dt);m.roll*=Math.exp(-profile.settle*dt);
  const feel=WEAPON_FEEL[type],jx=feel.jitter*m.kick*(Math.random()-.5),jy=feel.jitter*m.kick*(Math.random()-.5);
  const t=state.reloading?(now-state.reloadStart)/w.reload:0,tilt=state.reloading?smoothStep(t/.22)*(1-smoothStep((t-.76)/.24)):0;
  if(state.reloading){if(t>=.24&&reloadSoundStage<1){playSoundBuffer('magout',.3);reloadSoundStage=1}if(t>=.58&&reloadSoundStage<2){playSoundBuffer('magin',.4);reloadSoundStage=2}if(t>=.83&&reloadSoundStage<3){playSoundBuffer('bolt',.32);reloadSoundStage=3}}
  const breath=Math.sin(now*.002)*.0025,bob=Math.sin(m.phase),mag=state.reloading?smoothStep((t-.20)/.16)*(1-smoothStep((t-.57)/.17)):0;
  // Both hands travel with the gun into its real sight line; aiming never rotates the camera.
  const free=1-aim,sight=rig.userData.gun.userData.sight.position;
  const inspectT=(now-state.inspectStart)/INSPECT_DURATION,inspect=inspectT>=0&&inspectT<1?Math.sin(inspectT*Math.PI):0;
  rig.position.set(THREE.MathUtils.lerp(.16,-.28,aim),THREE.MathUtils.lerp(-.06,1.74-sight.y,aim),THREE.MathUtils.lerp(-.28,.05,aim)-m.aimKick*.045*free);
  rig.rotation.y=.20*free+inspect*1.2;rig.rotation.x=-inspect*.42;
  rig.position.y+=inspect*.06;rig.position.x+=inspect>0?Math.sin(inspectT*Math.PI*4)*.02*inspect:0;
  rig.visible=!(type==='sniper'&&aim>.78);
  const slide=clamp(slideView/SLIDE_DROP,0,1);
  weaponModel.position.set((bob*.012*m.walk*(1-slide)-m.swayX)*free+jx,(-Math.abs(Math.cos(m.phase))*.010*m.walk*(1-slide)+breath)*free-.12*tilt-m.dip*.85-slide*.16*free+jy,feel.back*m.kick*(1-.4*aim)+.10*tilt);
  weaponModel.rotation.set(profile.kick*feel.rise*m.kick+m.swayY*free-.24*tilt+m.dip*.55+slide*.10*free,m.swayX*.3*free,-bob*.012*m.walk*free-.35*tilt-slide*.22*free+m.roll);
  rig.userData.support.position.set(-.10*mag,-.16*mag,.16*mag);
  rig.userData.gun.userData.magazine.position.y=1.36-.23*mag;
  const since=(now-state.lastShot)/1000,action=rig.userData.gun.userData.action;
  const cycle=type==='shotgun'?smoothStep((since-.13)/.14)*(1-smoothStep((since-.34)/.17)):type==='sniper'?smoothStep((since-.18)/.16)*(1-smoothStep((since-.58)/.22)):0;
  action.position.z=.12*cycle;
  if(type==='shotgun')rig.userData.support.position.z+=.12*cycle;
  if(type==='sniper'){rig.userData.trigger.position.z=.10*cycle;rig.userData.trigger.position.x=.045*cycle}else rig.userData.trigger.position.set(0,0,0);
  const flashAge=now-state.lastShot,flash=rig.userData.flash;
  flash.visible=active&&!state.reloading&&flashAge<feel.flashMs;flash.material.color.set(type==='toilet'?0x5fd0ff:w.tier?RARITIES[w.tier].color:0xffdf92);
  const flicker=.88+Math.random()*.24,grow=1+clamp(flashAge/feel.flashMs,0,1)*.35;
  flash.scale.set(feel.flash[0]*flicker,feel.flash[1]*flicker*grow,feel.flash[0]*flicker);flash.rotation.y=m.flashSpin;
  if(state.special)animateSpecialGun(rig.userData.gun,{now,ammo:state.ammo,reloadT:t,charge:state.specialCharge?clamp((now-state.specialCharge)/VORTEX.charge,0,1):0,firedAgo:now-state.lastShot});
}

function advanceMovement(dt){if(isPlaying()){camera.rotation.y+=((state.keys.ArrowLeft?1:0)-(state.keys.ArrowRight?1:0))*2.8*dt;}const steps=Math.max(1,Math.ceil(dt*120)),step=dt/steps;for(let i=0;i<steps;i++)updateMovement(step)}
function updateMovement(dt){
  if(!isPlaying())return;if(airdropFrozen()){state.velocityX=state.velocityZ=0;return}
  if(state.emoteUntil){if(Date.now()>=state.emoteUntil||['KeyW','KeyA','KeyS','KeyD','Space'].some(k=>state.keys[k]))stopEmote();else{updateVerticalMovement(dt);return}}
  updateLadderHint(dt);if(state.climbing!==null){updateClimbing(dt);return}
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
function interactionStill(){return state.onGround&&!state.fireHeld&&!state.reloading&&!state.buildMode&&!['KeyW','KeyA','KeyS','KeyD','Space'].some(k=>state.keys[k])&&Math.hypot(state.velocityX,state.velocityZ)<.3}
let ladderWait=0,ladderCandidate=-1,ladderCooldown=0;
function updateLadderHint(dt=0){const near=nearbyLadder();
  if(near!==ladderCandidate){ladderCandidate=near;ladderWait=0}
  if(state.climbing===null&&near>=0&&camera.position.y-1.7<ladders[near].top-.45&&interactionStill()&&performance.now()>ladderCooldown){ladderWait+=dt;if(ladderWait>=.45){stopEmote();toggleLadder();ladderWait=0}}else ladderWait=0;
  const nearCase=state.pickups.some(p=>p.kind==='case'&&Date.now()>=p.readyAt&&camera.position.y<2.7&&Math.hypot(camera.position.x-p.x,camera.position.z-p.z)<=2);
  $('ladder-hint').textContent=state.climbing!==null?'AUTO CLIMB · S DOWN · SPACE / E LET GO':near>=0?'STOP BESIDE LADDER · AUTO CLIMB':nearCase?'STAND STILL · CASE OPENS AUTOMATICALLY':'';
}
function toggleLadder(){
  if(!isPlaying())return;if(state.climbing!==null){state.climbing=null;state.onGround=false;ladderCooldown=performance.now()+1200;return}
  const index=nearbyLadder();if(index<0)return;const l=ladders[index];state.climbing=index;state.velocityX=state.velocityY=state.velocityZ=state.hopChain=0;state.onGround=false;camera.position.x=l.x;camera.position.z=l.z;
}
function interactOrEmote(){
  state.buildMode=false;
  if(state.climbing!==null||nearbyLadder()>=0){stopEmote();toggleLadder();return}
  if(tryStartAirdropOpen())return;
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
  if(drop&&airdropCinematicActive())return brollView(performance.now());
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
function requestBuild(){if(airdropFrozen()||Date.now()-state.lastBuildAttempt<260)return;state.lastBuildAttempt=Date.now();const p=localBuildCandidate();if(!p||buildError(p,myPublic()))return;publishCombatPose();sendHost({t:'build',kind:p.type,x:p.x,y:p.y,z:p.z,rotation:p.rotation})}
function updateBuilding(){
  if(state.host&&state.matchActive&&state.builds.some(p=>p.expiresAt<=Date.now())){syncBuilds(state.builds.filter(p=>p.expiresAt>Date.now()));broadcast({t:'builds',builds:state.builds})}
  if(!state.buildMode||!isPlaying()){if(buildGhost)buildGhost.visible=false;$('build-hint').textContent='';return}
  if(!buildGhost||buildGhost.userData.type!==state.buildType){if(buildGhost)world.remove(buildGhost);buildGhost=buildMesh(state.buildType);buildGhost.userData.type=state.buildType;buildGhost.traverse(m=>{if(m.isMesh){m.material=ghostMaterial;m.castShadow=false}});world.add(buildGhost)}
  if(state.buildHeld)requestBuild();if(performance.now()-buildPreviewAt<50){weaponModel.visible=meleeModel.visible=false;return}buildPreviewAt=performance.now();const p=localBuildCandidate(),error=buildError(p,myPublic());buildGhost.visible=!!p;if(p){buildGhost.position.set(p.x,p.y,p.z);buildGhost.rotation.y=p.rotation*Math.PI/2;ghostMaterial.color.set(error?0xff685c:0x55efb4)}
  weaponModel.visible=meleeModel.visible=false;$('build-hint').textContent=`${state.buildType.toUpperCase()} · UNLIMITED · 30s · T SWITCH · R ROTATE · HOLD CLICK BUILD · B EXIT${error?' — '+error:''}`;
}
function updateClimbing(dt){
  const l=ladders[state.climbing];if(!l){state.climbing=null;return}
  if(state.keys.Space){state.climbing=null;state.velocityY=5;ladderCooldown=performance.now()+1200;return}
  const direction=state.keys.KeyS?-1:1,foot=clamp(camera.position.y-1.7+direction*3.6*dt,l.bottom,l.top);camera.position.set(l.x,foot+1.7,l.z);
  if((direction>0&&foot>=l.top)||(direction<0&&foot<=l.bottom)){camera.position.set(l.exitX,foot+1.7,l.exitZ);state.climbing=null;state.onGround=true;state.velocityY=0;ladderCooldown=performance.now()+1200}
}
function hasClearShot(from,to){if(state.map==='factory'&&factorySteamBlocksSight(from,to))return false;const direction=new THREE.Vector3().subVectors(to,from),distance=direction.length();if(distance<.01)return false;raycaster.set(from,direction.normalize());raycaster.far=distance;return raycaster.intersectObjects(shotBlockers,false).length===0}
function makeBotBrain(p,i,now){
  const skill=.82+Math.random()*.46;
  return{skill,wob:{sniper:.008,ar:.016,smg:.02,shotgun:.026}[p.weapon]||.018,tau:(.045+Math.random()*.06)/skill,react:(160+Math.random()*220)/skill,turnTrack:2.4*skill,turnFlick:7.5*skill,strafeDir:i%2?1:-1,strafeActive:true,nextSense:0,nextShot:now+400+Math.random()*400,nextHop:now+1400+Math.random()*1600,nextSlide:now+3500+Math.random()*3000,slideUntil:0,burstLeft:2+Math.floor(Math.random()*6),burstUntil:0,ammo:WEAPONS[p.weapon].mag,vx:0,vz:0,stuck:0,targetId:null,visible:false,lastSeenAt:-Infinity,lastX:p.x,lastZ:p.z,engagedAt:now,aimX:p.x,aimY:1.45,aimZ:p.z,wobT:Math.random()*9,wobFY:2+Math.random()*2.6,wobPY:Math.random()*6.3,wobFP:1.3+Math.random()*1.7,wobPP:Math.random()*6.3,strafeUntil:0,commitAt:0,goalX:p.x,goalZ:p.z,goalUntil:0,pauseUntil:0,lookYaw:0,detour:0,detourUntil:0,reloadUntil:0,prevTX:null,prevTZ:null,prevAt:0,tSpeed:0,rangeNow:16}
}
function updateBots(dt){
  if(!state.practice||!state.matchActive||state.map==='surf'||airdropFrozen())return;
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
function updateNetwork(now){if(now-state.lastNet<33)return;state.lastNet=now;if(state.host)hostSnapshot();else publishCombatPose()}
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
let resultsRenderer,resultsScene,resultsCamera,resultsActors=[],resultsStarted=0;
const podiumSlots=[{x:0,y:.54,delay:1.7,color:0xffcf65},{x:2.15,y:.28,delay:.95,color:0xbcd6e4},{x:-2.15,y:.1,delay:.2,color:0xdba67f}];
function prepareResultsStage(ranked){
  const stage=$('results-stage');if(!stage?.getBoundingClientRect)return;
  if(!resultsRenderer){
    resultsRenderer=new THREE.WebGLRenderer({alpha:true,antialias:true});resultsRenderer.setPixelRatio(Math.min(devicePixelRatio,1.5));stage.appendChild(resultsRenderer.domElement);
    resultsCamera=new THREE.PerspectiveCamera(33,1,.1,40);
    new ResizeObserver(()=>resizeResultsStage()).observe(stage);
  }
  // Each round owns its podium resources; don't accumulate characters between matches.
  if(resultsScene){const geometries=new Set(),materials=new Set();resultsScene.traverse(o=>{if(o.isMesh){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m)}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose())}
  resultsScene=new THREE.Scene();resultsActors=[];
  resultsScene.add(new THREE.HemisphereLight(0xfff5db,0x48758d,3));const light=new THREE.DirectionalLight(0xffe5b6,3.2);light.position.set(-3,6,-5);resultsScene.add(light);
  ranked.slice(0,3).forEach((p,rank)=>{const slot=podiumSlots[rank],group=new THREE.Group(),actor=createPlayerMesh(p,false),height=slot.y+.18;
    const base=new THREE.Mesh(new THREE.CylinderGeometry(.85,.95,height,48),new THREE.MeshStandardMaterial({color:slot.color,roughness:.48,metalness:.25}));base.position.y=height/2;group.add(base);actor.position.y=height;actor.rotation.y=rank===1?-.2:rank===2?.2:0;group.add(actor);group.position.x=slot.x;resultsScene.add(group);resultsActors.push({group,actor,slot,height});
  });resultsStarted=performance.now();resizeResultsStage();
}
function resizeResultsStage(){if(!resultsRenderer)return;const {width,height}=$('results-stage').getBoundingClientRect();if(!width||!height)return;resultsRenderer.setSize(width,height,false);resultsCamera.aspect=width/height;resultsCamera.position.set(0,3.3,-Math.max(8.5,7/resultsCamera.aspect));resultsCamera.lookAt(0,1.35,0);resultsCamera.updateProjectionMatrix()}
function renderResults(now){
  if(!resultsScene)return;const elapsed=(now-resultsStarted)/1000,reduced=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  for(const {group,actor,slot,height} of resultsActors){const t=reduced?1:THREE.MathUtils.clamp((elapsed-slot.delay)/.7,0,1),ease=1-Math.pow(1-t,3);group.visible=t>0;group.position.y=(1-ease)*-.65;group.scale.setScalar(.82+.18*ease);actor.position.y=height+(reduced?0:Math.sin(elapsed*2+slot.x)*.018);}
  resultsRenderer.render(resultsScene,resultsCamera);
}
function finishMatch(players){
  if(!state.matchActive)return;state.matchActive=false;airdropPlan=null;resetAirdropState();clearInput();controls.unlock();$('hud').classList.remove('active');$('respawn').classList.remove('active');
  const ranked=Object.values(players||state.players).sort((a,b)=>(b.kills||0)-(a.kills||0)||(a.deaths||0)-(b.deaths||0)),myRank=ranked.findIndex(p=>p.id===state.id),me=ranked[myRank];
  $('result-title').textContent=myRank===0?'You take the crown.':'Good game. Run it back?';
  $('result-summary').textContent=me?`You placed #${myRank+1} · ${me.kills||0} eliminations · ${me.deaths||0} deaths`:'The final standings';
  $('podium').innerHTML=[1,0,2].map(rank=>{const p=ranked[rank];return p?`<div class="podium-player place-${rank+1}" style="--reveal-delay:${podiumSlots[rank].delay}s"><span class="podium-rank">${['1ST','2ND','3RD'][rank]}</span><strong>${escapeHtml(p.name)}${p.id===state.id?' <small>YOU</small>':''}</strong><span>${p.kills||0} eliminations</span></div>`:'<div class="podium-empty"></div>'}).join('');
  $('results-rest').innerHTML=ranked.slice(3).map((p,i)=>`<div class="result-runner"><span>#${i+4} ${escapeHtml(p.name)}</span><span>${p.kills||0} K · ${p.deaths||0} D</span></div>`).join('');
  $('play-again').textContent=state.practice?'Back to loadout':'Return to lobby';showScreen('results');state.mode='results';prepareResultsStage(ranked);if(state.host)broadcast({t:'end',players:state.players});
}
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
  const me=state.players[state.id];if(me){state.kills=me.kills??state.kills;state.health=me.health??state.health}$('kills').textContent=state.kills;$('health-number').textContent=Math.ceil(state.health);$('health-bar').style.width=`${state.health}%`;$('ammo').textContent=state.ammo;$('reserve').textContent=state.special&&Number.isFinite(state.special.reserve)?state.special.reserve:'∞';$('ammo-readout').style.display=state.equipped==='bat'?'none':'';updateLeaderboard()
}
function addFeed(text){if(!text)return;const d=document.createElement('div');d.textContent=text;$('kill-feed').prepend(d);setTimeout(()=>d.remove(),4000)}
function spawnFor(i){const pts=MAPS[state.map].spawns,p=pts[i%pts.length];return{x:p[0],z:p[1]}}
// ---------- Airdrop event + special weapons ----------
// Host decides timing, loot and every hit. Clients only render the shared `drop` and ask to open or fire.
const AIRDROP={BROLL:4000,RELEASE:1400,CHUTE:1700,LAND:10000,ALT:27,PLANE_SPEED:38,OPEN_RANGE:2.2,OPEN_HOLD:1500,MIN_DELAY:45000,MAX_DELAY:75000,BANNER:4500};
const SPECIALS={
  rpg:{name:'Raptor RPG',mag:1,reserve:Infinity,reload:1250,rate:500,spread:.004,range:100,color:0x56613a,move:1,tier:0,speed:75,kind:'rocket'},
  toilet:{name:'Skibidi Toilet Gun',mag:5,reserve:Infinity,reload:1400,rate:400,spread:.004,range:85,color:0xefebe3,move:1,tier:0,speed:65,kind:'orb'}
};
const SPECIAL_LABELS={rpg:'the RPG',toilet:'the Skibidi Toilet Gun'};
const ROCKET={radius:6.5,max:240,min:45,self:.22,buildRadius:4};
const VORTEX={radius:5.5,duration:1500,tick:250,tickDamage:12,popRadius:4.5,popDamage:100,direct:100,pull:32,charge:80};
let airdropPlan=null,drop=null,brollCamera=null,projectileSerial=0,vortexSerial=0,puffGeometry=null;
const specialOwners=new Map(),openHolds=new Map(),projectiles=[],vortices=[],blasts=[],smokePuffs=[];
const _dropA=new THREE.Vector3(),_dropB=new THREE.Vector3();

function activeType(){return state.special?.type||state.selectedWeapon}
function gunStats(){return state.special?SPECIALS[state.special.type]:weaponStats(state.selectedWeapon)}
function airdropElapsed(now=performance.now()){return drop?now-drop.announcedAt:-Infinity}
function airdropFrozen(now=performance.now()){const t=airdropElapsed(now);return t>=0&&t<AIRDROP.BROLL}
function airdropCinematicActive(now=performance.now()){return airdropFrozen(now)&&state.matchActive&&state.alive&&state.mode==='game'}
function dropForward(){return new THREE.Vector3(-Math.sin(drop.heading),0,-Math.cos(drop.heading))}
function dropPlanePos(t,out=new THREE.Vector3()){return out.set(drop.x,drop.y+AIRDROP.ALT+1.8,drop.z).addScaledVector(dropForward(),(t-AIRDROP.RELEASE)/1000*AIRDROP.PLANE_SPEED)}
function dropCratePos(t,out=new THREE.Vector3()){const f=clamp((t-AIRDROP.RELEASE)/(AIRDROP.LAND-AIRDROP.RELEASE),0,1),sway=(1-f)*.35;return out.set(drop.x+Math.sin(t*.0021)*sway,drop.y+(AIRDROP.ALT-1)*(1-f),drop.z+Math.cos(t*.0017)*sway)}
// Highest walkable box top under the map center, so the crate rests on whatever is really there.
function landingHeight(x,z){let top=0;for(const c of colliders){if(c.ramp||c.airdrop||!Number.isFinite(c.maxY)||c.maxY>AIRDROP.ALT-4)continue;if(x>c.minX&&x<c.maxX&&z>c.minZ&&z<c.maxZ)top=Math.max(top,c.maxY)}return top}
// Nearest spot to the map center where the whole crate fits (Piazza's center is a solid fountain).
function findLandingSpot(){
  const fits=(x,z,y)=>[[0,0],[-.7,-.7],[.7,-.7],[-.7,.7],[.7,.7]].every(([dx,dz])=>!colliders.some(c=>!c.ramp&&!c.airdrop&&x+dx>c.minX&&x+dx<c.maxX&&z+dz>c.minZ&&z+dz<c.maxZ&&(c.maxY??Infinity)>y+.05&&(c.minY??-Infinity)<y+.9));
  for(let r=0;r<=14;r+=1)for(let i=0,n=r?Math.max(8,r*4):1;i<n;i++){const a=i/n*Math.PI*2,x=Math.cos(a)*r,z=Math.sin(a)*r,y=landingHeight(x,z);if(fits(x,z,y))return{x,y,z}}
  return{x:0,y:landingHeight(0,0),z:0};
}
function pointBlocked(q){if(q.y<=.02)return true;return colliders.some(c=>!c.ramp&&q.x>c.minX&&q.x<c.maxX&&q.z>c.minZ&&q.z<c.maxZ&&q.y>(c.minY??-Infinity)&&q.y<(c.maxY??Infinity))}

function scheduleAirdrop(){airdropPlan=state.map==='surf'?null:{at:Date.now()+AIRDROP.MIN_DELAY+Math.random()*(AIRDROP.MAX_DELAY-AIRDROP.MIN_DELAY),item:Math.random()<.5?'rpg':'toilet',heading:Math.random()*Math.PI*2,done:false}}
// The item stays host-only until the crate is opened.
function publicDrop(){if(!drop)return null;return{id:drop.id,x:drop.x,y:drop.y,z:drop.z,heading:drop.heading,since:performance.now()-drop.announcedAt,openedBy:drop.openedBy||null,openedName:drop.openedName||null,item:drop.openedBy?drop.item:null}}
function announceAirdrop(){
  airdropPlan.done=true;
  const spot=findLandingSpot();startLocalAirdrop({id:'drop-'+Date.now().toString(36),...spot,heading:airdropPlan.heading,since:0});drop.item=airdropPlan.item;
  broadcast({t:'airdrop',drop:publicDrop()});
}
function applyDropState(pub){
  if(!pub){if(drop)removeDrop();return}
  if(!drop||drop.id!==pub.id){if(drop)removeDrop();startLocalAirdrop(pub)}
  if(pub.openedBy&&!drop.openedBy)openDropLocal(pub);
}
function startLocalAirdrop(pub){
  const now=performance.now(),since=Math.max(0,pub.since||0);
  drop={id:pub.id,x:pub.x,y:pub.y,z:pub.z,heading:pub.heading,announcedAt:now-since,landed:false,openedBy:null,openedName:null,item:null,openedAt:0,lastPuff:0,collider:null,shot:null,bannerUntil:0};
  drop.crate=createSupplyCrate();drop.chute=createParachute();drop.crate.add(drop.chute);drop.chute.position.y=.9;drop.chute.visible=false;drop.crate.visible=false;world.add(drop.crate);
  drop.beacon=createBeacon();drop.beacon.position.set(drop.x,drop.y,drop.z);drop.beacon.visible=false;world.add(drop.beacon);
  if(since<6000){drop.plane=createDinoPlane();world.add(drop.plane)}
  if(since<AIRDROP.BANNER){$('airdrop-banner').classList.add('show');drop.bannerUntil=now+AIRDROP.BANNER-since;addFeed('Airdrop inbound!');botBanterEvent('airdrop')}
  if(since<1500)airdropSiren();
  if(airdropFrozen(now))freezeForCinematic();
}
function freezeForCinematic(){stopEmote();state.velocityX=state.velocityZ=state.hopChain=0;state.fireHeld=false;state.buildMode=false;state.buildHeld=false;state.specialCharge=0;state.openHold=0;resetAim()}
function removeDropCollider(){if(!drop?.collider)return;const i=colliders.indexOf(drop.collider);if(i>=0)colliders.splice(i,1);drop.collider=null}
function removeDrop(){
  if(!drop)return;for(const o of [drop.crate,drop.beacon,drop.plane])if(o?.parent)o.parent.remove(o);
  disposeFx(drop.chute);disposeFx(drop.beacon);removeDropCollider();drop=null;state.openHold=0;
  $('airdrop-banner').classList.remove('show');$('airdrop-marker').classList.remove('show');$('airdrop-hold').classList.remove('show','near');$('hud').classList.remove('cinematic');
}
function landDrop(){
  drop.landed=true;const c=drop.crate;c.visible=!drop.openedAt||performance.now()-drop.openedAt<4500;c.position.set(drop.x,drop.y,drop.z);c.rotation.set(0,drop.heading,0);drop.beacon.visible=!drop.openedBy;
  drop.collider={minX:drop.x-.62,maxX:drop.x+.62,minZ:drop.z-.62,maxZ:drop.z+.62,minY:drop.y,maxY:drop.y+.9,airdrop:true};if(c.visible)colliders.push(drop.collider);else drop.collider=null;
  spawnBlast('dust',new THREE.Vector3(drop.x,drop.y+.1,drop.z),1);const d=c.position.distanceTo(camera.position);playSoundBuffer('magin',.9/(1+d*.05),0,d,.6);tone(70,.3,.07/(1+d*.05),'sine',0,40);
  if(!drop.openedBy)addFeed('Airdrop landed at map center');
}
function openDropLocal(pub){
  drop.openedBy=pub.openedBy;drop.openedName=pub.openedName||'Someone';drop.item=pub.item;drop.openedAt=performance.now();drop.beacon.visible=false;
  const top=new THREE.Vector3(drop.x,drop.y+1.1,drop.z);if(drop.landed){spawnBlast('confetti',top,1);spawnBlast('rocket',top,.25)}
  addFeed(`${drop.openedName} looted ${SPECIAL_LABELS[drop.item]||'the airdrop'}!`);if(pub.openedBy===state.id)botBanterEvent('player_looted');
  const d=top.distanceTo(camera.position),v=1/(1+d*.04);tone(523,.12,.05*v,'triangle');tone(784,.14,.045*v,'triangle',.09);tone(1047,.2,.04*v,'sine',.18);
  $('airdrop-marker').classList.remove('show');$('airdrop-hold').classList.remove('show','near');state.openHold=0;
}
function airdropSiren(){for(let i=0;i<3;i++){tone(520,.3,.045,'sawtooth',i*.38,900);tone(900,.3,.035,'sawtooth',i*.38+.17,520)}tone(78,2.4,.05,'sawtooth',0,60);tone(83,2.4,.035,'square',.04,64)}

// Stand still beside the landed crate; the host re-checks range, timing and ownership.
function tryStartAirdropOpen(){
  if(!drop||drop.openedBy||!drop.landed||!isPlaying()||state.openHold||airdropFrozen())return false;
  if(Math.hypot(camera.position.x-drop.x,camera.position.z-drop.z)>AIRDROP.OPEN_RANGE||Math.abs(camera.position.y-1.7-drop.y)>1.5)return false;
  stopEmote();state.openHold=performance.now();state.fireHeld=false;sendHost({t:'openStart'});return true;
}
function updateOpenHold(now){
  const el=$('airdrop-hold'),near=!!drop&&drop.landed&&!drop.openedBy&&isPlaying()&&!airdropFrozen()&&Math.abs(camera.position.y-1.7-drop.y)<=1.5&&Math.hypot(camera.position.x-drop.x,camera.position.z-drop.z)<=AIRDROP.OPEN_RANGE;
  if(near&&interactionStill()&&!state.openHold)tryStartAirdropOpen();
  el.classList.toggle('near',near);if(near)$('airdrop-hold-label').textContent=state.openHold?'OPENING · STAY STILL…':'STOP BESIDE CRATE · AUTO OPEN';
  if(!state.openHold){el.classList.remove('show');el.style.setProperty('--p','0');return}
  if(!near||!interactionStill()){state.openHold=0;sendHost({t:'openCancel'});el.classList.remove('show');el.style.setProperty('--p','0');return}
  const p=clamp((now-state.openHold)/AIRDROP.OPEN_HOLD,0,1);el.classList.add('show');el.style.setProperty('--p',p.toFixed(3));
  if(p>=1){state.openHold=0;el.classList.remove('show');sendHost({t:'openDrop'})}
}
function playerNearDrop(p,slack=0){return !!drop&&Math.hypot((p.x||0)-drop.x,(p.z||0)-drop.z)<=AIRDROP.OPEN_RANGE+slack&&Math.abs(((p.y??1.7)-1.7)-drop.y)<=1.6}
function hostOpenStart(id){const p=state.players[id];if(state.host&&state.matchActive&&drop?.landed&&!drop.openedBy&&!airdropFrozen()&&p&&p.alive!==false&&playerNearDrop(p,.3))openHolds.set(id,performance.now())}
function hostOpenDrop(id){
  const p=state.players[id],now=performance.now(),started=openHolds.get(id);
  if(!state.host||!state.matchActive||!drop||!p||p.alive===false)return;
  if(drop.openedBy){if(id!==state.id)state.connections.get(id)?.send({t:'notice',message:'Already looted'});else toast('Already looted');return}
  if(airdropElapsed(now)<AIRDROP.LAND||started===undefined||now-started<AIRDROP.OPEN_HOLD-120)return;
  if(!playerNearDrop(p,.3)){openHolds.delete(id);return}
  openHolds.clear();const item=drop.item,spec=SPECIALS[item];
  specialOwners.set(id,{type:item,ammo:spec.mag,reloadUntil:0,last:-Infinity});p.special=item;
  openDropLocal({openedBy:id,openedName:p.name,item});broadcast({t:'airdrop',drop:publicDrop()});
  if(id===state.id)grantSpecial(item);else state.connections.get(id)?.send({t:'special',type:item});
  hostSnapshot();
}

function updateAirdropMarker(t){
  const el=$('airdrop-marker');
  if(!isPlaying()||drop.openedBy||airdropCinematicActive()||!$('scope-overlay').hidden){el.classList.remove('show');return}
  const target=drop.landed?_dropA.set(drop.x,drop.y+1.5,drop.z):t>=AIRDROP.RELEASE?dropCratePos(t,_dropA).add(_dropB.set(0,1.2,0)):_dropA.set(drop.x,drop.y+AIRDROP.ALT,drop.z);
  const distance=Math.round(Math.hypot(target.x-camera.position.x,target.z-camera.position.z)),p=target.clone().project(camera),behind=p.z>1;
  // Clamp inside the HUD-safe band: the top bar holds the leaderboard/timer, the bottom holds health/ammo.
  let x=behind?-p.x:p.x,y=behind?-Math.abs(p.y)-1:p.y;const lx=.88,top=.6,bottom=.62,edge=behind||Math.abs(x)>lx||y>top||y<-bottom;
  if(edge){const s=Math.min(lx/Math.max(Math.abs(x),1e-3),(y>0?top:bottom)/Math.max(Math.abs(y),1e-3),1e3);x*=s;y*=s}
  el.style.transform=`translate(${((x*.5+.5)*innerWidth).toFixed(1)}px,${((-y*.5+.5)*innerHeight).toFixed(1)}px)`;el.classList.add('show');el.classList.toggle('edge',edge);$('airdrop-distance').textContent=`${distance}m`;
}
function pickBrollShot(){
  const C=new THREE.Vector3(drop.x,drop.y,drop.z),f=dropForward(),side=new THREE.Vector3(f.z,0,-f.x),sky=C.clone().add(new THREE.Vector3(0,AIRDROP.ALT*.6,0)),ground=C.clone().add(new THREE.Vector3(0,1.2,0)),up=new THREE.Vector3(0,1,0);
  world.updateMatrixWorld(true);let fallback=null;
  const dirs=[side,side.clone().negate()];for(let i=1;i<8;i++)if(i!==4)dirs.push(side.clone().applyAxisAngle(up,i*Math.PI/4));
  for(const dir of dirs)for(const dist of [24,18,30])for(const h of [3,7,12]){const pos=C.clone().addScaledVector(dir,dist);pos.y+=h;if(pointBlocked(pos)||!hasClearShot(pos,sky))continue;fallback??=pos;if(hasClearShot(pos,ground))return pos}
  return fallback||C.clone().addScaledVector(side,16).add(new THREE.Vector3(0,AIRDROP.ALT+8,0));
}
// The 4s cutscene: a low camera tracks the plane, then follows the falling crate.
function brollView(now){
  const t=now-drop.announcedAt,reduced=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  brollCamera??=new THREE.PerspectiveCamera(50,camera.aspect,.1,500);if(brollCamera.aspect!==camera.aspect){brollCamera.aspect=camera.aspect;brollCamera.updateProjectionMatrix()}
  drop.shot??=pickBrollShot();brollCamera.position.copy(drop.shot);
  if(!reduced)brollCamera.position.lerp(_dropB.set(drop.x,drop.shot.y,drop.z),.2*smoothStep(t/AIRDROP.BROLL));
  const target=reduced?_dropA.set(drop.x,drop.y+AIRDROP.ALT*.5,drop.z):dropPlanePos(t,_dropA).lerp(dropCratePos(Math.max(t,AIRDROP.RELEASE)),smoothStep((t-1400)/1700));
  brollCamera.lookAt(target);weaponModel.visible=meleeModel.visible=false;return brollCamera;
}

function updateAirdrop(dt,now){
  if(state.host&&state.matchActive&&airdropPlan&&!airdropPlan.done&&!drop&&Date.now()>=airdropPlan.at)announceAirdrop();
  if(projectiles.length||vortices.length)world.updateMatrixWorld(true);
  updateProjectiles(dt,now);updateVortices(dt,now);updateBlasts(dt,now);updatePuffs(dt,now);updateSpecial(now);
  $('hud').classList.toggle('cinematic',airdropCinematicActive(now));
  if(!drop){$('airdrop-marker').classList.remove('show');$('airdrop-hold').classList.remove('show','near');return}
  const t=now-drop.announcedAt,crate=drop.crate;
  if(drop.bannerUntil&&now>=drop.bannerUntil){$('airdrop-banner').classList.remove('show');drop.bannerUntil=0}
  if(drop.plane){if(t>6000){world.remove(drop.plane);drop.plane=null}else{dropPlanePos(t,drop.plane.position);drop.plane.rotation.set(0,drop.heading,Math.sin(t*.0015)*.1);for(const p of drop.plane.userData.props)p.rotation.z+=dt*38}}
  if(!drop.landed){
    crate.visible=t>=AIRDROP.RELEASE;
    if(crate.visible){
      dropCratePos(t,crate.position);crate.rotation.set(Math.sin(t*.0023)*.08,drop.heading+t*.0004,Math.cos(t*.0019)*.08);
      const c=clamp((t-AIRDROP.CHUTE)/350,0,1);drop.chute.visible=c>0;drop.chute.scale.setScalar(.2+c*.8);
      if(now-drop.lastPuff>110){drop.lastPuff=now;spawnPuff(_dropB.copy(crate.position).setY(crate.position.y+.4),0xff9a4a,.3,1.4)}
    }
    if(t>=AIRDROP.LAND)landDrop();
  }else if(drop.chute.visible){const c=clamp((t-AIRDROP.LAND)/600,0,1);drop.chute.scale.set(1+c*.3,Math.max(.02,1-c),1+c*.3);drop.chute.position.x=c*1.2;if(c>=1)drop.chute.visible=false}
  if(drop.beacon.visible)drop.beacon.userData.outer.material.opacity=.16+Math.sin(now*.004)*.06;
  if(drop.openedAt){const o=clamp((now-drop.openedAt)/700,0,1),lid=crate.userData.lid;if(lid){lid.position.set(o*.9,.9+Math.sin(o*Math.PI)*1.2,0);lid.rotation.z=-o*1.9}if(now-drop.openedAt>4500&&crate.visible){crate.visible=false;removeDropCollider()}}
  updateAirdropMarker(t);updateOpenHold(now);
}

// Airdrop ownership lasts for the match. Magazines reload and refill on respawn;
// the chosen standard preset remains the fallback and stays on the respawn menu.
function grantSpecial(type){
  const spec=SPECIALS[type];if(!spec||!state.matchActive)return;stopEmote();
  state.normalGunAmmo=state.special?state.normalGunAmmo:state.ammo;state.stowedSpecial=null;
  state.special={type,reserve:Infinity};state.ammo=spec.mag;state.reloading=false;state.specialCharge=0;state.switchPending=null;state.equipped='gun';state.fireHeld=false;resetAim();
  updateWeaponModel();updateHud();publishCombatPose();
  $('loot-notice').textContent=`${spec.name.toUpperCase()} · ${keyName(keybinds.airdropWeapon)} SWITCH NORMAL / AIRDROP`;$('loot-notice').style.color='#ff9a3c';state.lootNoticeUntil=performance.now()+4200;
  tone(660,.12,.05,'triangle');tone(990,.16,.045,'triangle',.1);
}
function toggleAirdropWeapon(){
  if(!isPlaying()||airdropFrozen()||(!state.special&&!state.stowedSpecial)||state.reloading||performance.now()-state.lastShot<350)return;
  stopEmote();state.specialCharge=0;state.fireHeld=false;state.equipped='gun';state.switchPending=null;
  if(state.special){state.special.ammo=state.ammo;state.stowedSpecial=state.special;state.special=null;state.ammo=state.normalGunAmmo??WEAPONS[state.selectedWeapon].mag}
  else{state.normalGunAmmo=state.ammo;state.special=state.stowedSpecial;state.stowedSpecial=null;state.ammo=state.special.ammo??SPECIALS[state.special.type].mag}
  state.lastShot=performance.now();resetAim();sendHost({t:'specialEquip',active:!!state.special});updateWeaponModel();updateHud();publishCombatPose();toast(state.special?SPECIALS[state.special.type].name:weaponStats(state.selectedWeapon).name);
}
function fireSpecial(now){
  if(state.reloading||state.specialCharge||airdropFrozen(now)||now-state.lastShot<gunStats().rate)return;
  if(state.ammo<=0){reload();return}
  if(state.special.type==='toilet'){state.specialCharge=now;tone(180,.36,.03,'sine',0,640);return}
  launchSpecial(now);
}
function launchSpecial(now){
  const type=state.special.type;state.lastShot=now;state.ammo--;updateHud();
  weaponMotion.kick=Math.min(1.4,weaponMotion.kick+(type==='rpg'?1.4:.8));shotShake=Math.min(.012,shotShake+(type==='rpg'?.01:.004));
  publishCombatPose();sendHost({t:'specialFire'});applyShotFeel(type,now);specialSound(type,0);
}
function updateSpecial(now){
  if(!state.special)return;
  if(state.specialCharge&&(!isPlaying()||state.equipped==='bat'||airdropFrozen(now)))state.specialCharge=0;
  if(state.specialCharge&&now-state.specialCharge>=VORTEX.charge){state.specialCharge=0;launchSpecial(now)}
}
function specialSound(type,distance=0){
  const v=1/(1+distance*.05);
  if(type==='rpg'){playSoundBuffer('shotgun',.85*v,0,distance,.62);tone(240,.5,.06*v,'sawtooth',0,70)}
  else{tone(430,.28,.05*v,'sine',0,140);tone(260,.32,.04*v,'triangle',.08,90);tone(523,.09,.03*v,'square',.03);tone(392,.09,.03*v,'square',.14)}
}
function hostSpecialFire(id){
  const p=state.players[id],rec=specialOwners.get(id),now=performance.now();
  if(!state.host||!state.matchActive||!p||p.alive===false||!rec||rec.stowed||now<(rec.switchUntil||0)||airdropFrozen(now)||now<rec.reloadUntil)return;
  if(rec.ammo<=0)rec.ammo=SPECIALS[rec.type].mag;
  const spec=SPECIALS[rec.type],gap=rec.type==='rpg'?spec.reload*.8:spec.rate*.8;if(now-rec.last<gap)return;
  rec.last=now;rec.ammo--;if(rec.ammo<=0)rec.reloadUntil=now+spec.reload;
  const dir=new THREE.Vector3(0,0,-1).applyEuler(new THREE.Euler(p.pitch||0,p.yaw||0,0,'YXZ')),origin=new THREE.Vector3(p.x||0,(p.y??1.7)-(p.sliding?.42:0)-.12,p.z||0).addScaledVector(dir,.9);
  const msg={t:'proj',id:++projectileSerial,kind:spec.kind,owner:id,origin:origin.toArray(),dir:dir.toArray(),speed:spec.speed,max:spec.range};
  broadcast(msg);spawnProjectile(msg,true);
}
function hostSpecialReload(id){
  const p=state.players[id],rec=specialOwners.get(id),now=performance.now();
  if(!state.host||!state.matchActive||!p||p.alive===false||!rec||rec.stowed||now<rec.reloadUntil||rec.ammo>=SPECIALS[rec.type].mag)return;
  rec.ammo=0;rec.reloadUntil=now+SPECIALS[rec.type].reload;
}
function refillSpecialOnRespawn(id){
  const rec=specialOwners.get(id);if(!rec)return;
  rec.ammo=SPECIALS[rec.type].mag;rec.reloadUntil=0;rec.last=-Infinity;
  if(state.players[id])state.players[id].special=rec.stowed?null:rec.type;
}
function spawnProjectile(msg,sim=false){
  const valid=a=>Array.isArray(a)&&a.length===3&&a.every(Number.isFinite);if(!valid(msg.origin)||!valid(msg.dir))return;
  const mesh=msg.kind==='rocket'?createRocket():createOrb(),pos=new THREE.Vector3().fromArray(msg.origin),dir=new THREE.Vector3().fromArray(msg.dir).normalize();
  mesh.position.copy(pos);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,-1),dir);world.add(mesh);
  projectiles.push({id:msg.id,kind:msg.kind,owner:msg.owner,pos,dir,speed:msg.speed||30,max:msg.max||80,dist:0,mesh,sim,born:performance.now(),lastPuff:0});
  remoteShotTimes.set(msg.owner,performance.now());
  if(msg.owner!==state.id)specialSound(msg.kind==='rocket'?'rpg':'toilet',pos.distanceTo(camera.position));
}
function removeProjectile(pr){const i=projectiles.indexOf(pr);if(i>=0)projectiles.splice(i,1);if(pr.mesh.parent)pr.mesh.parent.remove(pr.mesh);disposeFx(pr.mesh)}
function projectileHit(pr,step){
  raycaster.set(pr.pos,pr.dir);raycaster.far=step;const wall=raycaster.intersectObjects(shotBlockers,false)[0];
  let best=wall?wall.distance:Infinity,player=null;const age=performance.now()-pr.born;
  for(let k=1;k<=6&&!player;k++){
    const s=step*k/6;if(s>=best)break;const q=_dropA.copy(pr.pos).addScaledVector(pr.dir,s);
    for(const p of Object.values(state.players)){if(p.alive===false||(p.id===pr.owner&&age<500))continue;const eye=p.y??1.7;if(Math.hypot(q.x-(p.x||0),q.z-(p.z||0))<.55&&q.y>eye-1.75&&q.y<eye+.3){best=s;player=p;break}}
    if(!player&&pointBlocked(q)){best=s;break}
  }
  return Number.isFinite(best)?{point:pr.pos.clone().addScaledVector(pr.dir,Math.max(0,best-.12)),player}:null;
}
function updateProjectiles(dt,now){
  for(let i=projectiles.length-1;i>=0;i--){
    const pr=projectiles[i],step=pr.speed*dt;
    if(pr.sim){const hit=projectileHit(pr,step);if(hit){finishProjectile(pr,hit.point,hit.player);continue}}
    pr.pos.addScaledVector(pr.dir,step);pr.dist+=step;pr.mesh.position.copy(pr.pos);
    if(pr.kind==='orb'){const ring=pr.mesh.userData.ring;if(ring){ring.rotation.x+=dt*9;ring.rotation.y+=dt*13}}
    else if(now-pr.lastPuff>35){pr.lastPuff=now;spawnPuff(_dropB.copy(pr.pos).addScaledVector(pr.dir,.55),0xa29b92,.16,.9)}
    if(pr.sim&&pr.dist>=pr.max){finishProjectile(pr,pr.pos.clone(),null);continue}
    if(!pr.sim&&(pr.dist>pr.max+10||now-pr.born>6000))removeProjectile(pr);
  }
}
function finishProjectile(pr,point,player){
  removeProjectile(pr);broadcast({t:'projEnd',id:pr.id});
  if(pr.kind==='rocket')explodeRocket(point,pr.owner);
  else{if(player)applySpecialHit(pr.owner,player.id,VORTEX.direct);spawnVortexHost(point,pr.owner)}
}
// Self-damage is allowed but never scores a kill for yourself.
function applySpecialHit(owner,targetId,damage){
  if(airdropFrozen())return;const shooter=state.players[owner],target=state.players[targetId];if(!shooter||!target||target.alive===false)return;
  const kills=shooter.kills||0;applyHit(owner,targetId,damage);
  // applyHit can replace player records (host snapshot), so re-read before undoing a self-kill credit.
  const after=state.players[owner];if(owner===targetId&&after&&after.alive===false){after.kills=kills;if(owner===state.id)state.kills=kills}
}
function explodeRocket(point,owner){
  const msg={t:'boom',x:point.x,y:point.y,z:point.z,owner};broadcast(msg);onBoom(msg);
  for(const p of Object.values(state.players)){
    if(p.alive===false)continue;const body=new THREE.Vector3(p.x||0,(p.y??1.7)-.85,p.z||0),d=body.distanceTo(point);
    if(d>ROCKET.radius||(d>.8&&!hasClearShot(point,body)))continue;
    applySpecialHit(owner,p.id,THREE.MathUtils.lerp(ROCKET.max,ROCKET.min,d/ROCKET.radius)*(p.id===owner?ROCKET.self:1));
  }
  for(const b of [...(state.builds||[])])if(Math.hypot(b.x-point.x,(b.y||0)+1-point.y,b.z-point.z)<ROCKET.buildRadius)damageBuild(b.id,999);
}
// Every machine renders the blast; each player also launches themselves (that is the rocket jump).
function onBoom(m){
  const point=new THREE.Vector3(m.x,m.y,m.z);if(![point.x,point.y,point.z].every(Number.isFinite))return;spawnBlast('rocket',point,1);
  const d=point.distanceTo(camera.position);playSoundBuffer('shotgun',1.1/(1+d*.05),0,d,.42);tone(48,.55,.12/(1+d*.04),'sine',0,28);
  shotShake=Math.min(.02,shotShake+.02/(1+d*.15));
  if(!isPlaying()||airdropFrozen())return;
  const body=new THREE.Vector3(camera.position.x,camera.position.y-.85,camera.position.z),dist=body.distanceTo(point),reach=ROCKET.radius*1.3;if(dist>=reach)return;
  const k=1-dist/reach,h=new THREE.Vector3(body.x-point.x,0,body.z-point.z);if(h.lengthSq()>1e-4)h.normalize();else h.set(0,0,0);
  state.velocityX+=h.x*11*k;state.velocityZ+=h.z*11*k;state.velocityY=Math.max(state.velocityY,9*k);state.onGround=false;state.hopChain=0;
}
function spawnVortexHost(point,owner){const msg={t:'vortex',id:++vortexSerial,x:point.x,y:point.y,z:point.z,owner,dur:VORTEX.duration};broadcast(msg);spawnVortex(msg,true)}
function spawnVortex(msg,sim=false){
  if(![msg.x,msg.y,msg.z].every(Number.isFinite))return;const now=performance.now(),fx=createVortexFx(VORTEX.radius);fx.position.set(msg.x,msg.y-.4,msg.z);world.add(fx);
  vortices.push({id:msg.id,x:msg.x,y:msg.y,z:msg.z,owner:msg.owner,born:now,until:now+(msg.dur||VORTEX.duration),nextTick:now+VORTEX.tick,fx,sim});
  const center=new THREE.Vector3(msg.x,msg.y,msg.z);spawnBlast('splash',center,.6);const d=center.distanceTo(camera.position),v=1/(1+d*.05);tone(300,.5,.05*v,'sine',0,90);tone(180,.6,.04*v,'triangle',.1,60);
}
function updateVortices(dt,now){
  for(let i=vortices.length-1;i>=0;i--){
    const v=vortices[i],life=clamp((now-v.born)/(v.until-v.born),0,1),fx=v.fx;
    fx.rotation.y+=dt*(3+life*6);fx.userData.rings.forEach((r,j)=>{r.rotation.z+=dt*(j%2?-5:7);r.scale.setScalar(1-life*.45)});fx.userData.drops.rotation.y-=dt*9;
    if(isPlaying()&&v.owner!==state.id&&!airdropFrozen(now)){const dx=v.x-camera.position.x,dz=v.z-camera.position.z,d=Math.hypot(dx,dz);if(d<VORTEX.radius&&d>.15&&Math.abs(v.y-(camera.position.y-.85))<3){const pull=VORTEX.pull*(1-d/VORTEX.radius*.6)*dt;state.velocityX+=dx/d*pull;state.velocityZ+=dz/d*pull}}
    if(v.sim&&now>=v.nextTick){v.nextTick+=VORTEX.tick;for(const p of Object.values(state.players)){if(p.alive===false||p.id===v.owner)continue;if(Math.hypot((p.x||0)-v.x,(p.z||0)-v.z)<VORTEX.radius&&Math.abs((p.y??1.7)-.85-v.y)<3)applySpecialHit(v.owner,p.id,VORTEX.tickDamage)}}
    if(now>=v.until&&(v.sim||now>v.until+1200)){if(v.sim)broadcast({t:'vortexPop',id:v.id});popVortex(v,v.sim)}
  }
}
function popVortex(v,effects=true){
  const i=vortices.indexOf(v);if(i>=0)vortices.splice(i,1);if(v.fx.parent)v.fx.parent.remove(v.fx);disposeFx(v.fx);
  const center=new THREE.Vector3(v.x,v.y,v.z);
  if(effects){spawnBlast('splash',center,1.3);const d=center.distanceTo(camera.position),k=1/(1+d*.05);playSoundBuffer('magin',.7*k,0,d,.5);tone(210,.25,.07*k,'sine',0,820)}
  if(!v.sim||!effects)return;
  for(const p of Object.values(state.players)){if(p.alive===false||p.id===v.owner)continue;const body=new THREE.Vector3(p.x||0,(p.y??1.7)-.85,p.z||0),d=body.distanceTo(center);if(d<VORTEX.popRadius&&(d<.8||hasClearShot(center,body)))applySpecialHit(v.owner,p.id,VORTEX.popDamage)}
}
function spawnBlast(kind,point,scale=1){const fx=createBlastFx(kind);fx.position.copy(point);Object.assign(fx.userData,{born:performance.now(),life:kind==='confetti'?1600:kind==='dust'?900:700,scale});world.add(fx);blasts.push(fx)}
function updateBlasts(dt,now){
  for(let i=blasts.length-1;i>=0;i--){
    const fx=blasts[i],u=fx.userData,t=(now-u.born)/u.life;if(t>=1){blasts.splice(i,1);if(fx.parent)fx.parent.remove(fx);disposeFx(fx);continue}
    const burst=1-Math.pow(1-Math.min(1,t*2.2),3);
    if(u.sphere){u.sphere.scale.setScalar(Math.max(.01,(u.kind==='rocket'?ROCKET.radius*.8:u.kind==='splash'?2.4:1.6)*u.scale*burst));u.sphere.material.opacity=.85*(1-t)}
    if(u.ring){u.ring.scale.setScalar(Math.max(.01,(u.kind==='rocket'?5.5:3)*u.scale*Math.min(1,t*1.6)));u.ring.material.opacity=.8*(1-t)}
    for(const p of u.parts){p.vel.y-=(u.kind==='confetti'?4:14)*dt;if(u.kind==='confetti')p.vel.multiplyScalar(1-1.8*dt);p.mesh.position.addScaledVector(p.vel,dt*u.scale);p.mesh.rotation.x+=p.spin.x*dt;p.mesh.rotation.y+=p.spin.y*dt;p.mesh.material.opacity=1-Math.max(0,t-.6)/.4}
  }
}
function spawnPuff(pos,color,size,life){
  puffGeometry??=new THREE.SphereGeometry(1,7,5);let p=smokePuffs.find(s=>!s.mesh.visible);
  if(!p&&smokePuffs.length<60){const mesh=new THREE.Mesh(puffGeometry,new THREE.MeshBasicMaterial({color,transparent:true,opacity:.55,depthWrite:false}));mesh.userData.noHit=true;p={mesh,born:0};smokePuffs.push(p)}
  p??=smokePuffs.reduce((a,b)=>a.born<b.born?a:b);if(p.mesh.parent!==world)world.add(p.mesh);
  p.mesh.material.color.set(color);p.mesh.position.copy(pos);p.born=performance.now();p.life=life*1000;p.size=size;p.mesh.visible=true;
}
function updatePuffs(dt,now){for(const p of smokePuffs){if(!p.mesh.visible)continue;const t=(now-p.born)/p.life;if(t>=1){p.mesh.visible=false;continue}p.mesh.scale.setScalar(p.size*(1+t*2.5));p.mesh.position.y+=dt*.6;p.mesh.material.opacity=.55*(1-t)}}
function resetAirdropState(){
  removeDrop();for(const pr of [...projectiles])removeProjectile(pr);for(const v of [...vortices])popVortex(v,false);
  for(const fx of blasts){if(fx.parent)fx.parent.remove(fx);disposeFx(fx)}blasts.length=0;smokePuffs.forEach(p=>p.mesh.visible=false);
  specialOwners.clear();openHolds.clear();state.special=null;state.stowedSpecial=null;state.normalGunAmmo=null;state.specialCharge=0;state.openHold=0;
}

// ---------- Optional proximity voice chat ----------
// Opt-in mesh: only players who switch Voice on call each other, and the lower peer id always dials so a pair never double-calls.
// Each voice is spatialized at the speaker; in the lobby everyone in voice hears each other at full volume.
const VOICE={maxDistance:25,refDistance:2.5,retryMs:20000,connectTimeout:9000,occlusionMs:200,tagRange:40,talkLevel:.035};
const voicePeers=new Map(),voiceFailedAt=new Map(),voiceWarned=new Set(),voiceTags=new Map();
let voiceStream=null,voiceBus=null,voiceLocalAnalyser=null,voiceMeshAt=0,voiceOcclusionAt=0,voiceStarting=false;
const VOICE_BUTTONS=['voice-hud','voice-lobby','voice-pause'],voiceSample=new Uint8Array(512),_voicePos=new THREE.Vector3(),_voiceDir=new THREE.Vector3();

function voiceAvailable(){return !!state.peer&&!state.practice&&!!navigator.mediaDevices?.getUserMedia}
async function toggleVoice(){
  if(state.practice){toggleBotBanter();return}
  if(state.voiceOn){stopVoice();toast('Voice off');return}
  if(voiceStarting)return;
  if(!voiceAvailable()){toast(state.practice||!state.peer?'Voice chat needs an online room':"Voice chat isn't available in this browser");return}
  voiceStarting=true;unlockAudio();updateVoiceUi();
  try{voiceStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false})}
  catch{voiceStarting=false;voiceStream=null;toast('Microphone blocked · allow mic access to use voice');updateVoiceUi();return}
  voiceStarting=false;
  if(!state.peer){voiceStream.getTracks().forEach(t=>t.stop());voiceStream=null;updateVoiceUi();return}
  state.voiceOn=true;voiceFailedAt.clear();voiceWarned.clear();
  if(audioContext){voiceLocalAnalyser=audioContext.createAnalyser();voiceLocalAnalyser.fftSize=512;audioContext.createMediaStreamSource(voiceStream).connect(voiceLocalAnalyser)}
  announceVoice();updateVoiceMesh(true);updateVoiceUi();toast(`Voice on · headphones recommended · ${keyName(keybinds.voice)} to leave`);
}
function stopVoice(notify=true){
  for(const id of [...voicePeers.keys()])dropVoicePeer(id);
  voiceStream?.getTracks().forEach(t=>t.stop());voiceStream=null;voiceLocalAnalyser=null;
  const was=state.voiceOn;state.voiceOn=false;if(notify&&was&&state.peer)announceVoice();updateVoiceUi();
}
function announceVoice(){if(state.host){const me=state.players[state.id];if(me)me.voice=!!state.voiceOn;hostSnapshot();if(state.mode==='lobby')updateLobby()}else sendHost({t:'voice',on:!!state.voiceOn})}
function wireVoicePeer(peer){
  peer.on('call',call=>{
    if(!state.voiceOn||!voiceStream||!state.players[call.peer]?.voice){call.close();return}
    dropVoicePeer(call.peer);call.answer(voiceStream);trackVoiceCall(call);
  });
}
function trackVoiceCall(call){
  if(!call)return;const entry={call,id:call.peer,startedAt:performance.now(),connected:false,level:0};voicePeers.set(call.peer,entry);
  call.on('stream',stream=>attachVoiceStream(entry,stream));
  call.on('close',()=>{if(voicePeers.get(call.peer)===entry)dropVoicePeer(call.peer)});
  call.on('error',()=>{if(voicePeers.get(call.peer)===entry){dropVoicePeer(call.peer);markVoiceFailed(call.peer)}});
}
function attachVoiceStream(entry,stream){
  if(entry.connected||voicePeers.get(entry.id)!==entry)return;entry.connected=true;voiceFailedAt.delete(entry.id);
  // Chrome only feeds remote WebRTC audio into Web Audio while a media element is playing that stream.
  const el=new Audio();el.srcObject=stream;el.muted=true;el.play?.().catch(()=>{});entry.el=el;
  unlockAudio();if(!audioContext){el.muted=false;return}
  voiceBus??=(()=>{const g=audioContext.createGain();g.gain.value=1.15;g.connect(audioContext.destination);return g})();
  const source=audioContext.createMediaStreamSource(stream),filter=audioContext.createBiquadFilter(),panner=audioContext.createPanner(),analyser=audioContext.createAnalyser();
  filter.type='lowpass';filter.frequency.value=20000;analyser.fftSize=512;
  Object.assign(panner,{panningModel:'HRTF',distanceModel:'linear',refDistance:VOICE.refDistance,maxDistance:VOICE.maxDistance,rolloffFactor:1});
  source.connect(analyser);source.connect(filter);filter.connect(panner);panner.connect(voiceBus);
  Object.assign(entry,{source,filter,panner,analyser});
}
function dropVoicePeer(id){
  const e=voicePeers.get(id);if(!e)return;voicePeers.delete(id);
  try{e.call.close()}catch{}for(const node of [e.source,e.filter,e.panner,e.analyser])try{node?.disconnect()}catch{}
  if(e.el){e.el.pause?.();e.el.srcObject=null}
}
function markVoiceFailed(id){
  voiceFailedAt.set(id,performance.now());if(voiceWarned.has(id))return;voiceWarned.add(id);
  toast(`Voice couldn't connect to ${state.players[id]?.name||'a player'} · their network may block it`);
}
function updateVoiceMesh(force=false){
  const now=performance.now();if(!force&&now-voiceMeshAt<1000)return;voiceMeshAt=now;
  if(!state.voiceOn||!voiceStream||!state.peer||state.peer.destroyed)return;
  for(const [id,e] of voicePeers){const p=state.players[id];if(!p||!p.voice){dropVoicePeer(id);continue}if(!e.connected&&now-e.startedAt>VOICE.connectTimeout){dropVoicePeer(id);markVoiceFailed(id)}}
  for(const p of Object.values(state.players)){
    if(p.id===state.id||p.bot||!p.voice||voicePeers.has(p.id)||String(state.id)>=String(p.id))continue;
    if(now-(voiceFailedAt.get(p.id)??-Infinity)<VOICE.retryMs)continue;
    trackVoiceCall(state.peer.call(p.id,voiceStream));
  }
}
function voiceLevel(analyser){
  if(!analyser)return 0;analyser.getByteTimeDomainData(voiceSample);let sum=0;
  for(let i=0;i<analyser.fftSize;i++){const v=(voiceSample[i]-128)/128;sum+=v*v}return Math.sqrt(sum/analyser.fftSize);
}
function setAudioPosition(node,v,t){if(node.positionX){node.positionX.setTargetAtTime(v.x,t,.04);node.positionY.setTargetAtTime(v.y,t,.04);node.positionZ.setTargetAtTime(v.z,t,.04)}else node.setPosition(v.x,v.y,v.z)}
function updateVoice(now){
  updateVoiceMesh();
  if(audioContext&&state.voiceOn&&voicePeers.size){
    const L=audioContext.listener,t=audioContext.currentTime,ear=camera.position;camera.getWorldDirection(_voiceDir);
    setAudioPosition(L,ear,t);
    if(L.forwardX){L.forwardX.setTargetAtTime(_voiceDir.x,t,.04);L.forwardY.setTargetAtTime(_voiceDir.y,t,.04);L.forwardZ.setTargetAtTime(_voiceDir.z,t,.04);L.upX.value=0;L.upY.value=1;L.upZ.value=0}else L.setOrientation(_voiceDir.x,_voiceDir.y,_voiceDir.z,0,1,0);
    const occlusion=state.matchActive&&now-voiceOcclusionAt>VOICE.occlusionMs;if(occlusion)voiceOcclusionAt=now;
    for(const [id,e] of voicePeers){
      if(!e.panner)continue;const p=state.players[id],mesh=playerMeshes.get(id);
      if(state.matchActive&&p){if(mesh)_voicePos.set(mesh.position.x,mesh.position.y+1.55,mesh.position.z);else _voicePos.set(p.x||0,p.y??1.7,p.z||0)}else _voicePos.copy(ear);
      setAudioPosition(e.panner,_voicePos,t);
      if(occlusion){const blocked=_voicePos.distanceTo(ear)>1&&!hasClearShot(ear,_voicePos.clone());e.filter.frequency.setTargetAtTime(blocked?850:20000,t,.08)}
      else if(!state.matchActive)e.filter.frequency.setTargetAtTime(20000,t,.08);
      e.level=e.level*.7+voiceLevel(e.analyser)*.3;
    }
  }
  const talking=state.voiceOn&&voiceLevel(voiceLocalAnalyser)>VOICE.talkLevel;for(const id of VOICE_BUTTONS)$(id).classList.toggle('talking',talking);
  updateVoiceTags();
}
// Speaker pills over players who are in voice; they light up while that player is talking.
function updateVoiceTags(){
  const root=$('voice-tags'),seen=new Set();
  if(state.matchActive&&isPlaying()&&!airdropCinematicActive())for(const p of Object.values(state.players)){
    if(p.id===state.id||!(p.voice||(p.bot&&banterOn))||p.alive===false)continue;const mesh=playerMeshes.get(p.id);if(!mesh?.visible)continue;
    _voicePos.set(mesh.position.x,mesh.position.y+2.45,mesh.position.z);const distance=_voicePos.distanceTo(camera.position);if(distance>VOICE.tagRange)continue;
    const s=_voicePos.clone().project(camera);if(s.z>1||Math.abs(s.x)>1.05||Math.abs(s.y)>1.05)continue;
    let tag=voiceTags.get(p.id);if(!tag){tag=document.createElement('div');tag.className='voice-tag';root.appendChild(tag);voiceTags.set(p.id,tag)}
    const entry=voicePeers.get(p.id)||(p.bot?botTalk.get(p.id):null),label=`${entry?.connected||p.bot?'🔊':'🔇'} ${p.name||'Player'}`;if(tag.textContent!==label)tag.textContent=label;
    tag.classList.toggle('talking',!!entry&&entry.level>VOICE.talkLevel&&distance<VOICE.maxDistance);tag.classList.toggle('far',distance>=VOICE.maxDistance);
    tag.style.transform=`translate(${((s.x*.5+.5)*innerWidth).toFixed(1)}px,${((-s.y*.5+.5)*innerHeight).toFixed(1)}px) translate(-50%,-100%)`;seen.add(p.id);
  }
  for(const [id,tag] of voiceTags)if(!seen.has(id)){tag.remove();voiceTags.delete(id)}
}
function updateVoiceUi(){
  const bots=state.practice&&!!BOT_VOICE_ENDPOINT,on=bots?banterOn:!!state.voiceOn,key=keyName(keybinds.voice);
  for(const id of VOICE_BUTTONS){const b=$(id);b.classList.toggle('on',on);b.setAttribute?.('aria-pressed',String(on));b.textContent=voiceStarting?'🎙 CONNECTING…':bots?`🎙 BOT TALK ${on?'ON':'OFF'} · ${key}`:on?`🎙 VOICE ON · ${key}`:`🎙 VOICE OFF · ${key}`}
}

// ---------- Practice bot trash talk (Groq + xAI voice via the bot-voice proxy) ----------
// Off unless index.html names a proxy in <meta name="bot-voice-endpoint">. Practice only; V opts in, hold G to talk back.
const BANTER={globalGap:3500,botGap:7000,maxLinesPerMatch:30,maxRepliesPerMatch:15,minClip:350,maxClip:9000,tauntQuiet:22000,subtitleMs:4200,refDistance:4,maxDistance:45};
const BOT_VOICE_ENDPOINT=String(document.querySelector?.('meta[name="bot-voice-endpoint"]')?.content||'').trim().replace(/\/$/,'');
const botTalk=new Map(),banterHistory=[];
let banterOn=false,banterBusy=false,banterLastAt=-Infinity,banterLines=0,banterReplies=0,banterDisabled=false,banterMic=null,banterRecorder=null,banterClipAt=0,banterNextTaunt=0,banterSubtitleUntil=0;

function banterAvailable(){return !!BOT_VOICE_ENDPOINT&&state.practice&&state.map!=='surf'&&!banterDisabled}
function toggleBotBanter(){
  if(!BOT_VOICE_ENDPOINT||state.map==='surf'){toast('Voice chat needs an online room');return}
  if(banterDisabled){toast('Bot trash talk is out of juice for today');return}
  banterOn=!banterOn;unlockAudio();updateVoiceUi();
  toast(banterOn?`Bot trash talk on · hold ${keyName(keybinds.talk)} to talk back`:'Bot trash talk off');
  if(banterOn&&state.matchActive){banterNextTaunt=performance.now()+6000;botBanterEvent('start')}
  if(!banterOn)stopBotSpeech();
}
function resetBotBanter(){banterLines=banterReplies=0;banterHistory.length=0;banterLastAt=-Infinity;banterNextTaunt=performance.now()+BANTER.tauntQuiet;botTalk.forEach(t=>t.lastAt=-Infinity);stopBotSpeech()}
function botIndex(id){return Math.max(0,+String(id).replace(/\D/g,'')||0)}
function nearestBot(maxDistance=Infinity){
  let best=null,bestD=maxDistance;for(const p of Object.values(state.players)){if(!p.bot||p.alive===false)continue;const d=Math.hypot((p.x||0)-camera.position.x,(p.z||0)-camera.position.z);if(d<bestD){best=p;bestD=d}}return best;
}
// Game moments that make a bot speak. Each bot has a cooldown and the whole match has a line budget.
function botBanterEvent(type,data={}){
  if(!banterOn||!banterAvailable()||!state.matchActive)return;
  let bot=null,event=type;
  if(type==='kill'){
    const killer=state.players[data.killer],victim=state.players[data.victim];
    if(killer?.bot&&data.victim===state.id){bot=killer;event='bot_killed_player'}
    else if(victim?.bot&&data.killer===state.id){bot=victim;event='player_killed_bot'}
    else if(killer?.bot&&victim?.bot&&Math.random()<.35){bot=killer;event='bot_killed_bot'}
  }else if(type==='taunt')bot=nearestBot(35);
  else bot=nearestBot();
  if(!bot)return;requestBotLine(bot,event,{headshot:!!data.headshot});
}
function banterContext(bot,event,extra={}){
  const me=state.players[state.id]||{},remaining=Math.max(0,Math.round((state.matchEnd-Date.now())/1000));
  return{event,bot:botIndex(bot.id),player:safeName(),botKills:bot.kills||0,botDeaths:bot.deaths||0,playerKills:me.kills??state.kills,playerDeaths:me.deaths??state.deaths,playerHealth:Math.round(state.health),
    playerWeapon:gunStats().name,botWeapon:weaponStats(bot.weapon,bot.arsenal||{}).name,distance:Math.round(Math.hypot((bot.x||0)-camera.position.x,(bot.z||0)-camera.position.z)),timeLeft:Number.isFinite(remaining)?remaining:0,history:banterHistory.slice(-6),...extra};
}
async function requestBotLine(bot,event,extra={},audio=null){
  const now=performance.now(),talk=botTalk.get(bot.id)||{lastAt:-Infinity,level:0};botTalk.set(bot.id,talk);
  const reply=event==='reply';
  if(banterBusy||(!reply&&(now-banterLastAt<BANTER.globalGap||now-talk.lastAt<BANTER.botGap||banterLines>=BANTER.maxLinesPerMatch)))return;
  banterBusy=true;banterLastAt=talk.lastAt=now;banterLines++;banterNextTaunt=now+BANTER.tauntQuiet;
  try{
    const form=new FormData();form.append('context',JSON.stringify(banterContext(bot,event,extra)));if(audio)form.append('audio',audio,'clip.webm');
    const r=await fetch(`${BOT_VOICE_ENDPOINT}/talk`,{method:'POST',body:form});
    if(r.status===429){banterDisabled=true;banterOn=false;updateVoiceUi();toast('Bot trash talk hit today\'s limit');return}
    if(r.status===204||!r.ok)return;
    const line=decodeURIComponent(r.headers.get('X-Line')||''),heard=decodeURIComponent(r.headers.get('X-Heard')||''),mp3=await r.arrayBuffer();
    if(heard)banterHistory.push({speaker:'player',text:heard});if(line)banterHistory.push({speaker:'bot',text:line});while(banterHistory.length>12)banterHistory.shift();
    if(!banterOn||!state.matchActive||!state.players[bot.id])return;
    await playBotLine(bot,line,mp3,heard);
  }catch{}finally{banterBusy=false}
}
async function playBotLine(bot,line,mp3,heard){
  unlockAudio();if(!audioContext)return;
  const buffer=await audioContext.decodeAudioData(mp3.slice(0));stopBotSpeech(bot.id);
  const source=audioContext.createBufferSource(),filter=audioContext.createBiquadFilter(),panner=audioContext.createPanner(),analyser=audioContext.createAnalyser(),gain=audioContext.createGain();
  source.buffer=buffer;filter.type='lowpass';filter.frequency.value=20000;analyser.fftSize=512;gain.gain.value=1.25;
  Object.assign(panner,{panningModel:'HRTF',distanceModel:'linear',refDistance:BANTER.refDistance,maxDistance:BANTER.maxDistance,rolloffFactor:1});
  source.connect(analyser);source.connect(filter);filter.connect(panner);panner.connect(gain);gain.connect(audioContext.destination);
  const talk=botTalk.get(bot.id);Object.assign(talk,{source,filter,panner,analyser,gain,playing:true,connected:true});
  source.onended=()=>{if(talk.source===source){talk.playing=false;talk.level=0;for(const n of [source,filter,panner,analyser,gain])try{n.disconnect()}catch{}}};
  positionBotVoice(bot.id,talk);source.start();
  showBotSubtitle(heard?`You: ${heard}`:'',`${bot.name}: ${line}`);
}
function stopBotSpeech(id){for(const [botId,t] of botTalk){if(id&&botId!==id)continue;if(t.playing)try{t.source.stop()}catch{}t.playing=false;t.level=0}}
function positionBotVoice(id,talk){
  const p=state.players[id],mesh=playerMeshes.get(id);if(!p||!talk.panner)return;
  if(mesh)_voicePos.set(mesh.position.x,mesh.position.y+1.55,mesh.position.z);else _voicePos.set(p.x||0,p.y??1.7,p.z||0);
  setAudioPosition(talk.panner,_voicePos,audioContext.currentTime);
  const blocked=_voicePos.distanceTo(camera.position)>1&&!hasClearShot(camera.position,_voicePos.clone());talk.filter.frequency.setTargetAtTime(blocked?850:20000,audioContext.currentTime,.08);
}
function showBotSubtitle(first,second){const el=$('bot-subtitle');el.textContent=[first,second].filter(Boolean).join('\n');el.classList.add('show');banterSubtitleUntil=performance.now()+BANTER.subtitleMs}
// Push-to-talk: record while G is held, then send the clip to the bot you are closest to.
async function startBotTalk(){
  if(!banterOn||!banterAvailable()||!isPlaying()||banterRecorder||banterReplies>=BANTER.maxRepliesPerMatch)return;
  if(typeof MediaRecorder==='undefined'){toast("This browser can't record voice");return}
  try{banterMic??=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false})}catch{toast('Microphone blocked · allow mic access to talk to bots');return}
  if(!state.keys.KeyG)return;
  const type=['audio/webm;codecs=opus','audio/webm','audio/mp4'].find(t=>MediaRecorder.isTypeSupported?.(t))||'',chunks=[];
  const recorder=new MediaRecorder(banterMic,type?{mimeType:type}:undefined);banterRecorder=recorder;banterClipAt=performance.now();
  recorder.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data)};
  recorder.onstop=()=>{const length=performance.now()-banterClipAt;banterRecorder=null;$('bot-talk').classList.remove('show');
    if(length<BANTER.minClip||!chunks.length)return;const bot=nearestBot();if(!bot)return;banterReplies++;showBotSubtitle('',`${bot.name} is thinking…`);
    requestBotLine(bot,'reply',{},new Blob(chunks,{type:recorder.mimeType||'audio/webm'}))};
  recorder.start();$('bot-talk').textContent=`🎙 TALKING TO ${(nearestBot()?.name||'BOTS').toUpperCase()}…`;$('bot-talk').classList.add('show');
  setTimeout(()=>{if(banterRecorder===recorder)recorder.stop()},BANTER.maxClip);
}
function stopBotTalk(){if(banterRecorder&&banterRecorder.state!=='inactive')banterRecorder.stop()}
function updateBotVoice(now){
  if(banterSubtitleUntil&&now>=banterSubtitleUntil){$('bot-subtitle').classList.remove('show');banterSubtitleUntil=0}
  if(!banterOn||!audioContext)return;
  let speaking=false;for(const [id,t] of botTalk){if(!t.playing)continue;speaking=true;positionBotVoice(id,t);t.level=t.level*.7+voiceLevel(t.analyser)*.3}
  if(speaking&&!(state.voiceOn&&voicePeers.size)){const L=audioContext.listener,t=audioContext.currentTime;camera.getWorldDirection(_voiceDir);setAudioPosition(L,camera.position,t);if(L.forwardX){L.forwardX.setTargetAtTime(_voiceDir.x,t,.04);L.forwardY.setTargetAtTime(_voiceDir.y,t,.04);L.forwardZ.setTargetAtTime(_voiceDir.z,t,.04);L.upX.value=0;L.upY.value=1;L.upZ.value=0}else L.setOrientation(_voiceDir.x,_voiceDir.y,_voiceDir.z,0,1,0)}
  if(state.matchActive&&isPlaying()&&now>=banterNextTaunt&&!banterBusy){banterNextTaunt=now+BANTER.tauntQuiet;const bot=nearestBot(35);if(bot&&hasClearShot(camera.position,new THREE.Vector3(bot.x,(bot.y??1.7)-.3,bot.z)))botBanterEvent('taunt')}
}

function animate(){requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.04),now=performance.now();updateCursor();if(state.mode==='home'&&lobbyRenderer){updateLobbyLook(dt);lobbyRenderer.render(lobbyScene,lobbyCamera);return}if(state.mode==='results'){renderResults(now);updateVoice(now);return}updateAim(dt);if(state.matchActive){advanceMovement(dt);updateBots(dt);if(state.host){const me=state.players[state.id];if(me)Object.assign(me,{x:camera.position.x,y:camera.position.y,z:camera.position.z})}updatePickups(now);updateNetwork(now);updateTimer();syncMeshes(dt);updateHud()}if(state.map==='factory')updateFactoryEffects();updateWeaponMotion(dt,now);updateAimRecoil(dt,now);updateAutomaticFire();updateCombatVisuals(now);updateImpacts(now);updateAirdrop(dt,now);updateVoice(now);updateBotVoice(now);updateRespawnCountdown();updateBuilding();updateFeel(dt,now);renderGameplay(now)}
function resize(){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)}
function clamp(v,a,b){return Math.max(a,Math.min(b,Number(v)||0))}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function leaveToHome(message=''){banterOn=false;stopBotSpeech();stopBotTalk();queueMicrotask(updateVoiceUi);state.matchActive=false;state.practice=false;airdropPlan=null;resetAirdropState();clearInput();controls.unlock();resetPeer();state.players={};playerMeshes.forEach(m=>world.remove(m));playerMeshes.clear();$('hud').classList.remove('active');$('respawn').classList.remove('active');showScreen('home');state.mode='home';document.querySelectorAll('[data-weapon]').forEach(b=>{b.classList.toggle('selected',b.dataset.weapon===state.selectedWeapon);b.setAttribute('aria-checked',b.dataset.weapon===state.selectedWeapon)});updateLobbyPreview();setError(message)}
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
  const sensitivity=LOOK_RADIANS_PER_PIXEL*preferences.sensitivity*aimSensitivity()*(1+(preferences.ads-1)*state.aimBlend);
  camera.rotation.order='YXZ';camera.rotation.y-=dx*sensitivity;
  camera.rotation.x=clamp(camera.rotation.x-dy*sensitivity*(preferences.invertY?-1:1),-1.45,1.45);camera.rotation.z=0;
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

function openSettings(){rebindingAction=null;state.mode='settings';renderKeybinds();renderPreferences();showScreen('settings')}
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
addEventListener('keydown',e=>{
  if(e.code!=='KeyV'||!['lobby','game','pause'].includes(state.mode))return;
  e.preventDefault();e.stopImmediatePropagation();
  if(!e.repeat)toggleVoice();
},true);
addEventListener('keydown',e=>{if(state.matchActive&&!state.alive&&/^(Digit|Numpad)[1-4]$/.test(e.code)){e.preventDefault();chooseRespawnWeapon(Object.keys(WEAPONS)[Number(e.code.slice(-1))-1]);return}if(e.code==='Escape'&&state.matchActive&&state.mode==='game'){pauseGame();return}if(!isPlaying())return;if(['KeyW','KeyA','KeyS','KeyD','Space','KeyR','KeyF','KeyE','KeyB','KeyT','KeyL','KeyM','KeyI','KeyV','KeyG','ControlLeft','ControlRight','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight'].includes(e.code))e.preventDefault();state.keys[e.code]=true;if(e.code==='KeyQ'&&!e.repeat){e.preventDefault();toggleAirdropWeapon();return}if(e.code==='KeyM'&&!e.repeat){soundMuted=!soundMuted;if(audioMaster)audioMaster.gain.setTargetAtTime(soundMuted?0:.65,audioContext.currentTime,.012);toast(soundMuted?'Sound muted':'Sound on');unlockAudio();return}if(e.code==='KeyV'&&!e.repeat){toggleVoice();return}if(e.code==='KeyG'&&!e.repeat){startBotTalk();return}if(['ControlLeft','ControlRight'].includes(e.code)&&!e.repeat){beginSlide();return}if(e.code==='KeyL'&&!e.repeat){requestMouseCapture();return}if(e.code==='KeyB'&&!e.repeat){toggleBuilding();return}if(e.code==='KeyE'&&!e.repeat){interactOrEmote();return}if(e.code==='KeyI'&&!e.repeat){inspectWeapon();return}if(state.buildMode){if(e.code==='KeyT'&&!e.repeat)state.buildType=['wall','ramp','floor'][(['wall','ramp','floor'].indexOf(state.buildType)+1)%3];if(e.code==='KeyR'&&!e.repeat)state.buildRotation=(state.buildRotation+1)%4;return}if(['KeyR','KeyF','ShiftLeft','ShiftRight'].includes(e.code))stopEmote();if(e.code==='KeyR')reload();if(e.code==='KeyF'&&!e.repeat)toggleBat();if(['ShiftLeft','ShiftRight'].includes(e.code)&&!e.repeat&&state.equipped==='gun')state.aiming=!state.aiming});addEventListener('keyup',e=>state.keys[e.code]=false);
addEventListener('blur',clearInput);addEventListener('blur',stopBotTalk);addEventListener('keyup',e=>{if(e.code==='KeyG')stopBotTalk()});document.addEventListener('visibilitychange',()=>{if(document.hidden)clearInput()});
addEventListener('keydown',e=>{if(isPlaying()&&state.map==='surf'&&e.code==='KeyR'&&!e.repeat){e.preventDefault();resetSurfRun(true)}});
addEventListener('mousedown',e=>{if(!isPlaying()||(!controls.isLocked&&e.target!==$('game')))return;if(!controls.isLocked)requestMouseCapture();if(state.buildMode){if(e.button===0){focusGame();state.buildHeld=true;requestBuild()}if(e.button===2){e.preventDefault();toggleBuilding()}return}if(e.button===0||e.button===2)stopEmote();if(e.button===2){e.preventDefault();if(state.equipped==='gun')state.aiming=true;focusGame()}if(e.button===0){focusGame();if(!controls.isLocked)requestMouseCapture();if(state.equipped==='bat')meleeAttack();else{state.fireHeld=true;shoot()}}});addEventListener('mouseup',e=>{if(e.button===0){state.fireHeld=false;state.buildHeld=false;}if(e.button===2)state.aiming=false});document.addEventListener('contextmenu',e=>{if(state.matchActive)e.preventDefault()});addEventListener('mousemove',handleMouseLook);$('game').addEventListener('mouseleave',()=>{state.mouseOver=false;state.mouseX=null;state.mouseY=null;if(!controls.isLocked){state.aiming=false;state.fireHeld=false}});
$('capture-mouse').onclick=requestMouseCapture;
for(const id of VOICE_BUTTONS)$(id).onclick=toggleVoice;updateVoiceUi();
$('settings-open').onclick=openSettings;$('settings-close').onclick=closeSettings;
$('settings-reset').onclick=()=>{keybinds={...DEFAULT_BINDS};preferences={...DEFAULT_PREFERENCES};savePreferences();renderPreferences();rebindingAction=null;saveKeybinds();renderKeybinds();toast('Default controls restored')};
$('keybind-list').onclick=e=>{const button=e.target.closest?.('[data-bind]');if(!button)return;rebindingAction=button.dataset.bind;renderKeybinds()};
$('create-room').onclick=createRoom;$('join-room').onclick=joinRoom;$('room-code-input').onkeydown=e=>{if(e.key==='Enter')joinRoom()};$('practice').onclick=practice;$('start-match').onclick=startMatch;$('copy-code').onclick=async()=>{try{await navigator.clipboard.writeText(state.room);toast('Room code copied')}catch{toast(`Room code: ${state.room}`)}};$('leave-lobby').onclick=()=>leaveToHome();$('resume').onclick=()=>{showScreen(null);state.mode='game';requestMouseCapture()};$('leave-match').onclick=()=>leaveToHome();$('play-again').onclick=returnLobby;$('results-home').onclick=()=>leaveToHome();

$('respawn-weapons').onclick=e=>{const button=e.target.closest('[data-respawn-weapon]');if(button)chooseRespawnWeapon(button.dataset.respawnWeapon)};
$('map-select').onchange=e=>{if(state.mode==='home'){setMap(e.target.value);updateLobbyModeUI()}};
function updateLobbyModeUI(){
  $('create-room').style.display='';$('room-panel').style.display='';
  $('practice').querySelector('span').textContent='Practice';
  $('practice').querySelector('small').textContent='Play against bots';
  $('match-badge').innerHTML='Free-for-all <span>3-minute rounds</span>';
  $('match-summary').textContent=state.map==='factory'?'Three floors: stop beside ladders to auto-climb from ground to mezzanines, then up to the bridge. Belts carry you; steam hides players but not bullets.':'Most eliminations wins. Respawn and keep playing.';
  $('win-rule').textContent='Most eliminations in 3 minutes wins.';
}
renderKeybinds();buildChoices();initWorld();showScreen('home');
