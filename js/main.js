/* Blocka — game bootstrap & main loop */
(function () {
  'use strict';

  var SAVE_KEY = 'blocka_save_v1';
  var BB = window.BBlocks;

  // ---------------- global state ----------------
  var settings = window.I18N.loadSettings();
  var t = function (k) { return window.I18N.t(settings.lang, k); };
  var isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

  var renderer, scene, camera, world, player, hud, touch;
  var sunLight, ambient, sun, moon, stars, cloudMesh, cloudTex;
  var crackMesh, crackTextures, crackStage = -1;
  var highlight;

  var state = 'loading'; // loading | ready | playing | paused | dead | confirm
  var timeOfDay = 0.35;  // 0..1, 0=sunrise
  var DAY_LEN = 600;     // seconds per full day

  var inv = new Array(9).fill(null);
  var sel = 0;
  var target = null;         // raycast hit
  var breakProgress = 0;
  var breaking = false;
  var spawn = null;

  var particles = [];
  var autosaveT = 0;
  var isNewWorld = false;

  // ---------------- helpers ----------------

  function $(id) { return document.getElementById(id); }

  function applyI18n() {
    document.documentElement.lang = settings.lang;
    document.title = 'Blocka — ' + t('play');
    document.querySelectorAll('[data-i18n]').forEach(function (n) {
      n.textContent = t(n.getAttribute('data-i18n'));
    });
    if (touch && touch.enabled) touch.setLabels(t);
  }

  var toastTimer = null;
  function toast(msg) {
    var el = $('gameToast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, 2400);
  }

  function overlay(name) {
    ['loadingOverlay', 'playOverlay', 'pauseOverlay', 'deathOverlay', 'confirmOverlay'].forEach(function (id) {
      $(id).hidden = id !== name;
    });
  }

  // ---------------- save / load ----------------

  function collectSave() {
    return {
      v: 1,
      seed: world.seed,
      spawn: spawn,
      time: timeOfDay,
      player: {
        x: player.pos.x, y: player.pos.y, z: player.pos.z,
        yaw: player.yaw, pitch: player.pitch,
        hp: player.hp, food: player.food, air: player.air,
        flying: player.flying
      },
      inv: inv, sel: sel,
      edits: Array.from(world.edits)
    };
  }

  function save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(collectSave()));
      return true;
    } catch (e) { return false; }
  }

  function loadSave() {
    try {
      var raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      var s = JSON.parse(raw);
      return s && s.v === 1 ? s : null;
    } catch (e) { return null; }
  }

  // ---------------- inventory ----------------

  function addToInv(id) {
    for (var i = 0; i < 9; i++) {
      if (inv[i] && inv[i].id === id && inv[i].count < 999) { inv[i].count++; return true; }
    }
    for (i = 0; i < 9; i++) {
      if (!inv[i]) { inv[i] = { id: id, count: 1 }; return true; }
    }
    return false;
  }

  function consumeSel() {
    var s = inv[sel];
    if (!s) return;
    s.count--;
    if (s.count <= 0) inv[sel] = null;
    hud.setHotbar(inv, sel);
  }

  // ---------------- particles ----------------

  function spawnBreakParticles(x, y, z, id) {
    var N = 14;
    var geom = new THREE.BufferGeometry();
    var pos = new Float32Array(N * 3);
    var vel = [];
    for (var i = 0; i < N; i++) {
      pos[i * 3] = x + 0.5 + (Math.random() - 0.5) * 0.7;
      pos[i * 3 + 1] = y + 0.5 + (Math.random() - 0.5) * 0.7;
      pos[i * 3 + 2] = z + 0.5 + (Math.random() - 0.5) * 0.7;
      vel.push(new THREE.Vector3((Math.random() - 0.5) * 3.2, Math.random() * 3.4, (Math.random() - 0.5) * 3.2));
    }
    geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    var tex = new THREE.CanvasTexture(window.BTextures.particleCanvas(id));
    tex.magFilter = THREE.NearestFilter;
    var mat = new THREE.PointsMaterial({
      size: 0.16, map: tex, transparent: true,
      alphaTest: 0.25, depthWrite: true
    });
    var pts = new THREE.Points(geom, mat);
    scene.add(pts);
    particles.push({ pts: pts, vel: vel, life: 0.75, max: 0.75 });
  }

  function updateParticles(dt) {
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        scene.remove(p.pts);
        p.pts.geometry.dispose();
        p.pts.material.map.dispose();
        p.pts.material.dispose();
        particles.splice(i, 1);
        continue;
      }
      var arr = p.pts.geometry.attributes.position.array;
      for (var j = 0; j < p.vel.length; j++) {
        p.vel[j].y -= 12 * dt;
        arr[j * 3] += p.vel[j].x * dt;
        arr[j * 3 + 1] += p.vel[j].y * dt;
        arr[j * 3 + 2] += p.vel[j].z * dt;
      }
      p.pts.geometry.attributes.position.needsUpdate = true;
      p.pts.material.opacity = Math.min(1, p.life / p.max + 0.25);
    }
  }

  // ---------------- sky ----------------

  function buildSky() {
    ambient = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);
    sunLight = new THREE.DirectionalLight(0xfff3d6, 0.9);
    scene.add(sunLight);
    scene.add(sunLight.target);

    var sunTex = window.BTextures.makeSunTexture();
    sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTex, transparent: true, fog: false, depthWrite: false }));
    sun.scale.set(90, 90, 1);
    scene.add(sun);

    var moonTex = window.BTextures.makeMoonTexture();
    moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: moonTex, transparent: true, fog: false, depthWrite: false }));
    moon.scale.set(46, 46, 1);
    scene.add(moon);

    // stars
    var N = 420;
    var g = new THREE.BufferGeometry();
    var pos = new Float32Array(N * 3);
    for (var i = 0; i < N; i++) {
      var th = Math.random() * Math.PI * 2, ph = Math.random() * Math.PI * 0.48;
      var r = 330;
      pos[i * 3] = Math.cos(th) * Math.cos(ph) * r;
      pos[i * 3 + 1] = Math.sin(ph) * r + 8;
      pos[i * 3 + 2] = Math.sin(th) * Math.cos(ph) * r;
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    stars = new THREE.Points(g, new THREE.PointsMaterial({
      color: 0xdfe8ff, size: 1.6, sizeAttenuation: false,
      transparent: true, opacity: 0, fog: false, depthWrite: false
    }));
    scene.add(stars);

    // clouds
    cloudTex = window.BTextures.makeCloudTexture();
    cloudTex.repeat.set(4, 4);
    cloudMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(560, 560),
      new THREE.MeshBasicMaterial({
        map: cloudTex, transparent: true, opacity: 0.5,
        side: THREE.DoubleSide, fog: false, depthWrite: false
      })
    );
    cloudMesh.rotation.x = -Math.PI / 2;
    cloudMesh.position.y = 106;
    scene.add(cloudMesh);
  }

  var skyDay = new THREE.Color(0x78a6ff);
  var skySunset = new THREE.Color(0xf2955c);
  var skyNight = new THREE.Color(0x05070f);
  var fogWater = new THREE.Color(0x1b4f82);

  function smoothstep(a, b, x) {
    x = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return x * x * (3 - 2 * x);
  }

  function updateSky(dt) {
    timeOfDay = (timeOfDay + dt / DAY_LEN) % 1;
    var ang = timeOfDay * Math.PI * 2;        // 0 = sunrise, PI/2 = noon
    var elev = Math.sin(ang);
    var azim = Math.cos(ang);

    var dayF = smoothstep(-0.14, 0.28, elev);
    var duskF = (1 - Math.abs(elev)) * (1 - Math.abs(elev));

    var col = skyNight.clone().lerp(skyDay, dayF).lerp(skySunset, duskF * dayF * 0.55);
    scene.background = col;

    // fog
    var rd = settings.renderDist * 16;
    if (player.headInWater) {
      scene.fog.color.copy(fogWater);
      scene.fog.near = 1; scene.fog.far = 18;
    } else {
      scene.fog.color.copy(col);
      scene.fog.near = rd * 0.55; scene.fog.far = rd * 0.95;
    }

    // lights
    ambient.intensity = 0.34 + dayF * 0.42;
    var sd = new THREE.Vector3(azim, elev, 0.35).normalize();
    sunLight.position.copy(player.pos).addScaledVector(sd, 120);
    sunLight.target.position.copy(player.pos);
    sunLight.intensity = 0.1 + dayF * 0.85;
    sunLight.color.setHSL(0.11, duskF * 0.55 + dayF * 0.25, 0.62 + dayF * 0.18);

    sun.position.copy(player.pos).addScaledVector(sd, 300);
    sun.material.opacity = smoothstep(-0.25, 0.05, elev);
    moon.position.copy(player.pos).addScaledVector(sd, -300);
    moon.material.opacity = smoothstep(0.05, 0.3, -elev);
    stars.material.opacity = (1 - dayF) * 0.85;
    stars.position.set(player.pos.x, player.pos.y, player.pos.z);

    // clouds follow player (quantized to avoid swimming)
    cloudMesh.visible = settings.clouds;
    if (settings.clouds) {
      cloudMesh.position.x = Math.round(player.pos.x / 8) * 8;
      cloudMesh.position.z = Math.round(player.pos.z / 8) * 8;
      cloudTex.offset.x += dt * 0.0035;
      cloudTex.offset.y += dt * 0.0012;
      cloudMesh.material.opacity = 0.25 + dayF * 0.3;
    }
  }

  // ---------------- interaction ----------------

  function playerAABBOverlapBlock(bx, by, bz) {
    var p = player.pos;
    return bx + 1 > p.x - 0.3 && bx < p.x + 0.3 &&
           bz + 1 > p.z - 0.3 && bz < p.z + 0.3 &&
           by + 1 > p.y && by < p.y + 1.8;
  }

  function currentTarget() {
    var eye = player.eyePos();
    var dir = player.forwardDir();
    return world.raycast(eye, dir, 7);
  }

  function updateTargetVisual(hit) {
    if (hit) {
      highlight.visible = true;
      highlight.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
    } else {
      highlight.visible = false;
    }
  }

  var lastBreakKey = '';

  function updateBreaking(dt) {
    var hit = currentTarget();
    target = hit;
    updateTargetVisual(hit);

    // reset progress when aiming at another block
    var bk = hit ? hit.x + ',' + hit.y + ',' + hit.z : '';
    if (bk !== lastBreakKey) {
      lastBreakKey = bk;
      if (breakProgress > 0) {
        breakProgress = 0;
        crackMesh.visible = false;
        crackStage = -1;
      }
    }

    if (breaking && hit) {
      var d = BB.BLOCKS[hit.id];
      if (d && isFinite(d.hard)) {
        breakProgress += dt / d.hard;
        if (Math.floor(breakProgress * 4) !== Math.floor((breakProgress - dt / d.hard) * 4)) {
          window.BSound.dig(d.sound);
        }
        // crack stage
        var st = Math.min(5, Math.floor(breakProgress * 6));
        if (st !== crackStage) {
          crackStage = st;
          crackMesh.material.map = crackTextures[st];
        }
        crackMesh.visible = true;
        crackMesh.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
        hud.setBreakProgress(breakProgress);

        if (breakProgress >= 1) {
          window.BSound.breakBlock(d.sound);
          spawnBreakParticles(hit.x, hit.y, hit.z, hit.id);
          world.setBlock(hit.x, hit.y, hit.z, 0);
          // drops
          if (d.drop) {
            if (!addToInv(d.drop)) toast(t('inv_full'));
            else window.BSound.pop();
          }
          if (d.appleChance && Math.random() < d.appleChance) {
            if (addToInv(BB.APPLE)) window.BSound.pop();
          }
          hud.setHotbar(inv, sel);
          breakProgress = 0;
          crackMesh.visible = false;
          crackStage = -1;
        }
        return;
      }
    }
    if (breakProgress > 0) {
      breakProgress = 0;
      crackMesh.visible = false;
      crackStage = -1;
    }
    hud.setBreakProgress(-1);
  }

  function placeOrUse() {
    if (player.dead) return;
    var slot = inv[sel];
    if (!slot) return;

    // eat food
    if (BB.isItem(slot.id)) {
      if (player.eat(slot.id)) {
        window.BSound.eat();
        consumeSel();
        hud.setHotbar(inv, sel);
      }
      return;
    }

    var hit = currentTarget();
    if (!hit || !hit.face) return;
    var bx = hit.x + hit.face[0], by = hit.y + hit.face[1], bz = hit.z + hit.face[2];
    var existing = world.getBlock(bx, by, bz);
    if (existing !== 0 && !BB.isLiquid(existing)) return;
    if (playerAABBOverlapBlock(bx, by, bz) && BB.isSolid(slot.id)) return;

    world.setBlock(bx, by, bz, slot.id);
    window.BSound.place(BB.BLOCKS[slot.id].sound);
    consumeSel();
  }

  // ---------------- pointer lock & input ----------------

  var canvas = $('gl');

  function lockPointer() {
    if (isTouch || !canvas.requestPointerLock) return;
    try {
      var p = canvas.requestPointerLock({ unadjustedMovement: true });
      if (p && p.catch) p.catch(function () {
        try { canvas.requestPointerLock(); } catch (e) { /* cooldown */ }
      });
    } catch (e) {
      try { canvas.requestPointerLock(); } catch (e2) { /* ignore */ }
    }
  }

  function startPlaying() {
    if (state === 'dead') return;
    overlay(null);
    state = 'playing';
    if (!isTouch) lockPointer();
    if (touch && touch.enabled) touch.setActive(true);
    window.BSound.resume();
    window.BSound.startAmbience();
  }

  function openPause() {
    if (state !== 'playing') return;
    state = 'paused';
    overlay('pauseOverlay');
    if (touch && touch.enabled) touch.setActive(false);
    if (document.exitPointerLock) document.exitPointerLock();
    save(); toast(t('saved'));
    syncPauseSettings();
  }

  document.addEventListener('pointerlockchange', function () {
    if (!document.pointerLockElement && state === 'playing' && !isTouch) {
      openPause();
    }
  });

  document.addEventListener('mousemove', function (e) {
    if (state !== 'playing' || isTouch || !document.pointerLockElement) return;
    player.look(e.movementX || 0, e.movementY || 0, settings.sens, settings.invertY);
  });

  document.addEventListener('mousedown', function (e) {
    if (state !== 'playing' || isTouch) return;
    if (!document.pointerLockElement) { lockPointer(); return; }
    if (e.button === 0) breaking = true;
    else if (e.button === 2) placeOrUse();
  });
  document.addEventListener('mouseup', function (e) {
    if (e.button === 0) breaking = false;
  });
  document.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  document.addEventListener('wheel', function (e) {
    if (state !== 'playing' || !hud) return;
    sel = (sel + (e.deltaY > 0 ? 1 : 8)) % 9;
    hud.setHotbar(inv, sel);
    showSelName();
    window.BSound.click();
  }, { passive: true });

  document.addEventListener('keydown', function (e) {
    if (e.code.indexOf('Digit') === 0 && hud) {
      var n = +e.code.slice(5);
      if (n >= 1 && n <= 9) {
        sel = n - 1;
        hud.setHotbar(inv, sel);
        showSelName();
      }
    }
    if (e.code === 'KeyF') {
      if (document.fullscreenElement) document.exitFullscreen().catch(function () {});
      else document.documentElement.requestFullscreen().catch(function () {});
    }
    if (e.code === 'Escape') {
      if (!$('confirmOverlay').hidden) { $('confirmOverlay').hidden = true; return; }
      if (state === 'playing' && isTouch) openPause();
      else if (state === 'paused' && $('pauseSettings').hidden) $('btnResume').click();
    }
  });

  function showSelName() {
    var slot = inv[sel];
    if (!slot) return;
    var hint = BB.isItem(slot.id) ? t('eat_hint') : null;
    hud.showName(t('block_' + slot.id), hint);
  }

  // ---------------- pause menu wiring ----------------

  var pRender = $('pRender'), pFov = $('pFov'), pSens = $('pSens'), pVol = $('pVol'),
      pClouds = $('pClouds'), pInvert = $('pInvert');

  function syncPauseSettings() {
    pRender.value = settings.renderDist;
    $('pRenderVal').textContent = settings.renderDist + ' ' + t('chunks');
    pFov.value = settings.fov;
    $('pFovVal').textContent = settings.fov + '°';
    pSens.value = settings.sens;
    $('pSensVal').textContent = Number(settings.sens).toFixed(1);
    pVol.value = settings.volume;
    $('pVolVal').textContent = Math.round(settings.volume * 100) + '%';
    pClouds.checked = !!settings.clouds;
    pInvert.checked = !!settings.invertY;
  }

  function bindP(el, fn) {
    el.addEventListener('input', function () {
      fn();
      window.I18N.saveSettings(settings);
      window.BSound.setVolume(settings.volume);
    });
  }
  bindP(pRender, function () { settings.renderDist = +pRender.value; syncPauseSettings(); });
  bindP(pFov, function () { settings.fov = +pFov.value; camera.fov = settings.fov; camera.updateProjectionMatrix(); syncPauseSettings(); });
  bindP(pSens, function () { settings.sens = +pSens.value; syncPauseSettings(); });
  bindP(pVol, function () { settings.volume = +pVol.value; syncPauseSettings(); });
  bindP(pClouds, function () { settings.clouds = pClouds.checked; });
  bindP(pInvert, function () { settings.invertY = pInvert.checked; });

  $('btnResume').addEventListener('click', function () { startPlaying(); });
  $('btnPauseSettings').addEventListener('click', function () {
    var ps = $('pauseSettings');
    ps.hidden = !ps.hidden;
  });
  $('btnSaveExit').addEventListener('click', function () {
    save();
    window.location.href = 'index.html';
  });
  $('btnNewWorld').addEventListener('click', function () {
    $('confirmText').textContent = t('new_world_confirm');
    $('confirmOverlay').hidden = false;
  });
  $('btnConfirmNo').addEventListener('click', function () { $('confirmOverlay').hidden = true; });
  $('btnConfirmYes').addEventListener('click', function () {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
    window.location.href = 'game.html?new=1';
  });
  $('btnRespawn').addEventListener('click', function () {
    player.respawn(spawn);
    overlay('playOverlay');
    state = 'ready';
    if (isTouch) startPlaying();
  });

  $('playOverlay').addEventListener('click', startPlaying);
  $('pauseBtn').addEventListener('click', function () {
    if (state === 'playing') openPause();
  });

  // ---------------- boot ----------------

  function urlParams() {
    var q = {};
    location.search.replace(/[?&]([^=]+)=([^&]*)/g, function (m, k, v) { q[k] = decodeURIComponent(v); });
    return q;
  }

  function boot() {
    applyI18n();
    window.BSound.setVolume(settings.volume);

    var q = urlParams();
    if (q.new) { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} }
    var saveData = q.new ? null : loadSave();
    isNewWorld = !saveData;
    var seed;
    if (saveData) seed = saveData.seed;
    else if (q.seed) seed = parseInt(q.seed, 10) >>> 0;
    else seed = (Math.random() * 0xffffffff) >>> 0;

    // renderer
    renderer = new THREE.WebGLRenderer({
      canvas: canvas, antialias: false, powerPreference: 'high-performance'
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setSize(window.innerWidth, window.innerHeight);

    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x78a6ff, 40, 120);
    camera = new THREE.PerspectiveCamera(settings.fov, window.innerWidth / window.innerHeight, 0.1, 900);

    window.addEventListener('resize', function () {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });

    $('loadLabel').textContent = t('loading');
    $('loadFill').style.width = '8%';

    window.BTextures.ready.then(function () {
      $('loadFill').style.width = '22%';

      var opaqueMat = new THREE.MeshLambertMaterial({
        map: window.BTextures.atlas, vertexColors: true, alphaTest: 0.5
      });
      var waterMat = new THREE.MeshLambertMaterial({
        map: window.BTextures.atlas, vertexColors: true,
        transparent: true, opacity: 0.75
      });
      var materials = { opaque: opaqueMat, water: waterMat };

      world = new window.BWorld.World(seed, materials);

      spawn = { x: 8.5, y: 60, z: 8.5 };
      if (saveData) {
        spawn = saveData.spawn;
        timeOfDay = saveData.time;
        saveData.edits.forEach(function (kv) { world.edits.set(kv[0], kv[1]); });
        inv = saveData.inv.map(function (s) { return s ? { id: s.id, count: s.count } : null; });
        sel = Math.min(8, saveData.sel || 0);
      } else {
        spawn = world.findSpawn();
        // starter kit
        inv[0] = { id: BB.PLANKS, count: 32 };
        inv[1] = { id: BB.LOG, count: 16 };
        inv[2] = { id: BB.APPLE, count: 3 };
      }

      player = new window.BPlayer.Player(world, scene);
      player.bindKeys();
      if (saveData) {
        var sp = saveData.player;
        player.pos.set(sp.x, sp.y, sp.z);
        player.yaw = sp.yaw; player.pitch = sp.pitch;
        player.hp = sp.hp; player.food = sp.food; player.air = sp.air;
        player.flying = !!sp.flying;
      } else {
        player.pos.set(spawn.x, spawn.y + 1, spawn.z);
        // face roughly toward water/plains
        player.yaw = Math.PI * 0.75;
      }

      player.onDamage = function (n, cause) {
        hud.flash();
        window.BSound.hurt();
        if (player.dead) setTimeout(showDeath, 350);
      };
      player.onStep = function () {
        var under = world.getBlock(Math.floor(player.pos.x), Math.floor(player.pos.y - 0.5), Math.floor(player.pos.z));
        var d = BB.BLOCKS[under];
        window.BSound.step(d ? d.sound : 'stone');
      };
      player.onSplash = function () { window.BSound.splash(); };
      player.onSwim = function () { window.BSound.swim(); };
      player.onEat = function () {};

      function showDeath() {
        state = 'dead';
        overlay('deathOverlay');
        if (touch && touch.enabled) touch.setActive(false);
        if (document.exitPointerLock) document.exitPointerLock();
      }

      // HUD
      hud = new window.BHud.Hud($('hudRoot'), t);
      hud.setHotbar(inv, sel);
      $('pauseBtn').hidden = !isTouch;

      // target highlight + crack overlay
      highlight = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(1.002, 1.002, 1.002)),
        new THREE.LineBasicMaterial({ color: 0x0a0a0a, transparent: true, opacity: 0.7 })
      );
      highlight.visible = false;
      scene.add(highlight);

      crackTextures = window.BTextures.makeCrackTextures();
      crackMesh = new THREE.Mesh(
        new THREE.BoxGeometry(1.004, 1.004, 1.004),
        new THREE.MeshBasicMaterial({
          map: crackTextures[0], transparent: true,
          polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false
        })
      );
      crackMesh.visible = false;
      scene.add(crackMesh);

      buildSky();

      // touch controls
      touch = new window.BTouch.Touch($('app'), {
        t: t,
        onLook: function (dx, dy) { if (state === 'playing') player.look(dx, dy, settings.sens * 1.6, settings.invertY); },
        onMove: function (x, y) { player.touchMove.x = x; player.touchMove.y = y; },
        onJump: function (v) { player.touchJump = v; },
        onBreak: function (v) { breaking = v; },
        onPlace: function () { if (state === 'playing') placeOrUse(); }
      });
      if (touch.enabled) touch.setLabels(t);

      // pregenerate spawn area with progress
      $('loadLabel').textContent = t('generating');
      var R = settings.renderDist;
      var pcx = Math.floor(player.pos.x / 16), pcz = Math.floor(player.pos.z / 16);
      var list = [];
      for (var r = 0; r <= R; r++) {
        for (var dx = -r; dx <= r; dx++) {
          for (var dz = -r; dz <= r; dz++) {
            if (Math.max(Math.abs(dx), Math.abs(dz)) === r) list.push([pcx + dx, pcz + dz]);
          }
        }
      }
      var total = list.length, done = 0;
      function genStep() {
        var slice = 4;
        while (slice-- > 0 && done < total) {
          var c = list[done++];
          var chunk = world.ensureChunk(c[0], c[1]);
          world.buildMesh(chunk, scene);
        }
        $('loadFill').style.width = (22 + (done / total) * 78).toFixed(1) + '%';
        if (done < total) setTimeout(genStep, 0);
        else finishLoad();
      }
      genStep();
    }).catch(function (err) {
      $('loadLabel').textContent = 'Error: ' + err.message;
      console.error(err);
    });
  }

  function finishLoad() {
    // for fresh worlds make sure we stand on the real surface (not inside a tree)
    if (isNewWorld) {
      var sx = Math.floor(player.pos.x), sz = Math.floor(player.pos.z);
      for (var y = window.BWorld.HEIGHT - 1; y > 0; y--) {
        if (BB.isSolid(world.getBlock(sx, y, sz))) {
          player.pos.y = y + 1.01;
          spawn.y = y + 2;
          break;
        }
      }
    }
    state = 'ready';
    overlay('playOverlay');
    if (isTouch) {
      // no pointer lock on touch: the overlay tap starts directly
      $('playOverlay').querySelector('.ov-sub').textContent = '';
    }
    updateSky(0);
    requestAnimationFrame(loop);
  }

  // ---------------- main loop ----------------

  var lastT = 0;
  var fovCur = null;
  var nameTimer = 0;
  var lastTargetKey = '';

  function loop(now) {
    requestAnimationFrame(loop);
    var dt = Math.min(0.05, (now - lastT) / 1000 || 0.016);
    lastT = now;

    if (state === 'playing') {
      player.update(dt);
      if (player.dead && state === 'playing') {
        // handled via onDamage callback timeout
      }
      updateBreaking(dt);
      updateSky(dt);
      world.update(player.pos.x, player.pos.z, settings.renderDist, scene, 3);
      updateParticles(dt);
      hud.updateStats(player.hp, player.food, player.air);
      hud.setUnderwater(player.headInWater);

      // aim block name
      nameTimer += dt;
      if (nameTimer > 0.25) {
        nameTimer = 0;
        var k = target ? target.x + ',' + target.y + ',' + target.z + ',' + target.id : '';
        if (k !== lastTargetKey) {
          lastTargetKey = k;
          if (target) hud.showName(t('block_' + target.id));
        }
      }

      // autosave
      autosaveT += dt;
      if (autosaveT > 20) { autosaveT = 0; if (save()) toast(t('saved')); }
    }

    // camera
    var eye = player ? player.eyePosBobbed() : { x: 8, y: 40, z: 8 };
    camera.position.set(eye.x, eye.y, eye.z);
    if (player) {
      camera.rotation.order = 'YXZ';
      camera.rotation.y = player.yaw;
      camera.rotation.x = player.pitch;
      camera.rotation.z = 0;
      var targetFov = settings.fov + (player.sprinting && !player.flying ? 6 : 0);
      if (fovCur === null || Math.abs(targetFov - fovCur) > 0.05) {
        fovCur = fovCur === null ? targetFov : fovCur + (targetFov - fovCur) * Math.min(1, dt * 8);
        camera.fov = fovCur;
        camera.updateProjectionMatrix();
      }
    }

    renderer.render(scene, camera);
  }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden && state === 'playing') openPause();
  });

  boot();
})();
