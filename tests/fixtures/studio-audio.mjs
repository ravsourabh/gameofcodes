// Silent PCM test recording: verifies the playback clock and rig, not pronunciation.
export function studioWav(durationMs=800){const data=Buffer.alloc(durationMs*48),bytes=Buffer.alloc(44+data.length);bytes.write('RIFF');bytes.writeUInt32LE(bytes.length-8,4);bytes.write('WAVEfmt ',8);bytes.writeUInt32LE(16,16);bytes.writeUInt16LE(1,20);bytes.writeUInt16LE(1,22);bytes.writeUInt32LE(24000,24);bytes.writeUInt32LE(48000,28);bytes.writeUInt16LE(2,32);bytes.writeUInt16LE(16,34);bytes.write('data',36);bytes.writeUInt32LE(data.length,40);return bytes;}

// Deterministic recorded PCM fixture for export QA. An audible tone makes a
// silent/missing audio regression observable without any speech provider calls.
export function studioToneWav(durationMs=1000){const bytes=studioWav(durationMs);for(let sample=0;sample<(bytes.length-44)/2;sample++)bytes.writeInt16LE(Math.round(6000*Math.sin(sample*2*Math.PI*440/24000)),44+sample*2);return bytes;}
