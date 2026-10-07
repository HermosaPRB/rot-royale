# Lobby audit — October 6, 2026

## Current architecture

Static frontend, default PeerJS Cloud signaling, browser-hosted simulation and WebRTC data channels. Private room codes only: no global matchmaking queue, dedicated simulation server, host migration, or managed relay credentials. Six players per room including host.

## Implemented protections

- Reserve pending seats, recheck capacity and match phase atomically when admitting a connection.
- Only the admitted connection for a peer may deliver gameplay messages.
- Ignore callbacks from previous room attempts; prevent duplicate create/join clicks.
- Time out pending admission and connection attempts after 12 seconds; release seats on close/error.
- Reject joins after a match starts rather than spawning incompletely initialized clients.
- Guard start against duplicate starts and fewer than two players.
- Preserve specific rejection messages; distinguish direct-connection timeout from room discovery failure.

## Evidence

`node work/verify-lobbies66.mjs`: 1,000 locally mocked concurrent joins, exactly five guest seats, 995 rejected attempts; seat reuse, rejected-message isolation, late join/start race and stale callback checks pass. This is a deterministic admission test, NOT a WebRTC throughput/load benchmark.

Existing verification suite passes. Two real in-app browser tabs created/discovered rooms through PeerJS but failed to establish their data channel. Both sides reported ICE `checking` with signaling stable; join timeout restored controls. No successful real online match was observed in this audit. This does not establish a production-wide outage or prove the exact network restriction. No public-service flood was performed.

## Next infrastructure stage (not implemented)

1. Managed TURN relay with short-lived credentials minted by a backend; never hardcode permanent relay secrets in the client.
2. Owned/managed signaling, connection telemetry, and staged multi-device tests across home, school and cellular networks.
3. If public Quick Play is wanted: shared queue service with idempotent tickets, cancellation, TTLs, atomic seat reservations, capacity limits and per-client rate limits. A waiting label alone is not matchmaking.
4. Dedicated authoritative match servers for consistent gameplay, host independence and stronger anti-cheat.
5. Approved load tests against infrastructure we control, recording join success, p95 join time, disconnect rate, bandwidth and host/server tick delay.

No production player-capacity claim can be made from these tests.
