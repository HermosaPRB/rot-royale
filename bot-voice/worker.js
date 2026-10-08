// Rot Royale bot trash-talk proxy (Cloudflare Worker).
// POST /talk  multipart: context (JSON) + optional audio (player push-to-talk clip)
//   -> Groq Whisper (if audio) -> Groq Llama (one line) -> xAI TTS (mp3)
//   <- audio/mpeg body, X-Line / X-Heard headers (URI-encoded)
// Keys stay here as secrets; the game only ever sees the finished audio.

const GROQ='https://api.groq.com/openai/v1';
const XAI_TTS='https://api.x.ai/v1/tts';
const MAX_AUDIO_BYTES=1_000_000;
const MAX_LINE_CHARS=160;

// Personas live server-side so a client cannot rewrite who the bot is.
export const PERSONAS=[
  {name:'Bonker Bot',voice:'rex',style:'a loud, dim-witted wooden brawler who solves everything by bonking. Short caveman-ish boasts, gets confused by big words, oddly sincere when he loses.'},
  {name:'Neegy.exe',voice:'sal',style:'a smug robot obsessed with his K/D ratio and stats. Talks like a condescending tech bro AI, quotes fake percentages, calls the player "human" or "organic".'},
  {name:'Caffè Hunter',voice:'eve',style:'a hyper-caffeinated Italian barista sniper. Fast, dramatic, coffee insults (decaf, instant coffee, watered-down), sprinkles Italian words like mamma mia and basta.'}
];
const EVENT_TEXT={
  start:'The match just started. Greet the human with a cocky opener.',
  bot_killed_player:'You just eliminated the human.',
  player_killed_bot:'The human just eliminated you. Be a sore loser, or grudgingly impressed.',
  bot_killed_bot:'You just eliminated another bot. Brag to the human about it.',
  airdrop:'An airdrop supply crate is falling to the center of the map. Call dibs or warn the human off.',
  player_looted:'The human just grabbed the airdrop weapon. React.',
  taunt:'You spotted the human after a quiet moment. Throw a taunt.',
  reply:'The human just said something to you over voice chat. Respond directly to what they said.'
};
const RULES='Rules: reply with exactly ONE spoken line, at most 18 words. No emojis, no stage directions, no quotation marks, no hashtags. Swearing and harsh roasting are fine. Never use slurs or attack race, religion, gender, sexuality, disability or other identities; no sexual content; no real-world threats or self-harm jokes. Roast their gameplay, their aim, their coffee taste, their score. Use the game facts when they help the joke.';

const json=(status,body,headers)=>new Response(JSON.stringify(body),{status,headers:{...headers,'Content-Type':'application/json'}});
const clean=(value,max)=>String(value??'').replace(/[\u0000-\u001f]/g,' ').slice(0,max);
const num=v=>Number.isFinite(+v)?Math.round(+v):0;

function corsHeaders(request,env){
  const origin=request.headers.get('Origin')||'',allowed=String(env.ALLOWED_ORIGINS||'').split(',').map(s=>s.trim()).filter(Boolean);
  const ok=allowed.includes('*')||allowed.includes(origin);
  return{ok,headers:ok?{'Access-Control-Allow-Origin':origin||'*','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Access-Control-Expose-Headers':'X-Line, X-Heard, X-Remaining','Vary':'Origin'}:{}};
}

// Daily caps per visitor IP and for the whole proxy. Uses a KV namespace bound as QUOTA when present.
async function takeQuota(request,env){
  const perIp=+env.DAILY_LINES_PER_IP||80,total=+env.DAILY_LINES_TOTAL||3000;
  if(!env.QUOTA)return{ok:true,remaining:perIp};
  const day=new Date().toISOString().slice(0,10),ip=request.headers.get('CF-Connecting-IP')||'unknown';
  const ipKey=`ip:${day}:${ip}`,allKey=`all:${day}`;
  const [used,all]=await Promise.all([env.QUOTA.get(ipKey),env.QUOTA.get(allKey)]).then(v=>v.map(x=>+x||0));
  if(used>=perIp||all>=total)return{ok:false,remaining:0};
  await Promise.all([env.QUOTA.put(ipKey,String(used+1),{expirationTtl:172800}),env.QUOTA.put(allKey,String(all+1),{expirationTtl:172800})]);
  return{ok:true,remaining:perIp-used-1};
}

