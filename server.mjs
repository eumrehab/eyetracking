import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=new URL('./dist/',import.meta.url);
const mime={html:'text/html; charset=utf-8',js:'text/javascript; charset=utf-8',mjs:'text/javascript; charset=utf-8',css:'text/css; charset=utf-8',wasm:'application/wasm',task:'application/octet-stream'};
http.createServer(async(req,res)=>{try{const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(path.includes('..'))throw Error();const url=new URL('.'+(path==='/'?'/index.html':path),root);if(!url.href.startsWith(root.href))throw Error();const data=await readFile(fileURLToPath(url));res.writeHead(200,{'Content-Type':mime[path==='/'?'html':path.split('.').pop()]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(data);}catch{res.writeHead(404);res.end('Not found');}}).listen(4173,'127.0.0.1',()=>console.log('Local: http://localhost:4173'));
