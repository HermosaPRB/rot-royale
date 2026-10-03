import * as THREE from 'three';
import {mergeRigidParts} from './surface-details.js?v=detail-6';

// Low-poly procedural models for the airdrop event and its two special weapons.
const std=(color,roughness=.5,metalness=.15,extra={})=>new THREE.MeshStandardMaterial({color,roughness,metalness,...extra});
const glow=(color,opacity=1,extra={})=>new THREE.MeshBasicMaterial({color,transparent:opacity<1,opacity,depthWrite:opacity>=1,...extra});
function box(parent,material,x,y,z,w,h,d,rx=0,ry=0,rz=0){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);m.position.set(x,y,z);m.rotation.set(rx,ry,rz);parent.add(m);return m}
// Cylinder lying along Z; `back` is the radius at +Z, `front` the radius at -Z.
function tubeZ(parent,material,x,y,z,back,front,length,segments=12){const m=new THREE.Mesh(new THREE.CylinderGeometry(back,front,length,segments),material);m.rotation.x=Math.PI/2;m.position.set(x,y,z);parent.add(m);return m}
function ball(parent,material,x,y,z,r,sx=1,sy=1,sz=1,segments=12){const m=new THREE.Mesh(new THREE.SphereGeometry(r,segments,Math.max(6,segments*.7|0)),material);m.position.set(x,y,z);m.scale.set(sx,sy,sz);parent.add(m);return m}
function rod(parent,material,a,b,r=.02){const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),delta=end.clone().sub(start),m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,delta.length(),5),material);m.position.copy(start).add(end).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());parent.add(m);return m}
function finish(group,shadows=true){group.traverse(m=>{if(m.isMesh){m.castShadow=shadows;m.userData.noHit=true}});mergeRigidParts(group);return group}

