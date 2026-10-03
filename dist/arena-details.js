import * as THREE from 'three';
import {surfaceTexture} from './surface-details.js?v=detail-6';

// Visual skins for existing architecture: never add collision or block a route.
// The caller merges these rigid pieces by material once, not once per frame.
function kit(parent){
  const materials=new Map();
  const material=(color,texture)=>{const key=color+':'+texture;if(!materials.has(key))materials.set(key,new THREE.MeshStandardMaterial({color,roughness:texture?.78:.58,map:texture?surfaceTexture(texture):null}));return materials.get(key)};
  const add=(geometry,color,x,y,z,texture)=>{const m=new THREE.Mesh(geometry,material(color,texture));m.position.set(x,y,z);m.receiveShadow=true;parent.add(m);return m};
  const box=(x,y,z,w,h,d,c,t)=>add(new THREE.BoxGeometry(w,h,d),c,x,y,z,t);
  const pipe=(x,y,z,r,length,c,axis='y')=>{const m=add(new THREE.CylinderGeometry(r,r,length,8),c,x,y,z);if(axis==='x')m.rotation.z=Math.PI/2;if(axis==='z')m.rotation.x=Math.PI/2;return m};
  const ring=(x,y,z,r,c,axis='y')=>{const m=add(new THREE.TorusGeometry(r,.035,4,16),c,x,y,z);if(axis==='y')m.rotation.x=Math.PI/2;if(axis==='x')m.rotation.y=Math.PI/2;return m};
  return {box,pipe,ring,add};
}

