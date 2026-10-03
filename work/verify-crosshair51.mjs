import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import * as THREE from '../../work/three.module.js';
// Run from work/: node verify-gunfeel37.mjs
const nodes=new Map(),events={},timers=[];let now=10000;
const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'Tester',textContent:'',hidden:false,style:{setProperty(k,v){this[k]=v}},dataset:{},className:'',classList:{add(){},remove(){},toggle(){}},focus(){},prepend(){},addEventListener:(event,fn)=>events[id+event]=fn,getContext:()=>({fillRect(){},strokeRect(){},fillText(){}})});return nodes.get(id)};
const ctx=vm.createContext({THREE,Math:Object.create(Math),document:{body:{},getElementById:node,createElement:()=>node('created'),addEventListener:(key,fn)=>events[key]=fn},performance:{now:()=>now},addEventListener:(key,fn)=>events[key]=fn,setTimeout:fn=>timers.push(fn),setInterval(){},clearInterval(){},console,innerWidth:1280,innerHeight:720});
const files=['surface-details.js','wooden-character.js','neegy-character.js','combat-models.js','plaza.js','neon-town.js','surf.js','game.js'];
const source=files.map(f=>fs.readFileSync('../dist/'+f,'utf8').replace(/^import [\s\S]*?;$/gm,'').replaceAll('export function','function').replace(/^export const/gm,'const')).join('\n').replace("buildChoices();initWorld();showScreen('home');",'');
vm.runInContext(source,ctx);const run=code=>vm.runInContext(code,ctx);
run(`scene=new THREE.Scene();world=new THREE.Group();scene.add(world);camera=new THREE.PerspectiveCamera(76,1280/720,.08,160);camera.rotation.order='YXZ';camera.position.set(0,1.7,0);controls={isLocked:false,unlock(){}};raycaster=new THREE.Raycaster();makeWeapon();broadcast=()=>{};addFeed=()=>{};`);
function reset(weapon){
  now+=3000;run(`Object.assign(state,{id:'shooter',mode:'game',host:true,matchActive:true,alive:true,equipped:'gun',selectedWeapon:'${weapon}',health:100,reloading:false,ammo:WEAPONS.${weapon}.mag,reserve:Infinity,meleeStart:-Infinity,lastMelee:-Infinity,lastShot:-Infinity,switchStart:-Infinity,inspectStart:-Infinity,velocityX:0,velocityZ:0,onGround:true});state.players={shooter:{...myPublic(),weapon:'${weapon}',x:0,y:1.7,z:0,yaw:0,pitch:0}};shotCooldowns.clear();shotHeat.clear();shotBlockers.length=0;state.connections.clear();camera.position.set(0,1.7,0);camera.rotation.set(0,0,0);updateWeaponModel();resetAim();`);
}
const frames=(ms)=>{for(let t=0;t<ms;t+=16){now+=16;run('updateAimRecoil(.016,performance.now());updateWeaponMotion(.016,performance.now())')}};
const ch=()=>run(`document.getElementById('crosshair')`),gap=()=>parseFloat(ch()['--gap']??ch().style['--gap']);
const gapOf=w=>{reset(w);run('state.velocityX=state.velocityZ=0;state.stillSince=performance.now()');run('updateCrosshair(performance.now())');return parseFloat(ch().style['--gap'])};
const ar=gapOf('ar'),smg=gapOf('smg'),shotgun=gapOf('shotgun');
assert.equal(ch().className,'crosshair ch-shotgun');
assert.ok(ar<smg&&smg<shotgun,`AR smallest, shotgun biggest (${ar} ${smg} ${shotgun})`);
reset('sniper');run('state.velocityX=8;updateCrosshair(performance.now())');const moving=parseFloat(ch().style['--gap']);
run('state.velocityX=0');for(let i=0;i<60;i++){now+=16;run('updateCrosshair(performance.now())')}
const still=parseFloat(ch().style['--gap']);
assert.ok(moving>15&&still<moving/2,`sniper ${moving}px moving → ${still}px still`);
assert.ok(run('myPublic().steady')>.95,'steadiness is sent to the host');
// Host honors it: a steady sniper shot lands far tighter than a moving one.
const cone=steady=>{run("globalThis.__ends=[]");reset('sniper');run(`broadcast=m=>{if(m.t==='tracers')__ends.push(m.ends[0])}`);for(let i=0;i<40;i++){now+=1200;run(`state.players.shooter=Object.assign(myPublic(),{steady:${steady},aiming:false,x:0,y:1.7,z:0,yaw:0,pitch:0});resolveShot("shooter",performance.now())`)}return Math.max(...run('__ends.map(e=>Math.hypot(e[0],e[1]-1.7)/Math.abs(e[2]))'))};
const loose=cone(0),tight=cone(1);
assert.ok(tight<loose/4,`host sniper cone ${loose.toFixed(4)} → ${tight.toFixed(4)} when still`);
reset('ar');run("state.equipped='bat';updateCrosshair(performance.now())");assert.equal(ch().className,'crosshair ch-melee');
console.log(`PASS crosshairs: AR ${ar}px < SMG ${smg}px < shotgun ${shotgun}px; sniper ${moving}px moving → ${still}px still (host cone tightens too); melee dot.`);
