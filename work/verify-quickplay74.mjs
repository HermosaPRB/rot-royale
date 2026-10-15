import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import vm from 'node:vm';
import { matchmaking, PROTOCOL, LEASE } from '../lib/matchmaking.mjs';
import { QuickPlayQueue } from '../dist/quickplay.js';

// Execute the real migration and every production SQL statement in SQLite.
const sql = new DatabaseSync(':memory:'); sql.exec('PRAGMA foreign_keys=ON');
sql.exec(readFileSync(new URL('../drizzle/0000_shocking_epoch.sql', import.meta.url), 'utf8'));
const db = {
  prepare(query) { let args=[]; return {
    bind(...values) { args=values; return this; },
    async first() { return sql.prepare(query).get(...args) || null; },
    async run() { return { meta: sql.prepare(query).run(...args) }; },
    query, get args() { return args; },
  }; },
  async batch(statements) {
    sql.exec('BEGIN');
    try { const results=statements.map(s=>({results:sql.prepare(s.query).all(...s.args)}));sql.exec('COMMIT');return results; }
    catch(e){sql.exec('ROLLBACK');throw e;}
  },
};
let now=100000;
const call=async (token,action,extra={},headers={})=>{
  const response=await matchmaking(new Request('https://game.test/api/quickplay',{method:'POST',headers:{'content-type':'application/json',origin:'https://game.test',...headers},body:JSON.stringify({token,action,protocol:PROTOCOL,...extra})}),db,now);
  return {status:response.status,...await response.json()};
};
const tokens=Array.from({length:20},()=>crypto.randomUUID());
const rooms=await Promise.all(tokens.map((t,i)=>call(t,'join',{peer:`player-${i}`,map:'neon'})));
assert.ok(rooms.every(r=>r.status===200));
assert.equal(new Set(rooms.map(r=>r.id)).size,4);
assert.deepEqual(sql.prepare('SELECT COUNT(*) n FROM quick_seats GROUP BY room ORDER BY n DESC').all().map(r=>r.n),[6,6,6,2]);
assert.equal(rooms.filter(r=>r.host).length,4,'concurrent allocation elects one host per room');
const hostIndex=rooms.findIndex(r=>r.host&&rooms.filter(other=>other.id===r.id).length===6);
const roomId=rooms[hostIndex].id,hostToken=tokens[hostIndex];
const guests=rooms.map((r,i)=>({r,i})).filter(({r})=>r.id===roomId&&!r.host).map(({i})=>i);
const guestToken=tokens[guests[0]],secondGuest=tokens[guests[1]],otherToken=tokens[rooms.findIndex(r=>r.id!==roomId)];
const repeated=await call(tokens[0],'join',{peer:'player-0',map:'neon'});
assert.equal(repeated.id,rooms[0].id);assert.equal(sql.prepare('SELECT COUNT(*) n FROM quick_seats').get().n,20);
assert.equal((await call(guestToken,'phase',{phase:'game',map:'neon'})).status,403,'guest cannot start or mutate host room');
assert.equal((await call(hostToken,'admit',{peer:'not-reserved'})).status,409);
assert.equal((await call(hostToken,'admit',{peer:`player-${guests[0]}`})).status,200);
assert.equal((await call(hostToken,'phase',{phase:'game',map:'neon'})).status,200);
assert.equal((await call(hostToken,'admit',{peer:`player-${guests[1]}`})).status,409,'late admission blocked after lock');
await call(guestToken,'leave');
const next=await call(crypto.randomUUID(),'join',{peer:'new-player',map:'factory'});
assert.notEqual(next.id,roomId,'in-progress rooms never receive new searches');
await call(hostToken,'phase',{phase:'results',map:'neon'});
await call(hostToken,'phase',{phase:'lobby',map:'piazza'});
assert.equal((await call(secondGuest,'poll')).map,'piazza','round map rotates for everyone');
await call(hostToken,'leave');
assert.equal((await call(secondGuest,'poll')).status,410,'host departure invalidates room and reservations');
const secret=await call(otherToken,'poll');
assert.equal('token' in secret,false);assert.equal(typeof secret.host,'boolean','no host capability leaked');
assert.equal((await call(otherToken,'poll',{}, {origin:'https://evil.test'})).status,403);
assert.equal((await call('broken','join',{peer:'p',map:'neon'})).status,400);
assert.equal((await call(crypto.randomUUID(),'join',{peer:'p',map:'surf'})).status,400);
assert.equal((await call(otherToken,'poll',{protocol:'old'})).status,400);
for(let i=0;i<180;i++)assert.equal((await call(otherToken,'poll',{}, {'cf-connecting-ip':'192.0.2.1'})).status,200);
assert.equal((await call(otherToken,'poll',{}, {'cf-connecting-ip':'192.0.2.1'})).status,429);
now+=LEASE+1;
assert.equal((await call(otherToken,'poll')).status,410,'stale rooms expire');
assert.equal(sql.prepare('SELECT COUNT(*) n FROM quick_rooms').get().n,0);

