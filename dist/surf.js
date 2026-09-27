import * as THREE from 'three';

// Surf course constants — referenced by game.js for OOB checks.
export const SURF_FLOOR_Y = -20;
export const SURF_SPAWN = [0, 1.7, 0];

// Build a surf ramp collider and its visual mesh.
// axis: 'x' or 'z' — the direction the slope runs along.
// low/high: the two endpoint heights.
function addRamp(world, colliders, shotBlockers, mat, {x, z, w, d, axis, low, high, color}) {
  const heightSpan = high - low;
  const axisLen = axis === 'x' ? w : d;
  const angle = Math.atan2(Math.abs(heightSpan), axisLen);
  const nx = axis === 'x' ? 0 : 0;
  const nz = axis === 'z' ? 0 : 0;
  const ny = 1;
  // Normal is perpendicular to slope surface, pointing "outward" (up-ish).
  const sinA = Math.sin(angle), cosA = Math.cos(angle);
  const normal = axis === 'x'
    ? new THREE.Vector3(0, cosA, -Math.sign(heightSpan) * sinA).normalize()
    : new THREE.Vector3(-Math.sign(heightSpan) * sinA, cosA, 0).normalize();

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

  // Visual: a tilted box — rotate around the axis perpendicular to slope direction.
  const geo = new THREE.BoxGeometry(w, rampH, d);
  const mesh = new THREE.Mesh(geo, mat(color));
  mesh.position.set(x, centerH, z);
  mesh.castShadow = mesh.receiveShadow = true;
  if (axis === 'z') mesh.rotation.x = Math.sign(heightSpan) * angle;
  else mesh.rotation.z = -Math.sign(heightSpan) * angle;
  world.add(mesh);
  shotBlockers.push(mesh);
  return mesh;
}

export function buildSurfMap({world, colliders, shotBlockers, mat, ladders = []}) {
  const solid = new THREE.Group();
  const decor = new THREE.Group();
  world.add(solid, decor);

  const palette = {
    start: 0x3a7ca5,
    ramp1: 0x2d8cba,
    ramp2: 0x2a6f9e,
    ramp3: 0x245d87,
    ramp4: 0x1e4f73,
    wall: 0x4e6e80,
    accent: 0x57c5be,
    goal: 0xf2b84b,
    floor: 0x2c3e50
  };

  // Helper: flat box with optional collision.
  const block = (x, y, z, sx, sy, sz, color, collide = true) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat(color));
    mesh.position.set(x, y, z);
    mesh.castShadow = mesh.receiveShadow = true;
    solid.add(mesh);
    if (collide) colliders.push({minX: x - sx / 2, maxX: x + sx / 2, minY: y - sy / 2, maxY: y + sy / 2, minZ: z - sz / 2, maxZ: z + sz / 2});
    return mesh;
  };

  // Ground plane (visual only, well below playable area).
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 200), mat(0x1a2a3a));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = SURF_FLOOR_Y;
  ground.receiveShadow = true;
  solid.add(ground);

  // ── Start platform ──
  block(0, 0, 0, 10, 0.4, 10, palette.start);

  // ── Segment 1: Gentle ramp (shallow slope, ~20°) ──
  // Starts at Z=5, ends at Z=35. Height goes from 0 to ~10.
  addRamp(world, colliders, shotBlockers, mat, {
    x: 0, z: 20, w: 10, d: 30,
    axis: 'z', low: 0, high: 10, color: palette.ramp1
  });
  // Side rails to keep player on course
  block(-5.2, 5, 20, 0.4, 8, 30, palette.wall);
  block(5.2, 5, 20, 0.4, 8, 30, palette.wall);

  // ── Platform 1 (rest area) ──
  block(0, 10, 37, 10, 0.4, 4, palette.floor);

  // ── Segment 2: Medium ramp (steeper, ~30°) ──
  // Curves slightly right (+X). Z=39 to Z=59. Height 10 to ~22.
  addRamp(world, colliders, shotBlockers, mat, {
    x: 0, z: 49, w: 10, d: 20,
    axis: 'z', low: 10, high: 22, color: palette.ramp2
  });
  block(-5.2, 16, 49, 0.4, 12, 20, palette.wall);
  block(5.2, 16, 49, 0.4, 12, 20, palette.wall);

  // ── Platform 2 ──
  block(0, 22, 61, 10, 0.4, 4, palette.floor);

  // ── Segment 3: Steep ramp (~45°), going the other direction (X axis) ──
  // Goes from X=-5 to X=25 at Z=63. Height 22 to ~32.
  addRamp(world, colliders, shotBlockers, mat, {
    x: 10, z: 63, w: 30, d: 10,
    axis: 'x', low: 22, high: 32, color: palette.ramp3
  });
  block(10, 27, 57.8, 30, 10, 0.4, palette.wall);
  block(10, 27, 68.2, 30, 10, 0.4, palette.wall);

  // ── Platform 3 ──
  block(27, 32, 63, 4, 0.4, 10, palette.floor);

  // ── Segment 4: Steepest ramp (~55°), back along Z ──
  // From Z=68 to Z=88. Height 32 to ~46.
  addRamp(world, colliders, shotBlockers, mat, {
    x: 27, z: 78, w: 10, d: 20,
    axis: 'z', low: 32, high: 46, color: palette.ramp4
  });
  block(21.8, 39, 78, 0.4, 14, 20, palette.wall);
  block(32.2, 39, 78, 0.4, 14, 20, palette.wall);

  // ── Goal platform (top) ──
  block(27, 46, 90, 12, 0.4, 8, palette.goal);
  // Goal accent pillar
  block(27, 49, 90, 1.2, 6, 1.2, palette.accent, false);

  // ── Decorative accent strips on ramp edges ──
  const addEdgeStrip = (x, y, z, sx, sy, sz) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat(palette.accent));
    mesh.position.set(x, y, z);
    decor.add(mesh);
  };
  // Edge markers along segment 1
  for (let i = 0; i < 5; i++) {
    addEdgeStrip(-5, i * 2 + 0.3, 5 + i * 6, 0.15, 0.6, 0.15);
    addEdgeStrip(5, i * 2 + 0.3, 5 + i * 6, 0.15, 0.6, 0.15);
  }

  // Shot blockers for visual geometry
  solid.traverse(m => { if (m.isMesh) shotBlockers.push(m); });
  world.updateMatrixWorld(true);
}