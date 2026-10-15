# Quick Play (74)

## Player flow

- Quick Play creates an anonymous PeerJS peer, then asks the same-origin lobby service for a seat.
- The directory fills the oldest waiting compatible room (up to six seats), or creates a new one. The first player hosts; no bots impersonate queued humans.
- Once two peers actually connect, a ten-second countdown starts. Dropping below two cancels it. The host closes directory admission before starting the match.
- Three-minute rounds keep the existing gameplay. Results display for eight seconds, then the same group returns to a waiting lobby on the next map: Neon Town → Piazza Panic → Midnight Mozzarella.
- Cancel/Leave releases the seat. A departed host closes the room; guests get a message and can click Quick Play again. There is no host migration or mid-round backfill in this version.
- Private room codes and Practice retain their existing behavior. On GitHub Pages, Quick Play links to the server-backed live site; the static Pages copy cannot execute D1 routes.

## Architecture

The existing public Sites project now runs the supplied Vinext Worker integration with a logical D1 `DB` binding. `/api/quickplay` is a POST-only, no-store endpoint. No external service account or payment credentials are required.

`dist/` top-level files and `dist/assets/` remain the canonical game source, also used by GitHub Pages. `scripts/prepare-game.mjs` snapshots them into ignored `public/` before a framework build. Vinext clears its output directory; `scripts/restore-game.mjs` restores the same game source after building. Do not edit the game while a build is running. Generated `dist/server`, `dist/client`, and `dist/.openai` are ignored. The original static assets, URL paths, module imports, and existing gameplay are preserved.

Each search has a random per-attempt capability, stored in browser memory only. D1 stores its SHA-256 hash, peer ID, and short-lived lobby metadata—not voice/audio, names, or combat state. Join allocation is an atomic D1 batch. Hosts must validate public admissions against a reserved peer seat. Only the host capability can change phase or admit peers. Origin/content-type/protocol/size checks and short-lived hashed-IP counters constrain bad requests. Database cleanup runs on requests, so expired rows are removed on the next activity, not by a background job.

Five-second heartbeats maintain 45-second leases. Lost hosts/abandoned reservations expire; retries and late cancel responses cannot create duplicate seats. Three failed polls or an expired lease return the player home. Protocol `quickplay-74` separates incompatible client versions.

## Important limits

- This is a matchmaking directory, **not a dedicated authoritative game server**. Combat and optional voice still use existing PeerJS/WebRTC.
- No TURN relay was configured. Some cellular/school/restrictive NAT combinations can still fail to connect even after finding a room. A managed relay is the next infrastructure step.
- Hosts must keep their tab active. Mobile background suspension can expire leases. There is no skill/region matchmaking or anti-cheat guarantee.
- The anonymous limiter is a basic safeguard, not proof of production-scale abuse resistance. Shared-IP groups and heavy traffic need measured tuning; no live load test was performed.

## Verification

Use Node 24 (the new SQLite-backed test requires `node:sqlite`).

```
node work/verify-quickplay74.mjs
cd work && for f in verify-*.mjs; do node "$f" || exit 1; done
```

The new test executes the real migrations and production SQL against SQLite: 20 concurrent searches, six-seat limit, one host per room, idempotent joins, guest authorization, admission/start races, map rotation, cancellation, host departure, expiry, origin/protocol validation, and rate limiting. It also tests real game lifecycle functions for two-player minimum, countdown, single start and stale async responses.

Local browser QA: two independent sessions found the same public room, started with synchronized timers/player lists, completed a full round, then both rotated to Piazza Panic and restarted. Search cancellation returned to home. Touch-layout fixture at 844×390 fits all three play buttons. These tests were on one computer/network, not two physical phones or distinct networks.

Local backend migration uses the starter's Wrangler D1 command and `.wrangler/state`; Sites applies the committed schema migrations in production during deployment. Do not edit applied migrations.
