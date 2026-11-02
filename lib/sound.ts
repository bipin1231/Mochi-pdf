// Tiny synthesized sound kit (Web Audio). No audio files, nothing to download.
let ctx: AudioContext | null = null;
let on = true;
let noise: AudioBuffer | null = null;

const ac = (): AudioContext | null => {
  if (typeof window === "undefined" || !on) return null;
  if (!ctx) {
    const W = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
    const C = W.AudioContext ?? W.webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
};

function tone(c: AudioContext, f: number, at: number, dur: number, type: OscillatorType = "sine", gain = 0.14, f2 = f) {
  const o = c.createOscillator(), g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, at);
  o.frequency.exponentialRampToValueAtTime(Math.max(f2, 1), at + dur);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(c.destination);
  o.start(at); o.stop(at + dur + 0.03);
}

function tick(c: AudioContext, at: number, freq: number, gain: number) {
  if (!noise) {
    const len = Math.floor(c.sampleRate * 0.05);
    noise = c.createBuffer(1, len, c.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  }
  const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  s.buffer = noise; f.type = "bandpass"; f.frequency.value = freq; f.Q.value = 1.2; g.gain.value = gain;
  s.connect(f).connect(g).connect(c.destination);
  s.start(at);
}

const jitter = (v: number, pct = 0.08) => v * (1 + (Math.random() * 2 - 1) * pct);

export const sfx = {
  isOn: () => { if (typeof localStorage !== "undefined") on = localStorage.getItem("mochi-sound") !== "off"; return on; },
  setOn(v: boolean) { on = v; try { localStorage.setItem("mochi-sound", v ? "on" : "off"); } catch {} },
  // Soft "thock" for keycaps; the space bar is deeper.
  key(id: string) {
    const c = ac(); if (!c) return; const t = c.currentTime;
    if (id === "space") { tick(c, t, jitter(900), 0.5); tone(c, jitter(120), t, 0.09, "sine", 0.22, 70); }
    else if (id === "enter") { tick(c, t, jitter(1300), 0.5); tone(c, jitter(210), t, 0.12, "triangle", 0.18, 120); }
    else if (id === "back") { tick(c, t, jitter(2400), 0.45); tone(c, jitter(180), t, 0.06, "sine", 0.14, 110); }
    else if (id === "shift") { tick(c, t, jitter(1100), 0.4); tone(c, jitter(140), t, 0.07, "sine", 0.16, 90); }
    else { tick(c, t, jitter(1900, 0.2), 0.45); tone(c, jitter(150), t, 0.06, "sine", 0.18, 95); }
  },
  send() { const c = ac(); if (!c) return; const t = c.currentTime; tone(c, 520, t, 0.1, "triangle", 0.12); tone(c, 780, t + 0.07, 0.14, "triangle", 0.12); },
  done() { const c = ac(); if (!c) return; const t = c.currentTime; tone(c, 880, t, 0.18, "sine", 0.1); tone(c, 1320, t + 0.09, 0.28, "sine", 0.09); },
  boop() { const c = ac(); if (!c) return; tone(c, jitter(520), c.currentTime, 0.14, "sine", 0.16, jitter(900)); },
  crank() { const c = ac(); if (!c) return; tick(c, c.currentTime, jitter(2600, 0.1), 0.22); },
  blip() { const c = ac(); if (!c) return; tone(c, 990, c.currentTime, 0.08, "square", 0.05); },
  dock(open: boolean) {
    const c = ac(); if (!c) return; const t = c.currentTime;
    tone(c, open ? 160 : 110, t, 0.18, "sine", 0.22, open ? 70 : 60);
    tick(c, t + (open ? 0.12 : 0), 800, 0.5);
  },
  celebrate() { const c = ac(); if (!c) return; const t = c.currentTime; [523, 659, 784, 1047].forEach((f, i) => tone(c, f, t + i * 0.08, 0.22, "triangle", 0.1)); },
};
