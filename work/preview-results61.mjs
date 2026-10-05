// Local-only visual fixture. Nothing here is included in the published dist folder.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'../dist');
http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');const file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname));
  if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return}
  try{let body=fs.readFileSync(file);if(file.endsWith('/game.js'))body=body.toString()+`\n
    const testbar=document.createElement('div');testbar.style='position:fixed;top:0;left:0;z-index:99999';
    for(const label of ['Show podium','Show respawn','Two players']){const b=document.createElement('button');b.textContent=label;testbar.appendChild(b);b.onclick=()=>{
      if(label==='Show respawn'){state.matchActive=true;state.alive=false;state.respawnAt=Date.now()+3000;state.pendingWeapon='ar';showScreen('game');state.mode='pause';$('hud').classList.add('active');renderRespawnLoadout();$('respawn').classList.add('active');return}
      state.matchActive=true;state.practice=true;state.host=false;const players={a:{id:'a',name:'Golden Espresso',char:'neegy',weapon:'sniper',kills:21,deaths:4},b:{id:'b',name:'Wooden Bonker',char:'wooden',weapon:'ar',kills:16,deaths:7},c:{id:'c',name:'Pasta Patrol',char:'neegy',weapon:'smg',kills:12,deaths:9},d:{id:'d',name:'Fourth Place',char:'wooden',weapon:'shotgun',kills:6,deaths:10}};state.id='b';if(label==='Two players'){delete players.c;delete players.d}finishMatch(players);
    }}document.body.appendChild(testbar);`;
    res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':'application/octet-stream');res.end(body);
  }catch{res.writeHead(404);res.end()}
}).listen(4174,'127.0.0.1',()=>console.log('Results fixture http://127.0.0.1:4174'));
