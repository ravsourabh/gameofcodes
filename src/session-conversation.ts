import { validateSession, type Brain, type Character, type Session,type Contribution } from '../shared/session-domain.mjs';
import type { Mouth } from './realistic-avatar';
export type Voice = { provider: string; id: string; name: string };
export type Catalog = { providers: { id: string; name: string; status: string; models: { id: string; name: string }[]; audioModels: string[] }[]; voices: Voice[]; voiceStatus: string; localStatus: string };
type Callbacks = { profile: () => string; session: () => Session | null; ensureSession: () => Promise<Session | null>; sessionChanged: (session: Session) => void; changed: () => void };
export class SessionConversation {
  catalog: Catalog | null = null;
  phase = 'Ready'; caption = 'I’m Virus. Tell me what brings you here, or create someone to join us.';
  quiet = false; speakerId = ''; page = 0;
  private token = 0; private controller: AbortController | null = null; private audio: HTMLAudioElement | null = null;
  private audioUrl:string|null=null;
  private recorder: MediaRecorder | null = null; private stream: MediaStream | null = null;
  private last: { characterId: string; exchangeId?: string;contributionId?:string } | null = null;
  private lastGuidance:{text:string;guide:Character}|null=null;
  private pendingTalk:{signature:string;requestId:string}|null=null;
  private pendingAssignment:{signature:string;requestId:string}|null=null;
  private recordingTimer: ReturnType<typeof setTimeout> | null = null;
  // Lip-sync: provider audio is analysed as it plays; device speech only reports word boundaries.
  private audioContext: AudioContext | null = null; private analyser: AnalyserNode | null = null; private source: MediaElementAudioSourceNode | null = null;
  private spectrum = new Uint8Array(256); private deviceSpeaking = false; private wordAt = 0;
  constructor(private cb: Callbacks) {}
  get busy() { return ['Thinking','Listening','Transcribing','Speaking','Connecting'].includes(this.phase); }
  get brains(): Brain[] { return this.catalog?.providers.flatMap(p => p.models.map(m => ({provider:p.id,model:m.id}))) || []; }
  get defaultBrain(): Brain | null { return this.brains.find(b => b.model === 'gpt-5.4-nano') || this.brains[0] || null; }
  voiceFor(character: Character): Character['voice'] { return character.voice || this.catalog?.voices.length && {provider:this.catalog.voices[character.avatar.seed % this.catalog.voices.length].provider,id:this.catalog.voices[character.avatar.seed % this.catalog.voices.length].id} || {provider:'browser',id:'default'}; }
  get captionPages() { return this.caption.match(/.{1,140}(?:\s|$)|\S{1,140}/g)?.map(t => t.trim()) || ['']; }
  get visibleCaption() { return this.captionPages[Math.min(this.page,this.captionPages.length - 1)] || ''; }
  say(text: string, phase = 'Ready') { this.lastGuidance=null;this.caption = text; this.page = 0; this.phase = phase; this.cb.changed(); }
  async request<T>(path: string, body?: object, signal?: AbortSignal, method=body?'POST':'GET'): Promise<T> {
    const response = await fetch(path, { method, ...(body ? {headers:{'Content-Type':'application/json'},body:JSON.stringify(body)} : {}), signal: signal || AbortSignal.timeout(55000) });
    const data = await response.json(); if (!response.ok) throw new Error(data.error || 'This action could not finish.'); return data;
  }
  private endpoint(action: string) { return `/api/ai/${action}?profileId=${this.cb.profile()}`; }
  async connect() { try { this.catalog = await this.request<Catalog>('/api/ai/catalog'); } catch { this.catalog = null; } this.cb.changed(); }
  async narrate(text:string,guide:Character){
    this.stop(false);const token=++this.token;this.controller=new AbortController();this.speakerId=guide.id;this.last=null;this.say(text,'Guidance');
    this.lastGuidance={text,guide};
    if(this.quiet)return;
    if(guide.voice?.provider==='browser')return this.deviceSpeech(text,guide.voice.id,token);
    if(!guide.voice)return;
    try{const result=await this.request<{audio:string;mime:string}>(this.endpoint('narrate'),{text,sessionId:this.cb.session()?.id},this.controller.signal);if(token!==this.token)return;this.phase='Speaking';this.cb.changed();await this.play(result,token);}catch{if(token===this.token){this.phase='Guidance · captions';this.cb.changed();}}
  }
  async assign(characterId: string, brain: Brain, voice: Character['voice']) {
    const profile=this.cb.profile();
    const session = await this.cb.ensureSession(); if (!session) throw new Error('Your session could not be saved.');
    const signature=JSON.stringify({profile,id:session.id,revision:session.revision,characterId,brain,voice});
    if(this.pendingAssignment?.signature!==signature)this.pendingAssignment={signature,requestId:crypto.randomUUID()};
    const result = await this.request<{session:Session}>(this.endpoint('assign'),{sessionId:session.id,requestId:this.pendingAssignment.requestId,expectedRevision:session.revision,characterId,brain,voice});
    if(profile!==this.cb.profile()||session.id!==this.cb.session()?.id)throw new Error('The active session changed.');
    this.cb.sessionChanged(validateSession(result.session));
    this.pendingAssignment=null;
  }
  reset(){this.stop();this.last=null;this.speakerId='';this.say('Tell me what brings you here, or create someone to join us.');}
  restore(session:Session){const last=session.exchanges?.at(-1);this.last=last?{characterId:last.characterId,exchangeId:last.id}:null;if(last){this.speakerId=last.characterId;this.say(last.text);}else{this.speakerId=session.guidance?.guide?.id||'';this.say('Your room is ready. What would you like to explore?');}}
  async suggest(description: string) {
    if (!this.defaultBrain) throw new Error('No model is connected. Visual avatar choices still work.');
    this.stop(false); const token = ++this.token; this.controller = new AbortController(); this.say('Creating a character from your description…','Thinking');
    try { const result = await this.request<{fields:any;brain:Brain}>(this.endpoint('avatar'),{requestId:crypto.randomUUID(),description,brain:this.defaultBrain},this.controller.signal); if (token !== this.token) return null; this.say('Try the look. Choose Join the room when you like it.'); return result; }
    catch(error) { if (token === this.token) this.say(error instanceof Error ? error.message : 'Try that description again.','Error'); return null; }
    finally { if (token === this.token) this.controller = null; }
  }
  async talk(characterId: string, text: string) {
    this.stop(false); const token = ++this.token, profile = this.cb.profile(); this.controller = new AbortController(); this.speakerId = characterId; this.say('Thinking…','Thinking');
    try {
      let session = await this.cb.ensureSession(); if (!session || token !== this.token) return;
      const character = session.guidance?.guide?.id === characterId ? session.guidance.guide : session.characters.find(c=>c.id===characterId);
      if (!character) throw new Error('Choose someone in the room first.');
      if (!character.brain || !character.voice) { const brain = character.brain || this.defaultBrain; if (!brain) throw new Error('No connected brain. Open Brains to check the providers.'); await this.assign(characterId,brain,this.voiceFor(character)); session = this.cb.session()!; }
      if (token !== this.token) return;
      const signature=JSON.stringify({profile,id:session.id,revision:session.revision,characterId,text});
      if(this.pendingTalk?.signature!==signature)this.pendingTalk={signature,requestId:crypto.randomUUID()};
      const result = await this.request<{session:Session}>(this.endpoint('talk'),{sessionId:session.id,requestId:this.pendingTalk.requestId,expectedRevision:session.revision,characterId,text},this.controller.signal);
      if (token !== this.token || profile !== this.cb.profile()) return;
      this.cb.sessionChanged(validateSession(result.session)); const exchange = result.session.exchanges!.at(-1)!;
      this.pendingTalk=null;
      this.last = {characterId,exchangeId:exchange.id}; this.say(exchange.text); if (!this.quiet) try{await this.speak(this.last,token);}catch{if(token===this.token){this.phase='Voice unavailable';this.cb.changed();}}
    } catch(error) { if (token === this.token) this.say(error instanceof Error ? error.message : 'Reply unavailable. Retry or choose another brain.','Error'); }
    finally { if (token === this.token) { this.controller = null; if (this.phase === 'Thinking') this.phase = 'Ready'; this.cb.changed(); } }
  }
  async repeat() { if(this.lastGuidance){await this.narrate(this.lastGuidance.text,this.lastGuidance.guide);return;}if (this.last) { this.stop(false); const token = ++this.token; this.controller = new AbortController(); try { await this.speak(this.last,token); } catch { if(token===this.token){this.phase='Voice unavailable';this.cb.changed();} } } }
  showContribution(contribution:Contribution){const p=this.cb.session()?.participants.find(p=>p.id===contribution.participantId);if(!p)return;this.stop(false);this.speakerId=p.characterId;this.last={characterId:p.characterId,contributionId:contribution.id};this.say(contribution.text);}
  async presentContribution(contribution:Contribution,signal:AbortSignal){
    this.showContribution(contribution);if(this.quiet)return;
    const token=++this.token;this.controller=new AbortController();
    try{await this.speak(this.last!,token);while(token===this.token&&!signal.aborted&&this.phase==='Speaking')await new Promise(r=>setTimeout(r,80));}
    catch{if(token===this.token){this.phase='Voice unavailable';this.cb.changed();}}
  }
  async preview(character: Character) {
    this.stop(false); const token = ++this.token; this.controller = new AbortController();
    const voice = this.voiceFor(character);
    if (voice?.provider === 'browser') return this.deviceSpeech(`Hello, I’m ${character.name}. ${character.code}`,voice.id,token);
    try { this.phase='Speaking'; this.cb.changed(); const result = await this.request<{audio:string;mime:string}>(this.endpoint('preview'),{voice,voicePreference:character.voicePreference},this.controller.signal); await this.play(result,token); }
    catch(error) { if(token===this.token)this.say(error instanceof Error ? error.message : 'Voice preview unavailable.','Error'); }
  }
  private async speak(last: {characterId:string;exchangeId?:string;contributionId?:string},token:number) {
    const session = this.cb.session(); if (!session) return;
    const character = session.guidance?.guide?.id===last.characterId ? session.guidance.guide : session.characters.find(c=>c.id===last.characterId);
    const savedText=last.contributionId?session.contributions.find(c=>c.id===last.contributionId)?.text:last.exchangeId?session.exchanges?.find(e=>e.id===last.exchangeId)?.text:undefined;
    if(savedText){this.caption=savedText;this.page=0;this.cb.changed();}
    if (character?.voice?.provider === 'browser') return this.deviceSpeech(this.caption,character.voice.id,token);
    this.phase='Speaking'; this.cb.changed();
    const result = await this.request<{audio:string;mime:string}>(this.endpoint('speech'),{sessionId:session.id,requestId:crypto.randomUUID(),characterId:last.characterId,exchangeId:last.exchangeId,contributionId:last.contributionId},this.controller?.signal);
    if(token!==this.token)return; await this.play(result,token);
  }
  private async play(result:{audio:string;mime:string},token:number) {
    if(token!==this.token)return;
    const bytes = Uint8Array.from(atob(result.audio),c=>c.charCodeAt(0)), url=URL.createObjectURL(new Blob([bytes],{type:result.mime}));
    this.audioUrl=url;
    const audio = new Audio(url); this.audio = audio;
    await this.listen(audio); if(token!==this.token)return;
    audio.onended=()=>{URL.revokeObjectURL(url); if(token===this.token){this.phase='Ready';this.cb.changed();}};
    audio.onerror=()=>{URL.revokeObjectURL(url);if(token===this.token){this.phase='Voice unavailable';this.cb.changed();}};
    try { await audio.play(); } catch { URL.revokeObjectURL(url); if(token===this.token){this.phase='Tap Repeat for audio';this.cb.changed();} }
  }
  private deviceSpeech(text:string,id:string,token:number) {
    if (!('speechSynthesis' in window)) { this.phase='Voice unavailable';this.cb.changed();return; }
    const utterance = new SpeechSynthesisUtterance(text); utterance.voice = speechSynthesis.getVoices().find(v=>v.voiceURI===id)||null;
    utterance.onboundary=()=>{this.wordAt=performance.now();};
    utterance.onend=()=>{this.deviceSpeaking=false;if(token===this.token){this.phase='Ready';this.cb.changed();}};utterance.onerror=()=>{this.deviceSpeaking=false;if(token===this.token){this.phase='Voice unavailable';this.cb.changed();}}; this.phase='Speaking';this.deviceSpeaking=true;this.cb.changed();speechSynthesis.speak(utterance);
  }
  // Route playback through an analyser, but only when the audio context is already allowed to play:
  // a suspended context would silence the reply, which matters more than mouth movement.
  private async listen(audio: HTMLAudioElement) {
    this.source?.disconnect(); this.source = null;
    try {
      this.audioContext ??= new AudioContext();
      if (this.audioContext.state !== 'running') await Promise.race([this.audioContext.resume(), new Promise(resolve => setTimeout(resolve, 150))]).catch(() => {});
      if (this.audioContext.state !== 'running') return;
      if (!this.analyser) { this.analyser = this.audioContext.createAnalyser(); this.analyser.fftSize = 512; this.analyser.smoothingTimeConstant = .45; this.analyser.connect(this.audioContext.destination); }
      this.source = this.audioContext.createMediaElementSource(audio); this.source.connect(this.analyser);
    } catch { this.source = null; }
  }
  // The speaker's mouth shape for this frame, or null when nobody is audibly speaking.
  mouth(): Mouth | null {
    if (this.phase !== 'Speaking') return null;
    const clamp = (value: number) => Math.min(1, Math.max(0, value));
    if (this.audio && this.source && this.analyser && this.audioContext) {
      if (this.audio.paused) return null;
      this.analyser.getByteFrequencyData(this.spectrum);
      const hz = this.audioContext.sampleRate / this.analyser.fftSize;
      const band = (low: number, high: number) => { let sum = 0, count = 0; for (let i = Math.floor(low / hz); i <= Math.min(this.spectrum.length - 1, Math.ceil(high / hz)); i++, count++) sum += this.spectrum[i]; return count ? sum / count / 255 : 0; };
      const low = band(150, 600), mid = band(600, 2200), high = band(3000, 7000), open = clamp((low + mid) * .9 - .08);
      return { open, round: clamp((low - mid) * 2.5 + .35), wide: clamp((mid - low) * 2.5 + .25), hiss: clamp(high * 2 - open * .5) };
    }
    // No analysable stream (device voice, or audio that could not be routed): pulse with words.
    if (!this.deviceSpeaking && (!this.audio || this.audio.paused)) return null;
    const now = performance.now(), t = now / 1000, word = this.deviceSpeaking ? Math.exp(-(now - this.wordAt) / 170) : .7;
    return { open: clamp(.12 + .5 * word * (.55 + .45 * Math.sin(t * 17) * Math.sin(t * 5.3))), round: .5 + .5 * Math.sin(t * 2.1), wide: .5 + .5 * Math.sin(t * 1.7 + 1), hiss: 0 };
  }
  stop(cancelServer = true) {
    const wasThinking=this.phase==='Thinking'; ++this.token; this.controller?.abort();this.controller=null;
    if(this.audio){this.audio.pause();this.audio.removeAttribute('src');this.audio.load();this.audio=null;} if('speechSynthesis'in window)speechSynthesis.cancel();
    this.source?.disconnect();this.source=null;this.deviceSpeaking=false;
    if(this.audioUrl){URL.revokeObjectURL(this.audioUrl);this.audioUrl=null;}
    if(this.recordingTimer)clearTimeout(this.recordingTimer);this.recordingTimer=null;
    if(this.recorder?.state==='recording')this.recorder.stop();this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;
    this.phase='Ready';this.cb.changed();
    if(cancelServer){this.pendingTalk=null;if(wasThinking)this.say('Interrupted. Your previous replies are kept.');}
    const session=this.cb.session(),profile=this.cb.profile();
    if(cancelServer&&wasThinking&&session)void fetch(`/api/sessions/${session.id}?profileId=${profile}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId:crypto.randomUUID(),expectedRevision:session.revision,action:'cancel'})}).then(r=>r.json()).then(r=>{if(r.session&&profile===this.cb.profile()&&this.cb.session()?.id===session.id)this.cb.sessionChanged(validateSession(r.session));}).catch(()=>{});
  }
  async microphone(receive:(text:string)=>void) {
    if (this.recorder?.state === 'recording') { this.recorder.stop(); return; }
    this.stop(); const token = ++this.token; this.controller = new AbortController();
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (token !== this.token) { this.stream.getTracks().forEach(t => t.stop()); return; }
      const mime = ['audio/webm','audio/mp4','audio/ogg'].find(t => MediaRecorder.isTypeSupported(t));
      const recorder = new MediaRecorder(this.stream, mime ? { mimeType: mime } : {}); this.recorder = recorder;
      const chunks: Blob[] = []; let size = 0;
      recorder.ondataavailable = event => { size += event.data.size; if (size > 5_000_000) this.stop(); else chunks.push(event.data); };
      recorder.onstop = () => {
        this.stream?.getTracks().forEach(t => t.stop());
        if (this.recordingTimer) clearTimeout(this.recordingTimer);
        if (token === this.token) void this.transcribe(chunks, recorder.mimeType.split(';')[0], token, receive);
      };
      recorder.start(); this.phase = 'Listening'; this.caption = 'Listening… tap the microphone when finished.'; this.cb.changed();
      this.recordingTimer = setTimeout(() => { if (recorder.state === 'recording') recorder.stop(); }, 20000);
    } catch { if (token === this.token) this.say('Microphone unavailable or permission declined. Type instead.','Error'); }
  }
  private async transcribe(chunks: Blob[], mime: string, token: number, receive: (text: string) => void) {
    this.phase = 'Transcribing'; this.cb.changed();
    try {
      const audio = toBase64(new Uint8Array(await new Blob(chunks).arrayBuffer()));
      const result = await this.request<{text:string}>(this.endpoint('transcribe'), { audio, mime }, this.controller?.signal);
      if (token === this.token) { this.phase = 'Ready'; receive(result.text); }
    } catch (error) { if (token === this.token) this.say(error instanceof Error ? error.message : 'Speech could not be recognised.','Error'); }
  }
}
// Encode in slices: one character per byte is slow for multi-megabyte recordings.
function toBase64(bytes: Uint8Array) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}
