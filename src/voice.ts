import type { CourtRole } from './characters';

type VoiceEvents = { state: (speaking: boolean) => void; amplitude: (value: number) => void; error: (message: string) => void };
export class CourtVoice {
  private context?: AudioContext;
  private source?: AudioBufferSourceNode;
  private controller?: AbortController;
  private sequence = 0;
  private meter = 0;
  private finishPlayback?: () => void;
  muted = false;
  constructor(private events: VoiceEvents) {}
  async unlock() { this.context ??= new AudioContext(); await this.context.resume(); }
  stop() {
    this.sequence++; this.controller?.abort(); this.finishPlayback?.(); this.finishPlayback = undefined; this.source?.stop(); this.source = undefined;
    cancelAnimationFrame(this.meter); window.speechSynthesis?.cancel(); this.events.state(false); this.events.amplitude(0);
  }
  async speak(role: CourtRole, text: string) {
    this.stop(); if (this.muted) return;
    const sequence = this.sequence; this.controller = new AbortController();
    try {
      await this.unlock();
      const response = await fetch('/api/court/voice', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role, text: text.slice(0, 900) }), signal: this.controller.signal });
      if (!response.ok) throw new Error('Local voice unavailable');
      const buffer = await this.context!.decodeAudioData(await response.arrayBuffer());
      if (sequence !== this.sequence || this.muted) return;
      const source = this.context!.createBufferSource(), analyser = this.context!.createAnalyser(); analyser.fftSize = 256;
      source.buffer = buffer; source.playbackRate.value = role === 'builder' ? 0.93 : role === 'inspector' ? 1.04 : 1;
      source.connect(analyser); analyser.connect(this.context!.destination); this.source = source;
      const samples = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => { if (sequence !== this.sequence) return; analyser.getByteTimeDomainData(samples); const level = Math.sqrt(samples.reduce((sum, sample) => sum + ((sample - 128) / 128) ** 2, 0) / samples.length); this.events.amplitude(Math.min(1, level * 6)); this.meter = requestAnimationFrame(tick); };
      // Await audio completion so callers block until the line finishes speaking
      await new Promise<void>(resolve => {
        this.finishPlayback = resolve;
        source.onended = () => {
          if(sequence!==this.sequence){resolve();return;}
          this.finishPlayback=undefined;cancelAnimationFrame(this.meter); this.source = undefined;
          if (sequence === this.sequence) { this.events.state(false); this.events.amplitude(0); }
          resolve();
        };
        this.events.state(true); source.start(); tick();
      });
    } catch (error) {
      if (sequence !== this.sequence || this.controller?.signal.aborted) return;
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text); const voices = speechSynthesis.getVoices().filter(voice => voice.lang.startsWith('en'));
        utterance.voice = voices.find(voice => role === 'builder' ? /David|George|Mark/i.test(voice.name) : /Zira|Hazel|Susan|Samantha/i.test(voice.name)) || voices[0] || null;
        utterance.rate = role === 'builder' ? 0.9 : 0.98; utterance.pitch = role === 'inspector' ? 1.1 : 1;
        utterance.onstart = () => { this.events.state(true); this.events.amplitude(0.5); };
        await new Promise<void>(resolve => {
          this.finishPlayback=resolve;
          utterance.onend = () => { if(sequence===this.sequence){this.finishPlayback=undefined;this.events.state(false);this.events.amplitude(0);} resolve(); };
          utterance.onerror = utterance.onend;
          speechSynthesis.speak(utterance);
        });
      } else this.events.error("Voice output is unavailable in this browser. The character's reply is shown in captions.");
    }
  }
}

