import {deliveryPause} from './delivery.mjs';
import {activeTurns} from './production.mjs';
import {fields} from './validation.mjs';
import {validateScreenSourceUrl} from './screen-source.mjs';
export const SHOTS=['auto','wide','host','speaker','two-person','reaction','close-up','screen'];
export function defaultEdition(take){return {schemaVersion:1,order:activeTurns(take.productionSnapshot).map(line=>line.id),trims:{},shots:[],screen:null};}
export function validateEdition(edition,take){
  fields(edition,['schemaVersion','order','trims','shots','screen','headline'],'take edit');const lines=activeTurns(take.productionSnapshot),ids=lines.map(line=>line.id);
  if(edition.headline!==undefined&&(typeof edition.headline!=='string'||edition.headline.length>100))throw new Error('Use a screen headline of up to 100 characters.');
  if(edition.schemaVersion!==1||!Array.isArray(edition.order)||!edition.order.length||new Set(edition.order).size!==edition.order.length||edition.order.some(id=>!ids.includes(id)))throw new Error('Choose distinct saved lines in the take.');
  if(!edition.trims||typeof edition.trims!=='object'||Array.isArray(edition.trims))throw new Error('Use bounded line trims.');
  for(const [id,trim] of Object.entries(edition.trims)){fields(trim,['startMs','endMs'],'line trim');const line=lines.find(line=>line.id===id);if(!line||!edition.order.includes(id)||!Number.isFinite(trim.startMs)||!Number.isFinite(trim.endMs)||trim.startMs<0||trim.endMs>line.durationMs+.5||trim.endMs-trim.startMs<200)throw new Error('A trim must stay inside the saved recording and keep 0.2 seconds.');}
  if(!Array.isArray(edition.shots)||edition.shots.length>edition.order.length||new Set(edition.shots.map(shot=>shot.lineId)).size!==edition.shots.length)throw new Error('Choose one camera direction per line.');
  for(const shot of edition.shots){fields(shot,['lineId','kind','targetId'],'shot');if(!edition.order.includes(shot.lineId)||!SHOTS.includes(shot.kind)||shot.targetId!==undefined&&!take.castSnapshots.some(actor=>actor.id===shot.targetId))throw new Error('Choose an existing line, camera and actor.');}
  if(edition.screen!==null){fields(edition.screen,['assetId','muted','loop','startMs','sourceUrl'],'screen');validateScreenSourceUrl(edition.screen.sourceUrl);if(!/^[a-f0-9]{64}$/.test(edition.screen.assetId)||typeof edition.screen.muted!=='boolean'||typeof edition.screen.loop!=='boolean'||!Number.isFinite(edition.screen.startMs)||edition.screen.startMs<0||edition.screen.startMs>600000)throw new Error('Choose saved display media.');}
  return edition;
}
export function editionTimeline(take,edition=take.edition||defaultEdition(take)){
  validateEdition(edition,take);const lines=activeTurns(take.productionSnapshot);let timeMs=0;
  return edition.order.map(id=>{const line=lines.find(line=>line.id===id),trim=edition.trims[id]||{startMs:0,endMs:line.durationMs||0},result={...line,sourceStartMs:line.startMs,trimStartMs:trim.startMs,trimEndMs:trim.endMs,startMs:timeMs,durationMs:trim.endMs-trim.startMs,pauseAfterMs:deliveryPause(line,{enabled:!!take.productionSnapshot.writer}),shot:edition.shots.find(shot=>shot.lineId===id)?.kind||'auto'};timeMs+=result.durationMs+result.pauseAfterMs;return result;});
}
export function captionVtt(take,edition){const time=ms=>{const n=Math.round(ms);return `${String(Math.floor(n/3600000)).padStart(2,'0')}:${String(Math.floor(n/60000)%60).padStart(2,'0')}:${String(Math.floor(n/1000)%60).padStart(2,'0')}.${String(n%1000).padStart(3,'0')}`;};return 'WEBVTT\n\n'+editionTimeline(take,edition).map((line,i)=>`${i+1}\n${time(line.startMs)} --> ${time(line.startMs+line.durationMs)}\n${line.characterSnapshot.name.replace(/[<>\r\n]/g,'')}: ${line.text.replace(/-->/g,'→').replace(/</g,'&lt;')}\n`).join('\n');}

export function captionSrt(take,edition){
 const time=ms=>{const n=Math.max(0,Math.round(ms));return `${String(Math.floor(n/3600000)).padStart(2,'0')}:${String(Math.floor(n/60000)%60).padStart(2,'0')}:${String(Math.floor(n/1000)%60).padStart(2,'0')},${String(n%1000).padStart(3,'0')}`;},cues=[],sourceLines=new Map(activeTurns(take.productionSnapshot).map(line=>[line.id,line]));
 for(const line of editionTimeline(take,edition)){
  const text=(line.characterSnapshot.name+': '+line.text).replace(/\s+/gu,' ').replace(/-->/g,'→').trim(),rows=[];let row='';
  for(const word of text.split(' ')){if(row&&(row+' '+word).length>42){rows.push(row);row=word;}else row+=(row?' ':'')+word;}if(row)rows.push(row);
  const pages=[];for(let i=0;i<rows.length;i+=2)pages.push(rows.slice(i,i+2).join('\n'));
  const total=pages.reduce((n,page)=>n+page.length,0);let used=0;
  const duration=sourceLines.get(line.id).durationMs;
  for(const page of pages){const pageStart=duration*used/total;used+=page.length;const pageEnd=duration*used/total,start=Math.max(pageStart,line.trimStartMs),end=Math.min(pageEnd,line.trimEndMs);if(Math.round(end)<=Math.round(start))continue;cues.push(`${cues.length+1}\n${time(line.startMs+start-line.trimStartMs)} --> ${time(line.startMs+end-line.trimStartMs)}\n${page}\n`);}
 }
 return cues.join('\n');
}
