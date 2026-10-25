import './court.css';
import { CourtScene } from './scene';
import { PreviewConnection } from './preview';
import { COURT, type CourtRole } from './characters';
import { CourtVoice, CourtMicrophone } from './voice';
import { ConnectionPanel, type ConnectionState as AssistantConnection } from './connections';
import { BRAINS, brainIds, brainCommand, isBrain, type BrainProvider } from './brains';
import { OnboardingManager } from './onboarding';
import { navigationIntent, addressedRole as roleFromSpeech } from './court-intents';

const icons: Record<string,string> = {
  crown:'<path d="m3 6 5 4 4-7 4 7 5-4-2 13H5L3 6Z"/><path d="M7 22h10"/>',
  mic:'<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8"/>',
  arrow:'<path d="M5 12h14m-5-5 5 5-5 5"/>',
  headset:'<path d="M4 6h16l2 11-5 1-5-4-5 4-5-1L4 6Z"/><path d="M7 10h2m6 0h2"/>',
  sound:'<path d="M4 9h4l5-4v14l-5-4H4V9Zm12-1a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  close:'<path d="m6 6 12 12M6 18 18 6"/>',
  settings:'<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="8" cy="18" r="2"/>',
  reload:'<path d="M20 8a8 8 0 1 0 0 8M20 3v5h-5"/>',
};
const icon = (name:string,size=20) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]||icons.arrow}</svg>`;
const esc = (text:string) => text.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const roles: CourtRole[] = ['builder','architect','inspector','virus','artiste'];
document.querySelector('#app')!.innerHTML = `
<main class="court" aria-label="Game of Codes royal court">
 <canvas id="world" tabindex="0" aria-label="Your court and guide"></canvas><div class="vignette"></div>
 <header class="court-header"><a class="brand" href="/"><img src="/logo.png" alt="Game of Codes" class="brand-logo"></a><div class="header-actions"><button id="quiet" class="icon-button" aria-label="Mute character voices">${icon('sound')}</button><button id="settings" class="icon-button" aria-label="Court settings">${icon('settings')}</button></div></header>
 <div class="court-intro"><span class="eyebrow">THE SEAT IS YOURS</span><h1>A court at your command.</h1><p>Speak your idea. Let your team bring it to life.</p></div>
 <button id="review-work" class="review-button" hidden>Review starter ${icon('arrow',16)}</button><button id="return-court" class="back-button" hidden>← Return to your court</button>
 <div class="preview-tools" hidden><button id="reload" class="icon-button" aria-label="Reload application">${icon('reload')}</button><button id="resize-board" class="icon-button" aria-label="Resize review surface">↔</button><button id="recenter" class="icon-button" aria-label="Recenter view">⊙</button></div>
 <section class="conversation" aria-label="Talk to your court"><div class="role-picker" aria-label="Choose whom to address">${roles.map(role=>`<button ${role==='virus'?'':'hidden'} data-role="${role}" aria-pressed="${role==='virus'}" class="role-button ${role==='virus'?'selected':''}" style="--role:${COURT[role].color}"><i></i><span class="role-name">${COURT[role].name}</span><span class="role-title">${COURT[role].title.replace('Your ','')}</span></button>`).join('')}</div>
 <div class="dialogue-card" role="status" aria-live="polite"><div class="dialogue-meta"><span id="speaker-name">VIRUS · YOUR GUIDE</span><span id="speech-state">Ready when you are</span></div><p id="caption">Welcome to Game of Codes. Start with Virus, your guide.</p><button id="begin-conversation" class="begin-button">Meet your court ${icon('sound',16)}</button><button id="repeat" class="repeat-button" aria-label="Hear the character again" hidden>${icon('sound',16)}</button></div>
 <div id="proposal-card" class="proposal-card" hidden><div class="eyebrow">A PLAN FOR YOUR APPROVAL</div><h2 id="proposal-title"></h2><ul id="proposal-requirements"></ul><div id="plan-milestones"></div><div class="proposal-actions"><button id="review-milestones" class="secondary-button" type="button">Review milestones</button><button id="approve-plan" class="gold-button">Approve this plan ${icon('arrow',16)}</button><button id="change-plan" class="secondary-button">Request a change</button></div></div>
 <form id="instruction-form" class="instruction-form"><button id="microphone" type="button" aria-label="Speak to the selected character">${icon('mic',21)}</button><input id="instruction" maxlength="2000" autocomplete="off" aria-label="Your instruction" placeholder="Tell Elara what you would like to create…"><button id="send-instruction" aria-label="Send instruction" type="submit">${icon('arrow',21)}</button></form>
 <div id="tour-controls" class="tour-controls" hidden><span id="tour-hint"></span><button id="tour-continue" type="button" class="secondary-button" hidden>Continue</button></div>
 <div class="conversation-footnote"><span id="input-hint">Select a character · Speak or write an instruction</span><button id="history-button">Conversation history</button></div></section>
 <div class="preview-connection" hidden><i id="connection-dot"></i><span id="connection-status">Preview is available on request</span><button id="reconnect" hidden>Reconnect</button></div>
 <button id="enter-vr" class="enter-vr">${icon('headset',21)} Enter VR <span>↗</span></button><span id="device-note" class="device-note">A seated experience · Hands welcome</span>
 <div id="garden-overlay" class="garden-overlay" hidden><p class="garden-eyebrow">YOUR COURT AWAITS</p><button id="begin-reign" class="gold-button">Enter the Game of Codes ${icon('arrow',18)}</button></div>
