import {parentPort,workerData} from 'node:worker_threads';
try {
  const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task=getDocument({data:new Uint8Array(workerData),isEvalSupported:false,useSystemFonts:false,disableFontFace:true,stopAtErrors:true,verbosity:0});
  const doc=await task.promise;let text='';
  for(let page=1;page<=Math.min(doc.numPages,12)&&text.length<=12000;page++){
    const content=await(await doc.getPage(page)).getTextContent();
    text+=content.items.map(item=>typeof item.str==='string'?item.str+(item.hasEOL?'\n':' '):'').join('')+'\n';
  }
  parentPort.postMessage({text:text.slice(0,12000),limited:doc.numPages>12||text.length>12000});await task.destroy();
}catch{parentPort.postMessage({error:'Unreadable PDF'});}
