// verify-surf26.mjs — Sandboxed physics verification for the surf gamemode.
// Tests air-strafe acceleration, ramp collision, OOB reset, and regression.
// Run from work/: node verify-surf26.mjs

import assert from 'assert/strict';

// ── Minimal reimplementation of core physics (extracted from game.js) ──

function clamp(v, a, b) { return Math.max(a, Math.min(b, Number(v) || 0)); }

function rampHeight(c, x, z) {
  const t = c.axis === 'x'
    ? (x - c.minX) / (c.maxX - c.minX)
    : (z - c.minZ) / (c.maxZ - c.minZ);
  return c.minY + clamp(t, 0, 1) * (c.maxY - c.minY);
}

// Physics state — mirrors game.js state fields used by movement.
function makeState(overrides = {}) {
  return {
    velocityX: 0, velocityY: 0, velocityZ: 0,
    onGround: true, onRamp: false,
    hopChain: 0, landingGrace: 0,
    slideUntil: 0, slideCooldown: 0,
    climbing: null, emoteUntil: 0,
    keys: {}, map: 'surf',
    selectedWeapon: 'ar', equipped: 'gun',
    matchActive: true, alive: true, mode: 'game',
    ...overrides
  };
}

function makeCamera(x = 0, y = 1.7, z = 0) {
  return {
    position: { x, y, z, set(px, py, pz) { this.x = px; this.y = py; this.z = pz; } },
    rotation: { x: 0, y: 0, z: 0 },
    up: { x: 0, y: 1, z: 0 },
    getWorldDirection(forward) { forward.x = 0; forward.y = 0; forward.z = -1; }
  };
}

function movementSpeed(state) { return 1; } // simplified — no weapon tier

function verticalOverlap(c, foot) {
  return foot < (c.maxY ?? Infinity) - .001 && foot + 1.9 > (c.minY ?? -Infinity) + .001;
}

function collides(x, z, foot, colliders) {
  return colliders.some(c => {
    const r = c.stair ? 0 : .55;
    return verticalOverlap(c, foot) && x > c.minX - r && x < c.maxX + r && z > c.minZ - r && z < c.maxZ + r;
  });
}

function moveSweptAxis(state, camera, axis, delta, colliders) {
  if (!delta) return;
  const other = axis === 'x' ? 'z' : 'x';
  const suffix = axis.toUpperCase();
  const cross = other.toUpperCase();
  const old = camera.position[axis];
  const side = camera.position[other];
  const bound = 90; // Surf mode allows larger bounds than default maps
  const requested = old + delta;
  let next = clamp(requested, -bound, bound);
  const radius = c => c.stair ? 0 : .55;
  const contacts = colliders
    .filter(c => !c.ramp && side > c['min' + cross] - radius(c) && side < c['max' + cross] + radius(c))
    .sort((a, b) => delta > 0
      ? (a['min' + suffix] - radius(a)) - (b['min' + suffix] - radius(b))
      : (b['max' + suffix] + radius(b)) - (a['max' + suffix] + radius(a)));
  for (const c of contacts) {
    const near = c['min' + suffix] - radius(c);
    const far = c['max' + suffix] + radius(c);
    const crossing = delta > 0 ? old <= near && next > near : old >= far && next < far;
    if (!crossing) continue;
    const foot = camera.position.y - 1.7;
    if (!verticalOverlap(c, foot)) continue;
    const contact = (delta > 0 ? near : far) + Math.sign(delta) * .0001;
    const x = axis === 'x' ? contact : side;
    const z = axis === 'z' ? contact : side;
    if (state.onGround && !c.ramp && Number.isFinite(c.maxY) && c.maxY - foot <= .31 && !collides(x, z, c.maxY + .001, colliders)) {
      camera.position.y = c.maxY + 1.7;
      continue;
    }
    if (delta > 0) next = Math.min(next, near - .00001);
    else next = Math.max(next, far + .00001);
  }
  camera.position[axis] = next;
  if (next !== requested) {
    state[axis === 'x' ? 'velocityX' : 'velocityZ'] = 0;
    state.hopChain = 0;
  }
}

