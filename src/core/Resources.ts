import * as THREE from 'three';
import { paperMaterial } from '../shaders/Materials';

export const BASE = import.meta.env.BASE_URL;
export const PALETTE = { ink: '#0e120f', ivory: '#e5dfcf', ochre: '#a99670', red: '#8d302b', green: '#23473c', cold: '#8d9692' };

export class Resources {
  private readonly canvasScale = matchMedia('(max-width: 760px)').matches ? 0.6 : 1;
  private textures = new Map<string, THREE.Texture>();
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  readonly pending: Promise<unknown>[] = [];
  readonly failures: string[] = [];
  private loader = new THREE.TextureLoader();

  geometry<T extends THREE.BufferGeometry>(geometry: T): T { this.geometries.add(geometry); return geometry; }
  material<T extends THREE.Material>(material: T): T { this.materials.add(material); return material; }

  texture(file: string, linearData = false): THREE.Texture {
    const key = linearData ? `data:${file}` : file;
    if (this.textures.has(key)) return this.textures.get(key)!;
    const texture = this.loader.load(BASE + file.replace(/^\//, ''), () => {}, undefined, () => { this.failures.push(file); });
    texture.colorSpace = linearData ? THREE.NoColorSpace : THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    this.textures.set(key, texture);
    return texture;
  }

  canvasTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    this.textures.set(`canvas:${this.textures.size}`, texture);
    return texture;
  }

  text(text: string, size: number, color = PALETTE.ivory, width = 1600, height = 320, background?: string): THREE.CanvasTexture {
    const canvas = document.createElement('canvas'); canvas.width = Math.ceil(width * this.canvasScale); canvas.height = Math.ceil(height * this.canvasScale);
    const context = canvas.getContext('2d')!;
    context.scale(this.canvasScale, this.canvasScale);
    if (background) { context.fillStyle = background; context.fillRect(0, 0, width, height); }
    context.fillStyle = color; context.textAlign = 'center'; context.textBaseline = 'middle';
    context.font = `${size}px "Historical Song", "Noto Serif SC", "Songti SC", SimSun, Georgia, serif`;
    context.fillText(text, width / 2, height / 2, width * 0.96);
    return this.canvasTexture(canvas);
  }

  document(title: string, lines: string[], tint = '#d6cbb0'): THREE.CanvasTexture {
    const canvas = document.createElement('canvas'); canvas.width = Math.ceil(1024 * this.canvasScale); canvas.height = Math.ceil(1400 * this.canvasScale);
    const context = canvas.getContext('2d')!;
    context.scale(this.canvasScale, this.canvasScale);
    context.fillStyle = tint; context.fillRect(0, 0, 1024, 1400);
    let seed = 9;
    for (let i = 0; i < 17000; i++) {
      seed = (seed * 16807) % 2147483647;
      const x = (seed % 1024); seed = (seed * 16807) % 2147483647;
      context.fillStyle = `rgba(70,51,31,${(seed % 9) / 130})`;
      context.fillRect(x, seed % 1400, 1, 1 + seed % 3);
    }
    context.strokeStyle = '#615540'; context.lineWidth = 2; context.strokeRect(53, 50, 918, 1298);
    context.textAlign = 'center'; context.fillStyle = '#2d2b24';
    context.font = '66px "Historical Song", SimSun, Georgia, serif'; context.fillText(title, 512, 170, 880);
    context.strokeStyle = '#71624b'; context.beginPath(); context.moveTo(105, 211); context.lineTo(919, 211); context.stroke();
    context.font = '38px "Historical Song", SimSun, Georgia, serif';
    lines.forEach((line, i) => context.fillText(line, 512, 325 + i * 95, 810));
    context.font = '22px Georgia'; context.fillText('HISTORICAL TEXT · SPATIAL RECONSTRUCTION', 512, 1280);
    return this.canvasTexture(canvas);
  }

  plane(texture: THREE.Texture, width: number, height: number, kind: 'ink' | 'photo' | 'burn' = 'ink', distanceField?: THREE.Texture): THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> {
    return new THREE.Mesh(this.geometry(new THREE.PlaneGeometry(width, height, 16, 16)), this.material(paperMaterial(texture, kind, distanceField)));
  }

  label(text: string, width: number, color = PALETTE.ivory, fontSize = 132): THREE.Mesh {
    const texture = this.text(text, fontSize, color);
    const material = this.material(new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    return new THREE.Mesh(this.geometry(new THREE.PlaneGeometry(width, width / 5)), material);
  }

  dispose(): void {
    this.textures.forEach(texture => texture.dispose()); this.geometries.forEach(geometry => geometry.dispose());
    this.materials.forEach(material => material.dispose()); this.textures.clear(); this.materials.clear(); this.geometries.clear();
  }
}

export const clamp = (n: number, a = 0, b = 1): number => Math.min(b, Math.max(a, n));
export const smooth = (n: number): number => { const t = clamp(n); return t * t * (3 - 2 * t); };
export const noise = (n: number): number => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123; return x - Math.floor(x); };

export function line(resources: Resources, points: THREE.Vector3[], color = PALETTE.ochre, opacity = 0.5): THREE.Line {
  return new THREE.Line(resources.geometry(new THREE.BufferGeometry().setFromPoints(points)), resources.material(new THREE.LineBasicMaterial({ color, transparent: true, opacity })));
}

export function box(resources: Resources, x: number, y: number, z: number, color = PALETTE.ink): THREE.Mesh {
  return new THREE.Mesh(resources.geometry(new THREE.BoxGeometry(x, y, z)), resources.material(new THREE.MeshStandardMaterial({ color, roughness: 0.87, metalness: 0.06 })));
}

export function humanGeometry(resources: Resources, kind = 0): THREE.ShapeGeometry {
  const s = new THREE.Shape();
  s.moveTo(-0.11, 1.48); s.bezierCurveTo(-0.32, 1.7, -0.17, 1.99, 0, 1.99); s.bezierCurveTo(0.21, 1.98, 0.28, 1.7, 0.11, 1.48);
  s.lineTo(0.32, 1.35); s.lineTo(0.45, 0.82); s.lineTo(0.31, 0.77); s.lineTo(0.20, 1.15);
  s.lineTo(kind % 3 === 0 ? 0.34 : 0.24, 0.62); s.lineTo(0.20, 0); s.lineTo(0.05, 0); s.lineTo(0, 0.57);
  s.lineTo(-0.05, 0); s.lineTo(-0.21, 0); s.lineTo(kind % 3 === 0 ? -0.34 : -0.24, 0.62);
  s.lineTo(-0.2, 1.15); s.lineTo(-0.31, 0.77); s.lineTo(-0.45, 0.83); s.lineTo(-0.32, 1.35); s.closePath();
  return resources.geometry(new THREE.ShapeGeometry(s, 8));
}

export function crowd(resources: Resources, count: number, spread: number, color = '#131713'): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(humanGeometry(resources), resources.material(new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true })), count);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    const scale = 0.45 + noise(i + 9) * 0.5;
    dummy.position.set((noise(i + 1) - 0.5) * spread, -3, (noise(i + 80) - 0.5) * spread * 0.42);
    dummy.scale.setScalar(scale); dummy.rotation.y = (noise(i) - 0.5) * 0.2; dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true; return mesh;
}
