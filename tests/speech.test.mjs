import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { elevenLabsSynthesize } from '../server/tts-elevenlabs.mjs';

test('ElevenLabs requests real PCM in the query and wraps it as playable WAV', async()=>{
  let options, body;
  const transport=(o,callback)=>{
    options=o;const req=new EventEmitter();req.setTimeout=()=>{};req.end=value=>{
      body=JSON.parse(value);const res=new EventEmitter();res.statusCode=200;res.headers={'content-type':'audio/pcm'};
      callback(res);res.emit('data',Buffer.alloc(4800));res.emit('end');
    };return req;
  };
  const wav=await elevenLabsSynthesize('Welcome to the court.','virus',{transport,key:'test-only'});
  assert.match(options.path,/\?output_format=pcm_24000$/);
  assert.equal(body.model_id,'eleven_flash_v2_5');assert.equal('output_format' in body,false);
  assert.equal(wav.toString('ascii',0,4),'RIFF');assert.equal(wav.readUInt32LE(24),24000);
  assert.equal(wav.readUInt32LE(40),4800);assert.equal(wav.length,4844);
});

test('compressed MP3 is never mislabelled as PCM',async()=>{
  const transport=(_options,callback)=>{
    const req=new EventEmitter();req.setTimeout=()=>{};req.end=()=>{
      const res=new EventEmitter();res.statusCode=200;res.headers={'content-type':'audio/mpeg'};res.resume=()=>{};callback(res);
    };return req;
  };
  await assert.rejects(elevenLabsSynthesize('Welcome','virus',{transport,key:'test-only'}),/compressed audio/);
});
