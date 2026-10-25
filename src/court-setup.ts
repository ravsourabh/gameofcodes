import type { ConnectionState } from './connections';
import type { CourtScene } from './scene';

export type CourtSetupData = NonNullable<ConnectionState['setup']>;
type Profile = { id:string; name:string; projects:Partial<Record<'local'|'cloud',string>> };
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));

export class CourtSetup {
  private dialog=document.createElement('dialog');
  private profiles:Profile[]=[];
  private profile!:Profile;
  private step='profile';
  private mode:'local'|'cloud'='cloud';
  private workspace='';
  private resolve:((value:CourtSetupData|null)=>void)|null=null;
  private checking=false;
  private generation=0;
  private message='';
  get active(){return !!this.resolve;}
  constructor(private cb:{state:()=>ConnectionState; project:string; scene:()=>CourtScene; speak:(text:string)=>void; api:(path:string,data:unknown)=>Promise<any>; changed:(state:ConnectionState)=>void}){
    this.dialog.id='court-setup';this.dialog.setAttribute('aria-labelledby','setup-title');document.body.append(this.dialog);
    this.dialog.addEventListener('cancel',()=>this.finish(null));
    this.dialog.addEventListener('click',event=>{const button=(event.target as HTMLElement).closest<HTMLButtonElement>('[data-setup]');if(button)void this.choose(button.dataset.setup!);});
    try{const saved=JSON.parse(localStorage.getItem('goc-profiles')||'[]');this.profiles=Array.isArray(saved)?saved.filter(p=>p&&typeof p.name==='string'&&typeof p.id==='string'&&p.projects).slice(0,12):[];}catch{}
  }
  refreshSurface(){if(this.active)this.render();}
  open():Promise<CourtSetupData|null>{
    if(this.active)return Promise.resolve(null);
    this.generation++;this.checking=false;
    this.mode=this.cb.state().mode||'local';this.workspace=this.cb.state().setup?.workspace||'';
    const existing=this.cb.state().setup;
    if(existing&&!this.profiles.some(p=>p.id===existing.profileId))this.profiles.push({id:existing.profileId,name:existing.profileName,projects:{[this.mode]:this.cb.project}});
    if(!this.profiles.length)this.profiles.push({id:crypto.randomUUID(),name:'My profile',projects:{}});
    this.profile=this.profiles.find(p=>p.id===existing?.profileId)||this.profiles[0];this.step='profile';this.message='';
    const result=new Promise<CourtSetupData|null>(resolve=>this.resolve=resolve);this.render();return result;
  }
  private finish(value:CourtSetupData|null){this.generation++;this.checking=false;this.cb.scene().dialogue.showSetup(null);this.dialog.close();const done=this.resolve;this.resolve=null;done?.(value);}
  private render(){
    if(!this.active)return;
    const state=this.cb.state(),actual=state.mode||'local';
    let title='',text='',fields='',choices:{label:string;action:string}[]=[];
    if(this.step==='profile'){
      title='Who is taking the throne?';text='Choose a profile on this browser. Each profile keeps its own project. This is not account authentication.';
      fields=`<label>Profile<select id="setup-profile">${this.profiles.map(p=>`<option value="${escape(p.id)}" ${p.id===this.profile.id?'selected':''}>${escape(p.name)}</option>`).join('')}</select></label><label>Name<input id="setup-name" maxlength="40" value="${escape(this.profile.name)}"></label>`;
      choices=[{label:'Continue',action:'profile-next'},{label:'New profile',action:'new-profile'}];
    }else if(this.step==='mode'){
      title='Where shall we work?';text=`This court is currently running in ${actual} mode.`;
      choices=[{label:'Cloud · server APIs',action:'cloud'},{label:'My computer · local accounts',action:'local'}];
    }else if(this.step==='handoff'){
      title=this.mode==='local'?'Open your computer court':'Open the cloud court';
      text=this.mode==='local'?'Start Game of Codes on your computer with npm run dev. On desktop, open its localhost address. On Quest, open the HTTPS Network URL shown in the computer’s terminal. This cloud tab cannot access your local accounts or folders.':'Cloud mode runs at gameofcodes.si using server-managed APIs.';
      fields=`<a class="setting-action" href="${this.mode==='local'?'http://localhost:5173/':'https://gameofcodes.si/'}" target="_blank" rel="noopener noreferrer">Open ${this.mode==='local'?'computer':'cloud'} court ↗</a>`;
      choices=[{label:`Stay in ${actual} mode`,action:'stay'},{label:'Choose again',action:'back-mode'}];
    }else if(this.step==='providers'){
      title='Connect your local assistants';text='Sign in through each official CLI, then check it here. One verified assistant is enough to continue; you can connect the others later.';
      const providers=state.providers.filter(p=>p.id!=='gemini');
      fields=providers.map(p=>`<article class="setup-provider"><strong>${escape(p.name)}</strong><small>${escape(p.state==='connected'?'Verified':p.message)}</small>${p.loginCommand?`<code>${escape(p.loginCommand)}</code>`:''}<button class="secondary-button" data-setup="check:${p.id}" ${!p.installed||this.checking?'disabled':''}>Check connection</button></article>`).join('');
      fields+=`<label>Workspace directory<input id="setup-workspace" placeholder="Absolute directory on this computer" value="${escape(this.workspace)}"></label><small>Approved builds export to a new .game-of-codes subdirectory. Existing files are not replaced.</small>`;
      choices=[{label:'Check workspace and continue',action:'providers-next'},{label:'Refresh installed assistants',action:'refresh'}];
    }else{
      title='What would you like to do first?';text='Explore and talk with your court, or shape an idea into a plan. Nothing is built without your approval.';
      choices=[{label:'Explore the court',action:'explore'},{label:'Plan an idea',action:'plan'},{label:'Change setup',action:'back-mode'}];
    }
    this.dialog.innerHTML=`<button data-setup="cancel" class="dialog-close icon-button" aria-label="Close setup">×</button><span class="eyebrow">VIRUS · GETTING ACQUAINTED</span><h2 id="setup-title">${escape(title)}</h2><p>${escape(text)}</p>${fields}<p id="setup-error" role="status">${escape(this.message)}</p><div class="setup-actions">${choices.map(c=>`<button class="${c===choices[0]?'gold-button':'secondary-button'}" data-setup="${c.action}" ${this.checking?'disabled':''}>${escape(c.label)}</button>`).join('')}</div>`;
    this.dialog.querySelector<HTMLSelectElement>('#setup-profile')?.addEventListener('change',event=>{this.profile=this.profiles.find(p=>p.id===(event.target as HTMLSelectElement).value)!;this.render();});
    const vr=this.cb.scene().renderer.xr.isPresenting;
    if(vr){this.dialog.close();const native=[...choices];if(this.step==='profile')native.unshift(...this.profiles.slice(0,3).map(p=>({label:p.name,action:`profile:${p.id}`})));if(this.step==='providers')native.unshift(...state.providers.filter(p=>p.installed&&p.id!=='gemini').slice(0,3).map(p=>({label:`Check ${p.name}`,action:`check:${p.id}`})),{label:'Use computer project directory',action:'use-workspace'},{label:'Enter workspace',action:'workspace'});this.cb.scene().dialogue.showSetup({title,text:this.message||text,choices:[...native,{label:'Close setup',action:'cancel'}].slice(0,8)});}
    else if(!this.dialog.open)this.dialog.showModal();
    this.cb.speak(title+' '+text);
  }
  handleInput(text:string){
    if(!this.active)return false;
    if(this.step==='providers'&&this.cb.scene().renderer.xr.isPresenting){this.workspace=text;this.message='Workspace entered. Check an assistant and continue.';this.cb.scene().dialogue.showComposer(false);this.render();return true;}
    const command=text.trim().toLowerCase();if(/cloud/.test(command))void this.choose('cloud');else if(/local|computer/.test(command))void this.choose('local');else if(/explore/.test(command))void this.choose('explore');else if(/plan/.test(command))void this.choose('plan');else if(/continue|ready/.test(command))void this.choose(this.step==='profile'?'profile-next':'providers-next');
    return true;
  }
  async choose(action:string){
    if(!this.active||this.checking&&action!=='cancel')return;
    const generation=this.generation;
    this.message='';
    try{
      if(action==='cancel'){this.finish(null);return;}
      if(action.startsWith('profile:')){this.profile=this.profiles.find(p=>p.id===action.slice(8))||this.profile;this.render();return;}
      if(action==='new-profile'){if(this.profiles.length>=12)throw new Error('You can keep up to 12 profiles on this browser.');this.profile={id:crypto.randomUUID(),name:`Profile ${this.profiles.length+1}`,projects:{}};this.profiles.push(this.profile);this.render();return;}
      if(action==='profile-next'){
        const name=this.dialog.querySelector<HTMLInputElement>('#setup-name')?.value.trim()||this.profile.name;if(!name)throw new Error('Enter a profile name.');this.profile.name=name;this.step='mode';
      }else if(action==='cloud'||action==='local'){
        if(this.step!=='mode')return;this.mode=action;
        this.step=this.mode!==this.cb.state().mode?'handoff':this.mode==='local'?'providers':'activity';
      }else if(action==='stay'){this.mode=this.cb.state().mode||'local';this.step=this.mode==='local'?'providers':'activity';}
      else if(action==='back-mode')this.step='mode';
      else if(action==='use-workspace'){this.workspace=this.cb.state().workspaceDefault||'';this.message=this.workspace?'Using '+this.workspace:'Open setup on your computer to enter a workspace.';this.render();return;}
      else if(action==='workspace'){this.cb.scene().dialogue.showSetup(null);this.cb.scene().dialogue.showComposer(true,this.workspace);return;}
      else if(action==='refresh'||action.startsWith('check:')){
        this.workspace=this.dialog.querySelector<HTMLInputElement>('#setup-workspace')?.value||this.workspace;
        this.checking=true;
        let state:ConnectionState;
        if(action==='refresh'){const response=await fetch(`/api/court/status?project=${this.cb.project}`);if(!response.ok)throw new Error('Cannot refresh assistant status.');state=await response.json();}
        else state=await this.cb.api('provider',{provider:action.slice(6),action:'check'});
        if(generation!==this.generation)return;
        this.cb.changed(state);this.checking=false;this.render();return;
      }else if(action==='providers-next'){
        this.workspace=this.dialog.querySelector<HTMLInputElement>('#setup-workspace')?.value.trim()||this.workspace;
        if(!this.workspace)throw new Error('Enter your workspace directory.');
        if(!this.cb.state().providers.some(p=>p.installed&&p.state==='connected'))throw new Error('Verify at least one assistant first.');this.step='activity';
      }else if(action==='explore'||action==='plan'){
        if(this.step!=='activity')return;
        const previous=this.profile.projects[this.mode];
        if(previous&&previous!==this.cb.project){this.saveProfiles();const url=new URL(location.href);url.searchParams.set('project',previous);location.assign(url.href);return;}
        const bound=this.cb.state().setup;
        if(bound&&bound.profileId!==this.profile.id){this.profile.projects[this.mode]=crypto.randomUUID();this.saveProfiles();const url=new URL(location.href);url.searchParams.set('project',this.profile.projects[this.mode]!);location.assign(url.href);return;}
        const result=await this.cb.api('setup',{project:this.cb.project,profileId:this.profile.id,profileName:this.profile.name,mode:this.mode,workspace:this.workspace,activity:action});
        if(generation!==this.generation)return;
        this.cb.changed({...this.cb.state(),brains:result.brains||this.cb.state().brains,setup:result.setup});this.profile.projects[this.mode]=this.cb.project;this.saveProfiles();this.finish(result.setup);return;
      }
      this.render();
    }catch(error){if(generation!==this.generation)return;this.checking=false;this.message=error instanceof Error?error.message:'Setup could not finish.';this.render();}
  }
  private saveProfiles(){localStorage.setItem('goc-profiles',JSON.stringify(this.profiles));}
}
