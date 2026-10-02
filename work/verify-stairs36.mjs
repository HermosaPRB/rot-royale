import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Exercise the shipped collision functions without starting WebGL.
const source=readFileSync(new URL('../dist/game.js',import.meta.url),'utf8');
const start=source.indexOf('function moveSweptAxis('),end=source.indexOf('function rampHeight(',start);
assert.ok(start>=0&&end>start);
const stair=(minZ,maxZ,maxY)=>({stair:true,minX:6.2,maxX:9,minZ,maxZ,minY:0,maxY});
const world={
  camera:{position:{x:5.4,y:1.7,z:.25}},
  state:{map:'neon',onGround:true,velocityX:8,velocityZ:8,hopChain:0},
  colliders:[stair(0,.475,.25),stair(.475,.95,.5)],
  clamp:(value,min,max)=>Math.max(min,Math.min(max,value)),
};
vm.runInNewContext(source.slice(start,end)+';globalThis.physics={moveSweptAxis,collides}',world);

world.physics.moveSweptAxis('x',3);
assert.ok(world.camera.position.x<5.651,'side entry must stop a player radius before the tread');
assert.equal(world.camera.position.y,1.7,'side contact must not step the player upward');

world.camera.position={x:7.6,y:1.7,z:-.35};
world.physics.moveSweptAxis('z',.6);
assert.equal(world.camera.position.y,1.95,'the leading edge remains climbable');
assert.ok(world.camera.position.z>0,'forward movement continues onto the tread');

world.camera.position={x:5.4,y:1.7,z:-.35};
world.physics.moveSweptAxis('z',.6);
assert.equal(world.camera.position.y,1.7,'outside the flight cannot trigger step-up');
console.log('Stair side collision and forward step-up passed.');
