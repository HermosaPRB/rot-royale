import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { detailPlaza } from './plaza.js?v=detail-6';
import { createWoodenCharacter } from './wooden-character.js?v=melee-10';
import { createHeldGun, createFirstPersonWeapon, createMeleeBat } from './combat-models.js?v=weapons-12';
import { mergeRigidParts } from './surface-details.js?v=detail-6';

const $ = (id) => document.getElementById(id);
const screens = ['home','lobby','pause','results'];
const CHARACTERS = [
  {id:'wooden',name:'Wooden Bonker',emoji:'🪵',portrait:'./assets/wooden-bonker.png',color:0xc18a43,shape:'wooden'},
  {id:'croco',name:'Croco Macchiato',emoji:'🐊',color:0x57c5be,shape:'croco'},
  {id:'mozza',name:'Signora Mozza',emoji:'🧀',color:0xffeee0,shape:'cheese'},
  {id:'gabbiano',name:'Gabbiano Gelato',emoji:'🍦',color:0xe97b9c,shape:'cone'}
];
const WEAPONS = {
  ar:{name:'Espresso AR',icon:'☕',automatic:true,damage:18,rate:115,mag:30,reserve:90,reload:1450,spread:.009,pellets:1,range:72,color:0xe74831},
  shotgun:{name:'Biscotti Boomstick',icon:'🥨',damage:11,rate:720,mag:6,reserve:30,reload:1900,spread:.075,pellets:8,range:24,color:0xf2b84b},
  sniper:{name:'Lungo Sniper',icon:'🥄',damage:82,rate:1050,mag:5,reserve:20,reload:2100,spread:.001,pellets:1,range:120,color:0x57c5be},
  smg:{name:'Ristretto SMG',icon:'⚡',automatic:true,damage:11,rate:72,mag:40,reserve:120,reload:1350,spread:.022,pellets:1,range:55,color:0xe97b9c}
};

const state = {
  mode:'home',host:false,practice:false,peer:null,conn:null,connections:new Map(),room:'',id:'',
  players:{},selectedChar:'wooden',selectedWeapon:'ar',keys:{},health:100,kills:0,deaths:0,alive:true,
  ammo:30,reserve:Infinity,reloading:false,lastShot:0,matchEnd:0,matchActive:false,lastNet:0,velocityY:0,onGround:true,
  pointerLockFailed:false,capturePending:false,mouseX:null,mouseY:null,mouseOver:false,
  meleeStart:-Infinity,lastMelee:-Infinity,reloadStart:0,aiming:false,aimProgress:0,aimBlend:0,equipped:'gun',headshotAt:-Infinity,fireHeld:false,respawnAt:0
};

let scene,camera,renderer,controls,clock,world,playerMeshes=new Map(),raycaster,weaponModel,meleeModel;
const MELEE={damage:50,range:2.8,cooldown:800,duration:520,cone:.65};
const meleeCooldowns=new Map(),meleeVisuals=new Map();
const shotCooldowns=new Map(),hitModels=new Map(),hitReactions=new Map();
const coffeeBursts=[];let coffeeGeometry,coffeeMaterial;
const impactTransform=new THREE.Object3D();
const weaponRigs=new Map();
const weaponMotion={kick:0,walk:0,phase:0,yaw:null,pitch:null,swayX:0,swayY:0};
const AIM_PROFILES={
  ar:{fov:58,raise:.20,lower:.14,kick:.052,settle:17,label:'IRON SIGHTS'},
  smg:{fov:64,raise:.13,lower:.11,kick:.035,settle:22,label:'QUICK SIGHTS'},
  shotgun:{fov:68,raise:.24,lower:.16,kick:.09,settle:12,label:'BEAD SIGHT'},
  sniper:{fov:22,raise:.34,lower:.17,kick:.075,settle:10,label:'4× SCOPE'}
};
let lobbyRenderer,lobbyScene,lobbyCamera,lobbyFighter;
const lobbyFighters=new Map();
const weaponLabels={ar:'AR',shotgun:'SHOTGUN',sniper:'SNIPER',smg:'SMG'};
const weaponDescriptions={ar:'Full auto / medium range',shotgun:'Heavy / close range',sniper:'Precision / long range',smg:'Full auto / mobile'};
// Shared sensitivity keeps captured and embedded-browser mouse look consistent.
const LOOK_RADIANS_PER_PIXEL=.00656;
const EDGE_TURN_RADIANS_PER_SECOND=5.6;
const colliders=[];
const shotBlockers=[];
const materials=new Map();

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
  const stage=$('fighter-stage');
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
  controls=new PointerLockControls(camera,document.body);controls.pointerSpeed=LOOK_RADIANS_PER_PIXEL/.002;camera.rotation.order='YXZ';controls.addEventListener('lock',()=>{state.capturePending=false;state.pointerLockFailed=false;if(!isPlaying()){controls.unlock();return}$('control-hint').classList.add('hidden')});controls.addEventListener('unlock',()=>{if(isPlaying())pauseGame()});
  document.addEventListener('pointerlockerror',useFallbackControls);
  clock=new THREE.Clock();raycaster=new THREE.Raycaster();world=new THREE.Group();scene.add(world);
  scene.add(new THREE.HemisphereLight(0xfff3c4,0x6c645b,2.2));const sun=new THREE.DirectionalLight(0xfff1cf,3.2);sun.position.set(-25,38,20);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-55;sun.shadow.camera.right=55;sun.shadow.camera.top=55;sun.shadow.camera.bottom=-55;scene.add(sun);
  makePlaza();makeWeapon();initLobbyPreview();window.addEventListener('resize',resize);animate();
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
function makeWeapon(){
  weaponModel=new THREE.Group();camera.add(weaponModel);scene.add(camera);
  updateWeaponModel();
  const skin=mat(0xe49b52,.55);
  meleeModel=new THREE.Group();camera.add(meleeModel);meleeModel.add(createMeleeBat());
  const fist=new THREE.Mesh(new THREE.SphereGeometry(.065,10,7),skin);fist.position.set(0,.16,0);meleeModel.add(fist);meleeModel.visible=false;
}
function updateWeaponModel(){
  const w=WEAPONS[state.selectedWeapon];
  if(weaponModel.userData.type!==state.selectedWeapon){
    if(!weaponRigs.has(state.selectedWeapon))weaponRigs.set(state.selectedWeapon,createFirstPersonWeapon(w.color,state.selectedWeapon));
    weaponModel.clear();weaponModel.add(weaponRigs.get(state.selectedWeapon));weaponModel.userData.type=state.selectedWeapon;weaponModel.userData.rig=weaponRigs.get(state.selectedWeapon);
  }
  $('weapon-name').textContent=state.equipped==='bat'?'WOODEN BAT':w.name.toUpperCase();$('ammo').textContent=state.ammo;$('reserve').textContent='∞';
}

