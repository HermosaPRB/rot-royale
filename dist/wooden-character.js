import * as THREE from 'three';
import { mergeRigidParts, surfaceTexture } from './surface-details.js?v=detail-6';

// Hand-built from the user's front, rear and two profile reference images.
// Face points down -Z. One shared template; four independent walking pivots.
const characterTemplates=new Map();
export function createWoodenCharacter(detail='game'){
  const key=detail==='preview'?'preview':'game';
  if(!characterTemplates.has(key))characterTemplates.set(key,buildWoodenCharacter(key==='preview'));
  const root=characterTemplates.get(key).clone(true);
  root.userData.legs=[root.getObjectByName('leg--1'),root.getObjectByName('leg-1')];
  root.userData.arms=[root.getObjectByName('arm--1'),root.getObjectByName('arm-1')];
  return root;
}

function buildWoodenCharacter(detailed){
  const root=new THREE.Group();root.name='wooden-bonker';
  const material=(color,roughness=.53)=>new THREE.MeshStandardMaterial({color,roughness});
  const skin=material(0xd48339),warm=material(0xe49b52),lip=material(0xaf6845);
  const dark=material(0x60301d,.65),mouthMat=material(0x4b2018,.7);
  const cream=material(0xfff1d8,.27),iris=material(0x433323,.28),pupil=material(0x100f0d,.22);
  const shine=new THREE.MeshBasicMaterial({color:0xfff9e8});
  const wood=material(0xd98b3e,.54);wood.vertexColors=true;wood.map=surfaceTexture('grain');
  const add=(geometry,mat,x=0,y=0,z=0,parent=root)=>{const m=new THREE.Mesh(geometry,mat);m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;parent.add(m);return m};
  const sphere=(mat,x,y,z,sx,sy,sz,parent=root,segments=12)=>{const count=Math.max(8,segments-(detailed?2:4));const m=add(new THREE.SphereGeometry(1,count,Math.max(5,Math.round(count*.6))),mat,x,y,z,parent);m.scale.set(sx,sy,sz);return m};
  const curve=points=>new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
  function tube(points,radii,mat,parent=root,steps=16,sides=8){
    if(!detailed){steps=Math.max(6,Math.round(steps*.75));sides=Math.max(6,sides-1)}
    const path=curve(points),g=new THREE.TubeGeometry(path,steps,1,sides,false),p=g.attributes.position;
    for(let i=0;i<=steps;i++){
      const t=i/steps,c=path.getPointAt(t),f=t*(radii.length-1),j=Math.min(radii.length-2,Math.floor(f)),r=THREE.MathUtils.lerp(radii[j],radii[j+1],f-j);
      for(let n=0;n<=sides;n++){const k=i*(sides+1)+n;p.setXYZ(k,c.x+(p.getX(k)-c.x)*r,c.y+(p.getY(k)-c.y)*r,c.z+(p.getZ(k)-c.z)*r)}
    }
    g.computeVertexNormals();return add(g,mat,0,0,0,parent);
  }
  const gaussian=(x,c,s)=>Math.exp(-(((x-c)/s)**2));
  // Rounded log profile with actual sculpted cheek, eye-socket and chin depth.
  const profile=[],rings=detailed?36:28;
  for(let i=0;i<=rings;i++){
    const y=.93+i/rings*1.48,t=i/rings;
    const radius=.286+.018*t+.014*Math.sin(t*Math.PI)-.016*gaussian(y,1.65,.17);
    profile.push(new THREE.Vector2(radius,y));
  }
  profile.unshift(new THREE.Vector2(0,.915),new THREE.Vector2(.26,.915));
  profile.push(new THREE.Vector2(.296,2.43),new THREE.Vector2(.27,2.444),new THREE.Vector2(0,2.45));
  const bodyGeometry=new THREE.LatheGeometry(profile,detailed?40:32),p=bodyGeometry.attributes.position,colors=[];
  for(let i=0;i<p.count;i++){
    let x=p.getX(i),y=p.getY(i),z=p.getZ(i);const front=Math.max(0,-z/.30);
    if(z<0){
      const cheeks=(gaussian(x,-.205,.13)+gaussian(x,.205,.13))*gaussian(y,1.925,.115)*.125;
      const chin=gaussian(x,0,.17)*gaussian(y,1.595,.10)*.065;
      const muzzle=gaussian(x,0,.185)*gaussian(y,1.755,.115)*.055;
      const eyeMounds=(gaussian(x,-.154,.14)+gaussian(x,.154,.14))*gaussian(y,2.075,.175)*.025;
      const noseBridge=gaussian(x,0,.052)*gaussian(y,2.055,.17)*.045;
      const forehead=gaussian(x,0,.27)*gaussian(y,2.23,.10)*.017;
      z-=Math.pow(front,.4)*(cheeks+chin+muzzle+forehead+eyeMounds+noseBridge);
      x+=Math.sign(x)*gaussian(Math.abs(x),.26,.08)*gaussian(y,1.945,.12)*.027;
    }
    // Subtle warm grain, not the old deep corrugated stripes.
    const a=Math.atan2(z,x),streak=.965+.017*Math.sin(a*31+Math.sin(y*5)*.3)+.010*Math.sin(a*67+y*3);
    const faceShade=1-.065*gaussian(y,1.72,.075)*front;
    const crown=1+.08*gaussian(y,2.43,.06);
    colors.push(streak*faceShade*crown,streak*faceShade*crown,streak*faceShade*crown);
    p.setXYZ(i,x,y,z);
  }
  bodyGeometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));bodyGeometry.computeVertexNormals();
  const body=add(bodyGeometry,wood);body.name='wooden-body';
  const end=material(0xe7b46d,.68);end.map=surfaceTexture('endgrain');
  const top=add(new THREE.CircleGeometry(.275,40),end,0,2.446,0);top.rotation.x=-Math.PI/2;
  const faceStart=root.children.length;

  for(const side of [-1,1]){
    const x=side*.153,y=2.13+(side===1?.008:0),z=-.280;
    sphere(lip,x,y,z,.153,.178,.083,root,16);
    sphere(dark,x,y-.002,z-.050,.133,.155,.061,root,16);
    sphere(cream,x,y-.006,z-.067,.117,.137,.063,root,20);
    sphere(iris,x-side*.006,y-.013,z-.124,.071,.096,.029,root,16);
    sphere(pupil,x-side*.006,y-.014,z-.144,.046,.074,.015,root,14);
    sphere(shine,x-.019,y+.038,z-.156,.023,.030,.008,root,10);
    sphere(shine,x+.024,y-.045,z-.157,.009,.014,.005,root,8);
    tube([[x-.114,y+.048,z-.071],[x-.08,y+.127,z-.080],[x+.02,y+.145,z-.092],[x+.112,y+.06,z-.069]],[.020,.024,.020,.012],warm,root,16,7);
    tube([[x-.111,y-.056,z-.075],[x-.06,y-.140,z-.08],[x+.07,y-.132,z-.081],[x+.117,y-.044,z-.07]],[.016,.023,.021,.013],skin,root,16,7);
    tube([[x-.132,y+.188,z-.020],[x-.082,y+.228,z-.040],[x+.035,y+.229,z-.043],[x+.12,y+.186,z-.015]],[.024,.037,.033,.016],dark,root,16,8);
  }
  // Tapered bridge and bulbous nostrils make the nose read in profile.
  tube([[0,2.265,-.29],[0,2.16,-.337],[0,2.035,-.395],[0,1.942,-.48]],[.032,.036,.043,.048],warm,root,18,12);
  sphere(warm,0,1.947,-.481,.061,.038,.067,root,16);
  for(const side of [-1,1]){
    sphere(skin,side*.052,1.943,-.442,.038,.029,.037);
    sphere(dark,side*.039,1.924,-.472,.016,.009,.012,root,8);
  }
  // Recessed smile follows a curved muzzle in 3D, including its side profile.
  const smileVertices=[],smileIndices=[];
  for(let i=0;i<=24;i++){
    const t=i/24,x=(t-.5)*.37,arc=Math.sin(t*Math.PI),z=-.312-.080*arc;
    smileVertices.push(x,1.833-.055*arc,z,x,1.833-.102*arc,z+.005);
    if(i<24){const k=i*2;smileIndices.push(k,k+2,k+1,k+1,k+2,k+3)}
  }
  const smileGeometry=new THREE.BufferGeometry();smileGeometry.setAttribute('position',new THREE.Float32BufferAttribute(smileVertices,3));smileGeometry.setIndex(smileIndices);smileGeometry.computeVertexNormals();mouthMat.side=THREE.DoubleSide;
  add(smileGeometry,mouthMat).name='smile';
  tube([[-.187,1.836,-.312],[-.10,1.787,-.369],[0,1.775,-.397],[.10,1.787,-.369],[.187,1.836,-.312]],[.009,.015,.015,.009],warm,root,24,7);
  tube([[-.18,1.825,-.314],[-.10,1.745,-.364],[0,1.726,-.395],[.10,1.745,-.364],[.18,1.825,-.314]],[.012,.029,.029,.012],lip,root,24,8);
  // Leave the taller forehead seen in all four reference views.
  root.children.slice(faceStart).forEach(part=>part.position.y-=.07);

  for(const side of [-1,1]){
    const leg=new THREE.Group();leg.name='leg-'+side;leg.position.set(side*.15,.975,0);root.add(leg);
    tube([[0,0,0],[side*.013,-.20,.015],[side*.024,-.40,-.038],[side*.021,-.65,.006],[side*.03,-.85,-.018]],[.070,.057,.047,.035,.056],skin,leg,20,10);
    sphere(skin,side*.024,-.39,-.04,.049,.066,.051,leg);
    sphere(skin,side*.032,-.862,-.035,.070,.090,.096,leg);
    const foot=sphere(skin,side*.032,-.893,-.135,.115,.066,.19,leg,16);foot.rotation.y=side*-.11;
    for(let toe=0;toe<5;toe++){
      const x=side*(-.060+toe*.041),r=.036-toe*.0038,z=-.295+toe*.016;
      sphere(warm,x,-.906,z,r,.035-toe*.002,.080-toe*.008,leg,10);
    }
    const arm=new THREE.Group();arm.name='arm-'+side;arm.position.set(side*.302,1.61,.022);root.add(arm);
    const hand=side===1?[-.125,-.241,-.887]:[.456,-.148,-1.137];
    const elbow=side===1?[.045,-.34,-.43]:[-.015,-.31,-.66];
    tube([[0,0,0],[elbow[0]*.6,-.17,elbow[2]*.55],elbow,[hand[0],hand[1]-.02,hand[2]+.065],hand],[.045,.043,.032,.026,.028],warm,arm,18,9);
    sphere(warm,0,-.005,0,.043,.070,.045,arm);
    const [hx,hy,hz]=hand;
    sphere(warm,hx,hy,hz,.051,.060,.045,arm);
    const grip=new THREE.Object3D();grip.name=side===1?'trigger-hand':'support-hand';grip.position.set(...hand);arm.add(grip);
    for(let finger=0;finger<4;finger++){
      const y=hy+.035-finger*.024;
      tube([[hx-.026,y,hz-.027],[hx-.044,y,hz-.057],[hx+.015,y,hz-.061],[hx+.029,y,hz-.032]],[.012,.012,.010,.009],warm,arm,8,6);
    }
    tube([[hx+.037,hy+.037,hz],[hx+.047,hy+.018,hz-.047],[hx+.020,hy+.009,hz-.059]],[.020,.017,.011],warm,arm,9,7);
  }
  mergeRigidParts(root);
  return root;
}
