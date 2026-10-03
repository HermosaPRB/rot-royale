import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import * as THREE from '../../work/three.module.js';
// Run from rot-royale/work/: node verify-airdrop.mjs
const nodes=new Map(),timers=[];let now=10000;
const classes=()=>{const set=new Set();return{add:(...c)=>c.forEach(x=>set.add(x)),remove:(...c)=>c.forEach(x=>set.delete(x)),toggle:(c,on)=>{(on??!set.has(c))?set.add(c):set.delete(c)},contains:c=>set.has(c)}};
const node=id=>{if(!nodes.has(id))nodes.set(id,{id,value:'Tester',textContent:'',innerHTML:'',hidden:id!=='scope-overlay'?false:true,style:{setProperty(k,v){this[k]=v}},dataset:{},className:'',classList:classes(),focus(){},prepend(){},addEventListener(){},querySelector:()=>node(id+'-child'),getContext:()=>({fillRect(){},strokeRect(){},fillText(){}})});return nodes.get(id)};
const ctx=vm.createContext({THREE,Math:Object.create(Math),document:{body:{},getElementById:node,createElement:()=>node('created'),addEventListener(){},querySelectorAll:()=>[]},performance:{now:()=>now},addEventListener(){},setTimeout:fn=>timers.push(fn),setInterval(){},clearInterval(){},console,innerWidth:1280,innerHeight:720,localStorage:{getItem:()=>null,setItem(){}}});
const files=['surface-details.js','wooden-character.js','neegy-character.js','combat-models.js','plaza.js','arena-details.js','neon-town.js','mozzarella-factory.js','surf.js','airdrop.js','game.js'];
const source=files.map(f=>fs.readFileSync('../dist/'+f,'utf8').replace(/^import [\s\S]*?;$/gm,'').replaceAll('export function','function').replace(/^export const/gm,'const').replace(/^export \{[^}]*\};?$/gm,'')).join('\n').replace(/renderKeybinds\(\);buildChoices\(\);initWorld\(\);showScreen\('home'\);/,'');
vm.runInContext(source,ctx);const run=code=>vm.runInContext(code,ctx);
run(`scene=new THREE.Scene();scene.background=new THREE.Color();scene.fog=new THREE.Fog(0,1,2);world=new THREE.Group();scene.add(world);camera=new THREE.PerspectiveCamera(76,1280/720,.08,160);camera.rotation.order='YXZ';camera.position.set(0,1.7,0);controls={isLocked:false,unlock(){}};raycaster=new THREE.Raycaster();makeWeapon();
  globalThis.sent=[];broadcast=m=>sent.push(JSON.parse(JSON.stringify(m)));addFeed=()=>{};`);
const tick=ms=>{for(let t=0;t<ms;t+=16){now+=16;run('updateAirdrop(.016,performance.now())')}};
function match(map){
  now+=5000;
  run(`setMap('${map}');Object.assign(state,{id:'host',mode:'game',host:true,practice:false,matchActive:true,alive:true,equipped:'gun',selectedWeapon:'ar',health:100,kills:0,reloading:false,ammo:30,lastShot:-Infinity,switchStart:-Infinity,meleeStart:-Infinity,inspectStart:-Infinity,keys:{},velocityX:0,velocityY:0,velocityZ:0,onGround:true,builds:[]});
    state.players={host:{...myPublic(),x:5,y:1.7,z:5,kills:0,deaths:0},enemy:{id:'enemy',name:'Enemy',char:'wooden',weapon:'ar',equipped:'gun',x:-5,y:1.7,z:-5,yaw:0,pitch:0,health:100,alive:true,kills:0,deaths:0,arsenal:{}}};
    resetAirdropState();sent.length=0;camera.position.set(5,1.7,5);scheduleAirdrop();airdropPlan.at=Date.now()-1;`);
}

// 1. Timing: 45-75s, mean about 60s; never on Surf.
run(`state.map='neon'`);const delays=[];for(let i=0;i<200;i++){run('scheduleAirdrop()');delays.push(run('airdropPlan.at-Date.now()'))}
assert.ok(delays.every(d=>d>=44990&&d<=75010),'airdrop always lands in the 45-75s window');
const mean=delays.reduce((a,b)=>a+b,0)/delays.length;assert.ok(Math.abs(mean-60000)<3500,`mean delay near 60s (${Math.round(mean)})`);
run(`state.map='surf';scheduleAirdrop()`);assert.equal(run('airdropPlan'),null,'no airdrop on Surf');

