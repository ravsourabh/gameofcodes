import * as THREE from 'three';
import {SHOW_TITLE,SHOW_TAGLINE} from '../shared/studio/show.mjs';
export {SHOW_TITLE,SHOW_TAGLINE};
const FONT='"Bawaal Devanagari", "Nirmala UI", sans-serif';
const PAGE_MS=8500,TRANSITION_MS=500;

// Physical set surfaces shared by desktop, the headset and exports.
// Their animation uses the programme clock when a recording is playing.
export class StudioBranding{
  readonly group=new THREE.Group();
  private canvas=document.createElement('canvas');
  private topicCanvas=document.createElement('canvas');
  private header=new THREE.CanvasTexture(this.canvas);
  private topic=new THREE.CanvasTexture(this.topicCanvas);
  private textures:THREE.Texture[]=[this.header,this.topic];
  private context:CanvasRenderingContext2D;
  private topicContext:CanvasRenderingContext2D;
  private premise='';private pages:string[][]=[];private last=-Infinity;private key='';private failure='';
  private ready:Promise<void>;private topicFontSize=44;private topicLineHeight=62;
  private deskLED:THREE.ShaderMaterial|null=null;

  constructor(){
    this.canvas.width=this.topicCanvas.width=2048;this.canvas.height=144;this.topicCanvas.height=180;
    this.context=this.canvas.getContext('2d')!;this.topicContext=this.topicCanvas.getContext('2d')!;
    for(const texture of this.textures){texture.colorSpace=THREE.SRGBColorSpace;texture.minFilter=THREE.LinearFilter;texture.generateMipmaps=false;}
    this.plane(this.header,4.08,.287,[0,4.03,-4.13]);
    this.plane(this.topic,4.08,.36,[0,2.01,-4.13]);
    const loader=new THREE.TextureLoader();
    const image=async(path:string)=>{const texture=await loader.loadAsync(path);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;this.textures.push(texture);return texture;};
    this.ready=Promise.all([
      image('/branding/baat-ka-bawaal/logo.png').then(texture=>{
        for(const x of [-3.35,3.35])this.wallSign(texture,x);
      }),
      image('/branding/baat-ka-bawaal/desk-led.png').then(texture=>this.deskDisplay(texture)),
      new FontFace('Bawaal Devanagari','url(/fonts/NotoSansDevanagari.ttf)',{weight:'100 900'}).load().then(font=>{document.fonts.add(font);this.paginate();this.last=-Infinity;})
    ]).then(()=>{this.tick(0,true);}).catch(error=>{this.failure=String(error);});
    this.setTopic('');
  }

