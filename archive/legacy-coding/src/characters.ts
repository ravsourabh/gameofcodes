import * as THREE from 'three';
import { BRAINS, brainIds, ARTISTE_BRAIN_IDS, brainMark, type BrainProvider } from './brains';

export type CourtRole = 'architect' | 'builder' | 'inspector' | 'virus' | 'artiste';
export type CharacterState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'working';
export const COURT = {
  architect: { name: 'Elara', title: 'Your architect', color: '#82bbb6', greeting: "Welcome, Sovereign. I'm Elara, your architect. Tell me what you would like us to create." },
  builder:   { name: 'Bram',  title: 'Your builder',   color: '#d7a66f', greeting: "Bram, at your service. Bring me a plan, and I'll turn it into something you can try." },
  inspector: { name: 'Iris',  title: 'Your inspector', color: '#b1a3dd', greeting: "I'm Iris. I'll help you examine what we make, show the checks we actually ran, and tell you what still needs attention." },
  virus:     { name: 'Virus', title: 'Court advisor',  color: '#9b7ec8', greeting: "I am Virus, your guide. Tell me your idea, or ask me to take you to the court, show code, or open settings." },
  artiste:   { name: 'Mira',  title: 'Your artiste',   color: '#d4a0d0', greeting: "Mira, at your pleasure. Give me a vision and I'll give it a face." },
} satisfies Record<CourtRole, { name: string; title: string; color: string; greeting: string }>;

export class CourtCharacter {
  readonly group = new THREE.Group();
  readonly hitbox: THREE.Mesh;
  readonly brainTargets: THREE.Mesh[] = [];
  private torso = new THREE.Group();
  private head = new THREE.Group();
  private scalp = new THREE.Group();
  private brain = new THREE.Group();
  private brainChoices = new THREE.Group();
  private forehead: THREE.Mesh;
  private brainLogo: THREE.Mesh;
  private nameplate: THREE.Mesh;
  private brainOpen = false;
  private opening = 0;
  private provider: BrainProvider = 'muse';
  private leftArm = new THREE.Group();
  private rightArm = new THREE.Group();
  private mouth: THREE.Mesh;
  private eyes: THREE.Group[] = [];
  private label: THREE.CanvasTexture;
  private labelCanvas: HTMLCanvasElement;
  private halo: THREE.Mesh;
  private state: CharacterState = 'idle';
  private selected = false;
  private amplitude = 0;
  private blinkAt = 2.5;
  private skin: THREE.MeshStandardMaterial;
  private roleColor: THREE.Color;

