import { request } from 'node:https';

const MODEL = 'eleven_flash_v2_5';
const SAMPLE_RATE = 24000;

// British English voices — expire 2026-12-31, replace with cloned voices after competition
const VOICES = {
  virus:     { id: 'onwK4e9ZLuTAKqWW03F9', stability: 0.85, similarity: 0.90, style: 0.10 }, // George  — whispery, restrained advisor
  architect: { id: 'pFZP5JQG7iQjIQuC4Bku', stability: 0.65, similarity: 0.80, style: 0.40 }, // Lily    — warm, thoughtful
  builder:   { id: 'JBFqnCBsd6RMkjVDRZzb', stability: 0.70, similarity: 0.85, style: 0.20 }, // George  — resonant, confident
  inspector: { id: 'Xb7hH8MSUJpSbSDYk0k2', stability: 0.80, similarity: 0.90, style: 0.20 }, // Alice   — clear, precise
  artiste:   { id: 'ThT5KcBeYPX3keUQqHPh', stability: 0.72, similarity: 0.85, style: 0.25 }, // Dorothy — pleasant, young British
};

function pcmToWav(pcm) {
  const buf = Buffer.allocUnsafe(44 + pcm.length);
  buf.write('RIFF', 0);        buf.writeUInt32LE(36 + pcm.length, 4);
  buf.write('WAVE', 8);        buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);   buf.writeUInt16LE(1, 20);  // PCM
  buf.writeUInt16LE(1, 22);    buf.writeUInt32LE(SAMPLE_RATE, 24);
  buf.writeUInt32LE(SAMPLE_RATE * 2, 28); buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);   buf.write('data', 36);
  buf.writeUInt32LE(pcm.length, 40);
  pcm.copy(buf, 44);
  return buf;
}

export async function elevenLabsSynthesize(text, role, { transport = request, key = process.env.ELEVENLABS_API_KEY } = {}) {
  if (!key) throw Object.assign(new Error('ELEVENLABS_API_KEY not set.'), { status: 503 });

  const voice = VOICES[role] ?? VOICES.architect;
  const body = JSON.stringify({
    text,
    model_id: MODEL,
    voice_settings: {
      stability: voice.stability,
      similarity_boost: voice.similarity,
      style: voice.style,
      use_speaker_boost: true,
    },
  });

  return new Promise((resolve, reject) => {
    const req = transport({
      hostname: 'api.elevenlabs.io',
      path: `/v1/text-to-speech/${voice.id}?output_format=pcm_24000`,
      method: 'POST',
      headers: {
        'xi-api-key': key,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'Accept': 'audio/pcm',
      },
    }, res => {
      if (res.statusCode !== 200) {
        let err = '';
        res.on('data', c => { err += c; });
        res.on('end', () => reject(Object.assign(
          new Error(`ElevenLabs ${res.statusCode}: ${err.slice(0, 200)}`), { status: 502 }
        )));
        return;
      }
      if ((res.headers['content-type'] || '').includes('mpeg')) { res.resume(); reject(Object.assign(new Error('ElevenLabs returned compressed audio instead of PCM.'), {status:502})); return; }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => { const pcm=Buffer.concat(chunks); if(!pcm.length||pcm.length%2){reject(Object.assign(new Error('ElevenLabs returned incomplete PCM audio.'),{status:502}));return;} resolve(pcmToWav(pcm)); });
    });
    req.on('error', () => reject(Object.assign(new Error('ElevenLabs connection failed.'), { status: 502 })));
    req.setTimeout(15_000, () => {
      req.destroy();
      reject(Object.assign(new Error('ElevenLabs timed out.'), { status: 504 }));
    });
    req.end(body);
  });
}
