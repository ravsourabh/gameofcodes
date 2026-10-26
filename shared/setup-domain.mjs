import { SessionError, isId, prepareMutation, appendEvent } from './session-domain.mjs';

const check = (ok, message) => { if (!ok) throw new SessionError(message); };
const text = (v, n, required = false) => typeof v === 'string' && v.length <= n && (!required || v.trim().length > 0);
const exact = (v, keys) => v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).every(k => keys.includes(k));
export function validateProposal(p) {
  check(exact(p, ['title','mode','format','intensity','situation','goal','constraints','durationMinutes','rubric','cast','showStyle','showRoom']), 'Unexpected setup proposal.');
  check((p.showStyle===undefined||['serious','funny','satire','mixed'].includes(p.showStyle))&&(p.showRoom===undefined||['conference','heated','comedy','newsroom'].includes(p.showRoom)),'Invalid proposed show style.');
  check(text(p.title,120,true) && text(p.situation,4000,true) && text(p.goal,1000,true), 'The setup needs a title, situation and goal.');
  check(['discussion','rehearsal'].includes(p.mode) && (p.mode === 'rehearsal' ? p.format === 'panel' : ['roundtable','hearing','adversarial'].includes(p.format)), 'Invalid proposed room or format.');
  check(['calm','formal','probing','heated'].includes(p.intensity) && Number.isInteger(p.durationMinutes) && p.durationMinutes >= 1 && p.durationMinutes <= 120, 'Invalid proposed pace or duration.');
  check(Array.isArray(p.constraints) && p.constraints.length <= 6 && p.constraints.every(t => text(t,300,true)), 'Invalid proposed constraints.');
  check(Array.isArray(p.rubric) && p.rubric.length >= 1 && p.rubric.length <= 4 && p.rubric.every(r => exact(r,['name','description']) && text(r.name,100,true) && text(r.description,500,true)), 'Invalid proposed criteria.');
  check(Array.isArray(p.cast) && p.cast.length >= 1 && p.cast.length <= 5 && p.cast.every(c => exact(c,['name','role','reason','code','personality']) && text(c.name,80,true) && text(c.role,160,true) && text(c.reason,300,true) && text(c.code,300,true) && text(c.personality,300,true)), 'Invalid suggested cast.');
  return p;
}
export function validateSetup(setup) {
  check(exact(setup,['stage','proposal','brain','context','confirmedAt']), 'Invalid guided setup.');
  check(['capture','review','cast','ready'].includes(setup.stage), 'Invalid setup step.');
  if (setup.proposal !== null) validateProposal(setup.proposal);
  check(setup.brain === null || exact(setup.brain,['provider','model']) && text(setup.brain.provider,80,true) && text(setup.brain.model,160,true), 'Invalid setup model provenance.');
  check(setup.confirmedAt === null || typeof setup.confirmedAt === 'string' && Number.isFinite(Date.parse(setup.confirmedAt)), 'Invalid confirmation receipt.');
  check(Array.isArray(setup.context) && setup.context.length <= 4 && new Set(setup.context.map(c=>c.id)).size === setup.context.length && setup.context.every(c => exact(c,['id','name','status','text','error']) && isId(c.id) && text(c.name,160,true) && ['pending','reviewed','unreadable'].includes(c.status) && text(c.text,12000) && text(c.error,300) && (c.status !== 'reviewed' || c.text.trim())), 'Invalid reviewed context.');
  check(setup.context.reduce((n,c)=>n+c.text.length,0) <= 24000, 'Context is limited to 24,000 characters per session.');
  check(setup.stage !== 'ready' || setup.confirmedAt !== null, 'Setup approval requires confirmed notes.');
  return setup;
}
export const emptySetup = () => ({stage:'capture',proposal:null,brain:null,context:[],confirmedAt:null});
export function changeSetup(session, mutation) {
  const {operation, payload = {}} = mutation;
  check(['capture','propose','confirm-notes','context','review-context','remove-context','approve','lesson'].includes(operation), 'Unknown guide action.');
  const command = JSON.stringify({action:'guidance',operation,payload});
  const next = prepareMutation(session,mutation,command); if (!next) return session;
  check(['draft','ready'].includes(next.status), 'Pause or finish the current session before setting up another situation.');
  next.guidance ||= {schemaVersion:1,tutorialVersion:1,guide:null,activeLesson:null,notes:[]};
  const g=next.guidance, setup=g.setup ||= emptySetup(), now=mutation.now || new Date().toISOString();
  if (operation === 'capture') {
    check(exact(payload,['text']) && text(payload.text,2000,true), 'Describe the situation or correction in a short sentence.');
    check(g.notes.filter(n=>n.source==='user').length < 12,'This setup has reached its note limit. Start a new situation.');
    g.notes.push({id:crypto.randomUUID(),text:payload.text.trim(),source:'user',status:'confirmed'});
    setup.stage='capture';setup.confirmedAt=null;next.status='draft';g.activeLesson='input';
  } else if (operation === 'propose') {
    check(exact(payload,['proposal','brain']), 'Unexpected proposal fields.'); validateProposal(payload.proposal);
    check(g.notes.some(n=>n.source==='user'),'Capture the user’s words first.');
    setup.proposal=structuredClone(payload.proposal);setup.brain=structuredClone(payload.brain);setup.stage='review';setup.confirmedAt=null;next.status='draft';
    // Old readbacks remain in the record, with their original confirmation state.
    g.notes.push({id:crypto.randomUUID(),text:[payload.proposal.situation,`Goal: ${payload.proposal.goal}`,...payload.proposal.constraints.map(t=>`Constraint: ${t}`)].join('\n'),source:'interpretation',status:'unconfirmed'});
  } else if (operation === 'confirm-notes') {
    check(exact(payload,[]) && setup.stage==='review' && setup.proposal,'Review the guide’s readback first.');
    const p=setup.proposal;next.title=p.title;if(p.showStyle)next.showStyle=p.showStyle;if(p.showRoom)next.showRoom=p.showRoom;
    Object.assign(next.scenario,{mode:p.mode,format:p.format,intensity:p.intensity,situation:p.situation,goal:p.goal,durationMinutes:p.durationMinutes,rubric:p.rubric.map(r=>({id:crypto.randomUUID(),...r})),updatedAt:now});
    const last=g.notes.filter(n=>n.source==='interpretation').at(-1);if(last)last.status='confirmed';
    setup.confirmedAt=now;setup.stage='cast';g.activeLesson='interruption';
  } else if (operation === 'context') {
    check(exact(payload,['item']) && payload.item?.status!=='reviewed','New context must be reviewed first.');
    setup.context.push(structuredClone(payload.item));setup.stage=setup.proposal?'review':'capture';setup.confirmedAt=null;next.status='draft';
  } else if (operation === 'review-context' || operation === 'remove-context') {
    check(exact(payload,['id']) && isId(payload.id),'Choose a context item.');const c=setup.context.find(c=>c.id===payload.id);check(c,'Context not found.');
    if(operation==='remove-context')setup.context=setup.context.filter(c=>c.id!==payload.id);else {check(c.status==='pending' && c.text.trim(),'This material has no readable text.');c.status='reviewed';}
    setup.stage='capture';setup.confirmedAt=null;next.status='draft';
  } else if (operation === 'approve') {
    check(exact(payload,[]) && setup.stage==='cast' && setup.confirmedAt,'Confirm the situation first.');
    check(setup.context.every(c=>c.status==='reviewed'),'Review or remove every context item before approving.');
    const active=next.participants.filter(p=>p.active);check(active.length>0,'Choose at least one participant.');
    check(active.every(p=>p.brain?.model) && g.guide?.brain?.model,'Choose connected brains for the guide and cast.');
    setup.stage='ready';next.status='ready';g.activeLesson=null;
  } else {
    check(exact(payload,['id']) && (payload.id===null || ['welcome','selection','input','interruption','brains','scoring','presenters','rehearsal'].includes(payload.id)),'Invalid current lesson.');g.activeLesson=payload.id;
  }
  next.scenario.context=setup.context.map(({id,name,status})=>({id,name,status}));
  if(operation!=='lesson')next.epoch++;
  return appendEvent(next,'session.guidance',mutation.requestId,command,now);
}
