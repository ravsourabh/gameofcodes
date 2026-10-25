import * as THREE from 'three';
import { EnvironmentAssets } from './environment-assets';
import { XRHandModelFactory } from 'three/addons/webxr/XRHandModelFactory.js';
import type { ConnectionState } from './preview';
import { CourtCharacter, type CourtRole, type CharacterState } from './characters';
import { SpatialDialogue } from './spatial-ui';
import type { BrainProvider } from './brains';

type SurfaceAction = string;
type SceneCallbacks = { click: (x: number, y: number) => void; action: (action: SurfaceAction) => void; character: (role: CourtRole) => void; session: (active: boolean) => void; feedback: () => void };
type Target = THREE.Mesh & { userData: { action?: SurfaceAction; screen?: boolean; character?: CourtRole; dialogue?: boolean; brain?: BrainProvider; role?: CourtRole } };

const GOLD = 0xc9a66b;
const WIDTH = 1280;
const HEIGHT = 800;

function canvasTexture(width: number, height: number, paint: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d')!; paint(ctx);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  return { canvas, ctx, texture };
}

function rounded(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radius: number, color: string) {
  ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(x, y, w, h, radius); ctx.fill();
}

export class CourtScene {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(48, 1, 0.05, 80);
  readonly origin = new THREE.Group();
  private assets = new EnvironmentAssets();
  private courtDetails = new THREE.Group();
  private board = new THREE.Group();
  readonly dialogue = new SpatialDialogue();
  private characters = new Map<CourtRole, CourtCharacter>();
  private previewVisible = false;
  private surface: Target;
  private texture: THREE.Texture;
  private frame?: ImageBitmap;
  private targets: Target[] = [];
  private vrControls: Target[] = [];
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private controllerStates: { grip: THREE.Group; ray: THREE.Line; cursor: THREE.Mesh; source?: XRInputSource; down: boolean }[] = [];
  private statusPanel: ReturnType<typeof canvasTexture>;
  private helpPanel: THREE.Mesh;
  private status: ConnectionState = 'connecting';
  private stale = false;
  private lastFrame = 0;
  private hovered = false;
  private feedbackUntil = 0;
  private view = { yaw: 0, pitch: 0 };
  private reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  private disposed = false;
  private large = false;
  private phase = 0;
  // 360° zones
  private zoneGroups = { meetingRoom: new THREE.Group(), workspace: new THREE.Group(), wallOfFame: new THREE.Group() };
  private activeZone: 'court' | 'meetingRoom' | 'workspace' | 'wallOfFame' = 'court';
  private meetingRoomScreen: THREE.Mesh | null = null;
  private wallFameSlots: { frame: THREE.Mesh; canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; texture: THREE.CanvasTexture }[] = [];
  private zoneLabels: { mesh: THREE.Mesh; zone: 'meetingRoom' | 'workspace' | 'wallOfFame' }[] = [];
  private gardenGroup = new THREE.Group();
  private gateLeft: THREE.Group | null = null;
  private gateRight: THREE.Group | null = null;
  private gardenActive = false;
  private guideGeneration = 0;
  private guideMotion: { from: THREE.Vector3; to: THREE.Vector3; start: number; duration: number } | null = null;
  private gestureOrbs: { mesh: THREE.Mesh; target: THREE.Mesh }[] = [];
  private miraPanel: { frame: THREE.Mesh; panel: THREE.Mesh; ctx: CanvasRenderingContext2D; texture: THREE.CanvasTexture } | null = null;
  private cameraAnim: { fromPos: THREE.Vector3; fromLook: THREE.Vector3; toPos: THREE.Vector3; toLook: THREE.Vector3; start: number; dur: number; done: () => void } | null = null;
  private gateAnim: { start: number; dur: number; done: () => void } | null = null;
  private frames = 0;
  private fpsTime = performance.now();
  private lastRender = 0;
  fps = 0;
  onFps?: (fps: number) => void;

  constructor(private canvas: HTMLCanvasElement, private callbacks: SceneCallbacks) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.xr.enabled = true;
    this.renderer.xr.setFramebufferScaleFactor(1);
    this.renderer.xr.setReferenceSpaceType('local-floor');
    this.scene.background = new THREE.Color(0x101c26);
    this.scene.fog = new THREE.FogExp2(0x10242a, 0.016);
    this.camera.position.set(0, 1.45, 2.1); this.camera.lookAt(0, 1.08, -1.65);
    this.origin.add(this.camera); this.scene.add(this.origin);
    this.scene.add(new THREE.HemisphereLight(0xd0e5d8, 0x353b31, 1.65));
    const sun = new THREE.DirectionalLight(0xffdfb4, 2.5); sun.position.set(-5, 8, -5); this.scene.add(sun);
    const fill = new THREE.PointLight(0xa7c5ce, 18, 12); fill.position.set(0, 4, 3); this.scene.add(fill);
    this.environment();
    this.assets.courtDetails(this.courtDetails);
    this.assets.batch(this.courtDetails);
    this.scene.add(this.courtDetails);
    this.buildZones();
    for (const [role, x, z] of [['builder', -1.12, -1.42], ['architect', 0, -1.65], ['inspector', 1.12, -1.42]] as const) {
      const character = new CourtCharacter(role, x, z); this.characters.set(role, character); this.scene.add(character.group); this.targets.push(character.hitbox as Target);
      this.targets.push(...character.brainTargets as Target[]);
    }
    this.characters.get('architect')!.setSelected(true);

    // Virus — spawns in garden, moves to court after onboarding Step 6
    const virus = new CourtCharacter('virus', 0, 3.0);
    this.characters.set('virus', virus); this.scene.add(virus.group);
    this.targets.push(virus.hitbox as Target, ...virus.brainTargets as Target[]);

    // Mira (artiste) — court right side, hidden until Step 7
    const mira = new CourtCharacter('artiste', 2.1, -1.05);
    mira.group.visible = false;
    this.characters.set('artiste', mira); this.scene.add(mira.group);
    this.targets.push(mira.hitbox as Target, ...mira.brainTargets as Target[]);

