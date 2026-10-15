// Anonymous capability-based lobby directory. It never runs combat simulation.
// D1 batches serialize seat allocation so concurrent searches cannot overfill rooms.
export const PROTOCOL = 'quickplay-74';
export const LEASE = 45000;
const MAPS = ['neon', 'piazza', 'factory'];
const UUID = /^[a-f0-9-]{36}$/;
const PEER = /^[a-zA-Z0-9_-]{1,80}$/;
const reply = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const hash = async value => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), x => x.toString(16).padStart(2, '0')).join('');

export async function matchmaking(request, db, now = Date.now()) {
  if (request.method !== 'POST') return reply({ error: 'Use POST.' }, 405);
  if (!db) return reply({ error: 'Matchmaking is temporarily unavailable. Private rooms still work.' }, 503);
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return reply({ error: 'Origin not allowed.' }, 403);
  if (!request.headers.get('content-type')?.startsWith('application/json')) return reply({ error: 'Expected JSON.' }, 415);
  if (+request.headers.get('content-length') > 2048) return reply({ error: 'Request too large.' }, 413);
  let data;
  try { const raw = await request.text(); if (raw.length > 2048) return reply({ error: 'Request too large.' }, 413); data = JSON.parse(raw); } catch { return reply({ error: 'Invalid request.' }, 400); }
  if (!data || !UUID.test(data.token || '') || data.protocol !== PROTOCOL) return reply({ error: 'Refresh the game to use Quick Play.' }, 400);
  const token = await hash(data.token);
  // Raw IPs are never retained. Short-lived counters limit accidental loops/abuse.
  const ip = request.headers.get('cf-connecting-ip');
  if (ip) {
    const key = await hash(`${Math.floor(now / 60000)}:${ip}`);
    const limit = await db.prepare('INSERT INTO quick_limits (key,count,expires) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(key, now + 120000).first();
    if (limit.count > 180) return reply({ error: 'Too many queue requests. Try again in a minute.' }, 429);
  }
  const cleanup = [
    db.prepare('DELETE FROM quick_seats WHERE expires < ?').bind(now),
    db.prepare('DELETE FROM quick_rooms WHERE heartbeat < ?').bind(now - LEASE),
    db.prepare('DELETE FROM quick_limits WHERE expires < ?').bind(now),
  ];
  if (data.action === 'join') {
    if (!PEER.test(data.peer || '') || !MAPS.includes(data.map)) return reply({ error: 'Invalid player or map.' }, 400);
    const id = crypto.randomUUID(), code = id.replaceAll('-', '').slice(0, 6).toUpperCase();
    const available = `SELECT r.id FROM quick_rooms r WHERE r.protocol=? AND r.phase='lobby' AND r.heartbeat>=? AND (SELECT COUNT(*) FROM quick_seats s WHERE s.room=r.id AND s.expires>=?)<6 ORDER BY r.created,r.id LIMIT 1`;
    // One transaction: clean expired reservations, create only if needed, reserve.
    await db.batch([...cleanup,
      db.prepare(`INSERT INTO quick_rooms (id,code,host,peer,map,phase,protocol,created,heartbeat) SELECT ?,?,?,?,?,'lobby',?,?,? WHERE NOT EXISTS (SELECT 1 FROM quick_seats WHERE token=?) AND NOT EXISTS (${available})`).bind(id, code, token, data.peer, data.map, PROTOCOL, now, now, token, PROTOCOL, now - LEASE, now),
      db.prepare(`INSERT INTO quick_seats (token,room,peer,expires,connected) SELECT ?,r.id,?,?,CASE WHEN r.host=? THEN 1 ELSE 0 END FROM quick_rooms r WHERE r.id=(${available}) AND NOT EXISTS (SELECT 1 FROM quick_seats WHERE token=?)`).bind(token, data.peer, now + LEASE, token, PROTOCOL, now - LEASE, now, token),
    ]);
  } else {
    await db.batch(cleanup);
  }
  const seat = await db.prepare('SELECT s.room,s.peer,r.host FROM quick_seats s JOIN quick_rooms r ON r.id=s.room WHERE s.token=?').bind(token).first();
  if (!seat) return reply({ error: 'This queue expired or its host left. Find another match.' }, 410);
  const isHost = seat.host === token;
  if (data.action === 'leave') {
    if (isHost) await db.prepare('DELETE FROM quick_rooms WHERE id=? AND host=?').bind(seat.room, token).run();
    else await db.prepare('DELETE FROM quick_seats WHERE token=?').bind(token).run();
    return reply({ left: true });
  }
  if (data.action === 'admit') {
    if (!isHost || !PEER.test(data.peer || '')) return reply({ error: 'Not allowed.' }, 403);
    const admitted = await db.prepare(`UPDATE quick_seats SET connected=1,expires=? WHERE room=? AND peer=? AND expires>=? AND EXISTS(SELECT 1 FROM quick_rooms WHERE id=? AND phase='lobby') RETURNING peer`).bind(now + LEASE, seat.room, data.peer, now, seat.room).first();
    if (!admitted) return reply({ error: 'No reserved seat. Please queue again.' }, 409);
  }
  if (data.action === 'phase') {
    if (!isHost || !['lobby', 'game', 'results'].includes(data.phase) || !MAPS.includes(data.map)) return reply({ error: 'Not allowed.' }, 403);
    await db.prepare('UPDATE quick_rooms SET phase=?,map=? WHERE id=? AND host=?').bind(data.phase, data.map, seat.room, token).run();
  }
  if (!['join', 'poll', 'admit', 'phase'].includes(data.action)) return reply({ error: 'Unknown action.' }, 400);
  await db.batch([
    db.prepare('UPDATE quick_seats SET expires=? WHERE token=?').bind(now + LEASE, token),
    db.prepare('UPDATE quick_rooms SET heartbeat=? WHERE id=? AND host=?').bind(now, seat.room, token),
  ]);
  const room = await db.prepare('SELECT id,code,peer,map,phase FROM quick_rooms WHERE id=?').bind(seat.room).first();
  if (!room) return reply({ error: 'The host left. Find another match.' }, 410);
  const count = await db.prepare('SELECT COUNT(*) AS count FROM quick_seats WHERE room=? AND expires>=?').bind(seat.room, now).first();
  return reply({ ...room, host: isHost, count: count.count, capacity: 6 });
}
