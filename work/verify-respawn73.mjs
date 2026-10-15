import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const src=fs.readFileSync(new URL('../dist/game.js',import.meta.url),'utf8');
let now=10000;const timers=[],packets=[],nodes=new Map();
const node=id=>{if(!nodes.has(id)){const classes=new Set();nodes.set(id,{classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x)},style:{setProperty(){}},textContent:''})}return nodes.get(id)};
const document={}; // Reproduce mobile browsers without Pointer Lock support.
const ctx=vm.createContext({document,$:node,Date:{now:()=>now},setTimeout:(fn,ms)=>timers.push({fn,at:now+ms}),Math,Number,Object,
  state:{},controls:{isLocked:false,unlock:()=>document.exitPointerLock()},openHolds:new Map(),WEAPONS:{ar:{mag:30},smg:{mag:35}},SPECIALS:{},
  camera:{position:{x:0,y:1.7,z:0,set(x,y,z){Object.assign(this,{x,y,z})}}},
  damageFeedback(){},markEliminated(){},broadcast:p=>packets.push(p),addFeed(){},botBanterEvent(){},refillSpecialOnRespawn(){},
  spawnFor:()=>({x:8,z:9}),clearInput(){ctx.state.keys={};ctx.state.fireHeld=false},updateCursor(){},updateHud(){},updateWeaponModel(){},focusGame(){},requestMouseCapture(){},
  isPlaying:()=>ctx.state.mode==='game'&&ctx.state.alive&&ctx.state.matchActive,
  hostSnapshot:()=>{ctx.state.players.host={...ctx.state.players.host,alive:ctx.state.alive,health:ctx.state.health}},
});
vm.runInContext(src.slice(src.indexOf('function applyHit('),src.indexOf('let damageFeedbackSerial')),ctx);
const helper=src.indexOf('function releaseMouseCapture(');
if(helper>=0)vm.runInContext(src.slice(helper,src.indexOf('function updateCursor(',helper)),ctx);
ctx.renderRespawnLoadout=()=>{};
function reset(){timers.length=0;packets.length=0;now+=10000;Object.assign(ctx.state,{id:'host',host:true,practice:true,mode:'game',matchActive:true,matchEnd:now+180000,alive:true,health:100,deaths:0,kills:0,selectedWeapon:'ar',pendingWeapon:'ar',fireHeld:true,connections:new Map([['enemy',{send:p=>packets.push(p)}]]),players:{host:{id:'host',name:'Host',health:100,alive:true,deaths:0,weapon:'ar'},enemy:{id:'enemy',name:'Enemy',health:100,alive:true,deaths:0,weapon:'ar'}}})}
function advance(ms){now+=ms;for(const t of timers.splice(0))if(t.at<=now)t.fn();else timers.push(t)}
for(let i=0;i<3;i++){
  reset();assert.doesNotThrow(()=>ctx.applyHit('enemy','host',100),'mobile death must not call unavailable exitPointerLock');
  assert.equal(node('respawn').classList.contains('active'),true);assert.equal(ctx.state.fireHeld,false);
  ctx.hostSnapshot();advance(2999);assert.equal(ctx.state.alive,false);advance(1);
  assert.equal(ctx.state.alive,true);assert.equal(ctx.state.health,100);assert.equal(ctx.state.ammo,30);assert.equal(ctx.isPlaying(),true);assert.equal(node('respawn').classList.contains('active'),false);
}
reset();ctx.applyHit('host','enemy',100);advance(3000);assert.ok(packets.some(p=>p.t==='respawn'&&p.id==='enemy'),'remote respawn packet');
reset();ctx.state.host=false;assert.doesNotThrow(()=>ctx.takeDamageResult({killed:true,respawnAt:now+3000}));ctx.doRespawn(4,5,'smg');assert.equal(ctx.state.alive,true);assert.equal(ctx.state.ammo,35);assert.equal(node('respawn').classList.contains('active'),false);
reset();ctx.applyHit('enemy','host',100);ctx.state.matchEnd+=1;advance(3000);assert.equal(ctx.state.alive,false,'old round cannot revive');
if(helper>=0){
  let exits=0;document.pointerLockElement={};document.exitPointerLock=()=>exits++;ctx.controls.isLocked=true;ctx.releaseMouseCapture();assert.equal(exits,1,'desktop mouse capture still exits');
  document.exitPointerLock=()=>{throw Error('browser rejected unlock')};assert.doesNotThrow(()=>ctx.releaseMouseCapture());
}
console.log('PASS mobile respawn: no Pointer Lock API, repeated host deaths, replaced snapshots, remote respawn, loadout, round guard, desktop unlock and rejected unlock.');
