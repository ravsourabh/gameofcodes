import * as THREE from 'three';
import type {Session,Character} from '../shared/session-domain.mjs';
import {currentScopeTurns} from '../shared/discussion-memory.mjs';

export type CourtFocus={id:string;name:string;role:string;code:string;position:string;previous:string;reason:string;brain:string};
export type CourtState={title:string;status:string;phase:string;speakerId:string;selectedId:string;focus:CourtFocus|null;ratings:{name:string;count:number}[];criteria:string[];turnId?:string;turnKind?:string;respondingTo?:string;showRoom?:string;showStyle?:string};
export function courtState(session:Session|null,guide:Character,phase:string,speakerId:string,selectedId:string):CourtState{
  const active=session?.participants.filter(p=>p.active)||[],id=selectedId||speakerId;
  const p=active.find(p=>p.characterId===id),c=session?.characters.find(c=>c.id===id)||(id===guide.id?guide:null);
  const turns=p?(session?.discussion?currentScopeTurns(session):session!.contributions).filter(t=>t.participantId===p.id):[],last=turns.at(-1),previous=[...turns].reverse().find(t=>t.position&&t.position!==p?.position)?.position||'';
  const latest=session?currentScopeTurns(session).at(-1):null,related=latest?.relatedIds.map(id=>session?.contributions.find(t=>t.id===id)).find(t=>t&&t.participantId!==latest.participantId),respondingTo=session?.participants.find(p=>p.id===related?.participantId)?.characterId;
  return {title:session?.title||'Your throne court',status:session?.status||'welcome',phase,speakerId,selectedId,showRoom:session?.showRoom,showStyle:session?.showStyle,turnId:session?.participants.find(p=>p.id===latest?.participantId)?.characterId===speakerId?latest?.id:undefined,turnKind:last?.turnKind,respondingTo,focus:c?{id:c.id,name:c.name,role:p?.role||'Your guide',code:p?.code||c.code,position:p?.position||'No view stated yet.',previous,reason:last?.text||'Select someone, or ask your guide to help you begin.',brain:last?.brain.model||p?.brain?.model||c.brain?.model||'No brain assigned'}:null,
    ratings:active.map(p=>({name:session!.characters.find(c=>c.id===p.characterId)?.name||'Participant',count:session!.ratings.filter(r=>session!.contributions.some(t=>t.id===r.contributionId&&t.participantId===p.id)).length})),criteria:session?.scenario.rubric.map(r=>r.name)||[]};
}
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export class CourtOverlay{
  selectedId='';private focusOpen=false;private scoresOpen=false;private page=0;private pages:string[]=[];private state:CourtState|null=null;
  private root=document.createElement('section');
  constructor(private action:(action:string,id?:string)=>void){
    this.root.id='court-surfaces';this.root.setAttribute('aria-label','Court information');document.querySelector('.session-app')!.append(this.root);
    this.root.addEventListener('click',e=>{const b=(e.target as HTMLElement).closest<HTMLButtonElement>('[data-court]');if(!b)return;const a=b.dataset.court!;if(a==='focus'){this.focusOpen=!this.focusOpen;this.page=0;}else if(a==='scores')this.scoresOpen=!this.scoresOpen;else if(a==='next')this.page=(this.page+1)%this.pages.length;else if(a==='close'){this.focusOpen=false;this.scoresOpen=false;}else this.action(a,this.state?.focus?.id);if(this.state)this.render(this.state);});
  }
  select(id:string){this.selectedId=id;this.focusOpen=true;this.page=0;}
  reset(){this.selectedId='';this.focusOpen=false;this.scoresOpen=false;}
  render(s:CourtState){
    this.state=s;const f=s.focus,live=s.status!=='welcome'&&document.body.dataset.hasDiscussion==='true';this.root.hidden=!live||document.body.dataset.workshopOpen==='true'||document.body.classList.contains('details-open')||document.body.classList.contains('settings-open');
    this.pages=f?[`Guiding code\n${f.code}`,`Current view\n${f.position}${f.previous?'\nEarlier: '+f.previous:''}`,`Latest reasoning\n${f.reason}`].flatMap(t=>t.match(/[\s\S]{1,210}(?:\s|$)|\S{1,210}/g)||['']):[''];const text=this.pages[this.page%this.pages.length];
    this.root.innerHTML=`<div class="court-heading"><span class="eyebrow">THE THRONE COURT</span><span>${esc(s.title)}</span><small>${esc(s.status==='running'?s.phase==='Thinking'?'Considering':'In discussion':s.status)}</small></div><div class="court-left"><button class="court-seal" data-court="focus" aria-expanded="${this.focusOpen}" aria-label="Inspect character view">${f?`${esc(f.name)} <span>· ${esc(f.role)}</span>`:'Select a character'} <b>↗</b></button>${this.focusOpen&&f?`<aside id="court-focus" aria-label="Character view"><span class="eyebrow">${esc(f.name)} · ${esc(f.role)}</span><p>${esc(text)}</p><div class="court-info-actions"><button data-court="next">Next ${this.page%this.pages.length+1}/${this.pages.length} →</button><button data-court="floor">Give floor</button><button data-court="brain">Brain</button><button data-court="close" aria-label="Close character view">×</button></div></aside>`:''}</div><div class="court-right"><button class="court-seal" data-court="scores" aria-expanded="${this.scoresOpen}">Your judgement <b>◇</b></button>${this.scoresOpen?`<aside id="court-scores" aria-label="Judgement surface"><span class="eyebrow">YOUR JUDGEMENT</span><p>${s.ratings.some(r=>r.count)?'Saved ratings are available for this session.':'No ratings yet.'}</p>${s.ratings.map(r=>`<div class="court-rating"><span>${esc(r.name)}</span><span>${r.count?r.count+' ratings':'—'}</span></div>`).join('')}<small>${esc(s.criteria.join(' · '))}</small><button data-court="close">Close</button></aside>`:''}</div>`;
  }
}

