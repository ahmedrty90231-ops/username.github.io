/* Blocka — voxel world: chunks, terrain gen, meshing (face culling + AO),
   block editing, streaming, raycast. (classic script, window.BWorld) */
(function () {
  'use strict';

  var BB = window.BBlocks;
  var CHUNK = 16;
  var HEIGHT = 80;
  var SEA = 26;

  // face definitions (three.js voxel geometry tutorial style)
  var FACES = [
    { dir: [-1, 0, 0], shade: 0.62, uv: ['z', 'y'], corners: [[0, 1, 0], [0, 0, 0], [0, 1, 1], [0, 0, 1]] },
    { dir: [1, 0, 0],  shade: 0.62, uv: ['z', 'y'], corners: [[1, 1, 1], [1, 0, 1], [1, 1, 0], [1, 0, 0]] },
    { dir: [0, -1, 0], shade: 0.5,  uv: ['x', 'z'], corners: [[1, 0, 1], [0, 0, 1], [1, 0, 0], [0, 0, 0]] },
    { dir: [0, 1, 0],  shade: 1.0,  uv: ['x', 'z'], corners: [[0, 1, 1], [1, 1, 1], [0, 1, 0], [1, 1, 0]] },
    { dir: [0, 0, -1], shade: 0.8,  uv: ['x', 'y'], corners: [[1, 0, 0], [0, 0, 0], [1, 1, 0], [0, 1, 0]] },
    { dir: [0, 0, 1],  shade: 0.8,  uv: ['x', 'y'], corners: [[0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]] }
  ];
  var AXIS = { x: 0, y: 1, z: 2 };
  var AO_LIGHT = [0.5, 0.68, 0.84, 1.0];

  function idx(x, y, z) { return (y * CHUNK + z) * CHUNK + x; }
  function key(cx, cz) { return cx + ',' + cz; }

  function World(seed, materials) {
    this.seed = seed >>> 0;
    this.noise = window.BNoise.makeNoise(this.seed);
    this.chunks = new Map();
    this.edits = new Map(); // "x,y,z" -> id (player edits, for saving)
    this.materials = materials; // {opaque, water}
    this.dirty = new Set();
    this.meshedChunks = new Set();
  }

  // ---------------- terrain ----------------

  // tuned against measured noise distribution: ~60% land, mixed biomes,
  // occasional mountains up to y~60
  World.prototype.heightAt = function (wx, wz) {
    var n = this.noise;
    var cont = n.fbm2(wx * 0.0042, wz * 0.0042, 4);
    var hills = n.fbm2(wx * 0.016 + 50, wz * 0.016 + 50, 4);
    var m = n.fbm2(wx * 0.006 - 231, wz * 0.006 + 145, 3);
    var mount = m > 0.28 ? (m - 0.28) * (m - 0.28) * 140 : 0;
    var h = 27.5 + cont * 14 + hills * 9 + mount;
    h = h | 0;
    if (h < 4) h = 4;
    if (h > HEIGHT - 15) h = HEIGHT - 15;
    return h;
  };

  World.prototype.biomeAt = function (wx, wz) {
    var n = this.noise;
    var temp = n.noise2(wx * 0.0075 + 173, wz * 0.0075 - 91);
    var moist = n.noise2(wx * 0.008 - 400, wz * 0.008 + 260);
    if (temp > 0.32) return 'desert';
    if (temp < -0.36) return 'snow';
    if (moist > 0.06) return 'forest';
    return 'plains';
  };

  World.prototype.treeAt = function (wx, wz, biome, h) {
    if (h <= SEA + 1) return false;
    var chance = biome === 'forest' ? 0.035 : biome === 'plains' ? 0.007 : biome === 'snow' ? 0.006 : 0;
    return this.noise.hash2(wx * 7 + 13, wz * 7 - 29) < chance;
  };

  World.prototype.genChunkData = function (cx, cz) {
    var data = new Uint8Array(CHUNK * HEIGHT * CHUNK);
    var n = this.noise;
    var treeSpots = [];

    for (var x = 0; x < CHUNK; x++) {
      for (var z = 0; z < CHUNK; z++) {
        var wx = cx * CHUNK + x, wz = cz * CHUNK + z;
        var h = this.heightAt(wx, wz);
        var biome = this.biomeAt(wx, wz);
        var shore = h <= SEA + 1 && h >= SEA - 3;

        for (var y = 0; y <= h; y++) {
          var id;
          if (y === 0) id = BB.BEDROCK;
          else if (y === 1 && n.hash3(wx, y * 13, wz) > 0.55) id = BB.BEDROCK;
          else if (y === 2 && n.hash3(wx, y * 29, wz) > 0.75) id = BB.BEDROCK;
          else if (y < h - 3) {
            id = BB.STONE;
            if (y <= 14 && n.hash3(wx, y * 3 + 11, wz) > 0.993) id = BB.DIAMOND;
          } else if (y < h) {
            id = (biome === 'desert' || shore || h < SEA) ? BB.SAND : BB.DIRT;
          } else { // y === h (surface)
            if (biome === 'desert' || shore || h < SEA) id = BB.SAND;
            else if (biome === 'snow') id = BB.SNOW;
            else id = BB.GRASS;
          }
          data[idx(x, y, z)] = id;
        }

        // water in lakes / seas
        if (h < SEA) {
          for (var wy = h + 1; wy <= SEA; wy++) data[idx(x, wy, z)] = BB.WATER;
        }

        // caves (don't breach seabed)
        var caveTop = Math.min(h - 1, 44);
        if (h - 1 >= SEA - 4) caveTop = Math.min(h - 1, 44);
        else caveTop = Math.min(h - 5, 44);
        for (var cy = 3; cy < caveTop; cy++) {
          var cv = n.fbm3(wx / 22, cy / 18, wz / 22, 3);
          if (cv > 0.58) {
            var cur = data[idx(x, cy, z)];
            if (cur !== BB.BEDROCK) data[idx(x, cy, z)] = 0;
          }
        }

        if (this.treeAt(wx, wz, biome, h) && x >= 2 && x <= 13 && z >= 2 && z <= 13) {
          treeSpots.push([x, h + 1, z]);
        }
      }
    }

    // trees (trunk + leafy crown)
    for (var t = 0; t < treeSpots.length; t++) {
      var tx = treeSpots[t][0], ty = treeSpots[t][1], tz = treeSpots[t][2];
      var trunkH = 4 + ((n.hash2(tx * 31, tz * 17) * 3) | 0);
      for (var ly = ty + trunkH - 3; ly <= ty + trunkH - 1; ly++) {
        var r = ly === ty + trunkH - 1 ? 1 : 2;
        for (var lx = -r; lx <= r; lx++) {
          for (var lz = -r; lz <= r; lz++) {
            if (lx === 0 && lz === 0 && ly < ty + trunkH) continue;
            if (Math.abs(lx) === r && Math.abs(lz) === r && n.hash3(tx + lx, ly, tz + lz) > 0.6) continue;
            var px = tx + lx, pz = tz + lz;
            if (px >= 0 && px < CHUNK && pz >= 0 && pz < CHUNK && ly < HEIGHT) {
              if (data[idx(px, ly, pz)] === 0) data[idx(px, ly, pz)] = BB.LEAVES;
            }
          }
        }
      }
      for (var hy = 0; hy < trunkH; hy++) {
        if (ty + hy < HEIGHT) data[idx(tx, ty + hy, tz)] = BB.LOG;
      }
    }

    // saved edits get applied by applyEdits() right after generation
    return data;
  };

  World.prototype.applyEdits = function (chunk) {
    var x0 = chunk.cx * CHUNK, z0 = chunk.cz * CHUNK;
    var self = this;
    this.edits.forEach(function (id, k) {
      var p = k.split(',');
      var x = +p[0], y = +p[1], z = +p[2];
      if (x >= x0 && x < x0 + CHUNK && z >= z0 && z < z0 + CHUNK && y >= 0 && y < HEIGHT) {
        chunk.data[idx(x - x0, y, z - z0)] = id;
      }
    });
  };

  // ---------------- chunk bookkeeping ----------------

  World.prototype.ensureChunk = function (cx, cz) {
    var k = key(cx, cz);
    var chunk = this.chunks.get(k);
    if (!chunk) {
      chunk = { cx: cx, cz: cz, data: this.genChunkData(cx, cz), meshes: null };
      this.applyEdits(chunk);
      this.chunks.set(k, chunk);
      // neighbours need remesh (their border faces against us)
      this.markDirty(cx - 1, cz); this.markDirty(cx + 1, cz);
      this.markDirty(cx, cz - 1); this.markDirty(cx, cz + 1);
    }
    return chunk;
  };

  World.prototype.getBlock = function (x, y, z) {
    if (y < 0 || y >= HEIGHT) return 0;
    var cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK);
    var chunk = this.chunks.get(key(cx, cz));
    if (!chunk) return 0;
    return chunk.data[idx(x - cx * CHUNK, y, z - cz * CHUNK)];
  };

  World.prototype.setBlock = function (x, y, z, id, recordEdit) {
    if (y < 0 || y >= HEIGHT) return false;
    var cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK);
    var k = key(cx, cz);
    var chunk = this.chunks.get(k);
    if (!chunk) return false;
    var lx = x - cx * CHUNK, lz = z - cz * CHUNK;
    if (chunk.data[idx(lx, y, lz)] === id) return true;
    chunk.data[idx(lx, y, lz)] = id;
    if (recordEdit !== false) this.edits.set(x + ',' + y + ',' + z, id);
    this.markDirty(cx, cz);
    if (lx === 0) this.markDirty(cx - 1, cz);
    if (lx === CHUNK - 1) this.markDirty(cx + 1, cz);
    if (lz === 0) this.markDirty(cx, cz - 1);
    if (lz === CHUNK - 1) this.markDirty(cx, cz + 1);
    return true;
  };

  World.prototype.markDirty = function (cx, cz) {
    if (this.meshedChunks.has(key(cx, cz))) this.dirty.add(key(cx, cz));
  };

  // ---------------- meshing ----------------

  World.prototype.buildMesh = function (chunk, scene) {
    var data = chunk.data;
    var pos = [], norm = [], uv = [], col = [], inds = [];
    var wpos = [], wnorm = [], wuv = [], wcol = [], winds = [];
    var self = this;

    function liq(x, y, z) { return BB.isLiquid(self.getBlock(x, y, z)); }

    var x0 = chunk.cx * CHUNK, z0 = chunk.cz * CHUNK;

    for (var y = 0; y < HEIGHT; y++) {
      for (var z = 0; z < CHUNK; z++) {
        for (var x = 0; x < CHUNK; x++) {
          var id = data[idx(x, y, z)];
          if (id === 0) continue;
          var d = BB.BLOCKS[id];
          if (!d) continue;
          var wx = x0 + x, wz = z0 + z;

          for (var f = 0; f < 6; f++) {
            var face = FACES[f];
            var nx = wx + face.dir[0], ny = y + face.dir[1], nz = wz + face.dir[2];
            var nb = self.getBlock(nx, ny, nz);
            // culling
            if (BB.isOpaque(nb)) continue;
            if (d.liquid && BB.isLiquid(nb)) continue;
            if (!d.liquid && !d.opaque && nb === id) continue; // glass/leaves self-cull
            if (!d.liquid && d.opaque && BB.isLiquid(nb)) { /* draw face against water */ }

            var isWaterFace = d.liquid;
            var tex = face.dir[1] === 1 ? d.tex.top : face.dir[1] === -1 ? d.tex.bottom : d.tex.side;
            var uvRect = window.BTextures.tileUV(tex);

            var dstPos = isWaterFace ? wpos : pos;
            var dstNorm = isWaterFace ? wnorm : norm;
            var dstUv = isWaterFace ? wuv : uv;
            var dstCol = isWaterFace ? wcol : col;
            var dstInd = isWaterFace ? winds : inds;

            var ndx = dstPos.length / 3;
            var aboveNotWater = !liq(wx, y + 1, wz);
            for (var ci = 0; ci < 4; ci++) {
              var corner = face.corners[ci];
              var cyOff = corner[1];
              if (isWaterFace && cyOff === 1 && aboveNotWater) cyOff = 0.875;
              dstPos.push(x + corner[0], y + cyOff, z + corner[2]);
              dstNorm.push(face.dir[0], face.dir[1], face.dir[2]);

              var uc = corner[AXIS[face.uv[0]]], vc = corner[AXIS[face.uv[1]]];
              dstUv.push(uvRect[0] + (uvRect[2] - uvRect[0]) * uc,
                         uvRect[1] + (uvRect[3] - uvRect[1]) * vc);

              // ambient occlusion
              var light = face.shade;
              if (!isWaterFace) {
                var ax1Ind = face.uv[0], ax2Ind = face.uv[1];
                var cA = { x: corner[0], y: corner[1], z: corner[2] };
                var o1 = cA[ax1Ind] ? 1 : -1, o2 = cA[ax2Ind] ? 1 : -1;
                var bp = [wx + face.dir[0], y + face.dir[1], wz + face.dir[2]];
                var s1p = bp.slice(); s1p[AXIS[ax1Ind]] += o1;
                var s2p = bp.slice(); s2p[AXIS[ax2Ind]] += o2;
                var cp = bp.slice(); cp[AXIS[ax1Ind]] += o1; cp[AXIS[ax2Ind]] += o2;
                var so1 = BB.isOpaque(self.getBlock(s1p[0], s1p[1], s1p[2])) ? 1 : 0;
                var so2 = BB.isOpaque(self.getBlock(s2p[0], s2p[1], s2p[2])) ? 1 : 0;
                var soc = BB.isOpaque(self.getBlock(cp[0], cp[1], cp[2])) ? 1 : 0;
                var ao = (so1 && so2) ? 0 : 3 - (so1 + so2 + soc);
                light *= AO_LIGHT[ao];
              }
              dstCol.push(light, light, light);
            }
            dstInd.push(ndx, ndx + 1, ndx + 2, ndx + 2, ndx + 1, ndx + 3);
          }
        }
      }
    }

    // dispose old
    this.disposeMeshes(chunk);

    var meshes = [];
    if (inds.length) {
      var g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      g.setIndex(inds);
      var m = new THREE.Mesh(g, this.materials.opaque);
      m.position.set(x0, 0, z0);
      meshes.push(m);
      scene.add(m);
    }
    if (winds.length) {
      var wg = new THREE.BufferGeometry();
      wg.setAttribute('position', new THREE.Float32BufferAttribute(wpos, 3));
      wg.setAttribute('normal', new THREE.Float32BufferAttribute(wnorm, 3));
      wg.setAttribute('uv', new THREE.Float32BufferAttribute(wuv, 2));
      wg.setAttribute('color', new THREE.Float32BufferAttribute(wcol, 3));
      wg.setIndex(winds);
      var wm = new THREE.Mesh(wg, this.materials.water);
      wm.position.set(x0, 0, z0);
      meshes.push(wm);
      scene.add(wm);
    }
    chunk.meshes = meshes;
    this.meshedChunks.add(key(chunk.cx, chunk.cz));
  };

  World.prototype.disposeMeshes = function (chunk) {
    if (!chunk.meshes) return;
    for (var i = 0; i < chunk.meshes.length; i++) {
      var m = chunk.meshes[i];
      if (m.parent) m.parent.remove(m);
      m.geometry.dispose();
    }
    chunk.meshes = null;
    this.meshedChunks.delete(key(chunk.cx, chunk.cz));
  };

  // ---------------- streaming ----------------

  World.prototype.update = function (px, pz, renderDist, scene, budget) {
    budget = budget || 4;
    var pcx = Math.floor(px / CHUNK), pcz = Math.floor(pz / CHUNK);
    var done = 0;

    for (var r = 0; r <= renderDist && done < budget; r++) {
      for (var dx = -r; dx <= r && done < budget; dx++) {
        for (var dz = -r; dz <= r && done < budget; dz++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          var k = key(pcx + dx, pcz + dz);
          var chunk = this.chunks.get(k);
          if (!chunk) {
            chunk = this.ensureChunk(pcx + dx, pcz + dz);
            this.buildMesh(chunk, scene);
            done++;
          } else if (!this.meshedChunks.has(k)) {
            this.buildMesh(chunk, scene);
            done++;
          }
        }
      }
    }

    // rebuild dirty
    var dirtyArr = Array.from(this.dirty);
    for (var i = 0; i < dirtyArr.length && done < budget + 2; i++) {
      var dk = dirtyArr[i];
      this.dirty.delete(dk);
      var dc = this.chunks.get(dk);
      if (dc) { this.buildMesh(dc, scene); done++; }
    }

    // unload far chunks
    var lim = renderDist + 2;
    var self = this;
    this.chunks.forEach(function (chunk, k) {
      if (Math.abs(chunk.cx - pcx) > lim || Math.abs(chunk.cz - pcz) > lim) {
        self.disposeMeshes(chunk);
        self.chunks.delete(k);
      }
    });
  };

  // ---------------- raycast (Amanatides & Woo) ----------------

  World.prototype.raycast = function (origin, dir, maxDist) {
    var x = Math.floor(origin.x), y = Math.floor(origin.y), z = Math.floor(origin.z);
    var stepX = dir.x > 0 ? 1 : -1, stepY = dir.y > 0 ? 1 : -1, stepZ = dir.z > 0 ? 1 : -1;
    var tMaxX = intBound(origin.x, dir.x), tMaxY = intBound(origin.y, dir.y), tMaxZ = intBound(origin.z, dir.z);
    var tDeltaX = dir.x === 0 ? Infinity : Math.abs(1 / dir.x);
    var tDeltaY = dir.y === 0 ? Infinity : Math.abs(1 / dir.y);
    var tDeltaZ = dir.z === 0 ? Infinity : Math.abs(1 / dir.z);
    var t = 0, face = null;

    function intBound(s, ds) {
      if (ds === 0) return Infinity;
      var sIsInteger = Math.floor(s) === s;
      if (ds > 0) return ((sIsInteger ? s + 1 : Math.ceil(s)) - s) / ds;
      return (s - (sIsInteger ? s - 1 : Math.floor(s))) / -ds;
    }

    while (t <= maxDist) {
      var id = this.getBlock(x, y, z);
      if (id !== 0 && !BB.isLiquid(id)) {
        return { x: x, y: y, z: z, id: id, face: face, dist: t };
      }
      if (tMaxX < tMaxY) {
        if (tMaxX < tMaxZ) { x += stepX; t = tMaxX; tMaxX += tDeltaX; face = [-stepX, 0, 0]; }
        else { z += stepZ; t = tMaxZ; tMaxZ += tDeltaZ; face = [0, 0, -stepZ]; }
      } else {
        if (tMaxY < tMaxZ) { y += stepY; t = tMaxY; tMaxY += tDeltaY; face = [0, -stepY, 0]; }
        else { z += stepZ; t = tMaxZ; tMaxZ += tDeltaZ; face = [0, 0, -stepZ]; }
      }
      if (face === null && t > 0) break;
    }
    return null;
  };

  World.prototype.findSpawn = function () {
    var best = null;
    for (var r = 0; r < 140 && !best; r++) {
      var steps = Math.max(1, r * 6);
      for (var a = 0; a < steps; a++) {
        var ang = a / steps * Math.PI * 2;
        var x = Math.round(Math.cos(ang) * r) + 8;
        var z = Math.round(Math.sin(ang) * r) + 8;
        var h = this.heightAt(x, z);
        var biome = this.biomeAt(x, z);
        if (h > SEA + 1 && h < SEA + 16 && biome !== 'desert') {
          best = { x: x + 0.5, y: h + 2, z: z + 0.5 };
          break;
        }
      }
    }
    return best || { x: 8.5, y: 44, z: 8.5 };
  };

  World.CHUNK = CHUNK;
  World.HEIGHT = HEIGHT;
  World.SEA = SEA;
  window.BWorld = { World: World, CHUNK: CHUNK, HEIGHT: HEIGHT, SEA: SEA };
})();
