import {validateSession,type Session,type SetupContext,type Character} from '../shared/session-domain.mjs';
import {generateCharacter,characterFields,validateLibrary,type LessonId} from '../shared/character-domain.mjs';
import {CharacterWorkshop} from './character-workshop';
import {SessionConversation} from './session-conversation';

type Choice={label:string;action:string};
type Callbacks={profile:()=>string;session:()=>Session|null;ensureSession:()=>Promise<Session|null>;sessionChanged:(s:Session)=>void;changed:()=>void;details:()=>void;startDiscussion?:()=>Promise<void>};
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const fieldsFor=(c:Character)=>characterFields({name:c.name,avatar:c.avatar,personality:c.personality,code:c.code,voicePreference:c.voicePreference});
export class GuideSetup {
  active=true;busy=false;
  private element=document.createElement('section');
  private controller:AbortController|null=null;private generation=0;
  private message='';private receipt='';private retryAction:(()=>Promise<void>)|null=null;
  private temporaryView='';private page=0;private castIndex=0;private contextIndex=0;private savedPicker=false;
  private demoActive=false;private initialized=false;
  private displayCaption='';
  private pending:{signature:string;body:object;sessionId:string}|null=null;
  private proposalRequest:{sessionId:string;body:object}|null=null;
  private joinDraft:{role:string;character:Character;requestId:string;rosterId:string}|null=null;
  private pendingRoster:{sessionId:string;characterId:string;body:object}|null=null;
  private pendingLesson:{signature:string;body:object}|null=null;
  private workId=0;private scope='';
  constructor(private cb:Callbacks,private ai:SessionConversation,private workshop:CharacterWorkshop){
    this.element.id='guide-setup';this.element.setAttribute('aria-label','Guide-led setup');document.querySelector('.session-app')!.append(this.element);
    this.element.addEventListener('click',e=>{const button=(e.target as HTMLElement).closest<HTMLButtonElement>('[data-guide]');if(button)void this.handle(button.dataset.guide!);});
    this.element.addEventListener('change',e=>{const input=e.target as HTMLInputElement;if(input.id==='context-file'&&input.files?.[0])void this.upload(input.files[0]);});
  }
  get setup(){return this.cb.session()?.guidance?.setup;}
  get progress(){return this.workshop.library?.guideProgress;}
  get lesson(){return this.progress?.activeLesson;}
  get inputLimit(){return this.temporaryView==='paste'?12000:2000;}
  get view(){return this.temporaryView || (this.lesson==='selection'?'selection':this.setup?.stage || (!this.cb.session()&&this.progress?.lessons.welcome==='pending'?'welcome':'capture'));}
  get caption(){return this.displayCaption;}
  get choices():Choice[]{
    if(this.busy)return [{label:'Interrupt',action:'pause'}];
    if(this.retryAction)return [{label:'Retry',action:'retry'},{label:'Details',action:'details'}];
    if(this.view==='welcome')return [{label:'Quick practice',action:'practice'},{label:'Start talking',action:'direct'}];
    if(this.view==='selection')return [{label:'Skip lesson',action:'skip'},{label:'Explain simply',action:'simple'}];
    if(this.view==='context')return [{label:'Next page',action:'next'},...(this.setup?.context[this.contextIndex]?.status==='pending'?[{label:'Use this excerpt',action:'review-context'}]:[]),{label:'Remove material',action:'remove-context'},{label:(this.setup?.context.length||0)>1?'Other material':'Back',action:(this.setup?.context.length||0)>1?'next-context':'back'}];
    if(this.view==='notes')return [{label:'Next note',action:'next'},{label:'Correct notes',action:'correct'},{label:'Back',action:'back'}];
    if(this.view==='context-menu')return [{label:'Paste text',action:'paste'},{label:'Back',action:'back'}];
    if(this.view==='help')return [{label:'Practise selecting',action:'practice'},{label:'Inspect a brain',action:'brain-lesson'},{label:'Explain this step',action:'simple'},{label:'Back',action:'back'}];
    if(this.view==='review')return [{label:'That’s right',action:'confirm'},{label:'Correct it',action:'correct'},{label:'Read next',action:'next'}];
    if(this.view==='cast'){
      if(this.savedPicker){const chars=this.availableSaved;return [...chars.slice(this.page*2,this.page*2+2).map(c=>({label:c.name,action:`reuse:${c.id}`})),{label:'More saved',action:'next'},{label:'Back',action:'back'}];}
      return [{label:'Invite for this role',action:'invite'},{label:'Use someone saved',action:'saved'},{label:'Next role',action:'next-role'},{label:'Review room & cast',action:'recap'}];
    }
    if(this.view==='recap')return [{label:'Approve setup',action:'approve'},{label:'Try interrupting',action:'demo'},{label:'Change cast',action:'cast'},{label:'Read next',action:'next'}];
    if(this.view==='ready')return [{label:this.cb.session()?.scenario.mode==='discussion'?'Start discussion':'Ask a character',action:this.cb.session()?.scenario.mode==='discussion'?'start-discussion':'free'},{label:'Review notes',action:'notes'},{label:'Edit setup',action:'details'}];
    return [{label:this.setup?.proposal?'Prepare readback':'Use an example',action:this.setup?.proposal?'propose':'example'},{label:'Add context',action:'context-menu'},{label:'Details',action:'details'}];
  }
  private get availableSaved(){const s=this.cb.session();return(this.workshop.library?.characters||[]).filter(c=>c.id!==this.workshop.guide.id&&!s?.participants.some(p=>p.active&&p.characterId===c.id));}
  private pages(text:string){return text.match(/[\s\S]{1,130}(?:\s|$)|\S{1,130}/g)?.map(t=>t.trim())||[''];}
  private readback(){const p=this.setup!.proposal!;return [p.situation,`Goal: ${p.goal}`,p.constraints.length?`Constraints: ${p.constraints.join('; ')}`:'No constraints stated.',`${p.mode==='rehearsal'?'Council chamber':'Throne court'} · ${p.format} · ${p.intensity} · ${p.durationMinutes} min`,...p.rubric.map(r=>`${r.name}: ${r.description}`)].join('\n');}
  render(){
    if(!this.initialized)return;
    const view=this.view,p=this.setup?.proposal;let title='Tell me what brings you here',body='Say it, type it, or try an example.';
    if(view==='welcome'){title=`Meet ${this.workshop.guide.name}`;body='A short practice, or begin with your situation. Learn as you go.';}
    else if(view==='selection'){title='Try selecting your guide';body='Point and pinch in VR. Click the guide on desktop. You can skip any lesson.';}
    else if(view==='review'&&p){title='Have I understood?';body=this.pages(this.readback())[this.page%this.pages(this.readback()).length];}
    else if(view==='cast'&&p){const c=p.cast[this.castIndex%p.cast.length];title=this.savedPicker?'Who should take this role?':c.role;body=this.savedPicker?`Choose someone saved for “${c.role}”.`:`${c.reason}\n${this.cb.session()?.participants.filter(p=>p.active).length||0} invited · role ${this.castIndex%p.cast.length+1} of ${p.cast.length}`;}
    else if(view==='recap'&&p){title='Ready for this room?';const s=this.cb.session()!;const text=[`${s.title} · ${p.durationMinutes} minutes`,`${p.format} · ${p.intensity}`,p.goal,...s.participants.filter(p=>p.active).map(p=>`${s.characters.find(c=>c.id===p.characterId)?.name}: ${p.role} · ${p.brain?.model||'Brain needed'}`),'Approve saves a ready setup. Group discussion starts only on your action.'].join('\n');body=this.pages(text)[this.page%this.pages(text).length];}
    else if(view==='ready'){title='Your setup is ready';body='Saved with your confirmation. Ask a character directly, or return to the reviewed notes.';}
    else if(view==='context'){const c=this.setup?.context[this.contextIndex];title=c?.name||'Context review';const pages=this.pages([c?.error,c?.text].filter(Boolean).join('\n')||'No material yet.');body=`${pages[this.page%pages.length]}\n${this.page%pages.length+1} / ${pages.length}`;}
    else if(view==='notes'){const notes=this.cb.session()?.guidance?.notes||[];const pages=notes.flatMap(n=>this.pages(`${n.source==='user'?'Your words':'Guide interpretation'} · ${n.status}\n${n.text}`));title='What I have noted';body=pages.length?pages[this.page%pages.length]:'No notes saved yet.';}
    else if(view==='context-menu'){title='Add supporting context';body='Paste up to 12,000 characters, or choose a text/PDF file under 2 MB. Review the extracted excerpt before it is shared.';}
    else if(view==='help'){title='Learn one interaction';body='Core selection, input and interruption fit into your first session. Brain inspection is optional; scoring and presenters follow when those features arrive.';}
    const choices=view==='context-menu'?[{label:'Paste text',action:'paste'},{label:'Back',action:'back'}]:this.choices;
    this.displayCaption=body;
    this.element.hidden=!this.active||this.workshop.isOpen||document.body.classList.contains('details-open');
    this.element.innerHTML=`<span class="eyebrow">${this.lesson?'GUIDED PRACTICE':'WITH YOUR GUIDE'}</span><h2>${esc(title)}</h2><p class="guide-step-text">${esc(body)}</p>${this.message?`<p class="guide-feedback" role="alert">${esc(this.message)}</p>`:''}<div class="guide-choices">${choices.map(c=>`<button class="${choices[0]===c?'primary-button':'text-button'}" data-guide="${esc(c.action)}">${esc(c.label)}</button>`).join('')}</div>${view==='context-menu'?'<label class="outline-button context-upload">Choose file<input id="context-file" type="file" accept=".txt,.pdf,text/plain,application/pdf"></label>':''}<div class="guide-receipt" role="status">${esc(this.receipt)}</div><div class="guide-tools"><button data-guide="notes">Notes</button><button data-guide="help">Help</button><button data-guide="free">Ask freely</button>${this.lesson?'<button data-guide="skip">Skip lesson</button>':''}</div>`;
    document.body.dataset.guideView=this.active?view:'free';document.body.dataset.guidedSetup=String(this.active);
    document.body.dataset.guideDemo=String(this.demoActive);
  }
  async boot(){this.initialized=true;this.temporaryView='';this.render();}
  resume(){this.pause();const scope=this.cb.profile()+'/'+(this.cb.session()?.id||'');if(scope!==this.scope){this.pending=null;this.pendingLesson=null;this.pendingRoster=null;this.joinDraft=null;this.retryAction=null;this.receipt='';this.scope=scope;}this.active=true;this.temporaryView='';this.page=0;this.message='';this.render();}
  pause(){this.generation++;this.workId++;this.controller?.abort();this.controller=null;this.proposalRequest=null;this.busy=false;this.demoActive=false;this.ai.stop();this.render();}
  private async run(work:()=>Promise<void>){if(this.busy)return;const id=++this.workId;this.busy=true;this.message='';this.render();try{await work();if(id===this.workId)this.retryAction=null;}catch(e){if(id===this.workId&&(e as Error).name!=='AbortError'){this.message=e instanceof Error?e.message:'That action did not finish.';this.retryAction=work;if(this.pending)this.receipt='Save not confirmed · retry';this.ai.say(this.message,'Error');}}finally{if(id===this.workId){this.busy=false;this.render();this.cb.changed();}}}
  private async runSteps(steps:(()=>Promise<void>)[]){let step=0;await this.run(async()=>{while(step<steps.length){await steps[step]();step++;}});}
  private async mutate(operation:string,payload:object={}){
    const generation=this.generation;
    const session=await this.cb.ensureSession();if(!session)throw new Error('Your situation has not been saved. Retry keeps your input.');
    if(generation!==this.generation)throw new DOMException('Guide paused','AbortError');
    const profile=this.cb.profile(),signature=JSON.stringify({id:session.id,operation,payload});
    if(this.pending&&this.pending.signature!==signature)throw new Error('Retry the waiting save before making another change.');
    this.pending||={signature,sessionId:session.id,body:{action:'guidance',requestId:crypto.randomUUID(),expectedRevision:session.revision,operation,payload}};
    this.receipt='Saving…';this.render();
    const result=await this.ai.request<{session:Session}>(`/api/sessions/${session.id}?profileId=${profile}`,this.pending.body,undefined,'PATCH');
    if(profile!==this.cb.profile()||session.id!==this.cb.session()?.id)throw new Error('The active situation changed.');
    this.cb.sessionChanged(validateSession(result.session));this.pending=null;this.receipt='Saved';
    if(generation!==this.generation)throw new DOMException('Guide paused','AbortError');
  }
  private async lessonChange(lesson:LessonId,status:'active'|'completed'|'skipped',evidence?:string){
    const profile=this.cb.profile(),library=this.workshop.library;if(!library)return;
    const generation=this.generation,signature=JSON.stringify({profile,lesson,status,evidence});
    if(this.pendingLesson&&this.pendingLesson.signature!==signature)throw new Error('Retry the waiting lesson save first.');
    this.pendingLesson||={signature,body:{requestId:crypto.randomUUID(),expectedRevision:library.revision,lesson,status,...(evidence?{evidence}:{})}};
    const result=await this.ai.request<{library:any}>(`/api/guidance/progress?profileId=${profile}`,this.pendingLesson.body);
    if(profile===this.cb.profile())this.workshop.library=validateLibrary(result.library);this.pendingLesson=null;
    if(generation!==this.generation||profile!==this.cb.profile())throw new DOMException('Guide paused','AbortError');
  }
  async selectedGuide(){if(this.lesson!=='selection')return false;await this.runSteps([()=>this.lessonChange('selection','completed','selected-guide'),()=>this.lessonChange('input','active'),async()=>{this.temporaryView='capture';await this.ai.narrate('Good. Now tell me the situation you want to explore. A sentence is enough.',this.workshop.guide);}]);return true;}
  async observedBrain(){if(this.lesson==='brains')await this.run(()=>this.lessonChange('brains','completed','opened-brain'));}
  async interrupted(){const demo=this.demoActive;this.pause();if(demo)await this.run(async()=>{await this.lessonChange('interruption','completed','interrupted');this.receipt='Pause practice saved';this.ai.say('You paused the guide. Selecting a participant gives them the floor.');});}
  async gaveFloor(){if(this.lesson==='interruption')await this.run(async()=>{await this.lessonChange('interruption','completed','gave-floor');});}
  async observedInterruption(){if(this.lesson==='interruption')await this.run(()=>this.lessonChange('interruption','completed','interrupted'));}
  async receive(text:string){
    if(!this.active)return false;
    const input=text.trim();
    if(/^(?:what (?:have you|did you) (?:note|noted)|show (?:my |your )?notes)[?.!]?$/i.test(input)){await this.handle('notes');return true;}
    if(/^(?:help|explain (?:more )?simply|slower)[?.!]?$/i.test(input)){await this.handle('simple');return true;}
    if(/^(?:repeat (?:the )?(?:intro|lesson|tour)|restart (?:the )?(?:intro|tour))[?.!]?$/i.test(input)){await this.handle('practice');return true;}
    if(this.temporaryView==='paste'){await this.run(async()=>{await this.mutate('context',{item:{id:crypto.randomUUID(),name:'Pasted context',status:'pending',text:input.slice(0,12000),error:''}});this.contextIndex=this.setup!.context.length-1;this.temporaryView='context';this.page=0;});return true;}
    // Once a setup is approved, ordinary questions return to the selected character.
    if(this.view==='ready')return false;
    this.proposalRequest=null;let captured=false;
    await this.run(async()=>{if(!captured){await this.mutate('capture',{text:input});captured=true;}this.temporaryView='';await this.propose();});return true;
  }
  private async propose(){
    const session=await this.cb.ensureSession();if(!session)throw new Error('Save the situation first.');
    let guide=this.workshop.guide;
    if(!guide.brain||!guide.voice){const brain=guide.brain||this.ai.defaultBrain;if(!brain)throw new Error('Your words are saved. Connect a brain, or use Details while offline.');await this.ai.assign(guide.id,brain,this.ai.voiceFor(guide));guide=this.workshop.guide;}
    const s=this.cb.session()!,profile=this.cb.profile(),generation=this.generation;
    this.controller=new AbortController();this.proposalRequest||={sessionId:s.id,body:{sessionId:s.id,requestId:crypto.randomUUID(),expectedRevision:s.revision}};
    this.ai.say('Your words are saved. Preparing a short readback…','Thinking');
    const result=await this.ai.request<{session:Session}>(`/api/ai/setup?profileId=${profile}`,this.proposalRequest.body,this.controller.signal);
    if(generation!==this.generation||profile!==this.cb.profile()||s.id!==this.cb.session()?.id)return;
    this.cb.sessionChanged(validateSession(result.session));this.proposalRequest=null;this.temporaryView='';this.page=0;this.receipt='Readback saved · awaiting your confirmation';await this.ai.narrate(this.readback().slice(0,2500),this.workshop.guide);
  }
  private async upload(file:File){
    const profile=this.cb.profile(),generation=this.generation;let item:SetupContext|null=null;
    await this.run(async()=>{
      if(file.size>2_000_000)throw new Error('Choose a file under 2 MB.');this.receipt='Extracting text…';this.render();
      if(!item){const bytes=new Uint8Array(await file.arrayBuffer());let raw='';for(let i=0;i<bytes.length;i+=0x8000)raw+=String.fromCharCode(...bytes.subarray(i,i+0x8000));
        const result=await this.ai.request<{item:SetupContext}>(`/api/context/extract?profileId=${profile}`,{name:file.name,mime:file.name.toLowerCase().endsWith('.pdf')?'application/pdf':'text/plain',data:btoa(raw)});item=result.item;}
      if(profile!==this.cb.profile()||generation!==this.generation)throw new DOMException('Guide paused','AbortError');
      await this.mutate('context',{item});this.contextIndex=this.setup!.context.length-1;this.temporaryView='context';this.page=0;
    });
  }
  private async invite(characterId?:string){
    const profile=this.cb.profile(),generation=this.generation,sessionId=this.cb.session()?.id;
    const guard=()=>{if(profile!==this.cb.profile()||generation!==this.generation||sessionId!==this.cb.session()?.id)throw new DOMException('Guide paused','AbortError');};
    const p=this.setup?.proposal;if(!p)throw new Error('Prepare the situation first.');const role=p.cast[this.castIndex%p.cast.length];
    let character=this.workshop.library?.characters.find(c=>c.id===characterId);
    if(!character){
      if(!this.joinDraft||this.joinDraft.role!==role.role){const base=generateCharacter(this.cb.profile());Object.assign(base,{name:role.name,personality:role.personality,code:role.code,brain:this.workshop.guide.brain||this.ai.defaultBrain});base.voice=this.ai.voiceFor(base);this.joinDraft={role:role.role,character:base,requestId:crypto.randomUUID(),rosterId:crypto.randomUUID()};}
      const draft=this.joinDraft,library=this.workshop.library!;
      const result=await this.ai.request<{library:any}>(`/api/characters?profileId=${this.cb.profile()}`,{requestId:draft.requestId,expectedRevision:library.revision,action:'create',id:draft.character.id,character:fieldsFor(draft.character),assignment:{brain:draft.character.brain,voice:draft.character.voice}});
      guard();this.workshop.library=validateLibrary(result.library);character=this.workshop.library.characters.find(c=>c.id===draft.character.id)!;
    }
    const s=this.cb.session()!;const already=s.participants.some(p=>p.active&&p.characterId===character!.id&&p.role===role.role);const entries=s.participants.filter(p=>p.active&&p.characterId!==character!.id).map(p=>({characterId:p.characterId,role:p.role,code:p.code}));
    if(entries.length>=5)throw new Error('The room holds five participants. Remove someone in Characters first.');
    entries.push({characterId:character.id,role:role.role,code:character.code});
    if(!already){this.pendingRoster||={sessionId:s.id,characterId:character.id,body:{action:'roster',requestId:this.joinDraft?.rosterId||crypto.randomUUID(),expectedRevision:s.revision,entries}};const result=await this.ai.request<{session:Session}>(`/api/sessions/${s.id}?profileId=${profile}`,this.pendingRoster.body,undefined,'PATCH');guard();this.cb.sessionChanged(validateSession(result.session));this.pendingRoster=null;}
    if(!character.brain||!character.voice){const brain=character.brain||this.ai.defaultBrain;if(!brain)throw new Error('Invite saved. Select a connected brain in Characters.');await this.ai.assign(character.id,brain,this.ai.voiceFor(character));}
    this.joinDraft=null;this.savedPicker=false;this.receipt=`${character.name} joined · saved`;this.castIndex=(this.castIndex+1)%p.cast.length;
  }
  async handle(action:string){
    if(action==='start-discussion'){await this.cb.startDiscussion?.();return;}
    if(action==='pause'){await this.interrupted();return;}
    if(this.busy&&['notes','help','details'].includes(action))this.pause();
    if(this.busy)return;
    if(action==='details'){this.pause();this.cb.details();return;}
    if(action==='free'){this.pause();this.active=false;this.render();this.ai.say('Ask the selected character a direct question. Choose Guided setup to return.');return;}
    if(action==='retry'){const retry=this.retryAction;if(retry)await this.run(retry);return;}
    if(action==='confirm'){await this.runSteps([()=>this.mutate('confirm-notes'),()=>this.lessonChange('input','completed','confirmed-notes'),async()=>{this.temporaryView='';this.castIndex=0;}]);return;}
    if(action==='practice'){this.active=true;await this.runSteps([()=>this.lessonChange('welcome','completed','continue'),()=>this.lessonChange('selection','active'),async()=>{this.temporaryView='';await this.ai.narrate('Point at me and pinch to select. On desktop, click me or Meet Virus. Try it now, or skip this lesson.',this.workshop.guide);}]);return;}
    if(action==='direct'){await this.runSteps([()=>this.lessonChange('welcome','skipped'),()=>this.lessonChange('selection','skipped'),async()=>{this.temporaryView='capture';this.ai.say('Tell me what you want to explore or practise. I’ll read it back before anything starts.');}]);return;}
    if(action==='review-context'){const c=this.setup?.context[this.contextIndex];if(!c)return;await this.runSteps([()=>this.mutate('review-context',{id:c.id}),async()=>{this.temporaryView='';if(this.cb.session()?.guidance?.notes.some(n=>n.source==='user'))await this.propose();else this.ai.say('Your excerpt is reviewed and saved. Tell me what you want to explore with it.');}]);return;}
    await this.run(async()=>{
      if(action==='skip'){const lesson=this.lesson;if(lesson)await this.lessonChange(lesson,'skipped');this.temporaryView='';}
      else if(action==='correct'){this.temporaryView='capture';this.ai.say('Tell me what to correct. Your original words stay in the notes.');}
      else if(action==='propose')await this.propose();
      else if(action==='invite')await this.invite();
      else if(action.startsWith('reuse:'))await this.invite(action.slice(6));
      else if(action==='saved'){this.savedPicker=true;this.page=0;}
      else if(action==='next-role'){this.castIndex++;this.page=0;}
      else if(action==='recap'){this.temporaryView='recap';this.page=0;}
      else if(action==='approve'){await this.mutate('approve');this.temporaryView='';this.ai.say('Your setup is approved and saved. You can ask a character directly. Choose Start discussion when you are ready.');}
      else if(action==='demo'){await this.lessonChange('interruption','active');this.demoActive=true;await this.ai.narrate('This is a guide practice, not a generated discussion. I’m explaining your controls. Try Interrupt or Pause guide now: it will stop my voice immediately. You can also select an invited character to give them the floor.',this.workshop.guide);}
      else if(action==='cast'){this.temporaryView='';this.savedPicker=false;}
      else if(action==='notes'){this.temporaryView='notes';this.page=0;}
      else if(action==='context-menu'){this.temporaryView='context-menu';}
      else if(action==='next-context'){this.contextIndex=(this.contextIndex+1)%Math.max(1,this.setup?.context.length||0);this.page=0;}
      else if(action==='paste'){this.temporaryView='paste';this.ai.say('Paste a short excerpt into the instruction field. You’ll review it before it is shared.');}
      else if(action==='remove-context'){const c=this.setup?.context[this.contextIndex];if(c)await this.mutate('remove-context',{id:c.id});this.temporaryView='';}
      else if(action==='next'){if(this.savedPicker){this.page=(this.page+1)%Math.max(1,Math.ceil(this.availableSaved.length/2));}else this.page++;}
      else if(action==='back'){this.temporaryView='';this.savedPicker=false;this.page=0;}
      else if(action==='example'){this.ai.say('Try “I’m defending my research proposal” or “Help me decide whether to change jobs”. Say it in your own words.');}
      else if(action==='brain-lesson'){await this.lessonChange('brains','active');this.temporaryView='';this.ai.say('Open Brain & voice, or say “open your brain”. Choose a model explicitly; your character’s identity stays the same.');}
      else if(action==='help'){this.temporaryView='help';}
      else if(action==='simple'){await this.ai.narrate(this.lesson==='selection'?'Look at me. Point your hand. Pinch thumb and finger together. Or click Meet Virus.':`Tell me one thing you want to decide or practise. I’ll show a short readback. You can correct it, then choose who joins. Nothing starts automatically. Say “show notes” to inspect what is saved.`,this.workshop.guide);}
    });
  }
}
