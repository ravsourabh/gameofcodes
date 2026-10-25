import test from 'node:test';
import assert from 'node:assert/strict';
import { geminiGenerate } from '../server/cloud-providers.mjs';
const schema={type:'object',properties:{html:{type:'string'},css:{type:'string'},js:{type:'string'},summary:{type:'string'}},required:['html','css','js','summary']};
test('Gemini builds request structured complete output with bounded thinking',async()=>{
 const previous=process.env.GEMINI_API_KEY;process.env.GEMINI_API_KEY='test-only';
 try{
 let config,endpoint;
 const result=await geminiGenerate([{role:'system',content:'Build'},{role:'user',content:'Reading tracker'}],schema,{isBuild:true,transport:async(_host,path,_headers,body)=>{endpoint=path;config=JSON.parse(body).generationConfig;return{status:200,body:{candidates:[{finishReason:'STOP',content:{parts:[{thought:true,text:'Not the answer'},{text:'{"html":"<h1>Books</h1>","css":"","js":"","summary":"Ready"}'}]}}]}};}});
 assert.match(endpoint,/gemini-3.8-flash/);assert.deepEqual(config.responseJsonSchema,schema);assert.equal(config.thinkingConfig.thinkingLevel,'LOW');assert.equal(result.html,'<h1>Books</h1>');
 await assert.rejects(geminiGenerate([],schema,{isBuild:true,transport:async()=>({status:200,body:{candidates:[{finishReason:'MAX_TOKENS'}]}})}),/output limit/);
 }finally{if(previous===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=previous;}
});