function createPlayerMesh(p,register=true,collisionOnly=false){
  const c=CHARACTERS.find(x=>x.id===p.char)||CHARACTERS[0],g=new THREE.Group();g.userData.playerId=p.id;
  if(c.shape==='wooden'){
    const avatar=createWoodenCharacter(register||collisionOnly?'game':'preview');g.add(avatar);g.userData.avatar=avatar;
  }else{
  const body=new THREE.Mesh(new THREE.CapsuleGeometry(.52,.9,5,9),mat(c.color));body.position.y=1.05;body.castShadow=true;body.userData.playerId=p.id;g.add(body);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.52,14,10),mat(c.color));head.position.y=2.05;head.castShadow=true;head.userData.playerId=p.id;g.add(head);
  const eyeMat=new THREE.MeshBasicMaterial({color:0x191218});[-.2,.2].forEach(x=>{const e=new THREE.Mesh(new THREE.SphereGeometry(.065,8,6),eyeMat);e.position.set(x,2.12,-.48);g.add(e)});
  }
  const gun=createHeldGun(WEAPONS[p.weapon]?.color||0x333333,p.weapon||'ar',!register&&!collisionOnly);g.add(gun);
  const bat=createMeleeBat();bat.visible=false;
  if(g.userData.avatar){const grip=g.userData.avatar.getObjectByName('trigger-hand');grip.add(bat);bat.position.y=-.13;bat.rotation.x=-.25}else{g.add(bat);bat.position.set(.35,1.25,-.45)}
  g.userData.bat=bat;g.traverse(m=>{if(m.isMesh)m.userData.playerId=p.id});
  g.userData.gun=gun;
  if(register){const tag=document.createElement('div');tag.className='name-tag';g.userData.tag=tag;world.add(g);playerMeshes.set(p.id,g)}return g;
}
function syncMeshes(dt=1/60){
  const now=performance.now(),blend=1-Math.exp(-16*dt);
  Object.values(state.players).forEach(p=>{
    if(p.id===state.id)return;const m=playerMeshes.get(p.id)||createPlayerMesh(p),u=m.userData;m.visible=p.alive!==false;
    const x=p.x||0,z=p.z||0,dx=x-m.position.x,dz=z-m.position.z,teleport=!u.initialized||Math.hypot(dx,dz)>12;
    const distance=teleport?0:Math.hypot(dx,dz)*blend,y=Math.max(0,(p.y??1.7)-1.7);
    m.position.x=teleport?x:m.position.x+dx*blend;m.position.z=teleport?z:m.position.z+dz*blend;m.position.y=teleport?y:THREE.MathUtils.lerp(m.position.y,y,blend);
    const yaw=(p.yaw||0)+(p.bot?Math.PI:0),turn=Math.atan2(Math.sin(yaw-m.rotation.y),Math.cos(yaw-m.rotation.y));m.rotation.y+=teleport?turn:turn*blend;u.initialized=true;
    u.stride=(u.stride||0)+distance*5;u.walk=THREE.MathUtils.lerp(u.walk||0,Math.min(1,distance/Math.max(.001,dt)/5),blend);
    const avatar=u.avatar,elapsed=now-(meleeVisuals.get(p.id)??-Infinity),swing=elapsed>=0&&elapsed<MELEE.duration&&p.alive!==false;
    const holding=p.equipped==='bat';u.gun.visible=!swing&&!holding;u.bat.visible=swing||holding;
    const reaction=hitReactions.get(p.id),flinch=reaction?Math.max(0,1-(now-reaction.time)/380):0;
    m.rotation.x=-Math.sin(flinch*Math.PI)*(reaction?.headshot ? .16 : .07);m.rotation.z=Math.sin(flinch*Math.PI)*.045;
    // Gun and hands breathe together. Legs use distance, so standing still never foot-slides.
    const lift=Math.sin(now*.002+p.id.length)*.006+Math.abs(Math.sin(u.stride))*.015*u.walk;
    u.gun.position.y=lift;
    if(avatar){avatar.position.y=lift;avatar.userData.legs.forEach((leg,i)=>leg.rotation.x=Math.sin(u.stride+i*Math.PI)*.46*u.walk);
      avatar.userData.arms.forEach((arm,i)=>{const arc=Math.sin(Math.min(1,elapsed/MELEE.duration)*Math.PI);arm.rotation.x=swing?(i===1?-1.1+arc*1.9:.4):holding?(i===1?-.5:.3):0;arm.rotation.z=swing&&i===1?-.5*arc:0});
    }
  });
  for(const [id,m] of playerMeshes)if(!state.players[id]){world.remove(m);playerMeshes.delete(id)}
}

