import * as THREE from 'three';
import {EnvironmentAssets} from './environment-assets';

// The court is authored locally. Static architecture is merged by material;
// figures and the small interactive surfaces stay independent.
export function buildThroneCourt(room:THREE.Group,assets:EnvironmentAssets){
  room.name='Throne court';
  const stone=assets.stone,wood=assets.wood,brass=assets.brass,iron=assets.iron;
  const pale=stone.clone();pale.color.set('#c9c2b2');
  const dark=stone.clone();dark.color.set('#626a68');
  const velvet=assets.leather.clone();velvet.color.set('#722e3a');
  const ceiling=new THREE.MeshStandardMaterial({color:'#252d36',roughness:.95});
  const box=(size:number[],at:number[],material:THREE.Material)=>assets.mesh(room,new THREE.BoxGeometry(...size as [number,number,number]),material,...at as [number,number,number]);
  const cylinder=(r:number,h:number,at:number[],material:THREE.Material,segments=12)=>assets.mesh(room,new THREE.CylinderGeometry(r,r,h,segments),material,...at as [number,number,number]);
  const ring=(radius:number,width:number,x:number,y:number,z:number)=>{const m=assets.mesh(room,new THREE.RingGeometry(radius-width,radius,80),brass,x,y,z);m.rotation.x=-Math.PI/2;};
  const rib=(a:THREE.Vector3,b:THREE.Vector3,c:THREE.Vector3,r=.09)=>{const path=new THREE.QuadraticBezierCurve3(a,b,c);assets.mesh(room,new THREE.TubeGeometry(path,18,r,6,false),pale,0,0,0);};
  box([16,.2,24],[0,-.13,-3],dark);box([16,8,.4],[0,4,-10],stone);
  box([16,.25,24],[0,8,-3],ceiling);
  // The stepped floor, radial inlay and carpet establish the sovereign's seat.
  cylinder(2.05,.15,[0,-.02,2.6],pale,64);ring(1.98,.025,0,.061,2.6);
  box([1.55,.018,7.4],[0,.005,-1.0],velvet);
  for(const x of [-.81,.81])box([.018,.02,7.4],[x,.012,-1],brass);
  cylinder(3.18,.06,[0,-.015,-2.6],pale,80);ring(3.16,.025,0,.021,-2.6);ring(2.97,.012,0,.023,-2.6);
  for(let i=0;i<16;i++){const a=i*Math.PI/8,m=box([.018,.008,.16],[Math.sin(a)*3.07,.028,-2.6+Math.cos(a)*3.07],brass);m.rotation.y=a;}
  // An empty central seal is the presenter zone. No fabricated presenters or ratings.
  ring(.62,.025,0,.027,-2.3);ring(.7,.009,0,.028,-2.3);
  for(const side of [-1,1]){
    box([.4,8,24],[side*7.7,4,-3],stone);
    box([.18,.3,24],[side*7.39,1,-3],pale);
    for(const z of [-7,-2,3]){
      const x=side*5.7;
      box([1.08,.23,1.08],[x,.1,z],dark);box([.87,.18,.87],[x,.3,z],pale);
      cylinder(.32,5.25,[x,2.99,z],pale);cylinder(.43,.19,[x,.49,z],dark);cylinder(.46,.21,[x,5.64,z],pale);
      for(const dz of [-.23,.23])box([.08,5.1,.08],[x,3,z+dz],stone);
      rib(new THREE.Vector3(x,5.7,z),new THREE.Vector3(side*3.1,7.7,z),new THREE.Vector3(0,7.9,z));
      assets.lantern(room,x-side*.46,2.55,z);
      // Side aisles sit behind the colonnade rather than crowding the discussion.
      box([1.4,.48,.5],[side*6.65,.26,z+.75],wood);
      box([1.4,.62,.1],[side*6.65,.72,z+.98],wood);
    }
    for(const z of [-7,-2,3]){
      const window=new THREE.Group();window.position.set(side*7.45,3.6,z);window.rotation.y=-side*Math.PI/2;room.add(window);
      const glass=new THREE.MeshBasicMaterial({color:side<0?'#7693b4':'#caa47b',transparent:true,opacity:.8});
      assets.mesh(window,new THREE.PlaneGeometry(1.7,2.8),glass,0,.25,0);
      for(const x of [-.87,0,.87])assets.mesh(window,new THREE.BoxGeometry(.055,3,.08),iron,x,.25,.02);
      for(const y of [-1.12,-.2,.8,1.72])assets.mesh(window,new THREE.BoxGeometry(1.8,.055,.08),iron,0,y,.02);
    }
    // Long heraldic banners frame the central apse.
    box([1.05,2.75,.055],[side*3.15,3.75,-9.7],velvet);
    box([1.25,.08,.15],[side*3.15,5.16,-9.6],brass);
    const emblem=assets.mesh(room,new THREE.TorusGeometry(.25,.025,6,4),brass,side*3.15,4.1,-9.62);emblem.rotation.z=Math.PI/4;
    box([.035,.9,.04],[side*3.15,4.07,-9.57],brass);
  }
  // The rose and pointed ribs make a legible focal point beyond the cast.
  const rose=assets.mesh(room,new THREE.CircleGeometry(1.52,64),ceiling,0,4.6,-9.74);
  for(let i=0;i<12;i++){
    const mat=new THREE.MeshBasicMaterial({color:['#657c9b','#af805f','#a9ac94'][i%3]});
    const pane=assets.mesh(room,new THREE.RingGeometry(.34,1.43,1,1,i*Math.PI/6+.025,Math.PI/6-.05),mat,0,4.6,-9.69);
    pane.name='Rose glass';
  }
  assets.mesh(room,new THREE.TorusGeometry(1.52,.11,8,64),pale,0,4.6,-9.6);
  assets.mesh(room,new THREE.TorusGeometry(.31,.04,6,32),brass,0,4.6,-9.61);
  rib(new THREE.Vector3(-2.15,1.3,-9.55),new THREE.Vector3(-2.35,6.2,-9.55),new THREE.Vector3(0,7,-9.55),.15);
  rib(new THREE.Vector3(2.15,1.3,-9.55),new THREE.Vector3(2.35,6.2,-9.55),new THREE.Vector3(0,7,-9.55),.15);
  box([3.5,.2,1.5],[0,.08,-8.65],dark);
  // Waiting bay, lectern and a real throne behind the seated viewpoint.
  box([1.8,.12,.62],[3.65,.51,-5.6],wood);box([1.8,.65,.12],[3.65,.88,-5.89],wood);
  for(const x of [2.86,4.44])box([.1,.48,.5],[x,.25,-5.6],wood);
  box([.48,.85,.38],[3.15,.48,-4.7],wood);const top=box([.75,.08,.52],[3.15,.94,-4.7],wood);top.rotation.x=.16;
  box([.69,.018,.05],[3.15,.93,-4.42],brass);
  box([1.35,.24,1],[0,.42,3.05],wood);box([1.12,.13,.83],[0,.6,3],velvet);
  box([1.45,2.35,.2],[0,1.59,3.53],wood);box([1.08,1.9,.06],[0,1.57,3.39],velvet);
  for(const side of [-1,1]){
    box([.16,1.25,1.28],[side*.79,.57,2.98],wood);box([.24,.1,1.3],[side*.79,1.2,2.95],brass);
    cylinder(.075,2.8,[side*.78,1.52,3.53],brass);
    assets.mesh(room,new THREE.ConeGeometry(.14,.3,6),brass,side*.78,3.05,3.53);
  }
  // Warm lamps supplement the cool architectural daylight without dynamic shadows.
  for(const x of [-3.9,3.9]){assets.lantern(room,x,1.65,-6);const light=new THREE.PointLight('#ffba75',7,7,2);light.position.set(x,2,-5.8);room.add(light);}
  rose.name='Court rose';
  assets.batch(room);
}