let planeTemplate;
// Dino-nosed cargo plane. Nose points to -Z; about 13m long with a 17m wingspan.
export function createDinoPlane(){
  if(!planeTemplate){
    const g=new THREE.Group(),olive=std(0x6d7a3b,.6),camo=std(0x4c5728,.7),tan=std(0x9c9a62,.7),silver=std(0xc8ced4,.32,.65),dark=std(0x22262c,.5,.4),
      glass=std(0x9fd3ea,.12,.3,{emissive:0x1d4656,emissiveIntensity:.25}),scales=std(0x5a9a38,.55),belly=std(0xcdbd86,.6),mouth=std(0xc9535e,.6),
      tooth=std(0xf6f1e4,.35),eye=std(0xffc928,.3,0,{emissive:0x5a3c00,emissiveIntensity:.35}),black=std(0x111111,.4),podGreen=std(0x6c8f3a,.45,.2),
      yellow=std(0xf0c23a,.45),red=glow(0xff2b2b),white=std(0xf4f4f4,.5);
    tubeZ(g,olive,0,0,0,1.0,1.0,10,14);tubeZ(g,olive,0,.18,7,.32,1.0,4,14);
    for(const [x,y,z,w,d,m] of [[.35,.92,-1.5,1.1,1.6,camo],[-.4,.9,1.8,1.3,1.2,camo],[0,.97,3.8,.9,1.4,tan],[.2,.95,-3.9,.8,.9,tan],[-.5,.88,-.2,.7,1.0,tan]])box(g,m,x,y,z,w,.12,d);
    ball(g,glass,0,.78,-3.5,.82,1,.62,1.35);
    for(let i=0;i<5;i++)for(const s of [-1,1])box(g,dark,s*.98,.28,-1.4+i*1.05,.06,.32,.42);
    box(g,dark,1.0,-.1,2.6,.05,1.05,.6);
    // Dinosaur head: skull, angry brow, open jaw with pink mouth and white cone teeth.
    box(g,scales,0,.25,-5.6,1.75,1.5,2.0);box(g,scales,0,.38,-7.45,1.3,.62,2.3,-.1);box(g,belly,0,-.62,-7.15,1.2,.34,2.0,.34);
    box(g,mouth,0,-.2,-7.05,1.05,.42,1.75,.12);
    for(let i=0;i<6;i++)for(const s of [-1,1]){const up=new THREE.Mesh(new THREE.ConeGeometry(.075,.26,5),tooth);up.position.set(s*.5,.03,-6.55-i*.36);up.rotation.x=Math.PI;g.add(up);const low=new THREE.Mesh(new THREE.ConeGeometry(.065,.22,5),tooth);low.position.set(s*.47,-.37+i*.02,-6.45-i*.33);g.add(low)}
    for(const s of [-1,1]){ball(g,eye,s*.74,.72,-6.25,.22,1,1,.9);ball(g,black,s*.88,.74,-6.3,.09);box(g,scales,s*.66,.97,-6.2,.42,.14,.62,.2,0,s*-.35);ball(g,black,s*.28,.62,-8.55,.07)}
    for(let i=0;i<5;i++)box(g,scales,0,1.06-i*.03,-4.9-i*.42,.18,.2,.26,.2);
    // Silver wings with black speckled tip bands, twin engines and green props.
    box(g,silver,0,-.12,-.8,17,.22,2.3);
    for(const s of [-1,1]){box(g,dark,s*6.1,-.12,-.8,2.6,.24,2.32);for(let i=0;i<9;i++)box(g,white,s*(5.0+(i*.29)%2.2),0,-1.7+(i*.47)%1.8,.09,.03,.09)}
    const props=[];
    for(const s of [-1,1]){
      tubeZ(g,dark,s*3.6,-.28,-1.5,.55,.68,3.0,12);
      const ring=new THREE.Mesh(new THREE.TorusGeometry(.66,.07,6,14),silver);ring.position.set(s*3.6,-.28,-3.0);g.add(ring);
      const prop=new THREE.Group();prop.name='prop';prop.position.set(s*3.6,-.28,-3.22);g.add(prop);
      const spinner=new THREE.Mesh(new THREE.ConeGeometry(.26,.55,10),scales);spinner.rotation.x=-Math.PI/2;spinner.position.z=-.22;prop.add(spinner);
      for(let i=0;i<3;i++){const blade=new THREE.Group();blade.rotation.z=i*Math.PI*2/3;prop.add(blade);box(blade,scales,0,.75,0,.3,1.4,.05);box(blade,yellow,0,1.5,0,.3,.22,.055)}
      const blur=new THREE.Mesh(new THREE.CircleGeometry(1.6,20),glow(0xfff2a8,.16,{side:THREE.DoubleSide}));blur.position.copy(prop.position);blur.position.z-=.02;g.add(blur);props.push(prop);
    }
    box(g,silver,0,.32,8.5,6.2,.14,1.4);box(g,olive,0,1.75,8.45,.16,2.6,1.7,-.32);box(g,dark,0,2.95,8.85,.18,.3,.8,-.32);
    // Belly bomb pod: green with yellow bands and a glowing red tip. The crate drops from here.
    for(const s of [-1,1])box(g,olive,s*.3,-1.12,-1.5,.08,.5,.9);box(g,olive,0,-1.36,-1.5,.7,.08,1.0);
    tubeZ(g,podGreen,0,-1.72,-1.5,.38,.46,2.3,12);tubeZ(g,yellow,0,-1.72,-1.0,.47,.47,.16,12);tubeZ(g,yellow,0,-1.72,-2.05,.47,.47,.16,12);
    ball(g,red,0,-1.72,-2.75,.3,1,1,1.3);
    finish(g,false);planeTemplate=g;
  }
  const plane=planeTemplate.clone(true);plane.userData.props=[];plane.traverse(o=>{if(o.name==='prop')plane.userData.props.push(o)});return plane;
}

let crateTemplate;
// Supply crate, origin at the bottom center. The lid is its own group so it can pop off.
export function createSupplyCrate(){
  if(!crateTemplate){
    const g=new THREE.Group(),olive=std(0x56662f,.65),frame=std(0x343e1f,.55,.25),yellow=std(0xf2c230,.5),black=std(0x16181a,.5),light=glow(0xff8a1e),metal=std(0x9aa3a8,.35,.6);
    box(g,olive,0,.45,0,1.2,.88,1.2);
    for(const x of [-.6,.6])for(const z of [-.6,.6])box(g,frame,x,.45,z,.1,.92,.1);
    for(const y of [.03,.86]){box(g,frame,0,y,-.6,1.24,.07,.07);box(g,frame,0,y,.6,1.24,.07,.07);box(g,frame,-.6,y,0,.07,.07,1.24);box(g,frame,.6,y,0,.07,.07,1.24)}
    box(g,yellow,0,.45,0,1.215,.2,1.215);
    for(let i=0;i<5;i++){const o=-.44+i*.22;box(g,black,o,.45,.612,.07,.24,.01,0,0,.7);box(g,black,o,.45,-.612,.07,.24,.01,0,0,.7);box(g,black,.612,.45,o,.01,.24,.07,.7);box(g,black,-.612,.45,o,.01,.24,.07,.7)}
    for(const s of [-1,1])box(g,metal,s*.63,.62,0,.04,.08,.36);
    const lid=new THREE.Group();lid.name='lid';lid.position.y=.9;g.add(lid);
    box(lid,frame,0,.03,0,1.26,.07,1.26);box(lid,light,0,.12,0,.26,.12,.26);box(lid,yellow,0,.075,0,.5,.02,.08);box(lid,yellow,0,.075,0,.08,.02,.5);
    finish(g);crateTemplate=g;
  }
  const crate=crateTemplate.clone(true);crate.userData.lid=crate.getObjectByName('lid');return crate;
}