  private plane(texture:THREE.Texture,width:number,height:number,at:[number,number,number],transparent=false){
    const material=new THREE.MeshBasicMaterial({map:texture,transparent,toneMapped:false,depthWrite:!transparent});
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,height),material);mesh.position.set(...at);this.group.add(mesh);return mesh;
  }

  private wallSign(texture:THREE.Texture,x:number){
    const sign=new THREE.Group();sign.name='wall-mounted-show-sign';sign.position.set(x,3.18,0);this.group.add(sign);
    const box=(width:number,height:number,depth:number,at:[number,number,number],colour:number,metalness=.35)=>{
      const mesh=new THREE.Mesh(new THREE.BoxGeometry(width,height,depth),new THREE.MeshStandardMaterial({color:colour,metalness,roughness:.4}));mesh.position.set(...at);sign.add(mesh);
    };
    // The rails reach the rear wall (front face z=-4.5). A deep frame and an
    // opaque navy face make this an installed sign from oblique cameras too.
    for(const side of [-1,1])box(.09,.92,.28,[side*.64,0,-4.36],0x182331);
    box(1.98,1.10,.06,[0,0,-4.30],0x101923);
    box(1.94,1.06,.12,[0,0,-4.23],0x9a7a55,.65);
    box(1.84,.96,.025,[0,0,-4.158],0x091b30,.15);
    box(1.78,.025,.008,[0,-.44,-4.14],0xb92c36);
    const logo=new THREE.Mesh(new THREE.PlaneGeometry(1.67,.835),new THREE.MeshBasicMaterial({map:texture,transparent:true,toneMapped:false,depthWrite:false}));logo.position.set(0,.01,-4.14);sign.add(logo);
    for(const sx of [-1,1])for(const sy of [-1,1]){
      const screw=new THREE.Mesh(new THREE.CylinderGeometry(.013,.013,.014,8),new THREE.MeshStandardMaterial({color:0xd4c5a9,metalness:.8,roughness:.28}));screw.rotation.x=Math.PI/2;screw.position.set(sx*.935,sy*.49,-4.16);sign.add(screw);
    }
  }

  private deskDisplay(texture:THREE.Texture){
    const backing=new THREE.Mesh(new THREE.BoxGeometry(4.10,.62,.035),new THREE.MeshStandardMaterial({color:0x0a1726,metalness:.55,roughness:.3}));backing.position.set(0,.43,-1.25);this.group.add(backing);
    this.deskLED=new THREE.ShaderMaterial({
      uniforms:{art:{value:texture},clock:{value:0},motion:{value:1}},toneMapped:false,
      vertexShader:`varying vec2 panelUV; void main(){panelUV=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
      fragmentShader:`uniform sampler2D art;uniform float clock;uniform float motion;varying vec2 panelUV;
        void main(){
          vec2 uv=panelUV;
          vec3 colour=texture2D(art,vec2(uv.x,mix(.20,.80,uv.y))).rgb;
          float travel=mod(clock*.13,1.55)-.25;
          float sweep=exp(-pow((uv.x-travel+.16*(uv.y-.5))/.055,2.0));
          float rim=pow(abs(uv.y-.5)*2.0,12.0);
          float streak=exp(-pow((uv.x-mod(clock*.19,1.3)+.15)/.11,2.0))*rim;
          colour+=motion*(vec3(.11,.065,.018)*sweep+vec3(.24,.055,.015)*streak);
          gl_FragColor=vec4(colour,1.0);
          #include <colorspace_fragment>
        }`
    });
    const display=new THREE.Mesh(new THREE.PlaneGeometry(4.08,.60),this.deskLED);display.name='full-width-animated-desk-display';display.position.set(0,.43,-1.229);this.group.add(display);
  }

  async readyForExport(){await this.ready;if(this.failure)throw new Error('The show branding could not load. Reload before exporting.');}

  setTopic(premise:string){
    const clean=premise.replace(/\s+/gu,' ').trim();if(clean===this.premise&&this.pages.length)return;
    this.premise=clean;this.paginate();this.last=-Infinity;this.tick(0,true);
  }

  private paginate(){
    const context=this.topicContext,text=this.premise||SHOW_TAGLINE;
    const wrap=(size:number)=>{context.font=`700 ${size}px ${FONT}`;const lines:string[]=[];let line='';const flush=()=>{if(line){lines.push(line);line='';}};
      for(const word of text.split(' ')){const candidate=line?line+' '+word:word;if(context.measureText(candidate).width<=1640){line=candidate;continue;}flush();for(const {segment} of new Intl.Segmenter('hi',{granularity:'grapheme'}).segment(word)){if(line&&context.measureText(line+segment).width>1640)flush();line+=segment;}}flush();return lines;};
    let lines:string[]=[];
    // Choose the largest real-font fit, including Devanagari vowel marks.
    for(let size=108;size>=44;size-=2){const candidate=wrap(size),height=Math.max(...candidate.map(line=>{const m=context.measureText(line);return m.actualBoundingBoxAscent+m.actualBoundingBoxDescent;}),size),lineHeight=Math.max(size*1.12,height+8);if(candidate.length<=2&&height+(candidate.length-1)*lineHeight<=144||size===44){this.topicFontSize=size;this.topicLineHeight=lineHeight;lines=candidate;break;}}
    this.pages=[];for(let i=0;i<lines.length;i+=2)this.pages.push(lines.slice(i,i+2));if(!this.pages.length)this.pages=[[SHOW_TAGLINE]];
  }

  tick(timeMs:number,reducedMotion=false,force=false){
    if(this.deskLED){this.deskLED.uniforms.clock.value=Math.max(0,timeMs)/1000;this.deskLED.uniforms.motion.value=reducedMotion?0:1;}
    const time=Math.max(0,timeMs);if(!force&&!reducedMotion&&time-this.last>=0&&time-this.last<32)return;
    const index=Math.floor(time/PAGE_MS)%this.pages.length;
    const phase=time%PAGE_MS,slide=!reducedMotion&&this.pages.length>1&&phase>PAGE_MS-TRANSITION_MS?(phase-(PAGE_MS-TRANSITION_MS))/TRANSITION_MS:0;
    const state=JSON.stringify({show:SHOW_TITLE,topic:this.premise||SHOW_TAGLINE,page:index+1,pages:this.pages.length,label:'BREAKING NEWS',fontSize:this.topicFontSize,reducedMotion});
    if(reducedMotion&&state===this.key)return;this.key=state;this.last=time;
    this.drawHeader(reducedMotion?0:time);
    const c=this.topicContext;c.fillStyle='#07182d';c.fillRect(0,0,2048,180);
    c.fillStyle='#ebbb66';c.fillRect(0,0,286,180);c.fillStyle='#172338';c.font=`800 39px ${FONT}`;c.textAlign='center';c.textBaseline='middle';c.fillText('आज का',143,62);c.fillText('मुद्दा',143,116);
    c.save();c.beginPath();c.rect(310,8,1710,155);c.clip();c.fillStyle='#fff4de';c.font=`700 ${this.topicFontSize}px ${FONT}`;c.textAlign='left';c.textBaseline='alphabetic';
    const draw=(page:number,offset:number)=>{const lines=this.pages[page],metrics=lines.map(line=>c.measureText(line)),ascent=Math.max(...metrics.map(m=>m.actualBoundingBoxAscent)),descent=Math.max(...metrics.map(m=>m.actualBoundingBoxDescent)),height=ascent+descent+(lines.length-1)*this.topicLineHeight,baseline=(174-height)/2+ascent;lines.forEach((line,i)=>c.fillText(line,328,offset+baseline+i*this.topicLineHeight));};
    const ease=slide*slide*(3-2*slide);draw(index,-ease*180);if(slide)draw((index+1)%this.pages.length,180-ease*180);c.restore();
    c.fillStyle='#d72e33';c.fillRect(0,174,2048,6);c.fillStyle='#ebbb66';c.fillRect(286,174,1762*(index+1)/this.pages.length,6);
    this.header.needsUpdate=true;this.topic.needsUpdate=true;document.body.dataset.studioBranding=state;
  }

  private drawHeader(time:number){
    const c=this.context;c.fillStyle='#981c2b';c.fillRect(0,0,2048,144);
    const stripe=c.createLinearGradient(0,0,2048,144);stripe.addColorStop(0,'#d72834');stripe.addColorStop(1,'#921929');c.fillStyle=stripe;c.fillRect(585,0,1463,144);
    c.fillStyle='#fff2dc';c.font='900 57px Arial, sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText('BREAKING NEWS',293,75);
    c.save();c.beginPath();c.rect(620,0,1400,144);c.clip();c.textAlign='left';c.font=`800 56px ${FONT}`;
    const text=`${SHOW_TITLE}    •    ${SHOW_TAGLINE}    •    `,width=c.measureText(text).width,offset=(time*.045)%width;
    for(let x=650-offset;x<2048;x+=width)c.fillText(text,x,78);c.restore();c.fillStyle='#f0c77b';c.fillRect(0,0,2048,5);c.fillRect(0,139,2048,5);
  }

  dispose(){this.group.traverse(object=>{if(object instanceof THREE.Mesh){object.geometry.dispose();object.material.dispose();}});this.group.clear();this.textures.forEach(texture=>texture.dispose());}
}
