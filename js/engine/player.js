/* Blocka — player: physics, input, health/hunger. (window.BPlayer) */
(function () {
  'use strict';

  var BB = window.BBlocks;
  var W = 0.3, HGT = 1.8, EYE = 1.62;

  function Player(world, scene) {
    this.world = world;
    this.pos = new THREE.Vector3(8.5, 60, 8.5); // feet
    this.vel = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0;
    this.onGround = false;
    this.flying = false;
    this.inWater = false;
    this.headInWater = false;
    this.hp = 20;       // 0..20 (half hearts)
    this.food = 20;     // 0..20
    this.air = 10;      // bubbles 0..10
    this.fallPeak = null;
    this.dead = false;

    this.keys = {};
    this.touchMove = { x: 0, y: 0 };   // joystick -1..1
    this.touchJump = false;
    this.sprinting = false;
    this.sneaking = false;

    this._lastSpaceTap = 0;
    this._lastWTap = 0;
    this._stepAcc = 0;
    this._regenT = 0;
    this._starveT = 0;
    this._drownT = 0;
    this._hungerT = 0;
    this._bobT = 0;
    this._wasInWater = false;

    this.onDamage = null;   // cb(amount, cause)
    this.onStep = null;
    this.onSplash = null;
    this.onEat = null;
  }

  Player.prototype.bindKeys = function () {
    var self = this;
    document.addEventListener('keydown', function (e) {
      if (e.repeat) return;
      self.keys[e.code] = true;
      if (e.code === 'Space') {
        var now = performance.now();
        if (now - self._lastSpaceTap < 280) self.flying = !self.flying;
        self._lastSpaceTap = now;
      }
      if (e.code === 'KeyW') {
        var t = performance.now();
        if (t - self._lastWTap < 260) self.sprinting = true;
        self._lastWTap = t;
      }
    });
    document.addEventListener('keyup', function (e) {
      self.keys[e.code] = false;
      if (e.code === 'KeyW') self.sprinting = false;
    });
  };

  Player.prototype.look = function (dx, dy, sens, invertY) {
    var s = 0.0022 * sens;
    this.yaw -= dx * s;
    this.pitch += (invertY ? 1 : -1) * dy * s;
    var lim = Math.PI / 2 - 0.001;
    if (this.pitch > lim) this.pitch = lim;
    if (this.pitch < -lim) this.pitch = -lim;
  };

  Player.prototype.eyePos = function () {
    return new THREE.Vector3(this.pos.x, this.pos.y + EYE, this.pos.z);
  };

  Player.prototype.forwardDir = function () {
    var cp = Math.cos(this.pitch);
    return new THREE.Vector3(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp).normalize();
  };

  function solidAt(world, x, y, z) {
    return BB.isSolid(world.getBlock(Math.floor(x), Math.floor(y), Math.floor(z)));
  }

  // collide one axis (bounds recomputed per cell so clamping chains correctly)
  Player.prototype._collideAxis = function (axis) {
    var p = this.pos;
    for (var pass = 0; pass < 4; pass++) {
      var minX = p.x - W, maxX = p.x + W;
      var minY = p.y, maxY = p.y + HGT;
      var minZ = p.z - W, maxZ = p.z + W;
      var x0 = Math.floor(minX), x1 = Math.floor(maxX);
      var y0 = Math.floor(minY), y1 = Math.floor(maxY);
      var z0 = Math.floor(minZ), z1 = Math.floor(maxZ);
      var hitAny = false;
      for (var x = x0; x <= x1; x++) {
        for (var y = y0; y <= y1; y++) {
          for (var z = z0; z <= z1; z++) {
            if (!BB.isSolid(this.world.getBlock(x, y, z))) continue;
            hitAny = true;
            // overlapping cell: push back along the moved axis
            if (axis === 0) {
              if (this.vel.x > 0) p.x = Math.min(p.x, x - W - 0.001);
              else if (this.vel.x < 0) p.x = Math.max(p.x, x + 1 + W + 0.001);
              this.vel.x = 0;
            } else if (axis === 2) {
              if (this.vel.z > 0) p.z = Math.min(p.z, z - W - 0.001);
              else if (this.vel.z < 0) p.z = Math.max(p.z, z + 1 + W + 0.001);
              this.vel.z = 0;
            } else {
              if (this.vel.y > 0) { p.y = Math.min(p.y, y - HGT - 0.001); }
              else if (this.vel.y < 0) {
                p.y = Math.max(p.y, y + 1);
                this.onGround = true;
              }
              this.vel.y = 0;
            }
          }
        }
      }
      if (!hitAny) break;
    }
  };

  Player.prototype.update = function (dt) {
    if (this.dead) return;
    var k = this.keys;

    // ---- water state ----
    var feet = this.world.getBlock(Math.floor(this.pos.x), Math.floor(this.pos.y + 0.2), Math.floor(this.pos.z));
    var waist = this.world.getBlock(Math.floor(this.pos.x), Math.floor(this.pos.y + 0.9), Math.floor(this.pos.z));
    var head = this.world.getBlock(Math.floor(this.pos.x), Math.floor(this.pos.y + EYE), Math.floor(this.pos.z));
    var wasWater = this.inWater;
    this.inWater = BB.isLiquid(feet) || BB.isLiquid(waist);
    this.headInWater = BB.isLiquid(head);
    if (this.inWater && !wasWater && this.vel.y < -6 && this.onSplash) this.onSplash();

    // ---- input direction ----
    var ix = 0, iz = 0;
    if (k.KeyW) iz += 1;
    if (k.KeyS) iz -= 1;
    if (k.KeyA) ix -= 1;
    if (k.KeyD) ix += 1;
    ix += this.touchMove.x; iz += this.touchMove.y;
    var il = Math.hypot(ix, iz);
    if (il > 1) { ix /= il; iz /= il; }

    this.sneaking = !!k.ShiftLeft || !!k.ShiftRight;
    if (k.ControlLeft && iz > 0) this.sprinting = true;
    if (iz <= 0 && !k.KeyW) this.sprinting = false;

    var speed = this.flying ? 10.5 :
      this.inWater ? 2.4 :
      this.sneaking ? 1.4 :
      this.sprinting ? 5.9 : 4.4;

    // rotate input by yaw
    var sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    var wx = (ix * cos - iz * sin) * speed;
    var wz = (-iz * cos - ix * sin) * speed;

    var accel = this.onGround || this.flying ? 12 : (this.inWater ? 6 : 2.6);
    var t = 1 - Math.exp(-accel * dt);
    this.vel.x += (wx - this.vel.x) * t;
    this.vel.z += (wz - this.vel.z) * t;

    // ---- vertical ----
    var jump = k.Space || this.touchJump;
    if (this.flying) {
      var vy = 0;
      if (jump) vy += 9;
      if (this.sneaking) vy -= 9;
      this.vel.y += (vy - this.vel.y) * (1 - Math.exp(-10 * dt));
      this.fallPeak = null;
    } else if (this.inWater) {
      if (jump) this.vel.y += 34 * dt;
      this.vel.y -= 6.5 * dt;
      this.vel.y *= Math.exp(-1.9 * dt);
      if (this.vel.y > 3.4) this.vel.y = 3.4;
      if (this.vel.y < -3.4) this.vel.y = -3.4;
      this.fallPeak = null;
    } else {
      this.vel.y -= 30 * dt;
      if (this.vel.y < -55) this.vel.y = -55;
      if (jump && this.onGround) {
        this.vel.y = 8.9;
        this.onGround = false;
      }
      if (this.vel.y < -0.5) {
        if (this.fallPeak === null) this.fallPeak = this.pos.y;
      } else if (this.vel.y > 0 && this.fallPeak === null) {
        this.fallPeak = this.pos.y;
      }
    }

    // hop out of water onto ledges
    if (this.inWater && jump && (ix !== 0 || iz !== 0)) {
      var aheadX = Math.floor(this.pos.x + (wx !== 0 ? Math.sign(wx) * 0.7 : 0));
      var aheadZ = Math.floor(this.pos.z + (wz !== 0 ? Math.sign(wz) * 0.7 : 0));
      var fy = Math.floor(this.pos.y);
      if (BB.isSolid(this.world.getBlock(aheadX, fy, aheadZ)) &&
          !BB.isSolid(this.world.getBlock(aheadX, fy + 1, aheadZ))) {
        this.vel.y = Math.max(this.vel.y, 5.2);
      }
    }

    // ---- integrate with collision ----
    this.onGround = false;
    this.pos.x += this.vel.x * dt; this._collideAxis(0);
    this.pos.z += this.vel.z * dt; this._collideAxis(2);
    this.pos.y += this.vel.y * dt; this._collideAxis(1);

    if (this.pos.y < -10) { // fell out of world
      this.pos.y = window.BWorld.HEIGHT + 4;
      this.vel.set(0, 0, 0);
    }

    // ---- landing / fall damage ----
    if (this.onGround) {
      if (this.fallPeak !== null) {
        var fall = this.fallPeak - this.pos.y;
        if (fall > 3.2) this.damage(Math.floor(fall - 3), 'fall');
        else if (fall > 1.5 && this.onLandStep) { /* thud via steps */ }
        this.fallPeak = null;
      }
    }

    // ---- footsteps ----
    if (this.onGround && (Math.abs(this.vel.x) > 0.5 || Math.abs(this.vel.z) > 0.5)) {
      this._stepAcc += Math.hypot(this.vel.x, this.vel.z) * dt;
      var stride = this.sprinting ? 2.6 : 2.1;
      if (this._stepAcc > stride) {
        this._stepAcc = 0;
        if (this.onStep) this.onStep();
      }
      this._bobT += dt * (this.sprinting ? 11 : 8);
    }
    if (this.inWater && jump && Math.random() < dt * 2 && this.onSwim) this.onSwim();

    // ---- hunger / health / air ----
    this._hungerT += dt * (this.sprinting ? 1.6 : 1);
    if (this._hungerT > 42 && this.food > 0) { this._hungerT = 0; this.food = Math.max(0, this.food - 1); }

    if (this.food >= 18 && this.hp < 20) {
      this._regenT += dt;
      if (this._regenT > 3.2) {
        this._regenT = 0;
        this.hp = Math.min(20, this.hp + 1);
        if (Math.random() < 0.5) this.food = Math.max(0, this.food - 1);
      }
    } else this._regenT = 0;

    if (this.food <= 0) {
      this._starveT += dt;
      if (this._starveT > 4) { this._starveT = 0; if (this.hp > 2) this.damage(1, 'starve'); }
    }

    if (this.headInWater) {
      this._airT = (this._airT || 0) + dt;
      if (this._airT > 1.1) { this._airT = 0; this.air = Math.max(0, this.air - 1); }
      if (this.air <= 0) {
        this._drownT += dt;
        if (this._drownT > 0.9) { this._drownT = 0; this.damage(1, 'drown'); }
      }
    } else {
      this.air = 10;
      this._airT = 0;
      this._drownT = 0;
    }
  };

  Player.prototype.damage = function (n, cause) {
    if (this.dead || n <= 0) return;
    this.hp = Math.max(0, this.hp - n);
    if (this.onDamage) this.onDamage(n, cause);
    if (this.hp <= 0) this.dead = true;
  };

  Player.prototype.eat = function (itemId) {
    var it = BB.ITEMS[itemId];
    if (!it) return false;
    if (this.food >= 20 && this.hp >= 20) return false;
    this.food = Math.min(20, this.food + it.food);
    this.hp = Math.min(20, this.hp + it.heal);
    if (this.onEat) this.onEat();
    return true;
  };

  Player.prototype.respawn = function (spawn) {
    this.pos.set(spawn.x, spawn.y, spawn.z);
    this.vel.set(0, 0, 0);
    this.hp = 20; this.food = 20; this.air = 10;
    this.fallPeak = null;
    this.flying = false;
    this.dead = false;
  };

  Player.prototype.eyePosBobbed = function () {
    var e = this.eyePos();
    if (this.onGround && !this.flying && !this.sneaking) {
      e.y += Math.sin(this._bobT) * 0.045;
    }
    return e;
  };

  window.BPlayer = { Player: Player };
})();
