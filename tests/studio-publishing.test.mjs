import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {mkdtemp,readFile,writeFile,rm,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const execute=promisify(execFile);
import {createStudioPublishing} from '../server/studio-publishing.mjs';
import {PUBLISHING_SCOPES,createPublishingProviders,PublishingProviderError} from '../server/studio-publishing-providers.mjs';

const BASE='/api/studio/publishing';
async function fixture(run,{secure=false,configured=true,actualClip=false}={}){
 const root=await mkdtemp(path.join(tmpdir(),'goc-publishing-')),owner=randomUUID();let service,clock=Date.now(),exchangeCalls=0,refreshCalls=0,uploadCalls=0,revokeCalls=0,revocationFails=false,scopeMissing=false,preparationFails=false;
 const server=http.createServer((req,res)=>void service.handle(req,res,new URL(req.url,'http://fixture')).then(found=>{if(!found)res.writeHead(404).end();}));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const transport='http://127.0.0.1:'+server.address().port,origin=secure?'https://app.gameofcodes.si':transport;
 const env={GOC_PUBLISHING_ORIGIN:origin,GOC_PUBLISHING_OWNER_PROFILE:configured?owner:'',GOC_PUBLISHING_GATEWAY_TOKEN:'gateway-'+ 'g'.repeat(40)};
 const token=p=>({accessToken:p+'-ACCESS-SECRET-123456',refreshToken:p==='youtube'?'REFRESH-SECRET-98765':null,expiresAt:clock+(p==='youtube'?3600000:60*86400000),scopes:PUBLISHING_SCOPES[p]});
 const adapter={
  setup:()=>Object.fromEntries(['youtube','instagram'].map(p=>[p,{configured:true,applicationMode:'testing',scopes:PUBLISHING_SCOPES[p],missing:[]}])),readiness:()=>true,
  authUrl:(p,{state,redirectUri,challenge})=>'https://'+(p==='youtube'?'accounts.google.com':'www.instagram.com')+'/authorize?'+new URLSearchParams({state,redirect_uri:redirectUri,code_challenge:challenge}),
  exchange:async p=>{exchangeCalls++;return token(p);},refresh:async p=>{refreshCalls++;return{...token(p),accessToken:'ROTATED-ACCESS-SECRET'};},
  identity:async p=>({id:p==='youtube'?'UC-FIXTURE':'IG-FIXTURE',name:p==='youtube'?'Baat Ka Bawaal':'baatkabawaal',handle:'@baatkabawaal',type:'professional',url:'https://example.test'}),
  permissions:async p=>scopeMissing?[]:PUBLISHING_SCOPES[p],
  revoke:async()=>{revokeCalls++;if(revocationFails)throw new PublishingProviderError();},
  privateTest:async(_token,bytes)=>{uploadCalls++;assert.ok(bytes.subarray(0,12).includes(Buffer.from('ftyp')));return{id:'private-fixture',url:'https://www.youtube.com/watch?v=private-fixture',privacy:'private',processingVerified:false};},
  privateTestStatus:async()=>({status:'processed',privacy:'private',processingVerified:true}),
  storage:async()=>({provider:'unselected',configured:false,privateVerified:false,status:'not-selected'}),
 };
 const create=()=>service=createStudioPublishing({root,env,adapter,now:()=>clock,...(actualClip?{}:{runFile:async(_file,args)=>{if(preparationFails)throw Error('Local encoder unavailable');return writeFile(args.at(-1),Buffer.from('0000ftyp-test-video'));}})});create();
 let jar={},csrf='';const calls=[];
 async function call(part,method='GET',body,extra={}){
  const route=part.startsWith('/oauth/')?BASE+part:BASE+part+(part.includes('?')?'&':'?')+'profileId='+owner;
  const headers={Origin:origin,Host:new URL(origin).host,'X-Forwarded-Host':new URL(origin).host,'Content-Type':'application/json','X-GOC-Publishing-Gateway':env.GOC_PUBLISHING_GATEWAY_TOKEN,...(Object.keys(jar).length?{Cookie:Object.entries(jar).map(([k,v])=>k+'='+v).join('; ')}:{}),...(csrf?{'X-GOC-Publishing-CSRF':csrf}:{}),...extra};
  for(const key of Object.keys(headers))if(headers[key]===null)delete headers[key];
  const response=await fetch(transport+route,{method,headers,redirect:'manual',...(body===undefined?{}:{body:JSON.stringify(body)})});
  for(const raw of response.headers.getSetCookie()){const[name,value]=raw.split(';')[0].split('=');if(value)jar[name]=value;else delete jar[name];}
  const text=await response.text();let data;try{data=JSON.parse(text);}catch{data={};}const result={status:response.status,data,text,headers:response.headers};calls.push(result);return result;
 }
 const start=async()=>{const result=await call('/session','POST',{});assert.equal(result.status,200,result.text);csrf=result.data.csrf;return result;};
 const begin=async(provider='youtube')=>{const result=await call('/'+provider+'/connect','POST',{});assert.equal(result.status,200,result.text);const url=new URL(result.data.authorizationUrl);return{state:url.searchParams.get('state'),url};};
 const finish=async(state,provider='youtube',extra={})=>call('/oauth/'+provider+'/callback?'+new URLSearchParams({state,code:'safe-code'}),'GET',undefined,extra);
 const connect=async(provider='youtube')=>{await start();const b=await begin(provider);const result=await finish(b.state,provider,{'Sec-Fetch-Site':'cross-site',Origin:null});assert.equal(result.status,303,result.text);return b;};
 try{await run({root,owner,origin,env,adapter,call,start,begin,finish,connect,jar:()=>jar,setJar:v=>jar=v,setCsrf:v=>csrf=v,calls,restart:create,advance:ms=>clock+=ms,stats:()=>({exchangeCalls,refreshCalls,uploadCalls,revokeCalls}),failRevoke:v=>revocationFails=v,failPreparation:v=>preparationFails=v,missingScope:v=>scopeMissing=v});}
 finally{await new Promise(resolve=>{server.close(resolve);server.closeIdleConnections();});await rm(root,{recursive:true,force:true});}
}

test('setup is secret-free and disabled publishing creates no files',()=>fixture(async({root,call})=>{
 const setup=await call('/setup');assert.equal(setup.data.setup.ready,false);assert.ok(setup.data.setup.missing.includes('GOC_PUBLISHING_OWNER_PROFILE'));assert.doesNotMatch(setup.text,/SECRET|gateway-gg/);
 assert.equal((await call('/session','POST',{})).status,503);assert.deepEqual(await readdir(root),[]);
},{configured:false}));

test('secure publishing requires gateway proof, canonical origin, owner, session and CSRF',()=>fixture(async({call,start,owner,setCsrf})=>{
 assert.equal((await call('/session','POST',{}, {'X-GOC-Publishing-Gateway':null})).status,403);
 assert.equal((await call('/session','POST',{}, {Origin:'https://attacker.test'})).status,403);
 assert.equal((await call('/session?profileId='+randomUUID(),'POST',{})).status,403);
 assert.equal((await call('')).status,401);
 const boot=await start();assert.match(boot.headers.get('set-cookie'),/Secure/);assert.match(boot.headers.get('set-cookie'),/HttpOnly/);assert.match(boot.headers.get('set-cookie'),/SameSite=Lax/);assert.doesNotMatch(boot.text,/ACCESS-SECRET|REFRESH-SECRET/);
 setCsrf('wrong');assert.equal((await call('/youtube/connect','POST',{})).status,403);
 assert.ok(owner);
},{secure:true}));

test('OAuth uses one-time browser-bound state, PKCE and a fixed callback; tokens remain encrypted',()=>fixture(async({root,connect,call,finish,stats,origin})=>{
 const b=await connect();assert.equal(new URL(b.url.searchParams.get('redirect_uri')).origin,origin);assert.equal(b.url.searchParams.get('code_challenge').length,43);
 const snapshot=await call('');assert.equal(snapshot.data.connections[0].account.name,'Baat Ka Bawaal');assert.equal(snapshot.data.connections[0].status,'connected');assert.equal(snapshot.data.unattendedPublishingEnabled,false);assert.doesNotMatch(snapshot.text,/ACCESS-SECRET|REFRESH-SECRET|verifier|csrf/);
 const encrypted=await readFile(path.join(root,'.sovereign/publishing/v1/connections.enc'),'utf8');assert.doesNotMatch(encrypted,/ACCESS-SECRET|REFRESH-SECRET|Baat Ka Bawaal|safe-code/);
 assert.equal((await finish(b.state)).status,403);assert.equal(stats().exchangeCalls,1);
}));

test('wrong browser, swapped provider, repeated state and expired grants cannot exchange codes',()=>fixture(async({start,begin,finish,jar,setJar,call,advance,stats})=>{
 await start();let b=await begin();const original={...jar()};setJar(Object.fromEntries(Object.entries(original).filter(([k])=>!k.endsWith('-flow'))));assert.equal((await finish(b.state)).status,403);setJar(original);
 assert.equal((await finish(b.state,'instagram')).status,400);
 assert.equal((await call('/oauth/youtube/callback?state='+b.state+'&state='+b.state+'&code=code')).status,400);
 advance(601000);assert.equal((await finish(b.state)).status,400);assert.equal(stats().exchangeCalls,0);
}));

test('denied grants consume state without exposing provider error details',()=>fixture(async({start,begin,call,stats})=>{
 await start();const b=await begin();const result=await call('/oauth/youtube/callback?'+new URLSearchParams({state:b.state,error:'access_denied',error_description:'SECRET-provider-diagnostic'}));assert.equal(result.status,303);assert.match(result.headers.get('location'),/youtube-declined$/);assert.doesNotMatch(result.text,/SECRET/);assert.equal(stats().exchangeCalls,0);
}));

test('a pending OAuth flow and encrypted connection survive a service restart',()=>fixture(async({start,begin,finish,restart,call})=>{
 await start();const b=await begin();restart();assert.equal((await finish(b.state)).status,303);restart();assert.equal((await call('')).data.connections[0].account.id,'UC-FIXTURE');
}));

test('grant missing required permissions never becomes connected',()=>fixture(async({start,begin,finish,missingScope,call})=>{
 await start();const b=await begin();missingScope(true);assert.equal((await finish(b.state)).status,409);assert.equal((await call('')).data.connections[0].status,'not-connected');
}));

test('verification refreshes expiring tokens and keeps refresh tokens private',()=>fixture(async({connect,advance,call,stats})=>{
 await connect();advance(3500000);const result=await call('/youtube/verify','POST',{});assert.equal(result.status,200,result.text);assert.equal(stats().refreshCalls,1);assert.equal(result.data.connections[0].hasRefreshAuthorization,true);assert.doesNotMatch(result.text,/ROTATED|REFRESH-SECRET/);
}));

test('disconnect invalidates pending callbacks and provider failure disables use until revocation succeeds',()=>fixture(async({connect,begin,call,finish,failRevoke,stats})=>{
 await connect();const b=await begin();failRevoke(true);let result=await call('/youtube/disconnect','POST',{});assert.equal(result.data.connections[0].status,'revocation-pending');assert.equal((await call('/youtube/verify','POST',{})).status,409);assert.equal((await finish(b.state)).status,400);
 assert.equal((await call('/youtube/connect','POST',{})).status,409);
 failRevoke(false);result=await call('/youtube/disconnect','POST',{});assert.equal(result.data.connections[0].status,'not-connected');assert.equal(stats().revokeCalls,2);
}));

test('private test requires explicit account-bound confirmation, uploads once and verifies processing separately',()=>fixture(async({connect,call,stats})=>{
 await connect();assert.equal((await call('/youtube/private-test','POST',{requestId:randomUUID(),expectedAccountId:'wrong',confirmPrivateUpload:true})).status,400);
 const request={requestId:randomUUID(),expectedAccountId:'UC-FIXTURE',confirmPrivateUpload:true};const results=await Promise.all([call('/youtube/private-test','POST',request),call('/youtube/private-test','POST',request)]);assert.ok(results.every(r=>r.status===200));assert.equal(stats().uploadCalls,1);assert.equal(results[0].data.connections[0].privateTest.processingVerified,false);
 const verified=await call('/youtube/verify','POST',{});assert.equal(verified.data.connections[0].privateTest.processingVerified,true);
}));

test('an uncertain private upload never blindly creates another video',()=>fixture(async({connect,call,adapter,stats})=>{
 await connect();adapter.privateTest=async()=>{throw new PublishingProviderError();};const request={requestId:randomUUID(),expectedAccountId:'UC-FIXTURE',confirmPrivateUpload:true};const first=await call('/youtube/private-test','POST',request);assert.equal(first.data.connections[0].privateTest.status,'outcome-unknown');const retry=await call('/youtube/private-test','POST',{...request,requestId:randomUUID()});assert.equal(retry.data.replayed,true);assert.equal(stats().uploadCalls,0);
}));

test('an encoding failure can be retried with a new explicit request before any upload was submitted',()=>fixture(async({connect,call,failPreparation,stats})=>{
 await connect();failPreparation(true);const request={requestId:randomUUID(),expectedAccountId:'UC-FIXTURE',confirmPrivateUpload:true};assert.equal((await call('/youtube/private-test','POST',request)).data.connections[0].privateTest.status,'failed');assert.equal(stats().uploadCalls,0);failPreparation(false);const result=await call('/youtube/private-test','POST',{...request,requestId:randomUUID()});assert.equal(result.data.connections[0].privateTest.status,'uploaded');assert.equal(stats().uploadCalls,1);
}));

test('wrong or missing vault key never overwrites acknowledged ciphertext',()=>fixture(async({root,connect,restart,call})=>{
 await connect();const folder=path.join(root,'.sovereign/publishing/v1'),before=await readFile(path.join(folder,'connections.enc'));await writeFile(path.join(folder,'master.key'),Buffer.alloc(32,1));restart();assert.equal((await call('')).status,401);assert.equal((await call('/session','POST',{})).status,503);assert.deepEqual(await readFile(path.join(folder,'connections.enc')),before);await rm(path.join(folder,'master.key'));restart();assert.equal((await call('')).status,503);await assert.rejects(readFile(path.join(folder,'master.key')),e=>e.code==='ENOENT');
}));

test('provider adapter uses correct OAuth hosts, minimal feature scopes and preserves refresh authorization',async()=>{
 const requests=[];const env={GOC_GOOGLE_CLIENT_ID:'client-id',GOC_GOOGLE_CLIENT_SECRET:'CLIENT-SECRET',GOC_INSTAGRAM_APP_ID:'ig-app',GOC_INSTAGRAM_APP_SECRET:'IG-SECRET'};
 const responses=[{access_token:'access-token-123',refresh_token:'refresh-secret',expires_in:3600,scope:PUBLISHING_SCOPES.youtube.join(' ')},{access_token:'rotated-token-123',expires_in:3600}];
 const adapter=createPublishingProviders({env,fetcher:async(url,options)=>{requests.push({url:String(url),options});return new Response(JSON.stringify(responses.shift()),{status:200});}});
 const url=new URL(adapter.authUrl('youtube',{state:'state',redirectUri:'https://app.gameofcodes.si/callback',challenge:'challenge'}));assert.equal(url.hostname,'accounts.google.com');assert.equal(url.searchParams.get('code_challenge_method'),'S256');assert.equal(url.searchParams.get('access_type'),'offline');assert.doesNotMatch(url.href,/CLIENT-SECRET/);
 const initial=await adapter.exchange('youtube',{code:'code',redirectUri:'https://app.gameofcodes.si/callback',verifier:'verifier'});const rotated=await adapter.refresh('youtube',initial);assert.equal(rotated.refreshToken,'refresh-secret');assert.equal(new URL(requests[0].url).hostname,'oauth2.googleapis.com');assert.equal(new URLSearchParams(requests[0].options.body).get('code_verifier'),'verifier');
 const ig=new URL(adapter.authUrl('instagram',{state:'state',redirectUri:'https://app.gameofcodes.si/callback',challenge:'unused'}));assert.equal(ig.hostname,'www.instagram.com');assert.deepEqual(ig.searchParams.get('scope').split(','),PUBLISHING_SCOPES.instagram);assert.doesNotMatch(ig.href,/pages_|instagram_content_publish/);
});

test('Instagram adapter exchanges a single grant, extends and refreshes it on graph.instagram.com',async()=>{
 const seen=[],responses=[{access_token:'short-token-123',user_id:'12',permissions:PUBLISHING_SCOPES.instagram},{access_token:'long-token-123',expires_in:5184000},{access_token:'fresh-token-123',expires_in:5184000},{user_id:'12',username:'baatkabawaal',account_type:'MEDIA_CREATOR'},{data:PUBLISHING_SCOPES.instagram.map(permission=>({permission,status:'granted'}))},{success:true}];
 const a=createPublishingProviders({env:{GOC_INSTAGRAM_APP_ID:'id',GOC_INSTAGRAM_APP_SECRET:'secret'},fetcher:async(url,options)=>{seen.push({url:String(url),options});return new Response(JSON.stringify(responses.shift()));}});
 let t=await a.exchange('instagram',{code:'code',redirectUri:'https://app.gameofcodes.si/callback'});assert.equal(t.accessToken,'long-token-123');t=await a.refresh('instagram',t);const account=await a.identity('instagram',t);assert.equal(account.id,'12');assert.deepEqual(await a.permissions('instagram',t,account),PUBLISHING_SCOPES.instagram);await a.revoke('instagram',t,account);assert.equal(new URL(seen[0].url).host,'api.instagram.com');assert.equal(new URL(seen[1].url).host,'graph.instagram.com');assert.equal(new URL(seen[2].url).pathname,'/refresh_access_token');assert.equal(seen.at(-1).options.method,'DELETE');
});

test('raw provider diagnostics and secrets never escape adapter errors',async()=>{
 const a=createPublishingProviders({env:{GOC_GOOGLE_CLIENT_ID:'id',GOC_GOOGLE_CLIENT_SECRET:'secret'},fetcher:async()=>new Response(JSON.stringify({error:'invalid_grant',error_description:'ACCESS-SECRET in raw provider diagnostics'}),{status:400})});
 await assert.rejects(a.exchange('youtube',{code:'code',redirectUri:'https://app.gameofcodes.si/callback',verifier:'v'}),e=>e.code==='RECONNECT_REQUIRED'&&!/ACCESS-SECRET/.test(String(e)));
});

test('two concurrent callbacks exchange their authorization code only once',()=>fixture(async({start,begin,finish,stats})=>{
 await start();const b=await begin();const results=await Promise.all([finish(b.state),finish(b.state)]);assert.deepEqual(results.map(r=>r.status).sort(),[303,400]);assert.equal(stats().exchangeCalls,1);
}));

test('actual FFmpeg produces the private smoke clip without uploading any episode content',()=>fixture(async({connect,call,stats})=>{
 await connect();const result=await call('/youtube/private-test','POST',{requestId:randomUUID(),expectedAccountId:'UC-FIXTURE',confirmPrivateUpload:true});assert.equal(result.status,200,result.text);assert.equal(result.data.connections[0].privateTest.status,'uploaded');assert.equal(stats().uploadCalls,1);
},{actualClip:true}));

test('secure configuration import preserves unrelated keys and does not print secrets',async()=>{
 const folder=await mkdtemp(path.join(tmpdir(),'goc-publishing-config-'));const envFile=path.join(folder,'.env.local'),clientFile=path.join(folder,'google-client.json'),profile=randomUUID(),script=path.resolve('scripts/configure-publishing.mjs');
 try{
  await writeFile(envFile,'OPENAI_API_KEY=UNCHANGED-DUMMY\nGEMINI_API_KEY=ALSO-UNCHANGED\n');await writeFile(clientFile,JSON.stringify({web:{client_id:'fixture.apps.googleusercontent.com',client_secret:'GOCSPX-TEST-SECRET',redirect_uris:['https://app.gameofcodes.si/api/studio/publishing/oauth/youtube/callback']}}));
  const result=await execute(process.execPath,[script,'--profile',profile,'--env-file',envFile,'--google-client-json',clientFile],{cwd:folder});assert.doesNotMatch(result.stdout+result.stderr,/GOCSPX-TEST-SECRET|UNCHANGED-DUMMY/);const before=await readFile(envFile,'utf8');assert.match(before,/OPENAI_API_KEY=UNCHANGED-DUMMY/);assert.match(before,/GEMINI_API_KEY=ALSO-UNCHANGED/);assert.match(before,/GOC_GOOGLE_CLIENT_SECRET="GOCSPX-TEST-SECRET"/);
  await execute(process.execPath,[script,'--profile',profile,'--env-file',envFile],{cwd:folder});assert.equal(await readFile(envFile,'utf8'),before);
 }finally{await rm(folder,{recursive:true,force:true});}
});
