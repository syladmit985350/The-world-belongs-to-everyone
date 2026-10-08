import { CHAPTERS, type Caption } from '../content/chapters';

interface Cue extends Caption { start: number; finish: number }
const cues: Cue[] = CHAPTERS.flatMap(chapter => chapter.captions.map(caption => ({
  ...caption, start: chapter.start + caption.at, finish: chapter.start + caption.end,
})));

/** Original procedural sound design and sample-accurate local Chinese narration. */
export class AudioDirector {
  private context?: AudioContext;
  private master?: GainNode;
  private ambience?: GainNode;
  private voiceBus?: GainNode;
  private sea?: GainNode;
  private wind?: GainNode;
  private drone?: GainNode;
  private noise?: AudioBuffer;
  private sustained: AudioScheduledSourceNode[] = [];
  private transient = new Set<AudioScheduledSourceNode>();
  private nodes: AudioNode[] = [];
  private buffers = new Map<string, Promise<AudioBuffer | null>>();
  private abort = new AbortController();
  private source?: AudioBufferSourceNode;
  private requested?: string;
  private generation = 0;
  private _enabled = false;
  private _narration = true;
  private filmTime = 0;
  private playing = false;
  private lastTime = -1;
  private pulseKey = '';
  private disposed = false;

  get enabled(): boolean { return this._enabled; }
  get narration(): boolean { return this._narration; }

  async unlock(): Promise<boolean> {
    if (this.disposed) return false;
    try {
      if (!this.context) this.initialise();
      await this.context!.resume();
      return this.context!.state === 'running';
    } catch (error) {
      window.dispatchEvent(new CustomEvent('artwork-audio-error', { detail: String(error) }));
      return false;
    }
  }

  setEnabled(value: boolean): void {
    this._enabled = value;
    this.master?.gain.setTargetAtTime(value && this.playing ? 0.78 : 0, this.context!.currentTime, 0.12);
    if (!value) this.stopVoice();
  }

  setNarration(value: boolean): void {
    this._narration = value;
    if (!value) this.stopVoice();
  }

  seek(time: number): void {
    this.filmTime = time;
    this.lastTime = -1;
    this.pulseKey = '';
    this.stopVoice();
  }

  update(time: number, chapterId: string, playing: boolean): void {
    if (this.disposed || !Number.isFinite(time)) return;
    const jumped = this.lastTime >= 0 && Math.abs(time - this.lastTime) > 0.45;
    this.filmTime = time;
    const playingChanged = this.playing !== playing;
    this.playing = playing;
    this.lastTime = time;
    if (jumped || playingChanged) this.stopVoice();
    if (!this.context || !this.master || this.context.state !== 'running') return;
    if (playingChanged) this.master.gain.setTargetAtTime(this._enabled && playing ? 0.78 : 0, this.context.currentTime, 0.12);
    if (!this._enabled || !playing) return;
    this.soundscape(chapterId, time);
    // The Huanghuagang petals are a deliberate complete silence, including speech.
    // Its bilingual caption remains readable without breaking the memorial pause.
    const memorialSilence = chapterId === 'uprisings' && time >= 104 && time < 110;
    if (memorialSilence) {
      this.ambience!.gain.setValueAtTime(0, this.context.currentTime);
      this.stopVoice();
      return;
    }
    this.ambience!.gain.setTargetAtTime(0.28, this.context.currentTime, 0.12);
    if (!this._narration) return;
    const cue = cues.find(item => time >= item.start && time < item.finish);
    if (!cue) { if (this.requested) this.stopVoice(); return; }
    if (this.requested === cue.voice) return;
    this.stopVoice();
    this.requested = cue.voice;
    const token = this.generation;
    void this.buffer(cue.voice).then(buffer => {
      if (!buffer || this.disposed || token !== this.generation || !this._enabled || !this._narration || !this.playing || !this.context || !this.voiceBus) return;
      if (this.filmTime < cue.start || this.filmTime >= cue.finish) return;
      const speed = Math.max(1, buffer.duration / (cue.finish - cue.start));
      const offset = (this.filmTime - cue.start) * speed;
      if (offset >= buffer.duration) return;
      const voice = this.context.createBufferSource();
      voice.buffer = buffer;
      voice.playbackRate.value = speed;
      voice.connect(this.voiceBus);
      this.source = voice;
      voice.onended = () => { voice.disconnect(); if (this.source === voice) this.source = undefined; };
      voice.start(0, offset);
    });
    // Load just the next cue, rather than decoding the entire film on a phone.
    const next = cues.find(item => item.start > cue.start);
    if (next) void this.buffer(next.voice);
  }

