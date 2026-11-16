// Synthesised sound: every effect and the music loop are built with the Web
// Audio API, so the game ships no audio files at all. Nothing here runs until
// the player has pressed a key or clicked (the browser's autoplay rule), and
// the mute key M, or the button on the title screen, silences it.
export function createSound() {
  let ctx = null;
  let master = null;
  let musicTimer = null;
  let muted = false;
  try {
    muted = window.localStorage.getItem('neon-void.muted') === '1';
  } catch {
    muted = false;
  }

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    const AudioContext = window.AudioContext ?? window.webkitAudioContext;
    if (!AudioContext) return false;
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);
    return true;
  }

  function tone({ freq, freqEnd, dur, type = 'square', vol = 0.2, when = 0 }) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (freqEnd !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise({ dur, vol = 0.25, freq = 1200, when = 0 }) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + when;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(t0);
  }

  // A slow minor-key bass pulse with a hat tick, one bar at a time.
  const BASS = [55, 55, 65.41, 49, 55, 55, 82.41, 73.42];
  let bar = 0;
  function musicStep() {
    if (!ctx || muted) return;
    const root = BASS[bar % BASS.length];
    tone({ freq: root, dur: 0.42, type: 'triangle', vol: 0.16 });
    tone({ freq: root * 2, dur: 0.1, type: 'sine', vol: 0.05, when: 0.22 });
    noise({ dur: 0.03, vol: 0.04, freq: 6000, when: 0.11 });
    bar += 1;
  }

  return {
    get muted() { return muted; },
    unlock() { ensure(); },
    toggleMute() {
      muted = !muted;
      try { window.localStorage.setItem('neon-void.muted', muted ? '1' : '0'); } catch { /* storage can be off */ }
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    startMusic() {
      if (!ensure() || musicTimer !== null) return;
      musicTimer = window.setInterval(musicStep, 240);
    },
    stopMusic() {
      if (musicTimer !== null) { window.clearInterval(musicTimer); musicTimer = null; }
    },
    shoot() { tone({ freq: 880, freqEnd: 320, dur: 0.07, type: 'square', vol: 0.07 }); },
    hit() { noise({ dur: 0.05, vol: 0.1, freq: 2400 }); },
    explode() { noise({ dur: 0.35, vol: 0.3, freq: 900 }); tone({ freq: 160, freqEnd: 40, dur: 0.3, type: 'sawtooth', vol: 0.14 }); },
    pickup() { tone({ freq: 1180, freqEnd: 1760, dur: 0.08, type: 'sine', vol: 0.12 }); },
    hurt() { tone({ freq: 220, freqEnd: 70, dur: 0.25, type: 'sawtooth', vol: 0.22 }); noise({ dur: 0.15, vol: 0.18, freq: 700 }); },
    levelup() {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone({ freq: f, dur: 0.16, type: 'triangle', vol: 0.14, when: i * 0.07 }));
    },
    bossAlarm() {
      tone({ freq: 440, dur: 0.18, type: 'square', vol: 0.14 });
      tone({ freq: 440, dur: 0.18, type: 'square', vol: 0.14, when: 0.24 });
      tone({ freq: 587, dur: 0.3, type: 'square', vol: 0.14, when: 0.48 });
    },
    victory() {
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => tone({ freq: f, dur: 0.25, type: 'triangle', vol: 0.15, when: i * 0.1 }));
    },
    click() { tone({ freq: 660, dur: 0.05, type: 'sine', vol: 0.12 }); },
  };
}