    // Mira's art canvas panel
    const miraCanvasData = canvasTexture(512, 512, ctx => {
      ctx.fillStyle = '#0d1a1e'; ctx.fillRect(0, 0, 512, 512);
      ctx.strokeStyle = '#3a4a4e'; ctx.lineWidth = 2; ctx.setLineDash([8, 6]); ctx.strokeRect(16, 16, 480, 480);
      ctx.fillStyle = '#3a5055'; ctx.font = '22px Georgia'; ctx.textAlign = 'center'; ctx.fillText('Awaiting artwork', 256, 256);
    });
    const miraFrame = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.15, 0.04), new THREE.MeshStandardMaterial({ color: 0x3d2a14, roughness: 0.6, metalness: 0.3 }));
    miraFrame.position.set(2.6, 1.82, -0.7); miraFrame.rotation.y = -0.4; this.scene.add(miraFrame); miraFrame.visible=false;
    const miraPanelMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.0), new THREE.MeshBasicMaterial({ map: miraCanvasData.texture, toneMapped: false }));
    miraPanelMesh.position.set(2.6, 1.82, -0.68); miraPanelMesh.rotation.y = -0.4; this.scene.add(miraPanelMesh);
    miraPanelMesh.visible = false;
    this.miraPanel = { frame: miraFrame, panel: miraPanelMesh, ctx: miraCanvasData.ctx, texture: miraCanvasData.texture };

    this.buildGarden();
    this.scene.add(this.dialogue.mesh); this.dialogue.mesh.visible = false;
    this.targets.push(this.dialogue.mesh as Target);

    const placeholder = canvasTexture(WIDTH, HEIGHT, ctx => {
      ctx.fillStyle = '#151e22'; ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.textAlign = 'center'; ctx.fillStyle = '#d9bd8a'; ctx.font = '38px Georgia'; ctx.fillText('A little space for your next idea.', WIDTH / 2, HEIGHT / 2 - 15);
      ctx.fillStyle = '#81938d'; ctx.font = '17px Arial'; ctx.fillText('Opening the live application…', WIDTH / 2, HEIGHT / 2 + 34);
    });
    this.texture = placeholder.texture;
    this.surface = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2), new THREE.MeshBasicMaterial({ map: this.texture, toneMapped: false })) as Target;
    this.surface.userData.screen = true; this.surface.position.z = 0.043;
    this.board.position.set(0, 1.83, -1.8);
    this.board.add(this.surface);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(3.29, 2.09, 0.075), new THREE.MeshStandardMaterial({ color: 0x574734, metalness: 0.72, roughness: 0.37 }));
    this.board.add(frame);
    const inset = new THREE.Mesh(new THREE.PlaneGeometry(3.24, 2.04), new THREE.MeshBasicMaterial({ color: 0x0e1518 })); inset.position.z = 0.039; this.board.add(inset);
    this.targets.push(this.surface);
    const header = canvasTexture(1280, 84, ctx => {
      ctx.fillStyle = '#0f1d20'; ctx.fillRect(0, 0, 1280, 84);
      ctx.font = '19px Arial'; ctx.fillStyle = '#bca57d'; ctx.fillText('✦   THE FIRST BUILD', 26, 49);
      ctx.font = '13px Arial'; ctx.fillStyle = '#8b9d91'; ctx.textAlign = 'right'; ctx.fillText('INTERACTIVE APPLICATION  /  STARTER 01', 1254, 47);
    });
    const headerMesh = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.21), new THREE.MeshBasicMaterial({ map: header.texture, toneMapped: false }));
    headerMesh.position.set(0, 1.15, 0.03); this.board.add(headerMesh);
    this.statusPanel = canvasTexture(1280, 110, () => {});
    const statusMesh = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.275), new THREE.MeshBasicMaterial({ map: this.statusPanel.texture, toneMapped: false }));
    statusMesh.position.set(0, -1.19, 0.035); this.board.add(statusMesh);

    const controls: { action: SurfaceAction; label: string; glyph: string }[] = [
      { action: 'reload', label: 'Reload app', glyph: '↻' },
      { action: 'size', label: 'Resize', glyph: '↔' },
      { action: 'recenter', label: 'Center desk', glyph: '⊙' },
      { action: 'help', label: 'How to use', glyph: '?' },
      { action: 'court', label: 'Back to court', glyph: '↗' },
    ];
    controls.forEach((control, i) => {
      const t = canvasTexture(256, 150, ctx => {
        rounded(ctx, 0, 0, 256, 150, 18, '#16272b');
        ctx.strokeStyle = '#556156'; ctx.lineWidth = 2; ctx.strokeRect(1, 1, 254, 148);
        ctx.textAlign = 'center'; ctx.font = '44px Arial'; ctx.fillStyle = '#d1b17b'; ctx.fillText(control.glyph, 128, 66);
        ctx.font = '20px Arial'; ctx.fillStyle = '#bac3b6'; ctx.fillText(control.label, 128, 117);
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.47, 0.275), new THREE.MeshBasicMaterial({ map: t.texture, toneMapped: false })) as Target;
      mesh.position.set((i - 2) * 0.52, -0.98, 1.4); mesh.rotation.x = -0.17; mesh.userData.action = control.action;
      mesh.visible = false; this.vrControls.push(mesh);
      this.board.add(mesh); this.targets.push(mesh);
    });
    const help = canvasTexture(1100, 680, ctx => {
      rounded(ctx, 0, 0, 1100, 680, 26, '#14252a');
      ctx.strokeStyle = '#8a7858'; ctx.lineWidth = 3; ctx.strokeRect(2, 2, 1096, 676);
      ctx.fillStyle = '#b49c72'; ctx.font = '18px Arial'; ctx.fillText('A MOMENT TO FIND YOUR BEARINGS', 70, 78);
      ctx.fillStyle = '#ede5d6'; ctx.font = '47px Georgia'; ctx.fillText('Your ideas, within reach.', 70, 150);
      ctx.fillStyle = '#b5c4b9'; ctx.font = '25px Arial';
      ['Point your hand at the board. Pinch to select.', 'Choose New task, then use the hand keyboard.', 'Open a task to edit it. The arrow moves it forward.', 'Reload app to check that your work is saved.'].forEach((line, i) => ctx.fillText(`${i + 1}.  ${line}`, 70, 245 + i * 66));
      ctx.fillStyle = '#d5b47b'; ctx.font = '22px Arial'; ctx.fillText('SELECT “HOW TO USE” AGAIN TO CLOSE', 70, 595);
    });
    this.helpPanel = new THREE.Mesh(new THREE.PlaneGeometry(2.75, 1.7), new THREE.MeshBasicMaterial({ map: help.texture, toneMapped: false }));
    this.helpPanel.position.set(0, 0, 0.13); this.helpPanel.visible = false; this.board.add(this.helpPanel);
    this.scene.add(this.board);
    this.board.visible = false;
    this.configureInput();
    this.renderer.xr.addEventListener('sessionstart', () => {
      this.origin.position.set(0, 0, this.gardenActive ? 5.5 : 1.9); this.origin.rotation.set(0, 0, 0);
      this.vrControls.forEach(mesh => { mesh.visible = this.previewVisible; });
      this.dialogue.mesh.visible = !this.previewVisible;
      this.callbacks.session(true); this.setStatus(this.status);
    });
    this.renderer.xr.addEventListener('sessionend', () => {
      this.origin.position.set(0, 0, 0); this.origin.rotation.set(0, 0, 0);
      this.camera.position.set(0, 1.45, 2.1); this.camera.lookAt(0, 1.08, -1.65);
      this.vrControls.forEach(mesh => { mesh.visible = false; });
      this.board.position.set(0, this.large ? 1.95 : 1.83, -1.8); this.board.rotation.set(0, 0, 0);
      this.helpPanel.visible = false;
      this.dialogue.mesh.visible = false;
      this.view = { yaw: 0, pitch: 0 }; this.callbacks.session(false);
    });
    this.setStatus('connecting');
    this.resize();
    window.addEventListener('resize', this.resize);
    this.renderer.setAnimationLoop(this.animate);
  }

  private environment() {
    const mesh = (geometry: THREE.BufferGeometry, color: number, position: number[], metalness = 0) => {
      const object = new THREE.Mesh(geometry, metalness > 0.4 ? this.assets.brass : this.assets.stone);
      object.position.set(position[0], position[1], position[2]); this.scene.add(object); return object;
    };
    const sky = new THREE.Mesh(new THREE.SphereGeometry(55, 24, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false,
      vertexShader: 'varying vec3 vPos; void main(){vPos=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: 'varying vec3 vPos; void main(){float h=normalize(vPos).y;vec3 a=vec3(0.17,0.31,0.34);vec3 b=vec3(0.055,0.13,0.20);vec3 c=vec3(0.52,0.51,0.37);vec3 color=mix(a,b,smoothstep(0.0,0.65,h));color=mix(color,c,exp(-abs(h-0.035)*16.0)*0.6);gl_FragColor=vec4(color,1.0);}' }));
    this.scene.add(sky);
    const floor = mesh(new THREE.CylinderGeometry(8, 8, 0.18, 64), 0x1b2a2d, [0, -0.13, 0], 0.15);
    floor.material = this.assets.stone;
    floor.receiveShadow = false;
    for (const radius of [2.7, 3, 5.6, 5.66, 7.7]) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(radius, radius + 0.014, 96), new THREE.MeshBasicMaterial({ color: 0x7b7150, transparent: true, opacity: 0.38 }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = -0.033; this.scene.add(ring);
    }
    const gridPoints = [];
    for (let i = -7; i <= 7; i++) { gridPoints.push(new THREE.Vector3(i, -0.035, -6), new THREE.Vector3(i, -0.035, 6), new THREE.Vector3(-7, -0.035, i), new THREE.Vector3(7, -0.035, i)); }
    this.scene.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(gridPoints), new THREE.LineBasicMaterial({ color: 0x344747, transparent: true, opacity: 0.38 })));

    for (const x of [-4.2, 4.2]) {
      mesh(new THREE.BoxGeometry(1.7, 7, 0.9), 0x1d3035, [x, 3.4, -5.5]);
      mesh(new THREE.BoxGeometry(2, 0.3, 1.15), 0x293b3d, [x, 0.12, -5.5]);
      mesh(new THREE.BoxGeometry(1.95, 0.16, 1.04), 0x555343, [x, 3.8, -5.5], 0.35);
      mesh(new THREE.BoxGeometry(0.055, 5.7, 0.06), GOLD, [x + Math.sign(x) * -0.68, 3.3, -5.02], 0.5);
      const lampX = x + Math.sign(x) * -0.43;
      mesh(new THREE.CylinderGeometry(0.16, 0.11, 0.85, 10), 0x62543a, [lampX, 2.7, -4.86], 0.6);
      mesh(new THREE.SphereGeometry(0.14, 12, 8), 0xffd99c, [lampX, 3.12, -4.86]);
      const light = new THREE.PointLight(0xffc377, 8, 5); light.position.set(lampX, 3.12, -4.55); this.scene.add(light);
    }
    const arch = mesh(new THREE.TorusGeometry(3.34, 0.21, 6, 56, Math.PI), 0x263b3e, [0, 3.15, -5.5]);
    arch.scale.y = 1.1;
    const archTrim = mesh(new THREE.TorusGeometry(3.12, 0.025, 5, 56, Math.PI), 0x8b7b54, [0, 3.15, -5.23], 0.5); archTrim.scale.y = 1.1;
    mesh(new THREE.BoxGeometry(6.7, 0.22, 0.6), 0x2a3c3e, [0, 0.3, -5.6]);
    for (const x of [-2.8, -1.4, 0, 1.4, 2.8]) {
      mesh(new THREE.BoxGeometry(0.055, 0.65, 0.1), 0x8a805b, [x, 0.7, -5.5], 0.4);
    }
    mesh(new THREE.BoxGeometry(6.7, 0.055, 0.12), 0x8a805b, [0, 1.02, -5.5], 0.4);
    const moon = new THREE.Mesh(new THREE.SphereGeometry(0.68, 24, 16), new THREE.MeshBasicMaterial({ color: 0xf3deb0 })); moon.position.set(-5.6, 7.3, -25); this.scene.add(moon);
    for (let layer = 0; layer < 4; layer++) {
      const shape = new THREE.Shape(); shape.moveTo(-35, -6);
      for (let x = -35; x <= 35; x += 1.5) { const y = Math.sin(x * 0.24 + layer * 2.7) * 1.4 + Math.sin(x * 0.73 + layer) * 0.6 + (3 - layer) * 0.3; shape.lineTo(x, y); }
      shape.lineTo(35, -6); shape.closePath();
      const mountain = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshBasicMaterial({ color: [0x497275, 0x355b62, 0x2a4c54, 0x1b3c46][layer] }));
      mountain.position.set(0, 0.5 - layer * 0.18, -28 + layer * 3); this.scene.add(mountain);
    }
    // A low desk leaves the entire application in a comfortable seated field of view.
    mesh(new THREE.BoxGeometry(4.2, 0.095, 1.2), 0x273638, [0, 0.56, -1.1], 0.2).material = this.assets.wood;
    mesh(new THREE.BoxGeometry(4.24, 0.023, 1.24), 0x807048, [0, 0.602, -1.1], 0.55);
    mesh(new THREE.BoxGeometry(4.16, 0.02, 1.16), 0x293b3b, [0, 0.618, -1.1], 0.15).material = this.assets.wood;
    for (const x of [-1.65, 1.65]) {
      mesh(new THREE.CylinderGeometry(0.13, 0.2, 0.55, 8), 0x293c3c, [x, 0.25, -1.15], 0.3);
      mesh(new THREE.CylinderGeometry(0.22, 0.23, 0.055, 12), 0x776a49, [x, 0.02, -1.15], 0.5);
    }
    // Stone planters; instanced leaves are supplied by courtDetails().
    for (const sign of [-1, 1]) {
      mesh(new THREE.CylinderGeometry(0.38, 0.47, 0.8, 12), 0x20373b, [sign * 3.5, 0.36, -2.65]);
      mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.04, 16), 0x82754e, [sign * 3.5, 0.8, -2.65], 0.5);

    }
  }

  private buildZones() {
    const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, group: THREE.Group) => {
      const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); group.add(m); return m;
    };
    const stone = this.assets.stone;
    const wood = this.assets.wood;
    const gold = this.assets.brass;

    // ── MEETING ROOM (right, +X) ─────────────────────────────────
    const mr = this.zoneGroups.meetingRoom;
    mr.position.set(6, 0, 0);
    // Floor tile matching court
    mesh(new THREE.CylinderGeometry(5, 5, 0.14, 32), stone, 0, -0.11, -2, mr);
    // Round table
    mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.08, 12), wood, 0, 0.7, -2, mr);
    mesh(new THREE.CylinderGeometry(0.07, 0.13, 0.65, 8), wood, 0, 0.37, -2, mr);
    mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.04, 16), gold, 0, 0.02, -2, mr);
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2;
      this.assets.chair(mr, Math.sin(a) * 1.65, -2 + Math.cos(a) * 1.65, a);
    }
    // Meeting room wall + screen
    mesh(new THREE.BoxGeometry(8, 5.5, 0.3), stone, 0, 2.5, -5.5, mr);
    const mrScreenData = canvasTexture(1280, 800, ctx => {
      ctx.fillStyle = '#0d1c20'; ctx.fillRect(0, 0, 1280, 800);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#4a8fa8'; ctx.font = '34px Georgia'; ctx.fillText('Application Preview', 640, 370);
      ctx.fillStyle = '#5a7c80'; ctx.font = '18px Arial'; ctx.fillText('Comes alive when your team is building', 640, 420);
    });
    const mrScreen = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 1.88), new THREE.MeshBasicMaterial({ map: mrScreenData.texture, toneMapped: false }));
    mrScreen.position.set(0, 1.83, -5.2); mr.add(mrScreen);
    this.meetingRoomScreen = mrScreen;
    mesh(new THREE.BoxGeometry(3.1, 1.98, 0.07), wood, 0, 1.83, -5.22, mr);
    // Lights
    const mrLight = new THREE.PointLight(0x8bc4d4, 10, 7); mrLight.position.set(0, 3.5, -2); mr.add(mrLight);
    for (const sx of [-2.5, 2.5]) {
      mesh(new THREE.SphereGeometry(0.13, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffd09c }), sx, 3.1, -4.6, mr);
      const l = new THREE.PointLight(0xffc377, 6, 4); l.position.set(sx, 3.1, -4.4); mr.add(l);
    }
    this.scene.add(mr);

    // ── PERSONAL WORKSPACE (left, -X) ────────────────────────────
    const ws = this.zoneGroups.workspace;
    ws.position.set(-6, 0, 0);
    mesh(new THREE.CylinderGeometry(5, 5, 0.14, 32), stone, 0, -0.11, -2, ws);
    // Desk
    mesh(new THREE.BoxGeometry(3.8, 0.09, 1.1), wood, 0, 0.56, -1, ws);
    mesh(new THREE.BoxGeometry(3.84, 0.02, 1.14), gold, 0, 0.60, -1, ws);
    for (const [lx] of [[-1.45], [1.45]] as const)
      mesh(new THREE.CylinderGeometry(0.11, 0.18, 0.54, 8), stone, lx, 0.28, -1.1, ws);
    // Blank canvas panel
    const blankCanvas = canvasTexture(1024, 640, ctx => {
      ctx.fillStyle = '#f2ede4'; ctx.fillRect(0, 0, 1024, 640);
      ctx.strokeStyle = '#c9b88a'; ctx.lineWidth = 6; ctx.strokeRect(4, 4, 1016, 632);
      ctx.fillStyle = '#9b8c6a'; ctx.font = '24px Georgia'; ctx.textAlign = 'center';
      ctx.fillText('Your personal space', 512, 310); ctx.fillText('Think here before you address the court.', 512, 345);
    });
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.5), new THREE.MeshBasicMaterial({ map: blankCanvas.texture, toneMapped: false }));
    panel.position.set(0, 1.75, -1.9); ws.add(panel);
    mesh(new THREE.BoxGeometry(2.5, 1.6, 0.05), wood, 0, 1.75, -1.92, ws);
    // Workspace light
    const wsLight = new THREE.PointLight(0xc8d4b8, 8, 6); wsLight.position.set(0, 3, -1); ws.add(wsLight);
    // Books on desk
    for (let i = 0; i < 5; i++) {
      mesh(new THREE.BoxGeometry(0.07, 0.26 + i * 0.02, 0.2), new THREE.MeshStandardMaterial({ color: [0x4a6655, 0x5c4a2a, 0x3a4a60, 0x5a3a3a, 0x4a4a35][i], roughness: 0.8 }), -1.2 + i * 0.09, 0.73, -1.0, ws);
    }
    this.assets.chair(ws, 0, .1);
    this.assets.lantern(ws, -1.45, 1.05, -1.15);
    this.scene.add(ws);

    // ── WALL OF FAME (behind, +Z) ─────────────────────────────────
    const wof = this.zoneGroups.wallOfFame;
    wof.position.set(0, 0, 6);
    mesh(new THREE.BoxGeometry(9, 6, 0.35), stone, 0, 2.5, -2, wof);
    mesh(new THREE.BoxGeometry(9.1, 0.12, 0.4), gold, 0, 0.04, -2, wof);
    mesh(new THREE.BoxGeometry(9.1, 0.12, 0.4), gold, 0, 5.05, -2, wof);
    // Crown motif above wall
    mesh(new THREE.BoxGeometry(1.8, 0.08, 0.1), gold, 0, 5.14, -1.85, wof);
    for (const cx of [-0.7, 0, 0.7])
      mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.28, 6), gold, cx, 5.28, -1.85, wof);
    // Title plate
    const titleCanvas = canvasTexture(800, 120, ctx => {
      ctx.fillStyle = '#0e1c20'; ctx.fillRect(0, 0, 800, 120);
      ctx.strokeStyle = '#8b7040'; ctx.lineWidth = 3; ctx.strokeRect(3, 3, 794, 114);
      ctx.fillStyle = '#d5b87a'; ctx.font = '28px Georgia'; ctx.textAlign = 'center'; ctx.fillText('WALL OF FAME', 400, 52);
      ctx.fillStyle = '#7a8f82'; ctx.font = '16px Arial'; ctx.fillText('YOUR MILESTONES, REMEMBERED', 400, 88);
    });
    const titleMesh = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 0.42), new THREE.MeshBasicMaterial({ map: titleCanvas.texture, toneMapped: false }));
    titleMesh.position.set(0, 4.55, -1.82); wof.add(titleMesh);
    // 3 milestone frame slots (row, up to 3 visible at once)
    for (let i = 0; i < 3; i++) {
      const fx = (i - 1) * 2.8;
      // Outer frame
      mesh(new THREE.BoxGeometry(2.5, 1.7, 0.06), wood, fx, 2.8, -1.88, wof);
      mesh(new THREE.BoxGeometry(2.44, 1.64, 0.04), stone, fx, 2.8, -1.84, wof);
      // Canvas slot
      const slot = canvasTexture(480, 300, ctx => {
        ctx.fillStyle = '#0d1a1e'; ctx.fillRect(0, 0, 480, 300);
        ctx.strokeStyle = '#3a4a4e'; ctx.lineWidth = 2; ctx.setLineDash([8, 6]); ctx.strokeRect(12, 12, 456, 276);
        ctx.fillStyle = '#364a4e'; ctx.font = '18px Georgia'; ctx.textAlign = 'center'; ctx.fillText('Awaiting', 240, 140);
        ctx.fillStyle = '#2a3c40'; ctx.font = '14px Arial'; ctx.fillText('— milestone not yet achieved —', 240, 168);
      });
      const slotMesh = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 1.5), new THREE.MeshBasicMaterial({ map: slot.texture, toneMapped: false }));
      slotMesh.position.set(fx, 2.8, -1.81); wof.add(slotMesh);
      this.wallFameSlots.push({ frame: slotMesh, canvas: slot.canvas, ctx: slot.ctx, texture: slot.texture });
    }
    // Floor lighting for Wall of Fame
    const wofLight = new THREE.PointLight(0xb0c4cc, 9, 7); wofLight.position.set(0, 3, -1); wof.add(wofLight);
    for (const lx of [-3, 3]) {
      mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd09c }), lx, 3.2, -1.5, wof);
      const l = new THREE.PointLight(0xffc377, 5, 4); l.position.set(lx, 3.2, -1.3); wof.add(l);
    }
    this.scene.add(wof);

    // ── ZONE TRANSITION LABELS ────────────────────────────────────
    const makeLabel = (text: string, x: number, y: number, z: number, zone: typeof this.zoneLabels[number]['zone']) => {
      const lc = canvasTexture(340, 72, ctx => {
        rounded(ctx, 0, 0, 340, 72, 18, '#0e2228cc');
        ctx.strokeStyle = '#4a8fa855'; ctx.lineWidth = 2; ctx.strokeRect(2, 2, 336, 68);
        ctx.fillStyle = '#6ab8cc'; ctx.font = '22px Arial'; ctx.textAlign = 'center'; ctx.fillText(text, 170, 46);
      });
      const lm = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.23), new THREE.MeshBasicMaterial({ map: lc.texture, toneMapped: false, transparent: true, depthTest: false }));
      lm.position.set(x, y, z); lm.renderOrder = 5;
      this.scene.add(lm);
      this.zoneLabels.push({ mesh: lm, zone });
      return lm;
    };
    makeLabel('MEETING ROOM  ›', 3.8, 1.4, 0.5, 'meetingRoom');
    makeLabel('‹  WORKSPACE', -3.8, 1.4, 0.5, 'workspace');
    makeLabel('▾  WALL OF FAME', 0, 1.4, 3.8, 'wallOfFame');

    // Initially hide all zones (court is active)
    Object.values(this.zoneGroups).forEach(g => { g.visible = false; });
    this.zoneLabels.forEach(({ mesh }) => { mesh.visible = false; });
  }

  private buildGarden() {
    const g = this.gardenGroup, assets = this.assets;
    const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => assets.mesh(g, geo, mat, x, y, z);
    const floor = add(new THREE.CircleGeometry(8.8, 48), assets.soil, 0, -.055, 4);
    floor.rotation.x = -Math.PI / 2;
    // Individually laid, slightly weathered paving stones and raised edging.
    for (let row = 0; row < 17; row++) for (let col = 0; col < 3; col++) {
      const tile = add(new THREE.BoxGeometry(.48, .045, .48), assets.stone, (col - 1) * .51, -.015, -.45 + row * .51);
      tile.rotation.y = Math.sin(row * 13 + col * 7) * .018;
    }
    for (const side of [-1, 1]) {
      add(new THREE.BoxGeometry(.13, .15, 8.8), assets.stone, side * .9, .02, 3.5);
      add(new THREE.BoxGeometry(1.25, .13, 7.9), assets.soil, side * 2, -.015, 3.7);
      for (let i = 0; i < 9; i++) {
        add(new THREE.CylinderGeometry(.05, .075, .75, 7), assets.wood, side * 1.75, .35, i * .8 + .3);
      }
      for (let i = 0; i < 3; i++) {
        const z = 1 + i * 2.6;
        add(new THREE.BoxGeometry(.38, .48, .38), assets.stone, side * 1.05, .24, z);
        assets.lantern(g, side * 1.05, .85, z);
      }
      // Clipped evergreen borders with leaf-level variation, batched per garden.
      add(new THREE.BoxGeometry(.55, .48, 7.5), new THREE.MeshStandardMaterial({ color: 0x263d27, roughness: 1 }), side * 1.75, .52, 3.6);
      // Perimeter walls now use their actual world positions.
      add(new THREE.BoxGeometry(.42, .65, 8), assets.stone, side * 4, .27, 3.5);
      assets.chair(g, side * 3.05, 4.4, side * Math.PI / 2);
    }
    const shrubs = [];
    for (const side of [-1, 1]) for (let i = 0; i < 15; i++) {
      shrubs.push({ x: side * 1.75, y: .8, z: .1 + i * .52, radius: .46 });
      shrubs.push({ x: side * 4, y: 1.1, z: .1 + i * .52, radius: .72 });
    }
    // Small trees with tapering trunks, branching crowns and layered foliage.
    for (const x of [-3, 3]) for (const z of [1.5, 6.4]) {
      add(new THREE.CylinderGeometry(.09, .17, 2.4, 9), assets.wood, x, 1.15, z);
      for (let i = 0; i < 4; i++) shrubs.push({ x: x + Math.sin(i * 2.4) * .4, y: 2.6 + (i % 2) * .4, z: z + Math.cos(i * 2.4) * .4, radius: .85 });
    }
    assets.foliage(g, shrubs, 65);
    // Flower borders are instanced, avoiding hundreds of separate draw calls.
    const flowers = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.035, 1), new THREE.MeshStandardMaterial({ roughness: .88 }), 180);
    const dummy = new THREE.Object3D(), color = new THREE.Color();
    for (let i = 0; i < 180; i++) {
      const side = i % 2 ? 1 : -1;
      dummy.position.set(side * (2.35 + .3 * Math.sin(i * 4.1)), .17 + .09 * Math.sin(i * 3.7), .4 + (i / 180) * 7);
      dummy.scale.set(1.4, .65, 1.4); dummy.updateMatrix(); flowers.setMatrixAt(i, dummy.matrix);
      color.setHex([0xc9abcf, 0xe6d2a5, 0x9c8cc4][i % 3]); flowers.setColorAt(i, color);
    }
    flowers.computeBoundingSphere(); g.add(flowers);
    // Gate panels close across the opening and swing on correctly placed hinges.
    const hinge = (side: number) => {
      const pivot = new THREE.Group(); pivot.position.set(side * 1.64, 0, -.2); g.add(pivot);
      const direction = -side;
      for (let i = 0; i < 7; i++) assets.mesh(pivot, new THREE.BoxGeometry(.218, 3.05, .1), assets.wood, direction * (.12 + i * .229), 1.56, 0);
      for (const y of [.55, 1.65, 2.65]) {
        assets.mesh(pivot, new THREE.BoxGeometry(1.57, .085, .15), assets.iron, direction * .81, y, .02);
        for (let i = 0; i < 7; i++) assets.mesh(pivot, new THREE.SphereGeometry(.018, 5, 4), assets.brass, direction * (.12 + i * .229), y, .105);
      }
      assets.mesh(pivot, new THREE.TorusGeometry(.09, .017, 6, 16), assets.brass, direction * 1.4, 1.6, .14);
      return pivot;
    };
    this.gateLeft = hinge(-1); this.gateRight = hinge(1);
    for (const x of [-1.85, 1.85]) {
      add(new THREE.BoxGeometry(.48, 3.25, .65), assets.stone, x, 1.6, -.2);
      for (const y of [.12, 3.2]) add(new THREE.BoxGeometry(.65, .18, .82), assets.stone, x, y, -.2);
      assets.lantern(g, x, 2.65, .28);
    }
    add(new THREE.TorusGeometry(1.85, .24, 8, 48, Math.PI), assets.stone, 0, 3.22, -.2);
    add(new THREE.TorusGeometry(1.85, .025, 5, 48, Math.PI), assets.brass, 0, 3.22, .055);
    const gardenLight = new THREE.PointLight(0xffd5a1, 9, 14); gardenLight.position.set(-2, 4, 4); g.add(gardenLight);
    assets.batch(g, [this.gateLeft, this.gateRight]);
    assets.batch(this.gateLeft); assets.batch(this.gateRight);
    this.scene.add(g); g.visible = false;
  }

  // ── Garden / onboarding transitions ──────────────────────────────────────────

  showGarden(visible: boolean) {
    this.gardenActive = visible;
    this.gardenGroup.visible = visible;
    if (this.renderer.xr.isPresenting) this.origin.position.z = visible ? 5.5 : 1.9;
    this.dialogue.setGarden(visible);
    this.courtDetails.visible = !visible;
    if (visible) {
      if(this.gateLeft)this.gateLeft.rotation.y=0;if(this.gateRight)this.gateRight.rotation.y=0;
      this.camera.position.set(0, 1.45, 5.5);
      this.camera.lookAt(0, 1.3, 0);
      // Hide court characters while in garden
      ['architect', 'builder', 'inspector', 'artiste'].forEach(role => {
        this.characters.get(role as CourtRole)?.group && (this.characters.get(role as CourtRole)!.group.visible = false);
      });
    }
  }

  openGate(onComplete: () => void) {
    if (!this.gateLeft || !this.gateRight) { onComplete(); return; }
    if (this.reducedMotion) { this.gateLeft.rotation.y = Math.PI / 2; this.gateRight.rotation.y = -Math.PI / 2; onComplete(); return; }
    this.gateAnim = { start: performance.now(), dur: 1400, done: onComplete };
  }

  cancelGuidance() {
    this.guideGeneration++;
    const gateDone=this.gateAnim?.done, cameraDone=this.cameraAnim?.done;
    this.gateAnim=null;this.cameraAnim=null;this.guideMotion=null;
    gateDone?.();cameraDone?.();
  }
  async guideToCourt() {
    this.cancelGuidance();const generation=this.guideGeneration;
    if (this.gardenActive) {
      await new Promise<void>(resolve => this.openGate(resolve));
      if(generation!==this.guideGeneration)return;
      const guide = this.characters.get('virus');
      if (guide) {
        guide.setState('working');
        this.guideMotion = { from: guide.group.position.clone(), to: new THREE.Vector3(-1.8, .04, -.9), start: performance.now(), duration: this.reducedMotion ? 1 : 1700 };
      }
      await new Promise<void>(resolve => this.enterCourt(resolve));
      if(generation!==this.guideGeneration)return;
    }
    this.showGarden(false); this.moveVirusToCourt(); this.recenter();
    this.characters.get('virus')?.setState('idle');
    this.setCharacterVisible('virus', true);
  }

  enterCourt(onComplete: () => void) {
    if (this.renderer.xr.isPresenting || this.reducedMotion) {
      this.camera.position.set(0, 1.45, 2.1); this.camera.lookAt(0, 1.08, -1.65);
      onComplete(); return;
    }
    const fromPos = this.camera.position.clone();
    const fromLook = new THREE.Vector3(0, 1.3, 0);
    const toPos = new THREE.Vector3(0, 1.45, 2.1);
    const toLook = new THREE.Vector3(0, 1.08, -1.65);
    this.cameraAnim = { fromPos, fromLook, toPos, toLook, start: performance.now(), dur: 1700, done: onComplete };
  }

  moveVirusToCourt() {
    this.guideMotion = null;
    const v = this.characters.get('virus'); if (!v) return;
    v.group.position.set(-1.8, 0.04, -0.9);
  }

  setCharacterVisible(role: CourtRole, visible: boolean) {
    const c = this.characters.get(role); if (!c) return;
    c.group.visible = visible;
    if (role === 'artiste' && this.miraPanel) {this.miraPanel.frame.visible=visible;this.miraPanel.panel.visible=visible;}
  }

  addGestureOrbs() {
    const colors = [0x7ec8c0, 0xd4a0d0, 0xe8c87a];
    for (let i = 0; i < 3; i++) {
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 10), new THREE.MeshStandardMaterial({ color: colors[i], emissive: colors[i], emissiveIntensity: 0.4, roughness: 0.25, metalness: 0.3 }));
      orb.position.set((i - 1) * 0.6, 1.85, 3.4);
      const target = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })) as Target;
      target.position.copy(orb.position);
      target.userData.action = 'orb-pinched';
      this.scene.add(orb); this.scene.add(target);
      this.gestureOrbs.push({ mesh: orb, target });
      this.targets.push(target as Target);
    }
  }

  clearGestureOrbs() {
    for (const { mesh, target } of this.gestureOrbs) {
      this.scene.remove(mesh); this.scene.remove(target);
      this.targets = this.targets.filter(t => t !== target);
      mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose();
      target.geometry.dispose(); (target.material as THREE.Material).dispose();
    }
    this.gestureOrbs = [];
  }

  setMiraCanvas(imageDataUrl: string) {
    if (!this.miraPanel) return;
    const img = new Image(); img.src = imageDataUrl;
    img.onload = () => {
      const { ctx, texture, panel } = this.miraPanel!;
      ctx.clearRect(0, 0, 512, 512);
      ctx.drawImage(img, 0, 0, 512, 512);
      texture.needsUpdate = true;
      panel.visible = true;
    };
  }

  focusZone(zone: 'meetingRoom' | 'workspace' | 'wallOfFame') {
    const target = this.zoneGroups[zone].position.clone(); target.y = 1.45; target.z -= 2;
    if(this.renderer.xr.isPresenting){
      const head=this.renderer.xr.getCamera();
      const current=head.getWorldDirection(new THREE.Vector3());
      const desired=target.sub(head.getWorldPosition(new THREE.Vector3())).normalize();
      this.origin.rotation.y+=Math.atan2(current.x,-current.z)-Math.atan2(desired.x,-desired.z);
    }else{this.camera.lookAt(target);this.view.yaw=this.camera.rotation.y;this.view.pitch=this.camera.rotation.x;}
  }
  private getHeadYaw(): number {
    const head = this.renderer.xr.isPresenting ? this.renderer.xr.getCamera() : this.camera;
    const dir = head.getWorldDirection(new THREE.Vector3());
    return Math.atan2(dir.x, -dir.z);
  }

  private updateZones() {
    const yaw = this.getHeadYaw(); // radians, 0=toward court (-Z), +90°=right(+X)
    const Q = Math.PI / 4; // 45° boundary

    const prev = this.activeZone;
    if (yaw > Q && yaw < Math.PI - Q)          this.activeZone = 'meetingRoom';
    else if (yaw < -Q && yaw > -(Math.PI - Q)) this.activeZone = 'workspace';
    else if (Math.abs(yaw) > Math.PI - Q)       this.activeZone = 'wallOfFame';
    else                                          this.activeZone = 'court';

    // Zone culling: show zone if within ±100° of current facing
    const PAD = Math.PI * 100 / 180;
    this.zoneGroups.meetingRoom.visible = Math.abs(yaw - Math.PI / 2) < PAD;
    this.zoneGroups.workspace.visible   = Math.abs(yaw + Math.PI / 2) < PAD;
    const absYaw = Math.abs(yaw); const wofAngle = Math.abs(absYaw > Math.PI ? Math.PI * 2 - absYaw : absYaw);
    this.zoneGroups.wallOfFame.visible  = wofAngle > Math.PI - PAD;

    // Zone transition labels: show the adjacent ones when near boundary
    this.zoneLabels.forEach(({ mesh, zone }) => {
      const threshold = Math.PI * 65 / 180; // labels visible within 65° of that zone
      let angle = 0;
      if (zone === 'meetingRoom') angle = Math.abs(yaw - Math.PI / 2);
      else if (zone === 'workspace') angle = Math.abs(yaw + Math.PI / 2);
      else { const a = Math.abs(yaw); angle = Math.min(a, Math.PI * 2 - a); angle = Math.abs(angle - Math.PI); }
      mesh.visible = angle < threshold && this.activeZone !== zone;
      if (mesh.visible) mesh.lookAt(this.camera.getWorldPosition(new THREE.Vector3()));
    });

    // Update meeting room screen to share preview frame
    if (this.meetingRoomScreen && this.frame) {
      (this.meetingRoomScreen.material as THREE.MeshBasicMaterial).map = this.texture;
      (this.meetingRoomScreen.material as THREE.MeshBasicMaterial).needsUpdate = true;
    }
  }

  updateWallOfFame(milestones: { title: string; achieved: string | null; thumbnail?: string | null }[]) {
    milestones.slice(0, 3).forEach((m, i) => {
      const slot = this.wallFameSlots[i];
      if (!slot) return;
      const { ctx, texture, canvas } = slot;
      ctx.fillStyle = '#0d1a1e'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      if (m.achieved) {
        rounded(ctx, 4, 4, canvas.width - 8, canvas.height - 8, 10, '#0f2a1e');
        ctx.strokeStyle = '#4a8a6a'; ctx.lineWidth = 3; ctx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);
        ctx.fillStyle = '#7ab89a'; ctx.font = 'bold 18px Georgia'; ctx.textAlign = 'center';
        ctx.fillText('✦  ACHIEVED', canvas.width / 2, 54);
        ctx.fillStyle = '#c8dece'; ctx.font = '17px Georgia';
        const words = m.title.split(' '); let line = '', y = 110;
        for (const w of words) {
          const test = line + w + ' ';
          if (ctx.measureText(test).width > canvas.width - 40 && line) { ctx.fillText(line.trim(), canvas.width / 2, y); line = w + ' '; y += 26; }
          else line = test;
        }
        if (line) ctx.fillText(line.trim(), canvas.width / 2, y);
        ctx.fillStyle = '#4a7060'; ctx.font = '14px Arial';
        ctx.fillText(new Date(m.achieved).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }), canvas.width / 2, canvas.height - 24);
      } else {
        ctx.strokeStyle = '#2a3c40'; ctx.lineWidth = 2; ctx.setLineDash([8, 6]); ctx.strokeRect(12, 12, canvas.width - 24, canvas.height - 24);
        ctx.fillStyle = '#3a5055'; ctx.font = '17px Georgia'; ctx.textAlign = 'center';
        const words = m.title.split(' '); let line = '', y = canvas.height / 2 - 16;
        for (const w of words) {
          const test = line + w + ' ';
          if (ctx.measureText(test).width > canvas.width - 50 && line) { ctx.fillText(line.trim(), canvas.width / 2, y); line = w + ' '; y += 24; }
          else line = test;
        }
        if (line) ctx.fillText(line.trim(), canvas.width / 2, y);
        ctx.fillStyle = '#2a3c40'; ctx.font = '13px Arial'; ctx.setLineDash([]);
        ctx.fillText('— awaiting —', canvas.width / 2, canvas.height - 28);
      }
      texture.needsUpdate = true;
    });
    // Clear unused slots
    for (let i = milestones.length; i < this.wallFameSlots.length; i++) {
      const { ctx, texture, canvas } = this.wallFameSlots[i];
      ctx.fillStyle = '#0d1a1e'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = '#1e2e32'; ctx.lineWidth = 1; ctx.setLineDash([6, 5]); ctx.strokeRect(12, 12, canvas.width - 24, canvas.height - 24);
      ctx.setLineDash([]);
      texture.needsUpdate = true;
    }
  }

  private configureInput() {
    const factory = new XRHandModelFactory();
    for (let i = 0; i < 2; i++) {
      const grip = this.renderer.xr.getController(i); this.origin.add(grip);
      const ray = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -1)]), new THREE.LineBasicMaterial({ color: GOLD, transparent: true, opacity: 0.5 }));
      ray.scale.z = 5; ray.visible = false; grip.add(ray);
      const cursor = new THREE.Mesh(new THREE.RingGeometry(0.009, 0.014, 24), new THREE.MeshBasicMaterial({ color: 0xe5c58c, depthTest: false }));
      cursor.visible = false; cursor.renderOrder = 10; this.scene.add(cursor);
      const state = { grip, ray, cursor, source: undefined as XRInputSource | undefined, down: false };
      this.controllerStates.push(state);
      grip.addEventListener('connected', event => { state.source = event.data; ray.visible = true; });
      grip.addEventListener('disconnected', () => { state.source = undefined; ray.visible = false; cursor.visible = false; });
      grip.addEventListener('selectstart', () => {
        if (!state.down) { state.down = true; this.pickController(state, true); }
      });
      grip.addEventListener('selectend', () => { state.down = false; });
      const hand = this.renderer.xr.getHand(i);
      hand.add(factory.createHandModel(hand, 'spheres'));
      this.origin.add(hand);
    }
    let startX = 0, startY = 0, dragging = false, moved = false;
    this.canvas.addEventListener('pointerdown', event => {
      startX = event.clientX; startY = event.clientY; moved = false;
      dragging = event.button === 2 || event.altKey;
      if (dragging) this.canvas.setPointerCapture(event.pointerId);
    });
    this.canvas.addEventListener('pointermove', event => {
      if (dragging) {
        this.view.yaw -= event.movementX * 0.002; this.view.pitch = THREE.MathUtils.clamp(this.view.pitch - event.movementY * 0.002, -0.25, 0.25);
        this.camera.rotation.set(this.view.pitch, this.view.yaw, 0, 'YXZ');
        moved = true; return;
      }
      this.desktopRay(event);
      const hit = this.raycaster.intersectObjects(this.visibleTargets(), false)[0];
      this.hovered = !!hit && (!this.helpPanel.visible || !!hit.object.userData.action);
      this.canvas.style.cursor = this.hovered ? 'pointer' : 'default';
    });
    this.canvas.addEventListener('pointerup', event => {
      if (!dragging && !moved && Math.hypot(event.clientX - startX, event.clientY - startY) < 8 && event.button === 0) {
        this.desktopRay(event); this.activate(this.raycaster.intersectObjects(this.visibleTargets(), false)[0]);
      }
      dragging = false;
    });
    this.canvas.addEventListener('contextmenu', event => event.preventDefault());
  }

  private desktopRay(event: PointerEvent) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
  }

  private pickController(state: CourtScene['controllerStates'][number], select = false) {
    const rotation = new THREE.Matrix4().extractRotation(state.grip.matrixWorld);
    this.raycaster.ray.origin.setFromMatrixPosition(state.grip.matrixWorld);
    this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(rotation);
    const hit = this.raycaster.intersectObjects(this.visibleTargets(), false)[0];
    state.cursor.visible = !!hit;
    state.ray.scale.z = hit ? hit.distance : 4;
    if (hit) {
      state.cursor.position.copy(hit.point); state.cursor.position.z += 0.006;
      state.cursor.quaternion.copy(this.board.quaternion);
      state.cursor.scale.setScalar(state.down ? 0.7 : 1);
    }
    if (select) this.activate(hit);
  }

  private activate(hit?: THREE.Intersection) {
    if (!hit) return;
    const target = hit.object as Target;
    if (target.userData.brain && target.userData.role) { this.callbacks.action(`brain-set:${target.userData.role}:${target.userData.brain}`); return; }
    if (target.userData.character) { this.callbacks.character(target.userData.character); return; }
    if (target.userData.dialogue && hit.uv) { const action = this.dialogue.actionAt(hit.uv); if (action) this.callbacks.action(action); return; }
    if (target.userData.action) { this.callbacks.action(target.userData.action); this.feedbackUntil = performance.now() + 180; return; }
    if (target.userData.screen && hit.uv && this.status === 'ready' && !this.stale && !this.helpPanel.visible) {
      this.callbacks.click(Math.round(hit.uv.x * WIDTH), Math.round((1 - hit.uv.y) * HEIGHT));
      this.callbacks.feedback(); this.feedbackUntil = performance.now() + 180;
      for (const state of this.controllerStates) state.source?.gamepad?.hapticActuators?.[0]?.pulse(0.22, 35).catch(() => {});
    }
  }

  private visibleTargets() {
    return this.targets.filter(target => {
      let parent: THREE.Object3D | null = target;
      while (parent) { if (!parent.visible) return false; parent = parent.parent; }
      return true;
    });
  }

  get zone() { return this.activeZone; }
  selectCharacter(role: CourtRole) { this.characters.forEach((character, id) => character.setSelected(id === role)); }
  setCharacterState(role: CourtRole, state: CharacterState) { this.characters.get(role)?.setState(state); }
  setAvailableBrains(providers: BrainProvider[]) { this.characters.forEach(character => character.setAvailableBrains(providers)); }
  setBrain(role: CourtRole, provider: BrainProvider) { this.characters.get(role)?.setBrain(provider); }
  openHead(role: CourtRole | null) { this.characters.forEach((character, id) => character.openHead(id === role)); }
  setSpeechAmplitude(role: CourtRole, amplitude: number) { this.characters.get(role)?.setAmplitude(amplitude); }
  showPreview(visible: boolean) {
    this.previewVisible = visible; this.board.visible = visible;
    this.characters.forEach(character => { character.group.visible = !visible; });
    this.dialogue.mesh.visible = !visible && this.renderer.xr.isPresenting;
    if (visible) { this.camera.position.set(0, 1.72, 1.9); this.camera.rotation.set(0, 0, 0); }
    else if (!this.renderer.xr.isPresenting) { this.camera.position.set(0, 1.45, 2.1); this.camera.lookAt(0, 1.08, -1.65); }
    this.vrControls.forEach(mesh => { mesh.visible = visible && this.renderer.xr.isPresenting; });
    if (this.renderer.xr.isPresenting && visible) this.vrControls[this.vrControls.length - 1].userData.action = 'court';
  }

  updateFrame(bitmap: ImageBitmap) {
    this.frame?.close(); this.frame = bitmap;
    this.texture.image = bitmap; this.texture.flipY = false;
    this.texture.needsUpdate = true; this.lastFrame = performance.now();
  }

  setStatus(status: ConnectionState, stale = false) {
    this.status = status;
    this.stale = stale;
    const { ctx, texture } = this.statusPanel;
    ctx.fillStyle = '#102125'; ctx.fillRect(0, 0, 1280, 110);
    ctx.beginPath(); ctx.arc(33, 39, 5, 0, Math.PI * 2); ctx.fillStyle = status === 'ready' && !stale ? '#9cb38b' : '#d0aa6b'; ctx.fill();
    ctx.textAlign = 'left'; ctx.fillStyle = '#c5cdbd'; ctx.font = '17px Arial';
    ctx.fillText(stale ? 'STALE PREVIEW · WAITING FOR A FRESH FRAME' : status === 'ready' ? 'LIVE APPLICATION' : status === 'connecting' ? 'CONNECTING TO APPLICATION' : 'PREVIEW PAUSED · RECONNECT FROM DESKTOP', 52, 46);
    ctx.textAlign = 'right'; ctx.fillStyle = '#98a99b'; ctx.font = '15px Arial'; ctx.fillText('POINT TO AIM  ·  PINCH TO SELECT', 1248, 46);
    ctx.textAlign = 'left'; ctx.font = '14px Arial'; ctx.fillStyle = '#718c82'; ctx.fillText('Local browser stream  /  Your tasks are saved after each action', 28, 82);
    texture.needsUpdate = true;
    (this.surface.material as THREE.MeshBasicMaterial).color.set(status === 'offline' || status === 'error' || stale ? 0x556064 : 0xffffff);
  }

  toggleHelp() { this.helpPanel.visible = !this.helpPanel.visible; return this.helpPanel.visible; }
  setHelp(visible: boolean) { this.helpPanel.visible = visible; }
  setReducedMotion(reduced: boolean) { this.reducedMotion = reduced; }

  resizeBoard() {
    this.large = !this.large;
    this.board.scale.setScalar(this.large ? 1.12 : 1);
    this.board.position.y = this.large ? 1.95 : 1.83;
    return this.large;
  }

  recenter() {
    this.view = { yaw: 0, pitch: 0 };
    if (this.renderer.xr.isPresenting) {
      const head = this.renderer.xr.getCamera();
      const headPos = head.getWorldPosition(new THREE.Vector3());
      const facing = head.getWorldDirection(new THREE.Vector3()); facing.y = 0; facing.normalize();
      if (!this.previewVisible) {
        const localHead = this.origin.worldToLocal(headPos.clone());
        this.origin.rotation.y -= Math.atan2(-facing.x, -facing.z);
        const rotated = localHead.applyQuaternion(this.origin.quaternion);
        this.origin.position.x = -rotated.x;
        this.origin.position.z = 1.9 - rotated.z;
        this.origin.updateMatrixWorld(true);
        return;
      }
      const pos = headPos.clone().addScaledVector(facing, 3.7);
      this.board.position.set(pos.x, headPos.y + 0.11, pos.z);
      this.board.rotation.y = Math.atan2(-facing.x, -facing.z);
    } else {
      if (this.previewVisible) { this.camera.position.set(0, 1.72, 1.9); this.camera.rotation.set(0, 0, 0); }
      else { this.camera.position.set(0, 1.45, 2.1); this.camera.lookAt(0, 1.08, -1.65); }
      this.board.position.set(0, this.large ? 1.95 : 1.83, -1.8); this.board.rotation.set(0, 0, 0);
    }
  }

  async enterVR() {
    if (!navigator.xr) throw new Error('Open this page in Meta Quest Browser to enter VR.');
    const supported = await navigator.xr.isSessionSupported('immersive-vr');
    if (!supported) throw new Error('This browser does not have an immersive VR headset available. Open the Network URL in Quest Browser.');
    const session = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'] });
    try { await this.renderer.xr.setSession(session); }
    catch (error) { await session.end(); throw error; }
  }

  async exitVR() { await this.renderer.xr.getSession()?.end(); }

  private resize = () => {
    const rect = this.canvas.getBoundingClientRect();
    if (this.renderer.xr.isPresenting) return;
    this.camera.aspect = rect.width / rect.height;
    this.camera.fov = rect.width < 800 ? 66 : 48;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(rect.width, rect.height, false);
  };

  private animate = (time: number) => {
    if (this.disposed) return;
    // Desktop is a static companion view. Reserve the unrestricted native XR
    // render loop for the headset, independently of browser capture cadence.
    if (!this.renderer.xr.isPresenting && time - this.lastRender < 32) return;
    this.lastRender = time;
    this.frames++;
    if (time - this.fpsTime >= 1200) { this.fps = Math.round(this.frames * 1000 / (time - this.fpsTime)); this.onFps?.(this.fps); this.frames = 0; this.fpsTime = time; }
    if (this.renderer.xr.isPresenting) {
      for (const state of this.controllerStates) if (state.source) this.pickController(state);
      const session = this.renderer.xr.getSession();
      // Native WebXR select events are used for both hand pinches and controllers.
      // Hand joints remain rendering-only; no duplicate gesture recognizer can fire twice.
      if (session) this.phase = time;
    }
    if (this.guideMotion) {
      const progress = Math.min(1, (time - this.guideMotion.start) / this.guideMotion.duration);
      const guide = this.characters.get('virus');
      guide?.group.position.lerpVectors(this.guideMotion.from, this.guideMotion.to, THREE.MathUtils.smoothstep(progress, 0, 1));
      if (progress === 1) this.guideMotion = null;
    }
    // Gate open animation
    if (this.gateAnim && this.gateLeft && this.gateRight) {
      const gt = Math.min(1, (time - this.gateAnim.start) / this.gateAnim.dur);
      const gEase = gt < 0.5 ? 2 * gt * gt : -1 + (4 - 2 * gt) * gt;
      this.gateLeft.rotation.y = THREE.MathUtils.lerp(0, Math.PI / 2, gEase);
      this.gateRight.rotation.y = THREE.MathUtils.lerp(0, -Math.PI / 2, gEase);
      if (gt >= 1) { const done = this.gateAnim.done; this.gateAnim = null; done(); }
    }
    // Camera transition animation (garden → court, desktop only)
    if (this.cameraAnim && !this.renderer.xr.isPresenting) {
      const ct = Math.min(1, (time - this.cameraAnim.start) / this.cameraAnim.dur);
      const cEase = ct < 0.5 ? 2 * ct * ct : -1 + (4 - 2 * ct) * ct;
      this.camera.position.lerpVectors(this.cameraAnim.fromPos, this.cameraAnim.toPos, cEase);
      const look = new THREE.Vector3().lerpVectors(this.cameraAnim.fromLook, this.cameraAnim.toLook, cEase);
      this.camera.lookAt(look);
      if (ct >= 1) { const done = this.cameraAnim.done; this.cameraAnim = null; done(); }
    }
    // Gesture orb pulse
    for (const { mesh } of this.gestureOrbs) {
      (mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.35 + Math.sin(time / 1000 * 2.5) * 0.2;
    }
    const material = this.surface.material as THREE.MeshBasicMaterial;
    const headPosition = this.renderer.xr.isPresenting ? this.renderer.xr.getCamera().getWorldPosition(new THREE.Vector3()) : this.camera.getWorldPosition(new THREE.Vector3());
    this.characters.forEach(character => character.animate(time / 1000, headPosition));
    this.updateZones();
    if (this.status === 'ready') {
      const stale = !!this.lastFrame && performance.now() - this.lastFrame > 10_000;
      if (stale !== this.stale) this.setStatus('ready', stale);
      material.color.setHex(stale ? 0x697576 : performance.now() < this.feedbackUntil ? 0xfff2d6 : 0xffffff);
    }
    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    this.disposed = true; this.renderer.setAnimationLoop(null); window.removeEventListener('resize', this.resize);
    this.scene.traverse(object => { if (object instanceof THREE.Mesh) { object.geometry.dispose(); const materials = Array.isArray(object.material) ? object.material : [object.material]; materials.forEach(material => { (material as THREE.MeshBasicMaterial).map?.dispose(); (material as THREE.MeshStandardMaterial).bumpMap?.dispose(); material.dispose(); }); } });
    this.frame?.close(); this.renderer.dispose();
  }
}
