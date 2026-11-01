/* Blocka — block & item registry (window.BBlocks) */
(function () {
  'use strict';

  // ---- atlas tile indices (must match textures.js painting order) ----
  var TEX = {
    GRASS_TOP: 0, GRASS_SIDE: 1, DIRT: 2, STONE: 3, PLANKS: 4,
    LOG_SIDE: 5, LOG_TOP: 6, LEAVES: 7, SAND: 8, GLASS: 9,
    DIAMOND: 10, WATER: 11, SNOW_SIDE: 12, SNOW_TOP: 13, BEDROCK: 14,
    APPLE: 15, CARROT: 16
  };
  var ATLAS_COLS = 8, ATLAS_ROWS = 3; // 8x3 grid of 16px tiles -> 128x48

  var AIR = 0;

  // id -> definition
  var BLOCKS = {
    1:  { name: 'block_1',  tex: { top: TEX.GRASS_TOP, side: TEX.GRASS_SIDE, bottom: TEX.DIRT }, solid: true,  opaque: true,  hard: 0.9,  sound: 'grass',  drop: 1 },
    2:  { name: 'block_2',  tex: { top: TEX.DIRT,      side: TEX.DIRT,       bottom: TEX.DIRT }, solid: true,  opaque: true,  hard: 0.75, sound: 'dirt',   drop: 2 },
    3:  { name: 'block_3',  tex: { top: TEX.STONE,     side: TEX.STONE,      bottom: TEX.STONE }, solid: true,  opaque: true,  hard: 2.2,  sound: 'stone',  drop: 3 },
    4:  { name: 'block_4',  tex: { top: TEX.PLANKS,    side: TEX.PLANKS,     bottom: TEX.PLANKS }, solid: true,  opaque: true,  hard: 1.4,  sound: 'wood',   drop: 4 },
    5:  { name: 'block_5',  tex: { top: TEX.LOG_TOP,   side: TEX.LOG_SIDE,   bottom: TEX.LOG_TOP }, solid: true, opaque: true, hard: 1.4,  sound: 'wood',  drop: 5 },
    6:  { name: 'block_6',  tex: { top: TEX.LEAVES,    side: TEX.LEAVES,     bottom: TEX.LEAVES }, solid: true,  opaque: true,  hard: 0.25, sound: 'leaves', drop: 0, appleChance: 0.12 },
    7:  { name: 'block_7',  tex: { top: TEX.SAND,      side: TEX.SAND,       bottom: TEX.SAND }, solid: true,  opaque: true,  hard: 0.75, sound: 'sand',   drop: 7 },
    8:  { name: 'block_8',  tex: { top: TEX.GLASS,     side: TEX.GLASS,      bottom: TEX.GLASS }, solid: true,  opaque: false, hard: 0.45, sound: 'glass',  drop: 8 },
    9:  { name: 'block_9',  tex: { top: TEX.WATER,     side: TEX.WATER,      bottom: TEX.WATER }, solid: false, opaque: false, hard: Infinity, sound: 'water', drop: 0, liquid: true },
    10: { name: 'block_10', tex: { top: TEX.DIAMOND,   side: TEX.DIAMOND,    bottom: TEX.DIAMOND }, solid: true, opaque: true, hard: 3.2,  sound: 'stone', drop: 10 },
    11: { name: 'block_11', tex: { top: TEX.SNOW_TOP,  side: TEX.SNOW_SIDE,  bottom: TEX.DIRT }, solid: true,  opaque: true,  hard: 0.8,  sound: 'snow',   drop: 11 },
    12: { name: 'block_12', tex: { top: TEX.BEDROCK,   side: TEX.BEDROCK,    bottom: TEX.BEDROCK }, solid: true, opaque: true, hard: Infinity, sound: 'stone', drop: 0 }
  };

  // items (non-placeable)
  var ITEMS = {
    100: { name: 'block_100', tex: TEX.APPLE,  food: 4, heal: 2 },
    101: { name: 'block_101', tex: TEX.CARROT, food: 3, heal: 1 }
  };

  function def(id) {
    if (id === AIR) return null;
    return BLOCKS[id] || ITEMS[id] || null;
  }
  function isItem(id) { return !!ITEMS[id]; }
  function isSolid(id) { return !!(BLOCKS[id] && BLOCKS[id].solid); }
  function isOpaque(id) { return !!(BLOCKS[id] && BLOCKS[id].opaque); }
  function isLiquid(id) { return !!(BLOCKS[id] && BLOCKS[id].liquid); }

  window.BBlocks = {
    TEX: TEX,
    ATLAS_COLS: ATLAS_COLS,
    ATLAS_ROWS: ATLAS_ROWS,
    AIR: AIR,
    GRASS: 1, DIRT: 2, STONE: 3, PLANKS: 4, LOG: 5, LEAVES: 6, SAND: 7,
    GLASS: 8, WATER: 9, DIAMOND: 10, SNOW: 11, BEDROCK: 12,
    APPLE: 100, CARROT: 101,
    BLOCKS: BLOCKS,
    ITEMS: ITEMS,
    def: def,
    isItem: isItem,
    isSolid: isSolid,
    isOpaque: isOpaque,
    isLiquid: isLiquid
  };
})();
