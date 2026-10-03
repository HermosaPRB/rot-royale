# Airdrop — feature spec

Reference art: `work/airdrop-refs/dino-plane.png` (the plane) and `work/airdrop-refs/skibidi-toilet-gun.png` (one of the two loot items). Use them as modeling references for low-poly procedural three.js models, the same way the existing characters and guns are built. They are not textures.

## Summary
Once per match, around the 1-minute mark, an **AIRDROP** is announced. Every player sees a 2-second cinematic of a dinosaur-nosed cargo plane flying over the center of the map and dropping a crate. The crate parachutes down to the map center and stays marked on everyone's HUD until someone opens it. Inside is either an **RPG** or the **Skibidi Toilet Gun** (50/50).

## Scope
- **Maps:** Neon Town, Piazza Panic, Midnight Mozzarella. **Not Surf Circuit** (no guns there).
- **Modes:** online matches and practice-with-bots. Exactly one airdrop per match.

## 1. Timing (host-authoritative)
- At `startMatch()` the host rolls `airdropAt = matchStart + random(45s, 75s)`, centered on 60s with ±15s deviation. Matches are 180s, so the drop always lands with 90+ seconds left.
- The host stores it in a new `state.airdrop` object and includes it in `hostSnapshot()` so late joiners and reconnects sync up:
  ```js
  state.airdrop = { phase:'pending'|'broll'|'falling'|'landed'|'opened',
                    at, landAt, x, y, z, item:'rpg'|'toilet', openedBy:null }
  ```
- Clients never decide timing, the item, or who opened it. They only render `state.airdrop` and request actions.
- The item is rolled at match start but stays hidden from clients until the crate is opened. Don't broadcast `item` before the `opened` phase.

## 2. Announcement
At `airdropAt` the host broadcasts `{t:'airdrop', phase:'broll', ...}`. Every client:
- Shows a big center-screen **"AIRDROP"** banner with the subtitle "Supply crate inbound · map center". Reuse the elimination-banner styling, but in airdrop orange/yellow. It stays up for 3.5s.
- Plays a siren plus a low prop-plane drone using the existing `tone()` / procedural audio. No new audio files.
- Adds a feed line: "Airdrop inbound!"

## 3. The 2-second cinematic
Plays simultaneously for every player, from t=0 to t=2.0s after the announcement.

**Fairness rule:** while the cinematic plays, **all players are frozen and invulnerable**. The host ignores `shot`/`melee` damage, clients drop movement input, and bots pause. It's 2 seconds, everyone gets it at once, and nobody dies while their screen is taken over. Unfreeze at exactly 2.0s.

**Shot list:**
- Render from a dedicated `brollCamera` instead of the player camera, letterboxed with black bars top and bottom (CSS overlay).
- The camera sits low near the map edge, looking up toward the center at about 25m altitude, with a slow push-in.
- **0.0–1.2s:** the plane enters from one side and flies straight across the map center at about 28m altitude, roughly 30 m/s. Its props spin and it banks slightly. Pick the heading at random per match.
- **~1.0s:** the bomb-pod hatch under the belly opens and the crate drops out. Its parachute pops open about 0.3s later.
- **1.2–2.0s:** the camera tilts to follow the crate as it starts drifting down. The plane flies out of frame.
- Cut back to the player camera. The plane keeps flying off in the real world and despawns after 4s. The crate keeps falling in the real world (section 5).
- Respect `prefers-reduced-motion`: use a static wide shot with no push-in, but still show it.
- Skip the cinematic for anyone who is dead or respawning. They see it in the world when they come back.

## 4. The plane model (`airdrop-plane.js`)
Build it procedurally, low-poly, matching `dino-plane.png`:
- Olive-green camo fuselage with a row of cabin windows and a bubble cockpit.
- Long silver wings with **black speckled bands** near the tips, plus a twin-boom style tail with silver stabilizers.
- **Two engine nacelles with spinning green 3-blade propellers.** Add motion-blur discs: semi-transparent circles that fade in at speed.
- **The nose is a green dinosaur head:** a scaly snout, yellow angry eye with a heavy brow, and an open jaw with white cone teeth and a pink mouth interior.
- **A belly-mounted bomb pod** under the fuselage: green with yellow bands and a red tip. The crate drops from here.
- Merge static parts with `mergeRigidParts`, like the other models. Keep it under about 3k triangles. Build it once and cache it.

