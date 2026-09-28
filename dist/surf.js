import * as THREE from 'three';

// Surf course constants — referenced by game.js for OOB checks.
export const SURF_FLOOR_Y = -30;
export const SURF_SPAWN = [0, 17.7, -5];

// Build a CS:GO-style surf ramp: angled surface, player rides it while airborne.
function addRamp(world, colliders, shotBlockers, mat, {x, z, w, d, axis, low, high, color, glow}) {
  const heightSpan = high - low;
  const axisLen = axis === 'x' ? w : d;
  const angle = Math.atan2(Math.abs(heightSpan), axisLen);
  const sinA = Math.sin(angle), cosA = Math.cos(angle);

  // axis='x' → normal in XY plane; axis='z' → normal in YZ plane.
  const normal = axis === 'x'
    ? new THREE.Vector3(-Math.sign(heightSpan) * sinA, cosA, 0).normalize()
    : new THREE.Vector3(0, cosA, -Math.sign(heightSpan) * sinA).normalize();

  const minH = Math.min(low, high), maxH = Math.max(low, high);
  const centerH = (minH + maxH) / 2;
  const rampH = maxH - minH + 0.02;

  colliders.push({
    ramp: true,
    minX: x - w / 2, maxX: x + w / 2,
    minZ: z - d / 2, maxZ: z + d / 2,
    minY: minH, maxY: maxH,
    axis, normal
  });

  // Surfable surface: tilted box.
  const geo = new THREE.BoxGeometry(w, rampH, d);
  const surfMat = new THREE.MeshStandardMaterial({color, roughness: .45, metalness: .35, transparent: true, opacity: .9});
  const mesh = new THREE.Mesh(geo, surfMat);
  mesh.position.set(x, centerH, z);
  mesh.castShadow = mesh.receiveShadow = true;
  if (axis === 'z') mesh.rotation.x = Math.sign(heightSpan) * angle;
  else mesh.rotation.z = -Math.sign(heightSpan) * angle;
  world.add(mesh);
  shotBlockers.push(mesh);

  // Glowing edge strips along the surfable edges.
  const edgeMat = new THREE.MeshBasicMaterial({color: glow || 0x00ffcc});
  const halfW = w / 2;
  if (axis === 'z') {
    for (const side of [-1, 1]) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(.15, .15, d), edgeMat);
      strip.position.set(x + side * halfW, centerH + .05, z);
      world.add(strip);
    }
  } else {
    for (const side of [-1, 1]) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(w, .15, .15), edgeMat);
      strip.position.set(x, centerH + .05, z + side * d / 2);
      world.add(strip);
    }
  }
  return mesh;
}

// Side rail: tall thin wall along ramp edge.
function addRail(world, colliders, mat, {x, y, z, sx, sy, sz, color}) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat(color));
  mesh.position.set(x, y, z);
  mesh.castShadow = mesh.receiveShadow = true;
  world.add(mesh);
  colliders.push({minX: x - sx / 2, maxX: x + sx / 2, minY: y - sy / 2, maxY: y + sy / 2, minZ: z - sz / 2, maxZ: z + sz / 2});
  return mesh;
}

