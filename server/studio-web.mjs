import http from 'node:http';import https from 'node:https';import fs from 'node:fs/promises';import {createReadStream} from 'node:fs';import path from 'node:path';
import {getCertificate} from '@vitejs/plugin-basic-ssl';
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.map':'application/json; charset=utf-8','.txt':'text/plain; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.webp':'image/webp','.svg':'image/svg+xml','.ico':'image/x-icon','.glb':'model/gltf-binary','.mp3':'audio/mpeg','.ogg':'audio/ogg','.wav':'audio/wav','.mp4':'video/mp4','.webm':'video/webm','.ttf':'font/ttf','.woff':'font/woff','.woff2':'font/woff2'};
const inside=(root,file)=>file===root||file.startsWith(root+path.sep);
export function studioWebHandler({dist,apiPort}){
 const root=path.resolve(dist),realRoot=fs.realpath(root);
 return async(req,res)=>{
  try{
   const url=new URL(req.url||'/','http://studio'),pathname=decodeURIComponent(url.pathname).replaceAll('\\','/'),segments=pathname.split('/');
   if(segments.some(part=>part.startsWith('.')||['archive','node_modules'].includes(part))){res.writeHead(403).end();return;}
   if(pathname==='/preview'){res.writeHead(410,{'Content-Type':'application/json'}).end(JSON.stringify({error:'The application preview route is retired.'}));return;}
   if(pathname==='/api'||pathname.startsWith('/api/')){
    const upstream=http.request({hostname:'127.0.0.1',port:apiPort,path:url.pathname+url.search,method:req.method,headers:req.headers},response=>{res.writeHead(response.statusCode||502,response.headers);response.on('error',()=>res.destroy());response.pipe(res);});
    upstream.on('error',()=>{if(res.headersSent){res.destroy();return;}res.writeHead(502,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'The studio service is unavailable. Your saved work is kept.'}));});
    req.once('aborted',()=>upstream.destroy());res.once('close',()=>{if(!res.writableEnded)upstream.destroy();});req.pipe(upstream);return;
   }
   if(!['GET','HEAD'].includes(req.method||'GET')){res.writeHead(405,{'Allow':'GET, HEAD'}).end();return;}
   if(pathname.startsWith('/@')){res.writeHead(404).end();return;}
   let file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));if(!inside(root,file)){res.writeHead(403).end();return;}
   let info;try{info=await fs.stat(file);if(!info.isFile())throw Object.assign(new Error('Not a file'),{code:'ENOENT'});}catch(error){if(error.code!=='ENOENT'&&error.code!=='ENOTDIR')throw error;if(!path.extname(pathname)&&(req.headers.accept||'').includes('text/html')){file=path.join(root,'index.html');info=await fs.stat(file);}else{res.writeHead(404).end();return;}}
   if(!inside(await realRoot,await fs.realpath(file))){res.writeHead(403).end();return;}
   const extension=path.extname(file),etag=`W/"${info.size.toString(16)}-${Math.floor(info.mtimeMs).toString(16)}"`,immutable=pathname.startsWith('/assets/')&&/-[\w-]{8,}\./.test(path.basename(file)),headers={'Content-Type':types[extension]||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':extension==='.html'||pathname.startsWith('/release')?'no-store':immutable?'public, max-age=31536000, immutable':'no-cache','ETag':etag,'Accept-Ranges':'bytes'};
   if(req.headers['if-none-match']===etag&&headers['Cache-Control']!=='no-store'){res.writeHead(304,headers).end();return;}
   let start=0,end=info.size-1,status=200;
   if(req.headers.range&&req.method!=='HEAD'){
    const match=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);if(!match||(!match[1]&&!match[2])){res.writeHead(416,{'Content-Range':`bytes */${info.size}`}).end();return;}
    if(match[1]){start=Number(match[1]);if(match[2])end=Math.min(end,Number(match[2]));}else start=Math.max(0,info.size-Number(match[2]));
    if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start>=info.size){res.writeHead(416,{'Content-Range':`bytes */${info.size}`}).end();return;}status=206;headers['Content-Range']=`bytes ${start}-${end}/${info.size}`;
   }
   res.writeHead(status,{...headers,'Content-Length':Math.max(0,end-start+1)});if(req.method==='HEAD'||!info.size){res.end();return;}
   const source=createReadStream(file,{start,end});res.once('close',()=>source.destroy());source.on('error',()=>res.destroy()).pipe(res);
  }catch(error){if(!res.headersSent)res.writeHead(error instanceof URIError?400:500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'The studio could not serve this request.'}));}
 };
}
export async function startStudioWeb({root=process.cwd(),apiPort,httpPort=5173,httpsPort=5443,httpHost='127.0.0.1',httpsHost='0.0.0.0'}){
 await fs.access(path.join(root,'dist/index.html'));
 const handler=studioWebHandler({dist:path.join(root,'dist'),apiPort}),certificate=await getCertificate(path.join(root,'.sovereign/certs'),'sovereign-local'),desktop=http.createServer(handler),headset=https.createServer({key:certificate,cert:certificate},handler);
 const close=()=>Promise.all([desktop,headset].map(server=>new Promise(resolve=>{server.close(()=>resolve());server.closeIdleConnections();}))),listen=(server,port,host)=>new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,()=>{server.off('error',reject);resolve();});});
 try{await listen(desktop,httpPort,httpHost);await listen(headset,httpsPort,httpsHost);}catch(error){await close();throw error;}
 return {desktop,headset,close};
}
