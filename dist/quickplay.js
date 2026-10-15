export const QUICKPLAY_PROTOCOL = 'quickplay-74';

// One capability per attempt (not an account or a persistent tracking ID).
// Late responses from a canceled search release their reservation, never rejoin UI.
export class QuickPlayQueue {
  constructor({ endpoint = '/api/quickplay', onExpired = () => {}, fetcher = globalThis.fetch.bind(globalThis) } = {}) {
    this.endpoint = endpoint; this.onExpired = onExpired; this.fetcher = fetcher;
    this.token = crypto.randomUUID(); this.closed = false; this.room = null;
    this.timer = null; this.failures = 0; this.inFlight = false;
  }
  async request(action, values = {}, keepalive = false) {
    const response = await this.fetcher(this.endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...values, action, token: this.token, protocol: QUICKPLAY_PROTOCOL }),
      cache: 'no-store', keepalive, signal: keepalive ? undefined : AbortSignal.timeout(8000),
    });
    let result;
    try { result = await response.json(); } catch { throw new Error('Quick Play is unavailable here. Open the live Rot Royale site.'); }
    if (!response.ok) { const error = new Error(result.error || 'Matchmaking connection failed.'); error.status = response.status; throw error; }
    return result;
  }
  async join(peer, map) {
    const room = await this.request('join', { peer, map });
    if (this.closed) { await this.request('leave', {}, true).catch(() => {}); return null; }
    this.room = room;
    this.timer = setInterval(() => this.poll(), 5000);
    return room;
  }
  async poll() {
    if (this.closed || this.inFlight) return;
    this.inFlight = true;
    try { const room = await this.request('poll'); if (!this.closed) { this.room = room; this.failures = 0; } }
    catch (error) { if (!this.closed && (error.status === 410 || ++this.failures >= 3)) this.onExpired(error.message); }
    finally { this.inFlight = false; }
  }
  admit(peer) { return this.request('admit', { peer }); }
  async phase(phase, map) { const room = await this.request('phase', { phase, map }); if (!this.closed) this.room = room; return room; }
  close() {
    if (this.closed) return;
    this.closed = true; clearInterval(this.timer);
    // Keepalive permits best-effort cleanup during pagehide. TTL is the fallback.
    this.request('leave', {}, true).catch(() => {});
  }
}
