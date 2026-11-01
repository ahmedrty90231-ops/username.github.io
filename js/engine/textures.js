/* Blocka — texture atlas builder.
   Samples the extracted Blocka tiles (assets/ui/tile_*.png) and procedurally
   paints the rest (leaves, sand, glass, snow, bedrock, items, sky).
   Exposes window.BTextures. */
(function () {
  'use strict';

  var PIX = 16;
  var TEX = window.BBlocks.TEX;
  var COLS = window.BBlocks.ATLAS_COLS, ROWS = window.BBlocks.ATLAS_ROWS;

  function loadImage(src) {
    return new Promise(function (resolve, reject) {
      var im = new Image();
      im.onload = function () { resolve(im); };
      im.onerror = function () { reject(new Error('img fail: ' + src)); };
      im.src = src;
    });
  }

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }

  function tileCtx(atlas, i) {
    var x = (i % COLS) * PIX, y = ((i / COLS) | 0) * PIX;
    return { x: x, y: y };
  }

  function drawCrop(atlasCtx, img, sx, sy, sw, sh, tile) {
    var p = tileCtx(null, tile);
    atlasCtx.imageSmoothingEnabled = true;
    atlasCtx.drawImage(img, sx, sy, sw, sh, p.x, p.y, PIX, PIX);
  }

  function fillTile(atlasCtx, tile, painter) {
    var p = tileCtx(null, tile);
    var cv = document.createElement('canvas');
    cv.width = cv.height = PIX;
    var c = cv.getContext('2d');
    painter(c, PIX);
    atlasCtx.drawImage(cv, p.x, p.y);
  }

  // ---------- procedural painters ----------
  function noisePaint(base, colors) {
    return function (c, S) {
      c.fillStyle = base;
      c.fillRect(0, 0, S, S);
      for (var i = 0; i < S * S; i++) {
        if (Math.random() < 0.55) {
          c.fillStyle = pick(colors);
          c.fillRect((Math.random() * S) | 0, (Math.random() * S) | 0, 1, 1);
        }
      }
    };
  }

  var paintLeaves = noisePaint('#3d7526', ['#2c5a16', '#4a8a30', '#61a33e', '#265012', '#33691f']);
  var paintSand = noisePaint('#ded29b', ['#cfc488', '#eae2b4', '#c6ba7e', '#d8cf9e']);
  var paintBedrock = noisePaint('#4a4d52', ['#2b2d30', '#62666b', '#767a80', '#1d1f22']);
  var paintSnowTop = noisePaint('#f4f8fa', ['#e2ecf1', '#ffffff', '#d5e2ea']);

  function paintGlass(c, S) {
    c.clearRect(0, 0, S, S);
    // border
    c.fillStyle = '#e8f2f5';
    for (var i = 0; i < S; i++) {
      c.fillRect(i, 0, 1, 1); c.fillRect(i, S - 1, 1, 1);
      c.fillRect(0, i, 1, 1); c.fillRect(S - 1, i, 1, 1);
    }
    // light streaks
    c.fillStyle = 'rgba(255,255,255,0.85)';
    var pts = [[3, 12], [4, 11], [5, 10], [6, 9], [10, 5], [11, 4], [12, 3]];
    pts.forEach(function (p) { c.fillRect(p[0], p[1], 2, 1); });
    c.fillStyle = 'rgba(190,220,230,0.35)';
    for (i = 0; i < 26; i++) c.fillRect((rnd(1, S - 2)) | 0, (rnd(1, S - 2)) | 0, 1, 1);
  }

  function paintSnowSide(c, S) {
    // dirt-ish bottom + white top
    noisePaint('#6d4a2c', ['#54371e', '#7d5a38', '#8a6a44'])(c, S);
    c.fillStyle = '#f4f8fa';
    c.fillRect(0, 0, S, 6);
    c.fillStyle = '#e2ecf1';
    for (var x = 0; x < S; x++) { if (Math.random() < 0.4) c.fillRect(x, 6, 1, 1); }
  }

  function paintApple(c, S) {
    c.clearRect(0, 0, S, S);
    var px = function (x, y, col) { c.fillStyle = col; c.fillRect(x, y, 1, 1); };
    // stem + leaf
    px(8, 1, '#5a3a1c'); px(8, 2, '#5a3a1c');
    px(9, 1, '#4e8b2c'); px(10, 2, '#4e8b2c'); px(11, 2, '#3d7223');
    // body
    var body = [
      '  ####  ####  ',
      ' ############ ',
      '##############',
      '##############',
      '##############',
      '##############',
      '##############',
      ' ##########',
      ' ##########',
      '  ########  ',
      '   ######   '
    ];
    for (var y = 0; y < body.length; y++) {
      for (var x = 0; x < body[y].length; x++) {
        if (body[y][x] === '#') {
          var shade = '#c01620';
          if (x < 5) shade = '#a10f1c';
          else if (x > body[y].length - 6) shade = '#e02e2e';
          px(x + 1, y + 3, shade);
        }
      }
    }
    px(4, 5, '#ff8f8f'); px(5, 4, '#ffb3b3'); px(4, 6, '#ff7676');
  }

  function paintCarrot(c, S) {
    c.clearRect(0, 0, S, S);
    var px = function (x, y, col, w) { c.fillStyle = col; c.fillRect(x, y, w || 1, 1); };
    // greens
    px(7, 0, '#3d7223', 2); px(6, 1, '#4e8b2c', 4); px(5, 2, '#3d7223', 2); px(9, 2, '#4e8b2c', 2); px(7, 3, '#4e8b2c', 3);
    // root
    var rows = [10, 10, 9, 9, 8, 8, 7, 6, 6, 5, 4, 3, 2, 1];
    for (var r = 0; r < rows.length; r++) {
      var w = rows[r] / 2 | 0;
      var cx = 8 - w;
      var col = r % 3 === 0 ? '#c96a17' : '#e8892a';
      if (r < 2) col = '#e8892a';
      px(cx, 4 + r, col, Math.max(1, w * 2));
      if (r % 4 === 2) px(cx, 4 + r, '#a95512', 1);
    }
  }

  // ---------- sky sprites ----------
  function makeSunTexture() {
    var cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    var c = cv.getContext('2d');
    var g = c.createRadialGradient(32, 32, 4, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,252,230,1)');
    g.addColorStop(0.35, 'rgba(255,236,150,0.95)');
    g.addColorStop(0.7, 'rgba(255,214,90,0.35)');
    g.addColorStop(1, 'rgba(255,200,60,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 64, 64);
    var t = new THREE.CanvasTexture(cv);
    return t;
  }

  function makeMoonTexture() {
    var cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    var c = cv.getContext('2d');
    var g = c.createRadialGradient(32, 32, 6, 32, 32, 30);
    g.addColorStop(0, 'rgba(235,240,250,1)');
    g.addColorStop(0.75, 'rgba(210,220,240,0.9)');
    g.addColorStop(1, 'rgba(190,205,235,0)');
    c.fillStyle = g;
    c.beginPath(); c.arc(32, 32, 30, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(160,175,205,0.5)';
    [[22, 26, 5], [38, 20, 4], [42, 38, 6], [26, 42, 3]].forEach(function (m) {
      c.beginPath(); c.arc(m[0], m[1], m[2], 0, Math.PI * 2); c.fill();
    });
    return new THREE.CanvasTexture(cv);
  }

  function makeCloudTexture() {
    var S = 256; // power of two for repeat wrapping
    var cv = document.createElement('canvas');
    cv.width = cv.height = S;
    var c = cv.getContext('2d');
    c.clearRect(0, 0, S, S);
    for (var i = 0; i < 34; i++) {
      var x = rnd(14, S - 26), y = rnd(14, S - 40), w = rnd(16, 56), h = rnd(10, 22);
      c.fillStyle = 'rgba(255,255,255,' + rnd(0.4, 0.8).toFixed(2) + ')';
      c.fillRect(x, y, w, h);
    }
    var t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearMipMapLinearFilter;
    return t;
  }

  // ---------- crack overlay textures ----------
  function makeCrackTextures() {
    var stages = [];
    for (var s = 0; s < 6; s++) {
      var cv = document.createElement('canvas');
      cv.width = cv.height = PIX;
      var c = cv.getContext('2d');
      c.clearRect(0, 0, PIX, PIX);
      c.fillStyle = 'rgba(10,10,10,0.8)';
      var lines = 2 + s * 2;
      for (var li = 0; li < lines; li++) {
        var x = 8 + rnd(-3, 3), y = 8 + rnd(-3, 3);
        var ang = rnd(0, Math.PI * 2);
        var len = rnd(3, 4 + s * 1.6);
        for (var st = 0; st < len; st++) {
          c.fillRect(Math.round(x) & 15, Math.round(y) & 15, 1, 1);
          ang += rnd(-0.7, 0.7);
          x += Math.cos(ang); y += Math.sin(ang);
        }
      }
      var t = new THREE.CanvasTexture(cv);
      t.magFilter = THREE.NearestFilter;
      t.minFilter = THREE.NearestFilter;
      stages.push(t);
    }
    return stages;
  }

  // ---------- atlas build ----------
  var atlasCanvas = null, atlasTex = null;
  var iconCache = {};

  function build(imgs) {
    atlasCanvas = document.createElement('canvas');
    atlasCanvas.width = COLS * PIX;
    atlasCanvas.height = ROWS * PIX;
    var c = atlasCanvas.getContext('2d');
    c.clearRect(0, 0, atlasCanvas.width, atlasCanvas.height);

    var G = imgs.grass, L = imgs.log, P = imgs.planks, S = imgs.stone, D = imgs.diamond, W = imgs.water;

    // sampled from the Blocka tiles (16px downscale of real art)
    drawCrop(c, G, 50, 16, 86, 86, TEX.GRASS_TOP);
    drawCrop(c, G, 50, 152, 86, 86, TEX.DIRT);
    // grass side: dirt + ragged green top
    (function () {
      var p = tileCtx(null, TEX.GRASS_SIDE);
      c.drawImage(G, 50, 152, 86, 86, p.x, p.y, PIX, PIX);
      c.drawImage(G, 50, 14, 86, 30, p.x, p.y, PIX, 4);
      c.fillStyle = '#5f9e35';
      for (var x = 0; x < PIX; x++) if (Math.random() < 0.55) c.fillRect(p.x + x, p.y + 4, 1, 1);
    })();
    drawCrop(c, S, 46, 60, 92, 92, TEX.STONE);
    drawCrop(c, P, 45, 60, 92, 92, TEX.PLANKS);
    drawCrop(c, L, 42, 152, 92, 92, TEX.LOG_SIDE);
    drawCrop(c, L, 42, 12, 92, 92, TEX.LOG_TOP);
    drawCrop(c, D, 42, 60, 96, 96, TEX.DIAMOND);
    drawCrop(c, W, 34, 96, 110, 110, TEX.WATER);

    // procedural
    fillTile(c, TEX.LEAVES, paintLeaves);
    fillTile(c, TEX.SAND, paintSand);
    fillTile(c, TEX.GLASS, paintGlass);
    fillTile(c, TEX.SNOW_SIDE, paintSnowSide);
    fillTile(c, TEX.SNOW_TOP, paintSnowTop);
    fillTile(c, TEX.BEDROCK, paintBedrock);
    fillTile(c, TEX.APPLE, paintApple);
    fillTile(c, TEX.CARROT, paintCarrot);

    atlasTex = new THREE.CanvasTexture(atlasCanvas);
    atlasTex.magFilter = THREE.NearestFilter;
    atlasTex.minFilter = THREE.NearestFilter;
    atlasTex.generateMipmaps = false;
  }

  function tileUV(i) {
    var col = i % COLS, row = (i / COLS) | 0;
    var w = COLS * PIX, h = ROWS * PIX;
    var u0 = (col * PIX + 0.05) / w, u1 = ((col + 1) * PIX - 0.05) / w;
    var v1 = 1 - (row * PIX + 0.05) / h, v0 = 1 - ((row + 1) * PIX - 0.05) / h;
    return [u0, v0, u1, v1];
  }

  function regionToCanvas(tile, scale) {
    scale = scale || 3;
    var p = tileCtx(null, tile);
    var cv = document.createElement('canvas');
    cv.width = cv.height = PIX * scale;
    var c = cv.getContext('2d');
    c.imageSmoothingEnabled = false;
    c.drawImage(atlasCanvas, p.x, p.y, PIX, PIX, 0, 0, PIX * scale, PIX * scale);
    return cv;
  }

  function slotIcon(id, size) {
    size = size || 48;
    var key = id + '_' + size;
    if (iconCache[key]) return iconCache[key];
    var BB = window.BBlocks;
    var tile;
    if (BB.isItem(id)) tile = BB.ITEMS[id].tex;
    else {
      var d = BB.BLOCKS[id];
      tile = d ? d.tex.side : 0;
    }
    var cv = regionToCanvas(tile, 4);
    var out = document.createElement('canvas');
    out.width = out.height = size;
    var c = out.getContext('2d');
    c.imageSmoothingEnabled = false;
    c.drawImage(cv, 0, 0, size, size);
    var url = out.toDataURL();
    iconCache[key] = url;
    return url;
  }

  function particleCanvas(id) {
    var BB = window.BBlocks;
    var d = BB.BLOCKS[id];
    var tile = d ? (id === BB.GRASS ? d.tex.top : d.tex.side) : 0;
    return regionToCanvas(tile, 2);
  }

  var ready = Promise.all([
    loadImage('assets/ui/tile_grass.png'),
    loadImage('assets/ui/tile_log.png'),
    loadImage('assets/ui/tile_planks.png'),
    loadImage('assets/ui/tile_stone.png'),
    loadImage('assets/ui/tile_diamond.png'),
    loadImage('assets/ui/tile_water.png')
  ]).then(function (list) {
    build({ grass: list[0], log: list[1], planks: list[2], stone: list[3], diamond: list[4], water: list[5] });
  });

  window.BTextures = {
    PIX: PIX,
    ready: ready,
    tileUV: tileUV,
    slotIcon: slotIcon,
    particleCanvas: particleCanvas,
    makeSunTexture: makeSunTexture,
    makeMoonTexture: makeMoonTexture,
    makeCloudTexture: makeCloudTexture,
    makeCrackTextures: makeCrackTextures,
    get atlas() { return atlasTex; },
    get atlasCanvas() { return atlasCanvas; }
  };
})();
