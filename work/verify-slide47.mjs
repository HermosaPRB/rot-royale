import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import * as THREE from '../../work/three.module.js';
const nodes=new Map(),events={},timers=[];let now=10000;
const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'Tester',textContent:'',hidden:false,style:{},classList:{add(){},remove(){},toggle(){}},focus(){},prepend(){},addEventListener:(event,fn)=>events[id+event]=fn,getContext:()=>({fillRect(){},strokeRect(){},fillText(){}})});return nodes.get(id)};
const math=Object.create(Math);math.random=()=>.5;
const ctx=vm.createContext({THREE,Math:math,document:{body:{},getElementById:node,createElement:()=>node('created'),addEventListener:(key,fn)=>events[key]=fn},performance:{now:()=>now},addEventListener:(key,fn)=>events[key]=fn,setTimeout:fn=>timers.push(fn),setInterval(){},clearInterval(){},console,innerWidth:1280,innerHeight:720});
const source=['surface-details.js','wooden-character.js','combat-models.js','plaza.js','game.js'].map(f=>fs.readFileSync(new URL('../dist/'+f,import.meta.url),'utf8').replace(/^import .*;$/gm,'').replaceAll('export function','function')).join('\n').replace("buildChoices();initWorld();showScreen('home');",'');
vm.runInContext(source,ctx);const run=code=>vm.runInContext(code,ctx);
run(`scene=new THREE.Scene();world=new THREE.Group();scene.add(world);camera=new THREE.PerspectiveCamera(76,1280/720,.08,160);camera.position.set(0,1.7,0);controls={isLocked:false,unlock(){}};raycaster=new THREE.Raycaster();makeWeapon();const sent=[];broadcast=msg=>sent.push(msg);addFeed=msg=>sent.push({text:msg});`);
function reset(weapon='ar'){
  now+=3000;run(`Object.assign(state,{id:'shooter',mode:'game',host:true,matchActive:true,alive:true,equipped:'gun',selectedWeapon:'${weapon}',health:100,kills:0,deaths:0,reloading:false,ammo:WEAPONS.${weapon}.mag,reserve:Infinity,meleeStart:-Infinity,lastMelee:-Infinity,lastShot:-Infinity});state.players={shooter:{...myPublic(),weapon:'${weapon}',x:0,y:1.7,z:0,yaw:0,pitch:0},enemy:{id:'enemy',name:'Enemy',char:'wooden',weapon:'ar',equipped:'gun',x:0,y:1.7,z:-5,yaw:0,pitch:0,health:100,alive:true}};shotCooldowns.clear();meleeCooldowns.clear();hitReactions.clear();shotBlockers.length=0;state.connections.clear();camera.position.set(0,1.7,0);camera.rotation.set(0,0,0);state.keys={};updateWeaponModel();resetAim();`);
}

