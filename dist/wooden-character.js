import * as THREE from 'three';

// Stylized, code-native model based on the supplied wooden character reference.
// Face points down -Z, matching the game's camera and weapon convention.
export function createWoodenCharacter(){
  const root=new THREE.Group();root.name='wooden-bonker';
  const wood=new THREE.MeshStandardMaterial({color:0xc18a43,roughness:.62,vertexColors:true});
  const tan=new THREE.MeshStandardMaterial({color:0xad7137,roughness:.72});
  const dark=new THREE.MeshStandardMaterial({color:0x3b2113,roughness:.83});
  const cream=new THREE.MeshStandardMaterial({color:0xfff5df,roughness:.38});
  const iris=new THREE.MeshStandardMaterial({color:0x623920,roughness:.48});
  const pupil=new THREE.MeshStandardMaterial({color:0x140d09,roughness:.3});
  const shine=new THREE.MeshBasicMaterial({color:0xffffff});
  const add=(geometry,material,x,y,z,parent=root)=>{const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;parent.add(m);return m};
  const sphere=(material,x,y,z,sx,sy,sz,parent=root)=>{const m=add(new THREE.SphereGeometry(1,16,12),material,x,y,z,parent);m.scale.set(sx,sy,sz);return m};
  function grain(geometry){
    const p=geometry.attributes.position,colors=[];
    for(let i=0;i<p.count;i++){
      const a=Math.atan2(p.getZ(i),p.getX(i));
      const stripe=.83+.13*Math.sin(a*19+Math.sin(p.getY(i)*4)*.28)+.04*Math.sin(a*41+p.getY(i)*1.8);
      colors.push(stripe,Math.max(.65,stripe-.055),Math.max(.58,stripe-.1));
    }
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));return geometry;
  }
  const trunk=add(grain(new THREE.CylinderGeometry(.33,.36,1.53,32,10)),wood,0,1.615,0);
  trunk.name='wooden-body';
  add(new THREE.CylinderGeometry(.331,.331,.025,32),tan,0,2.389,0);
  // Oversized, slightly uneven eyes and raised brows match the reference silhouette.
  for(const side of [-1,1]){
    const x=side*.185,y=2.105+(side===1?.015:0);
    sphere(dark,x,y,-.279,.218,.25,.12);
    sphere(cream,x,y,-.345,.181,.214,.126);
    sphere(iris,x+side*.011,y-.007,-.449,.122,.147,.048);
    sphere(pupil,x+side*.009,y-.01,-.487,.069,.096,.026);
    sphere(shine,x-.026,y+.05,-.512,.029,.034,.011);
    const brow=new THREE.CatmullRomCurve3([
      new THREE.Vector3(x-.165,y+.225,-.3),
      new THREE.Vector3(x-.05,y+.277,-.36),
      new THREE.Vector3(x+.09,y+.267,-.35),
      new THREE.Vector3(x+.163,y+.22,-.29)
    ]);
    add(new THREE.TubeGeometry(brow,10,.038,7,false),dark,0,0,0);
  }
  sphere(tan,0,1.9,-.362,.075,.119,.122);
  sphere(tan,-.16,1.805,-.31,.105,.075,.07);
  sphere(tan,.16,1.805,-.31,.105,.075,.07);
  const smile=new THREE.Shape();smile.moveTo(-.22,0);smile.quadraticCurveTo(0,-.09,.22,.02);smile.quadraticCurveTo(.07,-.22,-.09,-.14);smile.quadraticCurveTo(-.2,-.09,-.22,0);
  const mouth=add(new THREE.ShapeGeometry(smile),new THREE.MeshStandardMaterial({color:0x26140d,side:THREE.DoubleSide,roughness:.8}),0,1.805,-.362);
  mouth.name='smile';
  const teeth=new THREE.Shape();teeth.moveTo(-.165,-.026);teeth.quadraticCurveTo(0,-.075,.155,-.016);teeth.lineTo(.13,-.06);teeth.quadraticCurveTo(0,-.115,-.13,-.067);teeth.closePath();
  add(new THREE.ShapeGeometry(teeth),new THREE.MeshStandardMaterial({color:0xffe6b9,side:THREE.DoubleSide}),0,1.805,-.368);
  // Long limbs, broad feet, and a bat carried on the left.
  const legs=[],arms=[];
  for(const side of [-1,1]){
    const leg=new THREE.Group();leg.position.set(side*.19,.89,0);root.add(leg);legs.push(leg);
    const legCurve=new THREE.CatmullRomCurve3([new THREE.Vector3(0,0,0),new THREE.Vector3(side*.024,-.36,.018),new THREE.Vector3(side*.055,-.72,-.035)]);
    add(new THREE.TubeGeometry(legCurve,12,.054,8,false),tan,0,0,0,leg);
    sphere(tan,side*.055,-.77,-.14,.12,.08,.235,leg);
    for(let toe=0;toe<3;toe++)sphere(tan,side*.055+(toe-1)*.055,-.77,-.335,.034,.041,.064,leg);
    const arm=new THREE.Group();arm.position.set(side*.35,1.59,0);root.add(arm);arms.push(arm);
    const armCurve=new THREE.CatmullRomCurve3([new THREE.Vector3(0,0,0),new THREE.Vector3(side*.08,-.26,-.04),new THREE.Vector3(side*.09,-.61,-.16)]);
    add(new THREE.TubeGeometry(armCurve,12,.046,8,false),tan,0,0,0,arm);
    sphere(tan,side*.09,-.64,-.16,.069,.10,.061,arm);
    if(side===-1){
      const handle=new THREE.Vector3(-.1,-.66,-.18),tip=new THREE.Vector3(-.51,-1.47,-.31);
      const delta=new THREE.Vector3().subVectors(handle,tip);
      const bat=add(grain(new THREE.CylinderGeometry(.035,.105,delta.length(),14,6)),wood,0,0,0,arm);
      bat.position.copy(handle).add(tip).multiplyScalar(.5);bat.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());
      bat.userData.noHit=true;bat.name='wooden-bat';
    }
  }
  root.userData.legs=legs;root.userData.arms=arms;
  return root;
}
