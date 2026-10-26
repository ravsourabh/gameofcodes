import {createHash} from 'node:crypto';
import {SessionError} from '../shared/session-domain.mjs';
export const NEWS_FEEDS=[{name:'The Indian Express',url:'https://indianexpress.com/section/india/feed/',host:'indianexpress.com'},{name:'BBC India',url:'https://feeds.bbci.co.uk/news/world/asia/india/rss.xml',host:'bbc.com'}];
const clean=s=>s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/<[^>]*>/g,' ').replace(/&(?:amp|lt|gt|quot|apos|nbsp|ndash|mdash|lsquo|rsquo|ldquo|rdquo);/g,t=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&nbsp;':' ','&ndash;':'–','&mdash;':'—','&lsquo;':'‘','&rsquo;':'’','&ldquo;':'“','&rdquo;':'”'}[t])).replace(/&#(x[\da-f]+|\d+);/gi,(_,v)=>{const n=Number.parseInt(v[0].toLowerCase()==='x'?v.slice(1):v,v[0].toLowerCase()==='x'?16:10);return n>0&&n<=0x10ffff&&!(n>=0xd800&&n<=0xdfff)?String.fromCodePoint(n):'';}).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
export function parseNews(xml,source,now=Date.now()){
 const field=(item,key)=>clean(new RegExp('<'+key+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/'+key+'>','i').exec(item)?.[1]||'');
 return [...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)].slice(0,60).flatMap(([,item])=>{
  const title=field(item,'title').slice(0,240),url=field(item,'link'),date=Date.parse(field(item,'pubDate'));let link;try{link=new URL(url);}catch{return [];}
  const host=link.hostname.replace(/^www\./,'');if(!title||link.protocol!=='https:'||!(host===source.host||host.endsWith('.'+source.host)||source.name==='BBC India'&&host==='bbc.co.uk')||!Number.isFinite(date)||date>now+3600000||now-date>7*86400000)return [];
  return [{id:createHash('sha256').update(url).digest('hex').slice(0,24),title,url:link.href,publishedAt:new Date(date).toISOString(),source:source.name,excerpt:field(item,'description').split(' ').slice(0,45).join(' ').slice(0,400)}];
 });
}
export function createIndianNews({transport=fetch,now=()=>Date.now()}={}){
 let cache=null,pending=null;
 async function load(){const checkedAt=new Date(now()).toISOString(),results=await Promise.allSettled(NEWS_FEEDS.map(async source=>{
  const response=await transport(source.url,{signal:AbortSignal.timeout(12000),redirect:'error',headers:{Accept:'application/rss+xml, application/xml, text/xml'}});if(!response.ok)throw new Error('Feed unavailable');const chunks=[];let bytes=0;for await(const chunk of response.body){bytes+=chunk.length;if(bytes>1000000)throw new Error('Feed too large');chunks.push(chunk);}return parseNews(Buffer.concat(chunks).toString('utf8'),source,now());
 }));
 const articles=[...new Map(results.flatMap(r=>r.status==='fulfilled'?r.value:[]).map(a=>[a.url,a])).values()].sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt)).slice(0,12);
 if(!articles.length)throw new SessionError('Recent Indian news is unavailable. Retry later or add a dated source excerpt yourself.',503,'NEWS_UNAVAILABLE');
 return {checkedAt,articles,unavailableSources:results.flatMap((r,i)=>r.status==='rejected'?[NEWS_FEEDS[i].name]:[]),notice:'Publisher RSS headlines and short excerpts, not independent verification. Review the source and date before discussing.'};}
 return {async get(){if(cache&&now()-cache.at<300000)return cache.value;if(!pending)pending=load().then(value=>{cache={at:now(),value};return value;}).finally(()=>pending=null);return pending;}};
}
