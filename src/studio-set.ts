import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// A complete room around the broadcast stage. Static pieces are batched by
// material; no live reflections, shadow maps or additional real-time lights.
export class StudioSet{
  readonly group=new THREE.Group();
  private materials:THREE.Material[]=[];
  private textures:THREE.Texture[]=[];
  constructor(){
    this.group.name='complete-broadcast-studio';
    const batches=new Map<THREE.Material,THREE.BufferGeometry[]>();
    const material=(colour:string,metalness=.15,roughness=.65)=>{const m=new THREE.MeshStandardMaterial({color:colour,metalness,roughness});this.materials.push(m);return m;};
    const luminous=(colour:string)=>{const m=new THREE.MeshBasicMaterial({color:colour,toneMapped:false});this.materials.push(m);return m;};
    const navy=material('#102337'),inset=material('#08121f'),slate=material('#2c4050'),metal=material('#3d5260',.7,.35),floor=material('#101b27',.3,.4),stage=material('#263b4b',.4,.36),gold=material('#ad8350',.7,.36),black=material('#090e16'),warm=luminous('#efc28e'),blue=luminous('#559caf'),red=luminous('#c84140');
    const add=(geometry:THREE.BufferGeometry,m:THREE.Material,at:THREE.Vector3,scale=new THREE.Vector3(1,1,1),rotation=new THREE.Euler())=>{geometry.applyMatrix4(new THREE.Matrix4().compose(at,new THREE.Quaternion().setFromEuler(rotation),scale));const list=batches.get(m)||[];list.push(geometry);batches.set(m,list);};
    const box=(size:[number,number,number],at:[number,number,number],m:THREE.Material,rotationY=0)=>add(new THREE.BoxGeometry(...size),m,new THREE.Vector3(...at),undefined,new THREE.Euler(0,rotationY,0));
    const tube=(from:THREE.Vector3,to:THREE.Vector3,radius:number,m:THREE.Material)=>{const direction=to.clone().sub(from),geometry=new THREE.CylinderGeometry(radius,radius,direction.length(),6);geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize()));add(geometry,m,from.clone().add(to).multiplyScalar(.5));};
    // Full-height shell extends behind the fly-in/fly-out camera. Every view
    // remains inside the room instead of exposing the backs of scenery flats.
    box([20,.16,20],[0,-.32,3.3],floor);
    box([20,7,.24],[0,3.25,-4.65],navy);
    for(const side of [-1,1])box([.24,7,20],[side*9.9,3.25,3.3],navy);
    box([20,7,.24],[0,3.25,13.2],inset);
    box([20,.18,20],[0,6.78,3.3],inset);
    // Architectural returns, backed acoustic panels and grounded perimeter.
    for(const side of [-1,1]){
      box([.24,5.8,12.8],[side*6.45,2.65,1.75],navy);
      box([.035,.065,12.8],[side*6.30,.12,1.75],blue);
      for(let z=-4;z<8;z+=1.15){box([.10,3.5,.78],[side*6.28,2.25,z],inset);box([.055,3.5,.045],[side*6.20,2.25,z-.37],metal);}
      for(const z of [-4.1,1.6,7.7]){box([.38,5.7,.38],[side*6.15,2.6,z],slate);box([.025,4.6,.045],[side*5.94,2.6,z+.21],warm);}
      // A visible return joins each rear panel to the side architecture.
      box([1.9,5.7,.20],[side*5.35,2.6,-4.40],inset);
      for(let n=0;n<6;n++)box([.055,3.3,.12],[side*(4.60+n*.29),2.25,-4.25],metal);
    }
    for(let i=-5;i<=5;i++){box([.038,3.9,.06],[i*.70,2.15,-4.49],i%2?metal:gold);}
    box([4.34,2.60,.15],[0,3.0,-4.39],black);
    for(const x of [-3.8,3.8]){box([1.02,2.2,.10],[x,2.05,-4.38],slate);for(let i=0;i<4;i++)box([.90,.024,.12],[x,1.2+i*.55,-4.29],blue);}
    box([11.8,.18,.32],[0,5.14,-4.22],slate);box([11.5,.035,.035],[0,5.04,-4.02],warm);
    box([8.7,.055,.10],[0,4.57,-4.23],warm);box([11.8,.10,.20],[0,.08,-4.28],metal);

    // Raised elliptical stage keeps the existing cast at its established floor
    // height. Two front treads and edge inlays give the wide shot a foreground.
    add(new THREE.CylinderGeometry(1,1.012,.22,72),stage,new THREE.Vector3(0,-.12,-1.25),new THREE.Vector3(5.8,1,3.15));
    add(new THREE.CylinderGeometry(1.005,1.005,.035,72,1,true),blue,new THREE.Vector3(0,-.075,-1.25),new THREE.Vector3(5.8,1,3.15));
    add(new THREE.RingGeometry(.991,1,72),gold,new THREE.Vector3(0,-.008,-1.25),new THREE.Vector3(5.71,3.07,1),new THREE.Euler(-Math.PI/2,0,0));
    box([5.0,.10,.45],[0,-.15,1.99],slate);box([5.15,.06,.42],[0,-.21,2.40],metal);
    box([4.8,.012,.035],[0,-.094,2.16],warm);
    // Restrained floor inlays and tile seams: depth, not a distracting grid.
    for(let x=-8;x<=8;x+=2)box([.012,.003,16],[x,-.238,4.0],slate);
    for(let z=-3;z<=12;z+=2)box([17,.003,.012],[0,-.237,z],slate);
    for(const x of [-4.8,4.8]){box([.045,.004,5.2],[x,-.234,5.5],gold);box([.012,.004,5.2],[x+.12,-.234,5.5],blue);}

    // Production alcoves stay off the presentation axis. Their low worktops
    // and fixed monitors read as part of a working studio in establishing shots.
    const monitorCanvas=document.createElement('canvas');monitorCanvas.width=1024;monitorCanvas.height=512;
    const c=monitorCanvas.getContext('2d')!;c.fillStyle='#061626';c.fillRect(0,0,1024,512);c.fillStyle='#dbab70';c.fillRect(32,32,10,34);c.font='600 29px Arial';c.fillText('STUDIO 01  /  LIVE DESK',60,59);
    for(let i=0;i<5;i++){const x=32+i*198;c.fillStyle=i===0?'#9e2636':'#15394d';c.fillRect(x,100,180,124);c.fillStyle='#70a5b2';for(let n=0;n<9;n++)c.fillRect(x+10+n*18,204-(n%3)*14,9,10+(n%3)*14);}
    c.strokeStyle='#467486';c.lineWidth=2;c.beginPath();for(let n=0;n<130;n++){const x=32+n*7.4,y=335+Math.sin(n*.45)*18+Math.sin(n*.13)*25;n?c.lineTo(x,y):c.moveTo(x,y);}c.stroke();c.fillStyle='#bfd6dc';c.font='20px Arial';c.fillText('PROGRAMME                         PREVIEW                         AUDIO',32,450);
    const monitorTexture=new THREE.CanvasTexture(monitorCanvas);monitorTexture.colorSpace=THREE.SRGBColorSpace;this.textures.push(monitorTexture);
    const monitorMaterial=new THREE.MeshBasicMaterial({map:monitorTexture,toneMapped:false});this.materials.push(monitorMaterial);
    for(const side of [-1,1]){
      const x=side*5.1;box([1.50,.18,.7],[x,.88,-3.15],slate);box([1.36,.74,.56],[x,.42,-3.20],inset);box([1.12,.025,.27],[x,.985,-2.99],black);
      box([1.50,.84,.11],[x,1.63,-3.43],metal);box([1.40,.74,.02],[x,1.63,-3.36],monitorMaterial);box([.10,.35,.10],[x,1.06,-3.44],metal);
      box([.12,.04,.025],[x+.55,1.30,-3.337],red);
    }

    // Visible overhead grid, softboxes and practical light troughs. Fixtures
    // are geometric light sources; existing face lighting remains consistent.
    for(const z of [-3.7,-.6,3.2,7.4]){
      for(const x of [-6.2,6.2])tube(new THREE.Vector3(x,5.75,z),new THREE.Vector3(x,6.65,z),.022,metal);
      for(const y of [5.72,6.0])tube(new THREE.Vector3(-6.3,y,z),new THREE.Vector3(6.3,y,z),.03,metal);
      for(let x=-6;x<6;x+=.8)tube(new THREE.Vector3(x,5.72,z),new THREE.Vector3(x+.8,6,z),.016,metal);
    }
    for(const x of [-4,0,4])for(const z of [-2.9,2.0,6.2]){
      box([1.14,.12,.64],[x,5.57,z],black);box([1.02,.012,.53],[x,5.50,z],warm);box([.06,.25,.06],[x,5.76,z],metal);
    }
    for(const x of [-7.7,7.7]){box([.10,.10,15.8],[x,6.35,3.0],slate);box([.045,.014,15.6],[x,6.29,3.0],warm);}

    // A control-room window and closed entrance complete the reverse headset
    // view too; the camera never peers out into unbuilt background space.
    box([8,2.3,.10],[0,2.15,13.03],metal);box([7.7,2.0,.06],[0,2.15,12.96],black);
    for(let x=-3;x<=3;x+=1.5){box([1.18,.65,.08],[x,1.9,12.89],slate);box([1.08,.55,.02],[x,1.9,12.83],monitorMaterial);}
    box([1.3,2.7,.12],[-6.1,1.1,13.0],slate);box([.055,1.9,.045],[-5.65,1.25,12.9],warm);

    for(const [m,geometries]of batches){const geometry=mergeGeometries(geometries,false)!;geometries.forEach(g=>g.dispose());const mesh=new THREE.Mesh(geometry,m);mesh.name='studio-architecture-'+this.group.children.length;this.group.add(mesh);}
    // A baked contact gradient anchors the desk without expensive live shadows.
    const shadowCanvas=document.createElement('canvas');shadowCanvas.width=256;shadowCanvas.height=128;const s=shadowCanvas.getContext('2d')!,gradient=s.createRadialGradient(128,64,12,128,64,118);gradient.addColorStop(0,'rgba(0,0,0,.40)');gradient.addColorStop(1,'rgba(0,0,0,0)');s.fillStyle=gradient;s.fillRect(0,0,256,128);
    const shadowTexture=new THREE.CanvasTexture(shadowCanvas);this.textures.push(shadowTexture);const shadowMaterial=new THREE.MeshBasicMaterial({map:shadowTexture,transparent:true,depthWrite:false,toneMapped:false});this.materials.push(shadowMaterial);const shadow=new THREE.Mesh(new THREE.PlaneGeometry(5.5,2.5),shadowMaterial);shadow.rotation.x=-Math.PI/2;shadow.position.set(0,.002,-2.0);this.group.add(shadow);
    this.group.userData={revision:1,enclosed:true,staticBatches:batches.size,stageTop:-.01,ceilingHeight:6.69};
  }
  dispose(){this.group.traverse(object=>{if(object instanceof THREE.Mesh)object.geometry.dispose();});this.materials.forEach(m=>m.dispose());this.textures.forEach(t=>t.dispose());this.group.clear();}
}