// Striped canopy with rope lines; origin at the crate's top center.
export function createParachute(){
  const g=new THREE.Group(),orange=std(0xff7a2a,.7,0,{side:THREE.DoubleSide}),white=std(0xf5efe6,.7,0,{side:THREE.DoubleSide}),rope=std(0x2d2a26,.8);
  const R=2.2,theta=Math.PI*.42,H=2.9,centerY=H-R*Math.cos(theta),rimR=R*Math.sin(theta);
  for(let i=0;i<8;i++){const wedge=new THREE.Mesh(new THREE.SphereGeometry(R,3,6,i*Math.PI/4,Math.PI/4,0,theta),i%2?white:orange);wedge.position.y=centerY;g.add(wedge)}
  for(let i=0;i<4;i++){const a=Math.PI/4+i*Math.PI/2;rod(g,rope,[Math.cos(a)*.8,0,Math.sin(a)*.8],[Math.cos(a)*rimR,H,Math.sin(a)*rimR],.012)}
  return finish(g,true);
}

// Tall additive light pillar so the landed crate is visible across the map.
export function createBeacon(){
  const g=new THREE.Group();
  const outer=new THREE.Mesh(new THREE.CylinderGeometry(.45,.45,46,16,1,true),glow(0xff8a2a,.22,{blending:THREE.AdditiveBlending,side:THREE.DoubleSide}));outer.position.y=23;g.add(outer);
  const core=new THREE.Mesh(new THREE.CylinderGeometry(.12,.12,46,8,1,true),glow(0xffd29a,.55,{blending:THREE.AdditiveBlending}));core.position.y=23;g.add(core);
  g.traverse(m=>{if(m.isMesh)m.userData.noHit=true});g.userData.outer=outer;return g;
}

