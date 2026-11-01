/* Blocka — main menu logic */
(function () {
  'use strict';

  var settings = window.I18N.loadSettings();
  var SAVE_KEY = 'blocka_save_v1';

  function t(k) { return window.I18N.t(settings.lang, k); }

  function applyLang() {
    document.documentElement.lang = settings.lang;
    var nodes = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].textContent = t(nodes[i].getAttribute('data-i18n'));
    }
    document.title = 'Blocka — ' + t('tagline').toLowerCase().replace(/\./g, '').trim();
    syncSettingsUI();
  }

  // ---------- toast ----------
  var toastEl = document.getElementById('toast');
  var toastTimer = null;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.hidden = true; }, 2800);
  }

  // ---------- modals ----------
  function openModal(id) { document.getElementById(id).hidden = false; }
  function closeModal(id) { document.getElementById(id).hidden = true; }

  document.querySelectorAll('.modal-mask').forEach(function (m) {
    m.addEventListener('click', function (e) { if (e.target === m) m.hidden = true; });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-mask').forEach(function (m) { m.hidden = true; });
    }
  });

  // ---------- settings UI ----------
  var elRender = document.getElementById('setRender');
  var elFov = document.getElementById('setFov');
  var elSens = document.getElementById('setSens');
  var elVol = document.getElementById('setVol');
  var elClouds = document.getElementById('setClouds');
  var elInvert = document.getElementById('setInvert');

  function syncSettingsUI() {
    elRender.value = settings.renderDist;
    document.getElementById('setRenderVal').textContent = settings.renderDist + ' ' + t('chunks');
    elFov.value = settings.fov;
    document.getElementById('setFovVal').textContent = settings.fov + '°';
    elSens.value = settings.sens;
    document.getElementById('setSensVal').textContent = Number(settings.sens).toFixed(1);
    elVol.value = settings.volume;
    document.getElementById('setVolVal').textContent = Math.round(settings.volume * 100) + '%';
    elClouds.checked = !!settings.clouds;
    elInvert.checked = !!settings.invertY;
    document.querySelectorAll('#segLang button').forEach(function (b) {
      b.classList.toggle('active', b.dataset.lang === settings.lang);
    });
  }

  function bind(input, fn) {
    input.addEventListener('input', function () { fn(); window.I18N.saveSettings(settings); });
  }
  bind(elRender, function () { settings.renderDist = +elRender.value; syncSettingsUI(); });
  bind(elFov, function () { settings.fov = +elFov.value; syncSettingsUI(); });
  bind(elSens, function () { settings.sens = +elSens.value; syncSettingsUI(); });
  bind(elVol, function () { settings.volume = +elVol.value; syncSettingsUI(); });
  bind(elClouds, function () { settings.clouds = elClouds.checked; });
  bind(elInvert, function () { settings.invertY = elInvert.checked; });

  document.querySelectorAll('#segLang button').forEach(function (b) {
    b.addEventListener('click', function () {
      settings.lang = b.dataset.lang;
      window.I18N.saveSettings(settings);
      applyLang();
    });
  });

  document.getElementById('btnSettings').addEventListener('click', function () { openModal('settingsModal'); });
  document.getElementById('btnSettingsClose').addEventListener('click', function () { closeModal('settingsModal'); });
  document.getElementById('btnHelp').addEventListener('click', function () { openModal('helpModal'); });
  document.getElementById('btnHelpClose').addEventListener('click', function () { closeModal('helpModal'); });

  // ---------- top bar ----------
  document.getElementById('btnLang').addEventListener('click', function () {
    settings.lang = settings.lang === 'ru' ? 'en' : 'ru';
    window.I18N.saveSettings(settings);
    applyLang();
  });
  document.getElementById('btnFull').addEventListener('click', function () {
    if (document.fullscreenElement) document.exitFullscreen().catch(function () {});
    else document.documentElement.requestFullscreen().catch(function () {});
  });

  // ---------- play flow ----------
  function hasSave() {
    try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
  }

  function hashSeed(str) {
    var h = 1779033703 ^ str.length;
    for (var i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return (h >>> 0) || 1337;
  }

  function startGame(forceNew, seedStr) {
    var url = 'game.html';
    var params = [];
    if (forceNew) params.push('new=1');
    if (seedStr) params.push('seed=' + encodeURIComponent(seedStr));
    if (params.length) url += '?' + params.join('&');
    window.location.href = url;
  }

  document.getElementById('btnPlay').addEventListener('click', function () {
    startGame(false);
  });

  document.getElementById('btnSingle').addEventListener('click', function () {
    var save = hasSave();
    document.getElementById('btnContinue').hidden = !save;
    document.getElementById('overwriteWarn').hidden = !save;
    document.getElementById('nosaveInfo').hidden = save;
    openModal('worldModal');
    document.getElementById('seedInput').focus();
  });

  document.getElementById('btnContinue').addEventListener('click', function () { startGame(false); });
  document.getElementById('btnWorldStart').addEventListener('click', function () {
    var seed = document.getElementById('seedInput').value.trim();
    startGame(true, seed ? String(hashSeed(seed)) : '');
  });
  document.getElementById('btnWorldBack').addEventListener('click', function () { closeModal('worldModal'); });

  document.getElementById('btnMulti').addEventListener('click', function () { toast(t('multi_toast')); });
  document.getElementById('btnMore').addEventListener('click', function () { toast(t('details_toast')); });
  document.getElementById('btnExit').addEventListener('click', function () { toast(t('exit_toast')); });

  // ---------- subtle parallax on background ----------
  var bg = document.getElementById('bg');
  document.addEventListener('mousemove', function (e) {
    var dx = (e.clientX / window.innerWidth - 0.5) * 14;
    var dy = (e.clientY / window.innerHeight - 0.5) * 10;
    bg.style.transform = 'scale(1.05) translate(' + (-dx) + 'px,' + (-dy) + 'px)';
  });

  // keyboard: Enter starts game
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.target.closest('input')) {
      var anyModal = document.querySelector('.modal-mask:not([hidden])');
      if (!anyModal) startGame(false);
    }
  });

  applyLang();
})();
