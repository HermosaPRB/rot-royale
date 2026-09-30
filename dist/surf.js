import * as THREE from 'three';

export const SURF_FLOOR_Y = -48;
export const SURF_SPAWN = [-5.5, 47, -23];
export const SURF_FINISH_Z = 217;
export const SURF_CHECKPOINTS = [
  {triggerZ: 48, spawn: [0, 25.2, 48]},
  {triggerZ: 108, spawn: [7, 18.2, 108]},
  {triggerZ: 166, spawn: [-6, 10.2, 166]}
];

// Each ramp is a real plane, banked across X and graded along Z. Gravity pulls the
// player down the bank while retained forward momentum carries them through the course.
function addSurfPlane(world, colliders, shotBlockers, {x, z, width, length, centerY, bank, grade, color, edgeColor}) {
  const hx = width / 2, hz = length / 2;
  const height = (px, pz) => centerY + bank * (px - x) + grade * (pz - z);
  const points = [
    [x - hx, height(x - hx, z - hz), z - hz],
    [x + hx, height(x + hx, z - hz), z - hz],
    [x - hx, height(x - hx, z + hz), z + hz],
    [x + hx, height(x + hx, z + hz), z + hz]
  ];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points.flat(), 3));
  geometry.setIndex([0, 2, 1, 2, 3, 1]);
  geometry.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({
    color, roughness: .32, metalness: .48, side: THREE.DoubleSide,
    emissive: new THREE.Color(color).multiplyScalar(.055)
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = mesh.receiveShadow = true;
  world.add(mesh);
  shotBlockers.push(mesh);
  const ys = points.map(p => p[1]);
  colliders.push({
    ramp: true, minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz,
    minY: Math.min(...ys), maxY: Math.max(...ys), centerX: x, centerZ: z,
    centerY, slopeX: bank, slopeZ: grade,
    normal: new THREE.Vector3(-bank, 1, -grade).normalize()
  });
  const edgeMaterial = new THREE.LineBasicMaterial({color: edgeColor});
  for (const side of [-1, 1]) {
    const px = x + side * hx;
    const edge = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(px, height(px, z - hz) + .05, z - hz),
      new THREE.Vector3(px, height(px, z + hz) + .05, z + hz)
    ]);
    world.add(new THREE.Line(edge, edgeMaterial));
  }
  return mesh;
}

function addGate(group, x, y, z, color) {
  const material = new THREE.MeshBasicMaterial({color});
  const ring = new THREE.Mesh(new THREE.TorusGeometry(5.5, .16, 8, 32), material);
  ring.position.set(x, y, z);
  ring.rotation.y = Math.PI / 2;
  group.add(ring);
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(.22, 8, .22), material);
    post.position.set(x + side * 5.5, y - 4, z);
    group.add(post);
  }
}

export function buildSurfMap({world, colliders, shotBlockers, mat}) {
  const course = new THREE.Group(), decor = new THREE.Group();
  course.name = 'surf-course';
  decor.name = 'surf-decor';
  world.add(course, decor);
  const palette = {void:0x07111d,platform:0x172f49,ramp:0x168c92,alt:0x245ab4,edge:0x4affdf,hot:0xff4fc8};
  const block = (x, y, z, sx, sy, sz, color) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat(color));
    mesh.position.set(x, y, z);
    mesh.castShadow = mesh.receiveShadow = true;
    course.add(mesh);
    colliders.push({minX:x-sx/2,maxX:x+sx/2,minY:y-sy/2,maxY:y+sy/2,minZ:z-sz/2,maxZ:z+sz/2});
    shotBlockers.push(mesh);
    return mesh;
  };
  const platform = (x, y, z, width = 15, depth = 8) => block(x, y - .25, z, width, .5, depth, palette.platform);
  const pair = ({x, z, length, centerY, grade, width = 7.5, color = palette.ramp}) => {
    addSurfPlane(course, colliders, shotBlockers, {x:x-width/2,z,width,length,centerY:centerY-4,bank:1.05,grade,color,edgeColor:palette.edge});
    addSurfPlane(course, colliders, shotBlockers, {x:x+width/2,z,width,length,centerY:centerY-4,bank:-1.05,grade,color,edgeColor:palette.edge});
  };

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(180, 310), new THREE.MeshStandardMaterial({color:palette.void,roughness:.9,metalness:.1}));
  floor.rotation.x = -Math.PI/2;
  floor.position.set(0, SURF_FLOOR_Y, 95);
  floor.receiveShadow = true;
  decor.add(floor);

  platform(0,45.3,-23,18,10);
  pair({x:0,z:14,length:56,centerY:34,grade:-.12,width:8,color:palette.ramp});
  platform(0,23.5,48,13,7);
  pair({x:7,z:79,length:50,centerY:27,grade:-.15,width:7.5,color:palette.alt});
  platform(7,16.5,108,12,7);
  pair({x:-6,z:137,length:48,centerY:19,grade:-.14,width:7,color:palette.ramp});
  platform(-6,8.5,166,11,7);
  pair({x:0,z:190,length:42,centerY:11,grade:-.12,width:6.5,color:palette.alt});
  platform(0,2.5,217,18,12);

  addGate(decor,0,27,48,palette.hot);
  addGate(decor,7,20,108,palette.hot);
  addGate(decor,-6,12,166,palette.hot);
  addGate(decor,0,8,216,0xffd84a);
  for (let z = -5; z <= 220; z += 25) {
    for (const side of [-1,1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(.7,54,.7),mat(0x10243a));
      post.position.set(side*25,-4,z);
      decor.add(post);
      const light = new THREE.Mesh(new THREE.BoxGeometry(.82,.18,4.5),new THREE.MeshBasicMaterial({color:side>0?palette.hot:palette.edge}));
      light.position.set(side*25,22,z);
      decor.add(light);
    }
  }
  const finish = new THREE.Mesh(new THREE.PlaneGeometry(16,5),new THREE.MeshBasicMaterial({color:0xffd84a,transparent:true,opacity:.24,side:THREE.DoubleSide}));
  finish.position.set(0,5.05,SURF_FINISH_Z);
  finish.rotation.x=-Math.PI/2;
  decor.add(finish);
  world.updateMatrixWorld(true);
}
