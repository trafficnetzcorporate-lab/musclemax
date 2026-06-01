/**
 * EMOM audio engine.
 *
 * Why this exists: the previous implementation pre-scheduled every beep for the
 * whole 10-minute workout into the Web Audio graph at Start. When a phone locks
 * the screen or the user switches apps, the OS *suspends* the AudioContext and
 * those pre-scheduled events silently die — which is why "the sound doesn't even
 * occur" when away from the app.
 *
 * This engine instead uses a **lookahead scheduler** (the classic "A Tale of Two
 * Clocks" pattern): a short interval wakes up frequently, reads the authoritative
 * wall-clock elapsed time, and schedules only the cues falling inside the next
 * ~300ms. Because it re-derives what to play from elapsed time every tick, it
 * self-corrects after the tab is throttled/suspended and refocused.
 *
 * Reliability layers (in order of how much they help on mobile web):
 *   1. Loud, compressed, jarring synthesized "thump" so it cuts through music.
 *   2. Lookahead scheduling so cues stay sample-accurate and survive throttling.
 *   3. A MediaStream "background hack": the master bus is also piped into an
 *      <audio> element via createMediaStreamDestination(). On some browsers this
 *      keeps an active media session so audio can continue briefly in the
 *      background. A near-silent keep-alive oscillator stops the stream being
 *      garbage-collected as "silent".
 *
 * Honest caveat: no website can *guarantee* audio while the screen is locked or
 * another app is foregrounded on iOS. The Screen Wake Lock (kept in the timer
 * component) is what actually makes this dependable — it holds the screen on so
 * the workout stays foregrounded.
 */

export type CueType = 'soft' | 'hard' | 'end';
export interface Cue {
  at: number; // seconds into the workout
  type: CueType;
}

export interface EmomAudioConfig {
  totalTime: number;       // e.g. 600
  setInterval: number;     // e.g. 60
  countdownLead: number;   // e.g. 5 — how many seconds of ticks before each minute
}

const LOOKAHEAD = 0.75;        // schedule cues up to 750ms ahead (throttle-tolerant)
const SCHEDULE_INTERVAL = 100; // ms between scheduler wakeups

/** Build the fixed list of audio cues for one workout. */
export function buildCues({ totalTime, setInterval, countdownLead }: EmomAudioConfig): Cue[] {
  const cues: Cue[] = [];
  // Minute boundaries that START a new set: setInterval, 2*setInterval, ... up to
  // just before totalTime. (Set 1 starts at 0 via the Start press.)
  for (let b = setInterval; b < totalTime; b += setInterval) {
    for (let s = countdownLead; s >= 1; s--) {
      if (b - s > 0) cues.push({ at: b - s, type: 'soft' });
    }
    cues.push({ at: b, type: 'hard' });
  }
  // Final countdown + finish fanfare at totalTime.
  for (let s = countdownLead; s >= 1; s--) {
    cues.push({ at: totalTime - s, type: 'soft' });
  }
  cues.push({ at: totalTime, type: 'end' });
  return cues.sort((a, b) => a.at - b.at);
}

export class EmomAudioEngine {
  private cfg: EmomAudioConfig;
  private cues: Cue[];
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private mediaDest: MediaStreamAudioDestinationNode | null = null;
  private keepAlive: OscillatorNode | null = null;
  private audioEl: HTMLAudioElement | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private scheduled = new Set<number>(); // indices of cues already scheduled
  private getElapsed: (() => number) | null = null;

  constructor(cfg: EmomAudioConfig) {
    this.cfg = cfg;
    this.cues = buildCues(cfg);
  }

  /** Must be called from a user gesture (Start/Resume) so audio is allowed. */
  async start(getElapsed: () => number) {
    this.getElapsed = getElapsed;
    if (!this.ctx) this.buildGraph();
    await this.resumeCtx();
    this.startAudioEl();
    this.startScheduler();
  }

