import * as THREE from 'three';
import { mergeRigidParts } from './surface-details.js?v=detail-6';

// The two lanes are deliberately opposite: neither spawn gets a permanent speed advantage.
export const FACTORY_BELTS=[{x:-5.5,direction:-1,color:0x55d9ed},{x:5.5,direction:1,color:0xffb65e}];
export const FACTORY_STEAM=[{x:-5.5,z:-8,phase:0},{x:5.5,z:8,phase:3900}];
const STEAM_PERIOD=8000,STEAM_DURATION=1900;
let effects=null;

export function factoryConveyorAt(x,z,foot=0){
  if(Math.abs(foot)>.22||Math.abs(z)>17.5)return 0;
  const lane=FACTORY_BELTS.find(b=>Math.abs(x-b.x)<1.75);
  return lane?lane.direction*7.5:0;
}
export function factorySteamActive(zone,now=Date.now()){return ((now+zone.phase)%STEAM_PERIOD)<STEAM_DURATION}
export function factorySteamBlocksSight(from,to,now=Date.now()){
  const dx=to.x-from.x,dz=to.z-from.z,denom=dx*dx+dz*dz;
  if(denom<.001||Math.min(from.y,to.y)>3.7||Math.max(from.y,to.y)<.25)return false;
  return FACTORY_STEAM.some(zone=>{
    if(!factorySteamActive(zone,now))return false;
    const t=THREE.MathUtils.clamp(((zone.x-from.x)*dx+(zone.z-from.z)*dz)/denom,0,1);
    const x=from.x+t*dx-zone.x,z=from.z+t*dz-zone.z;
    return x*x+z*z<7.8;
  });
}
export function updateFactoryEffects(now=Date.now()){
  if(!effects)return;
  for(const {group,zone,material} of effects.steam){
    group.visible=factorySteamActive(zone,now);
    material.opacity=.19+.045*Math.sin(now*.008+zone.phase);
  }
  for(const {mesh,lane,base} of effects.stripes){
    const travel=(base+now*.006*lane.direction)%34;
    mesh.position.z=-17+((travel+34)%34);
  }
}