export type SurfaceButton={x:number;y:number;width:number;height:number;label:string;action:string};
// Small, genuinely ray-selectable WebXR surfaces. HTML remains the desktop equivalent.
export class CourtSurface{
  readonly canvas=document.createElement('canvas');readonly context:CanvasRenderingContext2D;readonly texture:THREE.CanvasTexture;readonly mesh:THREE.Mesh<THREE.PlaneGeometry,THREE.MeshBasicMaterial>;buttons:SurfaceButton[]=[];
  constructor(readonly name:string,width:number,height:number,at:[number,number,number],yaw=0){
    this.canvas.width=1000;this.canvas.height=Math.round(1000*height/width);this.context=this.canvas.getContext('2d')!;this.texture=new THREE.CanvasTexture(this.canvas);this.texture.colorSpace=THREE.SRGBColorSpace;
    this.mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,height),new THREE.MeshBasicMaterial({map:this.texture,transparent:true,toneMapped:false,side:THREE.DoubleSide}));this.mesh.position.set(...at);this.mesh.rotation.y=yaw;this.mesh.userData.courtSurface=name;this.mesh.visible=false;
  }
  draw(eyebrow:string,title:string,text:string,buttons:SurfaceButton[]=[]){
    const c=this.context,h=this.canvas.height,compact=this.name==='caption';c.clearRect(0,0,1000,h);c.fillStyle='#10231ef2';c.beginPath();c.roundRect(1,1,998,h-2,24);c.fill();c.strokeStyle='#c1a57980';c.lineWidth=2;c.stroke();c.fillStyle='#ccaf7d';c.font='24px sans-serif';c.fillText(eyebrow.toUpperCase().slice(0,55),32,compact?30:52);c.fillStyle='#f2eddf';c.font=`${compact?30:44}px Georgia`;c.fillText(title.slice(0,48),32,compact?65:118);
    c.font=`${compact?27:36}px sans-serif`;let y=compact?105:178;const limit=compact?h-25:h-150,step=compact?35:48,words=text.split(/\s+/);let line='';for(const word of words){const next=line?line+' '+word:word;if(c.measureText(next).width>(compact?840:925)){c.fillText(line,32,y);y+=step;line=word;if(y>limit)break;}else line=next;}if(y<=limit)c.fillText(line,32,y);
    this.buttons=buttons;for(const b of buttons){c.fillStyle='#294338';c.beginPath();c.roundRect(b.x,b.y,b.width,b.height,12);c.fill();c.fillStyle='#f2e6cc';c.font='27px sans-serif';c.textAlign='center';c.fillText(b.label.slice(0,30),b.x+b.width/2,b.y+b.height/2+10);c.textAlign='left';}this.texture.needsUpdate=true;
  }
  hit(uv:THREE.Vector2){const x=uv.x*1000,y=(1-uv.y)*this.canvas.height;return this.buttons.find(b=>x>=b.x&&x<=b.x+b.width&&y>=b.y&&y<=b.y+b.height)?.action;}
  dispose(){this.mesh.geometry.dispose();this.mesh.material.dispose();this.texture.dispose();}
}
