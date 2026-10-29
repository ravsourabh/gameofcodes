import * as THREE from 'three';
import type { Character } from '../shared/session-domain.mjs';

const skinColours: Record<string, number> = { porcelain: 0xe9c4ac, sand: 0xd3a181, bronze: 0xb67c55, umber: 0x82543c, ebony: 0x51392f };
const hairColours: Record<string, number> = { ink: 0x24272c, brown: 0x513a2c, auburn: 0x80442e, gold: 0xbb9755, silver: 0xb8b9b0 };
const clothColours: Record<string, number> = { plum: 0x554267, teal: 0x326c68, rust: 0x975d43, navy: 0x354b69, sage: 0x6b7a5c, ivory: 0xb4ad91 };

// Appearance contains only cosmetic choices. No geometry or animation depends on a session role/model.
export class SessionAvatar {
  readonly group = new THREE.Group();
  readonly hitbox: THREE.Mesh;
  readonly featureTargets: THREE.Mesh[] = [];
  private featureRing:THREE.Mesh;
  readonly head = new THREE.Group();
  readonly eyes = new THREE.Group();
  readonly torso = new THREE.Group();
  readonly leftArm = new THREE.Group();
  private ring: THREE.Mesh;
  private label: THREE.Sprite;
  private labelTexture: THREE.CanvasTexture;
  private selectedUntil = 0;
  private phase: number;
  private reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor(readonly character: Character) {
    const a = character.avatar.attributes;
    this.phase = (character.avatar.seed % 1000) / 1000 * Math.PI * 2;
    const skin = new THREE.MeshStandardMaterial({ color: skinColours[a.skin] ?? skinColours.sand, roughness: .85 });
    const cloth = new THREE.MeshStandardMaterial({ color: clothColours[a.colour] ?? clothColours.plum, roughness: .95 });
    const hair = new THREE.MeshStandardMaterial({ color: hairColours[a.hairColour] ?? hairColours.ink, roughness: .92 });
    const gold = new THREE.MeshStandardMaterial({ color: 0xc2a775, roughness: .6, metalness: .25 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x303a38, roughness: .9 });
    const white = new THREE.MeshStandardMaterial({ color: 0xe8e4d7, roughness: .8 });
    const iris = new THREE.MeshStandardMaterial({ color: 0x343f3b, roughness: .75 });
    const mesh = (parent: THREE.Group, geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number, scale?: [number, number, number]) => {
      const part = new THREE.Mesh(geometry, material); part.position.set(x, y, z); if (scale) part.scale.set(...scale); parent.add(part); return part;
    };
    const ball = (parent: THREE.Group, material: THREE.Material, x: number, y: number, z: number, scale: [number, number, number]) => mesh(parent, new THREE.SphereGeometry(1, 14, 10), material, x, y, z, scale);
    for (const side of [-1, 1]) {
      mesh(this.group, new THREE.CapsuleGeometry(.085, .36, 4, 8), dark, side * .13, .29, 0);
      mesh(this.group, new THREE.BoxGeometry(.17, .12, .28), dark, side * .13, .07, .055);
    }
    this.torso.position.y = .95; this.group.add(this.torso);
    if (a.clothes === 'robe') {
      mesh(this.torso, new THREE.CylinderGeometry(.23, .34, .92, 14), cloth, 0, -.16, 0);
      mesh(this.torso, new THREE.BoxGeometry(.035, .65, .02), gold, 0, -.09, .245);
    } else {
      mesh(this.torso, new THREE.CapsuleGeometry(.22, .29, 5, 12), cloth, 0, .03, 0, [1, 1, .7]);
      mesh(this.torso, new THREE.BoxGeometry(.43, a.clothes === 'coat' ? .52 : .25, .26), cloth, 0, a.clothes === 'coat' ? -.21 : -.1, 0);
      if (a.clothes === 'coat') for (const side of [-1, 1]) {
        const lapel = mesh(this.torso, new THREE.BoxGeometry(.08, .31, .04), gold, side * .07, .08, .17); lapel.rotation.z = side * -.2;
      }
    }
    mesh(this.torso, new THREE.CylinderGeometry(.244, .244, .055, 12), dark, 0, -.15, 0, [1, 1, .73]);
    for (const side of [-1, 1]) {
      const arm = side === -1 ? this.leftArm : new THREE.Group(); arm.position.set(side * .28, .22, 0); this.torso.add(arm);
      mesh(arm, new THREE.CapsuleGeometry(.085, .31, 4, 8), cloth, side * .025, -.2, 0);
      ball(arm, skin, side * .035, -.43, .02, [.068, .095, .065]); arm.rotation.z = side * .08;
    }
    mesh(this.torso, new THREE.CylinderGeometry(.075, .085, .15, 10), skin, 0, .37, 0);
    this.head.position.set(0, 1.52, 0); this.group.add(this.head);
    const shape = a.face === 'angular' ? new THREE.IcosahedronGeometry(1, 2) : new THREE.SphereGeometry(1, 18, 14);
    mesh(this.head, shape, skin, 0, 0, 0, a.face === 'round' ? [.205, .215, .17] : a.face === 'angular' ? [.175, .24, .17] : [.18, .245, .17]);
    for (const side of [-1, 1]) {
      ball(this.head, skin, side * .183, -.01, -.005, [.035, .06, .035]);
      ball(this.eyes, white, side * .071, .025, .153, [.039, .031, .022]);
      ball(this.eyes, iris, side * .071, .025, .174, [.019, .023, .008]);
      const brow = mesh(this.head, new THREE.CapsuleGeometry(.009, .055, 3, 6), hair, side * .073, .084, .16); brow.rotation.z = Math.PI / 2 + side * .07;
    }
    this.head.add(this.eyes);
    ball(this.head, skin, 0, -.025, .18, [.025, .042, .032]);
    const smile = new THREE.CatmullRomCurve3([new THREE.Vector3(-.047, -.085, .153), new THREE.Vector3(0, -.096, .17), new THREE.Vector3(.047, -.085, .153)]);
    mesh(this.head, new THREE.TubeGeometry(smile, 10, .005, 5, false), dark, 0, 0, 0);
    if (a.hair !== 'bald') {
      mesh(this.head, new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI * .48), hair, 0, .04, -.012, [.19, .22, .18]);
      if (a.hair === 'swept') {
        const tuft = ball(this.head, hair, .03, .21, .08, [.18, .065, .11]); tuft.rotation.z = -.24;
      }
      if (a.hair === 'bob' || a.hair === 'braids') for (const side of [-1, 1]) {
        if (a.hair === 'bob') ball(this.head, hair, side * .172, -.035, -.075, [.055, .21, .12]);
        else for (let i = 0; i < 6; i++) ball(this.head, hair, side * (.175 + i * .003), .03 - i * .065, -.055, [.037, .047, .038]);
      }
    }
    if (a.beard !== 'none') {
      if (a.beard === 'stubble' || a.beard === 'short') ball(this.head, hair, 0, -.145, .05, [.14, a.beard === 'short' ? .09 : .045, .13]);
      else mesh(this.head, new THREE.ConeGeometry(a.beard === 'goatee' ? .055 : .14, a.beard === 'goatee' ? .13 : .26, 10), hair, 0, a.beard === 'goatee' ? -.2 : -.25, .09).rotation.z = Math.PI;
    }
    if (a.accessory === 'glasses') {
      for (const side of [-1, 1]) mesh(this.head, new THREE.TorusGeometry(.045, .006, 5, 16), dark, side * .071, .025, .19);
      mesh(this.head, new THREE.BoxGeometry(.06, .009, .009), dark, 0, .025, .19);
    } else if (a.accessory === 'staff') {
      mesh(this.group, new THREE.CylinderGeometry(.017, .022, 1.45, 7), gold, -.4, .77, .08);
      ball(this.group, white, -.4, 1.52, .08, [.047, .065, .045]);
    } else if (a.accessory === 'brooch') ball(this.torso, gold, .12, .17, .17, [.045, .045, .016]);
    this.hitbox = mesh(this.group, new THREE.BoxGeometry(.72, 1.9, .65), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false }), 0, .95, 0);
    this.hitbox.userData.characterId = character.id;
    for(const [feature,y,radius] of [['hair',1.75,.16],['face',1.52,.16],['beard',1.32,.1],['clothes',.85,.27]] as [string,number,number][]){const target=mesh(this.group,new THREE.SphereGeometry(radius,10,8),new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false,colorWrite:false}),0,y,.18);target.userData={characterId:character.id,feature};this.featureTargets.push(target);}
    this.featureRing=mesh(this.group,new THREE.TorusGeometry(.23,.007,5,32),new THREE.MeshBasicMaterial({color:0xe4c993,transparent:true,opacity:.7,depthTest:false}),0,1.52,.19);this.featureRing.visible=false;
    this.ring = mesh(this.group, new THREE.TorusGeometry(.43, .015, 5, 36), new THREE.MeshBasicMaterial({ color: 0xe4c993, transparent: true, opacity: .9 }), 0, .015, 0); this.ring.rotation.x = -Math.PI / 2; this.ring.visible = false;
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 100;
    const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#132b28e8'; ctx.roundRect(8, 8, 496, 84, 20); ctx.fill(); ctx.fillStyle = '#f3e8ca'; ctx.font = '30px Georgia'; ctx.textAlign = 'center'; ctx.fillText(character.name.slice(0, 25), 256, 61);
    this.labelTexture = new THREE.CanvasTexture(canvas); this.labelTexture.colorSpace = THREE.SRGBColorSpace;
    this.label = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.labelTexture, depthTest: true, depthWrite: false })); this.label.position.set(0, 1.94, 0); this.label.scale.set(.88, .172, 1); this.group.add(this.label);
  }
  select() { this.selectedUntil = performance.now() + 2200; }
  setFeature(feature?:string){this.featureRing.visible=!!feature;if(feature){this.featureRing.position.y=feature==='hair'||feature==='hairColour'?1.75:feature==='face'||feature==='skin'?1.52:feature==='beard'?1.32:.92;this.featureRing.scale.setScalar(feature==='clothes'||feature==='colour'?1.4:1);}}
  animate(time: number, camera: THREE.Vector3) {
    const t = time / 1000 + this.phase;
    this.torso.scale.y = this.reducedMotion ? 1 : 1 + Math.sin(t * 1.45) * .007;
    const blink = t % 5.5; this.eyes.scale.y = blink > 5.3 ? Math.max(.06, Math.abs(blink - 5.4) / .1) : 1;
    this.head.rotation.y = THREE.MathUtils.clamp(Math.atan2(camera.x - this.group.position.x, camera.z - this.group.position.z) * .35, -.26, .26);
    const selected = performance.now() < this.selectedUntil; this.ring.visible = selected;
    this.leftArm.rotation.z = selected && !this.reducedMotion ? -.28 : -.08;
  }
  dispose() {
    const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
    this.group.traverse(object => { if (object instanceof THREE.Mesh) { geometries.add(object.geometry); (Array.isArray(object.material) ? object.material : [object.material]).forEach(material => materials.add(material)); } });
    geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose()); this.label.material.dispose(); this.labelTexture.dispose();
  }
}
