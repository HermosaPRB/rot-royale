import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../dist/game.js',import.meta.url),'utf8');
const timers=new Map();let serial=0,handled=0;
class Connection{constructor(id){this.peer=id;this.metadata={name:'Player',char:'wooden',weapon:'ar'};this.events={};this.sent=[]}on(e,f){(this.events[e]??=[]).push(f)}emit(e,d){for(const f of this.events[e]||[])f(d)}send(d){this.sent.push(d)}close(){this.emit('close')}}
const state={mode:'lobby',players:{host:{id:'host'}},connections:new Map(),id:'host',room:'ABC234',map:'neon'};
const ctx=vm.createContext({state,Map,Set,Object,String,CHARACTERS:[{id:'wooden'}],WEAPONS:{ar:{}},setTimeout:f=>{timers.set(++serial,f);return serial},clearTimeout:id=>timers.delete(id),spawnFor:()=>({x:0,y:1.7,z:0}),hostSnapshot(){},updateLobby(){},handleHostMessage(){handled++}});
vm.runInContext('let roomGeneration=0;const pendingConnections=new Set();'+source.slice(source.indexOf('function acceptConnection('),source.indexOf('function wireClient(')),ctx);
const join=c=>{ctx.c=c;vm.runInContext('acceptConnection(c)',ctx)};
const clients=Array.from({length:1000},(_,i)=>new Connection('p'+i));clients.forEach(join);
assert.equal(vm.runInContext('pendingConnections.size',ctx),5,'only five seats reserved');clients.forEach(c=>c.emit('open'));
assert.equal(Object.keys(state.players).length,6,'1000 concurrent attempts cannot overfill room');assert.equal(clients.filter(c=>c.sent.some(d=>d.t==='reject')).length,995);
clients[999].emit('data',{t:'shot'});assert.equal(handled,0,'rejected peers cannot send gameplay messages');clients[0].emit('data',{t:'ready'});assert.equal(handled,1);
clients[0].close();assert.equal(state.connections.size,4);const replacement=new Connection('replacement');join(replacement);replacement.emit('open');assert.equal(state.connections.size,5,'vacated seat reusable');
state.mode='game';const late=new Connection('late');join(late);late.emit('open');assert.match(late.sent[0].reason,/started/);
state.mode='lobby';replacement.close();const pending=new Connection('pending');join(pending);state.mode='game';pending.emit('open');assert.match(pending.sent[0].reason,/started/,'start/join race rejects safely');
vm.runInContext('roomGeneration++',ctx);const count=Object.keys(state.players).length;clients[1].close();assert.equal(Object.keys(state.players).length,count,'stale callbacks cannot remove current players');
console.log('PASS lobbies: 1000 local concurrent joins, capacity reservations, rejected-message isolation, seat reuse, late joins, start races and stale callbacks. No public-service load generated.');
