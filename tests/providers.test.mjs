import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { accountEnvironment, createProviderBridge, parseAssistantOutput, PROVIDERS, runProcess } from '../server/providers.mjs';

const schema={type:'object',properties:{connected:{type:'boolean'}},required:['connected'],additionalProperties:false};
test('local bridge selects and persists providers, uses CLI account auth, and isolates prompts',async()=>{
  const root=await mkdtemp(path.join(tmpdir(),'sovereign-provider-test-'));
  let fail=false,authenticated=true;const calls=[];
  const locate=provider=>provider.id==='muse'?null:`${provider.id}.exe`;
  const execute=async(command,args,options)=>{
    calls.push({command,args,options});
    if(args[0]==='login')return{code:authenticated?0:1,stdout:authenticated?'Logged in using ChatGPT':'Not logged in',stderr:''};
    if(args[0]==='auth')return{code:0,stdout:JSON.stringify({loggedIn:true,authMethod:'claude.ai'}),stderr:''};
    if(fail)return{code:1,stdout:'',stderr:'authentication failed SECRET-MUST-NOT-LEAK'};
    assert.match(options.cwd,/turn-/);assert.ok(options.input.includes('Sovereign local application request'));
    assert.ok(args.includes(command==='codex.exe'?'--ignore-user-config':'--tools'));
    assert.equal(JSON.parse(await readFile(path.join(options.cwd,'schema.json'),'utf8')).properties.connected.type,'boolean');
    return{code:0,stdout:command==='codex.exe'?JSON.stringify({type:'item.completed',item:{type:'agent_message',text:'{"connected":true}'}}):JSON.stringify({type:'result',is_error:false,structured_output:{connected:true}}),stderr:''};
  };
  const bridge=createProviderBridge({root,locate,execute});
  try{
    assert.equal((await bridge.status()).configured,false);
    await assert.rejects(()=>bridge.generate([{role:'user',content:'Hello'}],{schema}),/not installed/);
    await bridge.select('codex');assert.equal((await bridge.status()).configured,true);
    const instruction='hello $(do-not-run) `literal` & "quoted"';
    assert.deepEqual(await bridge.generate([{role:'user',content:instruction}],{schema}),{connected:true});
    assert.ok(calls.at(-1).options.input.includes(instruction));assert.ok(!calls.at(-1).args.includes(instruction));
    assert.equal((await bridge.status()).providers.find(item=>item.id==='codex').state,'connected');
    assert.equal((await createProviderBridge({root,locate,execute}).status()).selectedProvider,'codex');
    assert.deepEqual(await readdir(path.join(root,'.sovereign','agent-runs')),[]);
    await bridge.select('claude');await bridge.check('claude');
    fail=true;await assert.rejects(()=>bridge.generate([{role:'user',content:'Hello'}],{schema}),error=>!/SECRET/.test(error.message)&&/account access/.test(error.message));
    await bridge.select('codex');fail=false;authenticated=false;await assert.rejects(()=>bridge.generate([{role:'user',content:'Hello'}],{schema}),/does not use an API-key login/);
    await assert.rejects(()=>bridge.select('../shell'),/Choose Muse Code/);
  }finally{assert.ok(path.resolve(root).startsWith(path.resolve(tmpdir())+path.sep+'sovereign-provider-test-'));await rm(root,{recursive:true,force:true});}
});

test('CLI reply decoding rejects failed and malformed turns, and handles provider event formats',()=>{
  assert.deepEqual(parseAssistantOutput(PROVIDERS[0],JSON.stringify({type:'message',role:'assistant',content:[{type:'text',text:'{"speech":"Hello","proposal":null}'}]})),{speech:'Hello',proposal:null});
  const museEvent=(payload_type,payload)=>JSON.stringify({schema_version:1,record_type:'event',payload_type,payload_schema_version:1,payload});
  const museReply=museEvent('run.terminal.completed',{kind:'run_terminal',terminal:'completed',text:'{"connected":true}',reason:null});
  assert.deepEqual(parseAssistantOutput(PROVIDERS[0],museReply),{connected:true});
  assert.deepEqual(parseAssistantOutput(PROVIDERS[0],[museEvent('turn.input.user',{kind:'turn_input_user',prompt:'{"connected":false}'}),museEvent('run.output.delta',{kind:'run_output_delta',text:'incomplete'}),museReply].join('\n')),{connected:true});
  assert.throws(()=>parseAssistantOutput(PROVIDERS[0],museEvent('run.output.delta',{kind:'run_output_delta',text:'{"connected":true}'})),/required application reply/);
  assert.throws(()=>parseAssistantOutput(PROVIDERS[0],[museReply,museEvent('run.terminal.failed',{kind:'run_terminal',terminal:'failed',reason:'private'})].join('\n')),/failed request/);
  assert.throws(()=>parseAssistantOutput(PROVIDERS[1],'{"type":"turn.failed","error":{"message":"private"}}'),/failed request/);
  assert.throws(()=>parseAssistantOutput(PROVIDERS[2],'{"type":"result","is_error":true,"result":"private"}'),/could not complete/);
  assert.throws(()=>parseAssistantOutput(PROVIDERS[0],'Not JSON'),/required application reply/);
});

test('process transport passes stdin literally and removes API billing credentials',async()=>{
  const env=accountEnvironment({PATH:'keep',OPENAI_API_KEY:'secret',META_API_KEY:'secret',ANTHROPIC_AUTH_TOKEN:'secret',CLAUDECODE:'nested',HOME:'keep-home'});
  assert.deepEqual(env,{PATH:'keep',HOME:'keep-home'});
  const literal='$(never execute) & "quotes" `literal`\nnext line';
  const result=await runProcess(process.execPath,['-e','process.stdin.pipe(process.stdout)'],{input:literal});
  assert.equal(result.code,0);assert.equal(result.stdout,literal);
  await assert.rejects(()=>runProcess(process.execPath,['-e','setInterval(()=>{},1000)'],{timeout:40}),/timed out/);
});
