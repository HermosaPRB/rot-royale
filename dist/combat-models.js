import * as THREE from 'three';
import {mergeRigidParts} from './surface-details.js?v=detail-6';

const gunTemplates=new Map();let batTemplate;
// Shared, material-batched templates: close-up detail is paid for only on the local gun.
export function createHeldGun(color,type='ar',detailed=false){
  const key=`${color}:${type}:${detailed}`;
  if(!gunTemplates.has(key)){
    const g=new THREE.Group(),paint=new THREE.MeshStandardMaterial({color,roughness:.38,metalness:.22}),
      metal=new THREE.MeshStandardMaterial({color:0x40515b,roughness:.38,metalness:.3}),
      trim=new THREE.MeshStandardMaterial({color:0x91a3aa,roughness:.3,metalness:.4}),
      brass=new THREE.MeshStandardMaterial({color:0xffce72,roughness:.36,metalness:.4});
    const box=(x,y,z,w,h,d,m,bevel=false,parent=g)=>{
      let geometry;
      if(bevel){const s=new THREE.Shape(),r=.009;s.moveTo(-w/2+r,-h/2+r);s.lineTo(w/2-r,-h/2+r);s.lineTo(w/2-r,h/2-r);s.lineTo(-w/2+r,h/2-r);s.closePath();geometry=new THREE.ExtrudeGeometry(s,{depth:d-2*r,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:r,bevelThickness:r});geometry.translate(0,0,-d/2+r)}else geometry=new THREE.BoxGeometry(w,h,d);
      const mesh=new THREE.Mesh(geometry,m);mesh.position.set(x,y,z);parent.add(mesh);return mesh;
    };
    const tube=(x,y,z,r,length,m,segments=detailed?12:8)=>{const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,length,segments),m);mesh.rotation.x=Math.PI/2;mesh.position.set(x,y,z);g.add(mesh);return mesh};
    const long=type==='sniper',pump=type==='shotgun',compact=type==='smg';
    box(.12,1.49,-.45,.16,.16,compact?.31:.39,paint,true).name='gun-body';
    box(.12,1.47,-.17,.11,.125,.23,metal,true);
    box(.12,1.455,-.045,.12,.17,.038,metal,true);
    box(.15,1.365,-.34,.074,.18,.083,metal,true).rotation.x=.14;
    // Open trigger guard, not a solid block around the trigger hand.
    box(.15,1.32,-.405,.024,.018,.095,trim);box(.15,1.365,-.445,.024,.09,.018,trim);
    box(.15,1.408,-.395,.019,.049,.015,brass).rotation.x=-.3;
    const magazine=new THREE.Group();magazine.name='magazine';magazine.position.set(.12,1.36,-.50);g.add(magazine);
    if(!pump){box(0,-.025,0,.085,compact?.24:.19,.12,metal,true,magazine).rotation.x=compact?-.04:-.17;box(0,-.13,.012,.093,.027,.13,trim,false,magazine)}
    box(.12,1.475,-.69,.13,.125,pump?.27:compact?.20:.30,pump?metal:paint,true);
    const tip=long?-1.29:pump?-1.08:compact?-.91:-1.06;
    tube(.12,1.49,(tip-.80)/2,.024,-.80-tip,metal);
    tube(.12,1.49,tip,.042,.095,metal);tube(.12,1.49,tip-.049,.027,.003,trim);
    tube(.12,1.49,tip-.052,.018,.004,metal); // dark recessed muzzle
    if(pump){tube(.12,1.417,-.87,.025,.38,metal);for(let i=0;i<6;i++)box(.12,1.473,-.58-i*.033,.142,.13,.012,trim)}
    else for(let i=0;i<(detailed?6:3);i++){
      const z=-.58-i*(detailed?.036:.07);box(.188,1.495,z,.008,.031,.021,metal);box(.052,1.495,z,.008,.031,.021,metal);
    }
    box(.12,1.584,-.51,.045,.025,.39,metal);
    if(long){
      box(.12,1.632,-.46,.045,.085,.055,metal);box(.12,1.632,-.66,.045,.085,.055,metal);
      tube(.12,1.697,-.57,.047,.31,metal);tube(.12,1.697,-.755,.069,.11,metal);tube(.12,1.697,-.38,.064,.08,metal);
      const lens=new THREE.MeshStandardMaterial({color:0x65d5d2,emissive:0x154b52,emissiveIntensity:.45,metalness:.6,roughness:.16});tube(.12,1.697,-.337,.048,.003,lens);tube(.12,1.697,-.812,.05,.003,lens);
      box(.176,1.7,-.55,.045,.042,.05,trim,true);
    }else{
      // A genuinely open rear sight keeps the sight picture readable from behind.
      box(.081,1.624,-.4,.014,.075,.026,metal);box(.159,1.624,-.4,.014,.075,.026,metal);box(.12,1.657,-.4,.092,.012,.026,metal);
      box(.12,1.593,-.386,.032,.008,.004,brass);
      box(.12,1.602,-.79,.027,.08,.025,metal);box(.12,1.647,-.79,.017,.012,.026,brass);
    }
    box(.204,1.513,-.43,.013,.045,.09,metal);box(.216,1.5,-.405,.024,.023,.04,trim,true);
    if(detailed){
      for(let i=0;i<7;i++)box(.12,1.602,-.45-i*.035,.067,.014,.009,trim);
      for(const z of [-.34,-.53]){const screw=new THREE.Mesh(new THREE.CylinderGeometry(.009,.009,.009,6),trim);screw.rotation.z=Math.PI/2;screw.position.set(.206,1.47,z);g.add(screw)}
      // Espresso-gold receiver inlay; no extra texture or draw call.
      box(.205,1.46,-.465,.007,.013,.058,brass);box(.12,1.532,-.17,.113,.017,.12,paint);
    }
    const muzzle=new THREE.Object3D();muzzle.name='muzzle';muzzle.position.set(.12,1.49,tip-.07);g.add(muzzle);
    if(!detailed)for(const part of [...magazine.children]){part.position.add(magazine.position);g.add(part)}
    g.traverse(m=>{if(m.isMesh){m.castShadow=true;m.userData.noHit=true}});mergeRigidParts(g);gunTemplates.set(key,g);
  }
  const gun=gunTemplates.get(key).clone(true);
  gun.userData.magazine=gun.getObjectByName('magazine');gun.userData.muzzle=gun.getObjectByName('muzzle');return gun;
}

