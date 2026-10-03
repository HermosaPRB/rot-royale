import * as THREE from 'three';
import { mergeRigidParts, surfaceTexture } from './surface-details.js?v=detail-6';

// Original geometry built from the supplied front/profile/back turnaround.
// Shared immutable geometry/materials; independent animation pivots per player.
const templates=new Map();
export function createNeegyCharacter(detail='game'){
  const key=detail==='preview'?'preview':'game';
  if(!templates.has(key))templates.set(key,buildNeegy(key==='preview'));
  const root=templates.get(key).clone(true);
  root.userData.legs=[root.getObjectByName('leg--1'),root.getObjectByName('leg-1')];
  root.userData.arms=[root.getObjectByName('arm--1'),root.getObjectByName('arm-1')];
  return root;
}
function buildNeegy(preview){
  const root=new THREE.Group();root.name='neegy';
  const gold=new THREE.MeshStandardMaterial({color:0xe5ac24,metalness:.55,roughness:.36});
  const light=new THREE.MeshStandardMaterial({color:0xf3c647,metalness:.55,roughness:.3});
  const cloth=new THREE.MeshStandardMaterial({color:0xc99827,metalness:.35,roughness:.48});
  cloth.map=surfaceTexture('fabric');
  const shadow=new THREE.MeshStandardMaterial({color:0x735019,metalness:.35,roughness:.5});
  const eye=new THREE.MeshStandardMaterial({color:0xe8bd53,metalness:.45,roughness:.24});
  const n=preview?24:16;
  function add(geo,mat,x,y,z,parent=root){const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;parent.add(m);return m}
  function oval(mat,x,y,z,sx,sy,sz,parent=root){const m=add(new THREE.SphereGeometry(1,n,Math.round(n*.65)),mat,x,y,z,parent);m.scale.set(sx,sy,sz);return m}
  function tube(points,r,mat=gold,parent=root){return add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),preview?16:10,r,preview?7:5,false),mat,0,0,0,parent)}
  function cylinder(top,bottom,height,x,y,z,mat=gold,parent=root){return add(new THREE.CylinderGeometry(top,bottom,height,n),mat,x,y,z,parent)}
  function ring(x,y,z,r,thickness,parent=root){const m=add(new THREE.TorusGeometry(r,thickness,5,n),light,x,y,z,parent);m.rotation.x=Math.PI/2;return m}
  // Slim sweater, ribbed hem and narrow neck beneath the oversized skull.
  oval(cloth,0,1.18,.015,.225,.345,.155);
  cylinder(.225,.235,.05,0,.94,.01,cloth);
  for(let i=0;i<28;i++){const a=i*Math.PI/14;oval(light,Math.cos(a)*.225,.94,Math.sin(a)*.16+.01,.009,.025,.009)}
  cylinder(.077,.095,.28,0,1.60,.025);
  ring(0,1.49,.025,.10,.018);
  for(let i=0;i<20;i++){const a=i*Math.PI/10;tube([[Math.cos(a)*.104,1.465,.025+Math.sin(a)*.104],[Math.cos(a)*.10,1.52,.025+Math.sin(a)*.10]],.007,light)}
  // Continuous tapered cranium rather than a stack of balls.
  const profile=[[0,1.65],[.07,1.68],[.11,1.76],[.17,1.83],[.205,1.96],[.225,2.13],[.22,2.28],[.19,2.40],[.12,2.47],[0,2.49]].map(([r,y])=>new THREE.Vector2(r,y));
  const skull=new THREE.LatheGeometry(profile,preview?36:24),pos=skull.attributes.position;
  for(let i=0;i<pos.count;i++){const y=pos.getY(i);pos.setZ(i,pos.getZ(i)*.87+.035+(y-2.1)*.08)}skull.computeVertexNormals();add(skull,gold,0,0,0);
  for(const s of [-1,1]){
    // Flared ears with recessed bowls and rolled cartilage.
    oval(gold,s*.255,2.095,.025,.115,.14,.075);
    oval(shadow,s*.283,2.095,-.035,.058,.09,.025);
    tube([[s*.24,2.20,-.038],[s*.31,2.225,-.045],[s*.342,2.12,-.044],[s*.31,2.005,-.046],[s*.26,2.025,-.055]],.022,light);
    tube([[s*.292,2.165,-.06],[s*.269,2.11,-.07],[s*.31,2.07,-.065],[s*.277,2.045,-.065]],.014,gold);
    // Heavy eyelids, small gold irises, frown creases and cheek planes.
    oval(gold,s*.12,2.225,-.155,.115,.102,.068);
    oval(shadow,s*.13,2.216,-.20,.082,.060,.028);
    oval(eye,s*.13,2.218,-.22,.067,.047,.033);
    oval(shadow,s*.137,2.216,-.249,.025,.034,.011);
    oval(gold,s*.137,2.219,-.26,.013,.023,.006);
    oval(light,s*.13-.009,2.23,-.267,.008,.009,.003);
    tube([[s*.05,2.235,-.219],[s*.12,2.274,-.229],[s*.20,2.235,-.19]],.014,gold);
    tube([[s*.052,2.19,-.209],[s*.132,2.16,-.219],[s*.20,2.195,-.178]],.014,light);
    tube([[s*.03,2.28,-.17],[s*.09,2.305,-.20],[s*.19,2.27,-.17]],.019,gold);
    oval(gold,s*.15,2.08,-.155,.092,.115,.065);
    tube([[s*.12,2.13,-.20],[s*.16,2.04,-.24],[s*.19,1.99,-.17]],.015,light);
  }
  // Projecting, rounded nose is the key side-view silhouette.
  oval(gold,0,2.16,-.255,.075,.102,.135);
  oval(gold,0,2.135,-.385,.132,.074,.175);
  for(const s of [-1,1]){oval(gold,s*.086,2.103,-.276,.046,.034,.047);oval(shadow,s*.08,2.087,-.305,.022,.009,.025)}
  oval(gold,0,2.015,-.215,.163,.07,.125);
  tube([[-.17,2.012,-.225],[-.095,2.025,-.312],[0,2.016,-.345],[.095,2.025,-.312],[.17,2.012,-.225]],.013,shadow);
  tube([[-.16,2.034,-.237],[-.065,2.045,-.327],[0,2.03,-.343],[.065,2.045,-.327],[.16,2.034,-.237]],.018,light);
  tube([[-.16,1.995,-.224],[-.08,1.977,-.32],[0,1.978,-.335],[.08,1.977,-.32],[.16,1.995,-.224]],.020,gold);
  // Four separate buck teeth with visible gaps; the old wide boxes read as one slab.
  oval(shadow,0,1.946,-.296,.096,.042,.025);
  for(const [i,x] of [-.066,-.022,.022,.066].entries()){
    const tooth=add(new THREE.BoxGeometry(.029,i===0||i===3?.056:.068,.034),light,x,1.944-(i===0||i===3?.004:0),-.323);
    tooth.rotation.set(.08,0,(i-1.5)*-.025);
  }
  // A recessed, tapered jaw preserves the reference's long face without a round chin bump.
  oval(gold,0,1.865,-.052,.073,.128,.064);
  tube([[-.095,1.935,-.12],[-.066,1.865,-.14],[0,1.82,-.13],[.066,1.865,-.14],[.095,1.935,-.12]],.011,light);
  for(let i=0;i<3;i++){const y=2.345+i*.031;tube([[-.145,y,-.125],[0,y-.014,-.169],[.145,y,-.122]],.0055,i===1?shadow:light)}
  // Sparse crown hairs visible from front and back.
  tube([[0,2.47,.065],[-.015,2.535,.06],[-.052,2.565,.065]],.009,light);
  tube([[.015,2.47,.06],[.04,2.55,.045],[.074,2.56,.035]],.008,gold);
  tube([[.025,2.47,.065],[.085,2.53,.09],[.13,2.525,.085]],.008,light);
  // Shorts and boots move with independent hip pivots.
  for(const s of [-1,1]){
    const leg=new THREE.Group();leg.name='leg-'+s;leg.position.set(s*.12,.92,0);root.add(leg);
    const shorts=cylinder(.126,.115,.31,0,-.14,0,cloth,leg);shorts.scale.z=.85;
    ring(0,-.285,0,.11,.012,leg).scale.z=.85;
    tube([[0,-.29,0],[s*.005,-.39,-.015],[s*.007,-.51,.01],[0,-.64,.01]],.039,gold,leg);
    oval(gold,0,-.385,-.019,.047,.068,.045,leg);
    cylinder(.051,.052,.10,0,-.645,.015,cloth,leg);
    for(let j=0;j<4;j++)ring(0,-.609-j*.023,.015,.051,.008,leg);
    oval(gold,0,-.746,-.012,.091,.10,.105,leg);
    oval(gold,0,-.817,-.10,.115,.073,.18,leg);
    const sole=add(new THREE.BoxGeometry(.225,.045,.325),cloth,0,-.876,-.076,leg);
    oval(light,0,-.834,-.19,.112,.050,.09,leg);
    for(let j=0;j<4;j++){const y=-.728-j*.028,z=-.097-j*.022;tube([[-.05,y,z],[0,y+.012,z-.015],[.05,y-.008,z]],.007,light,leg)}
    tube([[-.065,-.71,-.08],[-.061,-.80,-.16],[.065,-.80,-.16],[.065,-.71,-.08]],.007,cloth,leg);
    // Back pockets and center/side seams.
    tube([[-.07,-.04,.111],[-.07,-.13,.116],[0,-.15,.117],[.07,-.13,.116],[.07,-.04,.111]],.006,light,leg);
    tube([[s*.11,-.015,.025],[s*.118,-.14,.025],[s*.105,-.27,.025]],.006,light,leg);
    const arm=new THREE.Group();arm.name='arm-'+s;arm.position.set(s*.23,1.435,.025);root.add(arm);
    const hand=s===1?[.15,-.07,-.365]:[.59,.015,-.665],elbow=s===1?[.145,-.24,-.12]:[.09,-.20,-.32];
    tube([[0,0,0],[elbow[0],elbow[1],elbow[2]],[hand[0],hand[1],hand[2]+.085]],.058,cloth,arm);
    oval(gold,...elbow,.061,.064,.065,arm);
    oval(light,hand[0],hand[1],hand[2]+.065,.054,.055,.030,arm);
    oval(gold,...hand,.044,.057,.042,arm);
    const grip=new THREE.Object3D();grip.name=s===1?'trigger-hand':'support-hand';grip.position.set(...hand);arm.add(grip);
    for(let j=0;j<4;j++){const [x,y,z]=hand;tube([[x-.028,y+.031-j*.02,z-.023],[x-.035,y+.029-j*.02,z-.059],[x+.025,y+.03-j*.02,z-.05]],.009,light,arm)}
    tube([[hand[0]+.035,hand[1]+.025,hand[2]],[hand[0]+.045,hand[1],hand[2]-.04],[hand[0]+.017,hand[1]-.01,hand[2]-.045]],.014,gold,arm);
  }
  mergeRigidParts(root);return root;
}
