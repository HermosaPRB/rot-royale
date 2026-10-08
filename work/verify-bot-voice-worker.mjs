import assert from 'node:assert/strict';
// Run from rot-royale/work/: node verify-bot-voice-worker.mjs   (no real keys: Groq and xAI are mocked)
const worker=(await import('../bot-voice/worker.js')).default;
const calls=[];let chatReply='"*smirks* Nice aim, did you calibrate it with decaf?"',sttText='you suck neegy',fail=null;
globalThis.fetch=async(url,init={})=>{
  calls.push({url:String(url),init});
  if(fail&&String(url).includes(fail))return new Response('nope',{status:500});
  if(String(url).endsWith('/audio/transcriptions'))return Response.json({text:sttText});
  if(String(url).endsWith('/chat/completions'))return Response.json({choices:[{message:{content:chatReply}}]});
  if(String(url).endsWith('/v1/tts'))return new Response(new Uint8Array([0xff,0xfb,0x90,0x00]),{headers:{'Content-Type':'audio/mpeg'}});
  return new Response('?',{status:404});
};
const kv=new Map(),QUOTA={get:async k=>kv.get(k)??null,put:async(k,v)=>{kv.set(k,v)}};
const env={GROQ_API_KEY:'g',XAI_API_KEY:'x',ALLOWED_ORIGINS:'http://localhost:8765'};
const ctx={event:'bot_killed_player',bot:1,player:'EspressoKid',botKills:4,botDeaths:1,playerKills:0,playerDeaths:4,playerHealth:0,playerWeapon:'Espresso AR',botWeapon:'Lungo Sniper',headshot:true,distance:22,timeLeft:95,history:[]};
const talk=(context,{origin='http://localhost:8765',audio=null,e=env,ip='1.1.1.1'}={})=>{const form=new FormData();form.append('context',JSON.stringify(context));if(audio)form.append('audio',audio,'clip.webm');return worker.fetch(new Request('https://proxy.test/talk',{method:'POST',headers:{Origin:origin,'CF-Connecting-IP':ip},body:form}),e)};
const reset=()=>{calls.length=0};

// CORS allowlist
assert.equal((await worker.fetch(new Request('https://proxy.test/talk',{method:'OPTIONS',headers:{Origin:'https://evil.example'}}),env)).status,403);
const pre=await worker.fetch(new Request('https://proxy.test/talk',{method:'OPTIONS',headers:{Origin:'http://localhost:8765'}}),env);
assert.equal(pre.status,204);assert.match(pre.headers.get('Access-Control-Expose-Headers'),/X-Line/);
reset();assert.equal((await talk(ctx,{origin:'https://evil.example'})).status,403,'other websites cannot spend your credits');assert.equal(calls.length,0);
assert.equal((await talk(ctx,{e:{ALLOWED_ORIGINS:'http://localhost:8765'}})).status,500,'missing keys reported');

// Event line: no transcription, persona-specific prompt and voice, cleaned line
reset();let r=await talk(ctx);assert.equal(r.status,200);assert.equal(r.headers.get('Content-Type'),'audio/mpeg');
assert.equal(calls.length,2,'event lines skip speech-to-text');
const chat=JSON.parse(calls[0].init.body),tts=JSON.parse(calls[1].init.body);
assert.equal(chat.model,'llama-3.3-70b-versatile');assert.ok(chat.max_tokens<=60);
assert.match(chat.messages[0].content,/Neegy\.exe/);assert.match(chat.messages[0].content,/Never use slurs/);
assert.match(chat.messages.at(-1).content,/eliminated the human/);assert.match(chat.messages.at(-1).content,/headshot/);assert.match(chat.messages.at(-1).content,/EspressoKid/);
assert.equal(tts.voice_id,'sal','Neegy.exe has his own voice');assert.equal(tts.language,'en');
const line=decodeURIComponent(r.headers.get('X-Line'));assert.equal(line,'Nice aim, did you calibrate it with decaf?','quotes and stage directions stripped');assert.equal(tts.text,line);
assert.ok((await r.arrayBuffer()).byteLength>0);

// Push-to-talk reply: speech-to-text first, heard text echoed back
reset();r=await talk({...ctx,event:'reply',bot:2},{audio:new Blob([new Uint8Array(2000)],{type:'audio/webm'})});
assert.equal(r.status,200);assert.ok(calls[0].url.endsWith('/audio/transcriptions'));assert.equal(calls[0].init.body.get('model'),'whisper-large-v3-turbo');
assert.equal(decodeURIComponent(r.headers.get('X-Heard')),'you suck neegy');assert.match(JSON.parse(calls[1].init.body).messages.at(-1).content,/you suck neegy/);
assert.equal(JSON.parse(calls[2].init.body).voice_id,'eve','Caffè Hunter voice');
reset();sttText='';r=await talk({...ctx,event:'reply'},{audio:new Blob([new Uint8Array(2000)])});assert.equal(r.status,204,'silence gets no reply');assert.equal(calls.length,1);sttText='you suck neegy';

// Untrusted input is bounded: history capped, long strings cut, unknown events/bots fall back
reset();await talk({...ctx,event:'hack the planet',bot:99,player:'x'.repeat(500),history:Array.from({length:30},(_,i)=>({speaker:i%2?'player':'bot',text:'y'.repeat(900)}))});
const msgs=JSON.parse(calls[0].init.body).messages;assert.ok(msgs.length<=8,'at most 6 history turns');assert.ok(msgs.every(m=>m.content.length<1400));assert.match(msgs[0].content,/Bonker Bot/);assert.match(msgs.at(-1).content,/taunt/);

// Daily caps
const capped={...env,QUOTA,DAILY_LINES_PER_IP:'2',DAILY_LINES_TOTAL:'3'};
assert.equal((await talk(ctx,{e:capped,ip:'2.2.2.2'})).status,200);assert.equal((await talk(ctx,{e:capped,ip:'2.2.2.2'})).status,200);
assert.equal((await talk(ctx,{e:capped,ip:'2.2.2.2'})).status,429,'per-visitor cap');
assert.equal((await talk(ctx,{e:capped,ip:'3.3.3.3'})).status,200);assert.equal((await talk(ctx,{e:capped,ip:'4.4.4.4'})).status,429,'whole-proxy cap');

// Upstream failure surfaces as 502 instead of crashing
fail='/v1/tts';assert.equal((await talk(ctx)).status,502);fail=null;
console.log('PASS bot-voice worker: CORS allowlist, key check, persona prompts + voices (rex/sal/eve), Whisper for replies only, silent clip → 204, bounded input, per-IP + total daily caps, upstream errors → 502.');