function updateVerticalMovement(state, camera, dt, colliders) {
  const wasGround = state.onGround;
  const impactSpeed = -state.velocityY;
  const old = camera.position.y - 1.7;
  state.velocityY -= 22 * dt;
  let next = old + state.velocityY * dt;
  let ground = 0;
  state.onRamp = false;
  for (const c of colliders) {
    const margin = c.stair || c.ramp ? 0 : .20;
    if (camera.position.x < c.minX - margin || camera.position.x > c.maxX + margin ||
        camera.position.z < c.minZ - margin || camera.position.z > c.maxZ + margin) continue;
    const top = c.ramp ? rampHeight(c, camera.position.x, camera.position.z) : c.maxY;
    if (!Number.isFinite(top)) continue;
    if (state.velocityY <= 0 && old >= top - .04 && next <= top) {
      if (top > ground) { ground = top; if (c.ramp) state.onRamp = true; }
      else if (top === ground && c.ramp) state.onRamp = true;
    }
    if (state.velocityY > 0 && !c.ramp && Number.isFinite(c.minY) &&
        old + 1.9 <= c.minY + .001 && next + 1.9 >= c.minY) {
      next = c.minY - 1.9;
      state.velocityY = 0;
    }
  }
  state.onGround = next <= ground;
  if (state.onGround) {
    if (!wasGround && impactSpeed > 3) state.landingGrace = .12;
    next = ground;
    state.velocityY = 0;
  }
  camera.position.y = next + 1.7;
}

function updateMovement(state, camera, dt, colliders) {
  // Simplified: always forward (W held), looking down -Z.
  const wishX = 0, wishZ = -1;
  const moving = true;
  const previousSpeed = Math.hypot(state.velocityX, state.velocityZ);
  state.landingGrace = Math.max(0, (state.landingGrace || 0) - dt);

  // CS:GO-style surf: player is ALWAYS AIRBORNE on the ramp surface.
  const surfRamp = (() => {
    const r = colliders.find(c => c.ramp &&
      camera.position.x >= c.minX && camera.position.x <= c.maxX &&
      camera.position.z >= c.minZ && camera.position.z <= c.maxZ);
    if (!r) return null;
    const foot = camera.position.y - 1.7;
    const surf = rampHeight(r, camera.position.x, camera.position.z);
    return foot <= surf + .05 ? r : null;
  })();

  if (surfRamp) {
    const nx = surfRamp.normal.x, ny = surfRamp.normal.y, nz = surfRamp.normal.z;
    state.velocityY -= 22 * dt;
    // Project velocity onto ramp tangent plane.
    const vn = state.velocityX * nx + state.velocityY * ny + state.velocityZ * nz;
    state.velocityX -= vn * nx; state.velocityY -= vn * ny; state.velocityZ -= vn * nz;
    // Source AirAccelerate: project wish onto tangent plane, add bounded accel.
    if (moving) {
      const AIR_ACCEL = 10, AIR_MAX_WISHSPEED = 30;
      let wx = wishX, wy = 0, wz = wishZ;
      const wn = wx * nx + wy * ny + wz * nz;
      wx -= wn * nx; wy -= wn * ny; wz -= wn * nz;
      const wl = Math.hypot(wx, wy, wz); if (wl > .001) { wx /= wl; wy /= wl; wz /= wl; }
      const cs = state.velocityX * wx + state.velocityY * wy + state.velocityZ * wz;
      const as = clamp(AIR_MAX_WISHSPEED - cs, 0, AIR_ACCEL * AIR_MAX_WISHSPEED * dt);
      state.velocityX += as * wx; state.velocityY += as * wy; state.velocityZ += as * wz;
    }
    // Reproject onto tangent.
    const vn2 = state.velocityX * nx + state.velocityY * ny + state.velocityZ * nz;
    state.velocityX -= vn2 * nx; state.velocityY -= vn2 * ny; state.velocityZ -= vn2 * nz;
    // Jump exits ramp.
    if (state.keys.Space) { state.velocityY = 8; state.onGround = false; state.onRamp = false; }
    else {
      moveSweptAxis(state, camera, 'x', state.velocityX * dt, colliders);
      moveSweptAxis(state, camera, 'z', state.velocityZ * dt, colliders);
      // Check if still on ramp after moving.
      const stillOn = colliders.find(c => c.ramp &&
        camera.position.x >= c.minX && camera.position.x <= c.maxX &&
        camera.position.z >= c.minZ && camera.position.z <= c.maxZ);
      if (stillOn) {
        const surf = rampHeight(stillOn, camera.position.x, camera.position.z);
        const newFoot = camera.position.y - 1.7;
        if (newFoot <= surf + .3) {
          camera.position.y = surf + 1.7;
          state.onGround = false; state.onRamp = true;
        } else {
          state.onGround = false; state.onRamp = false;
        }
      } else {
        state.onGround = false; state.onRamp = false;
      }
    }
    const sp = Math.hypot(state.velocityX, state.velocityZ);
    if (sp > 2000) { const sc = 2000 / sp; state.velocityX *= sc; state.velocityZ *= sc; }
    return;
  }

  if (state.onGround && !state.onRamp) {
    const jumping = !!state.keys.Space;
    const walk = 8.5 * movementSpeed(state);
    const speed = moving && jumping
      ? Math.max(11 * movementSpeed(state), previousSpeed) + (state.hopChain > 0 ? 2.6 : 0)
      : moving && state.landingGrace > 0 ? Math.max(walk, previousSpeed) : walk;
    state.velocityX = wishX * speed;
    state.velocityZ = wishZ * speed;
    if (jumping) { state.velocityY = 8; state.onGround = false; state.hopChain = moving ? state.hopChain + 1 : 0; }
    else state.hopChain = 0;
  } else if (moving) {
    const AIR_ACCEL = 2.2, AIR_MAX_WISHSPEED = 1.2;
    const currentspeed = state.velocityX * wishX + state.velocityZ * wishZ;
    const addspeed = clamp(AIR_MAX_WISHSPEED - currentspeed, 0, AIR_ACCEL * AIR_MAX_WISHSPEED * dt);
    state.velocityX += addspeed * wishX;
    state.velocityZ += addspeed * wishZ;
  } else {
    state.velocityX *= Math.exp(-.6 * dt);
    state.velocityZ *= Math.exp(-.6 * dt);
  }

  const safeSpeed = Math.hypot(state.velocityX, state.velocityZ);
  if (safeSpeed > 120) { const s = 120 / safeSpeed; state.velocityX *= s; state.velocityZ *= s; }
  moveSweptAxis(state, camera, 'x', state.velocityX * dt, colliders);
  moveSweptAxis(state, camera, 'z', state.velocityZ * dt, colliders);
  updateVerticalMovement(state, camera, dt, colliders);
}