const specialTemplates=new Map();
// Special guns share the held-gun frame: barrel axis y≈1.49 at x=.12, pistol grip at z=-.34, muzzle toward -Z.
export function createSpecialGun(type,detailed=false){
  const key=type+':'+detailed;
  if(!specialTemplates.has(key)){
    const g=new THREE.Group(),seg=detailed?14:8;
    const magazine=new THREE.Group();magazine.name='magazine';magazine.position.set(.12,1.36,-.5);g.add(magazine);
    const action=new THREE.Group();action.name='action';g.add(action);
    let muzzleZ,sightY,sightZ;
    if(type==='rpg'){
      const olive=std(0x56613a,.62,.1),dark=std(0x30342e,.5,.35),wood=std(0x9a6a3a,.7),tan=std(0x7f8c4c,.55),grip=std(0x23262a,.6);
      tubeZ(g,olive,.12,1.50,-.30,.072,.072,1.25,seg);
      tubeZ(g,dark,.12,1.50,.44,.115,.074,.24,seg);
      tubeZ(g,dark,.12,1.50,-.94,.088,.088,.06,seg);
      tubeZ(g,wood,.12,1.50,-.36,.084,.084,.36,seg);
      for(const z of [-.62,-.08])tubeZ(g,dark,.12,1.50,z,.078,.078,.025,seg);
      const warhead=new THREE.Group();warhead.name='warhead';g.add(warhead);
      tubeZ(warhead,tan,.12,1.50,-1.05,.05,.108,.22,seg);
      const nose=new THREE.Mesh(new THREE.ConeGeometry(.108,.34,seg),tan);nose.rotation.x=-Math.PI/2;nose.position.set(.12,1.50,-1.33);warhead.add(nose);
      tubeZ(warhead,dark,.12,1.50,-1.17,.11,.11,.03,seg);
      box(g,grip,.15,1.365,-.34,.07,.18,.08,.14);box(g,dark,.15,1.32,-.405,.024,.018,.095);box(g,dark,.15,1.408,-.395,.019,.049,.015,-.3);
      box(g,grip,.12,1.39,-.64,.06,.16,.07,.1);
      box(g,dark,.12,1.585,-.16,.05,.06,.02);box(g,dark,.12,1.59,-.82,.015,.07,.02);box(g,dark,.04,1.53,-.45,.07,.08,.14);
      muzzleZ=-.98;sightY=1.60;sightZ=-.30;
    }else{
      const porcelain=std(0xefebe3,.24,.05),chip=std(0x8a5b2c,.8),yellow=std(0xf2c12e,.45),black=std(0x18191c,.5),metal=std(0x6b7178,.35,.65),
        rubber=std(0x1d1d21,.85),blue=glow(0x48c4ff),water=glow(0x46b8ff,.82),trigger=std(0xd8262b,.4),skin=std(0xe2a77c,.55),hair=std(0x1a1410,.7),
        eyeWhite=std(0xf8f8f8,.3),iris=std(0x3a8fd6,.3),teeth=std(0xfbf8f0,.3),lips=std(0x5a1d1d,.6),gold=std(0xe2a92b,.35,.5);
      tubeZ(g,porcelain,.12,1.49,-.55,.112,.118,.76,seg);
      box(g,porcelain,.12,1.47,-.06,.2,.21,.36);
      for(const [x,y,z] of [[.235,1.53,-.42],[.0,1.45,-.7],[.2,1.41,-.15],[.06,1.58,-.3]])box(g,chip,x,y,z,.035,.02,.03);
      for(const z of [-.76,-.31]){tubeZ(g,yellow,.12,1.49,z,.121,.121,.055,seg);for(let i=0;i<3;i++)box(g,black,.24,1.49-.06+i*.06,z,.006,.02,.055,0,0,.6)}
      const ring=new THREE.Mesh(new THREE.TorusGeometry(.13,.035,6,seg),metal);ring.position.set(.12,1.49,-.95);g.add(ring);
      for(let i=0;i<6;i++){const a=i*Math.PI/3;box(g,metal,.12+Math.cos(a)*.155,1.49+Math.sin(a)*.155,-.95,.05,.05,.07,0,0,a)}
      const vortex=new THREE.Group();vortex.name='vortex';vortex.position.set(.12,1.49,-.965);g.add(vortex);
      const disc=new THREE.Mesh(new THREE.CircleGeometry(.112,seg),glow(0x2f9df0));disc.rotation.y=Math.PI;vortex.add(disc);
      const swirl=glow(0xbff0ff);for(let i=0;i<3;i++){const arm=new THREE.Mesh(new THREE.TorusGeometry(.055+i*.018,.007,4,10,Math.PI*.9),swirl);arm.rotation.z=i*2.1;arm.position.z=-.002;vortex.add(arm)}
      for(const s of [-1,1])box(g,blue,.12+s*.118,1.5,-.55,.008,.04,.12);
      box(g,gold,.232,1.47,-.06,.006,.05,.07);
      box(g,rubber,.15,1.365,-.34,.075,.19,.085,.14);box(g,rubber,.12,1.38,-.64,.065,.17,.075,.1);
      box(g,metal,.15,1.32,-.405,.026,.018,.1);box(g,trigger,.15,1.408,-.395,.02,.05,.016,-.3);
      const canisters=new THREE.Group();canisters.name='canisters';g.add(canisters);
      for(const s of [-1,1]){const x=.12+s*.14;const tank=new THREE.Mesh(new THREE.CylinderGeometry(.036,.036,.15,seg),water);tank.position.set(x,1.585,-.1);canisters.add(tank);for(const y of [1.505,1.665]){const cap=new THREE.Mesh(new THREE.CylinderGeometry(.042,.042,.02,seg),metal);cap.position.set(x,y,-.1);g.add(cap)}
        const hose=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(x,1.5,-.08),new THREE.Vector3(x+s*.04,1.44,-.16),new THREE.Vector3(.12+s*.11,1.46,-.3)]),8,.014,5),rubber);g.add(hose)}
      const bowl=new THREE.Mesh(new THREE.CylinderGeometry(.115,.075,.13,seg),porcelain);bowl.position.set(.12,1.635,-.2);g.add(bowl);
      const seat=new THREE.Mesh(new THREE.TorusGeometry(.098,.022,6,seg),porcelain);seat.rotation.x=Math.PI/2;seat.position.set(.12,1.705,-.2);g.add(seat);
      const lid=new THREE.Mesh(new THREE.CylinderGeometry(.12,.12,.03,seg),porcelain);lid.rotation.x=Math.PI/2;lid.scale.set(1,1,1.35);lid.position.set(.12,1.8,-.34);g.add(lid);
      const head=new THREE.Group();head.name='head';head.position.set(.12,1.70,-.2);head.userData.baseY=1.70;g.add(head);
      const neck=new THREE.Mesh(new THREE.CylinderGeometry(.028,.032,.1,8),skin);neck.position.y=.04;head.add(neck);
      // The face looks back at whoever is holding it.
      ball(head,skin,0,.13,0,.072,1,1.18,.95,seg);ball(head,hair,0,.185,-.008,.068,1.03,.62,1,seg);
      for(const s of [-1,1]){ball(head,eyeWhite,s*.027,.15,.06,.017);ball(head,iris,s*.027,.15,.074,.008)}
      box(head,lips,0,.098,.064,.07,.028,.012);box(head,teeth,0,.1,.069,.062,.013,.008);
      muzzleZ=-1.0;sightY=1.90;sightZ=-.30;
    }
    const muzzle=new THREE.Object3D();muzzle.name='muzzle';muzzle.position.set(.12,1.49,muzzleZ);g.add(muzzle);
    const sight=new THREE.Object3D();sight.name='sight';sight.position.set(.12,sightY,sightZ);g.add(sight);
    finish(g,true);specialTemplates.set(key,g);
  }
  const gun=specialTemplates.get(key).clone(true);
  for(const name of ['magazine','muzzle','sight','action','warhead','vortex','head','canisters'])gun.userData[name]=gun.getObjectByName(name);
  gun.userData.special=type;return gun;
}
// Per-frame flourishes: the RPG loads a visible warhead, the toilet gun spins its vortex and bobs its head.
export function animateSpecialGun(gun,{now,ammo=1,reloadT=0,charge=0,firedAgo=Infinity}){
  const u=gun.userData;
  if(u.special==='rpg'&&u.warhead){
    const loading=reloadT>0?THREE.MathUtils.smoothstep(reloadT,.45,.8):1;
    u.warhead.visible=ammo>0||reloadT>.45;u.warhead.position.z=reloadT>0?(1-loading)*-.4:0;
  }else if(u.special==='toilet'){
    if(u.vortex){u.vortex.rotation.z=-now*.006*(1+charge*3);u.vortex.scale.setScalar(1+charge*.4+(firedAgo<180?.5*(1-firedAgo/180):0))}
    if(u.head){const pop=firedAgo<260?Math.sin(firedAgo/260*Math.PI):0;u.head.position.y=u.head.userData.baseY+Math.sin(now*.009)*.007+pop*.05+charge*.02;u.head.rotation.z=Math.sin(now*.006)*.18;u.head.rotation.x=-pop*.3}
    if(u.canisters)u.canisters.scale.y=1+Math.sin(now*.012)*.04+charge*.12;
  }
}