reset();run('state.onGround=true;state.slideCooldown=0;state.velocityZ=-20;state.velocityX=0;state.keys={KeyW:true};beginSlide()');assert.ok(run('state.slideUntil')>now);run('updateMovement(1/60)');const slideSpeed=run('Math.hypot(state.velocityX,state.velocityZ)');assert.ok(slideSpeed>20,'slide preserves fast momentum');run('state.keys.Space=true;updateMovement(1/60)');assert.equal(run('state.slideUntil'),0);assert.ok(run('state.velocityY')>0);assert.ok(run('Math.hypot(state.velocityX,state.velocityZ)')>=slideSpeed,'slide jump keeps momentum');
run('clearInput()');assert.equal(run('state.slideUntil'),0);
reset('smg');run('state.arsenal={};state.onGround=true;state.velocityY=0;state.velocityX=state.velocityZ=0;state.keys={KeyW:true};for(let i=0;i<60;i++)updateMovement(1/60)');assert.ok(run('Math.hypot(state.velocityX,state.velocityZ)')>9.6,'SMG movement advantage');
reset('sniper');run('Math.random=()=>1;state.players.enemy.z=-50;state.players.shooter.pitch=Math.atan2(-.5,50);state.players.shooter.aiming=false;resolveShot("shooter")');assert.equal(run('state.players.enemy.health'),100,'sniper hip shot spread matters at distance');
run('shotCooldowns.clear();state.players.shooter.aiming=true;resolveShot("shooter")');assert.ok(run('state.players.enemy.health')<100,'scoped sniper precision');run('Math.random=()=>.5');
reset('shotgun');run('sent.length=0;resolveShot("shooter")');assert.equal(run('sent.find(p=>p.t==="tracers").ends.length'),10);run('state.players.shooter.arsenal={shotgun:1};shotCooldowns.clear();sent.length=0;resolveShot("shooter")');assert.equal(run('sent.find(p=>p.t==="tracers").ends.length'),12);assert.ok(run('weaponStats("ar",{ar:1}).spread<WEAPONS.ar.spread'));
reset('sniper');run('state.players.shooter.aiming=true;state.players.shooter.arsenal={sniper:1};state.players.second={...state.players.enemy,id:"second",z:-8};resolveShot("shooter")');assert.ok(run('state.players.second.health')<100,'cyber rail penetrates one player');
reset('sniper');run('state.players.shooter.aiming=true;state.players.shooter.arsenal={sniper:1};state.players.second={...state.players.enemy,id:"second",z:-8};const blocker=new THREE.Mesh(new THREE.BoxGeometry(4,4,.2),new THREE.MeshBasicMaterial());blocker.position.set(0,1.7,-6);world.add(blocker);shotBlockers.push(blocker);resolveShot("shooter")');assert.equal(run('state.players.second.health'),100,'rail cannot pierce cover');run('world.remove(blocker);shotBlockers.length=0');
reset();run('state.players.enemy.z=5;state.connections.set("enemy",{send:p=>sent.push(p)});sent.length=0;applyHit("enemy","shooter",36,true)');assert.ok(run('sent.some(p=>p.t==="damageDealt"&&p.id==="enemy"&&p.amount===36&&p.headshot)'),'remote attacker receives confirmed damage');
reset();run('applyHit("shooter","enemy",100);syncMeshes(1/60)');assert.equal(run('playerMeshes.get("enemy").visible'),true);for(let i=0;i<18;i++){now+=16;run('syncMeshes(1/60)')}assert.ok(Math.abs(run('playerMeshes.get("enemy").rotation.z'))>.03,'death leans sideways');assert.ok(run('playerMeshes.get("enemy").userData.avatar.position.y')<-.03,'knees buckle');now+=850;run('syncMeshes(1/60)');assert.equal(run('playerMeshes.get("enemy").visible'),false);run('state.players.enemy.alive=true;state.players.enemy.health=100');for(let i=0;i<30;i++){now+=16;run('syncMeshes(1/60)')}assert.equal(run('playerMeshes.get("enemy").visible'),true);assert.ok(Math.abs(run('playerMeshes.get("enemy").rotation.z'))<.02,'respawn eases out of death pose');
reset();run('state.players.enemy.grounded=false;syncMeshes(1/60)');const jumpFirst=run('playerMeshes.get("enemy").userData.avatar.userData.legs[0].rotation.x');assert.ok(jumpFirst<0&&jumpFirst>-.30,'jump begins without snapping');for(let i=0;i<30;i++){now+=16;run('syncMeshes(1/60)')}assert.ok(run('playerMeshes.get("enemy").userData.avatar.userData.legs[0].rotation.x')<-.25);run('state.players.enemy.grounded=true;state.players.enemy.reloading=true;syncMeshes(1/60)');const reloadFirst=run('playerMeshes.get("enemy").userData.gun.rotation.x');assert.ok(reloadFirst<0&&reloadFirst>-.35,'reload begins without snapping');for(let i=0;i<24;i++){now+=16;run('syncMeshes(1/60)')}assert.ok(run('playerMeshes.get("enemy").userData.gun.rotation.x')<-.30);
reset();run('renderer={render(){}};slideView=.42;landingKick=.1;shotShake=.006;const stablePosition=camera.position.clone(),stableRotation=camera.rotation.clone();renderGameplay(performance.now())');assert.equal(run('camera.position.distanceTo(stablePosition)'),0);assert.equal(run('camera.rotation.x'),run('stableRotation.x'),'render shake does not move aim/physics');
console.log('PASS: slide momentum/jump, SMG speed, sniper ADS precision, 10/12 shotgun pellets, cyber penetration/cover, remote damage feedback, death/respawn/jump/reload poses, render-only camera effects.');