</main><div id="toast" role="status"></div>
<dialog id="settings-dialog" aria-labelledby="settings-title"><button class="dialog-close icon-button" data-close="settings-dialog" aria-label="Close settings">${icon('close')}</button><span class="eyebrow">YOUR COURT</span><h2 id="settings-title">Make yourself at home.</h2><label class="setting-row"><span>Character voices</span><input id="sound-toggle" type="checkbox" checked aria-label="Enable character voices"></label><button id="connect-provider" class="setting-action">Connect assistant ${icon('arrow',16)}</button><p id="provider-description">Choose Muse Code, ChatGPT through Codex, or Claude Code on this computer. Sign in with the official CLI.</p><button id="copy-link" class="setting-action">Copy Quest project link ${icon('arrow',16)}</button><button id="export-data" class="setting-action">Export starter task data ${icon('arrow',16)}</button><button id="help" class="setting-action">How to direct your court ${icon('arrow',16)}</button><div class="diagnostics"><span>WORKSPACE</span><dl><div><dt>Render rate</dt><dd id="fps">Measuring…</dd></div><div><dt>Preview input round trip</dt><dd id="latency">—</dd></div><div><dt>Project</dt><dd id="project-id"></dd></div></dl></div></dialog>
<dialog id="provider-dialog" aria-labelledby="provider-title"><button class="dialog-close icon-button" data-close="provider-dialog" aria-label="Close provider setup">${icon('close')}</button><span class="eyebrow">YOUR ACCOUNT. YOUR COURT.</span><h2 id="provider-title">Choose your assistant.</h2><p>Connect Muse Code, ChatGPT through Codex, or Claude Code installed on this computer. Complete sign-in through the official CLI. Game of Codes does not ask for an API key.</p><div id="provider-cards">Looking for local assistants…</div><p>Check connection sends a short test request using that assistant's account allowance. Conversations and approved builds use the selected assistant. The local session allows up to 30 conversation and build requests.</p><button id="provider-refresh" class="setting-action">Refresh installed assistants ${icon('reload',16)}</button><p id="provider-error" class="form-error" role="status"></p></dialog>
<dialog id="history-dialog" aria-labelledby="history-title"><button class="dialog-close icon-button" data-close="history-dialog" aria-label="Close history">${icon('close')}</button><span class="eyebrow">THE CONVERSATION SO FAR</span><h2 id="history-title">Your court remembers.</h2><div id="history-list"></div></dialog>
<dialog id="guide-dialog" aria-labelledby="guide-title"><button class="dialog-close icon-button" data-close="guide-dialog" aria-label="Close field guide">${icon('close')}</button><span class="eyebrow">YOU DIRECT. THEY CREATE.</span><h2 id="guide-title">Meet your court.</h2><p><strong>Elara, your architect</strong>, shapes your idea and proposes a plan.</p><p><strong>Bram, your builder</strong>, builds the approved application and brings it forward for review.</p><p><strong>Iris, your inspector</strong>, shows recorded checks and what still needs your attention.</p><p>Point and pinch on a character in VR, or select them on desktop. Use <strong>Speak to me</strong> or <strong>Write an instruction</strong>. Quiet stops the voice.</p><p>Choose <strong>Review our work</strong> when you want to inspect the application. Return to the court to request another change.</p><button class="gold-button" data-close="guide-dialog">Back to my court ${icon('arrow',16)}</button></dialog>
<dialog id="device-dialog" aria-labelledby="device-title"><button class="dialog-close icon-button" data-close="device-dialog" aria-label="Close headset instructions">${icon('close')}</button><span class="eyebrow">TAKE YOUR SEAT</span><h2 id="device-title">Step inside with Quest.</h2><p id="device-message"></p><p>Open the terminal's HTTPS Network URL on port 5443 in Quest Browser, on the same Wi-Fi. Enable hand tracking, then select Enter VR. The headset uses a development certificate.</p><button class="gold-button" data-close="device-dialog">Continue on desktop ${icon('arrow',16)}</button></dialog>
<dialog id="idea-dialog" aria-labelledby="idea-title"><span class="eyebrow">YOUR AMBITION</span><h2 id="idea-title">What are you here to build?</h2><p>Tell Virus your vision in one sentence. Be as bold as you like.</p><form id="idea-form"><label><input id="idea-input" maxlength="200" autocomplete="off" placeholder="A task manager for indie developers…" required></label><button class="gold-button" type="submit">This is what I am building ${icon('arrow',16)}</button></form></dialog>
<dialog id="milestones-dialog" aria-labelledby="milestones-title"><span class="eyebrow">YOUR MILESTONES</span><h2 id="milestones-title">Review your proposed milestones.</h2><p>Virus drafted these from your idea. Keep them or edit them before building.</p><form id="milestones-form"><label><span>First milestone</span><input id="ms-1" maxlength="100" autocomplete="off" placeholder="Working board with drag-and-drop" required></label><label><span>Second milestone <small>(optional)</small></span><input id="ms-2" maxlength="100" autocomplete="off" placeholder="Brand identity and logo"></label><label><span>Third milestone <small>(optional)</small></span><input id="ms-3" maxlength="100" autocomplete="off" placeholder="Ready to ship"></label><button class="gold-button" type="submit">Record my milestones ${icon('arrow',16)}</button></form></dialog>
<dialog id="code-dialog" aria-labelledby="code-title"><button class="dialog-close icon-button" data-close="code-dialog" aria-label="Close code">${icon('close')}</button><h2 id="code-title">Application code</h2><label>File <select id="code-file"><option>index.html</option><option>app.css</option><option>app.js</option></select></label><pre id="code-content" tabindex="0"></pre></dialog>`;

const $ = <T extends HTMLElement=HTMLElement>(selector:string)=>document.querySelector<T>(selector)!;
$('.role-picker').insertAdjacentHTML('beforeend','<button id="open-head" class="role-button brain-control" aria-label="Open the selected character\'s head" aria-expanded="false">&#9675; <span>Open head</span></button>');
$('.dialogue-card').insertAdjacentHTML('afterend',`<section id="brain-picker" class="brain-picker" aria-label="Choose a brain" hidden><div class="brain-picker-title"><span id="brain-owner"></span><button id="close-head" aria-label="Close head">Close head ×</button></div><div class="brain-options">${brainIds.map(id=>`<button class="brain-option" data-brain="${id}" aria-pressed="false"><img src="${BRAINS[id].logo}" alt=""><span>${BRAINS[id].name}</span><small>Needs setup</small></button>`).join('')}</div></section>`);
$('#export-data').insertAdjacentHTML('afterend',`<button id="export-source" class="setting-action" hidden>Export application source ZIP ${icon('arrow',16)}</button>`);
$('#export-source').addEventListener('click',async()=>{try{const response=await fetch(`/api/court/source?project=${project}`);if(!response.ok)throw new Error('The application source is not available yet.');const url=URL.createObjectURL(await response.blob()),anchor=document.createElement('a');anchor.href=url;anchor.download='sovereign-source.zip';anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(error){toast(error instanceof Error?error.message:'Source export did not finish.');}});
const validId=(id:string|null):id is string=>!!id&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(id);
const query=new URLSearchParams(location.search), stored=localStorage.getItem('sovereign-project');
const project=validId(query.get('project'))?query.get('project')!:validId(stored)?stored:crypto.randomUUID();
localStorage.setItem('sovereign-project',project); const pageUrl=new URL(location.href); pageUrl.searchParams.set('project',project); window.history.replaceState(null,'',pageUrl); $('#project-id').textContent=project.slice(0,8);
type Proposal={id:string;title:string;requirements:string[];status:string};
type Check={name:string;passed:boolean|null;detail?:string};
let court:CourtScene, connection:PreviewConnection|undefined;
let selected:CourtRole='virus', speakingRole:CourtRole='virus', configured=false, begun=false, busy=false, previewOpen=false, textFocused=false;
let proposal:Proposal|null=null, checks:Check[]=[], history:{speaker:string;text:string}[]=[];
let lastReply=COURT.virus.greeting, toastTimer=0;
let assistantState:AssistantConnection|undefined, openedHead:CourtRole|null=null;
let assignedBrains:Record<string,string>={}, brains:Record<CourtRole,BrainProvider>={architect:'gemini',builder:'gemini',inspector:'gemini',virus:'gemini',artiste:'nanoBanana'};
let onboarding:OnboardingManager|null=null, charter:{idea:string;milestones:{id:string;title:string;achieved:string|null}[]}|null=null;
const introduced = new Set<CourtRole>(['virus']);
let hasArtifact = false, onboarded = false;
let operation=0;
let handlingTranscript=false;
let queuedNavigation: NonNullable<ReturnType<typeof navigationIntent>> | null=null;
function finishOperation(turn:number){if(turn!==operation)return;busy=false;$('#send-instruction').removeAttribute('disabled');if(!document.querySelector('dialog[open]')&&document.body.dataset.settingsOpen!=='true'&&!openedHead&&!microphone.recording)onboarding?.resume();if(queuedNavigation){const next=queuedNavigation;queuedNavigation=null;queueMicrotask(()=>void navigate(next));}}
let sourceFiles: Record<string,string> = {};
function revealRole(role:CourtRole){
  introduced.add(role);court?.setCharacterVisible(role,true);
  const button=document.querySelector<HTMLButtonElement>(`[data-role="${role}"]`);if(button)button.hidden=false;
}
function availableProvider(id:string){const provider=assistantState?.providers?.find(p=>p.id===id);return !!provider?.installed&&!['disabled','error','not-installed'].includes(provider.state);}
function updateAssistant(data:AssistantConnection){
  assistantState=data;if(data.brains)assignedBrains=data.brains;
  for(const role of roles){if(role==='artiste')continue;const id=assignedBrains[role]||data.selectedProvider;brains[role]=isBrain(id)?id:'gemini';court?.setBrain(role,brains[role]);}
  const current=data.providers?.find(provider=>provider.id===brains[selected]);configured=selected==='artiste'?true:current?availableProvider(current.id):!!data.configured;
  court?.setAvailableBrains(data.providers.filter(p=>availableProvider(p.id)).map(p=>p.id).filter(isBrain));
  renderBrains();
}
function renderBrains(){
  $('#brain-picker').hidden=!openedHead;$('#open-head').setAttribute('aria-expanded',String(!!openedHead));
  $('#open-head').setAttribute('aria-label',`${openedHead?'Close':'Open'} ${COURT[selected].name}'s head`);$('#open-head span').textContent=openedHead?'Close head':'Open head';
  $('#brain-owner').textContent=`${COURT[openedHead||selected].name}'s brain`;
  document.querySelectorAll<HTMLButtonElement>('[data-brain]').forEach(button=>{
    const id=button.dataset.brain!,provider=assistantState?.providers?.find(item=>item.id===id);
    button.setAttribute('aria-pressed',String(brains[openedHead||selected]===id));
    button.querySelector('small')!.textContent=availableProvider(id)?provider?.state==='connected'?'Connected':'Ready':provider?.message||'Unavailable';
    button.disabled=busy||!availableProvider(id);button.title=provider?.message||'Provider unavailable';
  });
}
function openBrain(role:CourtRole,open=true){
  if(busy||!introduced.has(role))return;if(onboarding?.running&&document.body.dataset.tourStage!=='brain'){if(open)onboarding.pause();else onboarding.resume();}selectCharacter(role,false);openedHead=open?role:null;court.openHead(openedHead);renderBrains();
  begun=true;$('#begin-conversation').hidden=true;$('#repeat').hidden=false;
  if(open)void speak(role,"Of course. Choose a brain, or tell me which one you'd like.");else void speak(role,"All closed up. What would you like to do next?");
}
async function swapBrain(role:CourtRole,provider:BrainProvider){
  if(busy||!introduced.has(role))return;if(!availableProvider(provider)){const message=assistantState?.providers.find(p=>p.id===provider)?.message||'That brain is unavailable. Choose an enabled provider.';toast(message);updateCaption(role,message,'Brain unavailable');if(court.renderer.xr.isPresenting)await voice.speak(role,message);return;}microphone.cancel();voice.stop();const turn=++operation;busy=true;renderBrains();
  try{const result=await api('brain',{project,role,provider});updateAssistant(result);const available=result.providers?.find((item:{id:string})=>item.id===provider);busy=false;await speak(role,available?.state==='connected'?`${BRAINS[provider].name} is now my brain. I'm ready for your next instruction.`:`${BRAINS[provider].name} is now assigned to me. ${available?.installed?'Its account sign-in still needs checking.':'It needs to be installed and signed in on your computer before I can use it.'}`);onboarding?.handleAction('brain-swapped');}
  catch(error){busy=false;updateCaption(role,error instanceof Error?error.message:'I could not change my brain. Please try again.','Brain unchanged');}
  finally{finishOperation(turn);renderBrains();}
}
const connectionPanel=new ConnectionPanel(updateAssistant);
function toast(message:string){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=window.setTimeout(()=>$('#toast').classList.remove('visible'),5500);}
function showDialog(id:string){onboarding?.pause();const dialog=$<HTMLDialogElement>(`#${id}`);if(!dialog.open)dialog.showModal();}
function closeDialogs(){document.querySelectorAll<HTMLDialogElement>('dialog[open]').forEach(dialog=>dialog.close());}
function updateCaption(role:CourtRole,text:string,state='Your court is listening'){speakingRole=role;lastReply=text;$('#speaker-name').textContent=`${COURT[role].name.toUpperCase()} · ${COURT[role].title.toUpperCase()}`;$('#speaker-name').style.color=COURT[role].color;$('#caption').textContent=text;$('#speech-state').textContent=state;court?.dialogue.update(role,text,state);}
const voice=new CourtVoice({state:speaking=>{for(const role of roles)court?.setCharacterState(role,busy&&role===selected?'thinking':role===speakingRole&&speaking?'speaking':'idle');$('#speech-state').textContent=speaking?`${COURT[speakingRole].name} is speaking`:busy?'Considering your instruction':'Your turn';document.body.classList.toggle('character-speaking',speaking);},amplitude:level=>court?.setSpeechAmplitude(speakingRole,level),error:toast});
const microphone=new CourtMicrophone({state:active=>{if(active)onboarding?.pause();else setTimeout(()=>{if(!handlingTranscript&&!microphone.recording&&!document.querySelector('dialog[open]')&&document.body.dataset.settingsOpen!=='true')onboarding?.resume();},0);$('#microphone').classList.toggle('recording',active);$('#microphone').setAttribute('aria-pressed',String(active));$('#input-hint').textContent=active?'Listening · Select the microphone again when you finish':'Select a character · Speak or write an instruction';court.setCharacterState(selected,active?'listening':'idle');if(active)court.dialogue.update(selected,"I'm listening. Tell me what you would like to create.",'Microphone is on');},transcript:text=>{handlingTranscript=true;$<HTMLInputElement>('#instruction').value=text;void sendInstruction(text).finally(()=>{handlingTranscript=false;if(!document.querySelector('dialog[open]')&&document.body.dataset.settingsOpen!=='true')onboarding?.resume();});},error:message=>{toast(message);updateCaption(selected,message,'You can write instead');}});
async function speak(role:CourtRole,text:string){updateCaption(role,text);await voice.speak(role,text);}
function selectCharacter(role:CourtRole,greet=true){
  if(!introduced.has(role))return;
  microphone.cancel();voice.stop();selected=role;court.selectCharacter(role);
  if(openedHead&&openedHead!==role){openedHead=null;court.openHead(null);}
  if(assistantState)updateAssistant(assistantState);else renderBrains();
  document.querySelectorAll<HTMLButtonElement>('[data-role]').forEach(button=>{const active=button.dataset.role===role;button.classList.toggle('selected',active);button.setAttribute('aria-pressed',String(active));});
  $<HTMLInputElement>('#instruction').placeholder=role==='artiste'?`Tell Mira what to create — a logo, icon, or illustration…`:role==='virus'?`Ask Virus for advice or guidance…`:`Tell ${COURT[role].name} what you would like to create…`;
  if(greet){begun=true;$('#begin-conversation').hidden=true;$('#repeat').hidden=false;void speak(role,role==='inspector'&&checks.length?checks.map(check=>`${check.name}: ${check.passed===null?'needs your review':check.passed?'passed':'failed'}.`).join(' '):COURT[role].greeting);}
}
async function begin(){if(onboarding?.running)return;if(onboarding||!begun){await startGuide(onboarded);return;}begun=true;$('#begin-conversation').hidden=true;$('#repeat').hidden=false;await voice.unlock();await speak(selected,COURT[selected].greeting);}
function renderProposal(){const pending=proposal?.status==='awaiting-approval'&&(!onboarding?.running||document.body.dataset.tourStage==='ready');$('#proposal-card').hidden=!pending;if(proposal){$('#proposal-title').textContent=proposal.title;$('#proposal-requirements').innerHTML=proposal.requirements.map(item=>`<li>${esc(item)}</li>`).join('');}$('#plan-milestones').innerHTML=charter?`<p class="eyebrow">SUGGESTED MILESTONES</p><ul>${charter.milestones.map(m=>`<li>${esc(m.title)}</li>`).join('')}</ul>`:'';court.dialogue.showProposal(pending?proposal!.requirements:[]);}
async function api(path:string,data:unknown){const response=await fetch(`/api/court/${path}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});const result=await response.json();if(!response.ok)throw new Error(result.error||'The court could not complete that action.');return result;}
async function sendInstruction(message=$<HTMLInputElement>('#instruction').value){
  message=message.trim();if(!message)return;if(busy&&!navigationIntent(message)){toast('Your court is working. You can still ask to navigate or open settings.');return;}
  microphone.cancel();begun=true;$('#begin-conversation').hidden=true;$('#repeat').hidden=false;
  court.dialogue.showComposer(false);
  const intent=navigationIntent(message);
  if(intent){$<HTMLInputElement>('#instruction').value='';await navigate(intent);return;}
  const command=brainCommand(message,openedHead||selected,!!openedHead);
  if(command){
    $<HTMLInputElement>('#instruction').value='';
    if(command.provider){if(!openedHead)openBrain(command.role,true);await swapBrain(command.role,command.provider);}
    else openBrain(command.role,command.open);
    return;
  }
  if(onboarding?.handleInput(message)){$<HTMLInputElement>('#instruction').value='';return;}
  onboarding?.pause();voice.stop();
  const addressed=roleFromSpeech(message);if(addressed&&introduced.has(addressed))selectCharacter(addressed,false);
  if(selected==='virus'&&!onboarding?.running&&!proposal&&!hasArtifact){try{const result=await planFromIdea(message);await speak('virus',result.speech);await court.guideToCourt();}catch(error){toast(String(error));}return;}
  if(!configured){
    const text=assistantState?.mode==='cloud'?"My assigned brain is unavailable. Open my head and choose an enabled provider.":"My local assistant needs setup. Open Connect assistant on your desktop workspace to check installation and sign-in.";
    updateCaption(selected,text,'Assistant connection needed');
    if(court.renderer.xr.isPresenting)void voice.speak(selected,text);else showDialog('provider-dialog');
    return;
  }
  const addressedRole=selected;
  const turn=++operation;busy=true;$('#send-instruction').setAttribute('disabled','');court.setCharacterState(addressedRole,'thinking');updateCaption(addressedRole,"I'm considering your instruction…",'Thinking');history.push({speaker:'user',text:message});$<HTMLInputElement>('#instruction').value='';
  // Mira: generate image asset instead of conversing
  if(addressedRole==='artiste'){
    try{const result=await api('generate-asset',{project,prompt:message});history.push({speaker:'artiste',text:result.speech});busy=false;if(result.imageDataUrl)court.setMiraCanvas(result.imageDataUrl);await speak('artiste',result.speech);}
    catch(error){busy=false;court.setCharacterState('artiste','idle');updateCaption('artiste',error instanceof Error?error.message:'I could not create that. Please try again.','Creation did not finish');}
    finally{finishOperation(turn);}
    return;
  }
  try{const result=await api('converse',{project,role:addressedRole,message,requestId:crypto.randomUUID()});history.push({speaker:result.role,text:result.speech});if(result.proposal)proposal=result.proposal;renderProposal();busy=false;await speak(result.role,result.speech);}
  catch(error){busy=false;court.setCharacterState(addressedRole,'idle');updateCaption(addressedRole,error instanceof Error?error.message:'I could not finish that request. Please try again.','Request did not finish');}
  finally{finishOperation(turn);}
}
async function approvePlan(){
  if(!proposal||busy||proposal.status!=='awaiting-approval')return;
  voice.stop();selectCharacter('builder',false);const turn=++operation;busy=true;court.setCharacterState('builder','working');$('#approve-plan').setAttribute('disabled','');
  updateCaption('builder',"Your plan is approved. I'm building the application, then I'll bring it forward for you and Iris to inspect.",'Building your application');
  try{
    const result=await api('build',{project,proposalId:proposal.id,requestId:crypto.randomUUID()});
    checks=result.checks;hasArtifact=true;$('#review-work').hidden=false;proposal.status='ready-for-review';renderProposal();$('#export-source').hidden=false;
    $('#review-work').innerHTML=`Review ${esc(result.artifact.title)} ${icon('arrow',16)}`;
    busy=false;history.push({speaker:'builder',text:result.speech});await speak('builder',result.speech);showPreview(true);
  }catch(error){busy=false;court.setCharacterState('builder','idle');updateCaption('builder',error instanceof Error?error.message:'The build did not finish. The previous version is preserved.','Build did not finish');}
  finally{finishOperation(turn);$('#approve-plan').removeAttribute('disabled');}
}
function ensurePreview(){if(connection)return;connection=new PreviewConnection(project,{frame:bitmap=>court.updateFrame(bitmap),status:(state,message)=>{$('#connection-status').textContent=message;$('#connection-dot').classList.toggle('ready',state==='ready');$('#reconnect').hidden=!['offline','error'].includes(state);court.setStatus(state);},focus:focused=>{textFocused=focused;},latency:ms=>{$('#latency').textContent=`${ms} ms`;},exported:data=>{const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const anchor=document.createElement('a');anchor.href=url;anchor.download='sovereign-task-board.json';anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}});}
function showPreview(visible:boolean){previewOpen=visible;if(visible){microphone.cancel();voice.stop();ensurePreview();}court.showPreview(visible);if(!visible)roles.forEach(role=>court.setCharacterVisible(role,introduced.has(role)));document.body.classList.toggle('is-preview',visible);$('#return-court').hidden=!visible;$('.preview-tools').hidden=!visible;$('.preview-connection').hidden=!visible;}
function action(name:string){
  if(name==='orb-pinched'){onboarding?.handleAction('orb-pinched');return;}
  if(name==='settings-close'){court.dialogue.showSettings(false);document.body.dataset.settingsOpen='false';onboarding?.resume();return;}
  if(name==='restart-guide'){court.dialogue.showSettings(false);document.body.dataset.settingsOpen='false';void startGuide(false);return;}
  if(name.startsWith('code:')){court.dialogue.codeAction(name);return;}
  if(name==='tour-continue'){onboarding?.handleAction(name);return;}
  if(name.startsWith('brain-open:')){court.dialogue.showSettings(false);document.body.dataset.settingsOpen='false';const role=name.split(':')[1] as CourtRole;openBrain(role,openedHead!==role);return;}
  if(name.startsWith('brain-set:')){const [,role,provider]=name.split(':');if(isBrain(provider))void swapBrain(role as CourtRole,provider);return;}
  if(name.startsWith('key:')){$<HTMLInputElement>('#instruction').value=court.dialogue.handleKey(name.slice(4));return;}if(name==='talk'){onboarding?.pause();voice.stop();void microphone.start();}if(name==='write'){if(court.renderer.xr.isPresenting)court.dialogue.showComposer(true,$<HTMLInputElement>('#instruction').value);else $('#instruction').focus();}if(name==='send')void sendInstruction();if(name==='clear'){$<HTMLInputElement>('#instruction').value='';court.dialogue.setInput('');}if(name==='close-composer')court.dialogue.showComposer(false);if(name==='approve')void approvePlan();if(name==='repeat')void speak(speakingRole,lastReply);if(name==='mute'){voice.muted=!voice.muted;voice.stop();$<HTMLInputElement>('#sound-toggle').checked=!voice.muted;$('#quiet').classList.toggle('muted',voice.muted);}if(name==='preview')showPreview(true);if(name==='court')showPreview(false);if(name==='recenter')court.recenter();if(name==='reload')connection?.send({type:'reload'});if(name==='size')court.resizeBoard();if(name==='exit')void court.exitVR();if(name==='help'){closeDialogs();showDialog('guide-dialog');}}
try{court=new CourtScene($('#world'),{click:(x,y)=>connection?.send({type:'click',x,y}),action,character:role=>selectCharacter(role),feedback:()=>{},session:active=>{document.body.classList.toggle('in-vr',active);if(!active){microphone.cancel();voice.stop();}}});roles.filter(r=>r!=='virus').forEach(r=>court.setCharacterVisible(r,false));court.showGarden(true);court.onFps=fps=>{$('#fps').textContent=`${fps} fps${court.renderer.xr.isPresenting?' · headset':' · desktop'}`;};if(query.get('view')==='preview')showPreview(true);}catch(error){toast(error instanceof Error?error.message:'The 3D court could not start.');}
async function planFromIdea(idea:string){
  const turn=++operation;busy=true;$('#send-instruction').setAttribute('disabled','');court.setCharacterState('virus','thinking');
  updateCaption('virus','I am turning your idea into milestones and a build plan.','Preparing your plan');
  try{
    const result=await api('plan-idea',{project,idea,requestId:crypto.randomUUID()});
    charter=result.charter;proposal=result.proposal;court.updateWallOfFame(charter!.milestones);renderProposal();
    history.push({speaker:'user',text:idea},{speaker:'virus',text:result.speech});return result;
  }catch(error){throw error;}
  finally{finishOperation(turn);court.setCharacterState('virus','idle');}
}
async function startGuide(returning=false,direct=false){
  onboarding?.stop();closeDialogs();showPreview(false);openedHead=null;court.openHead(null);
  begun=true;$('#begin-conversation').hidden=true;$('#garden-overlay').hidden=true;
  if(!returning&&!direct){introduced.clear();roles.forEach(role=>{court.setCharacterVisible(role,false);const b=document.querySelector<HTMLButtonElement>(`[data-role="${role}"]`);if(b)b.hidden=true;});court.showGarden(true);}
  revealRole('virus');selectCharacter('virus',false);await voice.unlock();
  onboarding=new OnboardingManager({scene:court,speak,planIdea:planFromIdea,reveal:revealRole,
    stage:(stage,hint,canContinue)=>{
      court.dialogue.setTourContinue(canContinue);
      document.body.dataset.tourStage=stage;$('#tour-controls').hidden=stage==='ready';$('#tour-hint').textContent=hint;$('#tour-continue').hidden=!canContinue;
      if(stage==='brain'){openedHead='virus';renderBrains();}
      else if(openedHead==='virus'&&stage!=='planning'&&stage!=='idea'){openedHead=null;renderBrains();}
      if(stage==='idea'){$<HTMLInputElement>('#instruction').placeholder='Describe your idea and who it is for…';$('#instruction').focus();}
      if(stage==='ready'){onboarding=null;selectCharacter('architect',false);renderProposal();}
    },
    onComplete:async()=>{await api('complete-onboarding',{project});onboarded=true;renderProposal();},
    error:message=>{toast(message);$('#begin-conversation').hidden=false;$('#begin-conversation').textContent='Resume guide';},
  });
  void onboarding.start({returning,hasIdea:!!charter||!!proposal||hasArtifact,hasBuild:hasArtifact,direct});
}
async function navigate(intent:NonNullable<ReturnType<typeof navigationIntent>>){
  if(busy&&!['settings','court','meetingRoom','workspace','wallOfFame'].includes(intent)){queuedNavigation=intent;toast('I will do that as soon as the current request finishes.');return;}
  if(busy&&intent==='court'){showPreview(false);await court.guideToCourt();return;}
  if(intent==='tour'){await startGuide(false);return;}
  if(intent==='approve'){await approvePlan();return;}
  if(intent==='settings'){onboarding?.pause();voice.stop();if(court.renderer.xr.isPresenting){court.dialogue.showSettings(true);document.body.dataset.settingsOpen='true';}else showDialog('settings-dialog');return;}
  if(intent==='milestones'){
    if(!charter){toast('Tell Virus your idea first; he will suggest milestones for you.');return;}
    charter.milestones.slice(0,3).forEach((m,i)=>{$<HTMLInputElement>(`#ms-${i+1}`).value=m.title;});showDialog('milestones-dialog');return;
  }
  if(intent==='code'&&hasArtifact){
    voice.stop();showPreview(false);const response=await fetch(`/api/court/files?project=${project}`);
    if(!response.ok){toast('The source could not be loaded. Try again.');return;}
    sourceFiles=(await response.json()).files;if(court.renderer.xr.isPresenting){court.dialogue.showCode(sourceFiles);return;}$<HTMLSelectElement>('#code-file').value='index.html';$('#code-content').textContent=sourceFiles['index.html'];showDialog('code-dialog');return;
  }
  if(intent==='preview'&&hasArtifact){onboarding?.stop();onboarding=null;showPreview(true);return;}
  if(intent==='court'||intent==='code'||intent==='preview'){
    if(onboarding?.running){await startGuide(false,true);return;}
    await court.guideToCourt();showPreview(false);revealRole('virus');
    if(!onboarded){await startGuide(false,true);return;}
    roles.forEach(revealRole);selectCharacter('virus',false);
    await speak('virus',intent==='code'&&!hasArtifact?'There is no generated code yet. Approve your plan so Bram can build it, then ask me to show the code.':hasArtifact?'Here is your court. Say “show code” for the source or “review the app” for the running application.':proposal?'Here is your court and your saved plan. Approve it when you are ready to build.':'Here is your court. Tell me your idea and I will prepare the milestones and first build plan.');return;
  }
  court.focusZone(intent);toast(`Showing ${intent==='meetingRoom'?'the meeting room':intent==='workspace'?'your workspace':'the Wall of Fame'}.`);
}
fetch(`/api/court/status?project=${project}`).then(response=>response.json()).then(data=>{
  updateAssistant(data);connectionPanel.update(data);history=data.history||[];checks=data.checks||[];proposal=data.proposal;renderProposal();
  hasArtifact=!!data.artifact;onboarded=!!data.onboarded;
  if(data.artifact){$('#review-work').hidden=false;$('#review-work').innerHTML=`Review ${esc(data.artifact.title)} ${icon('arrow',16)}`;$('#export-source').hidden=false;}
  if(data.charter){charter=data.charter;court.updateWallOfFame(charter!.milestones);}
  if(onboarded){court.showGarden(false);court.moveVirusToCourt();roles.forEach(revealRole);}
  else{court.showGarden(true);roles.filter(r=>r!=='virus').forEach(r=>court.setCharacterVisible(r,false));}
  selectCharacter('virus',false);updateCaption('virus',onboarded?'Welcome back. Continue with Virus to resume your saved project.':'I am Virus, your guide. Select Enter the Game of Codes to begin.','Ready when you are');
  $('#garden-overlay').hidden=false;$('#begin-reign').textContent=onboarded?'Continue with Virus':'Enter the Game of Codes';
  $('#begin-reign').onclick=()=>void startGuide(onboarded);
  document.body.dataset.appReady='true';
}).catch(()=>toast('The conversation service is starting. Reload in a moment.'));
$('#review-milestones').addEventListener('click',()=>void navigate('milestones'));
$('#tour-continue').addEventListener('click',()=>onboarding?.handleAction('tour-continue'));
$('#code-file').addEventListener('change',()=>{$('#code-content').textContent=sourceFiles[$<HTMLSelectElement>('#code-file').value]||'';});
$<HTMLFormElement>('#milestones-form').onsubmit=async event=>{
  event.preventDefault();if(!charter)return;
  const milestones=[1,2,3].map(i=>$<HTMLInputElement>(`#ms-${i}`).value.trim()).filter(Boolean);
  try{const result=await api('charter',{project,idea:charter.idea,milestones});charter=result.charter;court.updateWallOfFame(charter!.milestones);$<HTMLDialogElement>('#milestones-dialog').close();toast('Milestones updated.');}catch(error){toast(String(error));}
};