export function createRocket(){
  const g=new THREE.Group(),olive=std(0x6a7742,.55),tan=std(0x8e9a58,.5),flame=glow(0xffa53a,.9),core=glow(0xfff2b0);
  tubeZ(g,olive,0,0,.1,.055,.055,.45,8);const nose=new THREE.Mesh(new THREE.ConeGeometry(.08,.3,8),tan);nose.rotation.x=-Math.PI/2;nose.position.z=-.25;g.add(nose);
  tubeZ(g,tan,0,0,-.08,.06,.08,.12,8);for(let i=0;i<4;i++)box(g,olive,Math.cos(i*Math.PI/2)*.08,Math.sin(i*Math.PI/2)*.08,.3,.012,.012,.14,0,0,i*Math.PI/2);
  const fire=new THREE.Mesh(new THREE.ConeGeometry(.07,.45,8),flame);fire.rotation.x=Math.PI/2;fire.position.z=.55;g.add(fire);const hot=new THREE.Mesh(new THREE.ConeGeometry(.035,.25,6),core);hot.rotation.x=Math.PI/2;hot.position.z=.45;g.add(hot);
  g.traverse(m=>{if(m.isMesh)m.userData.noHit=true});return g;
}
export function createOrb(){
  const g=new THREE.Group();
  g.add(new THREE.Mesh(new THREE.SphereGeometry(.2,12,8),glow(0x56c8ff,.85)));
  const inner=new THREE.Mesh(new THREE.SphereGeometry(.11,10,6),glow(0xe4f8ff));g.add(inner);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.28,.025,5,16),glow(0x9fe3ff,.8));ring.name='ring';g.add(ring);g.userData.ring=ring;
  g.traverse(m=>{if(m.isMesh)m.userData.noHit=true});return g;
}

