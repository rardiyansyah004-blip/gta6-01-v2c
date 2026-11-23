// Sound, all synthesized with WebAudio — no audio files. A low engine hum,
// a two-tone siren, gunshot noise, and three generative radio stations that
// step through their scales on a scheduler. Music starts only after the
// first user gesture (browser autoplay rules).
import { RADIO } from './config.js';

function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function makeAudio() {
  return {
    ctx: null,
    master: null,
    musicGain: null,
    sfxGain: null,
    station: 0,
    musicOn: true,
    step: 0,
    nextStepTime: 0,
    engineOsc: null,
    engineGain: null,
    sirenOsc: null,
    sirenGain: null,
    sirenPhase: 0,
  };
}

export function ensureAudio(audio) {
  if (audio.ctx) {
    if (audio.ctx.state === 'suspended') audio.ctx.resume();
    return true;
  }
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    audio.ctx = new Ctx();
    audio.master = audio.ctx.createGain();
    audio.master.gain.value = 0.5;
    audio.master.connect(audio.ctx.destination);
    audio.musicGain = audio.ctx.createGain();
    audio.musicGain.gain.value = 0.16;
    audio.musicGain.connect(audio.master);
    audio.sfxGain = audio.ctx.createGain();
    audio.sfxGain.gain.value = 0.5;
    audio.sfxGain.connect(audio.master);
    audio.nextStepTime = audio.ctx.currentTime + 0.1;
    return true;
  } catch {
    return false;
  }
}

function scheduleStep(audio) {
  const station = RADIO[audio.station];
  const stepDur = 60 / station.bpm / 2;
  while (audio.nextStepTime < audio.ctx.currentTime + 0.25) {
    const t = audio.nextStepTime;
    const s = audio.step;
    const degree = station.scale[s % station.scale.length];
    const octave = s % 16 < 8 ? 0 : 12;
    const note = station.root + degree + octave;
    // Bass on every 4th step, lead on the off-beats.
    if (s % 4 === 0) playTone(audio, midiToFreq(note - 24), t, stepDur * 3.4, 'triangle', 0.5);
    if (s % 2 === 1) playTone(audio, midiToFreq(note), t, stepDur * 1.6, 'square', 0.10);
    if (s % 8 === 4) playTone(audio, midiToFreq(note + 12), t, stepDur * 2, 'sine', 0.12);
    // Hat tick.
    playNoise(audio, t, 0.03, 0.05);
    audio.step++;
    audio.nextStepTime += stepDur;
  }
}

function playTone(audio, freq, when, dur, type, vol) {
  const osc = audio.ctx.createOscillator();
  const gain = audio.ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(vol, when);
  gain.gain.exponentialRampToValueAtTime(0.001, when + dur);
  osc.connect(gain);
  gain.connect(audio.musicGain);
  osc.start(when);
  osc.stop(when + dur + 0.02);
}

function playNoise(audio, when, dur, vol) {
  const len = Math.max(1, Math.floor(audio.ctx.sampleRate * dur));
  const buffer = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = audio.ctx.createBufferSource();
  src.buffer = buffer;
  const gain = audio.ctx.createGain();
  gain.gain.value = vol;
  src.connect(gain);
  gain.connect(audio.musicGain);
  src.start(when);
}

export function tickAudio(audio) {
  if (!audio.ctx || !audio.musicOn) return;
  scheduleStep(audio);
}

export function setStation(audio, index) {
  audio.station = ((index % RADIO.length) + RADIO.length) % RADIO.length;
  audio.step = 0;
  if (audio.ctx) audio.nextStepTime = audio.ctx.currentTime + 0.05;
}

export function stationName(audio) {
  return RADIO[audio.station].name;
}

export function toggleMusic(audio) {
  audio.musicOn = !audio.musicOn;
  if (audio.musicGain) audio.musicGain.gain.value = audio.musicOn ? 0.16 : 0;
  return audio.musicOn;
}