## 5. Crate fall and landing
- Landing point: the map center `(0, z)`. Raycast down from 40m at `(0,0)` against `colliders` to find the top surface: the street on Neon and Piazza, the roof on the factory. If the center is blocked by a player build, it lands on top of the build. Builds are not destroyed.
- After the cinematic, the crate descends at about 3.5 m/s under a parachute and lands about 7s later. That gives players time to rotate toward it.
- **Crate model:** a military supply crate (olive with yellow hazard stripes and a glowing orange top light), a striped parachute canopy with rope lines, and orange smoke trailing while it falls.
- On landing: a dust-puff impact effect, then the parachute collapses and fades out. A **tall orange light beacon** (an additive cylinder about 40m tall) rises from the crate until it's opened, so it can be seen across the map.
- It's a solid collider about 1.2 × 0.9 × 1.2 m that blocks movement but not shots.

## 6. "Labeled on the map" (HUD marker)
The game has no minimap, so "labeled" means a world-tracked HUD marker:
- An orange diamond icon labeled **"AIRDROP · 42m"**, projected from the crate's world position to screen space.
- When the crate is off-screen or behind you, the marker clamps to the screen edge and points toward it.
- It's visible to all living players from the announcement until the crate is opened. During the fall it tracks the falling crate.
- It hides while the sniper is scoped in, the same way the crosshair does.
- Optional stretch goal, out of scope for v1: a real minimap with an airdrop pin.

## 7. Opening
- Walk within 2.2m and **hold E for 1.5s**. E is already `interactOrEmote()`; the airdrop takes priority over emote when you're in range.
- Show a circular progress ring with the prompt "HOLD E · OPEN AIRDROP".
- The hold is canceled by moving out of range, taking damage, firing, or dying. It restarts from 0.
- The client sends `{t:'openAirdrop'}`. The **host validates** that the airdrop is landed, the player is alive, within range, and has held for at least 1.4s (the host tracks the hold start from an `{t:'openAirdropStart'}` message). The first valid player wins.
- On open: the host sets `phase:'opened'`, sets `openedBy`, reveals `item`, and broadcasts it. The crate lid pops off with a burst of confetti and sparks, the beacon and HUD marker disappear, and the feed shows "**Name** looted the RPG!" (or "...the Skibidi Toilet Gun!").
- Bots don't seek or open airdrops in v1.

## 8. Loot: special weapons
Both items are **special weapons**:
- Equipped immediately on open, as a third slot alongside the gun and melee.
- Limited ammo with no refills.
- **Lost on death**, and never offered on the respawn loadout screen.
- When ammo runs out, switch back to the player's normal gun automatically.

Add them to a new `SPECIALS` table rather than `WEAPONS`, so the respawn picker, rarities and `weaponStats` stay untouched. The host's `resolveShot` path needs a projectile branch for these.

### RPG
- **Model:** olive launch tube with a front sight, a grip, and a visible rocket warhead loaded in the front.
- **Ammo:** 1 loaded plus 2 reserve, 3 rockets total. Reload takes 2.6s and shows the rocket sliding into the tube.
- **Projectile:** a visible rocket with a smoke trail, flying at 45 m/s in a straight line. It explodes on contact with any collider, build or player, or after 80m.
- **Explosion:** host-resolved splash with a 4.5m radius. Damage is 120 at the center, falling off linearly to 25 at the edge, with a line-of-sight check from the blast center. Self-damage is 50%. It instantly destroys builds within 2m.
- **Rocket jump:** a self-hit within 3m adds upward and outward velocity to the shooter, scaled by distance.
- **Feel:** uses the `WEAPON_FEEL` system with a huge pitch kick (about 0.11 rad), screen shake, a back-blast puff out the rear of the tube, and a deep whoosh plus boom.

