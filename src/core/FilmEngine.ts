import * as THREE from 'three';
import { CHAPTERS, FILM_DURATION } from '../content/chapters';
import { Resources, BASE, PALETTE, noise, clamp, smooth } from './Resources';
import { makeWorld, opacityWorld, type World } from '../scenes/Worlds';
import { particleMaterial, transitionMaterial } from '../shaders/Materials';

export interface FrameState { time: number; chapterIndex: number; progress: number; playing: boolean; ended: boolean }
export interface EngineOptions { onFrame: (state: FrameState) => void; onError: (message: string) => void; reducedMotion: boolean }
type CalligraphyPoints = { width: number; height: number; points: number[][] };

export class FilmEngine {
  readonly renderer: THREE.WebGLRenderer;
  readonly resources = new Resources();
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(42, 1, 0.1, 160);
  readonly mobile = matchMedia('(max-width: 760px)').matches;
  private worlds = new Map<number, World>();
  private options: EngineOptions;
  private time = 0;
  private _playing = false;
  private last = 0;
  private atmosphere = 0;
  private loop = 0;
  private disposed = false;
  private interactive = { x: 0, y: 0, targetX: 0, targetY: 0 };
  private target: THREE.WebGLRenderTarget;
  private postScene = new THREE.Scene();
  private postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private post: THREE.ShaderMaterial;
  private wash: THREE.ShaderMaterial;
  private washScene = new THREE.Scene();
  private particles: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private particleCount: number;
  private calligraphy?: CalligraphyPoints;
  private particleChapter = -1;
  private ambient: THREE.AmbientLight;
  private key: THREE.DirectionalLight;
  private fill: THREE.PointLight;
  private savedVisibility = false;
  private look = new THREE.Vector3();
  private desiredPosition = new THREE.Vector3();
  private desiredQuaternion = new THREE.Quaternion();
  private dummyCamera = new THREE.PerspectiveCamera();
  private background = new THREE.Color(PALETTE.ink);
  private nextBackground = new THREE.Color();
  private documentReading = false;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private resizeObserver: ResizeObserver;

