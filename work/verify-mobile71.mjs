import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const src=fs.readFileSync(new URL('../dist/game.js',import.meta.url),'utf8');
const nodes=new Map(),listeners=new Map();
function node(id){if(!nodes.has(id))nodes.set(id,{dataset:{touch:id},hidden:false,style:{},classList:{add(){},remove(){},toggle(){}},getBoundingClientRect:()=>({left:0,top:0,width:140,height:140}),closest(){return this},setPointerCapture(){},addEventListener:(name,fn)=>listeners.set(name,fn),querySelector:()=>null});return nodes.get(id)}
let playing=true,shots=0,slides=0,swaps=0;
const ctx=vm.createContext({matchMedia:()=>({matches:true}),$:node,state:{keys:{},equipped:'gun',aimBlend:0},preferences:{sensitivity:1,ads:1},camera:{rotation:{x:0,y:0,z:0}},
  document:{documentElement:node('html'),querySelectorAll:()=>[],addEventListener(){}},addEventListener(){},isPlaying:()=>playing,airdropFrozen:()=>false,aimSensitivity:()=>1,clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),stopEmote(){},unlockAudio(){},shoot:()=>shots++,beginSlide:()=>slides++,toggleAirdropWeapon:()=>swaps++,pauseGame:()=>playing=false});
vm.runInContext(src.slice(src.indexOf('const touchMode='),src.indexOf('function openSettings(')),ctx);
ctx.initTouchControls();
const event=(id,action,x,y)=>({pointerType:'touch',pointerId:id,target:node(action),clientX:x,clientY:y,preventDefault(){}});
listeners.get('pointerdown')(event(1,'move',70,20));
assert.equal(ctx.state.keys.KeyW,true);
listeners.get('pointerdown')(event(2,'look',200,100));listeners.get('pointermove')(event(2,'look',230,110));
assert.ok(ctx.camera.rotation.y<0);assert.ok(ctx.camera.rotation.x<0);
listeners.get('pointerdown')(event(3,'fire',300,200));assert.equal(shots,1);assert.equal(ctx.state.fireHeld,true);
listeners.get('pointerdown')(event(4,'jump',320,250));assert.equal(ctx.state.keys.Space,true);assert.equal(ctx.state.jumpQueued,true);
listeners.get('pointercancel')(event(3,'fire',300,200));assert.equal(ctx.state.fireHeld,false);assert.equal(ctx.state.keys.KeyW,true,'fire cancellation does not cancel movement');
listeners.get('lostpointercapture')(event(1,'move',0,0));assert.equal(ctx.state.keys.KeyW,false);
ctx.touchAction('aim',true);assert.equal(ctx.state.aiming,true);ctx.touchAction('aim',true);assert.equal(ctx.state.aiming,false);
ctx.touchAction('slide',true);ctx.touchAction('special',true);assert.equal(slides,1);assert.equal(swaps,1);
for(let i=0;i<100;i++)ctx.touchLook(100,100);assert.ok(ctx.camera.rotation.y < -Math.PI*2,'unlimited yaw');assert.equal(ctx.camera.rotation.x,-1.45,'bounded pitch');
ctx.touchAction('pause',true);ctx.updateTouchUi();assert.equal(node('touch-controls').hidden,true);assert.equal(ctx.state.keys.Space,false);assert.equal(ctx.state.fireHeld,false);
playing=true;ctx.updateTouchUi();assert.equal(node('touch-controls').hidden,false);
assert.match(src,/if\(touchMode\)\{\$\('control-hint'\).*?return\}/,'touch bypasses pointer lock');
console.log('PASS mobile: simultaneous move/look/fire/jump, cancel/lost capture, aim toggle, slide, swap, unlimited yaw, pause cleanup and pointer-lock bypass.');