const landings={};
for(const map of ['neon','piazza','factory']){
  match(map);tick(16);
  assert.ok(run('!!drop'),`${map}: airdrop announced`);
  assert.equal(run(`sent.find(m=>m.t==='airdrop').drop.item`),null,`${map}: loot stays secret before opening`);
  // 2. Cinematic freeze: no movement, no damage, broll camera in use.
  assert.ok(run('airdropFrozen()&&airdropCinematicActive()'),`${map}: cinematic running`);
  assert.ok(run('gameplayCamera()===brollCamera'),`${map}: renders from the cinematic camera`);
  run(`state.keys={KeyW:true};state.velocityX=9;updateMovement(1/60)`);assert.equal(run('state.velocityX'),0,`${map}: players frozen`);
  run(`state.players.enemy.x=5;state.players.enemy.z=3;state.players.host.yaw=0;resolveShot('host',performance.now())`);assert.equal(run('state.players.enemy.health'),100,`${map}: no damage during cinematic`);
  run(`state.keys={}`);tick(2100);
  assert.ok(!run('airdropFrozen()'),`${map}: unfreezes after 2s`);assert.ok(run('gameplayCamera()===camera'),`${map}: back to player camera`);
  // 3. Crate falls, then lands on the real top surface at map center.
  assert.ok(run('drop.crate.visible&&!drop.landed&&drop.chute.visible'),`${map}: crate parachuting`);
  tick(7200);assert.ok(run('drop.landed'),`${map}: crate landed`);
  assert.equal(run('drop.crate.position.y'),run('landingHeight(drop.x,drop.z)'));assert.ok(run(`!colliders.some(c=>c!==drop.collider&&!c.ramp&&drop.x>c.minX&&drop.x<c.maxX&&drop.z>c.minZ&&drop.z<c.maxZ&&(c.maxY??Infinity)>drop.y+.05&&(c.minY??-Infinity)<drop.y+.9)`),`${map}: crate is not buried inside scenery`);assert.ok(run('colliders.includes(drop.collider)&&drop.beacon.visible'),`${map}: collider + beacon`);
  landings[map]=run('`(${drop.x.toFixed(1)}, ${drop.y.toFixed(2)}, ${drop.z.toFixed(1)})`');
  assert.ok(run(`sent.filter(m=>m.t==='airdrop').every(m=>m.drop.item===null)`),`${map}: no broadcast leaked the item`);
  // 4. Host opening rules.
  run(`state.players.enemy.x=drop.x+6;state.players.enemy.z=drop.z;state.players.enemy.y=drop.y+1.7;hostOpenStart('enemy')`);assert.ok(!run(`openHolds.has('enemy')`),`${map}: out-of-range hold cannot start`);now+=1600;run(`hostOpenDrop('enemy')`);
  assert.ok(!run('drop.openedBy'),`${map}: out-of-range open rejected`);
  run(`state.players.enemy.x=drop.x+1.5;openHolds.clear()`);run(`hostOpenDrop('enemy')`);assert.ok(!run('drop.openedBy'),`${map}: open without holding rejected`);
  run(`state.players.enemy.alive=false;hostOpenStart('enemy')`);assert.ok(!run(`openHolds.has('enemy')`),`${map}: dead player cannot start opening`);run(`state.players.enemy.alive=true;hostOpenStart('enemy');handleHostMessage({t:'state',x:drop.x+6,z:drop.z,y:drop.y+1.7},'enemy')`);assert.ok(!run(`openHolds.has('enemy')`),`${map}: leaving range cancels host hold`);
  run(`state.players.enemy.x=drop.x+1.5;hostOpenStart('enemy');applyHit('host','enemy',5)`);assert.ok(!run(`openHolds.has('enemy')`),`${map}: taking damage cancels host hold`);
  run(`hostOpenStart('enemy')`);now+=300;run(`hostOpenDrop('enemy')`);assert.ok(!run('drop.openedBy'),`${map}: too-short hold rejected`);
  now+=1300;run(`hostOpenDrop('enemy')`);assert.equal(run('drop.openedBy'),'enemy',`${map}: valid open accepted`);
  const item=run('drop.item');assert.ok(['rpg','toilet'].includes(item));assert.equal(run(`specialOwners.get('enemy').type`),item);
  assert.equal(run(`sent.filter(m=>m.t==='airdrop').at(-1).drop.item`),item,`${map}: item revealed only after opening`);
  run(`state.players.host.x=drop.x+1;state.players.host.z=drop.z;state.players.host.y=drop.y+1.7;hostOpenStart('host')`);now+=1600;run(`hostOpenDrop('host')`);assert.equal(run('drop.openedBy'),'enemy',`${map}: second open rejected`);
  tick(4600);assert.ok(!run('colliders.includes(drop.collider)'),`${map}: opened crate clears out`);
}