  /** Lightweight re-arm when returning to the tab; safe to call often. */
  async ensureRunning(getElapsed: () => number) {
    if (!this.ctx) return this.start(getElapsed);
    this.getElapsed = getElapsed;
    await this.resumeCtx();
    this.startAudioEl();
    if (!this.timer) this.startScheduler();
  }

  pause() {
    this.stopScheduler();
    this.scheduled.clear(); // re-derive future cues on resume
    try { this.ctx?.suspend(); } catch { /* noop */ }
  }

  async resume(getElapsed: () => number) {
    this.getElapsed = getElapsed;
    await this.resumeCtx();
    this.startAudioEl();
    this.startScheduler();
  }

  stop() {
    this.stopScheduler();
    try { this.keepAlive?.stop(); } catch { /* noop */ }
    try { this.audioEl?.pause(); } catch { /* noop */ }
    if (this.audioEl) this.audioEl.srcObject = null;
    try { this.ctx?.close(); } catch { /* noop */ }
    this.ctx = null;
    this.master = null;
    this.compressor = null;
    this.mediaDest = null;
    this.keepAlive = null;
    this.audioEl = null;
    this.scheduled.clear();
  }

  /** Fire one loud thump immediately — used to confirm sound works on Start. */
  testThump() {
    if (!this.ctx) return;
    this.playCue('hard', this.ctx.currentTime + 0.02);
  }

  // ---- internals ----

