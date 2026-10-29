import {test,expect} from '@playwright/test';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';

test('publishing setup explains account creation and requires a separate private-upload confirmation',async({page})=>{
 const source=await readFile('src/studio-publishing.ts','utf8'),js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
 let connected=false,uploads=0;const owner='11111111-1111-4111-8111-111111111111',csrf='fixture-csrf';
 const setup={ready:true,missing:[],origin:'https://app.gameofcodes.si',ownerMatches:true,callbackUrls:{youtube:'https://app.gameofcodes.si/api/studio/publishing/oauth/youtube/callback',instagram:'https://app.gameofcodes.si/api/studio/publishing/oauth/instagram/callback'},providers:{youtube:{configured:true,applicationMode:'testing',scopes:[],missing:[]},instagram:{configured:false,applicationMode:'development',scopes:[],missing:['GOC_INSTAGRAM_APP_ID','GOC_INSTAGRAM_APP_SECRET']}}};
 const snapshot=()=>({setup,connections:[{provider:'youtube',status:connected?'connected':'not-connected',account:connected?{id:'UC-CORRECT',name:'Baat Ka Bawaal',handle:'@baatkabawaal',type:'youtube-channel'}:null,scopes:[],missingScopes:[],hasRefreshAuthorization:connected,privateTest:uploads?{status:'uploaded',url:'https://www.youtube.com/watch?v=fixture',processingVerified:false}:null},{provider:'instagram',status:'not-connected',account:null,scopes:[],missingScopes:[]}],storage:{provider:'unselected',configured:false,privateVerified:false,message:'No paid storage has been created.'},unattendedPublishingEnabled:false});
 const server=http.createServer(async(req,res)=>{
  const route=new URL(req.url!,'http://fixture').pathname;
  if(route==='/panel'){res.setHeader('Content-Type','text/html');res.end(`<html><style>body{margin:0;background:#152734;color:#fff3d6;font:16px Arial}main{box-sizing:border-box;max-width:780px;padding:20px}button{padding:12px;margin:5px}input{box-sizing:border-box;max-width:100%}p,li,code{overflow-wrap:anywhere}</style><main id="panel"></main><script type="module">import{StudioPublishing}from'/panel.mjs';const root=document.querySelector('#panel');const p=new StudioPublishing(()=> '${owner}',()=>root.innerHTML=p.html());root.addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(b?.dataset.action.startsWith('publishing:'))p.action(b.dataset.action.slice(11));});await p.load();window.panelReady=true;</script></html>`);return;}
  if(route==='/panel.mjs'){res.setHeader('Content-Type','text/javascript');res.end(js);return;}
  res.setHeader('Content-Type','application/json');if(route.endsWith('/setup'))res.end(JSON.stringify({setup}));else if(route.endsWith('/session'))res.end(JSON.stringify({csrf,...snapshot()}));else if(route.endsWith('/private-test')){expect(req.headers['x-goc-publishing-csrf']).toBe(csrf);let body='';for await(const chunk of req)body+=chunk;const data=JSON.parse(body);expect(data.confirmPrivateUpload).toBe(true);expect(data.expectedAccountId).toBe('UC-CORRECT');uploads++;res.end(JSON.stringify(snapshot()));}else res.writeHead(404).end('{}');
 });
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address()as {port:number};
 try{
  await page.goto('http://127.0.0.1:'+address.port+'/panel');await page.waitForFunction(()=>Boolean((window as unknown as {panelReady:boolean}).panelReady));
  await expect(page.getByRole('heading',{name:'Publishing connections'})).toBeVisible();await expect(page.getByRole('button',{name:'Connect Instagram'})).toBeDisabled();
  await page.getByText('1. Create your channel and account',{exact:true}).click();await expect(page.getByText('Game of Codes Production',{exact:true}).first()).toBeVisible();await expect(page.getByText('Creator',{exact:true})).toBeVisible();
  await page.getByText('2. Configure the developer apps',{exact:true}).click();await expect(page.getByRole('textbox',{name:'youtube callback'})).toHaveValue(setup.callbackUrls.youtube);
  connected=true;await page.getByRole('button',{name:'Refresh connections'}).click();await expect(page.getByText('Account ID: UC-CORRECT',{exact:false})).toBeVisible();
  await page.getByRole('button',{name:'Test with a private 1-second video'}).click();expect(uploads).toBe(0);await expect(page.getByText('A one-second silent navy clip',{exact:false})).toBeVisible();await page.getByRole('button',{name:'Upload private test',exact:true}).click();await expect(page.getByText('Private test: uploaded.',{exact:true})).toBeVisible();expect(uploads).toBe(1);
  expect(await page.evaluate(()=>JSON.stringify(localStorage))).not.toContain(csrf);
  await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }finally{await new Promise<void>(resolve=>{server.close(()=>resolve());server.closeIdleConnections();});}
});
