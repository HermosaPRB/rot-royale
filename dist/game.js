import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { detailPlaza } from './plaza.js?v=plaza-4';

const $ = (id) => document.getElementById(id);
const screens = ['home','lobby','pause','results'];
const CHARACTERS = [
  {id:'panino',name:'Ballerino Panino',emoji:'🥖',color:0xf2b84b,shape:'bread'},
  {id:'croco',name:'Croco Macchiato',emoji:'🐊',color:0x57c5be,shape:'croco'},
  {id:'mozza',name:'Signora Mozza',emoji:'🧀',color:0xffeee0,shape:'cheese'},
  {id:'gabbiano',name:'Gabbiano Gelato',emoji:'🍦',color:0xe97b9c,shape:'cone'}
];
const WEAPONS = {
  ar:{name:'Espresso AR',icon:'☕',damage:18,rate:115,mag:30,reserve:90,reload:1450,spread:.009,pellets:1,range:72,color:0xe74831},
  shotgun:{name:'Biscotti Boomstick',icon:'🥨',damage:11,rate:720,mag:6,reserve:30,reload:1900,spread:.075,pellets:8,range:24,color:0xf2b84b},
  sniper:{name:'Lungo Sniper',icon:'🥄',damage:82,rate:1050,mag:5,reserve:20,reload:2100,spread:.001,pellets:1,range:120,color:0x57c5be},
  smg:{name:'Ristretto SMG',icon:'⚡',damage:11,rate:72,mag:40,reserve:120,reload:1350,spread:.022,pellets:1,range:55,color:0xe97b9c}
};

const state = {
  mode:'home',host:false,practice:false,peer:null,conn:null,connections:new Map(),room:'',id:'',
  players:{},selectedChar:'panino',selectedWeapon:'ar',keys:{},health:100,kills:0,deaths:0,alive:true,
  ammo:30,reserve:90,reloading:false,lastShot:0,matchEnd:0,matchActive:false,lastNet:0,velocityY:0,onGround:true,
  pointerLockFailed:false,capturePending:false,mouseX:null,mouseY:null,mouseOver:false
};

let scene,camera,renderer,controls,clock,world,playerMeshes=new Map(),raycaster,weaponModel;
const colliders=[];
const shotBlockers=[];
const materials=new Map();