export function detailNeonTown(parent){
  const {box,pipe,ring,add}=kit(parent),white=0xdbe6e9,dark=0x25364a,trim=0x8fa7b0;
  // Sidewalk joints and inset road drains. All details stay below shoe height.
  for(const x of [-17,17])for(let z=-32;z<=32;z+=2)box(x,.052,z,1.96,.012,.035,trim);
  for(const x of [-14,14])for(const z of [-10,0,10]){
    box(x,.055,z,.7,.02,1.2,dark);
    for(let i=0;i<6;i++)box(x,.068,z-.48+i*.19,.62,.012,.04,trim);
  }
  for(const z of [-20,20]){
    const s=Math.sign(z),front=z-s*5,accent=s<0?0xf17d38:0x29aaca;
    // Layered facade, stone plinth and panel joints, kept clear of doors/windows.
    for(const x of [-6.3,6.3]){
      box(x,.22,front-s*.23,7.2,.4,.08,trim,'stone');
      for(let row=0;row<4;row++)box(x,.65+row*.62,front-s*.215,7.1,.025,.025,trim);
      box(x,3.12,front-s*.26,7.2,.09,.12,dark);
      for(let i=0;i<5;i++)box(x-2.8+i*1.4,5.55,front-s*.23,.025,2.5,.035,dark);
    }
    for(const x of [-10.25,10.25]){
      box(x,.2,z,.055,.35,9.5,trim,'stone');
      box(x,4.25,z,.055,.075,9.6,white);
      box(x,6.75,z,.055,.075,9.6,white);
      for(let dz=-4;dz<=4;dz+=1)box(x,5.5,z+dz,.055,2.45,.025,dark);
      // Opaque inset panels, visibly solid rather than misleading extra openings.
      for(const dz of [-2.6,2.6]){
        box(x+Math.sign(x)*.035,5.5,z+dz,.065,1.5,2.25,trim);
        for(let j=0;j<6;j++)box(x+Math.sign(x)*.075,4.9+j*.24,z+dz,.045,.085,2.1,dark);
      }
      for(const dz of [-2.6,2.6]){
        for(const y of [1.31,2.69])box(x+Math.sign(x)*.025,y,z+dz,.09,.08,2.25,white);
        box(x+Math.sign(x)*.045,2,z+dz,.08,1.35,.055,white);
        for(let i=0;i<4;i++)box(x+Math.sign(x)*.05,1.65+i*.24,z+dz,.05,.035,2.04,trim);
      }
    }
    // Interior backsplash, cabinetry, sofa cushions and ceiling panels.
    box(-5,1.33,z+s,3.48,.10,1.25,white,'stone');
    for(let i=0;i<4;i++){
      box(-6.22+i*.82,.68,z+s-.56,.75,1.05,.025,0x71888e);
      box(-6.22+i*.82,1.05,z+s-.59,.28,.035,.035,white);
    }
    for(let i=0;i<3;i++)box(4+i*.98,1.22,z-s,.91,.10,1.35,accent,'fabric');
    for(const x of [-5,2])box(x,3.65,z,2,.035,.3,white);
    // Roof panels: cell grid, raised edges and HVAC louvers.
    for(let i=0;i<3;i++){
      const x=-1+i*3;
      for(const dx of [-1.22,1.22])box(x+dx,7.42,z,.045,.05,3.08,trim);
      for(let j=-1;j<=1;j++)box(x,7.408,z+j,2.35,.015,.022,trim);
      box(x,7.409,z,.025,.015,2.96,trim);
    }
    for(const x of [-6,5.5])for(let j=0;j<6;j++)box(x-.58+j*.23,7.53,z+s*1.5-.56,.065,.28,.025,trim);
    // Pavilion ceiling slats and planted borders sit on the existing cover.
    for(let i=0;i<9;i++)box(21+i*.75,3.16,z+s*2,.075,.06,6.8,trim);
    for(let i=0;i<7;i++){
      const m=add(new THREE.IcosahedronGeometry(.47,0),i%2?0x527b48:0x709756,-26+i*.66,1.75,z);
      m.scale.set(.8,1,.95);
    }
    // House entry light housings, no extra shadow-casting point lights.
    for(const x of [-2.7,2.7]){box(x,2.72,front-s*.30,.23,.42,.16,dark);box(x,2.72,front-s*.40,.14,.28,.025,0xffdf9e)}
  }
  // Vehicle panels, wheel hubs and radiator fins give the center landmark depth.
  for(const [x,z,len] of [[-5,-2,10],[5,3,12]]){
    for(const s of [-1,1]){
      for(let i=0;i<5;i++)box(x+s*2.055,1.28,z-len/2+1+i*2,.025,.42,1.7,0x9baeb7);
      for(const wz of [z-len/2+1.5,z+len/2-1.5]){pipe(x+s*2.18,.55,wz,.30,.04,trim,'x');ring(x+s*2.21,.55,wz,.19,dark,'x')}
      box(x+s*2.07,2.05,z+len/2-1,.035,1.35,.055,white);
    }
    box(x,.38,z-len/2-.12,3.7,.16,.16,dark);
    for(let i=0;i<7;i++)box(x-.8+i*.27,.9,z-len/2-.075,.08,.36,.03,dark);
    box(x,1.5,z-len/2-.12,.06,.75,.05,white);
  }
  for(const [x,z] of [[-23,-6],[23,7],[-24,28],[24,-28]]){
    box(x,1.39,z,4.12,.12,2.5,trim,'stone');
    for(let i=0;i<5;i++){const m=add(new THREE.IcosahedronGeometry(.47,0),i%2?0x5c9354:0x709e60,x-1.35+i*.67,1.88,z);m.scale.z=1.4}
    for(let i=0;i<4;i++)box(x-1.5+i, .7,z-1.215,.025,1.2,.015,trim);
  }
}