reset();run('clearInput();state.onGround=true;state.velocityY=0;state.keys={KeyW:true};updateMovement(1/120)');
assert.ok(run('Math.hypot(state.velocityX,state.velocityZ)')>0&&run('Math.hypot(state.velocityX,state.velocityZ)')<4,'running accelerates, not instant full speed');
run('for(let i=0;i<60;i++)updateMovement(1/120)');assert.ok(run('Math.hypot(state.velocityX,state.velocityZ)')>8.4);
run('state.keys={};updateMovement(1/120)');assert.ok(run('Math.hypot(state.velocityX,state.velocityZ)')>5,'stopping has brief weight');
run('for(let i=0;i<60;i++)updateMovement(1/120)');assert.ok(run('Math.hypot(state.velocityX,state.velocityZ)')<.02,'no endless drift');
const reverse=run('slideVelocity(0,-14,0,1,.2,1/60)');assert.ok(reverse.z<-13,'back input cannot instantly reverse slide');
for(const fps of [30,60,144]){let v={x:0,z:-14};for(let i=0;i<fps;i++)v=run(`slideVelocity(${v.x},${v.z},0,-1,${i/fps},${1/fps})`);assert.ok(Math.abs(Math.hypot(v.x,v.z)-14*Math.exp(-.73))<.17,'frame-rate consistent progressive drag')}
reset();run('state.players.enemy.grounded=true;state.players.enemy.reloading=false;state.players.enemy.sliding=true');
for(let i=0;i<60;i++){now+=16;run('syncMeshes(1/60)')}
assert.ok(run('playerMeshes.get("enemy").userData.avatar.position.y')<-.60,'hips actually sit low');
assert.ok(run('playerMeshes.get("enemy").userData.avatar.userData.legs.every(l=>l.rotation.x>1.2)'),'both feet extend forward');
assert.ok(run('playerMeshes.get("enemy").userData.avatar.userData.danceTorso.rotation.x')>.25,'torso reclines rather than crouches');
assert.ok(run('playerMeshes.get("enemy").scale.y')>.97,'no character squashing');
run('state.players.enemy.sliding=false');for(let i=0;i<60;i++){now+=16;run('syncMeshes(1/60)')}
assert.ok(Math.abs(run('playerMeshes.get("enemy").userData.avatar.position.y'))<.02,'standing pose recovers');
console.log('PASS acceleration/braking, non-reversing slide steering, progressive drag at 30/60/144Hz, low feet-forward slide and recovery');
reset();run('deathEffects.forEach(e=>e.group.visible=false);state.players.enemy.char="neegy";applyHit("shooter","enemy",100);syncMeshes(1/60)');
assert.equal(run('deathEffects.filter(e=>e.group.visible).length'),1,'elimination spawns one effect');
for(let i=0;i<40;i++){now+=16;run('syncMeshes(1/60);updateImpacts(performance.now())')}
assert.ok(run('playerMeshes.get("enemy").position.y')>=0,'fall settles above the floor');
assert.ok(Math.abs(run('playerMeshes.get("enemy").rotation.z'))>.4,'Neegy falls sideways');
assert.ok(run('deathEffects.find(e=>e.group.visible).ring.material.opacity')<.55,'coffee ring fades');
now+=500;run('updateImpacts(performance.now())');assert.equal(run('deathEffects.filter(e=>e.group.visible).length'),0);
run('state.players.enemy.alive=true;state.players.enemy.health=100;syncMeshes(1/60)');
assert.equal(run('hitReactions.has("enemy")'),false,'respawn clears old death');
const count=run('deathEffects.length');run('applyHit("shooter","enemy",100);syncMeshes(1/60)');
assert.equal(run('deathEffects.length'),count,'effect mesh is reused');assert.equal(run('deathEffects.filter(e=>e.group.visible).length'),1,'second death triggers effect');
console.log('PASS Neegy fall, coffee effect fade and reuse, repeated death after respawn');