export function buildSurfMap({world, colliders, shotBlockers, mat, ladders = []}) {
  const solid = new THREE.Group();
  const decor = new THREE.Group();
  world.add(solid, decor);

  const glow = 0x00ffcc;
  const colors = {start: 0x2a5f8a, r1: 0x1a7a6a, r2: 0x1a6a8a, r3: 0x2a5a9a, r4: 0x3a4a8a, rail: 0x3a5a6a, goal: 0xc8a030, floor: 0x111a22};

  const block = (x, y, z, sx, sy, sz, color, collide = true) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat(color));
    mesh.position.set(x, y, z);
    mesh.castShadow = mesh.receiveShadow = true;
    solid.add(mesh);
    if (collide) colliders.push({minX: x - sx / 2, maxX: x + sx / 2, minY: y - sy / 2, maxY: y + sy / 2, minZ: z - sz / 2, maxZ: z + sz / 2});
    return mesh;
  };

  // Void floor.
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(300, 400), mat(colors.floor));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = SURF_FLOOR_Y;
  solid.add(ground);

  // ═══════════════════════════════════════════════════════
  // CS:GO-STYLE SURF COURSE — 45° ramps, connected transitions
  // Player jumps off start → surfs each ramp → launches to next.
  // ═══════════════════════════════════════════════════════

  // Start platform — player jumps forward onto Ramp A's top edge.
  block(0, 15.75, -5, 10, 0.5, 8, colors.start); // top y=16

  // All ramps: 45° (8u vertical over 8u horizontal), each 16u long.
  // Transitions: ramp N's end height = ramp N+1's start height (player launches across 4u gap).

  // ── Ramp A: 16→8 over z=0→16 (45°) ──
  addRamp(world, colliders, shotBlockers, mat, {
    x: 0, z: 8, w: 10, d: 16, axis: 'z', low: 16, high: 8, color: colors.r1, glow
  });
  addRail(world, colliders, mat, {x: -5.3, y: 12, z: 8, sx: .5, sy: 14, sz: 16, color: colors.rail});
  addRail(world, colliders, mat, {x: 5.3, y: 12, z: 8, sx: .5, sy: 14, sz: 16, color: colors.rail});

  // ── Ramp B: 8→0 over z=20→36 (45°) — from A's end (y=8) ──
  addRamp(world, colliders, shotBlockers, mat, {
    x: 0, z: 28, w: 10, d: 16, axis: 'z', low: 8, high: 0, color: colors.r2, glow
  });
  addRail(world, colliders, mat, {x: -5.3, y: 4, z: 28, sx: .5, sy: 14, sz: 16, color: colors.rail});
  addRail(world, colliders, mat, {x: 5.3, y: 4, z: 28, sx: .5, sy: 14, sz: 16, color: colors.rail});

  // ── Ramp C: 0→-8 over z=40→56 (45°) — from B's end (y=0) ──
  addRamp(world, colliders, shotBlockers, mat, {
    x: 0, z: 48, w: 10, d: 16, axis: 'z', low: 0, high: -8, color: colors.r3, glow
  });
  addRail(world, colliders, mat, {x: -5.3, y: -4, z: 48, sx: .5, sy: 14, sz: 16, color: colors.rail});
  addRail(world, colliders, mat, {x: 5.3, y: -4, z: 48, sx: .5, sy: 14, sz: 16, color: colors.rail});

  // ── Ramp D: -8→-16 over z=60→76 (45°) — from C's end (y=-8) ──
  addRamp(world, colliders, shotBlockers, mat, {
    x: 0, z: 68, w: 10, d: 16, axis: 'z', low: -8, high: -16, color: colors.r4, glow
  });
  addRail(world, colliders, mat, {x: -5.3, y: -12, z: 68, sx: .5, sy: 14, sz: 16, color: colors.rail});
  addRail(world, colliders, mat, {x: 5.3, y: -12, z: 68, sx: .5, sy: 14, sz: 16, color: colors.rail});

  // ── Goal platform (catches D's end at y=-16) ──
  block(0, -16.25, 82, 12, 0.5, 10, colors.goal); // top y=-16
  block(0, -13, 82, 1.5, 6, 1.5, glow, false);

  // ── Transition markers (glowing pillars between ramps) ──
  for (const z of [18, 38, 58]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.2), mat(glow));
    m.position.set(0, -1, z);
    decor.add(m);
  }

  // ── Backdrop pillars for depth ──
  for (const [px, pz] of [[-25, 10], [25, 35], [-22, 55], [22, 75]]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(3, 70, 3), mat(0x1a2a3a));
    p.position.set(px, -10, pz);
    decor.add(p);
  }

  solid.traverse(m => { if (m.isMesh) shotBlockers.push(m); });
  world.updateMatrixWorld(true);
}