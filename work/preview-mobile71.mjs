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
    res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':'application/octet-stream');res.end(data);
  }catch{res.writeHead(404).end()}
}).listen(4176,'127.0.0.1',()=>console.log('Mobile QA preview: http://127.0.0.1:4176/'));