const fxCube=new THREE.BoxGeometry(1,1,1),fxSphere=new THREE.SphereGeometry(1,14,10),fxRing=new THREE.TorusGeometry(1,.08,6,28);
// Short-lived effect groups. Each part carries its own material so it can fade; dispose with disposeFx.
export function createBlastFx(kind='rocket'){
  const g=new THREE.Group(),parts=[];
  const palette={rocket:[0xffb347,0xff6a1a,0x3b332b],dust:[0xc9b08a,0x9c8566,0x7a6a55],splash:[0x6fd2ff,0xbaf0ff,0x2f8fe0],confetti:[0xffd23f,0xff5d8f,0x5ff0a8,0x5ab8ff,0xffffff]}[kind]||[0xffffff];
  if(kind!=='confetti'){
    const sphere=new THREE.Mesh(fxSphere,glow(palette[0],.85));g.add(sphere);g.userData.sphere=sphere;
    const ring=new THREE.Mesh(fxRing,glow(palette[1],.8));ring.rotation.x=Math.PI/2;g.add(ring);g.userData.ring=ring;
  }
  const count=kind==='confetti'?36:kind==='dust'?14:18;
  for(let i=0;i<count;i++){
    const mesh=new THREE.Mesh(fxCube,glow(palette[i%palette.length],.99));const size=kind==='confetti'?.07:kind==='dust'?.22:.16;mesh.scale.setScalar(size*(.6+Math.random()*.8));
    const a=Math.random()*Math.PI*2,up=kind==='dust'?.25+Math.random()*.6:.4+Math.random()*1.3,speed=kind==='confetti'?3+Math.random()*3.5:kind==='dust'?2+Math.random()*2.5:5+Math.random()*6;
    parts.push({mesh,vel:new THREE.Vector3(Math.cos(a)*speed,up*speed*.8,Math.sin(a)*speed),spin:new THREE.Vector3(Math.random()*9,Math.random()*9,Math.random()*9)});g.add(mesh);
  }
  g.userData.parts=parts;g.userData.kind=kind;g.traverse(m=>{if(m.isMesh)m.userData.noHit=true});return g;
}
export function createVortexFx(radius=3.5){
  const g=new THREE.Group(),rings=[];
  for(let i=0;i<3;i++){const ring=new THREE.Mesh(new THREE.TorusGeometry(radius*(.35+i*.3),.06,5,32),glow(i===1?0xbff0ff:0x4cb8ff,.75,{blending:THREE.AdditiveBlending}));ring.rotation.x=Math.PI/2;ring.position.y=.2+i*.35;g.add(ring);rings.push(ring)}
  const disc=new THREE.Mesh(new THREE.CircleGeometry(radius,32),glow(0x2a8ee8,.22,{side:THREE.DoubleSide,blending:THREE.AdditiveBlending}));disc.rotation.x=-Math.PI/2;disc.position.y=.05;g.add(disc);
  const drops=new THREE.Group();for(let i=0;i<18;i++){const d=new THREE.Mesh(fxSphere,glow(0x9fe3ff,.9));d.scale.setScalar(.07);const a=i/18*Math.PI*2*2.5,r=radius*(1-i/18*.85);d.position.set(Math.cos(a)*r,.15+i*.09,Math.sin(a)*r);drops.add(d)}g.add(drops);
  g.userData.rings=rings;g.userData.drops=drops;g.userData.disc=disc;g.traverse(m=>{if(m.isMesh)m.userData.noHit=true});return g;
}
// Frees per-instance resources. Shared effect geometry is never disposed.
export function disposeFx(group){group.traverse(m=>{if(!m.isMesh)return;if(m.geometry!==fxCube&&m.geometry!==fxSphere&&m.geometry!==fxRing)m.geometry.dispose();m.material.dispose?.()})}
