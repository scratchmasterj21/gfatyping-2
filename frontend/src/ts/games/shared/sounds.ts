let _ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  _ctx ??= new AudioContext();
  if (_ctx.state === "suspended") void _ctx.resume();
  return _ctx;
}

export function playExplode(): void {
  const c = getCtx();
  const t = c.currentTime;

  const bufSize = Math.floor(c.sampleRate * 0.25);
  const buf = c.createBuffer(1, bufSize, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
  const noise = c.createBufferSource();
  noise.buffer = buf;
  const ng = c.createGain();
  ng.gain.setValueAtTime(0.22, t);
  ng.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
  noise.connect(ng);
  ng.connect(c.destination);
  noise.start(t);

  const osc = c.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(100, t);
  osc.frequency.exponentialRampToValueAtTime(30, t + 0.2);
  const og = c.createGain();
  og.gain.setValueAtTime(0.28, t);
  og.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
  osc.connect(og);
  og.connect(c.destination);
  osc.start(t);
  osc.stop(t + 0.25);
}

export function playPop(): void {
  const c = getCtx();
  const t = c.currentTime;

  const osc = c.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(520, t);
  osc.frequency.exponentialRampToValueAtTime(80, t + 0.12);
  const g = c.createGain();
  g.gain.setValueAtTime(0.28, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  osc.connect(g);
  g.connect(c.destination);
  osc.start(t);
  osc.stop(t + 0.12);
}

export function playMiss(): void {
  const c = getCtx();
  const t = c.currentTime;

  const osc = c.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(160, t);
  osc.frequency.exponentialRampToValueAtTime(60, t + 0.1);
  const g = c.createGain();
  g.gain.setValueAtTime(0.18, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
  osc.connect(g);
  g.connect(c.destination);
  osc.start(t);
  osc.stop(t + 0.1);
}

export function playWaveClear(): void {
  const c = getCtx();
  const t = c.currentTime;
  ([523, 659, 784] as const).forEach((freq, i) => {
    const osc = c.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    const g = c.createGain();
    const s = t + i * 0.1;
    g.gain.setValueAtTime(0, s);
    g.gain.linearRampToValueAtTime(0.22, s + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, s + 0.35);
    osc.connect(g);
    g.connect(c.destination);
    osc.start(s);
    osc.stop(s + 0.35);
  });
}

export function playHordeIncoming(): void {
  const c = getCtx();
  const t = c.currentTime;

  // Low ominous rumble
  const bufSize = Math.floor(c.sampleRate * 0.6);
  const buf = c.createBuffer(1, bufSize, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) {
    data[i] = (Math.random() * 2 - 1) * 0.4 * (1 - i / bufSize);
  }
  const noise = c.createBufferSource();
  noise.buffer = buf;
  const ng = c.createGain();
  ng.gain.setValueAtTime(0.18, t);
  ng.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
  noise.connect(ng);
  ng.connect(c.destination);
  noise.start(t);

  // Descending wail
  ([220, 175, 140] as const).forEach((freq, i) => {
    const osc = c.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, t + i * 0.18);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.6, t + i * 0.18 + 0.22);
    const g = c.createGain();
    g.gain.setValueAtTime(0.22, t + i * 0.18);
    g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.18 + 0.28);
    osc.connect(g);
    g.connect(c.destination);
    osc.start(t + i * 0.18);
    osc.stop(t + i * 0.18 + 0.3);
  });
}

export function playBombExplode(): void {
  const c = getCtx();
  const t = c.currentTime;

  const bufSize = Math.floor(c.sampleRate * 0.35);
  const buf = c.createBuffer(1, bufSize, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufSize);
  }
  const noise = c.createBufferSource();
  noise.buffer = buf;
  const ng = c.createGain();
  ng.gain.setValueAtTime(0.4, t);
  ng.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
  noise.connect(ng);
  ng.connect(c.destination);
  noise.start(t);

  const osc = c.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(120, t);
  osc.frequency.exponentialRampToValueAtTime(28, t + 0.4);
  const og = c.createGain();
  og.gain.setValueAtTime(0.45, t);
  og.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
  osc.connect(og);
  og.connect(c.destination);
  osc.start(t);
  osc.stop(t + 0.4);
}

export function playDeflect(): void {
  const c = getCtx();
  const t = c.currentTime;

  const osc = c.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(880, t);
  osc.frequency.exponentialRampToValueAtTime(1400, t + 0.06);
  const g = c.createGain();
  g.gain.setValueAtTime(0.2, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  osc.connect(g);
  g.connect(c.destination);
  osc.start(t);
  osc.stop(t + 0.12);
}

export function playBossHit(): void {
  const c = getCtx();
  const t = c.currentTime;

  const osc = c.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(200, t);
  osc.frequency.exponentialRampToValueAtTime(55, t + 0.35);
  const g = c.createGain();
  g.gain.setValueAtTime(0.38, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
  osc.connect(g);
  g.connect(c.destination);
  osc.start(t);
  osc.stop(t + 0.35);

  const osc2 = c.createOscillator();
  osc2.type = "square";
  osc2.frequency.setValueAtTime(460, t);
  osc2.frequency.exponentialRampToValueAtTime(220, t + 0.18);
  const g2 = c.createGain();
  g2.gain.setValueAtTime(0.1, t);
  g2.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
  osc2.connect(g2);
  g2.connect(c.destination);
  osc2.start(t);
  osc2.stop(t + 0.18);
}

export function playBossDefeated(): void {
  const c = getCtx();
  const t = c.currentTime;

  ([523, 659, 784, 1047] as const).forEach((freq, i) => {
    const osc = c.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    const g = c.createGain();
    const s = t + i * 0.13;
    g.gain.setValueAtTime(0, s);
    g.gain.linearRampToValueAtTime(0.3, s + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, s + 0.55);
    osc.connect(g);
    g.connect(c.destination);
    osc.start(s);
    osc.stop(s + 0.55);
  });

  const bufSize = Math.floor(c.sampleRate * 0.4);
  const buf = c.createBuffer(1, bufSize, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufSize);
  }
  const noise = c.createBufferSource();
  noise.buffer = buf;
  const ng = c.createGain();
  ng.gain.setValueAtTime(0.18, t);
  ng.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
  noise.connect(ng);
  ng.connect(c.destination);
  noise.start(t);
}

export function playGameOver(): void {
  const c = getCtx();
  const t = c.currentTime;

  const osc = c.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(380, t);
  osc.frequency.exponentialRampToValueAtTime(90, t + 0.8);
  const g = c.createGain();
  g.gain.setValueAtTime(0.22, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
  osc.connect(g);
  g.connect(c.destination);
  osc.start(t);
  osc.stop(t + 0.8);
}