  private async buffer(file: string): Promise<AudioBuffer | null> {
    if (!this.buffers.has(file)) {
      this.buffers.set(file, (async () => {
        try {
          const response = await fetch(import.meta.env.BASE_URL + file.replace(/^\//, ''), { signal: this.abort.signal });
          if (!response.ok) throw new Error(`Narration ${response.status}: ${file}`);
          return await this.context!.decodeAudioData(await response.arrayBuffer());
        } catch (error) {
          if (!this.disposed) window.dispatchEvent(new CustomEvent('artwork-audio-error', { detail: String(error) }));
          return null;
        }
      })());
    }
    return this.buffers.get(file)!;
  }

  private initialise(): void {
    const context = new AudioContext();
    this.context = context;
    const master = context.createGain();
    master.gain.value = this._enabled && this.playing ? 0.78 : 0;
    const limiter = context.createDynamicsCompressor();
    limiter.threshold.value = -18;
    limiter.knee.value = 24;
    limiter.ratio.value = 4;
    master.connect(limiter); limiter.connect(context.destination);
    this.master = master;
    this.ambience = context.createGain(); this.ambience.gain.value = 0.28; this.ambience.connect(master);
    this.voiceBus = context.createGain(); this.voiceBus.gain.value = 0.92; this.voiceBus.connect(master);
    this.nodes.push(master, limiter, this.ambience, this.voiceBus);
    const noise = context.createBuffer(1, context.sampleRate * 8, context.sampleRate);
    const data = noise.getChannelData(0);
    let seed = 1866;
    for (let i = 0; i < data.length; i++) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; data[i] = seed / 2147483648 - 1; }
    this.noise = noise;
    this.sea = this.noiseLayer('lowpass', 430);
    this.wind = this.noiseLayer('bandpass', 1200);
    const drone = context.createGain(); drone.gain.value = 0; drone.connect(this.ambience);
    this.drone = drone; this.nodes.push(drone);
    for (const frequency of [55, 82.41]) {
      const oscillator = context.createOscillator(); oscillator.type = 'sine'; oscillator.frequency.value = frequency;
      oscillator.connect(drone); oscillator.start(); this.sustained.push(oscillator);
    }
  }

  private noiseLayer(type: BiquadFilterType, frequency: number): GainNode {
    const context = this.context!;
    const source = context.createBufferSource(); source.buffer = this.noise!; source.loop = true;
    const filter = context.createBiquadFilter(); filter.type = type; filter.frequency.value = frequency; filter.Q.value = 0.5;
    const gain = context.createGain(); gain.gain.value = 0;
    source.connect(filter); filter.connect(gain); gain.connect(this.ambience!); source.start();
    this.sustained.push(source); this.nodes.push(filter, gain);
    return gain;
  }

  private soundscape(id: string, time: number): void {
    const context = this.context!;
    const chapter = CHAPTERS.find(item => item.id === id);
    const local = time - (chapter?.start ?? 0);
    const quiet = (id === 'uprisings' && local >= 10) || (id === 'unfinished' && local >= 4) || id === 'tianxia';
    const maritime = ['darkness', 'cuiheng', 'xingzhonghui', 'exile', 'revolution1911'].includes(id);
    const wave = 0.78 + Math.sin(time * 0.27) * 0.22;
    this.sea!.gain.setTargetAtTime(quiet ? 0 : maritime ? 0.25 * wave : 0.015, context.currentTime, 0.5);
    this.wind!.gain.setTargetAtTime(quiet ? 0 : id === 'northward' || id === 'broken-republic' ? 0.1 : 0.035, context.currentTime, 0.6);
    this.drone!.gain.setTargetAtTime(quiet ? 0 : id === 'revolution1911' ? 0.045 : id === 'nanjing' ? 0.012 : 0.02, context.currentTime, 0.8);
    const key = `${id}:${Math.floor(local * 2)}`;
    if (key === this.pulseKey) return;
    this.pulseKey = key;
    const halfBeat = Math.floor(local * 2);
    if (quiet) {
      if (id === 'tianxia' && halfBeat === 2) this.burst(2200, 0.5, 0.11, true);
      return;
    }
    if (id === 'medicine' && halfBeat % 2 === 0) { this.burst(58, 0.16, 0.28); this.burst(68, 0.12, 0.17, false, 0.23); }
    if (['darkness', 'xingzhonghui', 'exile', 'revolution1911'].includes(id) && halfBeat % 7 === 0) {
      this.burst(690, 0.04, 0.09); this.burst(690, 0.09, 0.06, false, 0.14);
    }
    if (['darkness', 'tongmenghui'].includes(id) && halfBeat % 3 === 0) this.burst(820, 0.085, 0.075, true);
    if (id === 'nanjing' && halfBeat % 2 === 0) this.burst(1750, 0.023, 0.08);
    if (['awakening', 'constitution'].includes(id) && halfBeat % 2 === 0) this.burst(3800, 0.055, 0.035, true);
    if (id === 'northward' && local > 7) { this.burst(190, 0.07, 0.1, true); if (halfBeat % 5 === 0) this.burst(440, 0.14, 0.045); }
    if (id === 'uprisings' && halfBeat % 7 === 0) this.burst(95, 0.4, 0.18, true);
    if (id === 'cuiheng' && halfBeat === 3) this.burst(260, 1.2, 0.08);
    if (id === 'broken-republic' && halfBeat % 8 === 0) this.burst(3200, 0.16, 0.07, true);
  }

  private burst(frequency: number, duration: number, volume: number, noisy = false, delay = 0): void {
    const context = this.context!;
    const source: AudioBufferSourceNode | OscillatorNode = noisy ? context.createBufferSource() : context.createOscillator();
    if (source instanceof AudioBufferSourceNode) source.buffer = this.noise!;
    else { source.type = 'sine'; source.frequency.value = frequency; }
    const filter = context.createBiquadFilter(); filter.type = noisy ? 'bandpass' : 'lowpass'; filter.frequency.value = frequency; filter.Q.value = 0.7;
    const envelope = context.createGain();
    const start = context.currentTime + delay;
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(volume, start + 0.006);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter); filter.connect(envelope); envelope.connect(this.ambience!);
    this.transient.add(source);
    source.onended = () => { source.disconnect(); filter.disconnect(); envelope.disconnect(); this.transient.delete(source); };
    source.start(start); source.stop(start + duration + 0.03);
  }

  private stopVoice(): void {
    this.generation++;
    this.requested = undefined;
    if (this.source) { this.source.onended = null; this.source.stop(); this.source.disconnect(); this.source = undefined; }
  }

  dispose(): void {
    this.disposed = true;
    this.abort.abort();
    this.stopVoice();
    for (const source of [...this.sustained, ...this.transient]) { source.stop(); source.disconnect(); }
    for (const node of this.nodes) node.disconnect();
    this.sustained.length = 0; this.transient.clear(); this.buffers.clear();
    if (this.context) void this.context.close();
  }
}