export function createFirstPersonWeapon(color,type){
  const rig=new THREE.Group(),gun=createHeldGun(color,type,true);rig.add(gun);rig.userData.gun=gun;rig.position.set(.16,-.06,-.28);rig.rotation.y=.20;
  gun.position.set(.16,-1.74,-.32);
  const skin=new THREE.MeshStandardMaterial({color:0xd8954d,roughness:.56});
  for(const [name,a,b] of [['trigger',[.55,-.7,-.02],[.31,-.375,-.66]],['support',[-.3,-.7,-.04],[.24,-.29,-.96]]]){
    const arm=new THREE.Group();arm.name=name;rig.add(arm);const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),delta=end.clone().sub(start);
    const forearm=new THREE.Mesh(new THREE.CylinderGeometry(.047,.068,delta.length(),10),skin);forearm.position.copy(start).add(end).multiplyScalar(.5);forearm.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());arm.add(forearm);
    const palm=new THREE.Mesh(new THREE.SphereGeometry(1,12,8),skin);palm.position.copy(end);palm.scale.set(.059,.063,.07);arm.add(palm);
    for(let i=0;i<4;i++){const finger=new THREE.Mesh(new THREE.CapsuleGeometry(.013,.047,2,6),skin);finger.position.copy(end).add(new THREE.Vector3(.015,-.03+i*.019,-.045));finger.rotation.z=Math.PI/2;arm.add(finger)}
    mergeRigidParts(arm);rig.userData[name]=arm;
  }
  const flash=new THREE.Mesh(new THREE.ConeGeometry(.07,.19,5),new THREE.MeshBasicMaterial({color:0xffdf92,transparent:true,opacity:.85,depthWrite:false}));flash.rotation.x=-Math.PI/2;flash.position.z=-.07;gun.userData.muzzle.add(flash);flash.visible=false;rig.userData.flash=flash;
  rig.traverse(m=>{if(m.isMesh){m.castShadow=false;m.userData.noHit=true}});return rig;
}
export function createMeleeBat(){
  if(!batTemplate){
    const shape=[[0,0],[.034,0],[.039,.025],[.025,.055],[.025,.30],[.052,.65],[.085,1.08],[.080,1.23],[.055,1.27],[0,1.28]].map(p=>new THREE.Vector2(...p));
    batTemplate=new THREE.Mesh(new THREE.LatheGeometry(shape,16),new THREE.MeshStandardMaterial({color:0xd48339,roughness:.5}));batTemplate.name='melee-bat';batTemplate.userData.noHit=true;batTemplate.castShadow=true;
  }
  return batTemplate.clone();
}
