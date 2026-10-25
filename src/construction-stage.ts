import * as THREE from 'three';

export type BuildPhase='queued'|'generating'|'saving'|'checking';

// An abstract construction performance, not a prediction of generated app features.
export class ConstructionStage {
  readonly group=new THREE.Group();
  private blocks:THREE.Mesh[]=[];
  private sparks:THREE.Mesh[]=[];
  private phase:BuildPhase='queued';
  private reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  constructor(){
    this.group.position.set(0,.69,-1.05);this.group.visible=false;
    const gold=new THREE.MeshStandardMaterial({color:0xd6b77a,emissive:0x6b4319,emissiveIntensity:.5,metalness:.5,roughness:.3});
    const teal=new THREE.MeshStandardMaterial({color:0x79c9bd,emissive:0x246f65,emissiveIntensity:.6,roughness:.4});
    const plate=new THREE.Mesh(new THREE.CylinderGeometry(.78,.82,.035,48),new THREE.MeshStandardMaterial({color:0x16393e,metalness:.6,roughness:.4}));
    this.group.add(plate);
    const ring=new THREE.Mesh(new THREE.TorusGeometry(.78,.012,6,48),gold);ring.rotation.x=Math.PI/2;ring.position.y=.04;this.group.add(ring);
    for(let i=0;i<12;i++){
      const block=new THREE.Mesh(new THREE.BoxGeometry(i<3?.32:.2,.09,.13),i%3===0?gold:teal);
      block.position.set((i%3-1)*.29,.16+Math.floor(i/3)*.14,(i%2-.5)*.18);
      block.userData.base=block.position.clone();this.blocks.push(block);this.group.add(block);
    }
    const outline=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.04,.72,.42)),new THREE.LineBasicMaterial({color:0x8cc8be,transparent:true,opacity:.45}));outline.position.y=.42;this.group.add(outline);
    for(let i=0;i<12;i++){const spark=new THREE.Mesh(new THREE.OctahedronGeometry(.023),gold);this.sparks.push(spark);this.group.add(spark);}
  }
  setPhase(phase:BuildPhase|null){this.group.visible=!!phase;if(phase)this.phase=phase;}
  animate(time:number){
    if(!this.group.visible)return;
    const t=this.reduced?0:time;
    this.blocks.forEach((block,i)=>{
      const base=block.userData.base as THREE.Vector3;
      const cycle=(t*.3+i/12)%1;
      const assembling=this.phase==='queued'||this.phase==='generating';
      block.position.copy(base);
      if(assembling){block.position.y+=Math.sin(cycle*Math.PI)*.24;block.rotation.y=Math.sin(t+i)*.15;}
      else block.rotation.y=0;
      block.scale.setScalar(this.phase==='checking'?1+Math.sin(t*2+i*.3)*.025:1);
    });
    this.sparks.forEach((spark,i)=>{const angle=t*.8+i/12*Math.PI*2;spark.position.set(Math.cos(angle)*.65,.2+Math.sin(t+i)*.13,Math.sin(angle)*.4);});
  }
}
