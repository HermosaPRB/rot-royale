import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import * as THREE from '../../work/three.module.js';
const root=new URL('../',import.meta.url),read=name=>fs.readFileSync(new URL('dist/'+name,root),'utf8');
const clean=s=>s.replace(/^import .*;$/gm,'').replaceAll('export function','function').replaceAll('export const','const');
const helpers=clean(read('surface-details.js'))+'\n'+clean(read('arena-details.js'));
function build(file,fn,baseline=false){
  const code=baseline?execFileSync('git',['show','58e63de:dist/'+file],{cwd:root,encoding:'utf8'}):read(file);
  const ctx=vm.createContext({THREE,Date});vm.runInContext(helpers+'\n'+clean(code)+`;globalThis.build=${fn}`,ctx);
  const world=new THREE.Group(),colliders=[],shotBlockers=[],ladders=[],cache=new Map();
  ctx.build({world,colliders,shotBlockers,ladders,mat:(c,r=.82)=>{const key=c+':'+r;if(!cache.has(key))cache.set(key,new THREE.MeshStandardMaterial({color:c,roughness:r}));return cache.get(key)}});
  return {world,colliders:JSON.stringify(colliders),ladders:JSON.stringify(ladders)};
}
function cost(world){let meshes=0,triangles=0;world.traverse(m=>{if(!m.isMesh)return;meshes++;triangles+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3;for(const key of ['position','normal'])for(const v of m.geometry.attributes[key].array)assert.ok(Number.isFinite(v),'finite '+key)});return {meshes,triangles}}
for(const [file,fn,budget] of [['neon-town.js','buildNeonTown',22000],['mozzarella-factory.js','buildMozzarellaFactory',18000]]){
  const old=build(file,fn,true),next=build(file,fn),before=cost(old.world),after=cost(next.world);
  assert.equal(next.colliders,old.colliders,'visual detail must not change collisions');assert.equal(next.ladders,old.ladders,'ladder routes unchanged');
  assert.ok(after.meshes-before.meshes<=18,'batched detail draw-call budget');assert.ok(after.triangles<budget,'triangle budget');
  console.log(file,{before,after,checks:'finite geometry, identical collisions and ladder routes'});
}
for(const [file,fn] of [['wooden-character.js','createWoodenCharacter'],['neegy-character.js','createNeegyCharacter']]){
  const ctx=vm.createContext({THREE});vm.runInContext(clean(read('surface-details.js'))+'\n'+clean(read(file))+`;globalThis.create=${fn}`,ctx);
  const model=ctx.create(),clone=ctx.create(),stats=cost(model);
  const baseline=vm.createContext({THREE});vm.runInContext(clean(read('surface-details.js'))+'\n'+clean(execFileSync('git',['show','58e63de:dist/'+file],{cwd:root,encoding:'utf8'}))+`;globalThis.create=${fn}`,baseline);
  assert.deepEqual(stats,cost(baseline.create()),'material polish adds no character geometry or draw calls');assert.equal(model.userData.legs.length,2);assert.equal(model.userData.arms.length,2);
  assert.ok(model.getObjectByName('trigger-hand'));assert.ok(model.getObjectByName('support-hand'));
  assert.notEqual(model.userData.legs[0],clone.userData.legs[0]);model.userData.legs[0].rotation.x=.5;assert.equal(Math.abs(clone.userData.legs[0].rotation.x),0);
  console.log(file,{...stats,checks:'finite geometry, independent limbs, both gun grips'});
}
const gait=vm.runInNewContext('('+read('game.js').match(/function strideAdvance\([^\n]+/)[0]+')');
assert.equal(gait(0,1),0);assert.ok(gait(5,1)>gait(2,1));assert.equal(gait(1000,1),16);
for(const fps of [30,60,144]){let phase=0;for(let i=0;i<fps;i++)phase+=gait(8,1/fps);assert.ok(Math.abs(phase-16)<1e-9)}
console.log('PASS frame-independent cadence and bounded fast-bhop animation');
