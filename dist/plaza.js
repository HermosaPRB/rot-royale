import * as THREE from 'three';
import { surfaceTexture } from './surface-details.js?v=detail-6';

// All props share the game's collision and shot-blocking geometry.
export function detailPlaza({world,box,mat,shotBlockers,colliders,buildings}) {
  for(const color of [0xffffff,0xc6ae86,0xe9dfc8,0xe8d8b3,0xcaae85]){mat(color).map=surfaceTexture('stone');mat(color).needsUpdate=true}
  for(const color of [0x916847,0xcda06a,0x826347,0x704c33,0xc9a473,0x7c4e37,0x9d7549]){mat(color).map=surfaceTexture('grain');mat(color).needsUpdate=true}
  for(const color of [0xb94332,0x367875,0xffefcc]){mat(color).map=surfaceTexture('fabric');mat(color).needsUpdate=true}
  const mesh=(geometry,color,x,y,z,solid=false)=>{
    const m=new THREE.Mesh(geometry,mat(color));m.position.set(x,y,z);
    m.castShadow=true;m.receiveShadow=true;world.add(m);if(solid)shotBlockers.push(m);return m;
  };
  const cylinder=(x,y,z,r,h,color,solid=false)=>mesh(new THREE.CylinderGeometry(r,r,h,12),color,x,y,z,solid);
  const sign=(label,x,y,z,w=6,rotation=0)=>{
    const canvas=document.createElement('canvas');canvas.width=768;canvas.height=160;
    const ctx=canvas.getContext('2d');ctx.fillStyle='#fff1cf';ctx.fillRect(0,0,768,160);
    ctx.strokeStyle='#754635';ctx.lineWidth=12;ctx.strokeRect(10,10,748,140);
    ctx.fillStyle='#754635';ctx.font='bold 64px Georgia';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(label,384,86,710);
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
    const m=new THREE.Mesh(new THREE.PlaneGeometry(w,w*160/768),new THREE.MeshStandardMaterial({map:texture,roughness:.9}));
    m.position.set(x,y,z);m.rotation.y=rotation;world.add(m);
  };

  // One instanced draw for the irregularly coloured stone paving.
  const tiles=new THREE.InstancedMesh(new THREE.BoxGeometry(1.96,.04,1.96),mat(0xffffff),34*34);
  const transform=new THREE.Matrix4(),color=new THREE.Color();let index=0;
  for(let x=-33;x<=33;x+=2)for(let z=-33;z<=33;z+=2){
    transform.makeTranslation(x,0,z);tiles.setMatrixAt(index,transform);
    const tone=((index*73)%29)/290;
    color.setHSL(.105,.24,.62+tone);if(Math.abs(x)<7||Math.abs(z)<5)color.setHSL(.1,.2,.76+tone/2);
    tiles.setColorAt(index++,color);
  }
  tiles.receiveShadow=true;world.add(tiles);

  const facades=['CAFFÈ ROTONDO','PANINI & CO.','CASA NONNA','GELATO GALAXY','PIAZZA MARKET','ESPRESSO BAR','PASTA PALAZZO','LA DOLCE ROT'];
  buildings.forEach(([x,y,z,sx,sy,sz],i)=>{
    // Face whichever street is closest to the plaza centre.
    const side=Math.abs(x)>35,signDir=(side?Math.sign(x):Math.sign(z));
    const span=side?sz:sx,depth=side?sx:sz,front=(side?x:z)-signDir*(depth/2+.08);
    const place=(u,h,out,w,thick,height,color,solid=false)=>side?
      box(front-signDir*out,h,z+u,thick,height,w,color,solid):
      box(x+u,h,front-signDir*out,w,height,thick,color,solid);
    place(0,.42,0,span,.3,.85,0xe8d8b3);place(0,sy-.9,.15,span+.7,.5,.4,0xffecc5);
    for(let wy=5.6;wy<sy-1.6;wy+=4.3)for(let u=-span/2+3.5;u<span/2-2;u+=5.2){
      place(u,wy,.12,2.4,.15,2.75,0xffe6b2);
      place(u,wy,.23,1.85,.1,2.22,0x355d62);
      place(u,wy,.32,.1,.09,2.22,0xefe2be);
      place(u,wy,.32,1.85,.09,.1,0xefe2be);
      for(const dir of [-1,1])place(u+dir*1.45,wy,.15,.55,.22,2.8,i%2?0x385d4f:0x427f86);
      for(const dir of [-1,1])for(let slat=-1;slat<=1;slat++)place(u+dir*1.45,wy+slat*.66,.29,.5,.06,.06,0xefe2be);
      place(u,wy-1.52,.42,2.9,.85,.22,0xcaae85);
      if(wy<6){place(u,wy-1.26,.46,2,.55,.35,0xa34d35);for(let j=-1;j<=1;j++){place(u+j*.5,wy-.94,.46,.5,.48,.4,0x476b3c);place(u+j*.5,wy-.69,.49,.18,.22,.12,i%2?0xf2b84b:0xe97b9c)}}
    }
    place(0,1.75,.12,3,.18,3.5,0x5e4034);place(0,1.75,.26,.08,.12,3.2,0xc9ad79);
    place(0,.11,.28,3.6,.7,.22,0xcaae85);
    for(const du of [-.76,.76]){place(du,1,.24,1.02,.07,.9,0x916847);place(du,2.43,.24,1.02,.07,1.3,0x916847);place(du*.25,1.65,.31,.09,.08,.24,0xc9ad79)}
    for(let u=-span/2+1.5;u<span/2;u+=3)place(u,sy-1.18,.12,.38,.35,.45,0xffecc5);
    for(let stripe=0;stripe<8;stripe++)place(-2.625+stripe*.75,3.8,1, .75,2.4,.18,stripe%2?0xfff5d8:(i%2?0x367875:0xb94332));
    const yaw=side?(-signDir*Math.PI/2):(signDir>0?Math.PI:0);
    sign(facades[i],side?front-signDir*.4:x,4.65,side?z:front-signDir*.4,7,yaw);
    // Chimneys make the skyline read as a small town.
    box(x+sx*.24,sy+1,z,1.1,2,1.1,0xa76b50,false);
    box(x+sx*.24,sy+2.1,z,1.5,.28,1.5,0xe0cda5,false);
  });

  // Market counters replace open sightlines with shoulder-high cover.
  [[-12,-10],[14,-13],[-18,15],[19,17]].forEach(([x,z],i)=>{
    box(x,1.08,z,6.5,2.16,2.5,0x916847);
    box(x,2.22,z,6.9,.17,2.75,0xcda06a,false);
    for(let n=-3;n<=3;n++)box(x+n*.9,1.12,z+1.27,.04,1.95,.04,0x5e4432,false);
    for(let n=0;n<10;n++)box(x-3.6+n*.8,2.92,z,.8,.12,5,i%2?(n%2?0xffefcc:0xb94332):(n%2?0xffefcc:0x367875),false);
    sign(i%2?'CAFFÈ & CHAOS':'MERCATO ROT',x,1.45,z+1.31,4);
    for(let tray=-1;tray<=1;tray++){
      box(x+tray*1.75,2.4,z,1.4,.28,1.4,0x594731,false);
      for(let n=0;n<4;n++)mesh(new THREE.IcosahedronGeometry(.24,0),tray===0?0xdfac39:0xb65031,x+tray*1.75+(n%2-.5)*.5,2.66,z+(Math.floor(n/2)-.5)*.5);
    }
  });

  function planter(x,z,sx,sz){
    box(x,.65,z,sx,1.3,sz,0xb98668);
    box(x,1.27,z,sx+.2,.2,sz+.2,0xead8b0,false);
    box(x,1.73,z,sx-.25,1,sz-.25,0x4d703b);
    for(let n=-1;n<=1;n++)mesh(new THREE.IcosahedronGeometry(.6,0),0x668d47,x+n*(sx/3),2.22,z);
  }
  planter(-12,3,7,2.5);planter(12,-1,2.5,7);
  planter(-21,-3,3.6,3.6);planter(23,7,3.6,3.6);
  [[-21,-3],[23,7]].forEach(([x,z])=>{
    cylinder(x,3,z,.27,4,0x6b5136,true);
    mesh(new THREE.IcosahedronGeometry(2.1,1),0x5d793d,x,5,z);
    mesh(new THREE.IcosahedronGeometry(1.5,1),0x77914e,x-.8,5.8,z+.2);
  });
  // Short masonry walls break the north/south lanes, with open flanks.
  [[-7,-22],[9,24]].forEach(([x,z])=>{
    box(x,1.12,z,8,2.24,1.2,0xc6ae86);box(x,2.3,z,8.3,.16,1.4,0xf2e0b5,false);
    for(let n=-3;n<=3;n++)box(x+n,1.15,z+.61,.025,2.1,.035,0xa58963,false);
    for(let n=1;n<=3;n++)box(x,n*.55,z+.62,7.95,.025,.035,0xa58963,false);
  });

  function bench(x,z){
    box(x,.7,z,4,1.4,.9,0x826347);
    box(x,1.55,z-.4,4,.7,.16,0x704c33,false);
    for(let n=-2;n<=2;n++)box(x+n*.75,.78,z, .66,.08,1.04,0xc9a473,false);
    for(const dx of [-1.6,1.6])box(x+dx,1,z,.12,.8,1.1,0x344c43,false);
  }
  bench(-7,13);bench(7,-11);
  // Café terrace: umbrella, tables, cups and seats.
  [[-25,7],[-27,13],[27,-10],[29,-4]].forEach(([x,z],i)=>{
    cylinder(x,.65,z,.16,1.3,0x414a43);cylinder(x,1.3,z,1.25,.16,0xe6cc95,true);
    colliders.push({minX:x-1.2,maxX:x+1.2,minZ:z-1.2,maxZ:z+1.2});
    for(const dx of [-1.8,1.8]){box(x+dx,.52,z,.7,1.04,.7,0x7c4e37);box(x+dx,1.3,z+.3,.75,.7,.12,0x9d7549,false)}
    cylinder(x+.3,1.5,z,.13,.25,0xfff1d7);cylinder(x+.3,1.635,z,.10,.01,0x5b3426);
    cylinder(x,2.45,z,.06,2.7,0xddd0ae);
    const umbrella=mesh(new THREE.ConeGeometry(2.35,.85,10),i%2?0xb94332:0x367875,x,3.9,z,true);
    umbrella.material.side=THREE.DoubleSide;
  });
  // Crate straps and planks turn the existing coloured blocks into cargo.
  [[-26,-18],[25,-23],[-28,27],[29,29],[-10,31],[13,-31]].forEach(([x,z])=>{
    for(let h=.4;h<2.6;h+=.62){box(x,h,z+1.92,3.8,.06,.06,0xead7ad,false);box(x-1.92,h,z,.06,.06,3.8,0xead7ad,false)}
    for(const dx of [-1.25,1.25])box(x+dx,1.3,z+1.97,.12,2.6,.08,0x53443a,false);
  });
  // Street lamps and two spans of festoon lights.
  [[-28,-8],[29,12],[-16,29],[18,-29]].forEach(([x,z])=>{
    cylinder(x,2.6,z,.095,5.2,0x394c45);box(x,5.4,z,.55,.7,.55,0xffe8a8,false);
    box(x,5.82,z,.75,.15,.75,0x394c45,false);
  });
  for(const z of [-7,9]){
    const points=[];for(let x=-32;x<=32;x+=2)points.push(new THREE.Vector3(x,8+1.6*(x/32)**2,z));
    const cable=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:0x514a3d}));world.add(cable);
    for(let n=0;n<points.length;n+=3){const p=points[n];const light=mesh(new THREE.SphereGeometry(.14,6,5),0xffdda0,p.x,p.y-.2,p.z);light.material=new THREE.MeshBasicMaterial({color:0xffdfa0})}
  }
  const rim=mesh(new THREE.TorusGeometry(5.25,.2,7,32),0xf2e2ba,0,1.07,1,true);rim.rotation.x=Math.PI/2;
  for(let i=0;i<20;i++){
    const a=i/20*Math.PI*2;
    const joint=mesh(new THREE.BoxGeometry(.028,.65,.2),0xa58963,Math.sin(a)*5.48,.67,1+Math.cos(a)*5.48);joint.rotation.y=a;
  }
  cylinder(0,3.75,1,1.5,.22,0xe5d7b1,true);
  batchStaticProps(world,shotBlockers);
  world.updateMatrixWorld(true);
}

