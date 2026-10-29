import http from 'node:http';
import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

// Native attachment downloads do not pass through Playwright page.route.
// Keep browser API calls, downloads, Origin and Referer on one actual HTTP origin.
export function createExportGateway({dist,onRequest=()=>{}}){
  dist=path.resolve(dist);let backend;
  const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.glb':'model/gltf-binary','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.ttf':'font/ttf','.woff2':'font/woff2','.mp3':'audio/mpeg','.ogg':'audio/ogg','.wav':'audio/wav','.txt':'text/plain; charset=utf-8'};
  return http.createServer(async(req,res)=>{
    try{
      const url=new URL(req.url,'http://localhost');
      if(url.pathname==='/__qa/health'){res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify({dist,backend:backend?.origin}));return;}
      if(url.pathname==='/__qa/backend'&&req.method==='POST'){
        const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>4096)throw Error('QA control body too large');chunks.push(chunk);}
        const target=new URL(JSON.parse(Buffer.concat(chunks).toString()).origin);
        if(target.protocol!=='http:'||target.hostname!=='127.0.0.1'||!target.port||target.username||target.password||target.pathname!=='/'||target.search||target.hash)throw Error('Only an isolated loopback fixture backend is allowed');
        backend=target;res.writeHead(200).end('ready');return;
      }
      if(url.pathname.startsWith('/api/')){
        if(!backend){res.writeHead(503).end('Configure the fixture backend first');return;}
        const headers={...req.headers,host:backend.host,'x-forwarded-host':req.headers.host,'x-forwarded-proto':'http'};
        const entry={method:req.method,path:req.url};
        const upstream=http.request(new URL(req.url,backend),{method:req.method,headers},response=>{
          Object.assign(entry,{status:response.statusCode,contentType:response.headers['content-type'],disposition:response.headers['content-disposition'],bytes:response.headers['content-length']});
          onRequest(entry);res.writeHead(response.statusCode,response.headers);response.pipe(res);
          response.on('error',()=>res.destroy());
        });
        upstream.on('error',error=>{if(!res.headersSent)res.writeHead(502);res.end(error.message);});
        // Propagate interrupted transfers so service download cleanup keeps partial files.
        req.on('aborted',()=>upstream.destroy());res.on('close',()=>{if(!res.writableFinished)upstream.destroy();});req.pipe(upstream);return;
      }
      let file=path.resolve(dist,'.'+decodeURIComponent(url.pathname));
      if(file!==dist&&!file.startsWith(dist+path.sep)){res.writeHead(403).end();return;}
      let info;try{info=await stat(file);if(!info.isFile())throw Error('directory');}catch{
        if(path.extname(url.pathname)){res.writeHead(404).end();return;}
        file=path.join(dist,'index.html');info=await stat(file);
      }
      res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Content-Length':info.size,'Cache-Control':'no-store'});
      createReadStream(file).on('error',()=>res.destroy()).pipe(res);
    }catch(error){if(!res.headersSent)res.writeHead(400);res.end(error.message);}
  });
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  if(!process.env.GOC_QA_DIST)throw Error('GOC_QA_DIST must identify a frozen production build');
  const {appendFileSync}=await import('node:fs');
  const gateway=createExportGateway({dist:process.env.GOC_QA_DIST,onRequest:entry=>{
    if(process.env.GOC_QA_ARTIFACTS)appendFileSync(path.join(process.env.GOC_QA_ARTIFACTS,'gateway.jsonl'),JSON.stringify({time:new Date().toISOString(),...entry})+'\n');
  }});
  await new Promise((resolve,reject)=>{gateway.once('error',reject);gateway.listen(Number(process.env.GOC_QA_PORT||5571),'127.0.0.1',resolve);});
  console.log('Fixture export gateway listening on '+gateway.address().port);
  process.on('SIGTERM',()=>gateway.close());process.on('SIGINT',()=>gateway.close());
}
