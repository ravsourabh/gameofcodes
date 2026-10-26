import { generateCharacter, characterFields, rerollAppearance, validateLibrary, APPEARANCE_OPTIONS, VOICE_STYLES, VOICE_PACES, type CharacterLibrary, type AppearanceKey, type Appearance } from '../shared/character-domain.mjs';
import { validateSession, type Character, type Session } from '../shared/session-domain.mjs';
import type { CharacterPanel, SceneAction } from './session-scene';
import './characters.css';
import { SessionConversation } from './session-conversation';
import {AVATAR_MODELS,REALISTIC_FEATURES,modelForAppearance} from '../shared/avatar-catalog.mjs';

const esc = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
type Callbacks = { profile: () => string; session: () => Session | null; ensureSession: () => Promise<Session | null>; sessionChanged: (session: Session) => void; changed: () => void };
export class CharacterWorkshop {
  library: CharacterLibrary | null = null;
  busy = false;
  isOpen = false;
  private draft: Character | null = null;
  private dirty = false;
  private roleDraft: string | null = null;
  private locks = new Set<AppearanceKey>();
  private feature: AppearanceKey = 'model';
  private view: 'appearance' | 'brain' | 'voice' = 'appearance';
  private optionPage = 0;
  private libraryPage = 0;
  private editField = '';
  private assignmentDirty = false;
  private dialog: HTMLDialogElement;
  private message = '';
  private generation = 0;
  private pendingNavigation: (() => void) | null = null;
  private pendingSave: { signature: string; body: object } | null = null;
  private pendingRoster: { signature: string; body: object } | null = null;
  private pendingApply: {signature:string;body:object}|null=null;
  private fallback: Character;

