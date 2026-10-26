import './session.css';
import { SessionScene } from './session-scene';
import { CharacterWorkshop } from './character-workshop';
import { SessionConversation } from './session-conversation';
import { GuideSetup } from './guide-setup';
import {SessionDiscussion} from './session-discussion';
import {CourtOverlay,courtState} from './court-surfaces';
import {isScopeCorrection} from '../shared/discussion-memory.mjs';
import { parseInterfaceIntent, type InterfaceIntent } from '../shared/interface-intents.mjs';
import { isId, validateSession, type Session, type SessionMode, type Draft } from '../shared/session-domain.mjs';

type Profile = { id: string; name: string };
type Summary = { id: string; title: string; mode: SessionMode; status: string; revision: number; updatedAt: string };
const $ = <T extends HTMLElement = HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const escape = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
const PROFILE_KEY = 'goc-session-profiles-v1';
let profiles: Profile[] = [], selectedId = '', storageWarning = '';
try {
  const stored = JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null');
  if (stored && stored.schemaVersion !== 1) throw new Error('This browser profile uses a newer version.');
  if (stored) { profiles = stored.profiles; selectedId = stored.selectedId; }
  else {
    // Import profile labels only. Never modify legacy browser records or reuse project IDs as sessions.
    const legacy = JSON.parse(localStorage.getItem('goc-profiles') || '[]');
    profiles = Array.isArray(legacy) ? legacy.filter(item => isId(item?.id) && typeof item.name === 'string').map(item => ({ id: item.id, name: item.name.slice(0, 80) })).slice(0, 12) : [];
  }
  if (!Array.isArray(profiles) || profiles.some(item => !isId(item?.id) || typeof item.name !== 'string' || !item.name.trim())) throw new Error('The saved browser profile is invalid.');
} catch (error) { profiles = []; storageWarning = error instanceof Error ? error.message : 'Browser profiles are unavailable.'; }
if (!profiles.length) profiles = [{ id: crypto.randomUUID(), name: 'My profile' }];
if (!profiles.some(item => item.id === selectedId)) selectedId = profiles[0].id;
const persistProfiles = () => { try { if (!storageWarning) localStorage.setItem(PROFILE_KEY, JSON.stringify({ schemaVersion: 1, profiles, selectedId })); } catch { storageWarning = 'Browser storage is unavailable. Keep this tab open to retain its profile.'; } };
persistProfiles();

$('#app').innerHTML = `
<main class="session-app">
 <div class="scene-wrap"><canvas id="session-world" tabindex="0" aria-label="Court and council room. Drag or use arrow keys to look. Home returns to the throne view."></canvas><div class="scene-shade"></div><span class="court-look-hint">Drag to look around · Your seat stays still</span></div>
 <header class="app-header"><button id="brand-home" class="wordmark" aria-label="Game of Codes start screen"><img src="/crown.svg" alt=""><span>GAME OF CODES</span></button><div class="header-actions"><label class="profile-label"><span>Profile</span><select id="profile-select" aria-label="Current profile"></select></label><button id="new-profile" class="text-button">New profile</button><button id="characters-open" class="outline-button">Characters</button><button id="enter-vr" class="outline-button">Enter VR <span aria-hidden="true">↗</span></button></div></header>
 <section class="intro"><span class="eyebrow">DIFFERENT CODES. ONE DILEMMA. YOUR CALL.</span><div class="guide-presence"><span class="eyebrow">YOUR GUIDE</span><h1 id="guide-name">Virus</h1><p id="guide-caption">Your guide is here. Select Virus to meet him, or choose your room.</p><div class="guide-actions"><button id="meet-guide" class="primary-button">Meet Virus</button><button id="customise-guide" class="text-button">Customise guide</button></div></div><div class="room-caption"><i></i><span id="room-label">The throne court</span><small>Room preview</small></div></section>
 <section class="workspace" aria-label="Session setup">
  <div class="workspace-top"><span class="eyebrow">YOUR NEXT SESSION</span><span class="preview-badge">Character preview</span></div>
  <p id="service-status" role="status">Connecting to saved sessions…</p>
  <p id="legacy-notice" class="notice" hidden>This link belongs to the earlier experience. Its saved work has been kept. You can start a new session here.</p>
  <p id="profile-notice" class="notice" hidden></p>
  <div id="landing"><h2>What brings you here?</h2><div class="mode-cards"><button data-mode="discussion" class="mode-card"><span class="mode-symbol" aria-hidden="true">♜</span><span><strong>Discuss a problem</strong><small>Explore a choice from the throne court.</small></span><span aria-hidden="true">↗</span></button><button data-mode="rehearsal" class="mode-card"><span class="mode-symbol" aria-hidden="true">♧</span><span><strong>Practise a situation</strong><small>Prepare to speak before the council.</small></span><span aria-hidden="true">↗</span></button></div><details class="saved-details"><summary>Saved sessions</summary><div class="saved-heading"><h3>Your sessions</h3><button id="refresh-sessions" class="text-button">Refresh</button></div><div id="saved-sessions"></div></details></div>
  <section id="draft-summary" hidden><h2 id="summary-title"></h2><p id="summary-situation"></p><p id="cast-summary">Your guide is ready. Choose who joins the room.</p><div class="summary-actions"><button id="choose-cast" class="primary-button">Choose characters</button><button id="edit-details" class="text-button">Session details</button><button id="summary-save" class="outline-button">Save session</button><button id="summary-home" class="text-button">Back</button></div><p id="summary-save-status" role="status"></p></section>
  <form id="draft-form" hidden><div class="form-heading"><h2 id="form-title">Your court session</h2><button id="back-home" type="button" class="text-button">Back</button></div><fieldset><legend>Your room</legend><label class="mode-option"><input type="radio" name="mode" value="discussion">Throne court</label><label class="mode-option"><input type="radio" name="mode" value="rehearsal">Council chamber</label></fieldset><label class="field-label" for="session-title">Session name</label><input id="session-title" maxlength="120" required autocomplete="off"><label class="field-label" for="situation">What would you like to explore or practise?</label><textarea id="situation" maxlength="4000" rows="4" placeholder="A choice you're considering, or a conversation you want to prepare for…"></textarea><div class="save-row"><button id="save-session" class="primary-button" type="submit">Save session</button><span id="save-status" role="status">Not saved yet</span></div><div class="next-step"><span class="step-dot" aria-hidden="true"></span><p>Save your situation, then choose who joins the room. Cast-to-cast discussion arrives in a later update.</p></div><div id="session-meta" hidden></div></form>
  <div id="error-box" class="error-box" role="alert" hidden><p id="error-message"></p><button id="retry-action" class="outline-button">Try again</button><button id="reload-session" class="text-button" hidden>Reload saved version</button></div>
 </section>
 <footer><span>A seated experience · Desktop & Quest</span><span id="xr-status">Checking headset support…</span></footer>
</main>
<dialog id="profile-dialog" aria-labelledby="profile-title"><h2 id="profile-title">A new profile</h2><p>Profiles keep saved sessions separate on this browser. They are not account sign-in.</p><form id="profile-form"><label class="field-label" for="profile-name">Profile name</label><input id="profile-name" maxlength="80" required><div class="dialog-actions"><button type="button" id="cancel-profile" class="text-button">Cancel</button><button class="primary-button" type="submit">Create profile</button></div></form></dialog>`;