### Skibidi Toilet Gun
- **Model:** follows `skibidi-toilet-gun.png`. A white, chipped porcelain toilet-body blaster with hazard-stripe bands and crown decals, two glowing blue water canisters with hoses, a swirling blue vortex muzzle ring, and a toilet bowl on top with a grinning head poking out. The head bobs while idle and while firing.
- **Ammo:** 5 charges, no reload.
- **Fire:** hold to charge for 0.35s (the muzzle vortex spins up and glows), then release to launch a swirling blue water orb at 28 m/s.
- **On impact,** it creates a **flush vortex** with a 3.5m radius that lasts 1.5s:
  - Players inside are pulled toward the center (horizontal velocity of about 6 m/s, applied client-side to the affected player after the host tells them) and take 15 damage per second.
  - When the vortex ends it **pops for 45 damage** in a 2.5m radius, plus a big blue water-splash effect.
- **Direct hit** on a player: 35 damage, and the vortex spawns on them.
- **Sound:** a procedural toilet-flush gurgle on fire, plus a bubbling swirl loop while the vortex is active. Use synthesized "doo-doo" boops for the head's bob. Don't sample the meme song.

## 9. Networking messages
All are host-sent unless noted. Follow the existing `{t:...}` pattern.

| Message | Direction | Payload |
|---|---|---|
| `airdrop` | host → all | full `state.airdrop` (without `item` until opened) |
| `openAirdropStart` / `openAirdrop` | client → host | none (host uses sender id) |
| `special` | host → opener | `{item, ammo}` grants the weapon |
| `specialShot` | client → host | aim pose is already sent via `publishCombatPose` |
| `projectile` | host → all | `{id, kind:'rocket'|'orb', origin, dir, speed, born}` for rendering only |
| `explosion` / `vortex` | host → all | `{x,y,z,kind,radius,until}` |

Also include `state.airdrop` in `hostSnapshot()`. Clear it on match end, map change, and `startMatch()`.

## 10. Edge cases
- If the match ends before the crate is opened, nothing happens and it's cleared.
- If the host leaves mid-match, follow existing host-migration behavior. Whatever the snapshot says wins.
- If two players finish their hold on the same frame, the first message the host processes wins. The other player sees "Already looted."
- If the opener dies, their special weapon disappears and doesn't drop.
- If someone opens the crate during another player's cinematic, that can't happen: everyone is frozen during the cinematic and the crate is still airborne.
- On Midnight Mozzarella the drop lands on the roof. Confirm the roof is reachable (ladder or stairs). If not, land on the ground floor center instead.

## 11. Acceptance checks (add `work/verify-airdrop.mjs`, node vm harness like the other verify scripts)
1. Over 200 simulated match starts, `airdropAt - matchStart` always falls between 45s and 75s with a mean of about 60s. No airdrop on Surf.
2. Phases advance in order: pending → broll (2.0s, players frozen, damage ignored) → falling → landed → opened.
3. The landing Y equals the top collider surface at map center on each of the three maps.
4. The host rejects an open request from a player who is out of range, dead, or hasn't held long enough. It accepts a valid one, and a second open is rejected.
5. `item` is absent from every broadcast before `opened`.
6. RPG: splash damage falls off with distance, is blocked by walls, self-damage is 50%, and ammo goes 3 → 0, then the player auto-switches back to their gun.
7. Toilet gun: the vortex pulls targets inward, deals tick damage plus the final pop, and has 5 charges.
8. Special weapons are cleared on death and never appear in the respawn loadout.
9. Manual check in the browser: the banner, the 2s cinematic with the plane and crate, the HUD marker clamping to the screen edge, the beacon, the hold-E ring, and both weapons firing. No console errors.

## 12. Files likely touched
- `dist/game.js`: airdrop state machine, cinematic camera, HUD marker, open interaction, specials, projectiles.
- New `dist/airdrop-plane.js`: plane, crate, parachute, beacon models.
- `dist/combat-models.js`: RPG and Skibidi Toilet Gun first-person and held models.
- `dist/index.html` and `dist/interface.css`: banner, letterbox, marker, hold ring. Bump the `?v=` cache-busters.
