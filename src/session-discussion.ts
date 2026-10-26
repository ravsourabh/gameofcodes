import {validateSession,type Session,type Contribution,type Character} from '../shared/session-domain.mjs';
import {discussionTurns,nextDiscussionSpeaker,elapsedDiscussion} from '../shared/discussion-domain.mjs';
import {currentBrief,needsBrief,currentScopeTurns} from '../shared/discussion-memory.mjs';
import {SessionConversation} from './session-conversation';
type Choice={label:string;action:string};
type Callbacks={profile:()=>string;session:()=>Session|null;sessionChanged:(s:Session)=>void;changed:()=>void;beforeStart:()=>void;guide:()=>Character;castChanged?:()=>Promise<void>};
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export class SessionDiscussion {
  guideMode=false;looping=false;busy=false;message='';targetId:string|null=null;
  private token=0;private controller:AbortController|null=null;private panel=document.createElement('section');private more=false;private page=0;private pendingControl:{signature:string;body:any}|null=null;private reviewIndex=-1;
  private scope='';
  private pendingDirection:{signature:string;saved:boolean;briefRequestId:string}|null=null;
  constructor(private cb:Callbacks,private ai:SessionConversation){
    this.panel.id='discussion-panel';this.panel.setAttribute('aria-label','Live discussion');document.querySelector('.session-app')!.append(this.panel);
    this.panel.addEventListener('click',event=>{const button=(event.target as HTMLElement).closest<HTMLButtonElement>('[data-discuss]');if(button)void this.handle(button.dataset.discuss!);});
  }
  get exists(){return !!this.cb.session()?.discussion;}
  get visible(){return this.exists||this.cb.session()?.id===this.scope&&(this.busy||!!this.message);}
  get active(){return this.exists&&['running','paused'].includes(this.cb.session()!.status);}
  get ownsInput(){return this.active&&!this.guideMode;}
  get choices():Choice[]{
    const s=this.cb.session();if(!s?.discussion)return [{label:'Start discussion',action:'start'}];
    if(['stopped','completed'].includes(s.status))return [{label:'Review turns',action:'review'},{label:'Next saved turn',action:'review-next'},{label:'Read summary',action:'summary-saved'}];
    if(this.busy)return [{label:'Interrupt',action:'pause'},{label:'Wait for the saved action',action:'pause'},{label:'Finish',action:'finish'},{label:'Controls',action:'more'}];
    if(needsBrief(s)&&s.status==='paused')return [{label:'Apply saved correction',action:'apply-topic'},{label:'Invite other voices',action:'invite'},{label:'Finish',action:'finish'},{label:'Controls',action:'more'}];
    if(this.more){const pages=[[{label:'One contribution',action:'step'},{label:'Finish',action:'finish'},{label:'Ask the guide',action:'help'},{label:'More controls',action:'more'}],[{label:'Simplify',action:'simplify'},{label:'Ask for evidence',action:'evidence'},{label:'Give an example',action:'example'},{label:'More controls',action:'more'}],[{label:'Challenge',action:'challenge'},{label:'Switch sides',action:'switch-sides'},{label:'Summarise so far',action:'summary'},{label:'More controls',action:'more'}],[{label:'Review turns',action:'review'},{label:'Next saved turn',action:'review-next'},{label:'Stop',action:'stop'},{label:'Back',action:'back'}]];return pages[this.page%pages.length];}
    return [{label:this.looping?'Pause':s.discussion.awaitingUser?'Continue with assumptions':s.participants.filter(p=>p.active).length<2&&s.discussion.style!=='coaching'?'Discuss with others':'Resume discussion',action:this.looping?'pause':'resume'},{label:'One contribution',action:'step'},{label:'Finish',action:'finish'},{label:'More controls',action:'more'}];
  }
  get caption(){const s=this.cb.session(),p=s?.participants.find(p=>p.characterId===this.targetId);return this.message||p?this.message||`Next: ${s!.characters.find(c=>c.id===p!.characterId)?.name} · ${p!.role}`:s?.discussion?.reason||'Select a participant to give them the floor, or speak a direction.';}
  render(){
    const s=this.cb.session(),d=s?.discussion;document.body.dataset.hasDiscussion=String(this.visible);this.panel.hidden=!this.visible||this.guideMode||document.body.dataset.workshopOpen==='true'||document.body.classList.contains('details-open');
    if(!s)return;
    if(!d){this.panel.innerHTML=`<span class="eyebrow">YOUR DISCUSSION</span><h2>${this.busy?'Preparing the floor':'Start when you are ready'}</h2><p class="discussion-message" role="status">${esc(this.message)}</p><div class="guide-choices"><button class="primary-button" data-discuss="start" ${this.busy?'disabled':''}>Start discussion</button></div>`;return;}
    const remaining=Math.max(0,Math.ceil((s.scenario.durationMinutes*60000-elapsedDiscussion(s))/60000)),target=s.characters.find(c=>c.id===this.targetId),speaker=s.characters.find(c=>c.id===this.ai.speakerId);
    const position=s.participants.find(p=>p.characterId===(target?.id||speaker?.id))?.position,choices=this.more||['completed','stopped'].includes(s.status)?this.choices:[this.choices[0],this.choices[3]];
    this.panel.innerHTML=`<span class="eyebrow">${esc(s.scenario.format)} · ${esc(s.scenario.intensity)}</span><h2>${esc(['completed','stopped'].includes(s.status)?'Discussion saved':this.looping?'The floor is open':'Your discussion is paused')}</h2><p class="discussion-budget">${d.turnsUsed} / ${d.turnLimit} contributions · ${remaining} min left</p><p class="discussion-message" role="status">${esc(this.message)}</p>${position?`<p class="discussion-position">${esc(target?.name||speaker?.name||'')} · ${esc(position)}</p>`:''}<div class="guide-choices">${choices.map(c=>`<button class="${c===choices[0]?'primary-button':'outline-button'}" data-discuss="${c.action}">${esc(c.label==='More controls'?'Controls':c.label)}</button>`).join('')}</div>`;
    document.body.dataset.discussionState=s.status;document.body.dataset.discussionLooping=String(this.looping);
  }
  private changed(){this.render();this.cb.changed();}
  private cancelLocal(){++this.token;this.controller?.abort();this.controller=null;this.looping=false;this.ai.stop(false);this.changed();}
  private async refresh(){const s=this.cb.session(),profile=this.cb.profile();if(!s)return;const res=await fetch(`/api/sessions/${s.id}?profileId=${profile}`),data=await res.json();if(!res.ok)throw new Error(data.error||'The saved discussion could not be reloaded.');if(profile===this.cb.profile()&&s.id===this.cb.session()?.id)this.cb.sessionChanged(validateSession(data.session));}
  private async control(operation:string,fields:object={}){
    const s=this.cb.session();if(!s)throw new Error('Approve a setup first.');const profile=this.cb.profile(),signature=JSON.stringify({id:s.id,profile,operation,fields});
    if(this.pendingControl?.signature!==signature)this.pendingControl={signature,body:{requestId:crypto.randomUUID(),expectedRevision:s.revision,operation,...fields}};
    const request=this.pendingControl;
    for(let attempt=0;attempt<2;attempt++){
      if(profile!==this.cb.profile()||s.id!==this.cb.session()?.id)throw new DOMException('Session changed','AbortError');
      const response=await fetch(`/api/discussion/${s.id}/control?profileId=${profile}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request.body),signal:AbortSignal.timeout(15000)}),data=await response.json();
      if(response.status===409&&attempt===0){if(profile!==this.cb.profile()||s.id!==this.cb.session()?.id)throw new DOMException('Session changed','AbortError');await this.refresh();request.body.expectedRevision=this.cb.session()!.revision;continue;}
      if(!response.ok)throw new Error(data.error||'That discussion action did not finish.');
      if(profile!==this.cb.profile()||s.id!==this.cb.session()?.id)throw new DOMException('Session changed','AbortError');
      if(data.session.revision>=this.cb.session()!.revision)this.cb.sessionChanged(validateSession(data.session));if(this.pendingControl===request)this.pendingControl=null;return;
    }
  }
  private async inference(part:'brief'|'cast',requestId:string=crypto.randomUUID()){
    const s=this.cb.session()!,profile=this.cb.profile();this.controller=new AbortController();
    const response=await fetch(`/api/discussion/${s.id}/${part}?profileId=${profile}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId,expectedRevision:s.revision}),signal:this.controller.signal}),data=await response.json();
    if(profile!==this.cb.profile()||s.id!==this.cb.session()?.id)throw new DOMException('Session changed','AbortError');
    if(!response.ok)throw new Error(data.error||'The saved action could not finish.');this.cb.sessionChanged(validateSession(data.session));
  }
  async pause(){this.cancelLocal();if(this.cb.session()?.status==='running'&&this.active)try{await this.control('pause');this.message='Paused. Your committed turns are kept.';}catch(error){this.message=error instanceof Error?error.message:'Pause could not be saved. No more turns will be requested.';}this.changed();}
  async restore(){this.cancelLocal();this.guideMode=false;this.message='';this.more=false;this.targetId=null;this.pendingControl=null;this.pendingDirection=null;const s=this.cb.session();this.scope=s?.id||'';if(s?.discussion){if(s.status==='running')await this.pause();const last=currentScopeTurns(this.cb.session()!).at(-1);if(last)this.ai.showContribution(last);if(needsBrief(s))this.message='Your direction is saved. Apply it before continuing.';}this.changed();}
  async invite(once=false){
    if(this.busy)return;this.scope=this.cb.session()?.id||'';this.cb.beforeStart();this.guideMode=false;const pausing=this.pause(),token=this.token;this.busy=true;this.message='Inviting two complementary voices for your idea…';this.ai.say(this.message,'Thinking');this.changed();let start=false;
    try{await pausing;if(token!==this.token)return;await this.inference('cast');if(token!==this.token)return;await this.cb.castChanged?.();if(token!==this.token)return;this.message='Your other voices have joined. Opening the discussion…';start=true;}
    catch(error){if(token===this.token){await this.refresh().catch(()=>{});this.message=error instanceof Error?error.message:'Invitation paused. Retry the saved invitation.';this.ai.say(this.message,'Error');}}
    finally{this.busy=false;this.changed();}if(start&&token===this.token)await this.start(once);
  }
  async applySavedTopic(){if(this.busy)return;this.cancelLocal();const token=this.token;this.busy=true;this.message='Applying your saved direction…';this.changed();try{await this.inference('brief');if(token===this.token){this.message=`Topic saved: ${currentBrief(this.cb.session()!)?.title}. Resume when ready.`;this.ai.say(this.message);}}catch(error){if(token===this.token){await this.refresh().catch(()=>{});this.message=error instanceof Error?error.message:'Your words are saved. Retry the topic update.';this.ai.say(this.message,'Error');}}finally{this.busy=false;this.changed();}}
  async start(once=false,style?:'coaching'){
    const session=this.cb.session();if(session&&session.participants.filter(p=>p.active).length<2&&session.discussion?.style!=='coaching'&&style!=='coaching'){await this.invite(once);return;}
    if(this.busy)return;this.scope=this.cb.session()?.id||'';this.cb.beforeStart();this.guideMode=false;this.cancelLocal();const token=this.token;this.busy=true;this.message='Preparing the floor…';this.changed();
    try{if(this.exists&&needsBrief(this.cb.session()!))await this.inference('brief');if(token!==this.token)return;const group=this.cb.session()!.participants.filter(p=>p.active).length>1;await this.control(this.exists?'resume':'start',style?{style}:group&&this.cb.session()?.discussion?.style==='coaching'?{style:'group'}:{});if(token!==this.token){if(this.active)await this.control('pause');return;}this.looping=true;this.message='';this.more=false;this.changed();void this.run(token,once);}
    catch(error){this.message=error instanceof Error?error.message:'Discussion could not start.';this.ai.say(this.message,'Error');this.changed();}finally{this.busy=false;this.changed();}
  }
  private async run(token:number,once:boolean){
    try{
      while(token===this.token&&this.cb.session()?.status==='running'){
        const s=this.cb.session()!,profile=this.cb.profile(),participant=nextDiscussionSpeaker(s),character=s.characters.find(c=>c.id===participant.characterId)!;this.controller=new AbortController();
        this.ai.stop(false);this.ai.speakerId=character.id;this.ai.say(`${character.name} is considering the discussion…`,'Thinking');
        const response=await fetch(`/api/discussion/${s.id}/turn?profileId=${profile}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId:crypto.randomUUID(),expectedRevision:s.revision}),signal:this.controller.signal}),result=await response.json();
        if(token!==this.token||profile!==this.cb.profile()||s.id!==this.cb.session()?.id)return;
        if(!response.ok)throw new Error(result.error||'This contribution could not finish.');
        this.cb.sessionChanged(validateSession(result.session));const contribution=result.contribution as Contribution;await this.ai.presentContribution(contribution,this.controller.signal);
        if(token!==this.token)return;
        if(/unavailable|Repeat for audio/i.test(this.ai.phase))throw new Error('Voice playback is unavailable. The contribution is saved. Enable Quiet mode and resume for captions, or retry its voice with Repeat.');
        if(this.cb.session()?.status!=='running'){this.looping=false;this.message=this.cb.session()?.discussion?.reason||'';this.changed();return;}
        if(once){await this.pause();return;}
        if(this.ai.quiet){const until=Date.now()+Math.min(20000,Math.max(6000,contribution.text.split(/\s+/).length*320));while(token===this.token&&Date.now()<until)await new Promise(r=>setTimeout(r,80));}
      }
    }catch(error){if(token===this.token){this.cancelLocal();try{await this.refresh();if(this.cb.session()?.status==='running')await this.control('pause');}catch{}this.message=error instanceof Error?error.message:'Connection lost. Resume explicitly when ready.';this.ai.say(this.message,'Error');this.changed();}}
  }
  async intervene(action:string,text='',characterId=this.targetId){
    this.scope=this.cb.session()?.id||'';this.cb.beforeStart();this.guideMode=false;this.cancelLocal();const token=this.token,signature=JSON.stringify({id:this.cb.session()?.id,profile:this.cb.profile(),action,text,characterId});if(this.pendingDirection?.signature!==signature)this.pendingDirection={signature,saved:false,briefRequestId:crypto.randomUUID()};const pending=this.pendingDirection;this.busy=true;this.message='Saving your direction…';this.changed();
    try{if(!this.exists)await this.control('prepare');if(token!==this.token)return false;if(!pending.saved){await this.control('intervene',{action,text,characterId});pending.saved=true;}if(token!==this.token)return false;if(action==='say'){this.message='Your words are saved. Updating the working topic…';this.ai.say(this.message,'Thinking');await this.inference('brief',pending.briefRequestId);}if(token!==this.token)return false;this.message=action==='say'?`Direction saved for this discussion: ${currentBrief(this.cb.session()!)?.title}. Resume when ready.`:'Direction saved. Resume to hear the next response.';this.ai.say(this.message);this.pendingDirection=null;return true;}
    catch(error){if(token===this.token){await this.refresh().catch(()=>{});this.message=error instanceof Error?error.message:'Direction could not finish. Your saved words can be retried.';this.ai.say(this.message,'Error');}}finally{this.busy=false;this.changed();}
    return false;
  }
  async address(id:string){const s=this.cb.session();if(!s?.participants.some(p=>p.active&&p.characterId===id))return;this.targetId=id;await this.intervene('give-floor','',id);}
  async help(){await this.pause();this.ai.speakerId=this.cb.guide().id;await this.ai.narrate('Select someone to give them the floor. You can simplify an argument, ask for evidence, challenge it, switch sides or request a summary. Your direction is saved while the group is paused. Resume only when you are ready.',this.cb.guide());}
  async handle(action:string){
    if(action==='invite'){await this.invite();return;}if(action==='coach'){await this.start(false,'coaching');return;}if(action==='apply-topic'){await this.applySavedTopic();return;}
    if(['start','resume','step'].includes(action)){await this.start(action==='step');return;}
    if(action==='pause'){await this.pause();return;}
    if(action==='more'){this.page=this.more?this.page+1:0;this.more=true;this.changed();return;}
    if(action==='back'){this.more=false;this.changed();return;}
    if(action==='help'){await this.help();return;}
    if(['stop','finish'].includes(action)){this.cancelLocal();try{await this.control(action);this.message='The discussion and its partial summary are saved.';}catch(error){this.message=error instanceof Error?error.message:'The finish action could not be saved.';}this.changed();return;}
    if(action==='review'||action==='review-next'){await this.pause();const turns=discussionTurns(this.cb.session()!);if(turns.length){this.reviewIndex=action==='review'?turns.length-1:(this.reviewIndex+1)%turns.length;this.ai.showContribution(turns[this.reviewIndex]);}return;}
    if(action==='summary-saved'){const outcome=this.cb.session()?.outcomes.at(-1);if(outcome)this.ai.say(outcome.summary);return;}
    await this.intervene(action);
  }
}
