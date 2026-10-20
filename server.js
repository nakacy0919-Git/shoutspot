// Local preview server. No packages or build step required.
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('.',import.meta.url));
const port=Number(process.env.PORT||3000);
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.ico':'image/x-icon'};
const server=http.createServer(async(req,res)=>{
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{'Allow':'GET, HEAD'});res.end();return;}
 try{
  const url=new URL(req.url,'http://localhost');
  const requested=decodeURIComponent(url.pathname);
  const path=resolve(root,'.'+(requested==='/'?'/index.html':requested));
  if(!path.startsWith(root.endsWith(sep)?root:root+sep)){res.writeHead(403);res.end('Forbidden');return;}
  const relative=path.slice(root.length).split(sep);
  if(relative.some(p=>p.startsWith('.'))||!['index.html','js','css'].includes(relative[0])){res.writeHead(404);res.end('Not found');return;}
  const content=await readFile(path);
  res.writeHead(200,{'Content-Type':types[extname(path)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
  res.end(req.method==='HEAD'?undefined:content);
 }catch{res.writeHead(404);res.end('Not found');}
});
server.on('error',err=>{console.error(err.code==='EADDRINUSE'?`Port ${port} is in use. Stop the other server or set PORT to another number.`:err.message);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>console.log(`Shout Spot: http://localhost:${port}\nPress Ctrl+C to stop.`));