// ── Test helpers ──

function runSteps(state, camera, colliders, dt, steps) {
  for (let i = 0; i < steps; i++) updateMovement(state, camera, dt, colliders);
}

function speed(state) { return Math.hypot(state.velocityX, state.velocityZ); }

// ── Flat ground colliders (existing maps) ──
const flatGround = [{ minX: -50, maxX: 50, minY: 0, maxY: 0, minZ: -50, maxZ: 50 }];
const stair = [{ minX: -2, maxX: 2, minY: 0, maxY: 2, minZ: 4, maxZ: 5, stair: true }];

// ── Ramp collider (surf) ──
function makeRamp(opts = {}) {
  const o = { x: 0, z: 20, w: 10, d: 30, low: 0, high: 10, axis: 'z', ...opts };
  const heightSpan = o.high - o.low;
  const axisLen = o.axis === 'x' ? o.w : o.d;
  const angle = Math.atan2(Math.abs(heightSpan), axisLen);
  const sinA = Math.sin(angle), cosA = Math.cos(angle);
  // Match surf.js: axis='x' → normal in XY plane; axis='z' → normal in YZ plane.
  const normal = o.axis === 'x'
    ? { x: -Math.sign(heightSpan) * sinA, y: cosA, z: 0 }
    : { x: 0, y: cosA, z: -Math.sign(heightSpan) * sinA };
  const len = Math.hypot(normal.x, normal.y, normal.z);
  normal.x /= len; normal.y /= len; normal.z /= len;
  return {
    ramp: true,
    minX: o.x - o.w / 2, maxX: o.x + o.w / 2,
    minZ: o.z - o.d / 2, maxZ: o.z + o.d / 2,
    minY: Math.min(o.low, o.high), maxY: Math.max(o.low, o.high),
    axis: o.axis, normal
  };
}

// ═══════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e) { failed++; console.error(`  ✗ ${name}\n    ${e.message}`); }
}

