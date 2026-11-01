/* Blocka — procedural WebAudio sound engine (window.BSound) */
(function () {
  'use strict';

  var ctx = null;
  var master = null;
  var volume = 0.7;

  function ensure() {
    if (ctx) return true;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = volume;
      master.connect(ctx.destination);
    } catch (e) { return false; }
    return true;
  }

  function resume() {
    if (ensure() && ctx.state === 'suspended') ctx.resume();
  }

  function setVolume(v) {
    volume = v;
    if (master) master.gain.value = v;
  }

  // short filtered noise burst
  function noiseBurst(dur, freq, q, gain, type) {
    if (!ensure() || ctx.state !== 'running') return;
    var len = Math.max(1, (dur * ctx.sampleRate) | 0);
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var src = ctx.createBufferSource();
    src.buffer = buf;
    var f = ctx.createBiquadFilter();
    f.type = type || 'bandpass';
    f.frequency.value = freq;
    f.Q.value = q || 1;
    var g = ctx.createGain();
    g.gain.value = gain;
    src.connect(f); f.connect(g); g.connect(master);
    src.start();
  }

  // pitched tap
  function blip(freq, dur, gain, type, slide) {
    if (!ensure() || ctx.state !== 'running') return;
    var o = ctx.createOscillator();
    o.type = type || 'triangle';
    o.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), ctx.currentTime + dur);
    var g = ctx.createGain();
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g); g.connect(master);
    o.start(); o.stop(ctx.currentTime + dur + 0.02);
  }

  var MAT_FREQ = {
    stone: 500, dirt: 900, grass: 1400, wood: 700,
    sand: 1800, glass: 2600, leaves: 2400, snow: 1700
  };

  function dig(mat) {
    var f = MAT_FREQ[mat] || 900;
    noiseBurst(0.09, f, 1.4, 0.5);
    if (mat === 'wood') blip(180, 0.07, 0.25, 'triangle');
  }

  function breakBlock(mat) {
    var f = MAT_FREQ[mat] || 900;
    noiseBurst(0.16, f, 1.0, 0.7);
    noiseBurst(0.1, f * 1.6, 1.2, 0.35);
    if (mat === 'glass') blip(1900, 0.1, 0.2, 'sine', 900);
  }

  function place(mat) {
    var f = MAT_FREQ[mat] || 900;
    noiseBurst(0.07, f * 0.8, 1.5, 0.45);
    blip(mat === 'wood' ? 150 : 110, 0.08, 0.18, 'triangle');
  }

  function step(mat) {
    var f = MAT_FREQ[mat] || 900;
    noiseBurst(0.06, f * 0.7, 1.2, 0.18);
  }

  function pop() { blip(320, 0.09, 0.28, 'square', 260); }
  function hurt() { blip(140, 0.18, 0.4, 'sawtooth', -60); }
  function splash() { noiseBurst(0.35, 800, 0.8, 0.5, 'lowpass'); }
  function swim() { noiseBurst(0.14, 600, 0.9, 0.16, 'lowpass'); }
  function click() { blip(900, 0.045, 0.14, 'square'); }
  function eat() {
    noiseBurst(0.07, 1200, 1.5, 0.3);
    setTimeout(function () { noiseBurst(0.07, 1000, 1.5, 0.3); }, 120);
    setTimeout(function () { noiseBurst(0.09, 1400, 1.5, 0.28); }, 250);
  }
  function levelup() {
    blip(520, 0.09, 0.2, 'sine');
    setTimeout(function () { blip(660, 0.09, 0.2, 'sine'); }, 90);
    setTimeout(function () { blip(880, 0.14, 0.2, 'sine'); }, 180);
  }
  function fall(thud) { noiseBurst(0.12, 300, 1, 0.6, 'lowpass'); if (thud) hurt(); }

  // gentle wind ambience
  var windTimer = null;
  function startAmbience() {
    if (windTimer) return;
    windTimer = setInterval(function () {
      if (!ensure() || ctx.state !== 'running') return;
      noiseBurst(2.4, 240 + Math.random() * 120, 0.4, 0.05, 'lowpass');
    }, 3600);
  }

  window.BSound = {
    resume: resume,
    setVolume: setVolume,
    dig: dig,
    breakBlock: breakBlock,
    place: place,
    step: step,
    pop: pop,
    hurt: hurt,
    splash: splash,
    swim: swim,
    click: click,
    eat: eat,
    levelup: levelup,
    fall: fall,
    startAmbience: startAmbience
  };
})();
