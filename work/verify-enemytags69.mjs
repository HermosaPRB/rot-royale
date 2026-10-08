import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const src=fs.readFileSync(new URL('../dist/game.js',import.meta.url),'utf8');
const nodes=new Map();
const node=()=>({textContent:'',style:{},classList:{remove(){},toggle(){}},appendChild(){},remove(){this.removed=true}});
const tags=new Map();
const ctx=vm.createContext({
  state:{practice:false,matchActive:true,voiceOn:false,id:'self',players:{enemy:{id:'enemy',name:'Enemy',voice:true,alive:true}}},
  $:id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id)},
  voiceTags:tags,isPlaying:()=>true,airdropCinematicActive:()=>false,
  playerMeshes:new Map([['enemy',{visible:true,position:{x:0,y:0,z:0}}]]),
  _voicePos:{set(){},distanceTo(){return 5},clone(){return {project(){return {x:0,y:0,z:0}}}}},
  camera:{position:{}},VOICE:{tagRange:50,talkLevel:.1,maxDistance:30},
  document:{createElement:node},voicePeers:new Map(),botTalk:new Map(),innerWidth:800,innerHeight:600,
});
vm.runInContext(src.slice(src.indexOf('function updateVoiceTags('),src.indexOf('function updateVoiceUi(')),ctx);
vm.runInContext(src.slice(src.indexOf('function updateTargetCard('),src.indexOf('function updateFeel(')),ctx);
// Both local and remote opt-in combinations must hide labels and remove stale practice tags.
for(const local of [false,true])for(const remote of [false,true]){
  ctx.state.voiceOn=local;ctx.state.players.enemy.voice=remote;
  const stale=node();tags.set('enemy',stale);ctx.updateVoiceTags();
  assert.equal(tags.size,0);assert.equal(stale.removed,true);
  let hidden=false;ctx.$('target-card').classList.remove=()=>hidden=true;
  ctx.updateTargetCard(0);assert.equal(hidden,true);
}
ctx.state.practice=true;ctx.state.players.enemy.voice=true;ctx.updateVoiceTags();
assert.equal(tags.size,1,'practice keeps speaker labels');
assert.match(tags.get('enemy').textContent,/Enemy/);
ctx.state.practice=false;ctx.updateVoiceTags();assert.equal(tags.size,0,'online transition clears labels');
console.log('PASS enemy labels hidden online with voice on/off; stale labels cleared; practice preserved.');
