import { env } from 'cloudflare:workers';
import { matchmaking } from '../../../lib/matchmaking.mjs';
export async function POST(request: Request) {
  try { return await matchmaking(request, env.DB); }
  catch (error) {
    console.error('Quick Play request failed', error instanceof Error ? error.message : 'unknown');
    return Response.json({ error: 'Matchmaking is temporarily unavailable. Try again shortly.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
