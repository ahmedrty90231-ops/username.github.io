/* Blocka — touch controls: joystick, look-drag, action buttons. (window.BTouch) */
(function () {
  'use strict';

  function Touch(root, opts) {
    // opts: { onLook(dx,dy), onJump(bool), onBreak(bool), onPlace(), t(key) }
    this.opts = opts;
    this.enabled = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    if (!this.enabled) return;

    this.player = null;
    var t = opts.t;

    var wrap = document.createElement('div');
    wrap.className = 'touch-ui';
    root.appendChild(wrap);
    this.root = wrap;

    // joystick
    this.joy = document.createElement('div');
    this.joy.className = 'joy';
    this.knob = document.createElement('div');
    this.knob.className = 'joy-knob';
    this.joy.appendChild(this.knob);
    wrap.appendChild(this.joy);

    // buttons
    this.btnJump = this._mkBtn('tbtn jump', opts.t('touch_jump'), '⤒');
    this.btnBreak = this._mkBtn('tbtn break', opts.t('touch_break'), '⛏');
    this.btnPlace = this._mkBtn('tbtn place', opts.t('touch_place'), '▣');

    var bcol = document.createElement('div');
    bcol.className = 'tbtn-col';
    bcol.appendChild(this.btnPlace);
    bcol.appendChild(this.btnBreak);
    wrap.appendChild(bcol);
    wrap.appendChild(this.btnJump);

    this._joyId = null;
    this._joyCenter = null;
    this._lookId = null;
    this._lookLast = null;

    var self = this;

    this.joy.addEventListener('touchstart', function (e) {
      e.preventDefault();
      var t0 = e.changedTouches[0];
      self._joyId = t0.identifier;
      var r = self.joy.getBoundingClientRect();
      self._joyCenter = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      self._updateJoy(t0);
    }, { passive: false });

    this.joy.addEventListener('touchmove', function (e) {
      e.preventDefault();
      self._forTouch(e, self._joyId, function (tc) { self._updateJoy(tc); });
    }, { passive: false });

    var joyEnd = function (e) {
      self._forTouch(e, self._joyId, function () {
        self._joyId = null;
        self.knob.style.transform = 'translate(0,0)';
        self.opts.onMove && self.opts.onMove(0, 0);
      });
    };
    this.joy.addEventListener('touchend', joyEnd);
    this.joy.addEventListener('touchcancel', joyEnd);

    // look area = whole screen except UI controls
    document.addEventListener('touchstart', function (e) {
      if (!self.active) return;
      for (var i = 0; i < e.changedTouches.length; i++) {
        var tc = e.changedTouches[i];
        if (tc.target.closest && tc.target.closest('.touch-ui, .tbtn, .hud-top, .pause-btn')) continue;
        if (tc.clientX < window.innerWidth * 0.4 && tc.clientY > window.innerHeight * 0.45) continue; // joystick zone
        if (self._lookId === null) {
          self._lookId = tc.identifier;
          self._lookLast = { x: tc.clientX, y: tc.clientY };
        }
      }
    }, { passive: true });

    document.addEventListener('touchmove', function (e) {
      if (self._lookId === null) return;
      self._forTouch(e, self._lookId, function (tc) {
        var dx = tc.clientX - self._lookLast.x;
        var dy = tc.clientY - self._lookLast.y;
        self._lookLast = { x: tc.clientX, y: tc.clientY };
        opts.onLook(dx * 2.4, dy * 2.4);
      });
    }, { passive: true });

    var lookEnd = function (e) {
      self._forTouch(e, self._lookId, function () { self._lookId = null; });
    };
    document.addEventListener('touchend', lookEnd);
    document.addEventListener('touchcancel', lookEnd);

    this._holdBtn(this.btnJump, function (v) { opts.onJump(v); });
    this._holdBtn(this.btnBreak, function (v) { opts.onBreak(v); });
    this.btnPlace.addEventListener('touchstart', function (e) { e.preventDefault(); opts.onPlace(); }, { passive: false });

    this.active = false;
  }

  Touch.prototype._mkBtn = function (cls, label, glyph) {
    var b = document.createElement('button');
    b.className = cls;
    b.innerHTML = '<span class="g">' + glyph + '</span><span class="l">' + label + '</span>';
    this.root.appendChild(b);
    return b;
  };

  Touch.prototype._holdBtn = function (btn, fn) {
    btn.addEventListener('touchstart', function (e) { e.preventDefault(); btn.classList.add('held'); fn(true); }, { passive: false });
    var end = function (e) { btn.classList.remove('held'); fn(false); };
    btn.addEventListener('touchend', end);
    btn.addEventListener('touchcancel', end);
  };

  Touch.prototype._forTouch = function (e, id, fn) {
    for (var i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === id) { fn(e.changedTouches[i]); return; }
    }
  };

  Touch.prototype._updateJoy = function (tc) {
    var R = 46;
    var dx = tc.clientX - this._joyCenter.x;
    var dy = tc.clientY - this._joyCenter.y;
    var len = Math.hypot(dx, dy);
    if (len > R) { dx = dx / len * R; dy = dy / len * R; }
    this.knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
    this.opts.onMove(dx / R, -dy / R);
  };

  Touch.prototype.setActive = function (on) {
    if (!this.enabled) return;
    this.active = on;
    this.root.style.display = on ? 'block' : 'none';
  };

  Touch.prototype.setLabels = function (t) {
    if (!this.enabled) return;
    this.btnJump.querySelector('.l').textContent = t('touch_jump');
    this.btnBreak.querySelector('.l').textContent = t('touch_break');
    this.btnPlace.querySelector('.l').textContent = t('touch_place');
  };

  window.BTouch = { Touch: Touch };
})();
