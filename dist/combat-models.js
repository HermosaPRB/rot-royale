import * as THREE from 'three';
import {mergeRigidParts} from './surface-details.js?v=detail-6';

const gunTemplates=new Map();let batTemplate;
export function createHeldGun(color){
  if(!gunTemplates.has(color)){
    const g=new THREE.Group(),paint=new THREE.MeshStandardMaterial({color,roughness:.48}),metal=new THREE.MeshStandardMaterial({color:0x343c3b,roughness:.48});
    const box=(x,y,z,w,h,d,m)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);mesh.position.set(x,y,z);g.add(mesh);return mesh};
    box(.12,1.48,-.55,.14,.13,.56,paint).name='gun-body';
    box(.12,1.47,-.20,.12,.12,.20,metal);
    box(.15,1.365,-.34,.07,.17,.08,metal).rotation.x=.10;
    box(.12,1.36,-.49,.085,.18,.12,metal).rotation.x=-.16;
    box(.12,1.465,-.72,.12,.12,.19,metal);
    box(.12,1.567,-.56,.035,.04,.39,metal);
    const barrel=new THREE.Mesh(new THREE.CylinderGeometry(.022,.022,.24,8),metal);barrel.rotation.x=Math.PI/2;barrel.position.set(.12,1.49,-.93);g.add(barrel);
    g.traverse(m=>{if(m.isMesh){m.castShadow=true;m.userData.noHit=true}});mergeRigidParts(g);gunTemplates.set(color,g);
  }
  const gun=gunTemplates.get(color).clone(true);gun.userData.body=gun.getObjectByName('gun-body');return gun;
}
export function createMeleeBat(){
  if(!batTemplate){
    const shape=[[0,0],[.034,0],[.039,.025],[.025,.055],[.025,.30],[.052,.65],[.085,1.08],[.080,1.23],[.055,1.27],[0,1.28]].map(p=>new THREE.Vector2(...p));
    batTemplate=new THREE.Mesh(new THREE.LatheGeometry(shape,16),new THREE.MeshStandardMaterial({color:0xd48339,roughness:.5}));batTemplate.name='melee-bat';batTemplate.userData.noHit=true;batTemplate.castShadow=true;
  }
  return batTemplate.clone();
}
