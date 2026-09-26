import * as THREE from 'three';
import {mergeRigidParts} from './surface-details.js?v=detail-6';

const gunTemplates=new Map();let batTemplate;
// Shared, material-batched templates: close-up detail is paid for only on the local gun.
export function createHeldGun(color,type='ar',detailed=false){
  if(!['ar','shotgun','sniper','smg'].includes(type))type='ar';
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
    const tube=(x,y,z,r,length,m,parent=g)=>{const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,length,detailed?12:8),m);mesh.rotation.x=Math.PI/2;mesh.position.set(x,y,z);parent.add(mesh);return mesh};
    const profile=(points,width,m)=>{const s=new THREE.Shape();points.forEach(([z,y],i)=>i?s.lineTo(z,y):s.moveTo(z,y));s.closePath();const geo=new THREE.ExtrudeGeometry(s,{depth:width,bevelEnabled:false,steps:1});geo.rotateY(-Math.PI/2);geo.translate(.12+width/2,0,0);const mesh=new THREE.Mesh(geo,m);g.add(mesh);return mesh};
    const long=type==='sniper',pump=type==='shotgun',compact=type==='smg';
    const magazine=new THREE.Group();magazine.name='magazine';magazine.position.set(.12,1.36,compact?-.35:-.50);g.add(magazine);
    const action=new THREE.Group();action.name='action';g.add(action);
    let tip,sightY,sightZ;
    // Four different constructions, not one receiver with four paint jobs.
    if(type==='ar'){
      box(.12,1.475,-.43,.135,.13,.34,metal,true);
      box(.12,1.423,-.44,.141,.07,.25,paint,true);
      tube(.12,1.49,-.78,.028,.86,metal);tip=-1.20;
      box(.12,1.483,-.79,.125,.14,.43,paint,true);
      for(let i=0;i<(detailed?8:5);i++){const z=-.62-i*(detailed?.047:.085);box(.186,1.493,z,.006,.04,.024,metal);box(.054,1.493,z,.006,.04,.024,metal)}
      tube(.12,1.475,-.11,.034,.31,metal);
      profile([[.06,1.53],[-.18,1.53],[-.19,1.47],[-.03,1.39],[.055,1.31]],.10,paint);
      box(.12,1.42,.065,.11,.22,.03,metal,true);
      box(0,-.035,0,.078,.15,.13,metal,true,magazine).rotation.x=-.12;
      box(0,-.15,.029,.078,.105,.128,metal,true,magazine).rotation.x=-.35;
      box(0,-.21,.052,.087,.025,.14,trim,false,magazine);
      sightY=1.625;sightZ=-.37;
    }else if(compact){
      box(.12,1.49,-.43,.15,.19,.30,metal,true);
      box(.12,1.54,-.45,.157,.06,.29,paint,true);
      tube(.12,1.49,-.66,.063,.23,metal);tip=-.875;
      tube(.12,1.49,-.82,.026,.15,metal);
      for(let i=0;i<4;i++)tube(.12,1.49,-.59-i*.046,.067,.013,paint);
      // Folding wire stock and straight magazine through the grip read as a compact SMG.
      for(const x of [.065,.175])box(x,1.48,-.08,.018,.025,.31,trim);
      box(.12,1.445,.073,.13,.13,.025,metal,true);
      box(.03,-.10,.006,.062,.27,.083,metal,true,magazine);box(.03,-.239,.006,.071,.025,.093,trim,false,magazine);
      sightY=1.632;sightZ=-.37;
    }else if(pump){
      tube(.12,1.49,-.445,.067,.33,metal);box(.12,1.437,-.44,.12,.065,.28,metal,true);
      profile([[.08,1.53],[-.26,1.47],[-.32,1.40],[-.22,1.37],[.06,1.24],[.09,1.25]],.10,paint);
      box(.12,1.386,.095,.11,.275,.03,metal,true);
      // One long barrel with a shorter magazine tube underneath.
      tube(.12,1.50,-.98,.034,.85,metal);tip=-1.405;
      tube(.12,1.418,-.845,.029,.58,metal);
      tube(.12,1.442,-.71,.059,.24,paint,action);
      for(let i=0;i<7;i++)tube(.12,1.442,-.61-i*.034,.063,.012,metal,action);
      box(.12,1.538,-.91,.022,.013,.69,trim);
      for(let i=0;i<4;i++)tube(.204,1.473,-.34-i*.047,.015,.035,brass);
      sightY=1.561;sightZ=-.40;
      box(.12,1.552,-1.32,.018,.026,.018,brass); // bead, not a rifle optic
    }else{
      tube(.12,1.49,-.46,.051,.40,metal);
      profile([[.08,1.53],[-.20,1.49],[-.37,1.405],[-.86,1.435],[-.91,1.375],[-.42,1.345],[-.25,1.35],[.07,1.26]],.105,paint);
      box(.12,1.397,.09,.12,.27,.036,metal,true);
      tube(.12,1.50,-1.15,.024,1.10,metal);tip=-1.70;
      box(0,-.018,0,.075,.092,.105,metal,true,magazine);
      // Large objective bell, slender scope tube, turrets and a working bolt handle.
      box(.12,1.595,-.40,.05,.105,.055,metal);box(.12,1.595,-.67,.05,.105,.055,metal);
      tube(.12,1.675,-.54,.042,.37,metal);tube(.12,1.675,-.80,.080,.15,metal);tube(.12,1.675,-.32,.059,.09,metal);
      const lens=new THREE.MeshStandardMaterial({color:0x73b8c5,emissive:0x153c45,emissiveIntensity:.3,roughness:.2,metalness:.15});tube(.12,1.675,-.273,.046,.003,lens);tube(.12,1.675,-.877,.065,.003,lens);
      box(.12,1.741,-.53,.057,.064,.057,metal,true);box(.182,1.678,-.53,.061,.05,.052,trim,true);
      box(.21,1.487,-.30,.13,.019,.019,trim,false,action);const bolt=new THREE.Mesh(new THREE.SphereGeometry(.027,8,6),metal);bolt.position.set(.28,1.477,-.30);action.add(bolt);
      sightY=1.675;sightZ=-.30;
    }
    box(.15,1.365,-.34,.074,.18,.083,metal,true).rotation.x=.14;
    // Open trigger guard, not a solid block around the trigger hand.
    box(.15,1.32,-.405,.024,.018,.095,trim);box(.15,1.365,-.445,.024,.09,.018,trim);
    box(.15,1.408,-.395,.019,.049,.015,brass).rotation.x=-.3;
    if(!long&&!pump){
      box(.12,sightY-.057,-.52,.036,.022,compact?.22:.60,metal);
      // SMG gets a quick open notch; AR gets a taller aperture sight.
      for(const x of [.081,.159])box(x,sightY-.01,sightZ,.014,.067,.023,metal);
      if(!compact)box(.12,sightY+.025,sightZ,.092,.012,.023,metal);
      const front=compact?-.745:-.98;
      box(.12,sightY-.032,front,.016,.045,.021,metal);box(.12,sightY-.006,front,.012,.009,.022,brass);
    }
    tube(.12,pump?1.50:1.49,tip,.035,.055,metal);tube(.12,pump?1.50:1.49,tip-.029,.027,.003,trim);tube(.12,pump?1.50:1.49,tip-.031,.018,.004,metal);
    box(.204,1.513,-.43,.013,.045,.09,metal);box(.216,1.5,-.405,.024,.023,.04,trim,true);
    if(detailed){
      if(!pump&&!long)for(let i=0;i<(compact?4:9);i++)box(.12,sightY-.038,-.45-i*.04,.057,.014,.009,trim);
      for(const z of [-.34,-.53]){const screw=new THREE.Mesh(new THREE.CylinderGeometry(.009,.009,.009,6),trim);screw.rotation.z=Math.PI/2;screw.position.set(.206,1.47,z);g.add(screw)}
      // Espresso-gold receiver inlay; no extra texture or draw call.
      box(.192,1.46,-.465,.007,.013,.058,brass);
    }
    const muzzle=new THREE.Object3D();muzzle.name='muzzle';muzzle.position.set(.12,1.49,tip-.07);g.add(muzzle);
    const sight=new THREE.Object3D();sight.name='sight';sight.position.set(.12,sightY,sightZ);g.add(sight);
    if(!detailed)for(const group of [magazine,action])for(const part of [...group.children]){part.position.add(group.position);g.add(part)}
    g.traverse(m=>{if(m.isMesh){m.castShadow=true;m.userData.noHit=true}});mergeRigidParts(g);gunTemplates.set(key,g);
  }
  const gun=gunTemplates.get(key).clone(true);
  gun.userData.magazine=gun.getObjectByName('magazine');gun.userData.muzzle=gun.getObjectByName('muzzle');gun.userData.sight=gun.getObjectByName('sight');gun.userData.action=gun.getObjectByName('action');return gun;
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
