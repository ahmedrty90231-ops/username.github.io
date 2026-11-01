/* Blocka — HUD: hearts, food, air, hotbar with items, tooltips. (window.BHud) */
(function () {
  'use strict';

  var SLOT_N = 9;

  function el(tag, cls, parent) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (parent) parent.appendChild(e);
    return e;
  }

  function Hud(root, t) {
    this.t = t; // i18n fn
    this.root = root;

    this.hudEl = el('div', 'hud', root);

    // status rows (air above; hearts left + food right, MC-style)
    this.statusEl = el('div', 'status', this.hudEl);
    this.airEl = el('div', 'stat-row air', this.statusEl);
    this.lineEl = el('div', 'stat-line', this.statusEl);
    this.heartsEl = el('div', 'stat-row', this.lineEl);
    this.foodEl = el('div', 'stat-row food', this.lineEl);

    this.heartImgs = [];
    this.foodImgs = [];
    for (var i = 0; i < 10; i++) {
      this.heartImgs.push(el('img', 'stat-ic', this.heartsEl));
    }
    for (i = 9; i >= 0; i--) {
      var im = el('img', 'stat-ic', this.foodEl);
      this.foodImgs[i] = im;
    }

    this.airImgs = [];
    for (i = 0; i < 10; i++) this.airImgs.push(el('span', 'bubble', this.airEl));

    // hotbar
    this.hotbarEl = el('div', 'hotbar', this.hudEl);
    var bg = el('img', 'hotbar-bg', this.hotbarEl);
    bg.src = 'assets/ui/hotbar.png';
    bg.draggable = false;
    this.slotsEl = [];
    this.countsEl = [];
    var inner = el('div', 'hotbar-slots', this.hotbarEl);
    for (i = 0; i < SLOT_N; i++) {
      var s = el('div', 'slot', inner);
      var ic = el('img', 'slot-icon', s);
      ic.draggable = false;
      var cnt = el('span', 'slot-count', s);
      this.slotsEl.push(ic);
      this.countsEl.push(cnt);
    }
    this.selEl = el('img', 'hotbar-sel', this.hotbarEl);
    this.selEl.src = 'assets/ui/hotbar_sel.png';
    this.selEl.draggable = false;

    // center tooltip: block name / hints
    this.nameEl = el('div', 'block-name', this.hudEl);
    this.nameTimer = null;

    // crosshair
    this.crossEl = el('div', 'crosshair', this.hudEl);

    // break progress
    this.breakBarEl = el('div', 'break-bar', this.hudEl);
    this.breakFill = el('div', 'break-fill', this.breakBarEl);

    // damage flash + water overlay
    this.flashEl = el('div', 'damage-flash', this.hudEl);
    this.waterEl = el('div', 'water-overlay', this.hudEl);

    this.setSel(0);
    this.updateStats(20, 20, 10);
  }

  Hud.prototype.updateStats = function (hp, food, air) {
    if (hp === this._hp && food === this._food && air === this._air) return;
    this._hp = hp; this._food = food; this._air = air;
    for (var i = 0; i < 10; i++) {
      var v = hp - i * 2;
      this.heartImgs[i].src = v >= 2 ? 'assets/ui/heart_full.png' : v === 1 ? 'assets/ui/heart_half.png' : 'assets/ui/heart_empty.png';
      var f = food - i * 2;
      this.foodImgs[i].src = f >= 2 ? 'assets/ui/food_full.png' : f === 1 ? 'assets/ui/food_half.png' : 'assets/ui/food_empty.png';
      this.airImgs[i].className = 'bubble' + (air > i ? ' on' : '');
    }
    this.airEl.style.display = air < 10 ? 'flex' : 'none';
    this.foodEl.classList.toggle('low', food <= 6);
    this.heartsEl.classList.toggle('low', hp <= 6);
  };

  Hud.prototype.setHotbar = function (inv, sel) {
    for (var i = 0; i < SLOT_N; i++) {
      var slot = inv[i];
      var ic = this.slotsEl[i];
      if (slot && slot.id) {
        if (ic.dataset.icon !== String(slot.id)) {
          ic.src = window.BTextures.slotIcon(slot.id, 72);
          ic.dataset.icon = String(slot.id);
        }
        ic.style.display = 'block';
        this.countsEl[i].textContent = slot.count > 1 ? slot.count : '';
      } else {
        ic.style.display = 'none';
        ic.dataset.icon = '';
        this.countsEl[i].textContent = '';
      }
    }
    this.setSel(sel);
  };

  Hud.prototype.setSel = function (sel) {
    // slot centers measured from hotbar.png (718x110): first center x=69px, pitch ~79.3px
    var pct = ((69 + sel * 79.3) / 718) * 100;
    this.selEl.style.left = 'calc(' + pct + '% - 0px)';
  };

  Hud.prototype.showName = function (txt, hint) {
    this.nameEl.textContent = txt + (hint ? '  ·  ' + hint : '');
    this.nameEl.classList.add('show');
    clearTimeout(this.nameTimer);
    var self = this;
    this.nameTimer = setTimeout(function () { self.nameEl.classList.remove('show'); }, 1600);
  };

  Hud.prototype.setBreakProgress = function (p) {
    if (p == null || p <= 0) { this.breakBarEl.classList.remove('show'); return; }
    this.breakBarEl.classList.add('show');
    this.breakFill.style.width = Math.min(100, p * 100) + '%';
  };

  Hud.prototype.flash = function () {
    this.flashEl.classList.remove('on');
    void this.flashEl.offsetWidth;
    this.flashEl.classList.add('on');
  };

  Hud.prototype.setUnderwater = function (on) {
    this.waterEl.classList.toggle('on', on);
  };

  window.BHud = { Hud: Hud, SLOTS: SLOT_N };
})();
