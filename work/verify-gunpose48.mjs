import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import * as THREE from '../../work/three.module.js';
const files=['surface-details.js','wooden-character.js','neegy-character.js','combat-models.js','game.js'];
const source=files.map(file=>fs.readFileSync(new URL('../dist/'+file,import.meta.url),'utf8').replace(/^import .*;$/gm,'').replaceAll('export function','function')).join('\n').replace("buildChoices();initWorld();showScreen('home');",'');
const nodes=new Map(),node=id=>{if(!nodes.has(id))nodes.set(id,{value:'Tester',textContent:'',style:{},classList:{add(){},remove(){},toggle(){}},addEventListener(){},getContext:()=>({fillRect(){},strokeRect(){},fillText(){}})});return nodes.get(id)};
const ctx=vm.createContext({THREE,document:{body:{},getElementById:node,createElement:()=>node('canvas'),addEventListener(){}},performance:{now:()=>0},addEventListener(){},setTimeout(){},setInterval(){},clearInterval(){},console,innerWidth:1280,innerHeight:720});
vm.runInContext(source,ctx);const run=s=>vm.runInContext(s,ctx);
for(const skin of ['wooden','neegy'])for(const weapon of ['ar','smg','shotgun','sniper']){
  const model=run(`createPlayerMesh({id:'preview',char:'${skin}',weapon:'${weapon}'},false)`),gun=model.userData.gun,avatar=model.userData.avatar;
  assert.equal(gun.rotation.y,0,`${skin} ${weapon} points straight ahead`);
  assert.equal(gun.scale.x,.88,`${skin} ${weapon} uses compact third-person scale`);
  model.updateMatrixWorld(true);
  const trigger=avatar.getObjectByName('trigger-hand').getWorldPosition(new THREE.Vector3());
  const support=avatar.getObjectByName('support-hand').getWorldPosition(new THREE.Vector3());
  const triggerOnGun=gun.localToWorld(new THREE.Vector3(.15,1.36,-.34));
  const supportOnGun=gun.localToWorld(new THREE.Vector3(.12,1.48,-.66));
  assert.ok(trigger.distanceTo(triggerOnGun)<.13,`${skin} ${weapon} trigger hand misses grip`);
  assert.ok(support.distanceTo(supportOnGun)<.16,`${skin} ${weapon} support hand misses fore-end`);
  let rearMinX=Infinity,count=0;
  gun.traverse(m=>{if(!m.isMesh)return;const a=m.geometry.attributes.position;for(let i=0;i<a.count;i++){
    const p=m.localToWorld(new THREE.Vector3().fromBufferAttribute(a,i));
    if(p.z>.13&&p.y>1.25&&p.y<1.65){rearMinX=Math.min(rearMinX,p.x);count++}
  }});
  assert.ok(count>0,`${skin} ${weapon} has a stock`);
  assert.ok(rearMinX>.30,`${skin} ${weapon} stock enters the torso: ${rearMinX}`);
  console.log(`${skin} ${weapon}: hands near grips, rear stock outside torso (${rearMinX.toFixed(2)})`);
}
