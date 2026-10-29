import {createHash} from 'node:crypto';

export const PUBLISHING_SCOPES={
 youtube:['https://www.googleapis.com/auth/youtube.upload','https://www.googleapis.com/auth/youtube.force-ssl'],
 instagram:['instagram_business_basic','instagram_business_content_publish'],
};
export class PublishingProviderError extends Error{
 constructor(code='PROVIDER_UNAVAILABLE'){super('The publishing provider could not complete this step. Reconnect or check its application settings.');this.code=code;}
}
export function createPublishingProviders({env=process.env,fetcher=fetch,now=()=>Date.now()}={}){
 const google={id:env.GOC_GOOGLE_CLIENT_ID||'',secret:env.GOC_GOOGLE_CLIENT_SECRET||''};
 const instagram={id:env.GOC_INSTAGRAM_APP_ID||'',secret:env.GOC_INSTAGRAM_APP_SECRET||'',version:env.GOC_INSTAGRAM_API_VERSION||'v22.0'};
 const version=/^v\d{2}\.0$/.test(instagram.version)?instagram.version:null;
 const readiness=provider=>provider==='youtube'?!!(google.id&&google.secret):!!(instagram.id&&instagram.secret&&version);
 async function request(url,options={}){
  try{
   const response=await fetcher(url,{...options,redirect:'error',signal:AbortSignal.timeout(20000)});
   const length=Number(response.headers?.get('content-length')||0);if(length>200000)throw new PublishingProviderError();
   let text='';if(response.body?.getReader){const reader=response.body.getReader(),decoder=new TextDecoder();let bytes=0;try{for(;;){const part=await reader.read();if(part.done)break;bytes+=part.value.length;if(bytes>200000){await reader.cancel();throw new PublishingProviderError();}text+=decoder.decode(part.value,{stream:true});}text+=decoder.decode();}finally{reader.releaseLock();}}else text=await response.text();
   if(text.length>200000)throw new PublishingProviderError();
   let data;try{data=text?JSON.parse(text):{};}catch{throw new PublishingProviderError();}
   if(!response.ok||data.error)throw new PublishingProviderError(response.status===401||response.status===403||['invalid_grant','invalid_token'].includes(data.error)||data.error?.code===190?'RECONNECT_REQUIRED':'PROVIDER_UNAVAILABLE');
   return data;
  }catch(error){if(error instanceof PublishingProviderError)throw error;throw new PublishingProviderError();}
 }
 const form=(url,values)=>request(url,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(values).toString()});
 function authUrl(provider,{state,redirectUri,challenge}){
  if(!readiness(provider))throw new PublishingProviderError('PROVIDER_NOT_CONFIGURED');
  const url=new URL(provider==='youtube'?'https://accounts.google.com/o/oauth2/v2/auth':'https://www.instagram.com/oauth/authorize');
  const values=provider==='youtube'?{client_id:google.id,redirect_uri:redirectUri,response_type:'code',scope:PUBLISHING_SCOPES.youtube.join(' '),state,access_type:'offline',prompt:'consent',include_granted_scopes:'true',code_challenge:challenge,code_challenge_method:'S256'}:{client_id:instagram.id,redirect_uri:redirectUri,response_type:'code',scope:PUBLISHING_SCOPES.instagram.join(','),state,enable_fb_login:'0',force_authentication:'1'};
  for(const[k,v]of Object.entries(values))url.searchParams.set(k,v);return url.href;
 }
 function token(data,fallbackScopes=[]){
  if(typeof data.access_token!=='string'||data.access_token.length<8)throw new PublishingProviderError();
  const scopes=Array.isArray(data.permissions)?data.permissions.filter(x=>typeof x==='string'):typeof data.scope==='string'?data.scope.split(/[ ,]+/).filter(Boolean):fallbackScopes;
  return{accessToken:data.access_token,refreshToken:typeof data.refresh_token==='string'?data.refresh_token:null,expiresAt:Number.isFinite(Number(data.expires_in))&&Number(data.expires_in)>0?now()+Number(data.expires_in)*1000:null,scopes};
 }
 async function exchange(provider,{code,redirectUri,verifier}){
  if(provider==='youtube')return token(await form('https://oauth2.googleapis.com/token',{client_id:google.id,client_secret:google.secret,grant_type:'authorization_code',code,redirect_uri:redirectUri,code_verifier:verifier}));
  let short=await form('https://api.instagram.com/oauth/access_token',{client_id:instagram.id,client_secret:instagram.secret,grant_type:'authorization_code',redirect_uri:redirectUri,code});
  if(short.data){if(!Array.isArray(short.data)||short.data.length!==1||short.access_token)throw new PublishingProviderError();short=short.data[0];}
  const initial=token(short);const url=new URL('https://graph.instagram.com/access_token');url.search=new URLSearchParams({grant_type:'ig_exchange_token',client_secret:instagram.secret,access_token:initial.accessToken}).toString();
  return token(await request(url.href),initial.scopes);
 }
 async function refresh(provider,saved){
  if(provider==='youtube'){
   if(!saved.refreshToken)throw new PublishingProviderError('RECONNECT_REQUIRED');
   const fresh=token(await form('https://oauth2.googleapis.com/token',{client_id:google.id,client_secret:google.secret,grant_type:'refresh_token',refresh_token:saved.refreshToken}),saved.scopes);
   return{...fresh,refreshToken:fresh.refreshToken||saved.refreshToken};
  }
  const url=new URL('https://graph.instagram.com/refresh_access_token');url.search=new URLSearchParams({grant_type:'ig_refresh_token',access_token:saved.accessToken}).toString();return token(await request(url.href),saved.scopes);
 }
 async function identity(provider,saved){
  const headers={Authorization:'Bearer '+saved.accessToken};
  if(provider==='youtube'){
   const data=await request('https://www.googleapis.com/youtube/v3/channels?part=snippet,status&mine=true',{headers});
   if(data.items?.length!==1||!data.items[0].id)throw new PublishingProviderError('CHANNEL_SELECTION_REQUIRED');
   const c=data.items[0];return{id:String(c.id),name:String(c.snippet?.title||'YouTube channel').slice(0,200),handle:String(c.snippet?.customUrl||'').slice(0,150),url:'https://www.youtube.com/channel/'+encodeURIComponent(c.id),type:'youtube-channel',uploadStatus:c.status?.longUploadsStatus||'unknown'};
  }
  const data=await request('https://graph.instagram.com/'+version+'/me?fields=user_id,username,account_type',{headers});
  const accountId=data.user_id||data.id;if(!accountId||!data.username)throw new PublishingProviderError('PROFESSIONAL_ACCOUNT_REQUIRED');
  if(data.account_type&&!['BUSINESS','MEDIA_CREATOR','CREATOR'].includes(data.account_type))throw new PublishingProviderError('PROFESSIONAL_ACCOUNT_REQUIRED');
  return{id:String(accountId),name:String(data.username).slice(0,150),handle:'@'+String(data.username).slice(0,150),url:'https://www.instagram.com/'+encodeURIComponent(data.username)+'/',type:data.account_type||'professional-account'};
 }
 async function permissions(provider,saved,account){
  if(provider==='youtube'){
   const url=new URL('https://oauth2.googleapis.com/tokeninfo');url.searchParams.set('access_token',saved.accessToken);const data=await request(url.href);
   if(data.aud&&data.aud!==google.id)throw new PublishingProviderError('RECONNECT_REQUIRED');
   return typeof data.scope==='string'?data.scope.split(' ').filter(Boolean):[];
  }
  const data=await request('https://graph.instagram.com/'+version+'/'+encodeURIComponent(account.id)+'/permissions',{headers:{Authorization:'Bearer '+saved.accessToken}});
  return(data.data||[]).filter(x=>x.status==='granted').map(x=>x.permission).filter(x=>typeof x==='string');
 }
 async function revoke(provider,saved,account){
  if(provider==='youtube'){
   try{return await form('https://oauth2.googleapis.com/revoke',{token:saved.refreshToken||saved.accessToken});}catch(error){if(error.code==='RECONNECT_REQUIRED')return;throw error;}
  }
  return request('https://graph.instagram.com/'+version+'/'+encodeURIComponent(account.id)+'/permissions',{method:'DELETE',headers:{Authorization:'Bearer '+saved.accessToken}});
 }
 async function privateTest(saved,bytes){
  const boundary='goc-p02-'+createHash('sha256').update(bytes).digest('hex').slice(0,24);
  const metadata={snippet:{title:'Baat Ka Bawaal · private connection test',description:'One-second private API connection check. No episode content.'},status:{privacyStatus:'private',selfDeclaredMadeForKids:false}};
  const body=Buffer.concat([Buffer.from('--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+JSON.stringify(metadata)+'\r\n--'+boundary+'\r\nContent-Type: video/mp4\r\n\r\n'),bytes,Buffer.from('\r\n--'+boundary+'--\r\n')]);
  const data=await request('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=multipart&part=snippet,status',{method:'POST',headers:{Authorization:'Bearer '+saved.accessToken,'Content-Type':'multipart/related; boundary='+boundary},body});
  if(typeof data.id!=='string'||data.status?.privacyStatus!=='private')throw new PublishingProviderError();
  return{id:data.id,url:'https://www.youtube.com/watch?v='+encodeURIComponent(data.id),privacy:'private',processingVerified:false};
 }
 async function privateTestStatus(saved,id){const url=new URL('https://www.googleapis.com/youtube/v3/videos');url.search=new URLSearchParams({part:'status,processingDetails',id}).toString();const data=await request(url.href,{headers:{Authorization:'Bearer '+saved.accessToken}});const video=data.items?.find(v=>v.id===id);if(!video)return{status:'not-found',processingVerified:false};return{status:video.status?.uploadStatus||'unknown',privacy:video.status?.privacyStatus||'unknown',processingVerified:video.status?.uploadStatus==='processed'&&video.status?.privacyStatus==='private'};}
 async function storage(){
  const provider=env.GOC_PUBLISHING_STORAGE_PROVIDER||'unselected',bucket=env.GOC_PUBLISHING_S3_BUCKET||'',region=env.GOC_PUBLISHING_S3_REGION||'';
  return{provider,bucket,region,configured:!!(bucket&&region&&env.GOC_PUBLISHING_S3_ACCESS_KEY_ID&&env.GOC_PUBLISHING_S3_SECRET_ACCESS_KEY),status:provider==='unselected'?'not-selected':'configured-unverified',privateVerified:false,message:'Select private temporary storage in P03. Credentials alone do not prove a bucket is private; no paid resource or bucket has been created.'};
 }
 return{readiness,authUrl,exchange,refresh,identity,permissions,revoke,privateTest,privateTestStatus,storage,
  setup:()=>({youtube:{configured:readiness('youtube'),applicationMode:env.GOC_GOOGLE_APP_MODE||'unknown',scopes:PUBLISHING_SCOPES.youtube,missing:['GOC_GOOGLE_CLIENT_ID','GOC_GOOGLE_CLIENT_SECRET'].filter(k=>!env[k])},instagram:{configured:readiness('instagram'),applicationMode:env.GOC_INSTAGRAM_APP_MODE||'unknown',apiVersion:version,loginRoute:'instagram-login',scopes:PUBLISHING_SCOPES.instagram,missing:['GOC_INSTAGRAM_APP_ID','GOC_INSTAGRAM_APP_SECRET'].filter(k=>!env[k])}})};
}