document.querySelectorAll<HTMLButtonElement>('[data-role]').forEach(button=>button.addEventListener('click',()=>selectCharacter(button.dataset.role as CourtRole)));
$('#open-head').addEventListener('click',()=>openBrain(selected,!openedHead));
$('#close-head').addEventListener('click',()=>openBrain(selected,false));
document.querySelectorAll<HTMLButtonElement>('[data-brain]').forEach(button=>button.addEventListener('click',()=>void swapBrain(openedHead||selected,button.dataset.brain as BrainProvider)));
document.querySelectorAll<HTMLDialogElement>('dialog').forEach(dialog=>dialog.addEventListener('close',()=>{if(!document.querySelector('dialog[open]')&&document.body.dataset.settingsOpen!=='true')onboarding?.resume();}));
document.querySelectorAll<HTMLButtonElement>('[data-close]').forEach(button=>button.addEventListener('click',()=>$<HTMLDialogElement>(`#${button.dataset.close}`).close()));
$('#begin-conversation').addEventListener('click',()=>void begin());$('#repeat').addEventListener('click',()=>void speak(speakingRole,lastReply));$('#instruction-form').addEventListener('submit',event=>{event.preventDefault();void sendInstruction();});$('#microphone').addEventListener('click',()=>action('talk'));$('#quiet').addEventListener('click',()=>action('mute'));$('#review-work').addEventListener('click',()=>showPreview(true));$('#return-court').addEventListener('click',()=>showPreview(false));$('#approve-plan').addEventListener('click',()=>void approvePlan());$('#change-plan').addEventListener('click',()=>action('write'));$('#settings').addEventListener('click',()=>showDialog('settings-dialog'));
$('#sound-toggle').addEventListener('change',event=>{voice.muted=!(event.target as HTMLInputElement).checked;if(voice.muted)voice.stop();$('#quiet').classList.toggle('muted',voice.muted);});$('#connect-provider').addEventListener('click',()=>{closeDialogs();showDialog('provider-dialog');void connectionPanel.refresh();});
$('#history-button').addEventListener('click',()=>{$('#history-list').innerHTML=history.length?history.map(item=>`<div class="history-turn"><span>${item.speaker==='user'?'YOU':COURT[item.speaker as CourtRole]?.name.toUpperCase()||esc(item.speaker)}</span><p>${esc(item.text)}</p></div>`).join(''):'<p>Your next instruction starts the conversation.</p>';showDialog('history-dialog');});$('#help').addEventListener('click',()=>action('help'));
$('#copy-link').addEventListener('click',async()=>{try{const health=await fetch('/api/health').then(response=>response.json());const link=new URL(health.headsetUrls[0]);link.searchParams.set('project',project);await navigator.clipboard.writeText(link.href);toast('Your Quest project link is copied.');}catch{toast('Use the Quest HTTPS Network URL printed in the terminal.');}});$('#export-data').addEventListener('click',()=>{ensurePreview();if(!connection?.send({type:'export'}))toast('Open Review starter, then export once it is connected.');});$('#reload').addEventListener('click',()=>action('reload'));$('#resize-board').addEventListener('click',()=>action('size'));$('#recenter').addEventListener('click',()=>action('recenter'));$('#reconnect').addEventListener('click',()=>connection?.connect());
$('#enter-vr').addEventListener('click',async()=>{try{await voice.unlock();await court.enterVR();if(!begun)await begin();}catch(error){$('#device-message').textContent=error instanceof Error?error.message:'The headset session could not start.';showDialog('device-dialog');}});if(navigator.xr)navigator.xr.isSessionSupported('immersive-vr').then(supported=>{if(supported)$('#device-note').textContent='Headset ready · Point and pinch to address your team';}).catch(()=>{});
document.addEventListener('keydown',event=>{if(!previewOpen||!textFocused||document.querySelector('dialog[open]')||(event.target instanceof HTMLElement&&['INPUT','TEXTAREA'].includes(event.target.tagName))||event.ctrlKey||event.metaKey||event.altKey)return;if(event.key.length===1){event.preventDefault();connection?.send({type:'text',text:event.key});}else if(['Backspace','Enter','Escape','Tab','ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();connection?.send({type:'key',key:event.key});}});
window.addEventListener('pagehide',()=>{microphone.cancel();voice.stop();connection?.dispose();court?.dispose();});
