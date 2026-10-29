/** Build the P01 artwork kit from editable HTML/CSS; no app or account changes.
 * node scripts/build-publishing-kit.mjs [--no-video] [--serve]
 */
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir,copyFile,stat,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const rel='publishing/baat-ka-bawaal/v1',dir=path.join(root,rel),out=path.join(dir,'assets');
const brand=JSON.parse(await readFile(path.join(dir,'brand.json'),'utf8'));
if(process.argv.includes('--catalog-only')){
 const manifest=JSON.parse(await readFile(path.join(dir,'manifest.json'),'utf8'));
 manifest.assets=manifest.assets.filter(a=>a.type!=='cast-cutout');
 for(const name of (await readdir(path.join(dir,'cast'))).filter(f=>f.endsWith('.png')).sort()){
  const data=await readFile(path.join(dir,'cast',name));manifest.assets.push({file:'cast/'+name,type:'cast-cutout',width:768,height:1024,bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')});
 }
 manifest.generatedAt=new Date().toISOString();
 await writeFile(path.join(dir,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 await writeFile(path.join(dir,'index.html'),gallery(manifest.assets));
 console.log('Catalogue refreshed: '+manifest.assets.length+' assets');
 process.exit(0);
}
const mime={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.ttf':'font/ttf','.mp4':'video/mp4','.wav':'audio/wav'};
const server=createServer(async(req,res)=>{try{
 const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 const resolved=path.resolve(root,'.'+pathname);
 const allowed=[path.join(root,rel),path.join(root,'public/branding/baat-ka-bawaal'),path.join(root,'public/fonts')];
 if(!allowed.some(p=>resolved===p||resolved.startsWith(p+path.sep))) {res.writeHead(404).end();return;}
 const file=(await stat(resolved)).isDirectory()?path.join(resolved,'index.html'):resolved;
 res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(await readFile(file));
}catch{res.writeHead(404).end();}});
server.listen(0,'127.0.0.1');await once(server,'listening');
const origin='http://127.0.0.1:'+server.address().port,base=origin+'/'+rel;
if(process.argv.includes('--serve')){console.log(base+'/index.html');process.on('SIGINT',()=>server.close());}
else{
let browser;
try{
 await mkdir(out,{recursive:true});await mkdir(path.join(dir,'audio'),{recursive:true});await mkdir(path.join(dir,'notices'),{recursive:true});await mkdir(path.join(dir,'source'),{recursive:true});
 await copyFile(path.join(root,'public/branding/baat-ka-bawaal/logo.png'),path.join(dir,'source/show-logo.png'));
 await copyFile(path.join(root,'public/fonts/NotoSansDevanagari.ttf'),path.join(dir,'source/NotoSansDevanagari.ttf'));
 browser=await chromium.launch({headless:true,args:['--disable-gpu']});
 const page=await browser.newPage({deviceScaleFactor:1});
 const pageErrors=[];page.on('pageerror',e=>pageErrors.push(e.message));
 const assets=[];
 async function artwork(type,w,h,file,extra=''){
  await page.setViewportSize({width:w,height:h});await page.goto(base+'/layout.html?type='+type+extra);
  await page.waitForFunction(()=>window.artworkReady===true||window.artworkFailure);
  const failure=await page.evaluate(()=>window.artworkFailure);if(failure)throw Error(failure);
  const overflow=await page.evaluate(()=>[...document.querySelectorAll('.banner-copy,.thumb-head,.vertical-hook,.caption span,.lower,.end-title,.end-sub')].filter(e=>e.scrollWidth>e.clientWidth+2||e.scrollHeight>e.clientHeight+2).map(e=>e.className));
  if(overflow.length)throw Error('Text overflow: '+type+' '+overflow.join(','));
  const target=path.join(out,file);await page.screenshot({path:target,omitBackground:true});
  assets.push({file:'assets/'+file,type,width:w,height:h});return target;
 }
 await artwork('profile',800,800,'profile-800.png');
 await artwork('profile-circle',800,800,'profile-circle-preview.png');
 await artwork('profile-circle',98,98,'profile-98-preview.png');
 await artwork('banner',2560,1440,'youtube-banner-2560x1440.png');
 await artwork('banner',2560,1440,'youtube-banner-safe-area-preview.png','&guides=1');
 await page.screenshot({path:path.join(out,'youtube-banner-mobile-preview.png'),clip:{x:508,y:509,width:1544,height:422}});
 assets.push({file:'assets/youtube-banner-mobile-preview.png',type:'banner-mobile-preview',width:1544,height:422});
 // Remove guides for the clean mobile crop.
 await page.locator('.guide').evaluate(e=>e.remove());
 await page.screenshot({path:path.join(out,'youtube-banner-mobile-preview.png'),clip:{x:508,y:509,width:1544,height:422}});
 await artwork('thumbnail',1280,720,'youtube-thumbnail-sample.png');
 await artwork('thumbnail',1280,720,'youtube-thumbnail-neutral-sample.png','&expression=smile&hook1='+encodeURIComponent('मुद्दा छोटा…')+'&hook2='+encodeURIComponent('बवाल बड़ा!'));
 await artwork('thumbnail',1280,720,'youtube-thumbnail-chintu-supporting-sample.png','&model=Business_Male_02&expression=surprised&hook1='+encodeURIComponent('हाँ बोला…')+'&hook2='+encodeURIComponent('शक हो गया!'));
 await artwork('vertical-cover',1080,1920,'vertical-cover-sample.png');
 await artwork('vertical-cover',1080,1920,'vertical-cover-crop-preview.png','&guides=1');
 await artwork('caption-landscape',1280,720,'caption-landscape-overlay.png');
 await artwork('caption-portrait',1080,1920,'caption-portrait-overlay.png');
 await artwork('lower-landscape',1280,720,'lower-third-landscape-overlay.png');
 await artwork('lower-portrait',1080,1920,'lower-third-portrait-overlay.png');
 await artwork('watermark',300,300,'video-watermark-300.png');
 await artwork('outro-landscape',1280,720,'end-card-landscape.png');
 await artwork('outro-portrait',1080,1920,'end-card-portrait.png');
 await artwork('intro-landscape',1280,720,'intro-landscape-poster.png');
 await artwork('intro-portrait',1080,1920,'intro-portrait-poster.png');
 console.log('Artwork rendered: '+assets.length);
 const ffmpeg=process.env.FFMPEG_PATH||'ffmpeg';
 async function command(args){const p=spawn(ffmpeg,['-hide_banner','-loglevel','error','-y',...args],{cwd:root,stdio:['ignore','ignore','pipe']});let error='';p.stderr.on('data',d=>error+=d);const result=await new Promise((resolve,reject)=>{p.once('error',reject);p.once('exit',code=>resolve(code));});if(result!==0)throw Error(error||'FFmpeg failed');}
 const theme=path.join(root,'public/audio/news-theme.mp3');
 const audioSpecs=[['intro-sting.wav',0,2.5,-15,'afade=t=in:st=0:d=0.04,afade=t=out:st=2.05:d=0.45'],['outro-sting.wav',16,4,-16,'afade=t=in:st=0:d=0.12,afade=t=out:st=3.1:d=0.9'],['dialogue-bed-preview.wav',4,20,-29,'afade=t=in:st=0:d=0.5,afade=t=out:st=18.8:d=1.2']];
 for(const[file,start,duration,lufs,fades]of audioSpecs){await command(['-ss',String(start),'-i',theme,'-t',String(duration),'-af',`loudnorm=I=${lufs}:TP=-1.5:LRA=7,${fades}`,'-ar','48000','-ac','2',path.join(dir,'audio',file)]);}
 if(!process.argv.includes('--no-video')){
  for(const[type,w,h,duration,audio]of [['intro-landscape',1280,720,2.5,'intro-sting.wav'],['intro-portrait',1080,1920,2.5,'intro-sting.wav'],['outro-landscape',1280,720,4,'outro-sting.wav'],['outro-portrait',1080,1920,4,'outro-sting.wav']]){
   if(process.argv.includes('--intro-only')&&!type.startsWith('intro')){await stat(path.join(out,type+'.mp4'));assets.push({file:'assets/'+type+'.mp4',type,width:w,height:h,durationSeconds:duration,fps:24});continue;}
   await page.setViewportSize({width:w,height:h});await page.goto(base+'/layout.html?type='+type);await page.waitForFunction(()=>window.artworkReady===true||window.artworkFailure);
   const failure=await page.evaluate(()=>window.artworkFailure);if(failure)throw Error(failure);
   const file=type+'.mp4';const p=spawn(ffmpeg,['-hide_banner','-loglevel','error','-y','-f','image2pipe','-framerate','24','-vcodec','png','-i','pipe:0','-i',path.join(dir,'audio',audio),'-map','0:v:0','-map','1:a:0','-c:v','libx264','-preset','fast','-crf','19','-pix_fmt','yuv420p','-threads','2','-c:a','aac','-b:a','192k','-t',String(duration),'-movflags','+faststart','-metadata','comment=News Theme by Kevin MacLeod (incompetech.com), CC BY 4.0 https://creativecommons.org/licenses/by/4.0/; excerpt, fades and loudness edited. '+brand.publisher,path.join(out,file)],{stdio:['pipe','ignore','pipe']});
   let error='';p.stderr.on('data',d=>error+=d);const done=new Promise((resolve,reject)=>{p.once('error',reject);p.once('exit',c=>c===0?resolve():reject(Error(error)));});
   for(let f=0;f<duration*24;f++){await page.evaluate(([t,d])=>window.setArtworkFrame(t,d),[f/24,duration]);const png=await page.screenshot({omitBackground:false});if(!p.stdin.write(png))await once(p.stdin,'drain');}
   p.stdin.end();await done;assets.push({file:'assets/'+file,type,width:w,height:h,durationSeconds:duration,fps:24});console.log('Video rendered: '+file);
  }
 }else{
  // A layout-only rebuild must not drop already built videos from the catalogue.
  for(const[type,w,h,duration]of [['intro-landscape',1280,720,2.5],['intro-portrait',1080,1920,2.5],['outro-landscape',1280,720,4],['outro-portrait',1080,1920,4]]){
   try{await stat(path.join(out,type+'.mp4'));assets.push({file:'assets/'+type+'.mp4',type,width:w,height:h,durationSeconds:duration,fps:24});}catch{}
  }
 }
 await copyFile(path.join(root,'public/audio/CREDITS.txt'),path.join(dir,'notices/AUDIO-CREDITS.txt'));
 await copyFile(path.join(root,'public/fonts/NotoSansDevanagari-LICENSE.txt'),path.join(dir,'notices/FONT-OFL.txt'));
 await copyFile(path.join(root,'public/avatars/rocketbox/LICENSE.md'),path.join(dir,'notices/ROCKETBOX-MIT.txt'));
 for(const a of assets){const data=await readFile(path.join(dir,a.file));a.bytes=data.length;a.sha256=createHash('sha256').update(data).digest('hex');}
 const castFiles=(await readdir(path.join(dir,'cast'))).filter(f=>f.endsWith('.png')).sort();
 for(const name of castFiles){const data=await readFile(path.join(dir,'cast',name));assets.push({file:'cast/'+name,type:'cast-cutout',width:768,height:1024,bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')});}
 for(const[file,,duration]of audioSpecs){const data=await readFile(path.join(dir,'audio',file));assets.push({file:'audio/'+file,type:'music-excerpt',durationSeconds:duration,bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')});}
 if(pageErrors.length)throw Error('Artwork page errors: '+pageErrors.join('; '));
 await writeFile(path.join(dir,'manifest.json'),JSON.stringify({schemaVersion:1,brandVersion:brand.brandVersion,generatedAt:new Date().toISOString(),identityConfirmed:true,visualAcceptance:'pending creator review',assets},null,2)+'\n');
 await writeFile(path.join(dir,'index.html'),gallery(assets));
 console.log('Kit ready: '+path.join(dir,'index.html'));
}finally{await browser?.close();server.close();}
}

function gallery(assets){
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const card=(name,label,cls='')=>`<article class="card ${cls}"><a href="assets/${name}" target="_blank"><img src="assets/${name}" alt="${esc(label)}" loading="lazy"></a><div class="caption"><strong>${esc(label)}</strong><a download href="assets/${name}">Download PNG ↗</a></div></article>`;
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Baat Ka Bawaal publishing kit</title><style>
 @font-face{font-family:Brand;src:url('source/NotoSansDevanagari.ttf')}*{box-sizing:border-box}body{margin:0;background:#06101e;color:#fff3d6;font:16px Brand,Arial,sans-serif}a{color:#f5c76b;text-decoration:none}a:hover{text-decoration:underline}header{padding:60px 6% 36px;border-bottom:1px solid #294056;background:radial-gradient(ellipse at 80% 20%,#163a60,transparent 60%)}header .kicker{color:#f5c76b;letter-spacing:3px;font:12px Arial}h1{font-size:48px;margin:18px 0 8px}header p{max-width:900px;line-height:1.8;color:#b5c7db}nav{display:flex;gap:25px;flex-wrap:wrap;margin-top:30px}main{max-width:1440px;margin:auto;padding:30px 5% 80px}h2{margin:42px 0 10px;font-size:26px}h3{margin:0}p{color:#a6b7c9;line-height:1.8}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:22px}.profiles{grid-template-columns:320px 160px 1fr;align-items:start}.card{overflow:hidden;border:1px solid #294056;border-radius:14px;background:#102139}.card img{display:block;width:100%;height:auto}.card .caption{padding:16px;display:flex;justify-content:space-between;gap:12px;font-size:13px}.card .caption a{white-space:nowrap}.wide{grid-column:1/-1}.portrait img{max-height:680px;object-fit:contain;background:#071225}.check{background-color:#223146;background-image:linear-gradient(45deg,#40536b 25%,transparent 25%),linear-gradient(-45deg,#40536b 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#40536b 75%),linear-gradient(-45deg,transparent 75%,#40536b 75%);background-size:24px 24px;background-position:0 0,0 12px,12px -12px,-12px 0}.cast-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:12px}.cast-grid img{width:100%;display:block}.cast-grid a{font:11px Arial;overflow-wrap:anywhere}.state{display:inline-block;padding:7px 12px;border-radius:30px;background:#143c38;color:#8de1bc;font:12px Arial;letter-spacing:1px}.video-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:22px}video{width:100%;max-height:500px;background:#020813}audio{max-width:100%;width:400px}.notes{padding:22px;border-left:3px solid #f5c76b;background:#102139}ul{color:#b5c7db;line-height:1.9}code{color:#f5c76b}@media(max-width:800px){h1{font-size:33px}.grid,.profiles,.video-grid{grid-template-columns:1fr}.cast-grid{grid-template-columns:repeat(3,1fr)}.profiles .card{max-width:320px}.caption{flex-wrap:wrap}}
 </style></head><body><header><div class="kicker">P01 · PUBLISHING ASSET KIT · V1</div><h1>बात का बवाल</h1><h3>Baat Ka Bawaal</h3><p>${esc(brand.tagline)}<br>${esc(brand.publisher)}</p><span class="state">CHANNEL IDENTITY CONFIRMED · ARTWORK READY FOR REVIEW</span><p>Reusable channel branding, episode templates, actual-avatar cutouts and audio excerpts. These are local assets; no channel or public post has been changed.</p><nav><a href="#identity">Channel</a><a href="#episodes">Episode artwork</a><a href="#captions">Captions</a><a href="#cast">Cast cutouts</a><a href="#motion">Motion & sound</a><a href="CHANNEL_COPY.md">Channel copy</a><a href="README.md">Your next steps</a><a href="manifest.json">Asset manifest</a></nav></header><main>
 <h2 id="identity">Channel identity</h2><p>The badge is shown at upload size, in a circular crop and at 98 px. The banner features Chhola Bhatura and keeps the essential identity inside the mobile-safe centre.</p><div class="grid profiles">${card('profile-800.png','800 px profile badge')}${card('profile-98-preview.png','98 px readability check')}<div class="notes"><h3>Confirmed identity</h3><p>Baat Ka Bawaal channel<br>${esc(brand.publisher)}</p><p>Handles and public contact email remain unset. The password-protected studio address is excluded from public channel copy.</p></div></div><div class="grid" style="margin-top:22px">${card('youtube-banner-2560x1440.png','YouTube channel banner · 2560 × 1440','wide')}${card('youtube-banner-mobile-preview.png','Clean mobile crop')}${card('youtube-banner-safe-area-preview.png','Safe-area check · do not upload guides')}</div>
 <h2 id="episodes">Episode artwork</h2><p>Sample hooks refer to the saved auto-driver premise. Replace them with the actual episode hook through <code>layout.html?type=thumbnail&hook1=…&hook2=…&model=…</code>. A template expression is a posed marketing still, not a claim that the exact frame appeared in the episode.</p><div class="grid">${card('youtube-thumbnail-sample.png','Chhola Bhatura · lead episode thumbnail')}${card('youtube-thumbnail-neutral-sample.png','Chhola Bhatura · alternate show hook')}${card('youtube-thumbnail-chintu-supporting-sample.png','Chintu · supporting episode example')}${card('vertical-cover-sample.png','Chhola Bhatura · portrait cover','portrait')}${card('vertical-cover-crop-preview.png','Centre-crop review · guides only','portrait')}</div>
 <h2 id="captions">Captions and lower thirds</h2><p>Transparent overlays shown over a checkerboard. Caption wording is a sample; saved audio supplies the timing. Keep captions to short phrases, at most two lines.</p><div class="grid">${card('caption-landscape-overlay.png','Landscape caption','check')}${card('lower-third-landscape-overlay.png','Landscape nameplate','check')}${card('caption-portrait-overlay.png','Portrait caption · room for platform controls','check portrait')}${card('lower-third-portrait-overlay.png','Portrait nameplate','check portrait')}</div>
 <h2 id="cast">Actual-avatar cutouts</h2><p>Seven shipped models, each with neutral, smile and surprised variants. These use original model identities, not AI-invented faces. Match model IDs to each accepted take before naming a person; the custom host is reserved for explicit selection.</p>${['neutral','smile','surprised'].map(expression=>`<h3 style="margin-top:28px">${expression}</h3><div class="cast-grid">${assets.filter(a=>a.type==='cast-cutout'&&a.file.endsWith('-'+expression+'.png')).map(a=>`<div class="check"><a download href="${a.file}"><img src="${a.file}" alt="${esc(a.file)}" loading="lazy">${esc(a.file.replace('cast/','').replace('.png',''))}</a></div>`).join('')}</div>`).join('')}
 <h2 id="motion">Motion and sound</h2><p>Short intro sting and ending card in landscape and portrait. No replacement of the app’s opening camera sequence. Existing “News Theme” excerpts retain CC BY 4.0 credits; use <a href="notices/AUDIO-CREDITS.txt">the credit block</a> in every full-video or derivative description.</p><div class="video-grid">${assets.filter(a=>a.file.endsWith('.mp4')).map(a=>`<article class="card"><video controls preload="metadata" src="${a.file}" poster="assets/${a.type.startsWith('intro')?a.type+'-poster':'end-card-'+(a.type.includes('portrait')?'portrait':'landscape')}.png"></video><div class="caption"><strong>${a.type} · ${a.durationSeconds}s</strong><a download href="${a.file}">Download MP4 ↗</a></div></article>`).join('')}</div><h3 style="margin-top:28px">Audio masters</h3>${['intro-sting.wav','outro-sting.wav','dialogue-bed-preview.wav'].map(f=>`<p>${f}<br><audio controls preload="metadata" src="audio/${f}"></audio> <a download href="audio/${f}">Download WAV</a></p>`).join('')}<p>The dialogue bed is a 20-second mix preview, not a promised seamless loop. Voice-aware ducking belongs to the future rendering/publishing pipeline.</p>
 <h2>Before channel setup</h2><div class="notes"><ul><li>Review the logo, banner and example artwork above.</li><li>Choose an available handle in your YouTube/Instagram account. Suggested spellings are in <a href="brand.json">brand.json</a>; availability is unverified.</li><li>Supply a public business contact only if you want it displayed. None is invented.</li><li>Channel copy, editable templates, provenance and account setup steps are bundled in this folder.</li><li>Account linking and upload automation begin in P02 and later waves.</li></ul></div></main></body></html>`;
}