function myPublic(){return{id:state.id,name:safeName(),char:state.selectedChar,weapon:state.selectedWeapon,equipped:state.equipped,x:camera.position.x,y:camera.position.y,z:camera.position.z,yaw:camera.rotation.y,pitch:camera.rotation.x,health:state.health,kills:state.kills,deaths:state.deaths,alive:state.alive,respawnAt:state.respawnAt}}
function seedSelf(){state.players[state.id]=myPublic();}
function broadcast(msg){if(!state.host)return;state.connections.forEach(c=>{if(c.open)c.send(msg)})}
function sendHost(msg){if(state.host)handleHostMessage(msg,state.id);else if(state.conn?.open)state.conn.send(msg)}
function hostSnapshot(){state.players[state.id]=myPublic();broadcast({t:'snapshot',players:state.players,end:state.matchEnd,active:state.matchActive})}

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
  c.on('open',()=>{state.connections.set(c.peer,c);state.players[c.peer]={id:c.peer,name:(c.metadata?.name||'New Rot').slice(0,16),char:c.metadata?.char||'wooden',weapon:c.metadata?.weapon||'ar',x:0,z:0,kills:0,deaths:0,health:100,alive:true};c.send({t:'welcome',id:c.peer,room:state.room,players:state.players,host:state.id});broadcast({t:'snapshot',players:state.players,end:state.matchEnd,active:state.matchActive});updateLobby()});
  c.on('data',d=>handleHostMessage(d,c.peer));c.on('close',()=>{state.connections.delete(c.peer);delete state.players[c.peer];broadcast({t:'snapshot',players:state.players,end:state.matchEnd,active:state.matchActive});updateLobby()});
}
function wireClient(c){c.on('open',()=>setError(''));c.on('data',d=>handleClientMessage(d));c.on('close',()=>leaveToHome('The host closed the room.'));c.on('error',peerError)}
function handleHostMessage(d,from){
  if(!d||typeof d.t!=='string')return;
  if(d.t==='state'&&state.players[from]){const p=state.players[from];p.x=clamp(d.x,-34,34);p.z=clamp(d.z,-35,35);p.y=clamp(d.y??1.7,1.7,3.5);p.yaw=Number.isFinite(d.yaw)?d.yaw:0;p.pitch=clamp(d.pitch??0,-1.45,1.45);p.equipped=d.equipped==='bat'?'bat':'gun'}
  if(d.t==='shot')resolveShot(from);
  if(d.t==='melee')resolveMelee(from);
  if(d.t==='ready')updateLobby();
}
function handleClientMessage(d){
  if(!d)return;
  if(d.t==='welcome'){state.players=d.players;enterLobby()}
  if(d.t==='snapshot'){state.players=d.players||{};state.matchEnd=d.end||0;if(d.active&&!state.matchActive)beginMatch(false);syncLocalFromSnapshot()}
  if(d.t==='start'){state.matchEnd=d.end;state.players=d.players;beginMatch(false)}
  if(d.t==='event'){addFeed(d.text);if(d.victim===state.id)takeDamageResult(d)}
  if(d.t==='meleeSwing'&&d.id!==state.id)meleeVisuals.set(d.id,performance.now());
  if(d.t==='meleeHit'&&d.id===state.id)showHitmarker();
  if(d.t==='shotResult'&&d.id===state.id)showShotFeedback(!!d.headshot);
  if(d.t==='impact')showImpact(d);
  if(d.t==='respawn'&&d.id===state.id)doRespawn(d.x,d.z)
  if(d.t==='end')finishMatch(d.players)
  if(d.t==='lobby'){state.matchActive=false;state.players=d.players;enterLobby()}
  if(d.t==='reject')leaveToHome(d.reason)
}
function syncLocalFromSnapshot(){
  const me=state.players[state.id];if(!me)return;state.kills=me.kills||0;state.deaths=me.deaths||0;
  if(state.matchActive&&me.alive===false&&state.alive)takeDamageResult({killed:true,respawnAt:me.respawnAt});
  else if(state.matchActive&&me.alive===true&&!state.alive)doRespawn(me.x,me.z);
  else state.health=me.health??state.health;
  updateHud();
}
function peerError(err){const msg=err.type==='peer-unavailable'?'Room not found. Check the code and try again.':'Connection trouble. Try creating or joining the room again.';leaveToHome(msg)}
function resetPeer(){if(state.peer&&!state.peer.destroyed)state.peer.destroy();state.peer=null;state.conn=null;state.connections.clear()}
function setError(s){$('connection-error').textContent=s}

function enterLobby(){state.mode='lobby';showScreen('lobby');$('room-code').textContent=state.room;updateLobby()}
function updateLobby(){
  const ps=Object.values(state.players);$('player-list').innerHTML=ps.map((p,i)=>{const c=CHARACTERS.find(c=>c.id===p.char)||CHARACTERS[0];return `<div class="player-pill"><span class="dot"></span><strong>${escapeHtml(p.name)}</strong><span>${c.portrait?`<img class="lobby-portrait" src="${c.portrait}" alt="${c.name}">`:c.emoji}</span><small>${i===0?'HOST':WEAPONS[p.weapon]?.name||'PLAYER'}</small></div>`}).join('');
  $('start-match').style.display=state.host?'block':'none';if(state.host){$('start-match').disabled=ps.length<2&&!state.practice;$('start-match').textContent=ps.length<2?'Waiting for another player…':`Start match · ${ps.length} players`}
}
function startMatch(){
  if(!state.host)return;state.matchEnd=Date.now()+180000;Object.values(state.players).forEach((p,i)=>Object.assign(p,{kills:0,deaths:0,health:100,alive:true,...spawnFor(i)}));broadcast({t:'start',end:state.matchEnd,players:state.players});beginMatch(true)
}
function beginMatch(asHost){
  state.meleeStart=state.lastMelee=-Infinity;meleeCooldowns.clear();meleeVisuals.clear();shotCooldowns.clear();hitModels.clear();hitReactions.clear();state.equipped='gun';state.headshotAt=-Infinity;state.respawnAt=0;state.fireHeld=false;resetAim();$('respawn').classList.remove('active');
  state.matchActive=true;state.mode='game';state.health=100;state.kills=0;state.deaths=0;state.alive=true;const w=WEAPONS[state.selectedWeapon];state.ammo=w.mag;state.reserve=Infinity;state.reloading=false;
  const me=state.players[state.id];if(me){camera.position.set(me.x||0,1.7,me.z||12)}else camera.position.set(0,1.7,12);
  state.keys={};state.velocityY=0;state.onGround=true;camera.lookAt(0,1.7,1);showScreen(null);focusGame();$('hud').classList.add('active');$('control-hint').classList.remove('hidden');updateWeaponModel();updateHud();requestMouseCapture();if(asHost)hostSnapshot();
}
function practice(){state.practice=true;state.host=true;state.room='SOLO';state.id='solo';state.players={};seedSelf();for(let i=0;i<3;i++){const id=`bot${i}`;state.players[id]={id,name:['Bot Barista','Nonna.exe','Gelato NPC'][i],char:CHARACTERS[i%4].id,weapon:Object.keys(WEAPONS)[i+1],kills:0,deaths:0,health:100,alive:true,...spawnFor(i+1),bot:true}}startMatch()}

