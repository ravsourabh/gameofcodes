import {rename} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';

// Windows readers/scanners can briefly deny replacement. Retry the same atomic
// rename; never unlink or truncate the acknowledged destination to get past it.
export async function replaceFile(source,target,{platform=process.platform,move=rename,wait=delay}={}){
  for(let attempt=0;;attempt++){
    try{return await move(source,target);}
    catch(error){if(platform!=='win32'||!['EPERM','EBUSY','EACCES'].includes(error.code)||attempt>=6)throw error;await wait(Math.min(200,20*2**attempt));}
  }
}
