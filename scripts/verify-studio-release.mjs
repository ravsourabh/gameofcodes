// Explicit live release acceptance. New isolated profile per fictional pilot;
// existing user records and credentials are never read or changed.
import {chromium} from '@playwright/test';import {randomUUID} from 'node:crypto';import {mkdir,readFile,writeFile} from 'node:fs/promises';import path from 'node:path';
const site=process.env.GOC_VERIFY_URL||'https://gameofcodes.si',out=path.resolve('.sovereign/review/studio-release');await mkdir(out,{recursive:true});let posts=0;
const report={site,startedAt:new Date().toISOString(),release:null,pilots:[],errors:[]};
async function api(profile,route,method='GET',body,binary=false){if(method==='POST'&&++posts>160)throw new Error('Bounded acceptance request limit reached.');const response=await fetch(`${site}/api/studio/${route}${route.includes('?')?'&':'?'}profileId=${profile}`,{method,signal:AbortSignal.timeout(90000),headers:{Origin:new URL(site).origin,'Content-Type':binary?'application/octet-stream':'application/json'},...(body!==undefined?{body:binary?body:JSON.stringify(body)}:{})});const data=await response.json();if(!response.ok)throw new Error(data.error||`HTTP ${response.status}`);return data;}
const tokens=record=>({requestId:randomUUID(),expectedRevision:record.revision,expectedEpoch:record.epoch});
const scenarios=[
 'एक काल्पनिक रेडियो पैनल offline mindfulness LeetCode साथी पर चर्चा करे: छोटे शांत breaks, ध्यान और बिना internet का उपयोग।',
 'काल्पनिक दफ्तर में अनावश्यक बैठक रद्द करने के लिए नई बैठक बुलाई जाती है। गंभीर आवाज़ में हल्का व्यंग्य।',
 'काल्पनिक चाय-पैनल तय करे कि ठंडी चाय के लिए चम्मच या मौसम जिम्मेदार है। कोई वास्तविक समाचार दावा नहीं।',
 'काल्पनिक comedy शो में सोफ़ा अपना gym membership मांगता है और बाकी पात्र उसके पक्ष-विपक्ष में बात करें।',
 'काल्पनिक न्यूज़रूम फोन की एक प्रतिशत battery को राष्ट्रीय स्तर की छोटी घरेलू emergency की तरह गंभीरता से देखे।',
 'काल्पनिक मोहल्ले में free WiFi की कतार लगती है, लेकिन password मांगने के लिए दूसरी कतार है।'
];
let browser;
try{
 report.release=await(await fetch(site+'/release.json?acceptance='+Date.now())).json();
 browser=await chromium.launch({headless:true,args:process.platform==='win32'?['--use-angle=d3d11','--enable-unsafe-swiftshader']:['--disable-gpu','--enable-unsafe-swiftshader']});const context=await browser.newContext({viewport:{width:1280,height:800},deviceScaleFactor:1}),page=await context.newPage();page.on('pageerror',error=>report.errors.push(error.message));await page.goto(site);await page.waitForFunction(()=>document.body.dataset.studioReady==='true');
 const count=process.argv.includes('--smoke')?1:6;
 for(let index=0;index<count;index++){
  const reuse=index===0?process.argv.find(arg=>arg.startsWith('--resume-profile='))?.split('=')[1]:null;const profile=reuse||randomUUID(),premise=scenarios[index]+' हर किरदार केवल एक छोटा वाक्य बोले, अधिकतम 90 अक्षर। पिछले किरदार की असली बात का सीधा जवाब दे। अंत में चुटीला निष्कर्ष हो।';
  let channel,episode;if(reuse){const list=await api(profile,'episodes');episode=(await api(profile,'episodes/'+list.episodes[0].id)).episode;channel=(await api(profile,'channels/'+episode.plan.channelId)).channel;if(!episode.takes.length)throw new Error('The requested recovery profile has no saved take.');}else{({channel}=await api(profile,'channels','POST',{id:randomUUID(),requestId:randomUUID(),templateId:'meme-radio'}));({episode}=await api(profile,`channels/${channel.id}/produce`,'POST',{...tokens(channel),premise}));
  const control=async(operation,extra={})=>{const result=await api(profile,`episodes/${episode.id}/production`,'POST',{...tokens(episode),operation,...extra});episode=result.episode;return result;};await control('start',{prepareOnly:true,turnLimit:3});
  for(let n=0;n<3;n++){await control('turn');await control('drafted',{turnId:episode.production.awaitingPlayback});}
  for(const line of episode.production.turns)await control('voice',{turnId:line.id});await control('ready');
  const saved=await api(profile,'episodes/'+episode.id,'PATCH',{...tokens(episode),operation:'accept-take',takeId:randomUUID()});episode=saved.episode;}const take=episode.takes.at(-1),pilot={number:index+1,profile,channelId:channel.id,episodeId:episode.id,takeId:take.id,premise,turns:episode.production.turns.map(turn=>({id:turn.id,name:turn.characterSnapshot.name,text:turn.text,brain:turn.brain,respondsTo:turn.respondsTo,durationMs:turn.durationMs})),videos:[]};
  report.currentPilot=pilot;await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));
  if(pilot.turns.length!==3||new Set(pilot.turns.map(turn=>turn.name)).size!==3||pilot.turns.slice(1).some((turn,i)=>turn.respondsTo!==pilot.turns[i].id))throw new Error('The actual cast/reference chain is incomplete.');
  await page.evaluate(profile=>localStorage.setItem('goc-session-profiles-v1',JSON.stringify({schemaVersion:1,profiles:[{id:profile,name:'Release pilot'}],selectedId:profile})),profile);await page.goto(`${site}/?channel=${channel.id}&episode=${episode.id}`);await page.waitForFunction(()=>document.body.dataset.studioReady==='true'&&document.body.dataset.realisticAvatars==='3',null,{timeout:60000});await page.locator('nav [data-action="takes"]').click();
  for(const format of index===0?['horizontal','vertical']:['horizontal']){
   let job=(await api(profile,'exports')).exports.find(item=>item.format===format&&item.takeId===take.id),recorded=false;
   if(job&&job.status!=='completed'&&job.status!=='awaiting-recording')await api(profile,`exports/${job.id}/retry`,'POST',{});
   if(!job||job.status==='awaiting-recording'){recorded=true;await page.getByRole('button',{name:format==='horizontal'?'Horizontal video':'Vertical video',exact:true}).click();await page.waitForFunction(()=>document.body.dataset.studioRecording==='true',null,{timeout:20000});await page.waitForFunction(()=>document.body.dataset.studioMode==='exports',null,{timeout:180000});}
   for(let n=0;n<180;n++){job=(await api(profile,'exports')).exports.find(item=>item.format===format&&item.takeId===take.id);if(job?.status==='completed'||job?.status==='failed')break;await new Promise(resolve=>setTimeout(resolve,500));}if(job?.status!=='completed')throw new Error(job?.error||'Export did not finish.');
   const file=path.join(out,`pilot-${index+1}-${format}.mp4`),response=await fetch(`${site}/api/studio/exports/${job.id}/video?profileId=${profile}`);if(!response.ok)throw new Error('Hosted MP4 download failed.');await writeFile(file,Buffer.from(await response.arrayBuffer()));pilot.videos.push({...job,file,url:`${site}/api/studio/exports/${job.id}/video?profileId=${profile}`});if(recorded)await page.getByRole('button',{name:'Saved takes',exact:true}).click();
  }
  await page.reload();await page.waitForFunction(()=>document.body.dataset.studioReady==='true');if((await api(profile,'episodes/'+episode.id)).episode.takes.at(-1).id!==take.id)throw new Error('Saved take did not survive reload.');await page.screenshot({path:path.join(out,`pilot-${index+1}.png`)});report.pilots.push(pilot);delete report.currentPilot;await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log('PASS hosted pilot',index+1,'three actual characters, saved audio, exported',pilot.videos.map(video=>video.format).join('/'));
 }
}catch(error){report.errors.push(error.message);process.exitCode=1;}
finally{await browser?.close();report.finishedAt=new Date().toISOString();report.posts=posts;await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({release:report.release,pilots:report.pilots.length,posts,errors:report.errors,out},null,2));}