  constructor(container: HTMLElement, options: EngineOptions) {
    this.options = options;
    this.renderer = new THREE.WebGLRenderer({ alpha: false, antialias: !this.mobile, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace; this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.15; this.renderer.info.autoReset = false;
    this.renderer.setClearColor(this.background); this.renderer.domElement.className = 'art-canvas'; this.renderer.domElement.setAttribute('aria-hidden', 'true');
    container.append(this.renderer.domElement);
    this.scene.fog = new THREE.FogExp2(PALETTE.ink, 0.009);
    this.ambient = new THREE.AmbientLight('#bdc3a7', 1.3); this.key = new THREE.DirectionalLight('#f1e2bc', 3.2); this.key.position.set(-7, 10, 12);
    this.fill = new THREE.PointLight('#f0e6c6', 85, 40, 2); this.fill.position.set(5, 2, 4); this.scene.add(this.ambient, this.key, this.fill);
    this.target = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: true, samples: this.mobile ? 0 : 2 });
    this.post = this.resources.material(new THREE.ShaderMaterial({
      uniforms: { uScene: { value: this.target.texture }, uTime: { value: 0 }, uVignette: { value: 0.28 }, uFade: { value: 0 }, uGrain: { value: 0.0016 } },
      vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}',
      fragmentShader: `uniform sampler2D uScene; uniform float uTime; uniform float uVignette; uniform float uFade; uniform float uGrain; varying vec2 vUv;
        float random(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233))+floor(uTime*12.0))*43758.5453);}
        void main(){vec3 color=texture2D(uScene,vUv).rgb; float vignette=smoothstep(0.2,0.85,length((vUv-0.5)*vec2(1.0,0.8))); color*=1.0-vignette*uVignette; color+=(random(vUv*vec2(1800.0,1100.0))-0.5)*uGrain; color=mix(color,vec3(0.003),uFade); gl_FragColor=vec4(color,1.0);
        #include <colorspace_fragment>
        }`, depthTest: false, depthWrite: false,
    }));
    this.postScene.add(new THREE.Mesh(this.resources.geometry(new THREE.PlaneGeometry(2, 2)), this.post));
    this.wash = this.resources.material(transitionMaterial());
    const washPlane = new THREE.Mesh(this.resources.geometry(new THREE.PlaneGeometry(2, 2)), this.wash); washPlane.frustumCulled = false; this.washScene.add(washPlane);
    this.particleCount = this.mobile ? 14000 : 52000;
    const geometry = this.resources.geometry(new THREE.BufferGeometry());
    const positions = new Float32Array(this.particleCount * 3), targets = new Float32Array(this.particleCount * 3), seeds = new Float32Array(this.particleCount);
    for (let i = 0; i < this.particleCount; i++) {
      positions.set([(noise(i) - 0.5) * 22, (noise(i + 5000) - 0.5) * 10, (noise(i + 220) - 0.5) * 15], i * 3);
      targets.set([(noise(i + 13) - 0.5) * 16, (noise(i + 3) - 0.5) * 7, (noise(i + 21) - 0.5) * 8], i * 3); seeds[i] = noise(i + 7);
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3)); geometry.setAttribute('aTarget', new THREE.BufferAttribute(targets, 3)); geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    this.particles = new THREE.Points(geometry, this.resources.material(particleMaterial())); this.particles.frustumCulled = false; this.scene.add(this.particles);
    this.particles.material.uniforms.uSize.value = this.mobile ? 2 : 1.65;
    void fetch(BASE + 'assets/archive/tianxia-particles.json').then(response => { if (!response.ok) throw new Error('calligraphy data unavailable'); return response.json() as Promise<CalligraphyPoints>; }).then(data => { this.calligraphy = data; if (this.particleChapter === 15) this.prepareParticles(15); }).catch(() => { this.resources.failures.push('tianxia-particles.json'); });
    this.getWorld(0); this.getWorld(1);
    this.resizeObserver = new ResizeObserver(() => this.resize()); this.resizeObserver.observe(container); this.resize();
    this.renderer.domElement.addEventListener('webglcontextlost', this.contextLost); this.renderer.domElement.addEventListener('webglcontextrestored', this.contextRestored);
    document.addEventListener('visibilitychange', this.visibility);
    this.last = performance.now(); this.loop = requestAnimationFrame(this.tick);
  }

  private getWorld(index: number): World {
    if (this.worlds.has(index)) return this.worlds.get(index)!;
    const world = makeWorld(index, this.resources, this.mobile); world.group.position.z = -index * 48; world.group.visible = false;
    this.scene.add(world.group); this.worlds.set(index, world); return world;
  }

  private prepareParticles(index: number): void {
    this.particleChapter = index;
    const positions = this.particles.geometry.attributes.position as THREE.BufferAttribute;
    const targets = this.particles.geometry.attributes.aTarget as THREE.BufferAttribute;
    for (let i = 0; i < this.particleCount; i++) {
      if (index === 15 && this.calligraphy?.points.length) {
        const sample = this.calligraphy.points[Math.floor(i / this.particleCount * this.calligraphy.points.length)];
        positions.setXYZ(i, (sample[0] - 0.5) * 12.2, (0.5 - sample[1]) * 3.195 + 0.55, (noise(i) - 0.5) * 0.12);
        const person = Math.floor(i / 70), part = i % 70, scale = 0.75 + noise(person) * 0.55;
        let x = (noise(part + 300) - 0.5) * 0.55, y = noise(part + 400) * 1.48;
        if (part > 53) { const a = (part - 54) / 16 * Math.PI * 2; x = Math.cos(a) * 0.15; y = 1.76 + Math.sin(a) * 0.17; }
        else if (part < 22) { x = (part % 2 ? 1 : -1) * 0.12 + (noise(part + 500) - 0.5) * 0.10; y = noise(part + 44) * 0.7; }
        targets.setXYZ(i, (noise(person + 999) - 0.5) * 22 + x * scale, -3 + y * scale, (noise(person + 770) - 0.5) * 8 + 3.5);
      } else {
        positions.setXYZ(i, (noise(i + index) - 0.5) * 24, (noise(i + 5000) - 0.5) * 13, (noise(i + 220) - 0.5) * 16);
        targets.setXYZ(i, (noise(i + 13) - 0.5) * 18, (noise(i + 3) - 0.5) * 8, (noise(i + 21) - 0.5) * 12);
      }
    }
    positions.needsUpdate = true; targets.needsUpdate = true;
  }

  get playing(): boolean { return this._playing; }
  get currentTime(): number { return this.time; }
  play(): void { if (this.time >= FILM_DURATION) this.seek(0); this._playing = true; this.last = performance.now(); }
  pause(): void { this._playing = false; }
  toggle(): void { this._playing ? this.pause() : this.play(); }
  seek(time: number): void { this.time = clamp(time, 0, FILM_DURATION); this.last = performance.now(); this.render(0, true); }
  point(x: number, y: number): void { this.interactive.targetX = x * 0.55; this.interactive.targetY = y * 0.3; }
  readDocument(active: boolean): void {
    this.documentReading = active && this.time >= CHAPTERS[9].start && this.time < CHAPTERS[10].start;
    this.interactive.targetX = 0; this.interactive.targetY = 0;
    this.render(0);
  }
  hitDocument(clientX: number, clientY: number): boolean {
    if (this.time < CHAPTERS[9].start || this.time >= CHAPTERS[10].start) return false;
    const document = this.getWorld(9).document; if (!document) return false;
    const bounds = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set((clientX - bounds.left) / bounds.width * 2 - 1, -(clientY - bounds.top) / bounds.height * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    return this.raycaster.intersectObject(document.mesh, false).length > 0;
  }

  private visibility = (): void => {
    if (document.hidden) { this.savedVisibility = this._playing; this.pause(); }
    else { if (this.savedVisibility) this.play(); this.savedVisibility = false; this.last = performance.now(); }
  };
  private contextLost = (event: Event): void => { event.preventDefault(); this.pause(); this.options.onError('WebGL context paused. 恢复图形后可以继续，或重新载入作品。'); };
  private contextRestored = (): void => { this.last = performance.now(); this.options.onError(''); this.render(0, true); };

  private resize(): void {
    const width = this.renderer.domElement.parentElement!.clientWidth, height = this.renderer.domElement.parentElement!.clientHeight;
    const dpr = Math.min(devicePixelRatio, this.mobile ? 1.35 : 1.65); this.renderer.setPixelRatio(dpr); this.renderer.setSize(width, height);
    this.camera.aspect = width / height; this.camera.fov = width < 760 ? 58 : 42; this.camera.updateProjectionMatrix();
    this.target.setSize(Math.floor(width * dpr * (this.mobile ? 0.85 : 1)), Math.floor(height * dpr * (this.mobile ? 0.85 : 1)));
  }

  private tick = (now: number): void => {
    if (this.disposed) return;
    const actualDelta = Math.max(0, (now - this.last) / 1000); const delta = Math.min(actualDelta, 0.08); this.last = now; this.atmosphere += delta;
    if (this._playing) this.time = Math.min(FILM_DURATION, this.time + actualDelta);
    if (this.time >= FILM_DURATION) this._playing = false;
    if (!document.hidden) this.render(delta);
    this.loop = requestAnimationFrame(this.tick);
  };

  private render(delta: number, instant = false): void {
    let index = 0; for (let i = 1; i < CHAPTERS.length; i++) { if (this.time >= CHAPTERS[i].start) index = i; }
    const chapter = CHAPTERS[index]; const progress = clamp((this.time - chapter.start) / chapter.duration);
    const local = this.time - chapter.start; const current = this.getWorld(index);
    const transition = index < 15 ? smooth((local - chapter.duration + 1.75) / 1.75) : 0;
    const next = index < 15 ? this.getWorld(index + 1) : undefined;
    this.worlds.forEach(world => { world.group.visible = world === current || world === next && transition > 0.01; });
    const materialTime = this.time + this.atmosphere * 0.2 + 2;
    current.update(progress, materialTime); opacityWorld(current, 1 - transition * 0.68);
    if (next && transition > 0.01) { next.update(0, materialTime); opacityWorld(next, transition); }
    current.camera.getPoint(clamp(progress * 0.92), this.desiredPosition); this.desiredPosition.z -= index * 48;
    this.look.copy(current.focus); this.look.z -= index * 48;
    if (next && transition > 0) {
      const incoming = next.camera.getPoint(0); incoming.z -= (index + 1) * 48;
      this.desiredPosition.lerp(incoming, transition); const incomingFocus = next.focus.clone(); incomingFocus.z -= (index + 1) * 48; this.look.lerp(incomingFocus, transition);
    }
    if (index === 15) {
      if (progress < 0.33) this.desiredPosition.set(0, 0.75, -720 + 19 - progress * 4);
      else if (progress < 0.48) this.desiredPosition.set(-1.6 * smooth((progress - 0.33) / 0.15), 0.55, -720 + 17 - smooth((progress - 0.33) / 0.15) * 13);
      else if (progress < 0.86) this.desiredPosition.set(Math.sin(progress * 5) * 0.5, 0.4, -720 + 10.5 + smooth((progress - 0.48) / 0.38) * 3);
      else this.desiredPosition.set(0, 0.4, -720 + 19.5);
    }
    const reading = this.documentReading && index === 9 && current.document;
    if (reading) {
      this.desiredPosition.copy(reading.position); this.desiredPosition.z -= index * 48;
      this.look.copy(reading.focus); this.look.z -= index * 48;
      // The actual enlarged sheet remains beside the native reading panel on wide screens.
      if (this.camera.aspect > 1.1) this.look.x += 2.45;
    }
    const reduced = this.options.reducedMotion ? 0 : 1;
    const ease = instant ? 1 : Math.min(1, 1 - Math.exp(-Math.max(delta, 0.016) * 4.5));
    this.interactive.x += (this.interactive.targetX - this.interactive.x) * ease; this.interactive.y += (this.interactive.targetY - this.interactive.y) * ease;
    this.desiredPosition.x += this.interactive.x * reduced * (reading ? 0 : 1); this.desiredPosition.y += this.interactive.y * reduced * (reading ? 0 : 1);
    if (instant || !this.camera.position.lengthSq()) this.camera.position.copy(this.desiredPosition); else this.camera.position.lerp(this.desiredPosition, ease);
    this.dummyCamera.position.copy(this.camera.position); this.dummyCamera.lookAt(this.look); this.desiredQuaternion.copy(this.dummyCamera.quaternion); this.camera.quaternion.slerp(this.desiredQuaternion, instant ? 1 : ease);
    const portrait = this.camera.aspect < 0.9;
    let baseFov = portrait ? 58 : 42;
    if (this.camera.aspect < 0.6) {
      if (index === 15) baseFov = 78;
      else if (index === 2 || index === 6 || index === 9 || index === 14) baseFov = 70;
    }
    const confinement = index === 5 ? smooth((progress - 0.54) / 0.2) * (1 - smooth((progress - 0.85) / 0.14)) : 0;
    this.camera.fov = reading ? this.camera.aspect > 1.1 ? 42 : 46 : baseFov - confinement * 11; this.camera.updateProjectionMatrix();
    const light = chapter.theme === 'light' && index !== 15; const finalWhite = index === 15 && progress > 0.86;
    this.nextBackground.set(finalWhite ? '#ffffff' : light ? '#dadac7' : chapter.theme === 'cold' ? '#131b17' : PALETTE.ink);
    this.background.lerp(this.nextBackground, instant ? 1 : ease * 0.6); this.scene.background = this.background;
    (this.scene.fog as THREE.FogExp2).color.copy(this.background); (this.scene.fog as THREE.FogExp2).density = light ? 0.012 : 0.01;
    this.ambient.intensity = light ? 2.6 : 1.1; this.key.intensity = light ? 2.9 : 3.1;
    this.key.position.z = this.camera.position.z + 10; this.key.target.position.set(0, 0, -index * 48); this.key.target.updateMatrixWorld();
    this.fill.position.set(4, 2, -index * 48 + 4); this.fill.intensity = light ? 30 : 65;
    if (this.particleChapter !== index) this.prepareParticles(index);
    this.particles.position.set(0, 0, -index * 48); this.particles.material.uniforms.uTime.value = materialTime;
    this.particles.geometry.setDrawRange(0, index === 15 ? this.particleCount : this.mobile ? 2200 : 4800);
    this.particles.material.uniforms.uProgress.value = index === 15 ? smooth((progress - 0.33) / 0.15) : smooth(progress);
    this.particles.material.uniforms.uOpacity.value = index === 15 ? 0.85 * (1 - smooth((progress - 0.58) / 0.06)) : transition > 0.01 ? Math.sin(transition * Math.PI) * 0.5 : 0.035;
    this.particles.visible = !(index === 15 && progress > 0.64) && !finalWhite;
    this.post.uniforms.uTime.value = this.time; this.post.uniforms.uVignette.value = finalWhite ? 0 : light ? 0.08 : 0.31; this.post.uniforms.uGrain.value = finalWhite ? 0 : 0.0016;
    this.post.uniforms.uFade.value = index === 15 ? smooth((progress - 0.9917) / 0.0083) : 0;
    this.wash.uniforms.uTime.value = this.time; this.wash.uniforms.uProgress.value = transition; this.wash.uniforms.uOpacity.value = Math.sin(transition * Math.PI) * (this.options.reducedMotion ? 0.15 : 0.28);
    this.renderer.info.reset(); this.renderer.setRenderTarget(this.target); this.renderer.clear(); this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(null); this.renderer.render(this.postScene, this.postCamera);
    if (transition > 0) { this.renderer.autoClear = false; this.renderer.render(this.washScene, this.postCamera); this.renderer.autoClear = true; }
    this.options.onFrame({ time: this.time, chapterIndex: index, progress, playing: this._playing, ended: this.time >= FILM_DURATION });
  }

  stats(): { time: number; playing: boolean; worlds: number; calls: number; triangles: number; textures: number; geometries: number; failures: string[]; calligraphyLoaded: boolean } {
    return { time: this.time, playing: this._playing, worlds: this.worlds.size, calls: this.renderer.info.render.calls, triangles: this.renderer.info.render.triangles, textures: this.renderer.info.memory.textures, geometries: this.renderer.info.memory.geometries, failures: this.resources.failures, calligraphyLoaded: !!this.calligraphy };
  }

  dispose(): void {
    this.disposed = true; cancelAnimationFrame(this.loop); this.resizeObserver.disconnect(); document.removeEventListener('visibilitychange', this.visibility);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.contextLost); this.renderer.domElement.removeEventListener('webglcontextrestored', this.contextRestored);
    this.worlds.forEach(world => world.dispose?.()); this.target.dispose(); this.resources.dispose(); this.renderer.dispose(); this.renderer.domElement.remove();
  }
}
