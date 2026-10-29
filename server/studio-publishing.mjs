import {randomBytes,createHash,createHmac,createCipheriv,createDecipheriv,timingSafeEqual} from 'node:crypto';
import {mkdir,lstat,readFile,writeFile,rm} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import {replaceFile} from './atomic-file.mjs';
import {isId} from '../shared/session-domain.mjs';
import {createPublishingProviders,PUBLISHING_SCOPES,PublishingProviderError} from './studio-publishing-providers.mjs';

const BASE='/api/studio/publishing',providers=['youtube','instagram'];
const digest=value=>createHash('sha256').update(value).digest('hex');
const equal=(a,b)=>typeof a==='string'&&typeof b==='string'&&Buffer.byteLength(a)===Buffer.byteLength(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
const encode=b=>Buffer.from(b).toString('base64url');
class PublishingError extends Error{constructor(message,status=400,code='PUBLISHING_ERROR'){super(message);this.status=status;this.code=code;}}
const fail=(message,status=400,code)=>{throw new PublishingError(message,status,code);};
const json=(res,status,data)=>res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}).end(JSON.stringify(data));
const safeError=error=>error instanceof PublishingError?{status:error.status,error:error.message,code:error.code}:error instanceof PublishingProviderError?{status:502,error:error.message,code:error.code}:{status:500,error:'Publishing settings could not be saved. Existing connections are kept.',code:'PUBLISHING_UNAVAILABLE'};
async function input(req,allowed=[]){if(req.headers['content-type']?.split(';')[0]!=='application/json')fail('Use application/json.',415);let size=0,chunks=[];for await(const chunk of req){size+=chunk.length;if(size>16384)fail('Publishing request is too large.',413);chunks.push(chunk);}let data;try{data=JSON.parse(Buffer.concat(chunks));}catch{fail('Use valid JSON.');}if(!data||typeof data!=='object'||Array.isArray(data)||Object.keys(data).some(k=>!allowed.includes(k)))fail('Unexpected publishing fields.');return data;}

