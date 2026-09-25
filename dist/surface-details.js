import * as THREE from 'three';

const textureCache=new Map();
// Tiny deterministic material patterns, generated once and shared by the scene.
export function surfaceTexture(kind){
  if(textureCache.has(kind))return textureCache.get(kind);
  const width=128,height=128,data=new Uint8Array(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const u=x/width,v=y/height,noise=((x*73+y*157+(x*y)%137)%251)/250;
    let shade=.88+noise*.12;
    if(kind==='grain'){
      const bend=Math.sin(v*Math.PI*2)*.019+Math.sin(v*Math.PI*6)*.006;
      const grain=Math.sin((u+bend)*Math.PI*68);
      shade=.79+.12*grain+.045*Math.sin(u*Math.PI*174+v*6.28)+noise*.05;
    }else if(kind==='endgrain'){
      const r=Math.hypot(u-.5,v-.5),a=Math.atan2(v-.5,u-.5);
      shade=.83+.11*Math.sin(r*190+Math.sin(a*5)*.6)+noise*.04;
    }else if(kind==='fabric')shade=.86+.065*(x%4===0||y%4===0?0:1)+noise*.035;
    else if(kind==='stone')shade=.83+noise*.13+.035*Math.sin(x*.22)*Math.cos(y*.31);
    const i=(y*width+x)*4,n=Math.round(THREE.MathUtils.clamp(shade,0,1)*255);data[i]=data[i+1]=data[i+2]=n;data[i+3]=255;
  }
  const texture=new THREE.DataTexture(data,width,height,THREE.RGBAFormat);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.colorSpace=THREE.SRGBColorSpace;texture.needsUpdate=true;textureCache.set(kind,texture);return texture;
}

// Combine only parts that share a material and rigid parent. Limb pivots stay independent.
export function mergeRigidParts(parent){
  const groups=new Map();
  for(const child of [...parent.children]){
    if(!child.isMesh){mergeRigidParts(child);continue}
    const key=child.material.uuid+':'+!!child.userData.noHit;
    if(!groups.has(key))groups.set(key,[]);groups.get(key).push(child);
  }
  for(const parts of groups.values()){
    if(parts.length<2)continue;
    const positions=[],normals=[],uvs=[];
    for(const part of parts){
      part.updateMatrix();const g=part.geometry.index?part.geometry.toNonIndexed():part.geometry.clone();g.applyMatrix4(part.matrix);
      positions.push(...g.attributes.position.array);normals.push(...g.attributes.normal.array);
      if(g.attributes.uv)uvs.push(...g.attributes.uv.array);else uvs.push(...new Float32Array(g.attributes.position.count*2));g.dispose();
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
    const merged=new THREE.Mesh(g,parts[0].material);merged.castShadow=parts.some(p=>p.castShadow);merged.receiveShadow=parts.some(p=>p.receiveShadow);merged.userData={...parts[0].userData};merged.name=parts.map(p=>p.name).filter(Boolean).join('+');
    parts.forEach(p=>parent.remove(p));parent.add(merged);
  }
}