  constructor(readonly role: CourtRole, x: number, z: number) {
    const data = COURT[role];
    const builder = role === 'builder', inspector = role === 'inspector';
    const isVirus = role === 'virus', isArtiste = role === 'artiste';
    this.roleColor = new THREE.Color(data.color);
    this.skin = new THREE.MeshStandardMaterial({ color: isVirus ? 0xbfa08a : isArtiste ? 0xd4a882 : builder ? 0xc78e62 : inspector ? 0xb77956 : 0xe2af88, roughness: 0.78 });
    const material = (color: number, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness: metalness ? 0.37 : 0.88, metalness });
    const cloth = material(isVirus ? 0x2e1f42 : isArtiste ? 0x1e2840 : builder ? 0x80523a : inspector ? 0x443e68 : 0x285761);
    const sleeve = material(isVirus ? 0x3d2a58 : isArtiste ? 0x293855 : builder ? 0x344c40 : inspector ? 0x655783 : 0x3b737b);
    const dark = material(0x202b2b);
    const gold = material(isVirus ? 0x8a7a5a : 0xcba66c, 0.65);
    const hair = material(isArtiste ? 0x1e1420 : builder ? 0x4b2c22 : inspector ? 0x242731 : 0xd4d7cb);
    const white = material(0xf7eddd);
    const eye = material(0x25332f);
    const add = (parent: THREE.Object3D, geometry: THREE.BufferGeometry, mat: THREE.Material, pos: number[], scale?: number[]) => {
      const mesh = new THREE.Mesh(geometry, mat); mesh.position.set(pos[0], pos[1], pos[2]);
      if (scale) mesh.scale.set(scale[0], scale[1], scale[2]);
      parent.add(mesh); return mesh;
    };
    const ball = (parent: THREE.Object3D, mat: THREE.Material, pos: number[], scale: number[]) => add(parent, new THREE.SphereGeometry(1, 18, 12), mat, pos, scale);
    this.group.position.set(x, 0.04, z);
    const bodyWidth = builder ? 0.36 : isVirus ? 0.235 : isArtiste ? 0.255 : 0.265;
    // Complete, articulated figures: boots, legs, coat, arms, expressive faces.
    if (!isVirus && !isArtiste) {
      for (const side of [-1, 1]) {
        add(this.group, new THREE.CapsuleGeometry(0.075, 0.32, 4, 10), dark, [side * 0.12, 0.31, 0]);
        ball(this.group, dark, [side * 0.12, 0.085, 0.07], [0.105, 0.09, 0.19]);
        add(this.group, new THREE.BoxGeometry(0.13, 0.025, 0.11), gold, [side * 0.12, 0.11, 0.19]);
      }
    } else {
      // Virus/Artiste: floor-length robe conceals feet
      add(this.group, new THREE.CylinderGeometry(0.28, 0.35, 0.6, 14), cloth, [0, 0.26, 0]);
      add(this.group, new THREE.CylinderGeometry(0.35, 0.42, 0.1, 14), material(isVirus ? 0x1a1025 : 0x141d2e), [0, 0.01, 0]);
    }
    this.group.add(this.torso); this.torso.position.y = 0.58;
    if (isVirus || isArtiste) {
      // Flowing robe torso
      add(this.torso, new THREE.CylinderGeometry(bodyWidth * 0.7, bodyWidth * 1.15, 0.62, 14), cloth, [0, 0.16, 0]);
      add(this.torso, new THREE.CylinderGeometry(bodyWidth * 1.1, bodyWidth * 1.22, 0.07, 14), material(isVirus ? 0x1a1025 : 0x141d2e), [0, -0.13, 0]);
      ball(this.torso, sleeve, [0, 0.46, 0], [bodyWidth * 0.95, 0.26, 0.17]);
      // Brooch / clasp
      const clasp = add(this.torso, new THREE.OctahedronGeometry(isVirus ? 0.055 : 0.048), material(isVirus ? 0x7a6a9a : 0xd4a0d0, 0.4), [0, 0.52, 0.18]);
      clasp.rotation.z = Math.PI / 4;
    } else {
      const coat = add(this.torso, new THREE.CylinderGeometry(bodyWidth * 0.78, bodyWidth * 1.06, 0.58, 12), cloth, [0, 0.19, 0]);
      coat.scale.z = 0.69;
      ball(this.torso, sleeve, [0, 0.48, 0], [bodyWidth, 0.29, 0.19]);
      add(this.torso, new THREE.CylinderGeometry(bodyWidth * 1.03, bodyWidth * 1.03, 0.055, 12), gold, [0, 0.09, 0], [1, 1, 0.7]);
    }
    if (!isVirus && !isArtiste) {
      if (builder) {
        add(this.torso, new THREE.BoxGeometry(0.42, 0.47, 0.03), cloth, [0, 0.24, 0.2]);
        for (const side of [-1, 1]) add(this.torso, new THREE.BoxGeometry(0.045, 0.44, 0.032), gold, [side * 0.14, 0.47, 0.16]).rotation.z = side * 0.15;
        add(this.torso, new THREE.BoxGeometry(0.14, 0.11, 0.05), material(0x573d2f), [0.1, 0.12, 0.235]);
      } else {
        add(this.torso, new THREE.ConeGeometry(bodyWidth * 1.01, 0.41, 12, 1, true), sleeve, [0, 0.51, -0.06], [1.12, 1, 0.9]);
        const brooch = add(this.torso, new THREE.OctahedronGeometry(0.063), gold, [0, 0.57, 0.21]); brooch.rotation.z = Math.PI / 4;
        add(this.torso, new THREE.OctahedronGeometry(0.037), material(inspector ? 0xc0a9f0 : 0x95d9d0, 0.25), [0, 0.57, 0.25]);
        add(this.torso, new THREE.BoxGeometry(0.035, 0.44, 0.02), gold, [0, 0.26, 0.18]);
      }
    }
    for (const [arm, side] of [[this.leftArm, -1], [this.rightArm, 1]] as const) {
      this.torso.add(arm); arm.position.set(side * (bodyWidth + 0.015), 0.48, 0);
      add(arm, new THREE.CapsuleGeometry(isVirus || isArtiste ? 0.072 : builder ? 0.105 : 0.085, 0.23, 4, 10), sleeve, [side * 0.03, -0.19, 0]);
      add(arm, new THREE.CylinderGeometry(0.072, 0.065, 0.055, 10), gold, [side * 0.04, -0.36, 0]);
      ball(arm, this.skin, [side * 0.04, -0.43, 0.02], [0.065, 0.09, 0.058]);
      for (let finger = 0; finger < 4; finger++) add(arm, new THREE.CapsuleGeometry(0.011, 0.04, 3, 5), this.skin, [side * 0.04 + (finger - 1.5) * 0.022, -0.48, 0.025]);
      arm.rotation.z = side * (isVirus ? 0.08 : isArtiste ? 0.11 : builder ? 0.18 : 0.12);
    }
    if (isVirus) {
      // Bone staff held in right hand, floor-length
      const staffMat = material(0xd4c9a8, 0.1);
      const staff = add(this.rightArm, new THREE.CylinderGeometry(0.018, 0.022, 1.6, 8), staffMat, [0.05, -0.85, 0.1]);
      staff.rotation.z = -0.12;
      // Carved tip — pulsing orb
      add(this.rightArm, new THREE.OctahedronGeometry(0.055), new THREE.MeshStandardMaterial({ color: 0x9b7ec8, emissive: 0x6a4a9a, emissiveIntensity: 1.2, roughness: 0.3 }), [0.07, -0.22, 0.1]);
      add(this.rightArm, new THREE.TorusGeometry(0.06, 0.008, 6, 18), staffMat, [0.07, -0.22, 0.1]).rotation.x = Math.PI / 4;
    } else if (isArtiste) {
      // Floating canvas in left hand
      const canvasMat = material(0xf0e8d4);
      add(this.leftArm, new THREE.BoxGeometry(0.28, 0.22, 0.01), canvasMat, [-0.04, -0.35, 0.12]);
      add(this.leftArm, new THREE.BoxGeometry(0.30, 0.005, 0.015), material(0x7a6535, 0.4), [-0.04, -0.24, 0.12]);
      add(this.leftArm, new THREE.BoxGeometry(0.30, 0.005, 0.015), material(0x7a6535, 0.4), [-0.04, -0.46, 0.12]);
      // Brush in right hand
      add(this.rightArm, new THREE.CylinderGeometry(0.009, 0.013, 0.24, 6), material(0x8a6a3a), [0.04, -0.38, 0.1]).rotation.z = -0.3;
      add(this.rightArm, new THREE.ConeGeometry(0.018, 0.06, 5), material(0xd0a0a0), [0.065, -0.28, 0.11]);
    } else if (builder) {
      const handle = add(this.leftArm, new THREE.CylinderGeometry(0.022, 0.022, 0.28, 8), material(0x85552f), [-0.05, -0.43, 0.095]); handle.rotation.z = -0.2;
      add(this.leftArm, new THREE.BoxGeometry(0.2, 0.1, 0.1), material(0x9a9d92, 0.6), [-0.07, -0.25, 0.095]);
    } else {
      const book = add(this.leftArm, new THREE.BoxGeometry(0.2, 0.26, 0.065), material(inspector ? 0x9581b2 : 0xa89469), [-0.03, -0.37, 0.1]); book.rotation.z = -0.15;
      add(this.leftArm, new THREE.BoxGeometry(0.165, 0.22, 0.008), white, [-0.03, -0.37, 0.138]);
      add(this.leftArm, new THREE.BoxGeometry(0.02, 0.25, 0.015), gold, [-0.1, -0.37, 0.145]);
    }
    this.head.position.set(0, isVirus ? 1.45 : isArtiste ? 1.47 : builder ? 1.42 : 1.48, 0); this.group.add(this.head);
    add(this.head, new THREE.CylinderGeometry(0.075, 0.08, 0.14, 12), this.skin, [0, -0.27, 0]);
    ball(this.head, this.skin, [0, 0, 0], [builder ? 0.235 : 0.205, 0.255, 0.2]);
    for (const side of [-1, 1]) {
      ball(this.head, this.skin, [side * 0.203, -0.035, 0], [0.047, 0.075, 0.04]);
      const eyeGroup = new THREE.Group(); eyeGroup.position.set(side * 0.078, 0.026, 0.176); this.head.add(eyeGroup); this.eyes.push(eyeGroup);
      ball(eyeGroup, white, [0, 0, 0], [0.051, 0.061, 0.025]);
      ball(eyeGroup, eye, [0, -0.003, 0.024], [0.026, 0.035, 0.012]);
      ball(eyeGroup, white, [-0.008, 0.01, 0.034], [0.008, 0.01, 0.004]);
      const brow = add(this.head, new THREE.CapsuleGeometry(0.014, 0.07, 3, 8), hair, [side * 0.08, 0.11, 0.184]); brow.rotation.z = Math.PI / 2 + side * 0.1;
      ball(this.head, material(builder ? 0xb87854 : inspector ? 0xa66b51 : 0xd79776), [side * 0.125, -0.07, 0.16], [0.046, 0.024, 0.015]);
    }
    ball(this.head, this.skin, [0, -0.037, 0.2], [0.038, 0.05, 0.052]);
    this.mouth = ball(this.head, material(0x65392e), [0, -0.124, 0.172], [0.047, 0.012, 0.018]);
    ball(this.head, white, [0, -0.12, 0.185], [0.036, 0.006, 0.004]);
    this.head.add(this.scalp);
    if (isVirus) {
      // Bald — smooth head only, no hair. Subtle vein-like lines via roughness map handled via material.
      ball(this.head, new THREE.MeshStandardMaterial({ color: 0xbfa08a, roughness: 0.82 }), [0, 0.05, -0.06], [0.21, 0.22, 0.19]);
    } else if (isArtiste) {
      // Dark hair, slightly dishevelled, ink smudges
      ball(this.scalp, hair, [0, 0.14, -0.06], [0.21, 0.15, 0.18]);
      for (let i = 0; i < 7; i++) { const angle = (i / 6 - 0.5) * Math.PI; ball(this.scalp, hair, [Math.sin(angle) * 0.15, 0.16 + Math.cos(angle) * 0.02, Math.cos(angle) * 0.1], [0.065, 0.09, 0.07]); }
      for (const side of [-1, 1]) ball(this.head, hair, [side * 0.15, 0.03, -0.02], [0.06, 0.18, 0.085]);
      // Small ink smudge on forehead
      ball(this.head, material(0x1a1035, 0.1), [0.04, 0.09, 0.195], [0.02, 0.012, 0.006]);
    } else {
      ball(this.scalp, hair, [0, 0.15, -0.055], [0.22, 0.145, 0.185]);
      for (let i = 0; i < 7; i++) {
        const angle = (i / 6 - 0.5) * Math.PI;
        ball(this.scalp, hair, [Math.sin(angle) * 0.16, 0.19 + Math.cos(angle) * 0.016, Math.cos(angle) * 0.11], [0.07, 0.095, 0.075]);
      }
      if (builder) {
        ball(this.head, hair, [0, -0.16, 0.04], [0.21, 0.16, 0.17]);
        for (const side of [-1, 1]) ball(this.head, hair, [side * 0.06, -0.088, 0.187], [0.065, 0.022, 0.026]).rotation.z = side * -0.1;
        this.mouth.position.z = 0.211;
        add(this.head, new THREE.TorusGeometry(0.246, 0.023, 6, 24, Math.PI), gold, [0, 0.02, -0.03]).rotation.z = 0;
      } else if (inspector) {
        ball(this.head, hair, [0, 0.005, -0.15], [0.21, 0.25, 0.13]);
        for (const side of [-1, 1]) ball(this.head, hair, [side * 0.17, -0.08, -0.035], [0.07, 0.22, 0.09]);
        for (const side of [-1, 1]) add(this.head, new THREE.TorusGeometry(0.063, 0.007, 5, 20), gold, [side * 0.078, 0.025, 0.207]);
        add(this.head, new THREE.BoxGeometry(0.03, 0.009, 0.009), gold, [0, 0.028, 0.213]);
      } else {
        ball(this.scalp, hair, [0, 0.19, -0.18], [0.12, 0.13, 0.1]);
        for (const side of [-1, 1]) ball(this.head, hair, [side * 0.16, 0.04, -0.02], [0.064, 0.19, 0.09]);
        add(this.scalp, new THREE.TorusGeometry(0.216, 0.012, 6, 28), gold, [0, 0.08, 0]).rotation.x = Math.PI / 2;
        add(this.scalp, new THREE.OctahedronGeometry(0.035), gold, [0, 0.093, 0.22]);
      }
    }
    const defaultBrain: BrainProvider = isArtiste ? 'nanoBanana' : 'muse';
    this.forehead = brainMark(defaultBrain, 0.145, 0.32); this.forehead.position.set(0, 0.135, 0.242); this.head.add(this.forehead);
    {
      const headSelect = new THREE.Mesh(new THREE.SphereGeometry(0.10, 8, 6), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })); headSelect.position.set(0, 0.14, 0.36); headSelect.userData.action = `brain-open:${role}`; this.head.add(headSelect); this.brainTargets.push(headSelect);
    }
    // A luminous mechanical core and a lifting hair cap, with no anatomy or gore.
    const coreColor = isVirus ? 0xb090d8 : isArtiste ? 0xd4a0d0 : 0x9dd8d0;
    const coreEmissive = isVirus ? 0x7a50b0 : isArtiste ? 0xa060a0 : 0x477f91;
    const core = new THREE.MeshStandardMaterial({ color: coreColor, emissive: coreEmissive, emissiveIntensity: 1.1, transparent: true, opacity: 0.62, metalness: 0.35, roughness: 0.2 });
    for (const side of [-1, 1]) ball(this.brain, core, [side * 0.058, 0, 0], [0.09, 0.10, 0.09]);
    const orbit = add(this.brain, new THREE.TorusGeometry(0.15, 0.006, 6, 32), gold, [0, 0, 0]); orbit.rotation.x = 0.3;
    this.brainLogo = brainMark(defaultBrain, 0.15); this.brainLogo.position.z = 0.115; this.head.add(this.brain); this.brain.add(this.brainLogo); this.brain.visible = false;
    const pickerBrains = isArtiste ? ARTISTE_BRAIN_IDS : brainIds;
    const pickerOffset = isArtiste ? 0.5 : 1;
    pickerBrains.forEach((id, i) => {
      const token = new THREE.Group(); token.userData.brain = id; token.position.set((i - pickerOffset) * 0.39, 0.69, 0.32); this.brainChoices.add(token);
      const glass = new THREE.Mesh(new THREE.SphereGeometry(0.14, 14, 10), new THREE.MeshStandardMaterial({ color: BRAINS[id].color, transparent: true, opacity: 0.2, emissive: BRAINS[id].color, emissiveIntensity: 0.35, roughness: 0.2 })); token.add(glass);
      const mark = brainMark(id, 0.17); mark.position.z = 0.145; token.add(mark);
      const target = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })); target.userData.brain = id; target.userData.role = role; token.add(target); this.brainTargets.push(target);
      const label = document.createElement('canvas'); label.width = 256; label.height = 60; const ctx = label.getContext('2d')!; ctx.fillStyle = '#12272cf2'; ctx.fillRect(0, 0, 256, 60); ctx.fillStyle = '#dce8d7'; ctx.textAlign = 'center'; ctx.font = '28px Arial'; ctx.fillText(BRAINS[id].name, 128, 40);
      const texture = new THREE.CanvasTexture(label); texture.colorSpace = THREE.SRGBColorSpace;
      const plaque = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.07), new THREE.MeshBasicMaterial({ map: texture, transparent: true, toneMapped: false })); plaque.position.set(0, -0.205, 0.14); token.add(plaque);
    });
    this.head.add(this.brainChoices); this.brainChoices.visible = false;
    const base = add(this.group, new THREE.CylinderGeometry(0.49, 0.54, 0.08, 48), material(0x243d3e, 0.15), [0, -0.015, 0]);
    base.position.y = -0.035;
    this.halo = add(this.group, new THREE.RingGeometry(0.5, 0.515, 64), new THREE.MeshBasicMaterial({ color: this.roleColor, transparent: true, opacity: 0.5 }), [0, 0.012, 0]); this.halo.rotation.x = -Math.PI / 2;
    this.hitbox = add(this.group, new THREE.CapsuleGeometry(0.32, 1.15, 5, 10), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }), [0, 0.9, 0]);
    this.hitbox.userData.character = role;
    this.labelCanvas = document.createElement('canvas'); this.labelCanvas.width = 640; this.labelCanvas.height = 160;
    this.label = new THREE.CanvasTexture(this.labelCanvas); this.label.colorSpace = THREE.SRGBColorSpace;
    const nameplate = new THREE.Mesh(new THREE.PlaneGeometry(0.82, 0.205), new THREE.MeshBasicMaterial({ map: this.label, transparent: true, toneMapped: false, depthWrite: false }));
    nameplate.position.set(0, 1.99, 0.08); this.nameplate = nameplate; this.group.add(nameplate);
    this.drawLabel();
  }

  setState(state: CharacterState) { this.state = state; this.drawLabel(); }
  setSelected(selected: boolean) { this.selected = selected; this.drawLabel(); }
  setAmplitude(amplitude: number) { this.amplitude = amplitude; }
  setBrain(provider: BrainProvider) {
    if (provider === this.provider) return; this.provider = provider;
    const logo = brainMark(provider, 0.145, 0.32), coreLogo = brainMark(provider, 0.15);
    (this.forehead.material as THREE.MeshBasicMaterial).map = (logo.material as THREE.MeshBasicMaterial).map!;
    (this.brainLogo.material as THREE.MeshBasicMaterial).map = (coreLogo.material as THREE.MeshBasicMaterial).map!;
    logo.geometry.dispose(); (logo.material as THREE.Material).dispose(); coreLogo.geometry.dispose(); (coreLogo.material as THREE.Material).dispose();
  }
  setAvailableBrains(providers: BrainProvider[]) {
    const tokens = this.brainChoices.children;
    const available = tokens.filter(token => providers.includes(token.userData.brain));
    tokens.forEach(token => { token.visible = available.includes(token); });
    available.forEach((token, i) => { token.position.x = (i - (available.length - 1) / 2) * .39; });
  }
  openHead(open: boolean) { this.brainOpen = open; this.brainChoices.visible = open; }

  private drawLabel() {
    const ctx = this.labelCanvas.getContext('2d')!, data = COURT[this.role];
    ctx.clearRect(0, 0, 640, 160);
    ctx.fillStyle = this.selected ? '#152b2bf5' : '#102226ed'; ctx.beginPath(); ctx.roundRect(2, 2, 636, 156, 18); ctx.fill();
    ctx.strokeStyle = this.selected ? data.color : '#6c816055'; ctx.lineWidth = 2; ctx.stroke();
    ctx.textAlign = 'center'; ctx.fillStyle = '#f2e7d4'; ctx.font = '35px Georgia'; ctx.fillText(data.name, 320, 57);
    ctx.fillStyle = data.color; ctx.font = '15px Arial'; ctx.fillText(data.title.toUpperCase(), 320, 89);
    ctx.fillStyle = '#97ada0'; ctx.font = '17px Arial';
    const idleText = this.role === 'virus' ? 'Advising the court' : this.role === 'artiste' ? 'Ready to create' : this.selected ? 'You have my attention' : 'Select to address';
    ctx.fillText(this.state === 'idle' ? idleText : { listening: 'Listening to you', thinking: 'Considering your request', speaking: 'Speaking', working: 'Working on your request' }[this.state], 320, 126);
    this.label.needsUpdate = true;
  }

  animate(time: number, cameraPosition: THREE.Vector3, showLabel = true) {
    this.opening = THREE.MathUtils.lerp(this.opening, this.brainOpen ? 1 : 0, 0.13);
    this.scalp.position.set(0, this.opening * 0.42, -this.opening * 0.16); this.scalp.rotation.x = -this.opening * 0.5;
    this.brain.visible = this.opening > 0.02; this.brain.position.set(0, 0.14 + this.opening * 0.21, 0.03); this.brain.scale.setScalar(Math.max(0.01, this.opening));
    this.nameplate.visible = showLabel && this.opening < 0.1;
    (this.forehead.material as THREE.MeshBasicMaterial).opacity = 0.32 * (1 - this.opening);
    const phase = this.role === 'architect' ? 0 : this.role === 'builder' ? 2 : 4;
    const speaking = this.state === 'speaking';
    const energy = speaking ? Math.max(this.amplitude, 0.1) : 0;
    this.torso.position.y = 0.58 + Math.sin(time * 1.5 + phase) * 0.005;
    this.head.rotation.y = THREE.MathUtils.clamp(Math.atan2(cameraPosition.x - this.group.position.x, cameraPosition.z - this.group.position.z), -0.3, 0.3);
    if(this.state==='working'){this.head.rotation.y=THREE.MathUtils.clamp(-this.group.position.x*.2,-.35,.35);}
    this.head.rotation.z = speaking ? Math.sin(time * 2.3 + phase) * 0.035 : Math.sin(time * 0.7 + phase) * 0.012;
    this.head.rotation.x = this.state === 'working' ? .22 : this.state === 'thinking' ? -0.08 : Math.sin(time * (speaking ? 3 : 1.1) + phase) * (speaking ? 0.025 : 0.008);
    this.rightArm.rotation.x = speaking ? -0.55 - Math.sin(time * 2.1) * 0.16 : this.state === 'listening' ? -0.15 : -0.04;
    this.rightArm.rotation.z = -0.12 - (speaking ? Math.sin(time * 2.4) * 0.1 + 0.19 : 0);
    this.leftArm.rotation.x = -0.18 + Math.sin(time * 1.2 + phase) * 0.025;
    if(this.state==='working'){this.rightArm.rotation.x=-.65+Math.sin(time*5+phase)*.12;this.leftArm.rotation.x=-.55+Math.sin(time*5+phase+Math.PI)*.12;}
    this.mouth.scale.y = 0.012 + energy * (0.035 + Math.abs(Math.sin(time * 19)) * 0.045);
    if (time > this.blinkAt + 0.14) this.blinkAt = time + 3 + Math.sin(time * 13 + phase) * 1.4;
    for (const eye of this.eyes) eye.scale.y = time > this.blinkAt ? 0.1 : 1;
    const haloMat = this.halo.material as THREE.MeshBasicMaterial;
    haloMat.opacity = this.selected ? 0.85 + Math.sin(time * 2.3) * 0.1 : 0.25;
  }
}