// --- one-shot effects -------------------------------------------------------

export function sfxShot(audio) {
  if (!audio.ctx) return;
  const t = audio.ctx.currentTime;
  const len = Math.floor(audio.ctx.sampleRate * 0.12);
  const buffer = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
  const src = audio.ctx.createBufferSource();
  src.buffer = buffer;
  const gain = audio.ctx.createGain();
  gain.gain.value = 0.7;
  const filter = audio.ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 2400;
  src.connect(filter);
  filter.connect(gain);
  gain.connect(audio.sfxGain);
  src.start(t);
}

export function sfxPunch(audio) {
  if (!audio.ctx) return;
  const t = audio.ctx.currentTime;
  const osc = audio.ctx.createOscillator();
  const gain = audio.ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(140, t);
  osc.frequency.exponentialRampToValueAtTime(50, t + 0.1);
  gain.gain.setValueAtTime(0.6, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  osc.connect(gain);
  gain.connect(audio.sfxGain);
  osc.start(t);
  osc.stop(t + 0.14);
}

export function sfxPickup(audio) {
  if (!audio.ctx) return;
  const t = audio.ctx.currentTime;
  [660, 880].forEach((freq, i) => {
    const osc = audio.ctx.createOscillator();
    const gain = audio.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.25, t + i * 0.07);
    gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.07 + 0.16);
    osc.connect(gain);
    gain.connect(audio.sfxGain);
    osc.start(t + i * 0.07);
    osc.stop(t + i * 0.07 + 0.18);
  });
}

export function sfxBusted(audio) {
  if (!audio.ctx) return;
  const t = audio.ctx.currentTime;
  [392, 311, 233].forEach((freq, i) => {
    const osc = audio.ctx.createOscillator();
    const gain = audio.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.3, t + i * 0.18);
    gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.18 + 0.3);
    osc.connect(gain);
    gain.connect(audio.sfxGain);
    osc.start(t + i * 0.18);
    osc.stop(t + i * 0.18 + 0.32);
  });
}

// Engine hum follows speed; the siren wails while any cop is near.
export function updateEngineSound(audio, speed, wanted) {
  if (!audio.ctx) return;
  if (!audio.engineOsc) {
    audio.engineOsc = audio.ctx.createOscillator();
    audio.engineGain = audio.ctx.createGain();
    audio.engineOsc.type = 'sawtooth';
    audio.engineOsc.frequency.value = 50;
    audio.engineGain.gain.value = 0;
    const filter = audio.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    audio.engineOsc.connect(filter);
    filter.connect(audio.engineGain);
    audio.engineGain.connect(audio.sfxGain);
    audio.engineOsc.start();
  }
  const target = Math.abs(speed) > 10 ? 0.05 + Math.min(0.1, Math.abs(speed) / 5000) : 0;
  audio.engineGain.gain.setTargetAtTime(target, audio.ctx.currentTime, 0.1);
  audio.engineOsc.frequency.setTargetAtTime(46 + Math.abs(speed) * 0.16, audio.ctx.currentTime, 0.1);

  if (wanted > 0 && !audio.sirenOsc) {
    audio.sirenOsc = audio.ctx.createOscillator();
    audio.sirenGain = audio.ctx.createGain();
    audio.sirenOsc.type = 'sine';
    audio.sirenGain.gain.value = 0.045;
    audio.sirenOsc.connect(audio.sirenGain);
    audio.sirenGain.connect(audio.sfxGain);
    audio.sirenOsc.start();
  }
  if (audio.sirenOsc) {
    if (wanted <= 0) {
      try { audio.sirenOsc.stop(); } catch { /* already stopped */ }
      audio.sirenOsc = null;
      audio.sirenGain = null;
    } else {
      audio.sirenPhase += 0.02;
      const f = audio.sirenPhase % 1 < 0.5 ? 720 : 540;
      audio.sirenOsc.frequency.setTargetAtTime(f, audio.ctx.currentTime, 0.05);
    }
  }
}