export function buildMessages(ctx,heard){
  const persona=PERSONAS[num(ctx.bot)]||PERSONAS[0],event=EVENT_TEXT[ctx.event]?ctx.event:'taunt',player=clean(ctx.player,24)||'the human';
  const facts=[`Human player's name: ${player}.`,`Score: you ${num(ctx.botKills)} kills / ${num(ctx.botDeaths)} deaths, ${player} ${num(ctx.playerKills)} kills / ${num(ctx.playerDeaths)} deaths.`,
    `${player} has ${num(ctx.playerHealth)} health and uses the ${clean(ctx.playerWeapon,40)||'unknown weapon'}. You use the ${clean(ctx.botWeapon,40)||'unknown weapon'}.`,
    ctx.headshot?'It was a headshot.':'',ctx.distance?`Distance between you: ${num(ctx.distance)} meters.`:'',ctx.timeLeft?`${num(ctx.timeLeft)} seconds left in the match.`:''].filter(Boolean).join(' ');
  const messages=[{role:'system',content:`You are ${persona.name}, a practice bot in Rot Royale, a goofy coffee-themed 3D arena shooter. You are ${persona.style} You talk trash to the human over proximity voice chat. ${RULES}`}];
  for(const h of (Array.isArray(ctx.history)?ctx.history:[]).slice(-6)){const text=clean(h?.text,MAX_LINE_CHARS);if(!text)continue;messages.push(h.speaker==='player'?{role:'user',content:`${player} said: ${text}`}:{role:'assistant',content:text})}
  messages.push({role:'user',content:`${EVENT_TEXT[event]} ${facts}${heard?` ${player} said: "${clean(heard,300)}"`:''}`});
  return{persona,messages};
}

async function transcribe(audio,env){
  const form=new FormData();form.append('file',audio,'clip.webm');form.append('model',env.GROQ_STT_MODEL||'whisper-large-v3-turbo');form.append('response_format','json');form.append('language','en');
  const r=await fetch(`${GROQ}/audio/transcriptions`,{method:'POST',headers:{Authorization:`Bearer ${env.GROQ_API_KEY}`},body:form});
  if(!r.ok)throw new Error(`stt ${r.status}`);return clean((await r.json()).text,300).trim();
}
async function writeLine(messages,env){
  const r=await fetch(`${GROQ}/chat/completions`,{method:'POST',headers:{Authorization:`Bearer ${env.GROQ_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model:env.GROQ_CHAT_MODEL||'llama-3.3-70b-versatile',messages,max_tokens:60,temperature:1})});
  if(!r.ok)throw new Error(`chat ${r.status}`);
  const line=clean((await r.json()).choices?.[0]?.message?.content,MAX_LINE_CHARS).replace(/^["'\s]+|["'\s]+$/g,'').replace(/\*[^*]*\*/g,'').trim();
  return line||'...';
}
async function speak(text,voice,env){
  const r=await fetch(XAI_TTS,{method:'POST',headers:{Authorization:`Bearer ${env.XAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({text,voice_id:voice,language:'en'})});
  if(!r.ok)throw new Error(`tts ${r.status}`);return r.arrayBuffer();
}

export default{
  async fetch(request,env){
    const url=new URL(request.url),cors=corsHeaders(request,env);
    if(request.method==='OPTIONS')return new Response(null,{status:cors.ok?204:403,headers:cors.headers});
    if(url.pathname!=='/talk'||request.method!=='POST')return json(404,{error:'not found'},cors.headers);
    if(!cors.ok)return json(403,{error:'origin not allowed'},{});
    if(!env.GROQ_API_KEY||!env.XAI_API_KEY)return json(500,{error:'server keys missing'},cors.headers);
    if(+request.headers.get('Content-Length')>MAX_AUDIO_BYTES+20000)return json(413,{error:'clip too long'},cors.headers);
    let form;try{form=await request.formData()}catch{return json(400,{error:'expected multipart form'},cors.headers)}
    let ctx;try{ctx=JSON.parse(String(form.get('context')||'{}'))}catch{return json(400,{error:'bad context'},cors.headers)}
    const audio=form.get('audio'),hasAudio=audio&&typeof audio==='object'&&audio.size>0;
    if(hasAudio&&audio.size>MAX_AUDIO_BYTES)return json(413,{error:'clip too long'},cors.headers);
    const quota=await takeQuota(request,env);if(!quota.ok)return json(429,{error:'daily trash-talk limit reached'},cors.headers);
    try{
      const heard=hasAudio?await transcribe(audio,env):'';
      if(ctx.event==='reply'&&!heard)return new Response(null,{status:204,headers:cors.headers});
      const {persona,messages}=buildMessages(ctx,heard),line=await writeLine(messages,env),mp3=await speak(line,persona.voice,env);
      return new Response(mp3,{status:200,headers:{...cors.headers,'Content-Type':'audio/mpeg','Cache-Control':'no-store','X-Line':encodeURIComponent(line),'X-Heard':encodeURIComponent(heard),'X-Remaining':String(quota.remaining)}});
    }catch(error){return json(502,{error:String(error.message||error)},cors.headers)}
  }
};