function showScreen(id){ screens.forEach(s=>$(s).classList.toggle('active',s===id)); }
function toast(msg){$('toast').textContent=msg;$('toast').classList.add('show');setTimeout(()=>$('toast').classList.remove('show'),1700)}
function safeName(){return ($('player-name').value.trim()||'Mysterious Rot').slice(0,16)}
function roomCode(){const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';return Array.from({length:6},()=>chars[Math.floor(Math.random()*chars.length)]).join('')}

function buildChoices(){
  $('character-list').innerHTML=CHARACTERS.map((c,i)=>`<button class="character ${i===0?'selected':''}" data-char="${c.id}" role="radio" aria-checked="${i===0}"><span class="avatar">${c.emoji}</span><small>${c.name}</small></button>`).join('');
  $('weapon-list').innerHTML=Object.entries(WEAPONS).map(([id,w],i)=>`<button class="weapon ${i===0?'selected':''}" data-weapon="${id}" role="radio" aria-checked="${i===0}"><span class="weapon-icon">${w.icon}</span><span><strong>${w.name}</strong><small>${id==='ar'?'Balanced / medium range':id==='shotgun'?'Heavy / close range':id==='sniper'?'Precision / long range':'Fast / mobile'}</small></span><span class="stat">${w.damage}</span></button>`).join('');
  document.querySelectorAll('[data-char]').forEach(b=>b.onclick=()=>{state.selectedChar=b.dataset.char;document.querySelectorAll('[data-char]').forEach(x=>{x.classList.toggle('selected',x===b);x.setAttribute('aria-checked',x===b)})});
  document.querySelectorAll('[data-weapon]').forEach(b=>b.onclick=()=>{state.selectedWeapon=b.dataset.weapon;document.querySelectorAll('[data-weapon]').forEach(x=>{x.classList.toggle('selected',x===b);x.setAttribute('aria-checked',x===b)})});
}

function initWorld(){
  scene=new THREE.Scene();scene.background=new THREE.Color(0x82c9e8);scene.fog=new THREE.Fog(0x92c9dc,55,125);
  camera=new THREE.PerspectiveCamera(76,innerWidth/innerHeight,.08,160);camera.position.set(0,1.7,12);
  renderer=new THREE.WebGLRenderer({canvas:$('game'),antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  controls=new PointerLockControls(camera,document.body);controls.pointerSpeed=.82;camera.rotation.order='YXZ';controls.addEventListener('lock',()=>{state.capturePending=false;state.pointerLockFailed=false;if(!isPlaying()){controls.unlock();return}$('control-hint').classList.add('hidden')});controls.addEventListener('unlock',()=>{if(isPlaying())pauseGame()});
  document.addEventListener('pointerlockerror',useFallbackControls);
  clock=new THREE.Clock();raycaster=new THREE.Raycaster();world=new THREE.Group();scene.add(world);
  scene.add(new THREE.HemisphereLight(0xfff3c4,0x6c645b,2.2));const sun=new THREE.DirectionalLight(0xfff1cf,3.2);sun.position.set(-25,38,20);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-55;sun.shadow.camera.right=55;sun.shadow.camera.top=55;sun.shadow.camera.bottom=-55;scene.add(sun);
  makePlaza();makeWeapon();window.addEventListener('resize',resize);animate();
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
function makeWeapon(){weaponModel=new THREE.Group();camera.add(weaponModel);scene.add(camera);const body=new THREE.Mesh(new THREE.BoxGeometry(.18,.17,.75),mat(WEAPONS.ar.color,.45));body.position.set(.34,-.28,-.62);weaponModel.add(body);const barrel=new THREE.Mesh(new THREE.CylinderGeometry(.035,.045,.48,8),mat(0x2f2b2e,.35));barrel.rotation.x=Math.PI/2;barrel.position.set(.34,-.25,-1.15);weaponModel.add(barrel);weaponModel.userData.body=body}
function updateWeaponModel(){const w=WEAPONS[state.selectedWeapon];weaponModel.userData.body.material=mat(w.color,.45);$('weapon-name').textContent=w.name.toUpperCase();$('ammo').textContent=state.ammo;$('reserve').textContent=state.reserve}

function createPlayerMesh(p){
  const c=CHARACTERS.find(x=>x.id===p.char)||CHARACTERS[0],g=new THREE.Group();g.userData.playerId=p.id;
  const body=new THREE.Mesh(new THREE.CapsuleGeometry(.52,.9,5,9),mat(c.color));body.position.y=1.05;body.castShadow=true;body.userData.playerId=p.id;g.add(body);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.52,14,10),mat(c.color));head.position.y=2.05;head.castShadow=true;head.userData.playerId=p.id;g.add(head);
  const eyeMat=new THREE.MeshBasicMaterial({color:0x191218});[-.2,.2].forEach(x=>{const e=new THREE.Mesh(new THREE.SphereGeometry(.065,8,6),eyeMat);e.position.set(x,2.12,-.48);g.add(e)});
  const gun=new THREE.Mesh(new THREE.BoxGeometry(.16,.16,.82),mat(WEAPONS[p.weapon]?.color||0x333333));gun.position.set(.45,1.25,-.45);gun.rotation.x=-.15;g.add(gun);
  const tag=document.createElement('div');tag.className='name-tag';g.userData.tag=tag;world.add(g);playerMeshes.set(p.id,g);return g;
}
function syncMeshes(){
  Object.values(state.players).forEach(p=>{if(p.id===state.id)return;let m=playerMeshes.get(p.id)||createPlayerMesh(p);m.visible=p.alive!==false;m.position.lerp(new THREE.Vector3(p.x||0,0,p.z||0),.32);m.rotation.y=p.yaw||0});
  for(const [id,m] of playerMeshes)if(!state.players[id]){world.remove(m);playerMeshes.delete(id)}
}

function myPublic(){return{id:state.id,name:safeName(),char:state.selectedChar,weapon:state.selectedWeapon,x:camera.position.x,z:camera.position.z,yaw:camera.rotation.y,health:state.health,kills:state.kills,deaths:state.deaths,alive:state.alive}}
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
  c.on('open',()=>{state.connections.set(c.peer,c);state.players[c.peer]={id:c.peer,name:(c.metadata?.name||'New Rot').slice(0,16),char:c.metadata?.char||'panino',weapon:c.metadata?.weapon||'ar',x:0,z:0,kills:0,deaths:0,health:100,alive:true};c.send({t:'welcome',id:c.peer,room:state.room,players:state.players,host:state.id});broadcast({t:'snapshot',players:state.players,end:state.matchEnd,active:state.matchActive});updateLobby()});
  c.on('data',d=>handleHostMessage(d,c.peer));c.on('close',()=>{state.connections.delete(c.peer);delete state.players[c.peer];broadcast({t:'snapshot',players:state.players,end:state.matchEnd,active:state.matchActive});updateLobby()});
}
function wireClient(c){c.on('open',()=>setError(''));c.on('data',d=>handleClientMessage(d));c.on('close',()=>leaveToHome('The host closed the room.'));c.on('error',peerError)}
function handleHostMessage(d,from){
  if(!d||typeof d.t!=='string')return;
  if(d.t==='state'&&state.players[from]){const p=state.players[from];p.x=clamp(d.x,-34,34);p.z=clamp(d.z,-35,35);p.yaw=d.yaw||0}
  if(d.t==='hit'&&state.matchActive)applyHit(from,d.target,d.damage);
  if(d.t==='ready')updateLobby();
}
function handleClientMessage(d){
  if(!d)return;
  if(d.t==='welcome'){state.players=d.players;enterLobby()}
  if(d.t==='snapshot'){state.players=d.players||{};state.matchEnd=d.end||0;if(d.active&&!state.matchActive)beginMatch(false);syncLocalFromSnapshot()}
  if(d.t==='start'){state.matchEnd=d.end;state.players=d.players;beginMatch(false)}
  if(d.t==='event'){addFeed(d.text);if(d.victim===state.id)takeDamageResult(d)}
  if(d.t==='respawn'&&d.id===state.id)doRespawn(d.x,d.z)
  if(d.t==='end')finishMatch(d.players)
  if(d.t==='lobby'){state.matchActive=false;state.players=d.players;enterLobby()}
  if(d.t==='reject')leaveToHome(d.reason)
}
function syncLocalFromSnapshot(){const me=state.players[state.id];if(!me)return;state.kills=me.kills||0;state.deaths=me.deaths||0;state.health=me.health??state.health;updateHud()}
function peerError(err){const msg=err.type==='peer-unavailable'?'Room not found. Check the code and try again.':'Connection trouble. Try creating or joining the room again.';leaveToHome(msg)}
function resetPeer(){if(state.peer&&!state.peer.destroyed)state.peer.destroy();state.peer=null;state.conn=null;state.connections.clear()}
function setError(s){$('connection-error').textContent=s}

function enterLobby(){state.mode='lobby';showScreen('lobby');$('room-code').textContent=state.room;updateLobby()}
function updateLobby(){
  const ps=Object.values(state.players);$('player-list').innerHTML=ps.map((p,i)=>`<div class="player-pill"><span class="dot"></span><strong>${escapeHtml(p.name)}</strong><span>${CHARACTERS.find(c=>c.id===p.char)?.emoji||'🥖'}</span><small>${i===0?'HOST':WEAPONS[p.weapon]?.name||'PLAYER'}</small></div>`).join('');
  $('start-match').style.display=state.host?'block':'none';if(state.host){$('start-match').disabled=ps.length<2&&!state.practice;$('start-match').textContent=ps.length<2?'Waiting for another player…':`Start match · ${ps.length} players`}
}
function startMatch(){
  if(!state.host)return;state.matchEnd=Date.now()+180000;Object.values(state.players).forEach((p,i)=>Object.assign(p,{kills:0,deaths:0,health:100,alive:true,...spawnFor(i)}));broadcast({t:'start',end:state.matchEnd,players:state.players});beginMatch(true)
}
function beginMatch(asHost){
  state.matchActive=true;state.mode='game';state.health=100;state.kills=0;state.deaths=0;state.alive=true;const w=WEAPONS[state.selectedWeapon];state.ammo=w.mag;state.reserve=w.reserve;state.reloading=false;
  const me=state.players[state.id];if(me){camera.position.set(me.x||0,1.7,me.z||12)}else camera.position.set(0,1.7,12);
  state.keys={};state.velocityY=0;state.onGround=true;camera.lookAt(0,1.7,1);showScreen(null);focusGame();$('hud').classList.add('active');$('control-hint').classList.remove('hidden');updateWeaponModel();updateHud();requestMouseCapture();if(asHost)hostSnapshot();
}
function practice(){state.practice=true;state.host=true;state.room='SOLO';state.id='solo';state.players={};seedSelf();for(let i=0;i<3;i++){const id=`bot${i}`;state.players[id]={id,name:['Bot Barista','Nonna.exe','Gelato NPC'][i],char:CHARACTERS[(i+1)%4].id,weapon:Object.keys(WEAPONS)[i+1],kills:0,deaths:0,health:100,alive:true,...spawnFor(i+1),bot:true}}startMatch()}

function applyHit(shooterId,targetId,damage){
  const target=state.players[targetId],shooter=state.players[shooterId];if(!target||!shooter||!target.alive)return;target.health=Math.max(0,target.health-Math.min(100,Math.max(1,damage||1)));
  const killed=target.health<=0;if(killed){target.alive=false;target.deaths=(target.deaths||0)+1;shooter.kills=(shooter.kills||0)+1;const text=`${shooter.name} spilled ${target.name}'s coffee`;broadcast({t:'event',text,victim:targetId,killer:shooterId,killed:true});addFeed(text);if(targetId===state.id)takeDamageResult({killed:true});setTimeout(()=>{if(state.matchActive){Object.assign(target,{health:100,alive:true,...spawnFor(Math.floor(Math.random()*6))});if(targetId===state.id)doRespawn(target.x,target.z);else state.connections.get(targetId)?.send({t:'respawn',id:targetId,x:target.x,z:target.z});hostSnapshot()}},3000)} else {state.connections.get(targetId)?.send({t:'event',text:'',victim:targetId,killer:shooterId,damage:true,health:target.health});if(targetId===state.id){state.health=target.health;flashDamage()}}
  hostSnapshot();
}
function takeDamageResult(d){const me=state.players[state.id];if(me)state.health=me.health;if(d.killed){state.alive=false;$('respawn').classList.add('active');let n=3;$('respawn-time').textContent=n;const t=setInterval(()=>{$('respawn-time').textContent=--n;if(n<=0)clearInterval(t)},1000);controls.unlock()}else flashDamage();updateHud()}
function doRespawn(x,z){state.alive=true;state.health=100;camera.position.set(x??0,1.7,z??12);state.velocityY=0;state.onGround=true;state.keys={};$('respawn').classList.remove('active');if(isPlaying()){focusGame();requestMouseCapture()}updateHud()}
function flashDamage(){$('damage-flash').classList.add('show');setTimeout(()=>$('damage-flash').classList.remove('show'),190)}

function shoot(){
  if(!isPlaying()||state.reloading)return;const w=WEAPONS[state.selectedWeapon],now=performance.now();if(now-state.lastShot<w.rate)return;if(state.ammo<=0){reload();return}state.lastShot=now;state.ammo--;updateHud();weaponModel.position.z=.1;setTimeout(()=>weaponModel.position.z=0,55);
  const targets=[...shotBlockers],damageByPlayer=new Map();
  playerMeshes.forEach(m=>{if(m.visible)m.children.forEach(c=>{if(c.isMesh){c.userData.playerId=m.userData.playerId;targets.push(c)}})});
  world.updateMatrixWorld(true);
  for(let n=0;n<w.pellets;n++){
    const dir=new THREE.Vector3((Math.random()-.5)*w.spread,(Math.random()-.5)*w.spread,-1).normalize().applyQuaternion(camera.quaternion);
    raycaster.set(camera.position,dir);raycaster.far=w.range;
    const first=raycaster.intersectObjects(targets,false)[0];
    // The nearest surface receives the pellet: a wall cannot be shot through.
    const id=first?.object.userData.playerId;if(id)damageByPlayer.set(id,(damageByPlayer.get(id)||0)+w.damage);
  }
  for(const [target,damage] of damageByPlayer)sendHost({t:'hit',target,damage});
  if(damageByPlayer.size){$('hitmarker').classList.add('show');setTimeout(()=>$('hitmarker').classList.remove('show'),120)}
  if(state.ammo===0)setTimeout(reload,160);
}
function reload(){const w=WEAPONS[state.selectedWeapon];if(state.reloading||state.ammo>=w.mag||state.reserve<=0)return;state.reloading=true;$('weapon-name').textContent='RELOADING…';setTimeout(()=>{const need=w.mag-state.ammo,take=Math.min(need,state.reserve);state.ammo+=take;state.reserve-=take;state.reloading=false;updateWeaponModel()},w.reload)}

function updateMovement(dt){
  if(!isPlaying())return;const speed=8.5,forwardInput=(state.keys.KeyW?1:0)-(state.keys.KeyS?1:0),sideInput=(state.keys.KeyD?1:0)-(state.keys.KeyA?1:0);const old=camera.position.clone();const forward=new THREE.Vector3();camera.getWorldDirection(forward);forward.y=0;forward.normalize();const right=new THREE.Vector3().crossVectors(forward,camera.up).normalize();const distance=speed*dt/Math.max(1,Math.hypot(forwardInput,sideInput));const dx=(forward.x*forwardInput+right.x*sideInput)*distance,dz=(forward.z*forwardInput+right.z*sideInput)*distance;
  const nextX=clamp(old.x+dx,-34,34);if(!collides(nextX,old.z))camera.position.x=nextX;
  const nextZ=clamp(old.z+dz,-35,35);if(!collides(camera.position.x,nextZ))camera.position.z=nextZ;
  state.velocityY-=22*dt;camera.position.y+=state.velocityY*dt;if(camera.position.y<=1.7){camera.position.y=1.7;state.velocityY=0;state.onGround=true}
}
function collides(x,z){return colliders.some(c=>x>c.minX-.55&&x<c.maxX+.55&&z>c.minZ-.55&&z<c.maxZ+.55)}
function hasClearShot(from,to){const direction=new THREE.Vector3().subVectors(to,from),distance=direction.length();if(distance<.01)return false;raycaster.set(from,direction.normalize());raycaster.far=distance;return raycaster.intersectObjects(shotBlockers,false).length===0}
function updateBots(dt){if(!state.practice||!state.matchActive)return;Object.values(state.players).filter(p=>p.bot&&p.alive).forEach((p,i)=>{const a=performance.now()/2300+i*2.1,nextX=clamp(p.x+Math.sin(a)*dt*2.3,-31,31),nextZ=clamp(p.z+Math.cos(a*1.2)*dt*2.3,-31,31);if(!collides(nextX,p.z))p.x=nextX;if(!collides(p.x,nextZ))p.z=nextZ;p.yaw=Math.atan2(camera.position.x-p.x,camera.position.z-p.z);if(Math.random()<dt*.28){const d=Math.hypot(camera.position.x-p.x,camera.position.z-p.z);if(d<35&&state.alive&&hasClearShot(new THREE.Vector3(p.x,1.7,p.z),camera.position))applyHit(p.id,state.id,10)}})}
function updateNetwork(now){if(now-state.lastNet<65)return;state.lastNet=now;if(state.host)hostSnapshot();else sendHost({t:'state',x:camera.position.x,z:camera.position.z,yaw:camera.rotation.y})}
function updateTimer(){if(!state.matchActive)return;const left=Math.max(0,state.matchEnd-Date.now()),s=Math.ceil(left/1000);$('timer').textContent=`${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;if(left<=0&&state.host)finishMatch(state.players)}
function finishMatch(players){if(!state.matchActive)return;state.matchActive=false;controls.unlock();$('hud').classList.remove('active');const ranked=Object.values(players||state.players).sort((a,b)=>(b.kills||0)-(a.kills||0));$('podium').innerHTML=ranked.map((p,i)=>`<div class="rank-row"><span>#${i+1}</span><span>${escapeHtml(p.name)}</span><strong>${p.kills||0} K</strong></div>`).join('');showScreen('results');state.mode='results';if(state.host)broadcast({t:'end',players:state.players})}
function returnLobby(){if(state.practice){leaveToHome();return}Object.values(state.players).forEach(p=>Object.assign(p,{kills:0,deaths:0,health:100,alive:true}));if(state.host)broadcast({t:'lobby',players:state.players});enterLobby()}

function updateHud(){const me=state.players[state.id];if(me){state.kills=me.kills||state.kills;state.health=me.health??state.health}$('kills').textContent=state.kills;$('health-number').textContent=Math.ceil(state.health);$('health-bar').style.width=`${state.health}%`;$('ammo').textContent=state.ammo;$('reserve').textContent=state.reserve;const top=Math.max(0,...Object.values(state.players).map(p=>p.kills||0));$('leader').textContent=top}
function addFeed(text){if(!text)return;const d=document.createElement('div');d.textContent=text;$('kill-feed').prepend(d);setTimeout(()=>d.remove(),4000)}
function spawnFor(i){const pts=[[-25,-29],[25,23],[-23,24],[25,-29],[0,30],[0,-30]];const p=pts[i%pts.length];return{x:p[0],z:p[1]}}
function animate(){requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.04),now=performance.now();if(state.matchActive){updateMouseEdgeTurn(dt);updateMovement(dt);updateBots(dt);updateNetwork(now);updateTimer();syncMeshes();updateHud()}renderer.render(scene,camera)}
function resize(){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)}
function clamp(v,a,b){return Math.max(a,Math.min(b,Number(v)||0))}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function leaveToHome(message=''){state.matchActive=false;state.practice=false;clearInput();controls.unlock();resetPeer();state.players={};playerMeshes.forEach(m=>world.remove(m));playerMeshes.clear();$('hud').classList.remove('active');$('respawn').classList.remove('active');showScreen('home');state.mode='home';setError(message)}
function isPlaying(){return state.matchActive&&state.alive&&state.mode==='game'}
function clearInput(){state.keys={};state.mouseX=null;state.mouseY=null;state.mouseOver=false}
function focusGame(){$('game').focus({preventScroll:true})}
function useFallbackControls(){state.capturePending=false;state.pointerLockFailed=true;$('control-hint').textContent='WASD MOVE · MOUSE LOOK · SCREEN EDGES TURN · ESC MENU';$('control-hint').classList.remove('hidden')}
function handleMouseLook(e){
  if(!isPlaying()||controls.isLocked||e.target!==$('game'))return;
  state.mouseOver=true;
  const dx=Number.isFinite(e.movementX)?e.movementX:(state.mouseX===null?0:e.clientX-state.mouseX);
  const dy=Number.isFinite(e.movementY)?e.movementY:(state.mouseY===null?0:e.clientY-state.mouseY);
  state.mouseX=e.clientX;state.mouseY=e.clientY;
  camera.rotation.y-=clamp(dx,-120,120)*.00164;
  camera.rotation.x=clamp(camera.rotation.x-clamp(dy,-120,120)*.00164,-1.45,1.45);
}
// Embedded browsers may deny mouse capture. Turning at the edges still allows 360° aiming.
function updateMouseEdgeTurn(dt){
  if(!isPlaying()||controls.isLocked||!state.mouseOver||state.mouseX===null)return;
  const edge=36,x=state.mouseX;
  if(x<edge)camera.rotation.y+=(1-x/edge)*1.6*dt;
  else if(x>innerWidth-edge)camera.rotation.y-=(1-(innerWidth-x)/edge)*1.6*dt;
}
function requestMouseCapture(){
  if(isPlaying())focusGame();
  if(!isPlaying()||state.pointerLockFailed||state.capturePending||controls.isLocked)return;
  if(!document.body.requestPointerLock){useFallbackControls();return}
  state.capturePending=true;
  try{const pending=document.body.requestPointerLock();if(pending?.catch)pending.catch(useFallbackControls)}catch{useFallbackControls()}
}
function pauseGame(){if(!state.matchActive)return;state.mode='pause';clearInput();showScreen('pause');if(controls.isLocked)controls.unlock()}