export function detailFactory(parent){
  const {box,pipe,ring}=kit(parent),steel=0x657789,dark=0x152231,ivory=0xe6d4aa,yellow=0xe5ad5a;
  // Expansion joints, walking-lane paint and flush drain grates.
  for(let x=-21;x<=21;x+=3)box(x,.008,0,.025,.012,47,0x304254);
  for(let z=-21;z<=21;z+=3)box(0,.009,z,45,.012,.025,0x304254);
  for(const x of [-8,8])for(let z=-17;z<=17;z+=3)box(x,.022,z,.09,.025,1.4,yellow);
  for(const x of [-21,21])for(const z of [-12,12]){
    box(x,.024,z,1.1,.025,2,dark);
    for(let i=0;i<8;i++)box(x,.044,z-.85+i*.24,.92,.015,.055,steel);
  }
  // Structural wall ribs, service panels and high clerestory windows.
  for(const s of [-1,1])for(const z of [-20,-12,-4,4,12,20]){
    box(s*23.12,3.45,z,.12,6.7,.16,steel);
    box(s*23.08,4.1,z+2.1,.10,1.65,2.8,0x365c70);
    for(const y of [3.22,4.98])box(s*23.01,y,z+2.1,.10,.09,2.9,steel);
    box(s*23,4.1,z+2.1,.09,1.65,.045,steel);
    box(s*23.10,1.7,z+1.6,.12,1.5,1,0x344e63);
    for(let i=0;i<4;i++)box(s*23.02,1.4+i*.16,z+1.6,.04,.04,.7,dark);
  }
  // Conveyor rollers are decorative and stay inside the existing rail envelope.
  for(const x of [-5.5,5.5])for(let z=-15;z<=15;z+=3){
    for(const s of [-1,1]){box(x+s*1.69,.30,z,.16,.045,.32,steel);pipe(x+s*1.70,.28,z,.06,.18,ivory,'x')}
  }
  // Vat seam bands, pressure gauge, pipe collars and valve wheels.
  for(const [z,r,h] of [[0,2.51,2.56],[-19.6,1.16,1.9],[19.6,1.16,1.9]]){
    for(const y of [.2,h-.2])ring(0,y,z,r,steel);
    pipe(0,h*.64,z-r-.035,.20,.04,dark,'z');pipe(0,h*.64,z-r-.061,.155,.015,ivory,'z');
    const needle=box(0,h*.64+.045,z-r-.075,.02,.14,.015,dark);needle.rotation.z=-.55;
    ring(r+.035,.65,z,.18,yellow,'x');pipe(r+.035,.65,z,.035,.36,yellow,'z');
  }
  // Riveted mezzanine fascia and nonslip deck strips, never across ladder holes.
  for(const s of [-1,1]){
    for(let z=-8;z<=8;z+=1.5){box(s*15,3.29,z,8.35,.015,.045,dark);box(s*19.63,3.09,z,.04,.09,.09,ivory)}
    for(const z of [-9.56,9.56])for(let x=11;x<=19;x+=1)box(s*x,3.08,z,.08,.10,.025,ivory);
    for(const z of [-4.5,4.5])for(const dx of [-.65,.65])box(s*16.5+dx,3.63,z,.09,.82,1.49,dark);
  }
  for(let x=-9;x<=9;x+=.7)box(x,6.231,0,.035,.015,2.95,dark);
  // Layered packing crates: boards, straps and recessed shipping labels.
  for(const [x,z,w,d,h] of [[-10,-14,2.5,2.2,1.7],[10,14,2.5,2.2,1.7],[-10,13,2.1,2.7,2.1],[10,-13,2.1,2.7,2.1],[-15,-15,2.7,2.4,1.3],[15,15,2.7,2.4,1.3],[-15,15,2.7,2.4,1.3],[15,-15,2.7,2.4,1.3],[-18,-2,2.3,1.8,1.6],[18,2,2.3,1.8,1.6],[-18,6,1.8,2.3,1.4],[18,-6,1.8,2.3,1.4]]){
    for(const s of [-1,1]){
      for(let i=0;i<4;i++)box(x,h*(i+.5)/4,z+s*(d/2+.012),w-.08,h/4-.045,.024,0xa77b51,'grain');
      for(const dx of [-w*.32,w*.32])box(x+dx,h/2,z+s*(d/2+.036),.09,h,.025,dark);
    }
    box(x,h*.7,z-d/2-.04,w*.25,.23,.025,ivory);
  }
  // Overhead truss webs and repeated collars add scale without another light pass.
  for(const z of [-18.5,18.5]){
    box(0,7.45,z,44,.13,.2,steel);
    for(let x=-20;x<=20;x+=4){const web=box(x,7.12,z,1.1,.07,.12,steel);web.rotation.z=.65;ring(x,6.85,z,.18,yellow,'x')}
  }
}
