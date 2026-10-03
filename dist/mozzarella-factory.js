import * as THREE from 'three';
import { mergeRigidParts } from './surface-details.js?v=detail-6';

// The two lanes are deliberately opposite: neither spawn gets a permanent speed advantage.
export const FACTORY_BELTS=[{x:-6.5,direction:-1,color:0x55d9ed},{x:6.5,direction:1,color:0xffb65e}];
export const FACTORY_STEAM=[{x:-6.5,z:-11,phase:0},{x:6.5,z:11,phase:3900}];
const STEAM_PERIOD=8000,STEAM_DURATION=1900;
let effects=null;

export function factoryConveyorAt(x,z,foot=0){
  if(Math.abs(foot)>.22||Math.abs(z)>23.5)return 0;
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
    const travel=(base+now*.006*lane.direction)%44;
    mesh.position.z=-22+((travel+44)%44);
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
  box(0,-.3,0,68,.6,70,M.floor);
  box(-33.25,2.3,0,.9,4.6,70,M.wall,true);box(33.25,2.3,0,.9,4.6,70,M.wall,true);
  box(0,2.3,-34,68,4.6,.9,M.wall,true);box(0,2.3,34,68,4.6,.9,M.wall,true);
  for(const z of [-27,-18,-9,0,9,18,27]){
    box(-32.7,4.25,z,.2,.15,2.8,G.cyan);box(32.7,4.25,z,.2,.15,2.8,G.orange);
  }
  for(const x of [-26,-13,0,13,26]){
    box(x,4.25,-33.5,3,.15,.2,G.cyan);box(x,4.25,33.5,3,.15,.2,G.orange);
  }
  // Conveyor movement and animation share FACTORY_BELTS, so the rendered direction
  // cannot drift away from the movement direction.
  const stripes=[];
  for(const lane of FACTORY_BELTS){
    box(lane.x,.045,0,3.65,.09,47,M.dark);
    box(lane.x-1.9,.16,0,.13,.25,47,M.steel);box(lane.x+1.9,.16,0,.13,.25,47,M.steel);
    const stripeMat=lane.direction<0?G.cyan:G.orange;
    for(let i=0;i<12;i++){
      const mesh=new THREE.Mesh(new THREE.BoxGeometry(2.65,.018,.15),stripeMat);
      mesh.position.set(lane.x,.11,-22+i*3.7);dynamic.add(mesh);stripes.push({mesh,lane,base:i*3.7});
    }
    for(const z of [-24,24]){box(lane.x,.14,z,3.9,.25,.38,M.yellow);box(lane.x,.29,z,3.2,.06,.12,stripeMat)}
  }
  // The vat is substantial central cover, but both belts and side flanks bypass it.
  cylinder(0,1.36,0,3.1,2.72,M.vat,true);
  cylinder(0,2.8,0,3.32,.24,M.ivory,true);
  cylinder(0,2.99,0,2.55,.11,M.dark);
  for(let i=0;i<8;i++){const a=i*Math.PI/4;cylinder(Math.cos(a)*2.82,3.03,Math.sin(a)*2.82,.12,.14,G.white)}
  for(const z of [-15,15]){
    cylinder(0,.95,z,1.35,1.9,M.vat,true);cylinder(0,1.97,z,1.48,.16,M.ivory,true);
    box(0,1.15,z,2.8,.12,.1,G.orange);
  }
  // The elevated bridge can be climbed from either side. Rails are real cover; gaps
  // are left at the ladder exits to avoid invisible blockers at the top.
  box(0,4.1,0,23.5,.32,3.8,M.steel,true);
  for(const z of [-2.0,2.0]){
    for(const x of [-8,-4,0,4,8])box(x,4.63,z,3.2,.68,.16,M.edge,true);
    for(const x of [-11,11])box(x,4.7,z,.15,.92,.15,M.edge);
  }
  for(const x of [-10.8,10.8])for(const z of [-1.65,1.65]){
    box(x,2.0,z,.62,4,.62,M.steel,true);box(x,2.4,z,.64,.11,.64,G.cyan);
  }
  for(const side of [-1,1]){
    const x=side*12.3;
    ladders.push({x,z:0,bottom:0,top:4.26,exitX:side*10.2,exitZ:0});
    box(x,2.1,-.4,.12,4.2,.12,M.yellow);box(x,2.1,.4,.12,4.2,.12,M.yellow);
    for(let y=.45;y<4.2;y+=.48)box(x,y,0,.12,.095,.85,M.ivory);
    box(x,4.55,0,1.5,.14,1.25,G.cyan);
  }
  // Four offset production bays form safer but slower flanks, with broad entrances.
  for(const side of [-1,1])for(const row of [-1,1]){
    const x=side*22,z=row*13;
    box(x,.025,z,12,.05,13,M.edge);
    box(x+side*6.1,1.55,z,.55,3.1,12,M.wall,true);
    box(x,1.55,z+row*6.35,12,3.1,.55,M.wall,true);
    box(x,3.38,z,12,.22,13,M.dark,true);
    box(x,3.55,z,10,.06,.28,row<0?G.cyan:G.orange);
    box(x-side*2.6,.68,z-row*1.2,2.6,1.36,2.2,M.crate,true);
    box(x+side*2.5,.5,z+row*1.5,2.1,1.0,1.9,M.vat,true);
    box(x+side*2.5,1.06,z+row*1.5,2.2,.1,2,G.white);
    box(x-side*3,1.75,z+row*4,1.5,1.7,.55,M.steel,true);
    box(x-side*3,1.88,z+row*3.7,.85,.75,.07,G.cyan);
  }
  // Mid-height machinery creates cover without closing the central sightlines.
  for(const [x,z,turn] of [[-13,-10,0],[13,10,0],[-13,10,1],[13,-10,1]]){
    box(x,.9,z,turn?2.4:1.7,1.8,turn?1.7:2.4,M.steel,true);
    box(x,1.84,z,turn?2.6:1.9,.12,turn?1.9:2.6,M.ivory);
    box(x,1.1,z+(turn?.88:1.23),.6,.4,.07,G.orange);
  }
  for(const x of [-28,28]){
    pipe(x,4.4,0,.22,55,'z',M.vat);
    for(const z of [-25,-15,-5,5,15,25]){
      pipe(x,2.9,z,.12,2.9,'y',M.steel);
      box(x,4.15,z,.5,.2,.5,G.white);
    }
  }
  for(const z of [-21,21]){
    pipe(0,5.2,z,.15,50,'x',M.steel);
    for(const x of [-15,0,15])box(x,5.03,z,2.4,.12,.4,G.white);
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
