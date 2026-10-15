// Local-only QA: render touch layout on desktop and accept mouse pointer gestures.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'../dist');
http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return}
  try{let data=fs.readFileSync(file);if(file.endsWith('/game.js'))data=data.toString().replace("const touchMode=!!globalThis.matchMedia?.('(pointer: coarse)').matches;",'const touchMode=true;').replace("e.pointerType==='mouse'||!isPlaying()",'!isPlaying()');
    if(file.endsWith('/game.js')&&process.env.RESPAWN_QA==='1')data+=`\n
      Object.defineProperty(document,'exitPointerLock',{value:undefined,configurable:true});
      updateBots=()=>{};
      const deathTest=document.createElement('button');deathTest.textContent='Test mobile death';deathTest.style='position:fixed;left:45%;top:55px;z-index:10000';
      deathTest.onclick=()=>{if(!isPlaying())return;const bot=Object.values(state.players).find(p=>p.id!==state.id);if(bot)applyHit(bot.id,state.id,100)};document.body.appendChild(deathTest);
    `;
    res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':'application/octet-stream');res.end(data);
  }catch{res.writeHead(404).end()}
}).listen(4176,'127.0.0.1',()=>console.log('Mobile QA preview: http://127.0.0.1:4176/'));