// 5. RPG: falloff, line of sight, half self-damage, no self-kill credit, 3 rockets then back to the gun.
match('neon');tick(9200);run(`resetAirdropState();sent.length=0;state.players.host.x=0;state.players.host.z=10;camera.position.set(0,1.7,10)`);
run(`grantSpecial('rpg');specialOwners.set('host',{type:'rpg',ammo:3,last:-Infinity})`);
assert.equal(run('state.special.type'),'rpg');assert.equal(run('state.ammo'),1);assert.equal(run('state.special.reserve'),2);
assert.ok(!run(`[...document.getElementById('respawn-weapons').innerHTML.matchAll(/rpg|toilet/gi)].length`),'specials never offered on respawn');
run(`renderRespawnLoadout()`);assert.ok(!/rpg|toilet/i.test(run(`document.getElementById('respawn-weapons').innerHTML`)),'respawn loadout excludes specials');
const blastAt=d=>{run(`state.players.enemy={...state.players.enemy,health:100,alive:true,x:${d},y:1.7,z:-20};explodeRocket(new THREE.Vector3(0,.85,-20),'host')`);return 100-run('state.players.enemy.health')};
const near=blastAt(.5),mid=blastAt(2.5),far=blastAt(4.2),out=blastAt(6);
assert.ok(near>mid&&mid>far&&far>0&&out===0,`rocket falloff ${near} > ${mid} > ${far} > ${out}`);
run(`const wall=new THREE.Mesh(new THREE.BoxGeometry(.4,6,6));wall.position.set(1.5,1,-20);world.add(wall);wall.updateMatrixWorld(true);shotBlockers.push(wall)`);
assert.equal(blastAt(2.8),0,'walls block splash');run('shotBlockers.length=0');
run(`state.players.host.health=100;state.health=100;explodeRocket(new THREE.Vector3(0,.85,10),'host')`);assert.equal(run('state.players.host.health'),40,'self damage is 50%');
const killsBefore=run('state.players.host.kills||0');run(`state.players.host.health=30;explodeRocket(new THREE.Vector3(0,.85,10),'host')`);assert.equal(run('state.players.host.alive'),false,'self rocket can kill you');assert.equal(run('state.players.host.kills||0'),killsBefore,'self kill scores nothing');
run(`state.players.host={...myPublic(),health:100,alive:true,x:0,y:1.7,z:10,kills:0,deaths:0};state.alive=true;state.health=100;state.special={type:'rpg',reserve:2};state.ammo=1;specialOwners.set('host',{type:'rpg',ammo:3,last:-Infinity});state.lastShot=-Infinity;state.reloading=false;camera.rotation.set(0,0,0)`);
for(let shot=0;shot<3;shot++){run('state.lastShot=-Infinity;shoot()');assert.ok(run(`sent.some(m=>m.t==='proj'&&m.kind==='rocket')`),'rocket launched');run('sent.length=0');
  for(let t=0;t<3000;t+=16){now+=16;run('updateAirdrop(.016,performance.now());updateWeaponMotion(.016,performance.now())')}}
assert.equal(run('state.special'),null,'RPG gone after 3 rockets');assert.equal(run('state.ammo'),run('WEAPONS.ar.mag'),'back to a full gun');assert.ok(!run(`specialOwners.has('host')`));

