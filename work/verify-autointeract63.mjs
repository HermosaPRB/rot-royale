import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../dist/game.js',import.meta.url),'utf8');
let now=1000;const node={textContent:'',classList:{toggle(){},add(){},remove(){}},style:{setProperty(){}}};
const ctx=vm.createContext({Math,Date,performance:{now:()=>now},state:{onGround:true,keys:{},velocityX:0,velocityZ:0,climbing:null},camera:{position:{x:0,y:1.7,z:0,set(x,y,z){Object.assign(this,{x,y,z})}}},ladders:[{x:0,z:0,bottom:0,top:4,exitX:1,exitZ:0}],$:()=>node,isPlaying:()=>true,stopEmote(){},clamp:(x,a,b)=>Math.max(a,Math.min(b,x)),drop:{landed:true,x:0,y:0,z:0},airdropFrozen:()=>false,AIRDROP:{OPEN_RANGE:2.2,OPEN_HOLD:1500},sendHost(m){ctx.messages.push(m.t)},messages:[]});
function load(a,b){vm.runInContext(source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a))),ctx)}
load('const caseWaits=','function updatePickups(');load('function nearbyLadder(','function interactOrEmote(');load('function updateClimbing(','function hasClearShot(');load('function tryStartAirdropOpen(','function playerNearDrop(');
const run=s=>vm.runInContext(s,ctx);
ctx.state.pickups=[];
run('updateLadderHint(.2)');assert.equal(ctx.state.climbing,null);run('updateLadderHint(.3)');assert.equal(ctx.state.climbing,0);run('updateClimbing(.5)');assert.ok(ctx.camera.position.y>1.7,'climbs with no key held');ctx.state.keys.Space=true;run('updateClimbing(.01)');assert.equal(ctx.state.climbing,null);
ctx.state.keys={};ctx.state.onGround=true;ctx.camera.position.set(0,1.7,0);run('updateOpenHold(1000)');assert.ok(ctx.messages.includes('openStart'));now=2600;run('updateOpenHold(2600)');assert.ok(ctx.messages.includes('openDrop'),'opens without E');
ctx.messages=[];now=3000;run('updateOpenHold(3000)');ctx.state.keys.KeyW=true;run('updateOpenHold(3100)');assert.ok(ctx.messages.includes('openCancel'),'moving cancels opening');
ctx.player={id:'a',alive:true,x:0,z:0,y:1.7};ctx.item={id:0,x:0,z:0};assert.equal(run('caseReady(player,item,1000)'),false);for(const t of [1200,1400])run(`caseReady(player,item,${t})`);assert.equal(run('caseReady(player,item,1600)'),true);ctx.player.x=1;assert.equal(run('caseReady(player,item,1700)'),false);
console.log('PASS auto interactions: ladder dwell/auto-ascent/jump-off, airdrop no-key opening and movement cancel, case dwell/reset.');
