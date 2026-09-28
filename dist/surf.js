import * as THREE from 'three';

// Surf course constants — referenced by game.js for spawn/out-of-bounds handling.
export const SURF_FLOOR_Y = -60;
export const SURF_SPAWN = [0, 42.7, -6];

// One continuous CS:GO-style surf ramp: a single tilted plane the player rides while
// airborne, gaining speed purely from air-strafing (never from pressing W). No gaps,
// no separate stages — this is the "simple/beginner" style: one long, honest ramp.
// heightAtMin/heightAtMax are the ACTUAL height at the collider's minZ/maxZ edge
// (order matters — do not swap these, rampHeight() in game.js interpolates linearly
// from heightAtMin at minZ to heightAtMax at maxZ).
function addRamp(world, colliders, shotBlockers, mat, {x, z, w, d, axis, heightAtMin, heightAtMax, color, glow}) {
  const heightSpan = heightAtMax - heightAtMin;
  const run = axis === 'x' ? w : d; // flat, ground-projected footprint length (matches the collider's AABB)
  const rise = Math.abs(heightSpan);
  const slopeLength = Math.hypot(run, rise); // the ramp SURFACE's actual (hypotenuse) length
  const angle = Math.atan2(rise, run);
  const sinA = Math.sin(angle), cosA = Math.cos(angle);

  // axis='x' → normal tilts in the XY plane; axis='z' → normal tilts in the YZ plane.
  const normal = axis === 'x'
    ? new THREE.Vector3(-Math.sign(heightSpan) * sinA, cosA, 0).normalize()
    : new THREE.Vector3(0, cosA, -Math.sign(heightSpan) * sinA).normalize();

  colliders.push({
    ramp: true,
    minX: x - w / 2, maxX: x + w / 2,
    minZ: z - d / 2, maxZ: z + d / 2,
    minY: Math.min(heightAtMin, heightAtMax), maxY: Math.max(heightAtMin, heightAtMax),
    heightAtMin, heightAtMax,
    axis, normal
  });

  // Surfable surface: a THIN slab sized to the slope's hypotenuse (not the flat run —
  // a box sized to the flat footprint and then rotated no longer reaches from one end
  // to the other; it foreshortens). Rotating this thin, correctly-sized slab makes its
  // footprint project back down to exactly the flat run, matching the collider above.
  const thickness = .3;
  const centerH = (heightAtMin + heightAtMax) / 2;
  const geo = axis === 'x' ? new THREE.BoxGeometry(slopeLength, thickness, d) : new THREE.BoxGeometry(w, thickness, slopeLength);
  const surfMat = new THREE.MeshStandardMaterial({color, roughness: .45, metalness: .35});
  const mesh = new THREE.Mesh(geo, surfMat);
  mesh.position.set(x, centerH, z);
  mesh.castShadow = mesh.receiveShadow = true;
  if (axis === 'z') mesh.rotation.x = -Math.sign(heightSpan) * angle;
  else mesh.rotation.z = Math.sign(heightSpan) * angle;
  world.add(mesh);
  shotBlockers.push(mesh);

  // Glowing edge strips along the surfable edges — the visual "stay between these" cue.
  // Same hypotenuse-length correction, offset along the slab's own local axes so they
  // ride flush with the (already-rotated) surface instead of being rotated separately.
  const edgeMat = new THREE.MeshBasicMaterial({color: glow || 0x00ffcc});
  if (axis === 'z') {
    for (const side of [-1, 1]) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(.15, .15, slopeLength), edgeMat);
      strip.position.set(x + side * (w / 2) + normal.x * .06, centerH + normal.y * .06, z + normal.z * .06);
      strip.rotation.x = mesh.rotation.x;
      world.add(strip);
    }
  } else {
    for (const side of [-1, 1]) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(slopeLength, .15, .15), edgeMat);
      strip.position.set(x + normal.x * .06, centerH + normal.y * .06, z + side * (d / 2) + normal.z * .06);
      strip.rotation.z = mesh.rotation.z;
      world.add(strip);
    }
  }
  return mesh;
}

// Side rail: tall thin wall keeping the player from sliding off the ramp sideways.
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
  const colors = {start: 0x2a5f8a, ramp: 0x1a7a6a, rail: 0x2f4a52, floor: 0x0d151c};

  const block = (x, y, z, sx, sy, sz, color) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat(color));
    mesh.position.set(x, y, z);
    mesh.castShadow = mesh.receiveShadow = true;
    solid.add(mesh);
    colliders.push({minX: x - sx / 2, maxX: x + sx / 2, minY: y - sy / 2, maxY: y + sy / 2, minZ: z - sz / 2, maxZ: z + sz / 2});
    return mesh;
  };

  // Void floor, well below the ramp's exit — falling off resets you back to the start
  // (see the OOB check in game.js). There is no finish line: the run just loops.
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(360, 460), mat(colors.floor));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, SURF_FLOOR_Y, 89);
  solid.add(ground);

  const RAMP_W = 12, RAMP_LEN = 190, TOP_Y = 41, BOTTOM_Y = TOP_Y - RAMP_LEN * 0.5; // 26.57° — a simple, forgiving beginner slope.

  // ── Start platform — flat ground, walk/jump onto the ramp's near edge. ──
  block(0, TOP_Y - 0.25, -6, RAMP_W, 0.5, 10, colors.start);

  // ── One continuous ramp, start to finish. Strafe left/right to gain speed. ──
  addRamp(world, colliders, shotBlockers, mat, {
    x: 0, z: 94, w: RAMP_W, d: RAMP_LEN, axis: 'z',
    heightAtMin: TOP_Y, heightAtMax: BOTTOM_Y, color: colors.ramp, glow
  });

  // ── Side rails spanning the full run, start platform through the ramp's exit. ──
  const railCenterY = (TOP_Y + 6 + BOTTOM_Y - 6) / 2, railHeight = (TOP_Y + 6) - (BOTTOM_Y - 6);
  const railCenterZ = (-11 + 189) / 2, railLength = 189 - (-11);
  for (const side of [-1, 1]) {
    addRail(world, colliders, mat, {
      x: side * (RAMP_W / 2 + 0.5), y: railCenterY, z: railCenterZ,
      sx: 1, sy: railHeight, sz: railLength, color: colors.rail
    });
  }

  // ── Progress pillars every 40 units — a simple visual pace-check down the ramp. ──
  for (let z = 20; z < RAMP_LEN - 10; z += 40) {
    const y = TOP_Y - z * 0.5;
    const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat(glow));
    m.position.set(0, y + 3, z);
    decor.add(m);
  }

  // ── Backdrop pillars for depth, flanking the whole corridor. ──
  for (let z = 0; z < RAMP_LEN; z += 45) {
    const y = TOP_Y - z * 0.5;
    for (const side of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(3, 90, 3), mat(0x14212c));
      p.position.set(side * 22, y - 20, z);
      decor.add(p);
    }
  }

  solid.traverse(m => { if (m.isMesh) shotBlockers.push(m); });
  world.updateMatrixWorld(true);
}