// 6. Toilet gun: charged shot, pull, tick damage, pop.
run(`grantSpecial('toilet');specialOwners.set('host',{type:'toilet',ammo:5,last:-Infinity});state.lastShot=-Infinity`);assert.equal(run('state.ammo'),5);
run('shoot()');assert.ok(!run(`sent.some(m=>m.t==='proj')`),'toilet gun charges before firing');now+=400;run('updateSpecial(performance.now())');assert.ok(run(`sent.some(m=>m.t==='proj'&&m.kind==='orb')`),'orb fires after the charge');
run(`for(const pr of [...projectiles])removeProjectile(pr);state.players.enemy={...state.players.enemy,health:100,alive:true,x:1,y:1.7,z:-30};state.velocityX=state.velocityZ=0;camera.position.set(2.5,1.7,-30);spawnVortex({id:99,x:0,y:.85,z:-30,owner:'host'},true);spawnVortex({id:98,x:0,y:.85,z:-30,owner:'enemy'},false)`);
tick(400);assert.ok(run('state.velocityX')<-.5,'vortex pulls you toward its center');
assert.ok(run('state.players.enemy.health')<100&&run('state.players.enemy.health')>90,'vortex tick damage');
tick(1300);assert.ok(run('state.players.enemy.health')<55,`vortex pop damage (health ${run('state.players.enemy.health')})`);

// 7. Death drops the special everywhere.
run(`state.players.host={...myPublic(),health:20,alive:true,x:0,y:1.7,z:0,kills:0,deaths:0};state.alive=true;grantSpecial('rpg');specialOwners.set('host',{type:'rpg',ammo:3,last:-Infinity});applyHit('enemy','host',50)`);
assert.equal(run('state.special'),null,'special lost on death');assert.ok(!run(`specialOwners.has('host')`),'host forgets the special too');
// Exercise the actual host-to-client message handlers for both possible rewards.
const clientCtx=vm.createContext({THREE,Math:Object.create(Math),document:{body:{},getElementById:node,createElement:()=>node('created'),addEventListener(){},querySelectorAll:()=>[]},performance:{now:()=>now},addEventListener(){},setTimeout:fn=>timers.push(fn),setInterval(){},clearInterval(){},console,innerWidth:1280,innerHeight:720,localStorage:{getItem:()=>null,setItem(){}}});
vm.runInContext(source,clientCtx);const clientRun=code=>vm.runInContext(code,clientCtx);
clientRun(`scene=new THREE.Scene();scene.background=new THREE.Color();scene.fog=new THREE.Fog(0,1,2);world=new THREE.Group();scene.add(world);camera=new THREE.PerspectiveCamera(76,1280/720,.08,160);camera.position.set(0,1.7,0);controls={isLocked:false,unlock(){}};raycaster=new THREE.Raycaster();makeWeapon();`);
ctx.deliverClient=message=>{clientCtx.packet=JSON.parse(JSON.stringify(message));clientRun('handleClientMessage(packet)')};
for(const item of ['rpg','toilet']){
  match('neon');run(`airdropPlan.item='${item}';broadcast=m=>{sent.push(JSON.parse(JSON.stringify(m)));deliverClient(m)}`);
  clientRun(`resetAirdropState();setMap('neon');Object.assign(state,{id:'enemy',host:false,mode:'game',matchActive:true,alive:true,selectedWeapon:'ar',equipped:'gun',health:100,ammo:30,arsenal:{}});`);
  clientCtx.initialPlayers=JSON.parse(JSON.stringify(run('state.players')));clientRun('state.players=initialPlayers');
  tick(9200);assert.ok(run('drop.landed'));assert.equal(run('publicDrop().item'),null,'host does not leak the loot before opening');
  ctx.deliverClient({t:'airdrop',drop:run('publicDrop()')});clientRun('updateAirdrop(.016,performance.now())');
  assert.ok(clientRun('drop.landed&&!drop.item'),`${item}: non-host sees landed crate but not item`);
  run(`state.players.enemy.x=drop.x+1;state.players.enemy.z=drop.z;state.players.enemy.y=drop.y+1.7;state.connections.set('enemy',{open:true,send:deliverClient});hostOpenStart('enemy')`);now+=1600;run(`hostOpenDrop('enemy')`);
  assert.equal(clientRun('state.special?.type'),item,`${item}: non-host receives special weapon`);
  assert.equal(clientRun('drop.item'),item,`${item}: non-host receives opened loot`);
  run(`handleHostMessage({t:'specialFire'},'enemy')`);
  assert.equal(clientRun('projectiles.at(-1)?.kind'),item==='rpg'?'rocket':'orb',`${item}: non-host receives projectile`);
}
console.log(`PASS airdrop: 45-75s timing (mean ${(mean/1000).toFixed(1)}s), 2s frozen cinematic, landing y neon ${landings.neon} / piazza ${landings.piazza} / factory ${landings.factory}, secret loot, host-validated hold-to-open, RPG splash/LOS/self-damage/3 rockets, toilet vortex pull+ticks+pop, lost on death.`);