export function buildMozzarellaFactory({world,colliders,shotBlockers,mat,ladders}){
  const solid=new THREE.Group(),decor=new THREE.Group(),dynamic=new THREE.Group();
  world.add(solid,decor,dynamic);
  const M={floor:mat(0x182534),wall:mat(0x20354a),edge:mat(0x344e63),steel:mat(0x657789),dark:mat(0x152231),ivory:mat(0xe6d4aa),vat:mat(0xa6b9c1),crate:mat(0x9d7148),yellow:mat(0xe5ad5a),cyan:mat(0x55d9ed),orange:mat(0xffb65e),glass:mat(0x5e9cb3)};
  const glow=(color)=>new THREE.MeshBasicMaterial({color});
  const G={cyan:glow(0x59dff0),orange:glow(0xffbc66),white:glow(0xd6edf4)};
  function box(x,y,z,w,h,d,material,physical=false){
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);
    mesh.position.set(x,y,z);(physical?solid:decor).add(mesh);
    if(physical)colliders.push({minX:x-w/2,maxX:x+w/2,minY:y-h/2,maxY:y+h/2,minZ:z-d/2,maxZ:z+d/2});
    return mesh;
  }
  function cylinder(x,y,z,r,h,material,physical=false){
    const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,20),material);mesh.position.set(x,y,z);(physical?solid:decor).add(mesh);
    if(physical)colliders.push({minX:x-r,maxX:x+r,minY:y-h/2,maxY:y+h/2,minZ:z-r,maxZ:z+r});
    return mesh;
  }
  function pipe(x,y,z,r,length,axis,material){
    const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,length,10),material);
    mesh.position.set(x,y,z);if(axis==='x')mesh.rotation.z=Math.PI/2;else if(axis==='z')mesh.rotation.x=Math.PI/2;decor.add(mesh);
  }
  // Solid perimeter and clearly readable ground. The opening-looking panels are scenery,
  // while every wall, vat, crate, and catwalk deck uses the same AABB rules as combat.
  box(0,-.3,0,48,.6,50,M.floor);
  box(-23.6,3.5,0,.8,7,50,M.wall,true);box(23.6,3.5,0,.8,7,50,M.wall,true);
  box(0,3.5,-24.6,48,7,.8,M.wall,true);box(0,3.5,24.6,48,7,.8,M.wall,true);
  for(const z of [-20,-12,-4,4,12,20]){
    box(-23.15,5.8,z,.2,.15,2.8,G.cyan);box(23.15,5.8,z,.2,.15,2.8,G.orange);
  }
  for(const x of [-18,-9,0,9,18]){
    box(x,5.8,-24.15,2.6,.15,.2,G.cyan);box(x,5.8,24.15,2.6,.15,.2,G.orange);
  }
  // Conveyor movement and animation share FACTORY_BELTS, so the rendered direction
  // cannot drift away from the movement direction.
  const stripes=[];
  for(const lane of FACTORY_BELTS){
    box(lane.x,.045,0,3.3,.09,35,M.dark);
    box(lane.x-1.7,.16,0,.13,.25,35,M.steel);box(lane.x+1.7,.16,0,.13,.25,35,M.steel);
    const stripeMat=lane.direction<0?G.cyan:G.orange;
    for(let i=0;i<10;i++){
      const mesh=new THREE.Mesh(new THREE.BoxGeometry(2.35,.018,.15),stripeMat);
      mesh.position.set(lane.x,.11,-17+i*3.4);dynamic.add(mesh);stripes.push({mesh,lane,base:i*3.4});
    }
    for(const z of [-17.6,17.6]){box(lane.x,.14,z,3.6,.25,.38,M.yellow);box(lane.x,.29,z,2.9,.06,.12,stripeMat)}
  }
  // The vat is substantial central cover, but both belts and side flanks bypass it.
  cylinder(0,1.28,0,2.5,2.56,M.vat,true);
  cylinder(0,2.65,0,2.7,.2,M.ivory,true);
  cylinder(0,2.8,0,2.04,.09,M.dark);
  for(let i=0;i<8;i++){const a=i*Math.PI/4;cylinder(Math.cos(a)*2.3,2.85,Math.sin(a)*2.3,.1,.13,G.white)}
  for(const z of [-19.6,19.6]){
    cylinder(0,.95,z,1.15,1.9,M.vat,true);cylinder(0,1.97,z,1.27,.16,M.ivory,true);
    box(0,1.15,z,2.8,.12,.1,G.orange);
  }
  // Second floor: two long, fully collidable mezzanines. Ground-level rooms remain
  // traversable underneath, so players can flank below or fight above.
  for(const side of [-1,1]){
    const x=side*15;
    box(x,3.08,0,9,.28,19,M.steel,true); // top at 3.22
    box(x,3.26,0,8.5,.045,18.5,M.edge);
    for(const z of [-8.8,8.8])for(const support of [11.3,18.7]){
      box(side*support,1.46,z,.58,2.92,.58,M.steel,true);
      box(side*support,2.6,z,.64,.11,.64,G.cyan);
    }
    // Waist-high edge cover has intentional gaps at the ladder approaches.
    for(const z of [-5,5])box(side*10.48,3.64,z,.18,.84,5.5,M.edge,true);
    box(side*19.52,3.64,0,.18,.84,18.5,M.edge,true);
    for(const z of [-9.45,9.45])box(x,3.61,z,9,.78,.16,M.edge,true);
    for(const z of [-4.5,4.5]){
      box(side*16.5,3.62,z,1.9,.8,1.45,M.crate,true);
      box(side*16.5,4.06,z,1.98,.06,1.55,G.orange);
    }
    for(const z of [-7.1,7.1]){
      const ladderX=side*10.05;
      ladders.push({x:ladderX,z,bottom:0,top:3.22,exitX:side*12.1,exitZ:z});
      box(ladderX,1.65,z-.43,.12,3.3,.12,M.yellow);
      box(ladderX,1.65,z+.43,.12,3.3,.12,M.yellow);
      for(let y=.4;y<3.2;y+=.47)box(ladderX,y,z,.12,.09,.9,M.ivory);
      box(side*12.1,3.35,z,.8,.08,.8,G.cyan);
    }
    // The next ladder starts on this floor; it cannot be grabbed from the ground.
    const upperX=side*10.05;
    ladders.push({x:upperX,z:0,bottom:3.22,top:6.22,exitX:side*8.25,exitZ:0});
    box(upperX,4.75,-.43,.12,3,.12,M.yellow);
    box(upperX,4.75,.43,.12,3,.12,M.yellow);
    for(let y=3.5;y<6.2;y+=.47)box(upperX,y,0,.12,.09,.9,M.ivory);
    // Lower rooms use staggered machines, not sealed facades or invisible doors.
    box(side*17,.025,0,7.8,.05,17.6,M.edge);
    box(side*17,1.0,-3.1,2.2,2,2.0,M.vat,true);
    box(side*17,1.0,3.1,2.2,2,2.0,M.crate,true);
    box(side*19,.75,0,1.55,1.5,2.4,M.steel,true);
    box(side*19,1.02,0,.09,.58,1.5,G.cyan);
  }
  // Third floor: a high bridge connects the two mezzanines above the vat.
  box(0,6.08,0,19.2,.28,3.1,M.steel,true); // top at 6.22
  for(const z of [-1.62,1.62]){
    for(const x of [-6.5,-2,2,6.5])box(x,6.67,z,3.1,.9,.16,M.edge,true);
    for(const x of [-8.8,8.8])box(x,6.65,z,.14,.85,.14,M.yellow);
  }
  for(const x of [-3.7,3.7]){
    box(x,6.61,0,1.45,.78,1.25,M.dark,true);
    box(x,7.03,0,1.55,.06,1.35,G.orange);
  }
  for(const x of [-8.5,8.5])for(const z of [-1.2,1.2]){
    box(x,4.7,z,.44,2.7,.44,M.steel,true);
    box(x,5.8,z,.5,.09,.5,G.cyan);
  }
  // Denser ground cover: stacked pallets, fermentation tanks and angled consoles.
  // The belt centers and every ladder approach stay clear.
  for(const [x,z,w,d,h] of [
    [-10,-14,2.5,2.2,1.7],[10,14,2.5,2.2,1.7],[-10,13,2.1,2.7,2.1],[10,-13,2.1,2.7,2.1],
    [-15,-15,2.7,2.4,1.3],[15,15,2.7,2.4,1.3],[-15,15,2.7,2.4,1.3],[15,-15,2.7,2.4,1.3],
    [-18,-2,2.3,1.8,1.6],[18,2,2.3,1.8,1.6],[-18,6,1.8,2.3,1.4],[18,-6,1.8,2.3,1.4]
  ]){
    box(x,h/2,z,w,h,d,M.crate,true);
    box(x,h+.06,z,w+.1,.12,d+.1,M.ivory);
    box(x,h*.58,z+d/2+.045,w*.62,.18,.07,G.orange);
  }
  for(const x of [-21.3,21.3]){
    pipe(x,6.4,0,.19,38,'z',M.vat);
    for(const z of [-18,-9,0,9,18]){
      pipe(x,4.3,z,.1,4.3,'y',M.steel);
      box(x,6.25,z,.45,.16,.45,G.white);
    }
  }
  for(const z of [-18.5,18.5]){
    pipe(0,6.85,z,.14,39,'x',M.steel);
    for(const x of [-14,0,14])box(x,6.68,z,2.3,.11,.34,G.white);
  }
  const steam=[];
  for(const zone of FACTORY_STEAM){
    const group=new THREE.Group();group.position.set(zone.x,0,zone.z);dynamic.add(group);
    const material=new THREE.MeshBasicMaterial({color:0xd6f5f1,transparent:true,opacity:.22,depthWrite:false,side:THREE.DoubleSide});
    for(let i=0;i<3;i++){
      const sheet=new THREE.Mesh(new THREE.PlaneGeometry(4.2,3.7),material);
      sheet.position.set((i-1)*.62,1.8,(i-1)*.45);sheet.rotation.y=i*Math.PI/3;group.add(sheet);
    }
    cylinder(zone.x,.25,zone.z,.55,.5,M.steel);
    cylinder(zone.x,.52,zone.z,.34,.08,G.cyan);
    steam.push({group,zone,material});
  }
  // Only rigid architecture goes into shotBlockers. Steam is visual/AI concealment,
  // not an invisible bulletproof wall.
  mergeRigidParts(solid);
  solid.traverse(obj=>{if(obj.isMesh)shotBlockers.push(obj)});
  mergeRigidParts(decor);
  effects={steam,stripes};updateFactoryEffects();
}
