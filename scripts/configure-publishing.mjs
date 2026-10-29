// Secure local/server setup. Prints field names and paths, never secret values.
import {readFile,writeFile,lstat,mkdir,rm,chmod} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import path from 'node:path';
import {isId} from '../shared/session-domain.mjs';
import {replaceFile} from '../server/atomic-file.mjs';
const options={};for(let i=2;i<process.argv.length;i+=2){const key=process.argv[i];if(!['--profile','--origin','--env-file','--google-client-json'].includes(key)||!process.argv[i+1])throw Error('Use --profile UUID [--origin URL] [--env-file private-path] [--google-client-json private-path].');options[key]=process.argv[i+1];}
if(!isId(options['--profile']||''))throw Error('Choose the current studio profile ID shown in Settings → Publishing.');
const origin=new URL(options['--origin']||'https://app.gameofcodes.si');if(origin.pathname!=='/'||origin.search||origin.hash||origin.username||origin.password||origin.protocol!=='https:'&&!(['127.0.0.1','localhost','[::1]'].includes(origin.hostname)&&origin.protocol==='http:'))throw Error('Use HTTPS for the app origin, or HTTP on loopback for local testing.');
const destination=path.resolve(options['--env-file']||'.env.local');if(destination.split(path.sep).some(p=>['public','dist','publishing'].includes(p)))throw Error('Keep credentials outside public asset folders.');
let source='';try{const info=await lstat(destination);if(!info.isFile()||info.isSymbolicLink())throw Error('Choose a regular private environment file.');source=await readFile(destination,'utf8');}catch(error){if(error.code!=='ENOENT')throw error;}
const current=name=>{const match=source.match(new RegExp('^'+name+'=(.*)$','m'));if(!match)return'';try{return JSON.parse(match[1]);}catch{return match[1].trim();}};
const changes={GOC_PUBLISHING_ORIGIN:origin.origin,GOC_PUBLISHING_OWNER_PROFILE:options['--profile'].toLowerCase(),GOC_PUBLISHING_GATEWAY_TOKEN:current('GOC_PUBLISHING_GATEWAY_TOKEN')||randomBytes(32).toString('base64url')};
if(options['--google-client-json']){
 let raw;try{raw=JSON.parse(await readFile(path.resolve(options['--google-client-json']),'utf8'));}catch{throw Error('Choose a valid private Google Web OAuth client JSON. Its contents were not printed.');}const client=raw.web;if(!client||typeof client.client_id!=='string'||typeof client.client_secret!=='string'||!client.redirect_uris?.includes(origin.origin+'/api/studio/publishing/oauth/youtube/callback'))throw Error('Choose a Google Web OAuth client JSON with the exact YouTube callback registered.');
 if(!/^[\w.-]+$/.test(client.client_id)||!/^[\w.-]+$/.test(client.client_secret))throw Error('The Google OAuth credential format needs review.');
 changes.GOC_GOOGLE_CLIENT_ID=client.client_id;changes.GOC_GOOGLE_CLIENT_SECRET=client.client_secret;
}
for(const[name,value]of Object.entries(changes)){const line=name+'='+JSON.stringify(value),pattern=new RegExp('^'+name+'=.*$','m');source=pattern.test(source)?source.replace(pattern,()=>line):source.replace(/\s*$/,'')+'\n'+line+'\n';}
const temporary=destination+'.goc-'+randomBytes(12).toString('hex')+'.tmp';try{await writeFile(temporary,source,{mode:0o600,flag:'wx'});await replaceFile(temporary,destination);await chmod(destination,0o600);}finally{await rm(temporary,{force:true});}
const folder=path.resolve('.sovereign/publishing');await mkdir(folder,{recursive:true,mode:0o700});
await writeFile(path.join(folder,'caddy-header.snippet'),'# Import only inside the authenticated app reverse_proxy block.\nheader_up X-GOC-Publishing-Gateway '+JSON.stringify(changes.GOC_PUBLISHING_GATEWAY_TOKEN)+'\n',{mode:0o600});
console.log('Updated private configuration fields: '+Object.keys(changes).join(', '));console.log('Environment file: '+destination);console.log('Private Caddy snippet: '+path.join(folder,'caddy-header.snippet'));console.log('Secrets were not printed. Configure the authenticated app gateway and restart the app after setup.');
