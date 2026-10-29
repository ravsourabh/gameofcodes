/** Inspect real P01 outputs: hashes, images, transparency, media, and gallery. */
import {readFile,writeFile,stat,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {chromium} from 'playwright';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),dir=path.join(root,'publishing/baat-ka-bawaal/v1');
const manifest=JSON.parse(await readFile(path.join(dir,'manifest.json'),'utf8'));
const brand=JSON.parse(await readFile(path.join(dir,'brand.json'),'utf8'));
const assert=(value,message)=>{if(!value)throw Error(message);};
assert(brand.publisher==='Game of Codes Production','Wrong publisher');
assert(brand.identityConfirmedByCreator===true,'Channel identity unconfirmed');
assert(manifest.assets.filter(a=>a.type==='cast-cutout').length===21,'Expected 7 models × 3 expressions');
assert(manifest.assets.filter(a=>a.file.endsWith('.mp4')).length===4,'Expected landscape/portrait intros/outros');
const findings=[];
for(const a of manifest.assets){const data=await readFile(path.join(dir,a.file));assert(createHash('sha256').update(data).digest('hex')===a.sha256,'Hash mismatch: '+a.file);assert(data.length===a.bytes,'Size mismatch: '+a.file);if(a.file.endsWith('.png')){assert(data.readUInt32BE(16)===a.width&&data.readUInt32BE(20)===a.height,'PNG dimensions: '+a.file);}findings.push({file:a.file,bytes:a.bytes,hashValid:true});}
assert((await stat(path.join(dir,'assets/youtube-banner-2560x1440.png'))).size<6*1024*1024,'YouTube banner exceeds 6 MB');
async function exec(binary,args){const p=spawn(binary,args,{stdio:['ignore','pipe','pipe']});let stdout='',stderr='';p.stdout.on('data',d=>stdout+=d);p.stderr.on('data',d=>stderr+=d);const code=await new Promise((resolve,reject)=>{p.once('error',reject);p.once('exit',resolve);});if(code!==0)throw Error(stderr);return{stdout,stderr};}
const media=[];
for(const a of manifest.assets.filter(a=>a.file.endsWith('.mp4')||a.file.endsWith('.wav'))){const result=await exec('ffprobe',['-v','error','-show_streams','-show_format','-of','json',path.join(dir,a.file)]);const probe=JSON.parse(result.stdout);const duration=Number(probe.format.duration);assert(Math.abs(duration-a.durationSeconds)<.12,'Wrong duration: '+a.file);const video=probe.streams.find(s=>s.codec_type==='video');const audio=probe.streams.find(s=>s.codec_type==='audio');assert(audio&&Number(audio.sample_rate)===48000,'Missing 48 kHz audio: '+a.file);if(video)assert(video.width===a.width&&video.height===a.height&&video.r_frame_rate==='24/1'&&video.codec_name==='h264','Video spec: '+a.file);media.push({file:a.file,duration,video:video?{codec:video.codec_name,width:video.width,height:video.height,fps:video.r_frame_rate}:null,audio:{codec:audio.codec_name,sampleRate:audio.sample_rate,channels:audio.channels}});}
// Decode real frames independently of off-screen browser seek painting.
async function videoPixels(file,time){const p=spawn('ffmpeg',['-hide_banner','-loglevel','error','-ss',String(time),'-i',path.join(dir,file),'-frames:v','1','-vf','scale=80:45','-f','rawvideo','-pix_fmt','rgb24','pipe:1'],{stdio:['ignore','pipe','pipe']});const parts=[];let error='';p.stdout.on('data',d=>parts.push(d));p.stderr.on('data',d=>error+=d);const code=await new Promise((resolve,reject)=>{p.once('error',reject);p.once('exit',resolve);});if(code!==0)throw Error(error);return Buffer.concat(parts);}
const decodedMotion=[];
for(const a of manifest.assets.filter(a=>a.file.endsWith('.mp4')&&a.type.startsWith('intro'))){const[first,last]=await Promise.all([videoPixels(a.file,.08),videoPixels(a.file,1.7)]);assert(first.length===10800&&last.length===10800,'Missing decoded frame');let total=0,changed=0;for(let i=0;i<first.length;i++){const d=Math.abs(first[i]-last[i]);total+=d;if(d>15)changed++;}const meanDifference=total/first.length;assert(meanDifference>2&&changed>100,'No visible intro animation: '+a.file);decodedMotion.push({file:a.file,meanPixelDifference:meanDifference,changedChannels:changed});}
const audioMeasurements=[];
for(const file of ['intro-sting.wav','outro-sting.wav','dialogue-bed-preview.wav']){const result=await exec('ffmpeg',['-hide_banner','-i',path.join(dir,'audio',file),'-af','loudnorm=I=-16:TP=-1.5:LRA=7:print_format=json','-f','null','-']);const json=result.stderr.match(/\{\s*"input_i"[\s\S]*?\}/)?.[0];assert(json,'Missing loudness measurement');const m=JSON.parse(json);assert(Number(m.input_tp)<=-1,'Audio peak exceeds headroom: '+file);audioMeasurements.push({file,integratedLufs:Number(m.input_i),truePeakDb:Number(m.input_tp)});}
const server=createServer(async(req,res)=>{try{const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const file=path.resolve(dir,'.'+name);if(!file.startsWith(dir+path.sep)){res.writeHead(404).end();return;}const mime={'.html':'text/html; charset=utf-8','.mjs':'text/javascript','.css':'text/css','.png':'image/png','.json':'application/json','.ttf':'font/ttf','.mp4':'video/mp4','.wav':'audio/wav'};res.setHeader('Content-Type',mime[path.extname(file)]||'text/plain');res.end(await readFile(file));}catch{res.writeHead(404).end();}});
server.listen(0,'127.0.0.1');await once(server,'listening');const origin='http://127.0.0.1:'+server.address().port;
let browser;const visual=[];const review=path.join(root,'.sovereign/review/p01');await mkdir(review,{recursive:true});
try{
 browser=await chromium.launch({headless:true,args:['--disable-gpu']});const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/index.html');await page.evaluate(()=>document.fonts.ready);
 // Scroll through lazy images before checking their decoding.
 for(const img of await page.locator('img').all())await img.scrollIntoViewIfNeeded();
 const broken=await page.locator('img').evaluateAll(imgs=>imgs.filter(i=>!i.complete||!i.naturalWidth).map(i=>i.getAttribute('src')));assert(!broken.length,'Broken gallery images: '+broken.join(','));
 await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(review,'gallery-desktop.png'),fullPage:true});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Desktop horizontal overflow');
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(review,'gallery-phone.png'),fullPage:true});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Phone horizontal overflow');
 for(const a of manifest.assets.filter(a=>a.type==='cast-cutout'||a.type.startsWith('caption')||a.type.startsWith('lower')||a.type==='profile-circle')){
  const pixels=await page.evaluate(async file=>{const img=new Image();img.src=file;await img.decode();const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const x=c.getContext('2d');x.drawImage(img,0,0);const d=x.getImageData(0,0,c.width,c.height).data;let clear=0,opaque=0,minX=c.width,minY=c.height,maxX=-1,maxY=-1;for(let y=0;y<c.height;y++)for(let xx=0;xx<c.width;xx++){const alpha=d[(y*c.width+xx)*4+3];if(alpha===0)clear++;if(alpha>200){opaque++;minX=Math.min(minX,xx);maxX=Math.max(maxX,xx);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}}return{clearFraction:clear/(c.width*c.height),opaqueFraction:opaque/(c.width*c.height),bbox:[minX,minY,maxX,maxY]};},a.file);
  assert(pixels.clearFraction>.15&&pixels.opaqueFraction>.002,'Missing real alpha or empty artwork: '+a.file);if(a.type==='cast-cutout')assert(pixels.bbox[1]>15,'Clipped head: '+a.file);visual.push({file:a.file,...pixels});
 }
 // Check real decoded video frames and changing intro imagery, without WebGL.
 for(const a of manifest.assets.filter(a=>a.file.endsWith('.mp4'))){const check=await page.evaluate(async file=>{const v=document.createElement('video');v.src=file;v.muted=true;await new Promise((resolve,reject)=>{v.onloadedmetadata=resolve;v.onerror=reject;});const c=document.createElement('canvas');c.width=80;c.height=45;const x=c.getContext('2d');async function frame(t){v.currentTime=t;await new Promise(resolve=>v.onseeked=resolve);x.drawImage(v,0,0,80,45);return [...x.getImageData(0,0,80,45).data];}const a=await frame(.08),b=await frame(Math.min(1.7,v.duration-.1));return{duration:v.duration,changed:a.some((x,i)=>Math.abs(x-b[i])>15),nonblack:b.some((x,i)=>i%4!==3&&x>40)};},a.file);assert(check.nonblack,'Black media output: '+a.file);visual.push({file:a.file,...check});}
 assert(!errors.length,'Browser errors: '+errors.join('; '));
 await page.setViewportSize({width:1200,height:1500});await page.setContent(`<body style="margin:0;padding:36px;background:#06101e;color:#fff3d6;font:20px Arial"><h1 style="margin:0 0 8px">Baat Ka Bawaal</h1><p style="margin:0 0 28px;color:#f5c76b">Game of Codes Production · P01 asset preview</p><div style="display:grid;grid-template-columns:1fr 1fr;gap:22px"><img style="width:100%;grid-column:span 2" src="${origin}/assets/youtube-banner-mobile-preview.png"><img style="width:100%" src="${origin}/assets/youtube-thumbnail-sample.png"><img style="width:100%" src="${origin}/assets/end-card-landscape.png"><img style="width:100%" src="${origin}/assets/profile-800.png"><img style="width:100%;max-height:560px;object-fit:contain" src="${origin}/assets/vertical-cover-sample.png"></div></body>`);await page.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode())));await page.screenshot({path:path.join(dir,'preview-board.png'),fullPage:true});
}finally{await browser?.close();server.close();}
const report={verifiedAt:new Date().toISOString(),assetCount:manifest.assets.length,totalBytes:manifest.assets.reduce((n,a)=>n+a.bytes,0),findings,media,decodedMotion,audioMeasurements,visual,creatorVisualAcceptance:'pending'};
await writeFile(path.join(dir,'verification.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({assetCount:report.assetCount,totalBytes:report.totalBytes,media:media.length,alphaChecks:visual.filter(x=>x.clearFraction).length,audioMeasurements,creatorAcceptance:'pending'},null,2));