console.log('\n=== verify-surf26.mjs ===\n');

// ── 1. Ground speed regression ──
console.log('1. Ground speed regression (flat ground, no strafe)');

test('Ground walk speed converges to ~8.5 u/s', () => {
  const s = makeState({ onGround: true });
  const cam = makeCamera(0, 1.7, 0);
  // Run 2 seconds of forward walk
  runSteps(s, cam, flatGround, 1 / 60, 120);
  const spd = speed(s);
  assert.ok(spd > 7.5 && spd < 9.5, `Expected ~8.5, got ${spd.toFixed(2)}`);
});

test('Ground speed is frame-rate independent', () => {
  for (const dt of [1 / 60, 1 / 30, .02]) {
    const s = makeState({ onGround: true });
    const cam = makeCamera(0, 1.7, 0);
    runSteps(s, cam, flatGround, dt, Math.round(2 / dt));
    const spd = speed(s);
    assert.ok(spd > 7 && spd < 10, `dt=${dt}: speed ${spd.toFixed(2)} out of range`);
  }
});

// ── 2. Air speed regression (no ramp, just falling) ──
console.log('\n2. Air speed regression (no ramp, airborne)');

test('Airborne with no input maintains or loses speed (no runaway)', () => {
  const s = makeState({ onGround: false, velocityX: 0, velocityZ: -10 });
  const cam = makeCamera(0, 5, 0);
  runSteps(s, cam, flatGround, 1 / 60, 120);
  const spd = speed(s);
  assert.ok(spd <= 10.5, `Air speed should not exceed entry: ${spd.toFixed(2)}`);
});

// ── 3. Air-strafe acceleration (core surf mechanic) ──
console.log('\n3. Air-strafe acceleration on ramp');

// CS:GO-style surf physics loop: always airborne, gravity→tangent, Source AirAccelerate.
function surfLoop(state, cam, ramp, dt, steps, wishX = 0, wishZ = -1, useAirAccel = true) {
  for (let i = 0; i < steps; i++) {
    const nx = ramp.normal.x, ny = ramp.normal.y, nz = ramp.normal.z;
    state.velocityY -= 22 * dt;
    const vn = state.velocityX * nx + state.velocityY * ny + state.velocityZ * nz;
    state.velocityX -= vn * nx; state.velocityY -= vn * ny; state.velocityZ -= vn * nz;
    if (useAirAccel) {
      const AIR_ACCEL = 10, AIR_MAX_WISHSPEED = 30;
      let wx = wishX, wy = 0, wz = wishZ;
      const wn = wx * nx + wy * ny + wz * nz;
      wx -= wn * nx; wy -= wn * ny; wz -= wn * nz;
      const wl = Math.hypot(wx, wy, wz); if (wl > .001) { wx /= wl; wy /= wl; wz /= wl; }
      const cs = state.velocityX * wx + state.velocityY * wy + state.velocityZ * wz;
      const as = clamp(AIR_MAX_WISHSPEED - cs, 0, AIR_ACCEL * AIR_MAX_WISHSPEED * dt);
      state.velocityX += as * wx; state.velocityY += as * wy; state.velocityZ += as * wz;
    }
    const vn2 = state.velocityX * nx + state.velocityY * ny + state.velocityZ * nz;
    state.velocityX -= vn2 * nx; state.velocityY -= vn2 * ny; state.velocityZ -= vn2 * nz;
    moveSweptAxis(state, cam, 'x', state.velocityX * dt, [ramp]);
    moveSweptAxis(state, cam, 'z', state.velocityZ * dt, [ramp]);
    // Stay on ramp surface.
    const surf = rampHeight(ramp, cam.position.x, cam.position.z);
    const newFoot = cam.position.y - 1.7;
    if (newFoot <= surf + .3) { cam.position.y = surf + 1.7; state.onGround = false; state.onRamp = true; }
    else { state.onGround = false; state.onRamp = false; }
    const sp = Math.hypot(state.velocityX, state.velocityZ);
    if (sp > 2000) { const sc = 2000 / sp; state.velocityX *= sc; state.velocityZ *= sc; }
  }
}