let saved: Session | null = null, draftMode: SessionMode = 'discussion', editing = false, dirty = false, busy = false;
let scene: SessionScene | null = null;
let workshop: CharacterWorkshop | null = null;
let conversation: SessionConversation | null = null;
let guideSetup: GuideSetup | null = null;
let discussion:SessionDiscussion|null=null;
let court: CourtOverlay|null=null;
let nativeInput: string | undefined;
let pending: { signature: string; method: 'POST' | 'PATCH'; id: string; body: Record<string, unknown> } | null = null;
let retry: () => Promise<void> = async () => refresh();
let navigation = 0;
let displayedGuideId = '';
let historyPage=0;
let historySessions:Summary[]=[];
$('#app').insertAdjacentHTML('beforeend', `<section id="conversation" aria-label="Character conversation"><div class="caption-card"><div class="caption-heading"><span id="speaker-label">Virus</span><span id="conversation-state" role="status">Ready</span><button id="caption-previous" aria-label="Previous caption">‹</button><button id="caption-next" aria-label="Next caption">›</button></div><p id="conversation-caption" role="log">I’m Virus. Tell me what brings you here.</p></div><form id="instruction-form"><button type="button" id="microphone" aria-label="Speak an instruction">◉</button><input id="instruction" aria-label="Your instruction" maxlength="2000" placeholder="Ask Virus, or describe your character…" autocomplete="off"><button id="send-instruction" aria-label="Send instruction">↑</button></form><div class="conversation-actions"><button id="interrupt">Interrupt</button><button id="repeat">Repeat</button><button id="quiet">Quiet mode</button><button id="brain-open">Brain & voice</button><small id="brain-label"></small></div></section>`);
function syncCourtClearance(){const height=$('#conversation').getBoundingClientRect().height;if(height)document.body.style.setProperty('--court-dock-clearance',`${Math.ceil(height)+28}px`);}
new ResizeObserver(syncCourtClearance).observe($('#conversation'));
document.querySelector('.header-actions')!.insertAdjacentHTML('beforeend','<button id="guided-open" class="text-button">Guided setup</button><button id="history-open" class="text-button">Saved</button><button id="settings-open" class="text-button">Settings</button>');
document.querySelector('.header-actions')!.insertAdjacentHTML('beforeend','<span id="avatar-status" role="status"></span><button id="avatar-retry" class="outline-button" hidden>Retry avatars</button>');
document.querySelector('.header-actions')!.insertAdjacentHTML('beforeend','<button id="discussion-open" class="text-button" hidden>Discussion</button>');
document.querySelector('.header-actions')!.insertAdjacentHTML('beforeend','<button id="court-tools" class="text-button" aria-expanded="false">Tools</button>');
$('#court-tools').addEventListener('click',()=>{const open=document.body.classList.toggle('court-tools-open');$('#court-tools').setAttribute('aria-expanded',String(open));});
$('#discussion-open').addEventListener('click',()=>{guideSetup?.pause();if(guideSetup)guideSetup.active=false;if(discussion)discussion.guideMode=false;document.body.classList.remove('details-open');updateScene();});
$('#avatar-retry').addEventListener('click',()=>scene?.retryAvatars());
$('#settings-open').addEventListener('click',()=>{if(discussion?.active)void discussion.pause();guideSetup?.pause();document.body.classList.toggle('settings-open');});
$('#guided-open').addEventListener('click',async()=>{if(discussion?.active||discussion?.busy)await discussion.pause();if(discussion)discussion.guideMode=true;document.body.classList.remove('details-open');guideSetup?.resume();updateScene();});
$('#history-open').addEventListener('click',async()=>{if(discussion?.active||discussion?.busy)await discussion.pause();guideSetup?.pause();document.body.classList.add('details-open');$('#landing').hidden=false;$('#draft-summary').hidden=true;$('#draft-form').hidden=true;$<HTMLDetailsElement>('.saved-details').open=true;});
const titleFor = (mode: SessionMode) => mode === 'discussion' ? 'A question for my court' : 'Practice before the council';
// Narrow the form elements once: no DOM text is ever interpreted as markup.
const titleInput = $<HTMLInputElement>('#session-title'), situationInput = $<HTMLTextAreaElement>('#situation');
const getDraft = (): Draft => ({ title: titleInput.value, mode: draftMode, situation: situationInput.value });
function updateScene(status = dirty ? 'Your changes have not been saved.' : saved ? 'Your session is saved.' : 'Choose a room and save a session.') {
  discussion?.render();$('#discussion-open').hidden=!discussion?.visible;
  guideSetup?.render();
  $('#room-label').textContent = draftMode === 'discussion' ? 'The throne court' : 'The council chamber';
  $('#form-title').textContent = draftMode === 'discussion' ? 'Your court session' : 'Your rehearsal session';
  document.body.dataset.environment = draftMode;
  document.body.dataset.keyboardOpen=String(nativeInput!==undefined);
  if (workshop) {
    scene?.setCast(workshop.guide, workshop.activeCast, workshop.preview);
    $('#guide-name').textContent = workshop.guide.name; $('#meet-guide').textContent = `Meet ${workshop.guide.name}`;
    if (displayedGuideId !== workshop.guide.id) {
      displayedGuideId = workshop.guide.id;
      $('#guide-caption').textContent = `Your guide is here. Select ${workshop.guide.name} to meet them, or choose your room.`;
      document.body.dataset.guideSelected = 'false';
    }
    $('#cast-summary').textContent = workshop.activeCast.length ? workshop.activeCast.map(character => character.name).join(' · ') : 'Your guide is ready. Choose who joins the room.';
  }
  const selectedCharacter = saved?.characters.find(c=>c.id===conversation?.speakerId) || workshop?.guide;
  if(conversation){
    $('#quiet').textContent=conversation.quiet?'Enable voice':'Quiet mode';
    const teaching=guideSetup?.active&&['welcome','capture','selection'].includes(guideSetup.view)&&conversation.phase==='Ready'&&!workshop?.isOpen;
    $('#conversation-caption').textContent=teaching?guideSetup!.caption:conversation.visibleCaption;
    $('#conversation-state').textContent=conversation.phase;
    $('#speaker-label').textContent=workshop?.isOpen?'Describe your character':selectedCharacter?.name||'Virus';
    $('#brain-label').textContent=workshop?.current?.brain?.model||selectedCharacter?.brain?.model||conversation.defaultBrain?.model||'No model connected';
    $('#instruction').setAttribute('placeholder',workshop?.isOpen?'Describe a look or personality…':`Ask ${selectedCharacter?.name||'Virus'}…`);
    $<HTMLInputElement>('#instruction').maxLength=guideSetup?.inputLimit||2000;
    document.body.dataset.conversationState=conversation.phase;
    document.body.dataset.speakerId=conversation.speakerId||workshop?.guide.id||'';
    $('#caption-previous').hidden=$('#caption-next').hidden=conversation.captionPages.length<=1;
  }
  const spatial=workshop?courtState(saved,workshop.guide,conversation?.phase||'Ready',conversation?.speakerId||workshop.guide.id,court?.selectedId||''):undefined;if(spatial)court?.render(spatial);
  scene?.update({ mode: draftMode, title: selectedCharacter?.name || titleInput.value || titleFor(draftMode), status: workshop?.isOpen && workshop.status ? workshop.status : status, busy: busy || !!workshop?.busy, character: workshop?.panel, caption:conversation?.visibleCaption,keyboard:nativeInput,guidance:guideSetup?.active?{choices:guideSetup.choices,caption:guideSetup.caption}:undefined,discussion:discussion?.visible&&!discussion.guideMode?{choices:discussion.choices,caption:discussion.caption}:undefined,court:spatial });
  $('#summary-title').textContent = titleInput.value || titleFor(draftMode);
  $('#summary-situation').textContent = situationInput.value || 'Choose your characters. Session details can be added whenever you are ready.';
  $('#summary-save-status').textContent = $('#save-status').textContent;
  document.querySelectorAll<HTMLButtonElement | HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('.workspace button, .workspace input, .workspace textarea, #profile-select, #new-profile, #brand-home, #characters-open, #meet-guide, #customise-guide').forEach(element => element.disabled = busy || !!workshop?.busy);
  document.querySelectorAll<HTMLInputElement>('input[name="mode"]').forEach(input => input.checked = input.value === draftMode);
  syncCourtClearance();
}
function setBusy(value: boolean) {
  busy = value;
  document.querySelectorAll<HTMLButtonElement | HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('.workspace button, .workspace input, .workspace textarea, #profile-select, #new-profile, #brand-home').forEach(element => element.disabled = value);
  updateScene(value ? 'Saving or loading your session…' : undefined);
}
function showError(error: unknown, action: () => Promise<void>) {
  retry = action; $('#error-message').textContent = error instanceof Error ? error.message : 'The session service could not be reached.';
  $('#error-box').hidden = false; $('#reload-session').hidden = !saved;
  $('#save-status').textContent = dirty ? 'Changes kept in this tab' : saved ? 'Saved version kept' : 'Not saved yet';
  updateScene('Could not reach the saved session. Try again.');
}
function clearError() { $('#error-box').hidden = true; }
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, { ...options, signal: AbortSignal.timeout(8000), headers: { 'Content-Type': 'application/json', ...options.headers } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'This session request did not finish.');
  return data as T;
}
const endpoint = (id = '') => `/api/sessions${id ? '/' + id : ''}?profileId=${encodeURIComponent(selectedId)}`;
function setUrl(id?: string) { const url = new URL(location.href); url.searchParams.delete('project'); id ? url.searchParams.set('session', id) : url.searchParams.delete('session'); history.replaceState(null, '', url); }
function renderProfiles() {
  $('#profile-select').innerHTML = profiles.map(profile => `<option value="${escape(profile.id)}">${escape(profile.name)}</option>`).join('');
  $<HTMLSelectElement>('#profile-select').value = selectedId;
  if (storageWarning) { $('#profile-notice').textContent = storageWarning; $('#profile-notice').hidden = false; }
}
function renderHistory(){const list=historySessions.slice(historyPage*3,historyPage*3+3);$('#saved-sessions').innerHTML=list.length?list.map(item=>`<button class="saved-session" data-session="${item.id}"><span><strong>${escape(item.title)}</strong><small>${item.mode==='discussion'?'Court':'Council'} · ${item.status}</small></span><span>↗</span></button>`).join(''):'<p class="empty-state">Your saved sessions appear here.</p>';if(historySessions.length>3)$('#saved-sessions').insertAdjacentHTML('beforeend','<div class="history-pages"><button data-history="previous">‹ Previous</button><button data-history="next">Next ›</button></div>');}
function start(mode: SessionMode, cancel = true) {
  if (busy) return;
  if(cancel){guideSetup?.pause();conversation?.stop();}
  navigation++; saved = null; pending = null; editing = true; dirty = true; draftMode = mode;
  titleInput.value = titleFor(mode); situationInput.value = ''; $('#landing').hidden = true; showDetails(false); $('#session-meta').hidden = true;
  $('#save-status').textContent = 'Not saved yet'; clearError(); setUrl(); updateScene();
}
function showDetails(visible: boolean) { $('#draft-form').hidden = !visible; $('#draft-summary').hidden = visible; }
function applySession(value: Session, keepDetails = !$('#draft-form').hidden) {
  if(saved?.id!==value.id)court?.reset();
  saved = validateSession(value); pending = null; dirty = false; editing = true; draftMode = value.scenario.mode;
  titleInput.value = value.title; situationInput.value = value.scenario.situation;
  $('#landing').hidden = true; showDetails(keepDetails); $('#save-status').textContent = 'Saved';
  $('#session-meta').hidden = false; $('#session-meta').textContent = `Draft · Saved ${new Date(value.updatedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })} IST · Revision ${value.revision}`;
  setUrl(value.id); updateScene();
}
async function refresh() {
  const token = ++navigation, profile = selectedId;
  try {
    const result = await request<{ sessions: Summary[]; unavailableCount: number }>(endpoint());
    if (token !== navigation || profile !== selectedId) return;
    historySessions=result.sessions;historyPage=Math.min(historyPage,Math.max(0,Math.ceil(historySessions.length/3)-1));renderHistory();
    $('#service-status').textContent = result.unavailableCount ? `${result.unavailableCount} saved record(s) need attention and were left unchanged.` : 'Your profile’s sessions are saved on this server.';
    clearError();
  } catch (error) { if (token === navigation) { $('#service-status').textContent = 'Saved sessions are temporarily unavailable.'; showError(error, refresh); } }
}
async function load(id: string) {
  if (busy) return;
  if(discussion?.active||discussion?.busy)await discussion.pause();
  guideSetup?.pause();
  if (!isId(id)) { showError(new Error('This session link is invalid.'), async () => home()); return; }
  const token = ++navigation; setBusy(true); clearError();
  conversation?.stop();
  try { const data = await request<{ session: Session }>(endpoint(id)); if (token === navigation) {applySession(data.session, false);conversation?.restore(data.session);document.body.classList.remove('details-open');guideSetup?.resume();await discussion?.restore();if(discussion?.exists&&guideSetup)guideSetup.active=false;updateScene();} }
  catch (error) { if (token === navigation) showError(error, () => load(id)); }
  finally { setBusy(false); }
}
async function save() {
  if (busy) return;
  if (!editing) start(draftMode);
  if (!titleInput.checkValidity()) { showDetails(true); titleInput.reportValidity(); return; }
  const fields = getDraft();
  const signature = JSON.stringify({ profile: selectedId, id: saved?.id, revision: saved?.revision, draft: fields });
  if (!pending || pending.signature !== signature) pending = { signature, method: saved ? 'PATCH' : 'POST', id: saved?.id || crypto.randomUUID(), body: saved ? { requestId: crypto.randomUUID(), expectedRevision: saved.revision, action: 'update', draft: fields } : { requestId: crypto.randomUUID(), draft: fields } };
  const operation = pending;
  setBusy(true); clearError(); $('#save-status').textContent = 'Saving…';
  try {
    const data = await request<{ session: Session }>(endpoint(operation.method === 'PATCH' ? operation.id : ''), { method: operation.method, body: JSON.stringify({ ...operation.body, ...(operation.method === 'POST' ? { id: operation.id } : {}) }) });
    applySession(data.session);
  } catch (error) { showError(error, save); }
  finally { setBusy(false); }
}
async function home() {
  if (busy) return;
  if(discussion?.active||discussion?.busy)await discussion.pause();
  guideSetup?.pause();
  conversation?.stop();
  if (editing && dirty) { await save(); if (dirty) return; }
  editing = false; saved = null;court?.reset(); pending = null; dirty = false; $('#landing').hidden = false; $('#draft-form').hidden = true; $('#draft-summary').hidden = true; clearError(); setUrl();document.body.classList.remove('details-open');guideSetup?.resume();updateScene(); await refresh();
}
function changed() { dirty = true; pending = null; $('#save-status').textContent = 'Unsaved changes'; clearError(); updateScene(); }