addEventListener('keydown',e=>{if(e.code==='Escape'&&state.matchActive&&state.mode==='game'){pauseGame();return}if(!isPlaying())return;if(['KeyW','KeyA','KeyS','KeyD','Space','KeyR'].includes(e.code))e.preventDefault();state.keys[e.code]=true;if(e.code==='Space'&&state.onGround&&!e.repeat){state.velocityY=8;state.onGround=false}if(e.code==='KeyR')reload()});addEventListener('keyup',e=>state.keys[e.code]=false);
addEventListener('blur',clearInput);document.addEventListener('visibilitychange',()=>{if(document.hidden)clearInput()});
addEventListener('mousedown',e=>{if(!isPlaying()||(!controls.isLocked&&e.target!==$('game')))return;if(e.button===0){focusGame();if(!controls.isLocked)requestMouseCapture();shoot()}});addEventListener('mousemove',handleMouseLook);$('game').addEventListener('mouseleave',()=>{state.mouseOver=false;state.mouseX=null;state.mouseY=null});
$('create-room').onclick=createRoom;$('join-room').onclick=joinRoom;$('room-code-input').onkeydown=e=>{if(e.key==='Enter')joinRoom()};$('practice').onclick=practice;$('start-match').onclick=startMatch;$('copy-code').onclick=async()=>{try{await navigator.clipboard.writeText(state.room);toast('Room code copied')}catch{toast(`Room code: ${state.room}`)}};$('leave-lobby').onclick=()=>leaveToHome();$('resume').onclick=()=>{showScreen(null);state.mode='game';requestMouseCapture()};$('leave-match').onclick=()=>leaveToHome();$('play-again').onclick=returnLobby;$('results-home').onclick=()=>leaveToHome();

buildChoices();initWorld();showScreen('home');