export class CourtMicrophone {
  private recognition: any;
  private stream?: MediaStream;
  private context?: AudioContext;
  private processor?: ScriptProcessorNode;
  private chunks: Float32Array[] = [];
  private timer = 0;
  private sequence = 0;
  private controller?: AbortController;
  recording = false;
  constructor(private events: { state: (active: boolean) => void; transcript: (text: string) => void; error: (message: string) => void }) {}
  async start(useBrowserRecognition = true) {
    if (this.recording) return this.stop();
    this.cancel();
    const sequence = this.sequence;
    const Recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (Recognition && useBrowserRecognition) {
      const recognition = new Recognition(); this.recognition = recognition; recognition.lang = 'en-US'; recognition.interimResults = true; recognition.continuous = false;
      let transcript = '';
      recognition.onresult = (event: any) => { if (sequence === this.sequence) transcript = Array.from(event.results).map((result: any) => result[0].transcript).join(' '); };
      recognition.onend = () => { if (sequence !== this.sequence) return; this.recognition = undefined; this.recording = false; this.events.state(false); if (transcript.trim()) this.events.transcript(transcript.trim()); };
      recognition.onerror = (event: { error: string }) => {
        if (sequence !== this.sequence) return;
        if (['network','service-not-allowed','language-not-supported'].includes(event.error)) {
          recognition.onend = recognition.onerror = null; recognition.abort(); this.recognition = undefined; this.recording = false;
          void this.start(false); return;
        }
        if(event.error!=='aborted')this.events.error(event.error==='not-allowed'?'Microphone access was denied. Allow it in your browser, or write your instruction.':'I did not hear a clear instruction. Please try again, or write it.');
      };
      try { recognition.start(); this.recording = true; this.events.state(true); } catch { this.events.error('Microphone access is unavailable. You can write your instruction instead.'); }
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true }, video: false });
      if (sequence !== this.sequence) { stream.getTracks().forEach(track => track.stop()); return; }
      this.stream = stream;
      this.context = new AudioContext({ sampleRate: 24_000 }); await this.context.resume();
      if (sequence !== this.sequence) return;
      const input = this.context.createMediaStreamSource(this.stream); this.processor = this.context.createScriptProcessor(4096, 1, 1); this.chunks = [];
      this.processor.onaudioprocess = event => { this.chunks.push(new Float32Array(event.inputBuffer.getChannelData(0))); };
      const silent = this.context.createGain(); silent.gain.value = 0; input.connect(this.processor); this.processor.connect(silent); silent.connect(this.context.destination);
      this.recording = true; this.events.state(true); this.timer = window.setTimeout(() => void this.stop(), 20_000);
    } catch { if (sequence !== this.sequence) return; this.cleanup(); this.events.error('Microphone access was denied or is unavailable. Write your instruction to continue.'); }
  }
  async stop() {
    if (this.recognition) { this.recognition.stop(); this.recognition = undefined; return; }
    if (!this.recording || !this.context) return;
    const sequence = this.sequence, sampleRate = this.context.sampleRate, chunks = this.chunks; this.cleanup();
    const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0); if (!length) return;
    const samples = new Float32Array(length); let offset = 0; for (const chunk of chunks) { samples.set(chunk, offset); offset += chunk.length; }
    const outputLength = Math.floor(length * 24_000 / sampleRate), bytes = new ArrayBuffer(44 + outputLength * 2), view = new DataView(bytes);
    const word = (at: number, value: string) => [...value].forEach((char, i) => view.setUint8(at + i, char.charCodeAt(0)));
    word(0, 'RIFF'); view.setUint32(4, 36 + outputLength * 2, true); word(8, 'WAVE'); word(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, 24_000, true); view.setUint32(28, 48_000, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true); word(36, 'data'); view.setUint32(40, outputLength * 2, true);
    for (let i = 0; i < outputLength; i++) { const sample = Math.max(-1, Math.min(1, samples[Math.min(length - 1, Math.floor(i * sampleRate / 24_000))])); view.setInt16(44 + i * 2, sample < 0 ? sample * 32768 : sample * 32767, true); }
    try {
      this.controller = new AbortController();
      const response = await fetch('/api/court/transcribe', { method: 'POST', headers: { 'Content-Type': 'audio/wav' }, body: bytes, signal: this.controller.signal }); const data = await response.json();
      if (sequence !== this.sequence) return;
      if (!response.ok) throw new Error(data.error); if (data.transcript?.trim()) this.events.transcript(data.transcript.trim()); else this.events.error('I did not hear a clear instruction. Please try again.');
    } catch (error) { if (sequence === this.sequence) this.events.error(error instanceof Error ? error.message : 'Transcription failed. Please try again.'); }
  }
  cancel() { this.sequence++; this.controller?.abort(); this.recognition?.abort(); this.recognition = undefined; this.cleanup(); }
  private cleanup() { clearTimeout(this.timer); if (this.processor) this.processor.onaudioprocess = null; this.processor?.disconnect(); this.processor = undefined; this.stream?.getTracks().forEach(track => track.stop()); this.stream = undefined; void this.context?.close(); this.context = undefined; this.chunks = []; this.recording = false; this.events.state(false); }
}