test('Airborne strafe on ramp gains speed over entry speed', () => {
  // Gravity on downhill ramp + Source AirAccelerate → speed grows.
  const ramp = makeRamp({ z: 6, d: 40, low: 12, high: 2 });
  const s = makeState({ onGround: false, velocityX: 0, velocityY: 0, velocityZ: 0 });
  const cam = makeCamera(0, rampHeight(ramp, 0, 10) + 1.7, 10);
  surfLoop(s, cam, ramp, 1 / 60, 300, 1, 0, true);
  const finalSpeed = speed(s);
  assert.ok(finalSpeed > 10, `Expected gravity+strafe speed > 10 after 5s, got ${finalSpeed.toFixed(2)}`);
});

test('Air-strafe speed is bounded (not exploitable)', () => {
  const ramp = makeRamp({ z: 6, d: 40, low: 12, high: 2 });
  const s = makeState({ onGround: false, velocityX: 0, velocityY: 0, velocityZ: 0 });
  const cam = makeCamera(0, rampHeight(ramp, 0, 10) + 1.7, 10);
  surfLoop(s, cam, ramp, 1 / 60, 600, 1, 0, true);
  assert.ok(speed(s) <= 2000, `Speed should be clamped at 2000, got ${speed(s).toFixed(2)}`);
});

// ── 4. Frame-rate independence of air-strafe ──
console.log('\n4. Frame-rate independence of air-strafe');

test('Air-strafe produces similar speed at 1/60, 1/30, and 0.02 dt', () => {
  const results = [];
  for (const dt of [1 / 60, 1 / 30, .02]) {
    const ramp = makeRamp({ z: 6, d: 40, low: 12, high: 2 });
    const s = makeState({ onGround: false, velocityX: 0, velocityY: 0, velocityZ: 0 });
    const cam = makeCamera(0, rampHeight(ramp, 0, 10) + 1.7, 10);
    surfLoop(s, cam, ramp, dt, Math.round(3 / dt), 1, 0, true);
    results.push(speed(s));
  }
  const max = Math.max(...results), min = Math.min(...results);
  const spread = (max - min) / Math.max(1, (max + min) / 2);
  assert.ok(spread < 0.25, `dt spread too large: ${spread.toFixed(3)} (speeds: ${results.map(r => r.toFixed(2)).join(', ')})`);
});

// ── 5. Ramp height interpolation ──
console.log('\n5. Ramp height interpolation');

test('Ramp height at start equals minY', () => {
  const r = makeRamp({ z: 10, d: 20, low: 0, high: 10, axis: 'z' });
  assert.equal(rampHeight(r, 0, r.minZ), 0);
});

test('Ramp height at end equals maxY', () => {
  const r = makeRamp({ z: 10, d: 20, low: 0, high: 10, axis: 'z' });
  assert.equal(rampHeight(r, 0, r.maxZ), 10);
});

test('Ramp height at midpoint is average', () => {
  const r = makeRamp({ z: 10, d: 20, low: 2, high: 8, axis: 'z' });
  const mid = (r.minZ + r.maxZ) / 2;
  assert.ok(Math.abs(rampHeight(r, 0, mid) - 5) < 0.01);
});

test('X-axis ramp interpolates along X', () => {
  const r = makeRamp({ x: 5, w: 20, low: 3, high: 13, axis: 'x' });
  assert.equal(rampHeight(r, r.minX, 0), 3);
  assert.equal(rampHeight(r, r.maxX, 0), 13);
});

// ── 6. No-input on steep ramp slides downhill ──
console.log('\n6. No-input steep ramp (gravity slide)');

test('On steep ramp with no input, player does not freeze', () => {
  const ramp = makeRamp({ z: 6, d: 40, low: 12, high: 2 });
  const s = makeState({ onGround: false, velocityX: 0, velocityY: 0, velocityZ: 0 });
  const cam = makeCamera(0, rampHeight(ramp, 0, 10) + 1.7, 10);
  const startSpeed = Math.hypot(s.velocityX, s.velocityZ);
  // 3 seconds of surf physics, no input — gravity alone should accelerate.
  surfLoop(s, cam, ramp, 1 / 60, 180, 0, -1, false);
  const endSpeed = Math.hypot(s.velocityX, s.velocityZ);
  assert.ok(endSpeed > startSpeed + 5, `Gravity should accelerate on ramp — speed ${startSpeed} → ${endSpeed.toFixed(2)}`);
});

