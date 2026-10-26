import { Worker } from 'node:worker_threads';
import { SessionError } from '../shared/session-domain.mjs';

export async function extractContext(input) {
  if(!input || Object.keys(input).some(k=>!['name','mime','data'].includes(k)) || typeof input.name!=='string' || !input.name.trim() || input.name.length>160 || !['text/plain','application/pdf'].includes(input.mime) || typeof input.data!=='string' || !/^[A-Za-z0-9+/]+=*$/.test(input.data))throw new SessionError('Choose a plain text or PDF file.');
  const data=Buffer.from(input.data,'base64');
  if(!data.length || data.length>2_000_000)throw new SessionError('Context files must be under 2 MB.',413);
  let text='',error='';
  try {
    if(input.mime==='text/plain')text=new TextDecoder('utf-8',{fatal:true}).decode(data);
    else {
      if(data.subarray(0,5).toString()!=='%PDF-')throw new Error('Unreadable PDF');
      const result=await new Promise((resolve,reject)=>{
        const worker=new Worker(new URL('./context-worker.mjs',import.meta.url),{workerData:data,resourceLimits:{maxOldGenerationSizeMb:192}});
        const timer=setTimeout(()=>{void worker.terminate();reject(new Error('Extraction timed out'));},10000);
        worker.once('message',result=>{clearTimeout(timer);void worker.terminate();resolve(result);});
        worker.once('error',e=>{clearTimeout(timer);reject(e);});
        worker.once('exit',code=>{clearTimeout(timer);if(code!==0)reject(new Error('Extraction stopped'));});
      });
      if(result.error)throw new Error(result.error);text=result.text;error=result.limited?'Excerpt only: first 12 pages or 12,000 characters.':'';
    }
    if(text.length>12000)error='Excerpt only: first 12,000 characters.';
    text=text.replace(/\u0000/g,'').trim().slice(0,12000);
    if(!text)throw new Error('No readable text');
  } catch {text='';error='No text could be extracted. Encrypted, scanned or unreadable PDFs need a pasted text excerpt.';}
  return {id:crypto.randomUUID(),name:input.name,status:text?'pending':'unreadable',text,error};
}
