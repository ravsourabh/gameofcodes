import * as THREE from 'three';
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
    this.renderer.toneMappingExposure = 1.22;
    this.renderer.xr.enabled = true;
    this.renderer.xr.setFramebufferScaleFactor(1);
    this.renderer.xr.setReferenceSpaceType('local-floor');
    this.scene.background = new THREE.Color(0x101c26);
    this.scene.fog = new THREE.FogExp2(0x10242a, 0.016);
    this.camera.position.set(0, 1.45, 2.1); this.camera.lookAt(0, 1.08, -1.65);
    this.origin.add(this.camera); this.scene.add(this.origin);
    this.scene.add(new THREE.HemisphereLight(0xd0e5d8, 0x2e2c24, 2.7));
    const sun = new THREE.DirectionalLight(0xffd5a0, 3.1); sun.position.set(-5, 8, -5); this.scene.add(sun);
    const fill = new THREE.PointLight(0xa7c5ce, 18, 12); fill.position.set(0, 4, 3); this.scene.add(fill);
    this.environment();
    for (const [role, x, z] of [['builder', -1.12, -1.42], ['architect', 0, -1.65], ['inspector', 1.12, -1.42]] as const) {
      const character = new CourtCharacter(role, x, z); this.characters.set(role, character); this.scene.add(character.group); this.targets.push(character.hitbox as Target);
      this.targets.push(...character.brainTargets as Target[]);
    }
    this.characters.get('architect')!.setSelected(true);
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
      this.origin.position.set(0, 0, 1.9); this.origin.rotation.set(0, 0, 0);
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
      const object = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, roughness: 0.8 - metalness * 0.4, metalness }));
      object.position.set(position[0], position[1], position[2]); this.scene.add(object); return object;
    };
    const sky = new THREE.Mesh(new THREE.SphereGeometry(55, 24, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false,
      vertexShader: 'varying vec3 vPos; void main(){vPos=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: 'varying vec3 vPos; void main(){float h=normalize(vPos).y;vec3 a=vec3(0.17,0.31,0.34);vec3 b=vec3(0.055,0.13,0.20);vec3 c=vec3(0.52,0.51,0.37);vec3 color=mix(a,b,smoothstep(0.0,0.65,h));color=mix(color,c,exp(-abs(h-0.035)*16.0)*0.6);gl_FragColor=vec4(color,1.0);}' }));
    this.scene.add(sky);
    const floor = mesh(new THREE.CylinderGeometry(8, 8, 0.18, 64), 0x1b2a2d, [0, -0.13, 0], 0.15);
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
    mesh(new THREE.BoxGeometry(4.2, 0.095, 1.2), 0x273638, [0, 0.56, -1.1], 0.2);
    mesh(new THREE.BoxGeometry(4.24, 0.023, 1.24), 0x807048, [0, 0.602, -1.1], 0.55);
    mesh(new THREE.BoxGeometry(4.16, 0.02, 1.16), 0x293b3b, [0, 0.618, -1.1], 0.15);
    for (const x of [-1.65, 1.65]) {
      mesh(new THREE.CylinderGeometry(0.13, 0.2, 0.55, 8), 0x293c3c, [x, 0.25, -1.15], 0.3);
      mesh(new THREE.CylinderGeometry(0.22, 0.23, 0.055, 12), 0x776a49, [x, 0.02, -1.15], 0.5);
    }
    // Quiet details to either side, with no textures or remote asset requests.
    for (const sign of [-1, 1]) {
      mesh(new THREE.CylinderGeometry(0.38, 0.47, 0.8, 12), 0x20373b, [sign * 3.5, 0.36, -2.65]);
      mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.04, 16), 0x82754e, [sign * 3.5, 0.8, -2.65], 0.5);
      for (let i = 0; i < 6; i++) {
        const leaf = mesh(new THREE.ConeGeometry(0.22, 1.2 + i * 0.08, 5), 0x3a6558, [sign * 3.5 + Math.sin(i * 2) * 0.2, 1.35, -2.65 + Math.cos(i * 2) * 0.2]);
        leaf.rotation.z = Math.sin(i * 2) * 0.32;
      }
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

  selectCharacter(role: CourtRole) { this.characters.forEach((character, id) => character.setSelected(id === role)); }
  setCharacterState(role: CourtRole, state: CharacterState) { this.characters.get(role)?.setState(state); }
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
    const material = this.surface.material as THREE.MeshBasicMaterial;
    const headPosition = this.renderer.xr.isPresenting ? this.renderer.xr.getCamera().getWorldPosition(new THREE.Vector3()) : this.camera.getWorldPosition(new THREE.Vector3());
    this.characters.forEach(character => character.animate(time / 1000, headPosition));
    if (this.status === 'ready') {
      const stale = !!this.lastFrame && performance.now() - this.lastFrame > 10_000;
      if (stale !== this.stale) this.setStatus('ready', stale);
      material.color.setHex(stale ? 0x697576 : performance.now() < this.feedbackUntil ? 0xfff2d6 : 0xffffff);
    }
    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    this.disposed = true; this.renderer.setAnimationLoop(null); window.removeEventListener('resize', this.resize);
    this.scene.traverse(object => { if (object instanceof THREE.Mesh) { object.geometry.dispose(); const materials = Array.isArray(object.material) ? object.material : [object.material]; materials.forEach(material => { (material as THREE.MeshBasicMaterial).map?.dispose(); material.dispose(); }); } });
    this.frame?.close(); this.renderer.dispose();
  }
}