function applyHit(shooterId,targetId,damage,headshot=false){
  const target=state.players[targetId],shooter=state.players[shooterId];if(!target||!shooter||!target.alive)return;target.health=Math.max(0,target.health-Math.min(100,Math.max(1,damage||1)));
  const killed=target.health<=0;
  if(killed){
    target.alive=false;target.respawnAt=Date.now()+3000;target.deaths=(target.deaths||0)+1;shooter.kills=(shooter.kills||0)+1;
    if(shooterId===state.id)state.kills=shooter.kills;if(targetId===state.id)state.deaths=target.deaths;
    const text=headshot?`${shooter.name} headshot ${target.name} ☕`:`${shooter.name} spilled ${target.name}'s coffee`;
    broadcast({t:'event',text,victim:targetId,killer:shooterId,killed:true,headshot,respawnAt:target.respawnAt});addFeed(text);if(targetId===state.id)takeDamageResult({killed:true,respawnAt:target.respawnAt});
    // Snapshots replace player objects. Resolve by stable ID, round and death number instead.
    const roundEnd=state.matchEnd,deathNumber=target.deaths;
    setTimeout(()=>{
      const current=state.players[targetId];
      if(!state.host||!state.matchActive||state.matchEnd!==roundEnd||!current||current.alive!==false||current.deaths!==deathNumber)return;
      Object.assign(current,{health:100,alive:true,respawnAt:0,y:1.7,...spawnFor(Math.floor(Math.random()*6))});
      if(targetId===state.id)doRespawn(current.x,current.z);else state.connections.get(targetId)?.send({t:'respawn',id:targetId,x:current.x,z:current.z});hostSnapshot();
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
    $('respawn').classList.add('active');updateRespawnCountdown();controls.unlock();updateCursor();
  }else{state.health=d.health??me?.health??state.health;if(me)me.health=state.health;flashDamage()}
  updateHud();
}
function updateRespawnCountdown(){if(state.matchActive&&!state.alive)$('respawn-time').textContent=Math.max(0,Math.ceil((state.respawnAt-Date.now())/1000))}
function doRespawn(x,z){
  if(!state.matchActive)return;state.alive=true;state.health=100;state.respawnAt=0;state.reloading=false;state.ammo=WEAPONS[state.selectedWeapon].mag;
  camera.position.set(x??0,1.7,z??12);state.velocityY=0;state.onGround=true;clearInput();
  // Update both stores before HUD/snapshot reads can put the old zero health back.
  const me=state.players[state.id];if(me)Object.assign(me,{health:100,alive:true,respawnAt:0,x:camera.position.x,y:1.7,z:camera.position.z});
  $('respawn').classList.remove('active');updateWeaponModel();updateHud();updateCursor();if(isPlaying()){focusGame();requestMouseCapture()}
}
function flashDamage(){$('damage-flash').classList.add('show');setTimeout(()=>$('damage-flash').classList.remove('show'),190)}

function shoot(){
  if(!isPlaying()||state.equipped==='bat'||state.reloading||performance.now()-state.meleeStart<MELEE.duration)return;const w=WEAPONS[state.selectedWeapon],now=performance.now();if(now-state.lastShot<w.rate)return;if(state.ammo<=0){reload();return}state.lastShot=now;state.ammo--;updateHud();weaponMotion.kick=Math.min(1.4,weaponMotion.kick+({ar:.65,shotgun:1.3,sniper:1.1,smg:.45}[state.selectedWeapon]));
  publishCombatPose();sendHost({t:'shot'});
}
function updateAutomaticFire(){if(state.fireHeld&&WEAPONS[state.selectedWeapon].automatic)shoot()}
function publishCombatPose(){if(state.host)state.players[state.id]=myPublic();else sendHost({t:'state',x:camera.position.x,y:camera.position.y,z:camera.position.z,yaw:camera.rotation.y,pitch:camera.rotation.x,equipped:state.equipped})}
// The host raycasts the actual character geometry, including its own player, and decides damage.
function resolveShot(id,now=performance.now()){
  const attacker=state.players[id],w=WEAPONS[attacker?.weapon];
  if(!state.host||!state.matchActive||!attacker||attacker.alive===false||attacker.equipped==='bat'||!w||now-(shotCooldowns.get(id)??-Infinity)<w.rate)return;
  shotCooldowns.set(id,now);const targets=[...shotBlockers],hits=new Map();world.updateMatrixWorld(true);
  for(const p of Object.values(state.players)){
    if(p.id===id||p.alive===false)continue;
    let model=hitModels.get(p.id);if(!model){model=createPlayerMesh(p,false,true);model.userData.hitMeshes=[];model.traverse(m=>{if(m.isMesh&&!m.userData.noHit)model.userData.hitMeshes.push(m)});hitModels.set(p.id,model)}
    model.position.set(p.x||0,(p.y??1.7)-1.7,p.z||0);model.rotation.set(0,(p.yaw||0)+(p.bot?Math.PI:0),0);model.updateMatrixWorld(true);targets.push(...model.userData.hitMeshes);
  }
  const origin=new THREE.Vector3(attacker.x,attacker.y??1.7,attacker.z),rotation=new THREE.Quaternion().setFromEuler(new THREE.Euler(attacker.pitch||0,attacker.yaw||0,0,'YXZ'));
  for(let n=0;n<w.pellets;n++){
    const dir=new THREE.Vector3((Math.random()-.5)*w.spread,(Math.random()-.5)*w.spread,-1).normalize().applyQuaternion(rotation);raycaster.set(origin,dir);raycaster.far=w.range;
    const first=raycaster.intersectObjects(targets,false)[0],targetId=first?.object.userData.playerId;if(!targetId)continue;
    const local=hitModels.get(targetId).worldToLocal(first.point.clone()),headshot=local.y>=1.80,hit=hits.get(targetId)||{damage:0,headshot:false,point:first.point};
    hit.damage+=w.damage*(headshot?2:1);hit.headshot||=headshot;if(headshot)hit.point=first.point;hits.set(targetId,hit);
  }
  let anyHeadshot=false;
  for(const [target,hit] of hits){
    anyHeadshot||=hit.headshot;const impact={t:'impact',id:target,headshot:hit.headshot,x:hit.point.x,y:hit.point.y,z:hit.point.z};showImpact(impact);broadcast(impact);applyHit(id,target,hit.damage,hit.headshot);
  }
  if(hits.size){if(id===state.id)showShotFeedback(anyHeadshot);else state.connections.get(id)?.send({t:'shotResult',id,headshot:anyHeadshot})}
}
function showShotFeedback(headshot){$('hitmarker').classList.toggle('headshot',headshot);showHitmarker();if(headshot)state.headshotAt=performance.now()}
function showImpact(impact){
  hitReactions.set(impact.id,{time:performance.now(),headshot:impact.headshot});if(!impact.headshot)return;
  let burst=coffeeBursts.find(b=>!b.mesh.visible);
  if(!burst&&coffeeBursts.length<6){coffeeGeometry??=new THREE.SphereGeometry(.035,6,4);coffeeMaterial??=new THREE.MeshBasicMaterial({color:0xa9692f});const mesh=new THREE.InstancedMesh(coffeeGeometry,coffeeMaterial,8);mesh.frustumCulled=false;world.add(mesh);burst={mesh,start:0};coffeeBursts.push(burst)}
  burst??=coffeeBursts.reduce((a,b)=>a.start<b.start?a:b);burst.start=performance.now();burst.mesh.position.set(impact.x,impact.y,impact.z);burst.mesh.visible=true;
}
function updateImpacts(now){
  for(const burst of coffeeBursts){if(!burst.mesh.visible)continue;const t=(now-burst.start)/500;if(t>=1){burst.mesh.visible=false;continue}
    for(let i=0;i<8;i++){const a=i*Math.PI/4;impactTransform.position.set(Math.cos(a)*t*.6,t*.65-t*t*.85,Math.sin(a)*t*.6);impactTransform.scale.setScalar(1-t*.7);impactTransform.updateMatrix();burst.mesh.setMatrixAt(i,impactTransform.matrix)}burst.mesh.instanceMatrix.needsUpdate=true;
  }
  const t=(now-state.headshotAt)/650;$('headshot-callout').style.opacity=t>=0&&t<1?String(Math.min(1,(1-t)*3)):'0';$('headshot-callout').style.transform=`translate(-50%,0) scale(${t>=0&&t<1?1+Math.exp(-t*9)*.3:1})`;
}
function showHitmarker(){$('hitmarker').classList.add('show');setTimeout(()=>$('hitmarker').classList.remove('show'),140)}
function meleeAttack(){
  const now=performance.now();if(!isPlaying()||state.equipped!=='bat'||state.reloading||now-state.lastMelee<MELEE.cooldown)return;
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
  const target=chooseMeleeTarget(attacker);if(!target)return;
  applyHit(id,target.id,MELEE.damage);if(id===state.id)showHitmarker();else state.connections.get(id)?.send({t:'meleeHit',id});
}
function updateCombatVisuals(now){
  if(!meleeModel)return;
  const t=(now-state.meleeStart)/MELEE.duration,swing=isPlaying()&&t>=0&&t<1;
  const holding=state.equipped==='bat';meleeModel.visible=holding&&state.alive;weaponModel.visible=!holding&&state.alive;
  if(swing){const arc=t<.18?-smoothStep(t/.18)*.18:t<.55?-.18+smoothStep((t-.18)/.37)*1.18:1-smoothStep((t-.55)/.45);meleeModel.position.set(.48-arc*.78,-.55+arc*.12,-.65-arc*.15);meleeModel.rotation.set(-.45+arc*.6,-arc*.25,-.7+arc*1.8)}
  else{meleeModel.position.set(.47,-.51+Math.sin(now*.003)*.012,-.70);meleeModel.rotation.set(-.25,0,-.36)}
  if(!swing&&!state.reloading)$('weapon-name').textContent=holding?'WOODEN BAT':WEAPONS[state.selectedWeapon].name.toUpperCase();
  $('melee-status').textContent=holding?(now-state.lastMelee<MELEE.cooldown?'RECOVERING · F GUN':'CLICK SWING · F GUN'):'F · EQUIP BAT';
}
function toggleBat(){
  if(!isPlaying()||performance.now()-state.meleeStart<MELEE.duration)return;
  state.equipped=state.equipped==='bat'?'gun':'bat';state.fireHeld=false;state.reloading=false;resetAim();weaponMotion.kick=0;publishCombatPose();updateWeaponModel();updateCombatVisuals(performance.now());updateHud();
}
function reload(){const w=WEAPONS[state.selectedWeapon];if(!isPlaying()||state.equipped==='bat'||performance.now()-state.meleeStart<MELEE.duration||state.reloading||state.ammo>=w.mag)return;state.reloading=true;state.reloadStart=performance.now();$('weapon-name').textContent='RELOADING…'}
function smoothStep(t){t=THREE.MathUtils.clamp(t,0,1);return t*t*(3-2*t)}
function updateAim(dt){
  const profile=AIM_PROFILES[state.selectedWeapon],target=state.aiming&&state.equipped!=='bat'&&isPlaying()&&!state.reloading&&performance.now()-state.meleeStart>=MELEE.duration;
  state.aimProgress=clamp(state.aimProgress+(target?dt/profile.raise:-dt/profile.lower),0,1);state.aimBlend=smoothStep(state.aimProgress);
  const fov=THREE.MathUtils.lerp(76,profile.fov,state.aimBlend);
  if(Math.abs(camera.fov-fov)>.001){camera.fov=fov;camera.updateProjectionMatrix()}
  controls.pointerSpeed=LOOK_RADIANS_PER_PIXEL/.002*aimSensitivity();
  const scoped=state.selectedWeapon==='sniper'&&state.aimBlend>.78;
  $('scope-overlay').hidden=!scoped;$('scope-overlay').style.opacity=String(smoothStep((state.aimBlend-.78)/.22));
  $('crosshair').style.opacity=String(1-smoothStep(state.aimBlend/.7));
  $('aim-status').textContent=state.equipped==='bat'?'50 DAMAGE':state.aimBlend>.1?profile.label:'SHIFT / RMB · AIM';
}
function aimSensitivity(){return state.aimBlend?Math.tan(THREE.MathUtils.degToRad(camera.fov/2))/Math.tan(THREE.MathUtils.degToRad(38)):1}
function resetAim(){
  state.aiming=false;state.aimProgress=state.aimBlend=0;
  if(camera){camera.fov=76;camera.updateProjectionMatrix()}
  if(controls)controls.pointerSpeed=LOOK_RADIANS_PER_PIXEL/.002;
  $('scope-overlay').hidden=true;$('crosshair').style.opacity='1';
}
function updateWeaponMotion(dt,now){
  const w=WEAPONS[state.selectedWeapon],rig=weaponModel.userData.rig,profile=AIM_PROFILES[state.selectedWeapon],aim=state.aimBlend;
  if((!state.alive||!state.matchActive)&&state.reloading){state.reloading=false;updateWeaponModel()}
  if(state.reloading&&now-state.reloadStart>=w.reload){state.ammo=w.mag;state.reserve=Infinity;state.reloading=false;updateWeaponModel()}
  if(isPlaying()&&!state.reloading&&state.ammo===0&&now-state.lastShot>160)reload();
  if(!rig)return;
  const m=weaponMotion,blend=1-Math.exp(-12*dt),active=isPlaying(),moving=active&&state.onGround&&Math.hypot(camera.position.x-(m.x??camera.position.x),camera.position.z-(m.z??camera.position.z))>.001;
  m.x=camera.position.x;m.z=camera.position.z;
  m.walk=THREE.MathUtils.lerp(m.walk,moving?1:0,blend);m.phase+=dt*(moving?10:3);
  const dy=m.yaw===null?0:Math.atan2(Math.sin(camera.rotation.y-m.yaw),Math.cos(camera.rotation.y-m.yaw)),dp=m.pitch===null?0:camera.rotation.x-m.pitch;
  m.yaw=camera.rotation.y;m.pitch=camera.rotation.x;
  m.swayX=THREE.MathUtils.lerp(m.swayX,clamp(dy*.18/Math.max(dt,.001),-.05,.05),blend);m.swayY=THREE.MathUtils.lerp(m.swayY,clamp(dp*.12/Math.max(dt,.001),-.035,.035),blend);
  m.kick*=Math.exp(-profile.settle*dt);
  const t=state.reloading?(now-state.reloadStart)/w.reload:0,tilt=state.reloading?smoothStep(t/.22)*(1-smoothStep((t-.76)/.24)):0;
  const breath=Math.sin(now*.002)*.0025,bob=Math.sin(m.phase),mag=state.reloading?smoothStep((t-.20)/.16)*(1-smoothStep((t-.57)/.17)):0;
  // Both hands travel with the gun into its real sight line; aiming never rotates the camera.
  const free=1-aim,sight=rig.userData.gun.userData.sight.position;
  rig.position.set(THREE.MathUtils.lerp(.16,-.28,aim),THREE.MathUtils.lerp(-.06,1.74-sight.y,aim),THREE.MathUtils.lerp(-.28,.05,aim));rig.rotation.y=.20*free;
  rig.visible=!(state.selectedWeapon==='sniper'&&aim>.78);
  weaponModel.position.set((bob*.012*m.walk-m.swayX)*free,(-Math.abs(Math.cos(m.phase))*.010*m.walk+breath)*free-.12*tilt,.085*m.kick+.10*tilt);
  weaponModel.rotation.set(profile.kick*m.kick+m.swayY*free-.24*tilt,m.swayX*.3*free,-bob*.012*m.walk*free-.35*tilt);
  rig.userData.support.position.set(-.10*mag,-.16*mag,.16*mag);
  rig.userData.gun.userData.magazine.position.y=1.36-.23*mag;
  const since=(now-state.lastShot)/1000,action=rig.userData.gun.userData.action;
  const cycle=state.selectedWeapon==='shotgun'?smoothStep((since-.13)/.14)*(1-smoothStep((since-.34)/.17)):state.selectedWeapon==='sniper'?smoothStep((since-.18)/.16)*(1-smoothStep((since-.58)/.22)):0;
  action.position.z=.12*cycle;
  if(state.selectedWeapon==='shotgun')rig.userData.support.position.z+=.12*cycle;
  if(state.selectedWeapon==='sniper'){rig.userData.trigger.position.z=.10*cycle;rig.userData.trigger.position.x=.045*cycle}else rig.userData.trigger.position.set(0,0,0);
  rig.userData.flash.visible=active&&!state.reloading&&now-state.lastShot<40;
  rig.userData.flash.scale.setScalar(1+Math.sin(now)*.12);
}

function updateMovement(dt){
  if(!isPlaying())return;const speed=8.5,forwardInput=(state.keys.KeyW?1:0)-(state.keys.KeyS?1:0),sideInput=(state.keys.KeyD?1:0)-(state.keys.KeyA?1:0);const old=camera.position.clone();const forward=new THREE.Vector3();camera.getWorldDirection(forward);forward.y=0;forward.normalize();const right=new THREE.Vector3().crossVectors(forward,camera.up).normalize();const distance=speed*dt/Math.max(1,Math.hypot(forwardInput,sideInput));const dx=(forward.x*forwardInput+right.x*sideInput)*distance,dz=(forward.z*forwardInput+right.z*sideInput)*distance;
  const nextX=clamp(old.x+dx,-34,34);if(!collides(nextX,old.z))camera.position.x=nextX;
  const nextZ=clamp(old.z+dz,-35,35);if(!collides(camera.position.x,nextZ))camera.position.z=nextZ;
  if(state.keys.Space&&state.onGround){state.velocityY=8;state.onGround=false}
  state.velocityY-=22*dt;camera.position.y+=state.velocityY*dt;if(camera.position.y<=1.7){camera.position.y=1.7;state.velocityY=0;state.onGround=true}
}
function collides(x,z){return colliders.some(c=>x>c.minX-.55&&x<c.maxX+.55&&z>c.minZ-.55&&z<c.maxZ+.55)}
function hasClearShot(from,to){const direction=new THREE.Vector3().subVectors(to,from),distance=direction.length();if(distance<.01)return false;raycaster.set(from,direction.normalize());raycaster.far=distance;return raycaster.intersectObjects(shotBlockers,false).length===0}
function updateBots(dt){if(!state.practice||!state.matchActive)return;Object.values(state.players).filter(p=>p.bot&&p.alive).forEach((p,i)=>{const a=performance.now()/2300+i*2.1,nextX=clamp(p.x+Math.sin(a)*dt*2.3,-31,31),nextZ=clamp(p.z+Math.cos(a*1.2)*dt*2.3,-31,31);if(!collides(nextX,p.z))p.x=nextX;if(!collides(p.x,nextZ))p.z=nextZ;p.yaw=Math.atan2(camera.position.x-p.x,camera.position.z-p.z);if(Math.random()<dt*.28){const d=Math.hypot(camera.position.x-p.x,camera.position.z-p.z);if(d<35&&state.alive&&hasClearShot(new THREE.Vector3(p.x,1.7,p.z),camera.position))applyHit(p.id,state.id,10)}})}
function updateNetwork(now){if(now-state.lastNet<65)return;state.lastNet=now;if(state.host)hostSnapshot();else publishCombatPose()}
function updateTimer(){if(!state.matchActive)return;const left=Math.max(0,state.matchEnd-Date.now()),s=Math.ceil(left/1000);$('timer').textContent=`${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;if(left<=0&&state.host)finishMatch(state.players)}
function finishMatch(players){if(!state.matchActive)return;state.matchActive=false;controls.unlock();$('hud').classList.remove('active');const ranked=Object.values(players||state.players).sort((a,b)=>(b.kills||0)-(a.kills||0));$('podium').innerHTML=ranked.map((p,i)=>`<div class="rank-row"><span>#${i+1}</span><span>${escapeHtml(p.name)}</span><strong>${p.kills||0} K</strong></div>`).join('');showScreen('results');state.mode='results';if(state.host)broadcast({t:'end',players:state.players})}
function returnLobby(){if(state.practice){leaveToHome();return}Object.values(state.players).forEach(p=>Object.assign(p,{kills:0,deaths:0,health:100,alive:true}));if(state.host)broadcast({t:'lobby',players:state.players});enterLobby()}

function updateHud(){const me=state.players[state.id];if(me){state.kills=me.kills||state.kills;state.health=me.health??state.health}$('kills').textContent=state.kills;$('health-number').textContent=Math.ceil(state.health);$('health-bar').style.width=`${state.health}%`;$('ammo').textContent=state.ammo;$('reserve').textContent='∞';$('ammo-readout').style.display=state.equipped==='bat'?'none':'';const top=Math.max(0,...Object.values(state.players).map(p=>p.kills||0));$('leader').textContent=top}
function addFeed(text){if(!text)return;const d=document.createElement('div');d.textContent=text;$('kill-feed').prepend(d);setTimeout(()=>d.remove(),4000)}
function spawnFor(i){const pts=[[-25,-29],[25,23],[-23,24],[25,-29],[0,30],[0,-30]];const p=pts[i%pts.length];return{x:p[0],z:p[1]}}
function animate(){requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.04),now=performance.now();updateCursor();if(state.mode==='home'&&lobbyRenderer){if(!matchMedia('(prefers-reduced-motion: reduce)').matches){lobbyFighter.rotation.y=-.35+Math.sin(now*.0007)*.14;lobbyFighter.position.y=Math.sin(now*.002)*.008}lobbyRenderer.render(lobbyScene,lobbyCamera);return}updateAim(dt);if(state.matchActive){updateMouseEdgeTurn(dt);updateMovement(dt);updateBots(dt);updateNetwork(now);updateTimer();syncMeshes(dt);updateHud()}updateWeaponMotion(dt,now);updateAutomaticFire();updateCombatVisuals(now);updateImpacts(now);updateRespawnCountdown();renderer.render(scene,camera)}
function resize(){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)}
function clamp(v,a,b){return Math.max(a,Math.min(b,Number(v)||0))}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function leaveToHome(message=''){state.matchActive=false;state.practice=false;clearInput();controls.unlock();resetPeer();state.players={};playerMeshes.forEach(m=>world.remove(m));playerMeshes.clear();$('hud').classList.remove('active');$('respawn').classList.remove('active');showScreen('home');state.mode='home';setError(message)}
function isPlaying(){return state.matchActive&&state.alive&&state.mode==='game'}
function clearInput(){state.keys={};state.fireHeld=false;state.mouseX=null;state.mouseY=null;state.mouseOver=false;state.meleeStart=-Infinity;weaponMotion.yaw=weaponMotion.pitch=null;weaponMotion.kick=0;resetAim()}
function focusGame(){$('game').focus({preventScroll:true})}
function updateCursor(){$('game').style.cursor=isPlaying()?'none':'auto'}
function useFallbackControls(){state.capturePending=false;state.pointerLockFailed=true;$('control-hint').textContent='SHIFT AIM · F EQUIP BAT · HOLD SPACE JUMP · ESC MENU';$('control-hint').classList.remove('hidden')}
function handleMouseLook(e){
  if(!isPlaying()||controls.isLocked||e.target!==$('game'))return;
  state.mouseOver=true;
  const dx=Number.isFinite(e.movementX)?e.movementX:(state.mouseX===null?0:e.clientX-state.mouseX);
  const dy=Number.isFinite(e.movementY)?e.movementY:(state.mouseY===null?0:e.clientY-state.mouseY);
  state.mouseX=e.clientX;state.mouseY=e.clientY;
  camera.rotation.y-=clamp(dx,-120,120)*LOOK_RADIANS_PER_PIXEL*aimSensitivity();
  camera.rotation.x=clamp(camera.rotation.x-clamp(dy,-120,120)*LOOK_RADIANS_PER_PIXEL*aimSensitivity(),-1.45,1.45);
}
// Embedded browsers may deny mouse capture. Turning at the edges still allows 360° aiming.
function updateMouseEdgeTurn(dt){
  if(!isPlaying()||controls.isLocked||!state.mouseOver||state.mouseX===null)return;
  const edge=Math.min(100,innerWidth*.12),x=clamp(state.mouseX,0,innerWidth);
  if(x<edge)camera.rotation.y+=(1-x/edge)*EDGE_TURN_RADIANS_PER_SECOND*dt*aimSensitivity();
  else if(x>innerWidth-edge)camera.rotation.y-=(1-(innerWidth-x)/edge)*EDGE_TURN_RADIANS_PER_SECOND*dt*aimSensitivity();
}
function requestMouseCapture(){
  if(isPlaying())focusGame();
  if(!isPlaying()||state.pointerLockFailed||state.capturePending||controls.isLocked)return;
  if(!document.body.requestPointerLock){useFallbackControls();return}
  state.capturePending=true;
  try{const pending=document.body.requestPointerLock();if(pending?.catch)pending.catch(useFallbackControls)}catch{useFallbackControls()}
}
function pauseGame(){if(!state.matchActive)return;state.mode='pause';clearInput();showScreen('pause');if(controls.isLocked)controls.unlock()}

addEventListener('keydown',e=>{if(e.code==='Escape'&&state.matchActive&&state.mode==='game'){pauseGame();return}if(!isPlaying())return;if(['KeyW','KeyA','KeyS','KeyD','Space','KeyR','KeyF','ShiftLeft','ShiftRight'].includes(e.code))e.preventDefault();state.keys[e.code]=true;if(e.code==='KeyR')reload();if(e.code==='KeyF'&&!e.repeat)toggleBat();if(['ShiftLeft','ShiftRight'].includes(e.code)&&!e.repeat&&state.equipped==='gun')state.aiming=!state.aiming});addEventListener('keyup',e=>state.keys[e.code]=false);
addEventListener('blur',clearInput);document.addEventListener('visibilitychange',()=>{if(document.hidden)clearInput()});
addEventListener('mousedown',e=>{if(!isPlaying()||(!controls.isLocked&&e.target!==$('game')))return;if(e.button===2){e.preventDefault();if(state.equipped==='gun')state.aiming=true;focusGame()}if(e.button===0){focusGame();if(!controls.isLocked)requestMouseCapture();if(state.equipped==='bat')meleeAttack();else{state.fireHeld=true;shoot()}}});addEventListener('mouseup',e=>{if(e.button===0)state.fireHeld=false;if(e.button===2)state.aiming=false});document.addEventListener('contextmenu',e=>{if(state.matchActive)e.preventDefault()});addEventListener('mousemove',handleMouseLook);$('game').addEventListener('mouseleave',()=>{state.mouseOver=false;state.mouseX=null;state.mouseY=null;if(!controls.isLocked){state.aiming=false;state.fireHeld=false}});
$('create-room').onclick=createRoom;$('join-room').onclick=joinRoom;$('room-code-input').onkeydown=e=>{if(e.key==='Enter')joinRoom()};$('practice').onclick=practice;$('start-match').onclick=startMatch;$('copy-code').onclick=async()=>{try{await navigator.clipboard.writeText(state.room);toast('Room code copied')}catch{toast(`Room code: ${state.room}`)}};$('leave-lobby').onclick=()=>leaveToHome();$('resume').onclick=()=>{showScreen(null);state.mode='game';requestMouseCapture()};$('leave-match').onclick=()=>leaveToHome();$('play-again').onclick=returnLobby;$('results-home').onclick=()=>leaveToHome();

buildChoices();initWorld();showScreen('home');