  private buildGraph() {
    const AC = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext });
    const Ctor = AC.AudioContext || AC.webkitAudioContext;
    const ctx = new Ctor!();
    this.ctx = ctx;

    // Master compressor → master gain → speakers (+ media stream for background).
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -14;
    compressor.knee.value = 8;
    compressor.ratio.value = 12;
    compressor.attack.value = 0.002;
    compressor.release.value = 0.2;

    const master = ctx.createGain();
    master.gain.value = 1.0;

    compressor.connect(master);
    master.connect(ctx.destination);

    // Continuous, inaudible keep-alive tone wired straight to the speakers.
    // This is the critical fix for "only the Start beep plays": mobile browsers
    // auto-suspend an AudioContext they think is idle, which freezes currentTime
    // and makes every *scheduled* beep silently queue forever. A constant (–80dB,
    // sub-audible) source keeps the context "running" so scheduled cues fire.
    const ka = ctx.createOscillator();
    const kaGain = ctx.createGain();
    ka.frequency.value = 55;
    kaGain.gain.value = 0.00012;
    ka.connect(kaGain).connect(ctx.destination);
    ka.start();
    this.keepAlive = ka;

    // Background hack: also pipe the master bus into an <audio> element so the
    // OS sees an active media session (best-effort background continuation).
    try {
      const mediaDest = ctx.createMediaStreamDestination();
      master.connect(mediaDest);
      kaGain.connect(mediaDest); // keep the stream non-silent too
      const el = new Audio();
      el.srcObject = mediaDest.stream;
      el.loop = true;
      // @ts-expect-error: iOS-only hint to keep playback inline.
      el.playsInline = true;
      el.setAttribute('playsinline', '');
      this.audioEl = el;
      this.mediaDest = mediaDest;
    } catch {
      // MediaStream route unsupported — fall back to plain Web Audio output.
    }

    this.compressor = compressor;
    this.master = master;
  }

  private async resumeCtx() {
    if (this.ctx && this.ctx.state === 'suspended') {
      try { await this.ctx.resume(); } catch { /* noop */ }
    }
  }

  private startAudioEl() {
    if (!this.audioEl) return;
    const p = this.audioEl.play();
    if (p && typeof p.catch === 'function') p.catch(() => { /* autoplay race — ignore */ });
  }

  private startScheduler() {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(), SCHEDULE_INTERVAL);
    this.tick(); // schedule immediately, don't wait a full interval
  }

  private stopScheduler() {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  }

  private tick() {
    if (!this.ctx || !this.getElapsed) return;
    // The phone may have quietly suspended us; force it back to running so
    // currentTime keeps advancing and scheduled cues actually fire.
    if (this.ctx.state !== 'running') {
      this.ctx.resume().catch(() => { /* noop */ });
    }
    const elapsed = this.getElapsed();
    const now = this.ctx.currentTime;
    for (let i = 0; i < this.cues.length; i++) {
      if (this.scheduled.has(i)) continue;
      const dt = this.cues[i].at - elapsed; // seconds until this cue
      if (dt < -0.08) { this.scheduled.add(i); continue; } // already past — skip
      if (dt <= LOOKAHEAD) {
        this.playCue(this.cues[i].type, now + Math.max(0, dt));
        this.scheduled.add(i);
      }
    }
  }

  /**
   * A heavy, echoing "clock thump" designed to cut through music:
   *  - low sine body with a fast pitch drop (chest-thump)
   *  - a square sub-harmonic for harsh buzz (presence over headphones)
   *  - a filtered noise transient for the percussive "crack"
   * 'hard' = minute boundary (loud), 'soft' = countdown tick, 'end' = finish.
   */
  private playCue(type: CueType, when: number) {
    const ctx = this.ctx;
    const bus = this.compressor;
    if (!ctx || !bus) return;
    const t = Math.max(when, ctx.currentTime);

    const isHard = type === 'hard';
    const isEnd = type === 'end';
    const peak = isEnd ? 1.0 : isHard ? 0.95 : 0.45;
    const decay = isEnd ? 2.4 : isHard ? 1.6 : 0.55;
    const baseFreq = isEnd ? 110 : isHard ? 95 : 78;
    const dropFreq = isEnd ? 55 : isHard ? 42 : 54;

    // 1) Sine body with pitch drop.
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq, t);
    osc.frequency.exponentialRampToValueAtTime(dropFreq, t + 0.14);
    oscGain.gain.setValueAtTime(0.0001, t);
    oscGain.gain.exponentialRampToValueAtTime(peak, t + 0.005);
    oscGain.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    osc.connect(oscGain).connect(bus);
    osc.start(t);
    osc.stop(t + decay + 0.05);

    // 2) Harsh square sub-harmonic (only on the attention-grabbing cues).
    if (isHard || isEnd) {
      const sq = ctx.createOscillator();
      const sqGain = ctx.createGain();
      sq.type = 'square';
      sq.frequency.setValueAtTime(baseFreq * 1.5, t);
      sq.frequency.exponentialRampToValueAtTime(dropFreq * 1.2, t + 0.1);
      sqGain.gain.setValueAtTime(0.0001, t);
      sqGain.gain.exponentialRampToValueAtTime(peak * 0.5, t + 0.004);
      sqGain.gain.exponentialRampToValueAtTime(0.0001, t + decay * 0.5);
      sq.connect(sqGain).connect(bus);
      sq.start(t);
      sq.stop(t + decay);
    }

    // 3) Noise transient — the percussive crack.
    const noiseDur = 0.3;
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * noiseDur), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = isHard || isEnd ? 2000 : 1300;
    bp.Q.value = 0.7;
    const noiseGain = ctx.createGain();
    const nPeak = isHard || isEnd ? 0.75 : 0.3;
    noiseGain.gain.setValueAtTime(0.0001, t);
    noiseGain.gain.exponentialRampToValueAtTime(nPeak, t + 0.003);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, t + (isHard || isEnd ? 0.5 : 0.25));
    noise.connect(bp).connect(noiseGain).connect(bus);
    noise.start(t);
    noise.stop(t + noiseDur);

    // The finish gets a second, higher "ding" so it's clearly different.
    if (isEnd) {
      const ding = ctx.createOscillator();
      const dingGain = ctx.createGain();
      ding.type = 'triangle';
      ding.frequency.setValueAtTime(880, t + 0.18);
      ding.frequency.exponentialRampToValueAtTime(1320, t + 0.4);
      dingGain.gain.setValueAtTime(0.0001, t + 0.18);
      dingGain.gain.exponentialRampToValueAtTime(0.8, t + 0.2);
      dingGain.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
      ding.connect(dingGain).connect(bus);
      ding.start(t + 0.18);
      ding.stop(t + 1.5);
    }
  }
}
