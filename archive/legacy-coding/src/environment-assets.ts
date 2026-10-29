import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Local, deterministic assets: no downloads, model licences, or runtime requests.
let seed = 731;
const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

function surface(kind: 'stone' | 'wood' | 'soil' | 'leather') {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  const base = { stone: [108, 111, 105], wood: [94, 61, 35], soil: [66, 74, 44], leather: [54, 67, 60] }[kind];
  const pixels = ctx.createImageData(512, 512);
  for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) {
    const grain = kind === 'wood' ? Math.sin(x * .17 + Math.sin(y * .013) * 3) * 10 + Math.sin(x * .63) * 4 : 0;
    const n = (random() - .5) * (kind === 'leather' ? 15 : 24) + grain;
    const i = (y * 512 + x) * 4;
    for (let c = 0; c < 3; c++) pixels.data[i + c] = base[c] + n;
    pixels.data[i + 3] = 255;
  }
  ctx.putImageData(pixels, 0, 0);
  if (kind === 'stone') {
    ctx.strokeStyle = '#414946'; ctx.lineWidth = 4;
    for (let row = 0; row < 4; row++) {
      ctx.beginPath(); ctx.moveTo(0, row * 128); ctx.lineTo(512, row * 128); ctx.stroke();
      for (let col = 0; col < 3; col++) {
        const x = col * 256 + (row % 2) * 128;
        ctx.beginPath(); ctx.moveTo(x, row * 128); ctx.lineTo(x, (row + 1) * 128); ctx.stroke();
      }
    }
  }
  const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping; map.anisotropy = 4;
  // Bump maps contain linear height data, independent of the colour texture.
  const bump = new THREE.CanvasTexture(canvas); bump.wrapS = bump.wrapT = THREE.RepeatWrapping;
  return { map, bump };
}

