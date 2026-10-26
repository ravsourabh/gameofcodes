import * as THREE from 'three';
import {EnvironmentAssets} from './environment-assets';

export function conferenceSeat(index:number,count:number){
  const angle=(index-(count-1)/2)*Math.min(.55,1.9/Math.max(1,count-1));
  const position=new THREE.Vector3(Math.sin(angle)*2.45,0,-2.65-Math.cos(angle)*1.65);
  return {position,yaw:Math.atan2(-position.x,-2.65-position.z)};
}
export class Roundtable {
  readonly group=new THREE.Group();private chairs:THREE.Group[]=[];private board:THREE.Mesh;private canvas=document.createElement('canvas');private texture:THREE.CanvasTexture;private boardKey='';
  constructor(assets:EnvironmentAssets){
    this.group.name='Roundtable conference';
    this.canvas.width=1400;this.canvas.height=360;this.texture=new THREE.CanvasTexture(this.canvas);this.texture.colorSpace=THREE.SRGBColorSpace;this.board=assets.mesh(this.group,new THREE.PlaneGeometry(5.2,1.34),new THREE.MeshBasicMaterial({map:this.texture,toneMapped:false}),0,2.08,-5.4);
    const top=assets.mesh(this.group,new THREE.CylinderGeometry(1,1,.095,64),assets.wood,0,.765,-2.65);top.scale.set(2.12,1,1.37);
    const rim=assets.mesh(this.group,new THREE.TorusGeometry(1,.016,6,64),assets.brass,0,.82,-2.65);rim.rotation.x=Math.PI/2;rim.scale.set(2.1,1.36,1);
    for(const x of [-1.1,1.1]){assets.mesh(this.group,new THREE.CylinderGeometry(.12,.2,.7,12),assets.iron,x,.35,-2.65);assets.mesh(this.group,new THREE.BoxGeometry(.85,.06,.8),assets.wood,x,.04,-2.65);}
    for(let i=0;i<5;i++){
      const chair=new THREE.Group();chair.name='Conference seat '+(i+1);this.group.add(chair);this.chairs.push(chair);
      assets.mesh(chair,new THREE.BoxGeometry(.61,.1,.62),assets.leather,0,.47,0);
      assets.mesh(chair,new THREE.BoxGeometry(.61,.76,.085),assets.leather,0,.86,-.29);
      for(const x of [-.25,.25])for(const z of [-.24,.24])assets.mesh(chair,new THREE.CylinderGeometry(.025,.035,.45,8),assets.wood,x,.225,z);
      for(const x of [-.33,.33]){assets.mesh(chair,new THREE.BoxGeometry(.045,.045,.48),assets.wood,x,.72,.02);assets.mesh(chair,new THREE.BoxGeometry(.035,.2,.035),assets.wood,x,.62,.18);}
      assets.batch(chair);
    }
  }
  update(count:number,visible:boolean,room='conference',title='Your roundtable',tone='serious'){
    this.group.visible=visible;const key=room+title+tone;if(key!==this.boardKey){this.boardKey=key;const ctx=this.canvas.getContext('2d')!,labels:Record<string,string>={conference:'THE ROUNDTABLE',heated:'THE HEATED PANEL',comedy:'THE COMEDY ROOM',newsroom:'THE NEWS DESK'},colours:Record<string,string>={conference:'#153f3c',heated:'#641d29',comedy:'#492965',newsroom:'#112d57'};ctx.fillStyle=colours[room]||colours.conference;ctx.fillRect(0,0,1400,360);ctx.fillStyle='#efce92';ctx.font='28px sans-serif';ctx.fillText('AI CHARACTERS · '+(labels[room]||labels.conference),60,64);ctx.fillStyle='#fff7e8';ctx.font='46px sans-serif';ctx.fillText(title.slice(0,51),60,153);ctx.fillStyle='#c3d6df';ctx.font='29px sans-serif';ctx.fillText(tone==='satire'?'FICTIONAL SATIRE':tone==='mixed'?'ANALYSIS · HUMOUR · LABELLED SATIRE':tone==='funny'?'A PLAYFUL CONVERSATION':room==='heated'?'FORCEFUL VIEWS · BOUNDED CUT-INS':'CLAIMS · QUESTIONS · PERSPECTIVES',60,226);ctx.font='22px sans-serif';ctx.fillText('Your premise. Distinct voices. Listen, challenge, respond.',60,306);this.texture.needsUpdate=true;}
    this.chairs.forEach((chair,i)=>{chair.visible=i<count;if(i<count){const seat=conferenceSeat(i,count);chair.position.copy(seat.position);chair.rotation.y=seat.yaw;}});
  }
}