export function createStudioPublishing({root,env=process.env,adapter=createPublishingProviders({env}),now=()=>Date.now(),runFile=promisify(execFile)}={}){
 const base=path.resolve(root,'.sovereign/publishing/v1');
 let origin;try{const u=new URL(env.GOC_PUBLISHING_ORIGIN||'https://app.gameofcodes.si');if(u.username||u.password||u.search||u.hash||u.pathname!=='/'||!['https:','http:'].includes(u.protocol)||u.protocol==='http:'&&!['localhost','127.0.0.1','[::1]'].includes(u.hostname))throw Error();origin=u.origin;}catch{origin=null;}
 const owner=isId(env.GOC_PUBLISHING_OWNER_PROFILE||'')?env.GOC_PUBLISHING_OWNER_PROFILE.toLowerCase():null;
 const secure=origin?.startsWith('https:'),gateway=env.GOC_PUBLISHING_GATEWAY_TOKEN||'';
 const cookieName=secure?'__Secure-goc-publishing':'goc-publishing',flowCookie=secure?'__Secure-goc-publishing-flow':'goc-publishing-flow';
 const missing=()=>[...(!origin?['GOC_PUBLISHING_ORIGIN']:[]),...(!owner?['GOC_PUBLISHING_OWNER_PROFILE']:[]),...(secure&&gateway.length<32?['GOC_PUBLISHING_GATEWAY_TOKEN']:[])];
 let keyPromise,queue=Promise.resolve();
 async function serial(work){const job=queue.catch(()=>{}).then(work);queue=job;return job;}
 async function directory(){
  let current=path.resolve(root);for(const part of ['.sovereign','publishing','v1']){current=path.join(current,part);try{await mkdir(current,{mode:0o700});}catch(e){if(e.code!=='EEXIST')throw e;}const info=await lstat(current);if(!info.isDirectory()||info.isSymbolicLink())fail('Private publishing storage is unavailable.',409);}
 }
 async function file(name){const target=path.join(base,name);try{const info=await lstat(target);if(info.isSymbolicLink()||!info.isFile()||info.size>1200000)fail('Private publishing storage needs review.',409);}catch(e){if(e.code!=='ENOENT')throw e;}return target;}
 async function master(){
  if(!keyPromise)keyPromise=(async()=>{await directory();const target=await file('master.key');let key;try{key=await readFile(target);}catch(e){if(e.code!=='ENOENT')throw e;try{await lstat(await file('connections.enc'));fail('The publishing encryption key is missing. Restore it with the encrypted connection backup.',503);}catch(error){if(error.code!=='ENOENT')throw error;}key=randomBytes(32);try{await writeFile(target,key,{mode:0o600,flag:'wx'});}catch(error){if(error.code!=='EEXIST')throw error;key=await readFile(target);}}if(key.length!==32)fail('The publishing encryption key needs review.',503);return key;})();return keyPromise;
 }
 const aad=()=>Buffer.from('goc-publishing-v1:'+origin+':'+owner);
 async function load(){
  const key=await master();let bytes;try{bytes=await readFile(await file('connections.enc'));}catch(e){if(e.code==='ENOENT')return{schemaVersion:1,ownerProfile:owner,origin,connections:{},pending:{},generations:{youtube:0,instagram:0},events:[]};throw e;}
  try{const envelope=JSON.parse(bytes);const decipher=createDecipheriv('aes-256-gcm',key,Buffer.from(envelope.iv,'base64'));decipher.setAAD(aad());decipher.setAuthTag(Buffer.from(envelope.tag,'base64'));const state=JSON.parse(Buffer.concat([decipher.update(Buffer.from(envelope.data,'base64')),decipher.final()]));if(state.schemaVersion!==1||state.ownerProfile!==owner||state.origin!==origin)throw Error();return state;}catch{fail('Encrypted publishing data cannot be opened. Restore the matching key/configuration; existing data has been kept.',503,'PUBLISHING_VAULT_LOCKED');}
 }
 async function save(state){
  const key=await master(),iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(aad());const data=Buffer.concat([cipher.update(JSON.stringify(state)),cipher.final()]);const bytes=JSON.stringify({v:1,iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:data.toString('base64')});if(bytes.length>1000000)fail('Publishing storage has reached its bounded size.',413);
  const temporary=await file('pending-'+randomBytes(12).toString('hex')+'.tmp');try{await writeFile(temporary,bytes,{mode:0o600,flag:'wx'});await replaceFile(temporary,await file('connections.enc'));}finally{await rm(temporary,{force:true});}
 }
 async function mac(value){return createHmac('sha256',await master()).update(value).digest('base64url');}
 function cookies(req){const result={};for(const part of String(req.headers.cookie||'').slice(0,16000).split(';')){const at=part.indexOf('=');if(at>0)result[part.slice(0,at).trim()]=part.slice(at+1).trim();}return result;}
 const cookie=(name,value,maxAge)=>`${name}=${value}; Path=${BASE}; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure?'; Secure':''}`;
 function configuration(){return{ready:missing().length===0,missing:missing(),origin:origin||'https://app.gameofcodes.si',ownerMatches:true,providers:adapter.setup(),callbackUrls:Object.fromEntries(providers.map(p=>[p,(origin||'https://app.gameofcodes.si')+BASE+'/oauth/'+p+'/callback'])),accountActionsEnabled:false};}
 function gatewayProof(req){
  if(missing().length)fail('Publishing setup is not configured on this server. Follow the setup steps below.',503,'PUBLISHING_SETUP_REQUIRED');
  if(secure){if(!equal(req.headers['x-goc-publishing-gateway'],gateway))fail('Open Publishing through the password-protected studio address.',403,'PUBLISHING_GATEWAY_REQUIRED');}
  else if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket?.remoteAddress))fail('Local publishing setup requires loopback access.',403);
  if((req.headers['x-forwarded-host']||req.headers.host)!==new URL(origin).host)fail('Use the configured studio address.',403);
 }
 function profile(url){const values=url.searchParams.getAll('profileId');if(values.length!==1||values[0]?.toLowerCase()!==owner)fail('Publishing belongs to the configured owner profile. Switch back to that profile.',403,'PUBLISHING_OWNER_REQUIRED');}
 function sameOrigin(req){if(req.headers.origin!==origin||req.headers['sec-fetch-site']==='cross-site')fail('Publishing changes require the configured studio page.',403,'PUBLISHING_ORIGIN_REQUIRED');}
 async function session(req){const raw=cookies(req)[cookieName];if(!raw||raw.length>1000)return null;const[payload,signature,...extra]=raw.split('.');if(extra.length||!equal(await mac(payload||''),signature))return null;try{const s=JSON.parse(Buffer.from(payload,'base64url'));return s.owner===owner&&s.exp>now()&&s.exp<now()+13*3600000&&typeof s.nonce==='string'?{...s,raw}:null;}catch{return null;}}
 async function requireSession(req){const s=await session(req);if(!s)fail('Reopen Publishing to renew its protected session.',401,'PUBLISHING_SESSION_REQUIRED');return s;}
 async function requireWrite(req){sameOrigin(req);const s=await requireSession(req);if(!equal(req.headers['x-goc-publishing-csrf'],await mac('csrf:'+s.raw)))fail('Reopen Publishing before changing connections.',403,'PUBLISHING_CSRF_REQUIRED');return s;}
 const event=(state,operation,provider)=>{state.events.push({at:now(),operation,provider});state.events=state.events.slice(-100);};
 function publicConnection(provider,c){
  if(!c)return{provider,status:'not-connected',account:null,scopes:[],missingScopes:PUBLISHING_SCOPES[provider],privateTest:null};
  return{provider,status:c.status,account:c.account,connectedAt:c.connectedAt,checkedAt:c.checkedAt,expiresAt:c.token?.expiresAt||null,hasRefreshAuthorization:provider==='youtube'?!!c.token?.refreshToken:!!c.token?.expiresAt,scopes:c.token?.scopes||[],missingScopes:PUBLISHING_SCOPES[provider].filter(s=>!c.token?.scopes?.includes(s)),privateTest:c.privateTest||null,lastError:c.lastError||null};
 }
 async function snapshot(state){return{setup:configuration(),connections:providers.map(p=>publicConnection(p,state.connections[p])),storage:await adapter.storage(),unattendedPublishingEnabled:false};}
 async function usable(state,provider){
  const c=state.connections[provider];if(!c||c.status!=='connected')fail('Connect this publishing account first.',409,'PUBLISHING_NOT_CONNECTED');
  const threshold=provider==='youtube'?300000:7*86400000;
  if(c.token.expiresAt&&c.token.expiresAt-now()<threshold){try{c.token={...c.token,...await adapter.refresh(provider,c.token)};if(!c.token.expiresAt||c.token.expiresAt<=now())throw new PublishingProviderError('RECONNECT_REQUIRED');await save(state);}catch{c.status='reconnect-required';c.lastError='RECONNECT_REQUIRED';await save(state);fail('This authorization expired or was revoked. Reconnect the account.',409,'RECONNECT_REQUIRED');}}
  return c;
 }
 async function callback(req,res,url,provider){
  gatewayProof(req);const s=await requireSession(req),values=url.searchParams.getAll('state'),codes=url.searchParams.getAll('code');
  if(values.length!==1||!/^[A-Za-z0-9_-]{43}$/.test(values[0]))fail('This connection request is invalid or expired.',400,'OAUTH_STATE_INVALID');
  const hash=digest(values[0]);if(!equal(cookies(req)[flowCookie],hash))fail('Finish connecting in the browser where you started.',403,'OAUTH_BROWSER_MISMATCH');
  await serial(async()=>{
   const state=await load(),pending=state.pending[hash];if(!pending||pending.provider!==provider||pending.nonce!==s.nonce||pending.expiresAt<now()||pending.generation!==state.generations[provider])fail('This connection request was already used, cancelled or expired.',400,'OAUTH_STATE_INVALID');
   delete state.pending[hash];await save(state); // Consume before any provider call, including a denied grant.
   if(url.searchParams.has('error')){event(state,'authorization-declined',provider);await save(state);res.writeHead(303,{'Location':origin+'/?publishing='+provider+'-declined','Cache-Control':'no-store','Referrer-Policy':'no-referrer','Set-Cookie':cookie(flowCookie,'',0)}).end();return;}
   if(codes.length!==1||!codes[0]||codes[0].length>4096)fail('The provider did not return a valid authorization code.');
   const token=await adapter.exchange(provider,{code:codes[0],redirectUri:origin+BASE+'/oauth/'+provider+'/callback',verifier:pending.verifier});
   const account=await adapter.identity(provider,token),scopes=await adapter.permissions(provider,token,account);token.scopes=scopes;
   if(PUBLISHING_SCOPES[provider].some(scope=>!scopes.includes(scope)))fail('The account did not grant the required publishing permissions. Reconnect and grant the displayed permissions.',409,'OAUTH_SCOPE_MISSING');
   const prior=state.connections[provider];state.connections[provider]={status:'connected',account,token,connectedAt:now(),checkedAt:now(),privateTest:prior?.account?.id===account.id?prior.privateTest||null:null};event(state,'connected',provider);await save(state);
   res.writeHead(303,{'Location':origin+'/?publishing='+provider+'-connected','Cache-Control':'no-store','Referrer-Policy':'no-referrer','Set-Cookie':cookie(flowCookie,'',0)}).end();
  });
 }
 return{async handle(req,res,url){
  if(url.pathname!==BASE&&!url.pathname.startsWith(BASE+'/'))return false;
  try{
   const match=new RegExp('^'+BASE+'/oauth/(youtube|instagram)/callback$').exec(url.pathname);
   if(match){if(req.method!=='GET')fail('Use the provider redirect.',405);await callback(req,res,url,match[1]);return true;}
   if(url.pathname===BASE+'/setup'&&req.method==='GET'){
    if(req.headers['sec-fetch-site']==='cross-site')fail('Open Publishing in this studio.',403);const setup=configuration();setup.ownerMatches=!!owner&&url.searchParams.get('profileId')?.toLowerCase()===owner;return json(res,200,{setup}),true;
   }
   gatewayProof(req);
   // Moving the private studio to its canonical hostname must not strand the
   // creator's records behind an origin-specific browser profile identifier.
   // Only the authenticated canonical gateway can reveal this configured ID.
   if(url.pathname===BASE+'/workspace-profile'&&req.method==='GET'){
    if(req.headers['sec-fetch-site']==='cross-site')fail('Open your saved studio at its private address.',403);
    return json(res,200,{profile:{id:owner,name:'My saved studio'}}),true;
   }
   profile(url);
   if(url.pathname===BASE+'/session'&&req.method==='POST'){
    sameOrigin(req);await input(req);let s=await session(req);if(!s){const payload=encode(JSON.stringify({owner,nonce:encode(randomBytes(24)),exp:now()+12*3600000}));const raw=payload+'.'+await mac(payload);s={raw};res.setHeader('Set-Cookie',cookie(cookieName,raw,12*3600));}
    return json(res,200,{csrf:await mac('csrf:'+s.raw),...await serial(async()=>snapshot(await load()))}),true;
   }
   await requireSession(req);
   if(url.pathname===BASE&&req.method==='GET')return json(res,200,await serial(async()=>snapshot(await load()))),true;
   const route=new RegExp('^'+BASE+'/(youtube|instagram)/(connect|verify|disconnect|private-test)$').exec(url.pathname);
   if(!route||req.method!=='POST')fail('Choose a supported publishing action.',404);
   const s=await requireWrite(req),provider=route[1],operation=route[2];
   const data=await input(req,operation==='private-test'?['requestId','expectedAccountId','confirmPrivateUpload']:[]);
   await serial(async()=>{
    const state=await load();
    if(operation==='connect'){
     if(state.connections[provider]?.status==='revocation-pending')fail('Finish disconnecting this account before reconnecting. The previous provider revocation is still pending.',409,'REVOCATION_PENDING');
     if(!adapter.readiness(provider))fail('Configure this provider application on the server before connecting.',409,'PROVIDER_NOT_CONFIGURED');
     const raw=encode(randomBytes(32)),hash=digest(raw),verifier=encode(randomBytes(48));
     state.pending=Object.fromEntries(Object.entries(state.pending).filter(([,p])=>p.expiresAt>now()));if(Object.keys(state.pending).length>=10)fail('Too many unfinished connections. Wait ten minutes before starting another.',429);
     state.pending[hash]={provider,nonce:s.nonce,verifier,expiresAt:now()+600000,generation:state.generations[provider]};await save(state);
     const authorizationUrl=adapter.authUrl(provider,{state:raw,redirectUri:origin+BASE+'/oauth/'+provider+'/callback',challenge:encode(createHash('sha256').update(verifier).digest())});
     res.setHeader('Set-Cookie',cookie(flowCookie,hash,600));json(res,200,{authorizationUrl});return;
    }
    if(operation==='disconnect'){
     state.generations[provider]++;for(const[hash,p]of Object.entries(state.pending))if(p.provider===provider)delete state.pending[hash];
     const c=state.connections[provider];if(c){c.status='revocation-pending';await save(state);try{await adapter.revoke(provider,c.token,c.account);delete state.connections[provider];event(state,'disconnected',provider);}catch{c.lastError='REVOCATION_PENDING';}await save(state);}else await save(state);
     json(res,200,await snapshot(state));return;
    }
    const c=await usable(state,provider);
    if(operation==='verify'){
     try{const identity=await adapter.identity(provider,c.token);if(identity.id!==c.account.id)throw new PublishingProviderError('RECONNECT_REQUIRED');const scopes=await adapter.permissions(provider,c.token,identity);if(PUBLISHING_SCOPES[provider].some(v=>!scopes.includes(v)))throw new PublishingProviderError('RECONNECT_REQUIRED');c.account=identity;c.token.scopes=scopes;c.checkedAt=now();c.lastError=null;if(provider==='youtube'&&c.privateTest?.id&&adapter.privateTestStatus)c.privateTest={...c.privateTest,...await adapter.privateTestStatus(c.token,c.privateTest.id)};await save(state);}catch(error){c.status='reconnect-required';c.lastError=error instanceof PublishingProviderError?error.code:'PROVIDER_UNAVAILABLE';await save(state);throw error;}json(res,200,await snapshot(state));return;
    }
    if(provider!=='youtube'||data.confirmPrivateUpload!==true||!isId(data.requestId)||data.expectedAccountId!==c.account.id)fail('Confirm the displayed YouTube channel and private one-second test first.');
    if(c.privateTest&&(c.privateTest.status!=='failed'||c.privateTest.requestId===data.requestId)){json(res,200,{...await snapshot(state),replayed:true});return;}
    c.privateTest={status:'preparing',requestId:data.requestId,createdAt:now()};await save(state);const temp=await file('connection-test-'+randomBytes(12).toString('hex')+'.mp4');
    try{
     await runFile(env.FFMPEG_PATH||'ffmpeg',['-hide_banner','-loglevel','error','-y','-f','lavfi','-i','color=c=0x06152a:s=320x180:r=24','-t','1','-an','-c:v','libx264','-threads','1','-pix_fmt','yuv420p','-movflags','+faststart',temp],{timeout:20000,maxBuffer:65536});
     const bytes=await readFile(temp);if(bytes.length>1000000)fail('The private connection test is unexpectedly large.');
     c.privateTest.status='submitted';await save(state);const result=await adapter.privateTest(c.token,bytes);c.privateTest={...c.privateTest,...result,status:'uploaded',completedAt:now()};event(state,'private-test-uploaded',provider);await save(state);
    }catch{c.privateTest.status=c.privateTest.status==='submitted'?'outcome-unknown':'failed';await save(state);}finally{await rm(temp,{force:true});}
    json(res,200,await snapshot(state));
   });
  }catch(error){const safe=safeError(error);if(!res.headersSent)json(res,safe.status,{error:safe.error,code:safe.code});else res.end();}
  return true;
 }};
}