// Repeated windows, stones and boards share draws instead of costing one draw each.
function batchStaticProps(world,shotBlockers){
  const blocking=new Set(shotBlockers),groups=new Map(),unitBox=new THREE.BoxGeometry(1,1,1);
  for(const item of [...world.children]){
    if(!item.isMesh||item.isInstancedMesh)continue;
    const isBox=item.geometry.type==='BoxGeometry',solid=blocking.has(item);
    const shape=isBox?'box':item.geometry.type+JSON.stringify(item.geometry.parameters);
    const key=shape+':'+item.material.uuid+':'+solid;
    if(!groups.has(key))groups.set(key,{items:[],geometry:isBox?unitBox:item.geometry,material:item.material,solid,isBox});
    groups.get(key).items.push(item);
  }
  for(const group of groups.values()){
    if(group.items.length<2)continue;
    const batch=new THREE.InstancedMesh(group.geometry,group.material,group.items.length);
    batch.castShadow=true;batch.receiveShadow=true;
    group.items.forEach((item,i)=>{
      item.updateMatrix();const matrix=item.matrix.clone();
      if(group.isBox){const p=item.geometry.parameters;matrix.scale(new THREE.Vector3(p.width,p.height,p.depth))}
      batch.setMatrixAt(i,matrix);world.remove(item);blocking.delete(item);
    });
    batch.computeBoundingSphere();world.add(batch);if(group.solid)blocking.add(batch);
  }
  shotBlockers.splice(0,shotBlockers.length,...blocking);
}