// Canceled fetches must not resurrect UI or leave a ghost seat.
let resolveJoin;const actions=[];
const queue=new QuickPlayQueue({fetcher:async(_url,request)=>{
  const body=JSON.parse(request.body);actions.push(body.action);
  if(body.action==='join')return new Promise(resolve=>{resolveJoin=()=>resolve(Response.json({id:'room',host:true}));});
  return Response.json({left:true});
}});
const joining=queue.join('player','neon');queue.close();resolveJoin();assert.equal(await joining,null);
assert.deepEqual(actions,['join','leave','leave']);assert.equal(queue.timer,null);
let expired=0;const failed=new QuickPlayQueue({fetcher:async()=>Response.json({error:'gone'},{status:410}),onExpired:()=>expired++});
await failed.poll();assert.equal(expired,1);failed.close();await failed.poll();assert.equal(expired,1);
console.log('PASS Quick Play: real SQL concurrent allocations, six-seat cap, idempotency, authorization, admission/start race, map rotation, cleanup, expiry, rate limit, protocol and origin checks, canceled-search races.');

const game=readFileSync(new URL('../dist/game.js',import.meta.url),'utf8');
const state={publicRoom:true,host:true,mode:'lobby',map:'neon',players:{host:{}}};
let clock=10000,starts=0,phases=[],packets=[];const elements={};
const ctx=vm.createContext({state,Date:{now:()=>clock},Object,Number,Math,
  $:id=>elements[id]??=( {} ),broadcast:packet=>packets.push(packet),
  startMatch:()=>{starts++;state.mode='game';},
  setMap:map=>state.map=map,enterLobby:()=>state.mode='lobby',
  leaveToHome:message=>{throw new Error(message);},clearInterval(){},
});
vm.runInContext(game.slice(game.indexOf('let quickQueue='),game.indexOf('\nfunction enterLobby(')),ctx);
ctx.queue={phase:async(phase,map)=>phases.push([phase,map]),close(){}};
vm.runInContext('quickQueue=queue;updateQuickPlay()',ctx);
assert.equal(vm.runInContext('quickStartAt',ctx),0,'one player never starts alone');
state.players.guest={};vm.runInContext('updateQuickPlay()',ctx);clock+=9999;vm.runInContext('updateQuickPlay()',ctx);assert.equal(starts,0);
clock++;vm.runInContext('updateQuickPlay();updateQuickPlay()',ctx);await new Promise(resolve=>setImmediate(resolve));
assert.equal(starts,1,'timer only starts a round once');assert.deepEqual(phases,[['game','neon']]);
state.mode='results';vm.runInContext('publicResults()',ctx);clock+=8000;vm.runInContext('updateQuickPlay()',ctx);await new Promise(resolve=>setImmediate(resolve));
assert.equal(state.mode,'lobby');assert.equal(state.map,'piazza');assert.equal(packets.at(-1).t,'lobby');assert.equal(packets.at(-1).map,'piazza');
let release;ctx.queue.phase=phase=>new Promise(resolve=>{release=resolve;});
vm.runInContext('quickStartAt=Date.now()-1;updateQuickPlay()',ctx);
vm.runInContext('quickQueue=null;state.publicRoom=false',ctx);release();await new Promise(resolve=>setImmediate(resolve));assert.equal(starts,1,'late phase response cannot start a canceled room');
console.log('PASS Quick Play game lifecycle: waits for two actual peers, countdown, single start, automatic map rotation and stale-response guard.');
