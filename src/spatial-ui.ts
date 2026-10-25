import * as THREE from 'three';
import { COURT, type CourtRole } from './characters';

type Region = { x: number; y: number; w: number; h: number; action: string };
export class SpatialDialogue {
  readonly mesh: THREE.Mesh;
  private canvas = document.createElement('canvas');
  private texture: THREE.CanvasTexture;
  private regions: Region[] = [];
  private role: CourtRole = 'architect';
  private text = 'Welcome to your court. Select a member of your team, then tell them what you would like to create.';
  private mode = 'Ready when you are';
  private composer = false;
  private garden = false;
  private input = '';
  private proposal: string[] = [];
  private upper = false;
  private tourContinue = false;
  private settings = false;
  private setup: {title:string;text:string;choices:{label:string;action:string}[]}|null=null;
  private codeFiles: Record<string,string> | null = null;
  private codeFile = 0;
  private codePage = 0;

  constructor() {
    this.canvas.width = 1400; this.canvas.height = 600;
    this.texture = new THREE.CanvasTexture(this.canvas); this.texture.colorSpace = THREE.SRGBColorSpace;
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2.65, 1.136), new THREE.MeshBasicMaterial({ map: this.texture, transparent: true, toneMapped: false, depthWrite: false }));
    this.mesh.position.set(0, 0.66, -0.05); this.mesh.rotation.x = -0.13;
    this.mesh.userData.dialogue = true;
    this.draw();
  }
  showSetup(value:typeof this.setup){this.setup=value;this.draw();}
  showSettings(show:boolean) { this.settings=show; this.draw(); }
  setTourContinue(show: boolean) { this.tourContinue = show; this.draw(); }
  showCode(files: Record<string,string>) { this.codeFiles=files; this.codeFile=0; this.codePage=0; this.draw(); }
  codeAction(action:string) {
    if(action==='code:close')this.codeFiles=null;
    if(action==='code:file'){this.codeFile=(this.codeFile+1)%Object.keys(this.codeFiles||{}).length;this.codePage=0;}
    if(action==='code:next')this.codePage++;
    if(action==='code:back')this.codePage=Math.max(0,this.codePage-1);
    this.draw();
  }
  update(role: CourtRole, text: string, mode = 'Your court is listening') { this.role = role; this.text = text; this.mode = mode; this.draw(); }
  showProposal(requirements: string[]) { this.proposal = requirements.slice(0, 3); this.draw(); }
  setGarden(garden: boolean) { this.garden=garden; this.showComposer(this.composer,this.input); }
  showComposer(show: boolean, input = '') {
    this.composer = show; this.input = input;
    this.mesh.position.y = this.garden ? (show ? 1.3 : 1) : (show ? 1.23 : .66); this.mesh.position.z = this.garden ? (show ? 3.8 : 3.65) : (show ? .1 : -.05);
    this.draw();
  }
  setInput(input: string) { this.input = input; this.draw(); }
  actionAt(uv: THREE.Vector2) {
    const x = uv.x * 1400, y = (1 - uv.y) * 600;
    const region = this.regions.find(r => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
    return region?.action;
  }
  handleKey(key: string) {
    if (key === 'shift') this.upper = !this.upper;
    else if (key === 'backspace') this.input = this.input.slice(0, -1);
    else if (this.input.length < 500) this.input += key === 'space' ? ' ' : this.upper ? key.toUpperCase() : key;
    this.draw(); return this.input;
  }
  private draw() {
    const ctx = this.canvas.getContext('2d')!; this.regions = [];
    ctx.clearRect(0, 0, 1400, 600);
    ctx.fillStyle = '#102429f5'; ctx.beginPath(); ctx.roundRect(2, 2, 1396, 596, 28); ctx.fill();
    ctx.strokeStyle = '#a58d5b66'; ctx.lineWidth = 2; ctx.stroke();
    const button = (label: string, action: string, x: number, y: number, w: number, h: number, primary = false) => {
      ctx.fillStyle = primary ? '#c8b07d' : '#20383c'; ctx.beginPath(); ctx.roundRect(x, y, w, h, 10); ctx.fill();
      ctx.strokeStyle = primary ? '#e3cb93' : '#728d7255'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = primary ? '#183033' : '#d0dbc9'; ctx.font = '23px Arial'; ctx.textAlign = 'center'; ctx.fillText(label, x + w / 2, y + h / 2 + 8);
      this.regions.push({ x, y, w, h, action });
    };
    ctx.textAlign = 'left'; ctx.fillStyle = COURT[this.role].color; ctx.font = '24px Arial'; ctx.fillText(`${COURT[this.role].name.toUpperCase()} · ${COURT[this.role].title.toUpperCase()}`, 40, 54);
    ctx.textAlign = 'right'; ctx.fillStyle = '#8aa292'; ctx.font = '18px Arial'; ctx.fillText(this.mode, 1360, 53);
    if(this.setup&&!this.composer){
      ctx.textAlign='left';ctx.fillStyle='#ede5d4';ctx.font='34px Georgia';ctx.fillText(this.setup.title,48,120);
      ctx.fillStyle='#a8baaa';ctx.font='23px Arial';
      const words=this.setup.text.split(' ');let line='',y=169;
      for(const word of words){if(ctx.measureText(line+' '+word).width>1250){ctx.fillText(line,48,y);y+=30;line='';if(y>245)break;}line+=word+' ';}if(y<=245)ctx.fillText(line,48,y);
      this.setup.choices.forEach((choice,i)=>button(choice.label,'setup:'+choice.action,48+(i%2)*660,280+Math.floor(i/2)*74,640,64,i===0));
    }else if(this.settings){
      ctx.textAlign='left';ctx.fillStyle='#ede5d4';ctx.font='36px Georgia';ctx.fillText('Your court settings',48,132);
      ctx.fillStyle='#9fb49d';ctx.font='24px Arial';ctx.fillText('Choose a brain for the selected character, adjust sound, or recenter.',48,194);
      button('Open this brain',`brain-open:${this.role}`,48,280,410,72,true);
      button('Quiet / sound','mute',480,280,410,72);button('Center throne','recenter',912,280,440,72);
      button('Restart guide','restart-guide',48,450,410,64);button('Profile / mode','setup-open',480,450,410,64);button('Close settings','settings-close',912,450,440,64);
    }else if(this.codeFiles){
      const names=Object.keys(this.codeFiles), name=names[this.codeFile];
      const lines=(this.codeFiles[name]||'').split('\n').flatMap(line=>line.match(/.{1,100}/g)||['']);
      this.codePage=Math.min(this.codePage,Math.max(0,Math.ceil(lines.length/13)-1));
      ctx.textAlign='left';ctx.fillStyle='#dfc48b';ctx.font='24px monospace';ctx.fillText(`${name} — page ${this.codePage+1}`,48,100);
      ctx.fillStyle='#e0e5da';ctx.font='19px monospace';
      lines.slice(this.codePage*13,this.codePage*13+13).forEach((line,i)=>ctx.fillText(line,48,137+i*27));
      button('Previous','code:back',48,510,260,60);button('Next','code:next',328,510,260,60);
      button('Change file','code:file',608,510,330,60);button('Close code','code:close',958,510,390,60);
    } else if (this.composer) {
      ctx.fillStyle = '#0b1a20'; ctx.beginPath(); ctx.roundRect(38, 79, 1324, 78, 12); ctx.fill();
      ctx.textAlign = 'left'; ctx.fillStyle = this.input ? '#e7e7d7' : '#6d8b7e'; ctx.font = '29px Arial'; ctx.fillText((this.input || `Tell ${COURT[this.role].name} what you have in mind…`).slice(-85), 60, 128);
      const rows = ['1234567890-_', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm/\\:.'];
      rows.forEach((row, rowIndex) => {
        const offset = (1400 - row.length * 112) / 2;
        [...row].forEach((key, i) => button(this.upper ? key.toUpperCase() : key, `key:${key}`, offset + i * 112, 181 + rowIndex * 66, 100, 54));
      });
      button('Shift', 'key:shift', 60, 457, 170, 52); button('Space', 'key:space', 250, 457, 590, 52); button('Delete', 'key:backspace', 860, 457, 210, 52); button('Clear', 'clear', 1090, 457, 250, 52);
      button('Back to the court', 'close-composer', 60, 532, 380, 48); button('Send your instruction ↗', 'send', 800, 532, 540, 48, true);
    } else {
      ctx.textAlign = 'left'; ctx.fillStyle = '#e8e5d6'; ctx.font = '34px Georgia';
      const words = this.text.split(/\s+/); let line = '', y = 120;
      for (const word of words) {
        if (ctx.measureText(`${line} ${word}`).width > 1270) { ctx.fillText(line.trim(), 48, y); y += 45; line = ''; if (y > 275) break; }
        line += `${word} `;
      }
      if (y <= 275) ctx.fillText(line.trim(), 48, y);
      if (this.proposal.length) {
        ctx.font = '23px Arial'; ctx.fillStyle = '#a3b79f';
        this.proposal.forEach((item, i) => ctx.fillText(`◇  ${item.slice(0, 95)}`, 48, 325 + i * 37));
        button('Approve this plan', 'approve', 48, 461, 410, 62, true);
        button('Change the plan', 'write', 480, 461, 410, 62);
        button('Ask a question', 'talk', 912, 461, 440, 62);
        button('Quiet', 'mute', 48, 540, 180, 42);
        button('Leave VR', 'exit', 1112, 540, 240, 42);
      } else {
        button('●  Speak to me', 'talk', 48, 344, 410, 76, true);
        button('Write an instruction', 'write', 480, 344, 410, 76);
        button(this.tourContinue?'Continue guide':'Review our work', this.tourContinue?'tour-continue':'preview', 912, 344, 440, 76);
        button('Hear that again', 'repeat', 48, 456, 340, 66);
        button('Quiet', 'mute', 410, 456, 270, 66);
        button('Center court', 'recenter', 702, 456, 310, 66);
        button('Leave VR', 'exit', 1034, 456, 318, 66);
      }
      ctx.fillStyle = '#6c8b7c'; ctx.font = '17px Arial'; ctx.textAlign = 'center'; ctx.fillText(this.proposal.length ? 'POINT AT A CHARACTER TO ADDRESS THEM' : 'POINT AT A CHARACTER TO ADDRESS THEM  ·  PINCH TO SELECT', 700, 569);
    }
    this.texture.needsUpdate = true;
  }
}
