import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as THREE from '../../work/three.module.js';

const source=['surface-details.js','mozzarella-factory.js'].map(name=>
  fs.readFileSync(new URL(`../dist/${name}`,import.meta.url),'utf8').replace(/^import .*;$/gm,'').replaceAll('export function','function').replaceAll('export const','const')
).join('\n');
const context=vm.createContext({THREE,Date});
vm.runInContext(source+';globalThis.factory={buildMozzarellaFactory,factoryConveyorAt,factorySteamActive,factorySteamBlocksSight,updateFactoryEffects};',context);
const {factory}=context,world=new THREE.Group(),colliders=[],shotBlockers=[],ladders=[],materials=new Map();
const mat=color=>{if(!materials.has(color))materials.set(color,new THREE.MeshStandardMaterial({color}));return materials.get(color)};
factory.buildMozzarellaFactory({world,colliders,shotBlockers,mat,ladders});
const blocked=(x,z,foot=0)=>colliders.some(c=>foot<c.maxY-.001&&foot+1.9>c.minY+.001&&x>c.minX-.55&&x<c.maxX+.55&&z>c.minZ-.55&&z<c.maxZ+.55);
for(const [x,z] of [[-18,-20],[18,20],[-18,20],[18,-20],[0,-22],[0,22],[-21.5,0],[21.5,0]])assert.ok(!blocked(x,z),`spawn/pickup ${x},${z} blocked`);
for(const z of [-15,-8,0,8,15])for(const x of [-5.5,5.5])assert.ok(!blocked(x,z),`conveyor ${x},${z} blocked`);
assert.equal(factory.factoryConveyorAt(-5.5,0),-7.5);
assert.equal(factory.factoryConveyorAt(5.5,0),7.5);
assert.equal(factory.factoryConveyorAt(5.5,18),0);
assert.equal(factory.factoryConveyorAt(5.5,0,3.22),0,'upper floors must not act like conveyors');
const floorAt=(x,z,height)=>colliders.some(c=>Math.abs(c.maxY-height)<.015&&x>=c.minX&&x<=c.maxX&&z>=c.minZ&&z<=c.maxZ);
for(const x of [-15,15])assert.ok(floorAt(x,0,3.22),`missing mezzanine at ${x}`);
assert.ok(floorAt(0,0,6.22),'missing third-level bridge');
assert.equal(ladders.length,6,'each side needs two ground ladders and an upper ladder');
for(const l of ladders){assert.ok(!blocked(l.x,l.z,l.bottom),`ladder approach ${l.x},${l.z} blocked`);assert.ok(!blocked(l.exitX,l.exitZ,l.top),`ladder exit ${l.exitX},${l.exitZ} blocked`)}
const from={x:-11,y:1.7,z:-8},to={x:0,y:1.7,z:-8};
assert.ok(factory.factorySteamBlocksSight(from,to,0));
assert.ok(!factory.factorySteamBlocksSight(from,to,3000));
factory.updateFactoryEffects(0);
let meshes=0,triangles=0;world.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3}});
assert.ok(meshes<85,`draw-call budget exceeded: ${meshes}`);
assert.ok(triangles<12000,`geometry budget exceeded: ${triangles}`);
assert.ok(shotBlockers.length>0);
console.log(`PASS compact factory: three walkable tiers, six clear ladders, denser cover, clear spawns/belts, ${meshes} meshes, ${triangles} triangles`);