export class EnvironmentAssets {
  readonly stone: THREE.MeshStandardMaterial;
  readonly wood: THREE.MeshStandardMaterial;
  readonly soil: THREE.MeshStandardMaterial;
  readonly leather: THREE.MeshStandardMaterial;
  readonly brass = new THREE.MeshStandardMaterial({ color: 0xa8884f, metalness: .72, roughness: .39 });
  readonly iron = new THREE.MeshStandardMaterial({ color: 0x252a2b, metalness: .65, roughness: .58 });
  private contact: THREE.MeshBasicMaterial;
  constructor() {
    const shadow = document.createElement('canvas'); shadow.width = shadow.height = 64;
    const ctx = shadow.getContext('2d')!;
    const gradient = ctx.createRadialGradient(32, 32, 3, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(0,0,0,.48)'); gradient.addColorStop(.45, 'rgba(0,0,0,.25)'); gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 64, 64);
    this.contact = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(shadow), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
    const material = (kind: Parameters<typeof surface>[0], color: number, roughness: number, repeat: number) => {
      const { map, bump } = surface(kind); map.repeat.set(repeat, repeat); bump.repeat.copy(map.repeat);
      return new THREE.MeshStandardMaterial({ color, map, bumpMap: bump, bumpScale: kind === 'stone' ? .035 : .012, roughness });
    };
    this.stone = material('stone', 0xd0d4cd, .94, 3);
    this.wood = material('wood', 0xdec4a4, .67, 2);
    this.soil = material('soil', 0xa6b68a, 1, 7);
    this.leather = material('leather', 0xa5b3a0, .86, 2);
  }
  mesh(parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number) {
    const mesh = new THREE.Mesh(geometry, material); mesh.position.set(x, y, z); parent.add(mesh); return mesh;
  }
  batch(root: THREE.Group, excluded: THREE.Object3D[] = []) {
    root.updateMatrixWorld(true);
    const inverse = root.matrixWorld.clone().invert();
    const buckets = new Map<THREE.Material, THREE.Mesh[]>();
    root.traverse(object => {
      if (!(object instanceof THREE.Mesh) || object instanceof THREE.InstancedMesh || Array.isArray(object.material)) return;
      for (let p: THREE.Object3D | null = object; p && p !== root; p = p.parent) if (excluded.includes(p)) return;
      const list = buckets.get(object.material) || []; list.push(object); buckets.set(object.material, list);
    });
    buckets.forEach((meshes, material) => {
      if (meshes.length < 2) return;
      const parts = meshes.map(mesh => {
        const g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
        g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, mesh.matrixWorld)); return g;
      });
      const merged = mergeGeometries(parts);
      parts.forEach(p => p.dispose());
      if (!merged) return;
      meshes.forEach(mesh => { mesh.removeFromParent(); mesh.geometry.dispose(); });
      root.add(new THREE.Mesh(merged, material));
    });
  }
  lantern(parent: THREE.Object3D, x: number, y: number, z: number) {
    const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g);
    this.mesh(g, new THREE.CylinderGeometry(.18, .22, .09, 8), this.iron, 0, -.22, 0);
    this.mesh(g, new THREE.ConeGeometry(.25, .19, 4), this.iron, 0, .28, 0).rotation.y = Math.PI / 4;
    const glow = new THREE.MeshBasicMaterial({ color: 0xffd293 });
    this.mesh(g, new THREE.CylinderGeometry(.085, .085, .32, 8), glow, 0, 0, 0);
    for (const dx of [-.13, .13]) for (const dz of [-.13, .13])
      this.mesh(g, new THREE.CylinderGeometry(.013, .013, .43, 5), this.iron, dx, .015, dz);
    this.mesh(g, new THREE.TorusGeometry(.065, .012, 5, 12), this.brass, 0, .43, 0);
  }
  foliage(parent: THREE.Object3D, clusters: { x: number; y: number; z: number; radius: number }[], count = 65) {
    const geometry = new THREE.SphereGeometry(1, 7, 5);
    const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .96 });
    const leaves = new THREE.InstancedMesh(geometry, material, clusters.length * count);
    const dummy = new THREE.Object3D(); const color = new THREE.Color(); let i = 0;
    for (const c of clusters) for (let n = 0; n < count; n++) {
      const a = random() * Math.PI * 2; const v = random() * 2 - 1; const r = Math.cbrt(random()) * c.radius;
      dummy.position.set(c.x + Math.cos(a) * Math.sqrt(1 - v * v) * r, c.y + v * r * .8, c.z + Math.sin(a) * Math.sqrt(1 - v * v) * r);
      const s = .07 + random() * .12; dummy.scale.set(s * 1.5, s * .28, s * .65);
      dummy.rotation.set(random() * 3, random() * 6, random() * 3); dummy.updateMatrix(); leaves.setMatrixAt(i, dummy.matrix);
      color.setHSL(.23 + random() * .1, .24 + random() * .22, .12 + random() * .14); leaves.setColorAt(i++, color);
    }
    leaves.computeBoundingSphere(); parent.add(leaves);
  }
  chair(parent: THREE.Object3D, x: number, z: number, yaw = 0, throne = false) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = yaw; parent.add(g);
    const width = throne ? .85 : .54; const back = throne ? 1.4 : .65;
    const shadow = this.mesh(g, new THREE.PlaneGeometry(width + .5, 1.15), this.contact, 0, .012, 0);
    shadow.rotation.x = -Math.PI / 2;
    this.mesh(g, new THREE.BoxGeometry(width, .12, .58), this.wood, 0, .46, 0);
    this.mesh(g, new THREE.BoxGeometry(width - .09, .065, .48), this.leather, 0, .55, 0);
    this.mesh(g, new THREE.BoxGeometry(width, back, .09), this.wood, 0, .52 + back / 2, .25);
    this.mesh(g, new THREE.BoxGeometry(width - .15, back - .15, .045), this.leather, 0, .52 + back / 2, .192);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) this.mesh(g, new THREE.CylinderGeometry(.035, .05, .43, 8), this.wood, sx * (width / 2 - .06), .22, sz * .22);
      this.mesh(g, new THREE.BoxGeometry(.07, .07, .56), this.wood, sx * (width / 2 - .02), .76, 0);
      this.mesh(g, new THREE.CylinderGeometry(.024, .024, .22, 8), this.brass, sx * (width / 2 - .02), .65, -.21);
      this.mesh(g, new THREE.SphereGeometry(.045, 8, 6), this.brass, sx * (width / 2 - .04), .55 + back, .25);
    }
  }
  courtDetails(parent: THREE.Object3D) {
    this.chair(parent, 0, 2.55, 0, true);
    // Flagstone approach, brass desk edge, and an inset writing surface.
    this.mesh(parent, new THREE.BoxGeometry(1.3, .018, .85), this.leather, 0, .638, -1.1);
    for (const x of [-1.65, 1.65]) {
      this.mesh(parent, new THREE.CylinderGeometry(.11, .09, .17, 16), this.brass, x, .73, -1.05);
      this.mesh(parent, new THREE.TorusGeometry(.115, .015, 6, 16), this.brass, x, .83, -1.05).rotation.x = Math.PI / 2;
    }
    // Rounded column shafts and carved capitals reinforce the existing arch.
    for (const x of [-3.25, 3.25]) {
      this.mesh(parent, new THREE.CylinderGeometry(.28, .34, 3.05, 16), this.stone, x, 1.58, -5.5);
      for (const y of [.1, .25, 3.05, 3.22]) this.mesh(parent, new THREE.BoxGeometry(.78, .12, .78), this.stone, x, y, -5.5);
      this.lantern(parent, x, 2.35, -4.9);
    }
    for (const x of [-3.5, 3.5]) {
      const shadow = this.mesh(parent, new THREE.PlaneGeometry(1.6, 1.6), this.contact, x, -.026, -2.65);
      shadow.rotation.x = -Math.PI / 2;
    }
    this.foliage(parent, [-1, 1].flatMap(s => [0, 1, 2].map(i => ({ x: s * 3.5, y: 1 + i * .24, z: -2.65, radius: .42 - i * .08 }))), 45);
  }
}
