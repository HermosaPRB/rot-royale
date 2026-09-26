import * as THREE from 'three';
import {mergeRigidParts} from './surface-details.js?v=detail-6';

// Original arena geometry: opposing homes, a vehicle choke and two flanking gardens.
// Rigid surfaces are batched by material. Collision remains simple axis-aligned boxes.
export function buildNeonTown({world,colliders,shotBlockers,mat}){
  const solid=new THREE.Group(),decor=new THREE.Group();world.add(solid,decor);
  const palette={white:0xe7edf1,dark:0x25364a,glass:0x245872,orange:0xf17d38,blue:0x29aaca,grass:0x83ab57,road:0x344654};
  const glow=new THREE.MeshBasicMaterial({color:0x67e9ec});
  const block=(x,y,z,w,h,d,color,collision=true,visualOnly=false)=>{
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),typeof color==='number'?mat(color,.62):color);mesh.position.set(x,y,z);mesh.castShadow=h>.3;mesh.receiveShadow=true;(visualOnly?decor:solid).add(mesh);
    if(collision)colliders.push({minX:x-w/2,maxX:x+w/2,minZ:z-d/2,maxZ:z+d/2});return mesh;
  };
  block(0,-.16,0,100,.3,100,palette.grass,false,true);
  block(0,.015,0,32,.035,29,palette.road,false,true);
  for(const x of [-17,17])block(x,.025,0,2,.04,68,0xc9d3d3,false,true);
  for(const z of [-15,15])block(0,.025,z,36,.04,2,0xc9d3d3,false,true);
  // Readable circuit-grid road markings, no dynamic lights or post-processing.
  for(let z=-12;z<=12;z+=4){block(0,.04,z,26,.018,.06,glow,false,true);for(const x of [-12,-6,6,12])block(x,.04,z+1,.06,.018,1.8,glow,false,true)}
  for(const z of [-20,20]){
    const side=Math.sign(z),accent=side<0?palette.orange:palette.blue,front=z-side*5;
    // Ground floor is genuinely traversable, with front/rear doors and a side garage opening.
    block(-10,1.8,z,.45,3.6,10,palette.white);block(10,1.8,z,.45,3.6,10,palette.white);
    for(const wallZ of [front,z+side*5]){block(-6.2,1.8,wallZ,7.6,3.6,.4,palette.white);block(6.2,1.8,wallZ,7.6,3.6,.4,palette.white);block(0,3.3,wallZ,4.8,.6,.4,palette.white,false)}
    block(-5,.08,z,9.5,.15,9.5,0xd9e1e4,false,true);block(5,.08,z,9.5,.15,9.5,0xd9e1e4,false,true);
    block(0,3.8,z,21,.45,11.5,palette.dark,false);block(0,5.4,z+side*1,16,2.9,8,accent,false);
    block(0,5.55,front-side*.06,12,1.9,.15,palette.glass,false);
    for(const x of [-5.8,-2.9,0,2.9,5.8])block(x,5.55,front-side*.16,.12,2.05,.12,palette.white,false,true);
    const roof=block(0,7.05,z,19,.38,10.5,palette.white,false);roof.rotation.z=side*.055;
    block(0,3.35,front-side*.26,19,.14,.12,glow,false,true);
    for(const x of [-10.24,10.24])for(const dz of [-2.6,2.6]){block(x,2,z+dz,.06,1.35,2.1,palette.glass,false,true);block(x,1.3,z+dz,.12,.1,2.3,accent,false,true)}
    for(const x of [-6.3,6.3]){block(x,2.1,z+side*5.24,2.5,1.4,.07,palette.glass,false,true);block(x,1.33,z+side*5.3,2.8,.1,.15,accent,false,true)}
    // Interior kitchen island, sofa and a side garden pavilion provide close-range cover.
    block(-5,.65,z+side*1,3.3,1.3,1.1,palette.dark);block(5,.6,z-side*1,3,1.2,1.5,accent);
    block(24,1.35,z,6,2.7,.45,palette.white);block(27,1.35,z+side*3,.4,2.7,6,palette.white);block(24,3,z+side*2,7,.25,7,palette.dark,false);
    block(-24,.65,z,5,1.3,2,accent);block(-24,1.45,z,4.6,.35,1.7,0x3d6741);
    // Geometric roof solar panels and house number placards.
    for(let i=0;i<4;i++)block(-5+i*3,7.3,z,2.4,.09,4,palette.glass,false,true);
    block(6.6,2.1,front-side*.24,1.5,.75,.08,palette.dark,false,true);
    for(let i=0;i<(side<0?1:2);i++)block(6.3+i*.5,2.1,front-side*.30,.16,.47,.03,glow,false,true);
  }
  // Two offset vehicles interrupt the central sightline without closing the flanks.
  const vehicle=(x,z,color,truck)=>{
    const length=truck?12:10;block(x,1.35,z,4,2.7,length,color);block(x,2.85,z,4.15,.28,length+.2,palette.white,false);
    block(x,2.03,z-length/2-.04,3.6,1.1,.12,palette.glass,false);
    for(const side of [-1,1]){for(let i=0;i<4;i++)block(x+side*2.025,2.05,z-length/2+1.4+i*2, .08,1.05,1.45,palette.glass,false,true);
      for(const wz of [z-length/2+1.5,z+length/2-1.5]){const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.64,.64,.32,12),mat(palette.dark));wheel.rotation.z=Math.PI/2;wheel.position.set(x+side*2,.55,wz);decor.add(wheel)}
      block(x+side*1.99,.8,z,.08,.10,length-.4,glow,false,true);
    }
    for(const dx of [-1.4,1.4])block(x+dx,.7,z-length/2-.1,.45,.20,.15,0xffdf90,false,true);
    if(truck){block(x,3.4,z+1.5,3.7,.8,7,palette.white,false);block(x,3.83,z+1.5,3.2,.08,6,glow,false,true)}
  };
  vehicle(-5,-2,palette.orange,false);vehicle(5,3,palette.blue,true);
  // Low planters, parked cars and flank cover retain open routes around the houses.
  for(const [x,z] of [[-23,-6],[23,7],[-24,28],[24,-28]]){block(x,.7,z,4,1.4,2.4,palette.white);block(x,1.55,z,3.5,.5,2,0x4f8755)}
  for(const [x,z] of [[-25,8],[25,-8]]){block(x,.6,z,3,1.2,5.7,0xd95f66);block(x,1.5,z,2.5,.7,2.7,palette.glass);block(x,1.91,z,2.6,.12,2.8,palette.white,false)}
  for(const z of [-32,32]){block(0,1.5,z,30,3,.35,palette.dark);block(0,3.05,z,30,.1,.45,glow,false,true)}
  for(const x of [-33,33]){block(x,1.8,0,.4,3.6,70,palette.white);for(let z=-30;z<=30;z+=6)block(x-.24*Math.sign(x),2,z,.06,2.5,3,palette.glass,false,true)}
  // Stylized trees live outside the playable lanes; each crown is only 80 triangles.
  for(const x of [-38,38])for(let z=-32;z<=32;z+=16){block(x,2,z,.4,4,.4,0x5a4e50,false,true);const crown=new THREE.Mesh(new THREE.IcosahedronGeometry(3,1),mat(z%32?0xdb8fab:0x4a8977));crown.position.set(x,5,z);crown.scale.y=1.4;decor.add(crown)}
  for(let i=0;i<9;i++){const x=-55+i*14;block(x,8+i%3*4,-51,7,16+i%3*8,7,0x88adb8,false,true)}
  mergeRigidParts(solid);mergeRigidParts(decor);solid.traverse(m=>{if(m.isMesh)shotBlockers.push(m)});
}

export function createPickupMesh(kind){
  const group=new THREE.Group(),body=new THREE.Group();group.add(body);group.userData.body=body;
  const color=kind==='health'?0x52efb5:0xd59bff,light=new THREE.MeshBasicMaterial({color}),shell=new THREE.MeshStandardMaterial({color:0x24384c,metalness:.45,roughness:.4});
  const add=(x,y,z,w,h,d,material)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);m.position.set(x,y,z);body.add(m)};
  add(0,0,0,kind==='health'?.62:1.15,.5,.65,shell);add(0,.28,0,kind==='health'?.7:1.2,.08,.7,light);
  if(kind==='health'){add(0,.05,-.335,.36,.10,.025,light);add(0,.05,-.35,.10,.34,.025,light);add(0,.05,.335,.36,.10,.025,light);add(0,.05,.35,.10,.34,.025,light)}else{for(const x of [-.4,.4])add(x,0,0,.08,.55,.68,light);add(0,0,-.34,.22,.18,.03,light)}
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.85,.025,4,24),light);ring.rotation.x=Math.PI/2;ring.position.y=.05;group.add(ring);mergeRigidParts(body);return group;
}