  constructor(private cb: Callbacks, private ai: SessionConversation) {
    this.fallback = generateCharacter(cb.profile(), { seed: 72, guide: true, id: '00000000-0000-4000-8000-000000000001' });
    this.dialog = document.createElement('dialog'); this.dialog.id = 'characters-dialog'; this.dialog.className = 'character-dialog'; this.dialog.setAttribute('aria-labelledby', 'character-dialog-title');
    document.body.append(this.dialog);
    this.dialog.addEventListener('cancel', event => { event.preventDefault(); this.close(); });
    this.dialog.addEventListener('click', event => {
      const workshop = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-workshop]');
      if (workshop) { void this.handle(`workshop:${workshop.dataset.workshop}`); return; }
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-character-action]'); if (!button || this.busy) return;
      const action = button.dataset.characterAction!;
      if (action === 'close') this.close(); else if (action === 'new') this.newCharacter(); else if (action === 'reroll') this.reroll();
      else if (action === 'save') void this.save(); else if (action === 'cast') void this.toggleCast(); else if (action === 'role') void this.applyRole();
      else if (action === 'guide') void this.makeGuide(); else if (action === 'reload') void this.reload();
      else if (action === 'discard') { const next = this.pendingNavigation; this.pendingNavigation = null; this.dirty = false; next?.(); }
      else if (action.startsWith('select:')) this.select(action.slice(7));
      else if (action.startsWith('reroll:')) this.reroll(action.slice(7) as AppearanceKey);
    });
    this.dialog.addEventListener('input', event => this.edit(event.target as HTMLElement));
    this.dialog.addEventListener('change', event => { if ((event.target as HTMLElement).matches('select,[data-lock]')) this.edit(event.target as HTMLElement); });
    this.dialog.addEventListener('submit', event => { event.preventDefault(); const input = this.dialog.querySelector<HTMLInputElement>('#identity-value'); if (!input || !this.draft) return; if(this.editField==='name')this.draft.name=input.value.slice(0,80);else if(this.editField==='code')this.draft.code=input.value.slice(0,1000);else if(this.editField==='role')this.roleDraft=input.value.slice(0,160);this.dirty=true;this.editField='';this.render(); });
  }
  get guide(): Character { return this.cb.session()?.guidance?.guide || this.library?.characters.find(character => character.id === this.library?.guideId) || this.fallback; }
  get preview(): Character | null { return this.isOpen ? this.draft : null; }
  get activeCast(): Character[] {
    const session = this.cb.session(); if (!session) return [];
    return session.participants.filter(item => item.active).map(item => session.characters.find(character => character.id === item.characterId)!).filter(Boolean);
  }
  get current() { return this.draft; }
  get panel(): CharacterPanel | undefined {
    if(!this.isOpen||!this.draft)return;
    return { id:this.draft.id,name:this.draft.name,code:this.view==='appearance'?this.feature==='model'?'Choose a person · face and hair stay together':`${this.feature} · ${this.draft.avatar.attributes[this.feature]}`:this.view==='brain'?`Brain · ${this.draft.brain?.model||'Choose a model'}`:`Voice · ${this.draft.voice?.provider||'Choose a voice'} · ${this.draft.voicePreference?.pace}`,inCast:this.inCast(this.draft.id),guide:this.draft.id===this.guide.id,feature:this.feature,
      buttons:[...this.choices().slice(this.optionPage*3,this.optionPage*3+3).map((c,i)=>({x:40+i*317,y:255,width:285,height:76,label:c.label,action:`workshop:choice:${c.value}` as SceneAction})),
      {x:40,y:365,width:210,height:74,label:this.view==='appearance'?'Next feature':'Next choices',action:this.view==='appearance'?'workshop:next':'workshop:option-next'},
      {x:265,y:365,width:210,height:74,label:this.draft.id===this.guide.id?'Use this look':this.inCast(this.draft.id)?'Done':'Join the room',action:'workshop:join'},
      {x:490,y:365,width:210,height:74,label:this.view==='appearance'?'Keep / unkeep':this.view==='voice'?'Hear voice':'Appearance',action:this.view==='appearance'?'workshop:keep':this.view==='voice'?'workshop:preview':'workshop:appearance'},
      {x:715,y:365,width:245,height:74,label:'Back to room',action:'workshop:close'},
      {x:40,y:195,width:160,height:44,label:'New',action:'workshop:new'},
      {x:220,y:195,width:160,height:44,label:'Brain',action:'workshop:brain'},
      {x:400,y:195,width:160,height:44,label:'Voice',action:'workshop:voice'},
      {x:580,y:195,width:160,height:44,label:'Describe',action:'ai:type'},
      {x:760,y:195,width:200,height:44,label:'Speak / stop',action:'ai:mic'},...(this.view==='voice'?[{x:650,y:15,width:200,height:50,label:'Pace',action:'workshop:pace' as SceneAction}]:[])] };
  }
  get status() { return this.message; }
  private inCast(id: string) { return !!this.cb.session()?.participants.some(item => item.characterId === id && item.active); }
  private endpoint() { return `/api/characters?profileId=${encodeURIComponent(this.cb.profile())}`; }
  private notify() { this.cb.changed(); }
  private setBusy(value: boolean) { this.busy = value; if(this.isOpen)this.render();else this.notify();this.dialog.querySelectorAll<HTMLButtonElement | HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('button,input,textarea,select').forEach(element => element.disabled = value || element.dataset.restricted === 'true'); }
  private async request<T>(url: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(url, { ...options, signal: AbortSignal.timeout(8000), headers: { 'Content-Type': 'application/json' } });
    const result = await response.json(); if (!response.ok) throw new Error(result.error || 'The character change could not finish.'); return result;
  }
  async reload(profileChanged = false) {
    const profile = this.cb.profile(), token = ++this.generation;
    if (profileChanged) { this.library = null; this.draft = null; this.isOpen = false; this.dirty = false; this.pendingSave = null; this.pendingRoster = null; this.dialog.close(); this.fallback = generateCharacter(profile, { seed: 72, guide: true, id: '00000000-0000-4000-8000-000000000001' }); }
    this.setBusy(true);
    try {
      const result = await this.request<{ library: CharacterLibrary }>(this.endpoint());
      if (token !== this.generation || profile !== this.cb.profile()) return;
      this.library = validateLibrary(result.library);
      if (this.library.profileId !== profile) throw new Error('The returned character library belongs to a different profile.');
      this.message = ''; if (this.isOpen) this.render();
    } catch (error) { if (token === this.generation) { this.message = error instanceof Error ? error.message : 'Saved characters are unavailable.'; if (this.isOpen) this.render(); } }
    finally { if (token === this.generation) this.setBusy(false); }
  }
  open(id = this.guide.id) {
    if (this.busy) return;
    if (this.isOpen && this.dirty) { this.navigate(() => this.open(id)); return; }
    const character = this.library?.characters.find(item => item.id === id);
    if (!character) { this.message = 'Saved characters are unavailable. Try reloading the library.'; this.isOpen = true; this.render(); return; }
    const sessionCharacter=this.cb.session()?.guidance?.guide?.id===id?this.cb.session()!.guidance!.guide:this.cb.session()?.characters.find(c=>c.id===id);
    this.isOpen = true; this.setDraft({...character,name:sessionCharacter?.name||character.name,avatar:sessionCharacter?.avatar||character.avatar,brain:sessionCharacter?.brain||character.brain,voice:sessionCharacter?.voice||character.voice}); this.render();
  }
  onXRChange(active: boolean) { if (active) this.dialog.close(); else if (this.isOpen) this.render(); }
  select(id: string) { this.navigate(() => this.open(id)); }
  async inspect(id:string,view:'brain'|'voice'|'appearance') {
    if(this.busy)return false;
    if(this.isOpen&&this.draft?.id!==id&&this.dirty&&this.library?.characters.some(c=>c.id===this.draft?.id)&&!await this.save())return false;
    if(!this.isOpen||this.draft?.id!==id){this.dirty=false;this.open(id);}
    if(!this.isOpen||this.draft?.id!==id)return false;
    await this.handle(`workshop:${view}`);return true;
  }
  private setDraft(character: Character) { this.draft = structuredClone(character); this.dirty = false; this.roleDraft = null; this.locks.clear(); this.pendingNavigation = null; this.pendingSave = null; this.message = ''; this.assignmentDirty=false;this.editField='';this.view='appearance';this.optionPage=0; }
  private navigate(next: () => void) {
    if (this.busy) return;
    if (this.dirty && this.library?.characters.some(c=>c.id===this.draft?.id)) { void this.save().then(ok=>{if(ok)next();}); }
    else { this.dirty = false; next(); }
  }
  close() { this.navigate(() => { this.isOpen = false; this.pendingNavigation = null; this.dialog.close(); this.notify(); }); }
  newCharacter() {
    this.navigate(() => { this.isOpen = true; this.setDraft(generateCharacter(this.cb.profile())); this.draft!.brain=this.ai.defaultBrain;this.draft!.voice=this.ai.voiceFor(this.draft!); this.dirty = true; this.render(); });
  }
  reroll(key: AppearanceKey | null = null) {
    if (!this.draft || this.busy) return;
    this.draft.avatar = rerollAppearance(this.draft.avatar as Appearance, [...this.locks], undefined, key);if(this.draft.avatar.attributes.accessory==='staff')this.draft.avatar.attributes.accessory='none'; this.dirty = true; this.pendingSave = null; this.message = ''; this.render();
  }
  private edit(element: HTMLElement) {
    if (!this.draft || this.busy) return;
    const input = element as HTMLInputElement;
    if (input.id === 'session-role') { this.roleDraft = input.value; return; }
    if (input.dataset.lock) { input.checked ? this.locks.add(input.dataset.lock as AppearanceKey) : this.locks.delete(input.dataset.lock as AppearanceKey); return; }
    if (input.dataset.attribute) this.draft.avatar.attributes[input.dataset.attribute] = input.value;
    else if (input.id === 'character-name') this.draft.name = input.value;
    else if (input.id === 'character-personality') this.draft.personality = input.value;
    else if (input.id === 'character-code') this.draft.code = input.value;
    else if (input.id === 'voice-style') this.draft.voicePreference = { style: input.value, pace: this.draft.voicePreference?.pace || 'balanced' };
    else if (input.id === 'voice-pace') this.draft.voicePreference = { pace: input.value, style: this.draft.voicePreference?.style || 'measured' };
    else return; // Session roles are applied separately and never edit the library identity.
    this.dirty = true; this.pendingSave = null; this.message = '';
    const status = this.dialog.querySelector('#character-status'); if (status) status.textContent = 'Unsaved character changes';
    const title = this.dialog.querySelector('#character-dialog-title'); if (title) title.textContent = this.draft.name || 'New character';
    this.notify();
  }
  async save(): Promise<boolean> {
    if (!this.draft || !this.library || this.busy) return false;
    let fields;
    try { fields = characterFields({ name: this.draft.name, avatar: this.draft.avatar, personality: this.draft.personality, code: this.draft.code, voicePreference: this.draft.voicePreference }); }
    catch (error) { this.message = error instanceof Error ? error.message : 'Check the character settings.'; this.render(); return false; }
    const profile = this.cb.profile(), exists = this.library.characters.some(item => item.id === this.draft!.id);
    const signature = JSON.stringify({ profile, revision: this.library.revision, id: this.draft.id, fields });
    if (this.pendingSave?.signature !== signature) this.pendingSave = { signature, body: { requestId: crypto.randomUUID(), expectedRevision: this.library.revision, action: exists ? 'update' : 'create', id: this.draft.id, character: fields, ...(this.draft.brain && (!exists||this.assignmentDirty) ? {assignment:{brain:this.draft.brain,voice:this.draft.voice||this.ai.voiceFor(this.draft)}} : {}) } };
    const request = this.pendingSave;
    this.setBusy(true);
    try {
      const result = await this.request<{ library: CharacterLibrary }>(this.endpoint(), { method: 'POST', body: JSON.stringify(request.body) });
      if (profile !== this.cb.profile()) return false;
      this.library = validateLibrary(result.library); this.draft = structuredClone(this.library.characters.find(item => item.id === this.draft!.id)!); this.dirty = false; this.pendingSave = null; this.message = 'Character saved.';
      const next = this.pendingNavigation; this.pendingNavigation = null; this.render(); this.setBusy(false); if (next) next(); return true;
    } catch (error) { this.message = error instanceof Error ? error.message : 'The character could not be saved.'; this.render(); return false; }
    finally { this.setBusy(false); }
  }
  private async roster(entries: { characterId: string; role: string; code?: string }[]) {
    this.setBusy(true);
    try {
      const session = await this.cb.ensureSession();
      if (!session) { this.message = 'The session could not be saved. Your character remains in the library.'; this.render(); return; }
      const profile = this.cb.profile(), signature = JSON.stringify({ profile, id: session.id, revision: session.revision, entries });
      if (this.pendingRoster?.signature !== signature) this.pendingRoster = { signature, body: { requestId: crypto.randomUUID(), expectedRevision: session.revision, action: 'roster', entries } };
      const operation = this.pendingRoster;
      const result = await this.request<{ session: Session }>(`/api/sessions/${session.id}?profileId=${profile}`, { method: 'PATCH', body: JSON.stringify(operation.body) });
      if (profile !== this.cb.profile()) return;
      this.cb.sessionChanged(validateSession(result.session)); this.pendingRoster = null; this.roleDraft = null; this.message = 'Session cast saved.'; this.render();
    } catch (error) { this.message = error instanceof Error ? error.message : 'The cast could not be saved.'; this.render(); }
    finally { this.setBusy(false); }
  }
  async toggleCast() {
    if (!this.draft || !this.library || this.busy) return;
    if (this.draft.id === this.guide.id) { this.message = 'Your guide is separate from the active cast.'; this.render(); return; }
    if ((this.dirty || !this.library.characters.some(item => item.id === this.draft!.id)) && !await this.save()) return;
    const session = this.cb.session();
    const entries = (session?.participants || []).filter(item => item.active).map(item => ({ characterId: item.characterId, role: item.role, code: item.code }));
    if (this.inCast(this.draft.id)) await this.roster(entries.filter(item => item.characterId !== this.draft!.id));
    else {
      if (entries.length >= 5) { this.message = 'The active cast can contain up to five characters plus your guide.'; this.render(); return; }
      const role = this.roleDraft?.trim() || this.dialog.querySelector<HTMLInputElement>('#session-role')?.value.trim() || 'Perspective';
      await this.roster([...entries, { characterId: this.draft.id, role }]);
    }
  }
  async applyRole() {
    if (!this.draft || this.busy || !this.inCast(this.draft.id)) return;
    const role = this.roleDraft?.trim() || this.dialog.querySelector<HTMLInputElement>('#session-role')?.value.trim() || '';
    if (!role) { this.message = 'Enter a role for this session.'; this.render(); return; }
    const entries = this.cb.session()!.participants.filter(item => item.active).map(item => ({ characterId: item.characterId, role: item.characterId === this.draft!.id ? role : item.role, code: item.code }));
    await this.roster(entries);
  }
  async makeGuide() {
    if (!this.draft || !this.library || this.busy) return;
    if (this.dirty && !await this.save()) return;
    const profile = this.cb.profile();
    this.setBusy(true);
    try {
      const result = await this.request<{ library: CharacterLibrary }>(this.endpoint(), { method: 'POST', body: JSON.stringify({ requestId: crypto.randomUUID(), expectedRevision: this.library.revision, action: 'guide', id: this.draft.id }) });
      if (profile !== this.cb.profile()) return;
      this.library = validateLibrary(result.library); this.message = 'Default guide saved for new sessions. Existing session snapshots are preserved.'; this.render();
    } catch (error) { this.message = error instanceof Error ? error.message : 'Guide selection could not be saved.'; this.render(); }
    finally { this.setBusy(false); }
  }
  selectFeature(feature:string) { if(feature==='face')feature='model';if(REALISTIC_FEATURES.includes(feature as 'model')&&!this.busy){this.feature=feature as AppearanceKey;this.view='appearance';this.optionPage=0;this.render();} }
  private choices() {
    if(this.view==='brain')return this.ai.brains.map(b=>({value:b.provider+'|'+b.model,label:b.model||b.provider,provider:b.provider}));
    if(this.view==='voice')return [...(this.ai.catalog?.voices||[]).map(v=>({value:v.provider+'|'+v.id,label:v.name,provider:v.provider})),{value:'browser|default',label:'Device voice',provider:'browser'}];
    if(this.feature==='model')return AVATAR_MODELS.map(m=>({value:m.id,label:m.name,provider:m.description}));
    return (this.feature==='accessory'?['none','glasses','brooch']:APPEARANCE_OPTIONS.colour).map(value=>({value,label:value==='original'?'Original':value[0].toUpperCase()+value.slice(1),provider:''}));
  }
  async describe(text:string) {
    if(this.busy)return;
    if(!this.isOpen)this.newCharacter();const id=this.draft?.id,profile=this.cb.profile();const result=await this.ai.suggest(text);
    if(!result||!this.isOpen||id!==this.draft?.id||profile!==this.cb.profile())return;
    const previous=this.draft!,attributes={...result.fields.avatar.attributes};for(const key of this.locks)if(key!=='model')attributes[key]=previous.avatar.attributes[key];
    const realistic=this.locks.has('model')?{modelId:modelForAppearance(previous.avatar)}:result.fields.avatar.realistic;
    this.draft={...previous,...result.fields,id:previous.id,avatar:{...result.fields.avatar,realistic,attributes},brain:previous.brain||this.ai.defaultBrain,voice:previous.voice||this.ai.voiceFor(previous)};this.message='Choose a person to change face and hair. Outfit tint and accessories update directly.';this.dirty=true;this.pendingSave=null;this.render();
  }
  async join() {
    if(!this.draft||this.busy)return;this.ai.stop();
    if(this.draft.id!==this.guide.id&&!this.inCast(this.draft.id)){await this.toggleCast();if(!this.inCast(this.draft.id))return;}
    else if(this.dirty&&!await this.save())return;
    const character=this.draft;
    if(this.cb.session()?.guidance?.guide?.id===character.id||this.inCast(character.id)){
      const session=this.cb.session()!;
      const signature=JSON.stringify({id:session.id,revision:session.revision,characterId:character.id});if(this.pendingApply?.signature!==signature)this.pendingApply={signature,body:{requestId:crypto.randomUUID(),expectedRevision:session.revision,action:'apply-character',characterId:character.id}};
      try{const response=await fetch(`/api/sessions/${session.id}?profileId=${this.cb.profile()}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(this.pendingApply.body)});const data=await response.json();if(!response.ok)throw new Error(data.error);this.cb.sessionChanged(validateSession(data.session));this.pendingApply=null;}catch(error){this.message=error instanceof Error?error.message:'Look could not be applied. Retry.';this.render();return;}
    }
    if(character.brain)try{await this.ai.assign(character.id,character.brain,character.voice||this.ai.voiceFor(character));}catch(error){this.message=error instanceof Error?error.message:'Brain could not be applied. Retry.';this.render();return;}
    if(this.roleDraft&&this.inCast(character.id)){await this.applyRole();}
    this.isOpen=false;this.dialog.close();document.body.dataset.workshopOpen='false';this.ai.say(`${character.name} is ready.`);this.notify();
  }
  async handle(action: SceneAction) {
    if(this.busy)return;
    if(action==='characters'){this.open();return;}
    if(!action.startsWith('workshop:'))return;
    const value=action.slice(9);
    if(value==='close'){this.ai.stop();this.close();document.body.dataset.workshopOpen='false';}
    else if(value==='new')this.newCharacter();else if(value==='join')await this.join();else if(value==='reroll')this.reroll();
    else if(value==='keep'){this.locks.has(this.feature)?this.locks.delete(this.feature):this.locks.add(this.feature);this.render();}
    else if(value.startsWith('feature:'))this.selectFeature(value.slice(8));
    else if(value==='next'){const keys=REALISTIC_FEATURES;this.selectFeature(keys[(keys.indexOf(this.feature as 'model')+1)%keys.length]);}
    else if(value==='option-next'||value==='option-previous'){const pages=Math.max(1,Math.ceil(this.choices().length/3));this.optionPage=(this.optionPage+(value==='option-next'?1:pages-1))%pages;this.render();}
    else if(value==='brain'||value==='voice'||value==='appearance'){this.view=value;this.optionPage=0;this.render();}
    else if(value.startsWith('choice:')&&this.draft){const choice=value.slice(7);if(!this.choices().some(c=>c.value===choice))return;if(this.view==='appearance'){if(this.feature==='model')this.draft.avatar.realistic={modelId:choice};else this.draft.avatar.attributes[this.feature]=choice;}else{if(this.ai.busy){this.ai.say('Interrupt the current reply before changing a brain or voice.');return;}const [provider,...parts]=choice.split('|');if(this.view==='brain')this.draft.brain={provider,model:parts.join('|')};else this.draft.voice={provider,id:parts.join('|')};this.assignmentDirty=true;}this.dirty=true;this.pendingSave=null;this.message='';this.render();}
    else if(value==='preview'&&this.draft)await this.ai.preview(this.draft);
    else if(value==='pace'&&this.draft){const p=['relaxed','balanced','brisk'];this.draft.voicePreference={style:this.draft.voicePreference?.style||'measured',pace:p[(p.indexOf(this.draft.voicePreference?.pace||'balanced')+1)%p.length]};this.dirty=true;this.render();}
    else if(value==='remove'){await this.toggleCast();if(!this.inCast(this.draft!.id))this.close();}
    else if(value==='guide')await this.makeGuide();else if(value==='reload')await this.reload();else if(value==='retry')await this.join();
    else if(value==='library-next'||value==='library-previous'){const pages=Math.max(1,Math.ceil((this.library?.characters.length||1)/3));this.libraryPage=(this.libraryPage+(value==='library-next'?1:pages-1))%pages;this.render();}
    else if(value.startsWith('select:'))this.select(value.slice(7));else if(value.startsWith('edit:')){this.editField=value.slice(5);this.render();}
  }
  private render() {
    if(!this.isOpen||!this.draft)return;
    const c=this.draft,active=this.inCast(c.id),guide=c.id===this.guide.id,options=this.choices(),chosen=this.view==='appearance'?this.feature==='model'?modelForAppearance(c.avatar):c.avatar.attributes[this.feature]:this.view==='brain'?c.brain?.provider+'|'+c.brain?.model:c.voice?.provider+'|'+c.voice?.id;
    const labels:Record<string,string>={model:'Person',colour:'Outfit tint',accessory:'Accessories'};
    const swatches:Record<string,string>={porcelain:'#e9c4ac',sand:'#d3a181',bronze:'#b67c55',umber:'#82543c',ebony:'#51392f',ink:'#24272c',brown:'#513a2c',auburn:'#80442e',gold:'#bb9755',silver:'#b8b9b0',plum:'#554267',teal:'#326c68',rust:'#975d43',navy:'#354b69',sage:'#6b7a5c',ivory:'#b4ad91'};
    this.dialog.innerHTML=`<div class="workshop-top"><div><span class="eyebrow">CHARACTER STUDIO</span><h2>${esc(c.name)} <button data-workshop="edit:name" aria-label="Rename character">✎</button></h2></div><button class="text-button" data-workshop="close">${this.library?.characters.some(i=>i.id===c.id)?'Back to room':'Discard preview'} ×</button></div>
    <div class="workshop-library"><button data-workshop="library-previous" aria-label="Previous saved characters">‹</button>${(this.library?.characters||[]).slice(this.libraryPage*3,this.libraryPage*3+3).map(i=>`<button data-workshop="select:${i.id}" aria-pressed="${i.id===c.id}">${esc(i.name)}</button>`).join('')}<button data-workshop="library-next" aria-label="Next saved characters">›</button><button class="outline-button" data-workshop="new">＋ New character</button></div>
    <nav class="feature-dock" aria-label="Character features">${Object.keys(labels).map(key=>`<button data-workshop="feature:${key}" aria-pressed="${this.feature===key&&this.view==='appearance'}">${labels[key]}${this.locks.has(key as AppearanceKey)?' · Kept':''}</button>`).join('')}<button data-workshop="brain" aria-pressed="${this.view==='brain'}">Brain</button><button data-workshop="voice" aria-pressed="${this.view==='voice'}">Voice</button></nav>
    <div class="workshop-tray"><div class="workshop-tray-title"><span>${this.view==='appearance'?labels[this.feature]:this.view==='brain'?'Choose a brain':'AI voices'}</span><span class="tray-tools">${this.view==='appearance'?`<button data-workshop="keep" aria-pressed="${this.locks.has(this.feature)}">${this.locks.has(this.feature)?'Kept ✓':'Keep this'}</button><button data-workshop="reroll">Shuffle look ↻</button>`:`<button data-workshop="appearance">Appearance</button>${this.view==='voice'?'<button data-workshop="preview">Hear voice ▷</button><button data-workshop="pace">Change pace</button>':''}`}</span></div><div class="visual-options"><button data-workshop="option-previous" aria-label="Previous choices">‹</button>${options.slice(this.optionPage*3,this.optionPage*3+3).map(o=>`<button class="visual-option" data-workshop="choice:${esc(o.value)}" aria-pressed="${chosen===o.value}">${this.view==='appearance'&&this.feature==='model'?`<img class="person-thumbnail" src="/avatars/rocketbox/${esc(o.value)}.webp" alt="" loading="lazy">`:this.view==='appearance'?`<i class="option-glyph ${this.feature}" style="--swatch:${swatches[o.value]||'#b9c6ae'}" aria-hidden="true">${swatches[o.value]?'':this.feature==='hair'?'〰':this.feature==='beard'?'⌄':this.feature==='clothes'?'♙':this.feature==='accessory'?'◇':'◯'}</i>`:`<small>${esc(o.provider)}</small>`}<span>${esc(o.label)}</span></button>`).join('')}<button data-workshop="option-next" aria-label="Next choices">›</button></div><div class="workshop-bottom"><button class="primary-button" data-workshop="join">${guide?'Use this look':active?'Done':'Join the room'} →</button>${active?'<button class="text-button" data-workshop="remove">Remove</button>':''}<button class="text-button" data-workshop="edit:role">Role</button><button class="text-button" data-workshop="edit:code">My code</button><button class="text-button" data-workshop="guide">Use as guide</button><span class="character-feedback" role="status">${esc(this.busy?'Saving…':this.message)}</span>${this.message&&!this.busy?'<button class="text-button" data-workshop="retry">Retry</button><button class="text-button" data-workshop="reload">Reload</button>':''}</div></div>
    ${this.editField?`<form class="identity-edit"><label for="identity-value">${esc(this.editField)}</label><input id="identity-value" maxlength="${this.editField==='name'?80:this.editField==='role'?160:1000}" value="${esc(this.editField==='name'?c.name:this.editField==='role'?this.roleDraft||'Perspective':c.code)}"><button class="primary-button">Done</button></form>`:''}`;
    document.body.dataset.workshopOpen='true';document.body.dataset.workshopFeature=this.feature;
    document.body.dataset.workshopView=this.view;
    if(document.body.dataset.xrActive!=='true'&&!this.dialog.open)this.dialog.show();
    if(this.busy)this.dialog.querySelectorAll<HTMLButtonElement>('button').forEach(b=>b.disabled=true);
    this.notify();
  }
}