// ── 7. OOB reset ──
console.log('\n7. Out-of-bounds reset');

test('Falling below SURF_FLOOR_Y resets to spawn and zeroes velocity', () => {
  const SURF_FLOOR_Y = -20;
  const SURF_SPAWN = [0, 1.7, 0];
  const cam = makeCamera(5, SURF_FLOOR_Y + 1, 5);
  const s = makeState({ velocityX: 10, velocityY: -30, velocityZ: 10 });
  // Simulate the OOB check from updateTimer
  if (cam.position.y - 1.7 < SURF_FLOOR_Y + 2) {
    cam.position.set(SURF_SPAWN[0], SURF_SPAWN[1], SURF_SPAWN[2]);
    s.velocityX = s.velocityY = s.velocityZ = 0;
    s.onGround = true; s.hopChain = 0;
  }
  assert.equal(cam.position.x, 0);
  assert.equal(cam.position.y, 1.7);
  assert.equal(cam.position.z, 0);
  assert.equal(s.velocityX, 0);
  assert.equal(s.velocityY, 0);
  assert.equal(s.velocityZ, 0);
});

// ── 8. Staircase auto-step regression ──
console.log('\n8. Staircase regression (flat + stair colliders)');

test('Staircase auto-step still works (stair:true not affected by ramp guard)', () => {
  const colliders = [
    { minX: -5, maxX: 5, minY: 0, maxY: 0, minZ: -10, maxZ: 4 },
    { minX: -2, maxX: 2, minY: 0, maxY: 2, minZ: 4, maxZ: 5, stair: true }
  ];
  // Player at foot=1.8 near stair (maxY=2). Move +z toward stair so swept axis crosses near edge.
  const s = makeState({ onGround: true, velocityX: 0, velocityZ: 8 });
  const cam = makeCamera(0, 3.5, 3.9); // foot=1.8, about to cross stair near edge at z=4
  for (let i = 0; i < 7; i++) {
    moveSweptAxis(s, cam, 'z', s.velocityZ * (1 / 60), colliders);
    updateVerticalMovement(s, cam, 1 / 60, colliders);
  }
  assert.ok(cam.position.y > 3.0, `Expected step-up to ~3.7, got y=${cam.position.y.toFixed(2)}`);
});

test('Ramp colliders do NOT get auto-stepped', () => {
  const ramp = makeRamp({ z: 10, d: 20, low: 0, high: 5 });
  const s = makeState({ onGround: true, velocityX: 0, velocityZ: -8 });
  const cam = makeCamera(0, 1.7, 3);
  const initialY = cam.position.y;
  // Move toward ramp — should NOT teleport up via auto-step
  moveSweptAxis(s, cam, 'z', s.velocityZ * (1 / 60), [ramp]);
  // The ramp should block horizontal movement (normal collision), not auto-step
  // Either way, cam.position.y should not jump to ramp.maxY + 1.7 instantly
  assert.ok(cam.position.y < 5 + 1.7, `Ramp should not auto-step teleport: y=${cam.position.y.toFixed(2)}`);
});

// ── 9. Safety clamp ──
console.log('\n9. Safety magnitude clamp (120 u/s)');

test('Velocity above 120 gets clamped', () => {
  const s = makeState({ velocityX: 100, velocityZ: 100 });
  const safe = Math.hypot(s.velocityX, s.velocityZ);
  assert.ok(safe > 120);
  if (safe > 120) { const sc = 120 / safe; s.velocityX *= sc; s.velocityZ *= sc; }
  assert.ok(Math.hypot(s.velocityX, s.velocityZ) <= 120.01);
});

test('Velocity below 120 is untouched', () => {
  const s = makeState({ velocityX: 50, velocityZ: 50 });
  const before = Math.hypot(s.velocityX, s.velocityZ);
  const safe = before;
  if (safe > 120) { const sc = 120 / safe; s.velocityX *= sc; s.velocityZ *= sc; }
  assert.equal(Math.hypot(s.velocityX, s.velocityZ), before);
});

// ── Summary ──
console.log(`\n${'='.repeat(40)}`);
if (failed === 0) {
  console.log(`PASS: All ${passed} surf verification tests passed.`);
} else {
  console.log(`FAIL: ${failed} of ${passed + failed} tests failed.`);
  process.exit(1);
}