document.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach(button => button.addEventListener('click', () => start(button.dataset.mode as SessionMode)));
$('#edit-details').addEventListener('click', () => showDetails(true));
$('#summary-save').addEventListener('click', () => void save()); $('#summary-home').addEventListener('click', () => void home());
$('#characters-open').addEventListener('click', async () => {if(discussion?.active||discussion?.busy)await discussion.pause();guideSetup?.pause();workshop?.open();}); $('#choose-cast').addEventListener('click', async () => {if(discussion?.active||discussion?.busy)await discussion.pause();guideSetup?.pause();workshop?.open();});
$('#customise-guide').addEventListener('click', async () => {if(discussion?.active||discussion?.busy)await discussion.pause();guideSetup?.pause();workshop?.open(workshop.guide.id);});
function meetGuide() { if (!workshop || busy || workshop.busy) return; scene?.selectCharacter(workshop.guide.id);conversation?.stop();if(conversation)conversation.speakerId=workshop.guide.id;if(guideSetup?.lesson==='selection')void guideSetup.selectedGuide();else conversation?.say(`I’m ${workshop.guide.name}. Tell me what you want to explore, or say “open your brain”.`);$('#guide-caption').textContent = `Ask ${workshop.guide.name} a question or open the character controls.`; document.body.dataset.guideSelected = 'true'; }
$('#meet-guide').addEventListener('click', meetGuide);
document.querySelectorAll<HTMLInputElement>('input[name="mode"]').forEach(input => input.addEventListener('change', () => { draftMode = input.value as SessionMode; changed(); }));
titleInput.addEventListener('input', changed); situationInput.addEventListener('input', changed);
$('#draft-form').addEventListener('submit', event => { event.preventDefault(); void save(); });
$('#saved-sessions').addEventListener('click', event => { const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-session]'); if (button) void load(button.dataset.session!);const pager=(event.target as HTMLElement).closest<HTMLButtonElement>('[data-history]');if(pager){const pages=Math.max(1,Math.ceil(historySessions.length/3));historyPage=(historyPage+(pager.dataset.history==='next'?1:pages-1))%pages;renderHistory();} });
$('#back-home').addEventListener('click', () => void home()); $('#brand-home').addEventListener('click', () => void home());
$('#refresh-sessions').addEventListener('click', () => void refresh()); $('#retry-action').addEventListener('click', () => void retry());
$('#reload-session').addEventListener('click', () => { if (saved) void load(saved.id); });
$('#profile-select').addEventListener('change', async () => {
  const next = $<HTMLSelectElement>('#profile-select').value;
  $<HTMLSelectElement>('#profile-select').value = selectedId;
  await home(); if (dirty || busy) return;
  selectedId = next; persistProfiles(); renderProfiles(); document.body.dataset.guideSelected = 'false'; await Promise.all([refresh(), workshop?.reload(true)]);
  conversation?.reset();guideSetup?.resume();
});
$('#new-profile').addEventListener('click', () => { if (profiles.length >= 12) { showError(new Error('This browser can keep up to twelve profiles.'), refresh); return; } $<HTMLDialogElement>('#profile-dialog').showModal(); $<HTMLInputElement>('#profile-name').focus(); });
$('#cancel-profile').addEventListener('click', () => $<HTMLDialogElement>('#profile-dialog').close());
$('#profile-form').addEventListener('submit', async event => {
  event.preventDefault(); const name = $<HTMLInputElement>('#profile-name').value.trim(); if (!name) return;
  await home(); if (dirty || busy) return;
  const profile = { id: crypto.randomUUID(), name }; profiles.push(profile); selectedId = profile.id; persistProfiles(); renderProfiles();
  $<HTMLDialogElement>('#profile-dialog').close(); await Promise.all([refresh(), workshop?.reload(true)]);
  conversation?.reset();guideSetup?.resume();
});
$('#enter-vr').addEventListener('click', async () => { try { await scene?.enter(); } catch (error) { showError(error, async () => { await scene?.enter(); }); } });

const ensureSession = async () => { if(!editing)start(draftMode,false);if(!saved||dirty)await save();return dirty?null:saved; };
const sessionCallbacks={profile:()=>selectedId,session:()=>saved,ensureSession,sessionChanged:(session:Session)=>applySession(session),changed:()=>updateScene()};
conversation = new SessionConversation(sessionCallbacks);
workshop = new CharacterWorkshop(sessionCallbacks,conversation);
court=new CourtOverlay((action,id)=>{if(action==='floor'&&id)void discussion?.address(id);else if(action==='brain'&&id)void openCharacterControls('brain',id);});
discussion=new SessionDiscussion({...sessionCallbacks,guide:()=>workshop!.guide,castChanged:async()=>{await workshop!.reload();},beforeStart:()=>{if(guideSetup?.active||guideSetup?.busy)guideSetup.pause();if(guideSetup)guideSetup.active=false;document.body.classList.remove('details-open');}},conversation);
guideSetup=new GuideSetup({...sessionCallbacks,details:()=>{document.body.classList.add('details-open');if(!editing)start(draftMode);showDetails(true);},startDiscussion:async()=>{await discussion?.start();},startCoaching:async()=>{await discussion?.start(false,'coaching');}},conversation,workshop);
async function openCharacterControls(view:'brain'|'voice'|'appearance', id=workshop?.current?.id&&workshop.isOpen?workshop.current.id:conversation?.speakerId||workshop?.guide.id){
  if(!workshop||!conversation||!id||busy||workshop.busy)return false;
  if(discussion?.active||discussion?.busy)await discussion.pause();
  guideSetup?.pause();
  conversation.stop();
  const opened=await workshop.inspect(id,view);
  if(opened){conversation.say(`${workshop.current?.name}: ${view==='brain'?'choose a model for this character':view==='voice'?'choose or preview a voice':'try a look on the character'}.`);if(view==='brain')await guideSetup?.observedBrain();}
  return opened;
}
async function executeInterfaceIntent(intent:InterfaceIntent){
  if(!conversation||!workshop)return;
  if(intent.action.startsWith('discussion-')&&discussion){
    const action=intent.action.slice(11);let target=discussion.targetId;
    if(!saved||saved.status==='draft'&&!discussion.exists){conversation.say('Confirm the situation and cast first, or open a saved discussion.');return;}
    if(intent.characterName){const matches=saved?.characters.filter(c=>c.name.normalize('NFKC').toLowerCase()===intent.characterName&&saved?.participants.some(p=>p.active&&p.characterId===c.id))||[];if(matches.length!==1){conversation.say('Select the active participant you mean.');return;}target=matches[0].id;}
    if(action==='floor'){if(target)await discussion.address(target);else conversation.say('Select a participant to give them the floor.');}
    else if(['start','resume','stop','finish','invite','coach'].includes(action))await discussion.handle(action);
    else await discussion.intervene(action,'',target||saved?.participants.find(p=>p.active&&p.characterId===conversation?.speakerId)?.characterId||null);
    return;
  }
  if(intent.action==='interrupt'){if(discussion?.active||discussion?.busy){await discussion.pause();await guideSetup?.observedInterruption();}else await guideSetup?.interrupted();conversation.stop(false);return;}
  if(intent.action==='quiet'||intent.action==='unquiet'){if(discussion?.active||discussion?.busy)await discussion.pause();guideSetup?.pause();conversation.quiet=intent.action==='quiet';conversation.stop();$('#quiet').textContent=conversation.quiet?'Enable voice':'Quiet mode';conversation.say(conversation.quiet?'Voice is off. Captions remain available.':'Voice is enabled.');return;}
  if(intent.action==='repeat'){if(discussion?.active||discussion?.busy)await discussion.pause();await conversation.repeat();return;}
  if(intent.action==='notes'||intent.action==='guide-help'||intent.action==='intro'){if(discussion?.active||discussion?.busy)await discussion.pause();if(discussion)discussion.guideMode=true;if(guideSetup){guideSetup.active=true;conversation.speakerId=workshop.guide.id;document.body.classList.remove('details-open');await guideSetup.handle(intent.action==='notes'?'notes':intent.action==='intro'?'practice':'help');}return;}
  if(intent.action==='new-character'){if(discussion?.active||discussion?.busy)await discussion.pause();conversation.stop();workshop.newCharacter();return;}
  if(intent.action==='show-characters'){if(discussion?.active||discussion?.busy)await discussion.pause();guideSetup?.pause();workshop.open();return;}
  let id=workshop.isOpen?workshop.current?.id:conversation.speakerId||workshop.guide.id;
  if(intent.characterName){
    const normalise=(name:string)=>name.normalize('NFKC').toLowerCase().replace(/[’‘]/g,"'").replace(/\s+/g,' ').trim();
    const current=workshop.isOpen?workshop.current:saved?.characters.find(c=>c.id===id)||workshop.guide;
    if(!current||normalise(current.name)!==intent.characterName){const candidates=[...new Map([workshop.guide,...(workshop.library?.characters||[])].filter(c=>normalise(c.name)===intent.characterName).map(c=>[c.id,c])).values()];if(candidates.length!==1){conversation.say('Select the character you mean, then open their controls.');return;}id=candidates[0].id;}
  }
  await openCharacterControls(intent.action==='open-brain'?'brain':intent.action==='open-voice'?'voice':'appearance',id);
}
async function sendInstruction(text:string){
  if(!text.trim()||!conversation||!workshop)return;
  const intent=parseInterfaceIntent(text,[workshop.guide.name,...(workshop.library?.characters.map(c=>c.name)||[]),...(workshop.current?[workshop.current.name]:[])]);
  if(intent){if((busy||workshop.busy)&&!['interrupt','quiet','unquiet'].includes(intent.action)){conversation.say('Finishing your current change. Try that command again in a moment.');return;}await executeInterfaceIntent(intent);$<HTMLInputElement>('#instruction').value='';return;}
  let accepted=true;
  if(workshop.isOpen)await workshop.describe(text.trim());
  else if(discussion&&(discussion.ownsInput||(discussion.active||saved?.status==='ready')&&isScopeCorrection(text)))accepted=await discussion.intervene('say',text.trim(),discussion.targetId||saved?.participants.find(p=>p.active&&p.characterId===conversation?.speakerId)?.characterId||null);
  else if(!guideSetup?.active||conversation.speakerId&&conversation.speakerId!==workshop.guide.id||!await guideSetup.receive(text.trim()))await conversation.talk(conversation.speakerId||workshop.guide.id,text.trim());
  if(accepted&&conversation.phase!=='Error'&&!guideSetup?.busy&&!document.querySelector('#guide-setup [role="alert"]'))$<HTMLInputElement>('#instruction').value='';
}
$('#instruction-form').addEventListener('submit',event=>{event.preventDefault();void sendInstruction($<HTMLInputElement>('#instruction').value);});
$('#microphone').addEventListener('click',async()=>{if(discussion?.active&&conversation?.phase!=='Listening')await discussion.pause();void conversation?.microphone(text=>void sendInstruction(text));});
$('#interrupt').addEventListener('click',()=>{if(discussion?.active||discussion?.busy){void discussion.pause().then(()=>guideSetup?.observedInterruption());}else{void guideSetup?.interrupted();conversation?.stop();}});
$('#repeat').addEventListener('click',async()=>{if(discussion?.active||discussion?.busy)await discussion.pause();void conversation?.repeat();});
$('#quiet').addEventListener('click',async()=>{if(!conversation)return;if(discussion?.active||discussion?.busy)await discussion.pause();guideSetup?.pause();conversation.quiet=!conversation.quiet;conversation.stop();$('#quiet').textContent=conversation.quiet?'Enable voice':'Quiet mode';});
$('#brain-open').addEventListener('click',()=>void openCharacterControls('brain'));
$('#caption-previous').addEventListener('click',()=>{if(conversation){conversation.page=Math.max(0,conversation.page-1);updateScene();}});
$('#caption-next').addEventListener('click',()=>{if(conversation){conversation.page=Math.min(conversation.captionPages.length-1,conversation.page+1);updateScene();}});
function aiAction(action:string){if(!conversation)return;if(action==='ai:quiet'){conversation.quiet=!conversation.quiet;conversation.stop();}else if(action==='ai:previous'){conversation.page=Math.max(0,conversation.page-1);updateScene();}else if(action==='ai:next'){conversation.page=Math.min(conversation.captionPages.length-1,conversation.page+1);updateScene();}else if(action==='ai:stop')conversation.stop();else if(action==='ai:mic')void conversation.microphone(text=>void sendInstruction(text));else if(action==='ai:repeat')void conversation.repeat();else if(action==='ai:type'){nativeInput='';updateScene();}else if(action.startsWith('key:')){const key=action.slice(4);if(key==='cancel')nativeInput=undefined;else if(key==='send'){const text=nativeInput||'';nativeInput=undefined;void sendInstruction(text);}else if(key==='back')nativeInput=(nativeInput||'').slice(0,-1);else nativeInput=((nativeInput||'')+(key==='space'?' ':key)).slice(0,2000);updateScene();}}

async function boot() {
  renderProfiles(); $('#legacy-notice').hidden = !new URL(location.href).searchParams.has('project');
  try {
    scene = new SessionScene($<HTMLCanvasElement>('#session-world'), action => {
      if(action==='court:floor'){const id=court?.selectedId||conversation?.speakerId;if(id)void discussion?.address(id);return;}
      if(action==='court:brain'){void openCharacterControls('brain',court?.selectedId||conversation?.speakerId);return;}
      if(action.startsWith('discuss:')){void discussion?.handle(action.slice(8));return;}
      if(action==='ai:stop'&&discussion?.active){void discussion.pause().then(()=>guideSetup?.observedInterruption());return;}
      if(action==='ai:mic'&&discussion?.active&&conversation?.phase!=='Listening'){void discussion.pause().then(()=>conversation?.microphone(text=>void sendInstruction(text)));return;}
      if(action==='ai:avatar-retry'){scene?.retryAvatars();return;}
      if(action==='ai:quiet'&&discussion?.active){void discussion.pause().then(()=>aiAction(action));return;}
      if(action==='ai:repeat'&&discussion?.active){void discussion.pause().then(()=>aiAction(action));return;}
      if(action==='ai:stop'){void guideSetup?.interrupted();conversation?.stop();return;}
      if(action==='ai:quiet')guideSetup?.pause();
      if(action.startsWith('guide:')){void guideSetup?.handle(action.slice(6));return;}
      if(action.startsWith('ai:')||action.startsWith('key:')){aiAction(action);return;}
      if (busy && action !== 'exit') return;
      if (action === 'characters' || action.startsWith('workshop:')) { if(action==='characters')guideSetup?.pause();void workshop?.handle(action); return; }
      if (action === 'discussion' || action === 'rehearsal') { if (!editing) start(action); else { draftMode = action; changed(); } }
      else if (action === 'save') void save(); else if (action === 'home') void home(); else {if(discussion?.active)void discussion.pause();conversation?.stop();void scene?.exit();}
    }, active => { document.body.dataset.xrActive = String(active); document.body.classList.toggle('in-vr', active); workshop?.onXRChange(active);if(!active&&discussion?.active)void discussion.pause(); });
    scene.onCharacterSelect = id => { if(workshop?.isOpen)workshop.select(id);else if(discussion?.active){if(id===workshop?.guide.id)void discussion.help();else{court?.select(id);discussion.targetId=id;updateScene();}}else{conversation?.stop();if(conversation)conversation.speakerId=id;if(id===workshop?.guide.id)meetGuide();else{void guideSetup?.gaveFloor();conversation?.say(`You have the floor. Ask ${saved?.characters.find(c=>c.id===id)?.name||'this character'} a question.`);}updateScene();} };
    scene.onFeatureSelect=feature=>workshop?.selectFeature(feature);
    scene.onHeadInspect=id=>void openCharacterControls('brain',id);
    scene.speech=()=>{const mouth=conversation?.mouth();return mouth&&workshop?{id:conversation!.speakerId||workshop.guide.id,mouth}:null;};
    $('#enter-vr').setAttribute('aria-label', 'Enter VR');
    const supported = await navigator.xr?.isSessionSupported('immersive-vr').catch(() => false);
    $('#xr-status').textContent = supported ? 'Headset ready · Hand selection supported' : 'Open in Quest Browser to enter VR';
    $<HTMLButtonElement>('#enter-vr').disabled = !supported;
    $('#enter-vr').title = $('#xr-status').textContent || '';
  } catch {
    $('#xr-status').textContent = '3D preview unavailable · Session setup still works';
    $<HTMLButtonElement>('#enter-vr').disabled = true; $('#enter-vr').title = 'VR needs the 3D preview, which is unavailable on this device.';
    document.body.classList.add('scene-unavailable');
  }
  updateScene();
  await Promise.all([refresh(), workshop?.reload(),conversation?.connect()]);
  await guideSetup?.boot();updateScene();
  const session = new URL(location.href).searchParams.get('session'); if (session) await load(session);
  document.body.dataset.appReady = 'true'; window.dispatchEvent(new Event('goc-ready'));
}
window.addEventListener('pagehide', event => { if (!event.persisted) scene?.dispose(); });
void boot().catch(error => { showError(error, boot); window.dispatchEvent(new CustomEvent('goc-boot-error', { detail: 'Session setup could not open. Please try again.' })); });
