/* Blocka — shared i18n dictionary (RU/EN). Classic script, exposes window.I18N. */
(function () {
  'use strict';

  var DICT = {
    ru: {
      lang_name: 'Русский',
      // ---- menu ----
      tagline: 'СТРОЙ. ИССЛЕДУЙ. ВЫЖИВАЙ.',
      play: 'Играть',
      single: 'Одиночная игра',
      multi: 'Сетевая игра',
      settings: 'Настройки',
      exit: 'Выйти',
      soon: 'скоро',
      whatsnew: 'Что нового?',
      update_title: 'Обновление 0.3.1',
      update_l1: 'Новые биомы',
      update_l2: 'Животные',
      update_l3: 'И ещё больше блоков!',
      details: 'Подробнее',
      version: 'v0.3.1 Alpha',
      thanks: 'Спасибо, что играешь!',
      rights: 'Blocka Team',
      good_game: 'Хорошей игры!',
      exit_toast: 'Игра сохраняется автоматически — можно просто закрыть вкладку!',
      multi_toast: 'Сетевая игра появится в обновлении 0.4. А пока — выживание в одиночку!',
      details_toast: 'Полный список изменений будет на blocka.game',
      // menu modals
      world_title: 'Одиночная игра',
      world_continue: 'Продолжить мир',
      world_new: 'Создать новый мир',
      world_seed: 'Сид мира (необязательно)',
      world_seed_ph: 'например: blocka',
      world_no_save: 'Сохранений пока нет — будет создан новый мир',
      world_start: 'Начать игру',
      world_overwrite: 'Внимание: текущее сохранение будет удалено!',
      back: 'Назад',
      help_title: 'Как играть',
      help_move: 'WASD — движение, Пробел — прыжок',
      help_look: 'Мышь — осмотр, ЛКМ — ломать, ПКМ — ставить',
      help_slots: '1–9 или колесо — выбор блока',
      help_sprint: 'Ctrl / двойной W — бег, Shift — красться',
      help_fly: 'Пробел ×2 — полёт (творческий)',
      help_pause: 'Esc — пауза, F — полноэкранный режим',
      help_food: 'Следи за голодом: ешь яблоки и морковь',
      close: 'Закрыть',
      // settings
      set_title: 'Настройки',
      set_graphics: 'Графика',
      set_render: 'Дальность прорисовки',
      set_fov: 'Поле зрения (FOV)',
      set_clouds: 'Облака',
      set_controls_s: 'Управление',
      set_sens: 'Чувствительность мыши',
      set_invert: 'Инвертировать ось Y',
      set_audio: 'Звук',
      set_volume: 'Громкость',
      set_lang: 'Язык / Language',
      on: 'Вкл',
      off: 'Выкл',
      chunks: 'чанков',
      // ---- game ----
      loading: 'Загрузка Blocka…',
      generating: 'Генерация мира…',
      click_play: 'Нажми, чтобы играть',
      click_play_hint: 'Клик захватит мышь. Esc — пауза.',
      paused: 'Пауза',
      back_to_game: 'Вернуться в игру',
      save_exit: 'Сохранить и выйти',
      new_world: 'Новый мир',
      died: 'Ты погиб!',
      died_hint: 'Не переживай — мир на месте.',
      respawn: 'Возродиться',
      saved: 'Мир сохранён',
      inv_full: 'Инвентарь полон!',
      eat_hint: 'ПКМ — съесть',
      new_world_confirm: 'Старый мир будет удалён. Продолжить?',
      confirm_yes: 'Да, новый мир',
      confirm_no: 'Отмена',
      touch_break: 'Ломать',
      touch_place: 'Ставить',
      touch_jump: 'Прыжок',
      // blocks
      block_1: 'Блок травы',
      block_2: 'Земля',
      block_3: 'Камень',
      block_4: 'Доски',
      block_5: 'Бревно',
      block_6: 'Листва',
      block_7: 'Песок',
      block_8: 'Стекло',
      block_9: 'Вода',
      block_10: 'Алмазная руда',
      block_11: 'Снежный блок',
      block_12: 'Коренная порода',
      block_100: 'Яблоко',
      block_101: 'Морковь'
    },
    en: {
      lang_name: 'English',
      tagline: 'BUILD. EXPLORE. SURVIVE.',
      play: 'Play',
      single: 'Singleplayer',
      multi: 'Multiplayer',
      settings: 'Settings',
      exit: 'Quit',
      soon: 'soon',
      whatsnew: "What's new?",
      update_title: 'Update 0.3.1',
      update_l1: 'New biomes',
      update_l2: 'Animals',
      update_l3: 'And even more blocks!',
      details: 'Learn more',
      version: 'v0.3.1 Alpha',
      thanks: 'Thanks for playing!',
      rights: 'Blocka Team',
      good_game: 'Have a nice game!',
      exit_toast: 'The game autosaves — you can just close the tab!',
      multi_toast: 'Multiplayer arrives in update 0.4. Until then — survive solo!',
      details_toast: 'Full changelog will be on blocka.game',
      world_title: 'Singleplayer',
      world_continue: 'Continue world',
      world_new: 'Create new world',
      world_seed: 'World seed (optional)',
      world_seed_ph: 'e.g. blocka',
      world_no_save: 'No saves yet — a new world will be created',
      world_start: 'Start playing',
      world_overwrite: 'Warning: current save will be deleted!',
      back: 'Back',
      help_title: 'How to play',
      help_move: 'WASD — move, Space — jump',
      help_look: 'Mouse — look, LMB — mine, RMB — place',
      help_slots: '1–9 or wheel — select block',
      help_sprint: 'Ctrl / double W — sprint, Shift — sneak',
      help_fly: 'Space ×2 — fly (creative)',
      help_pause: 'Esc — pause, F — fullscreen',
      help_food: 'Watch your hunger: eat apples and carrots',
      close: 'Close',
      set_title: 'Settings',
      set_graphics: 'Graphics',
      set_render: 'Render distance',
      set_fov: 'Field of view (FOV)',
      set_clouds: 'Clouds',
      set_controls_s: 'Controls',
      set_sens: 'Mouse sensitivity',
      set_invert: 'Invert Y axis',
      set_audio: 'Audio',
      set_volume: 'Volume',
      set_lang: 'Language / Язык',
      on: 'On',
      off: 'Off',
      chunks: 'chunks',
      loading: 'Loading Blocka…',
      generating: 'Generating world…',
      click_play: 'Click to play',
      click_play_hint: 'Click captures the mouse. Esc — pause.',
      paused: 'Game paused',
      back_to_game: 'Back to game',
      save_exit: 'Save & quit',
      new_world: 'New world',
      died: 'You died!',
      died_hint: "Don't worry — the world is still there.",
      respawn: 'Respawn',
      saved: 'World saved',
      inv_full: 'Inventory full!',
      eat_hint: 'RMB — eat',
      new_world_confirm: 'The old world will be deleted. Continue?',
      confirm_yes: 'Yes, new world',
      confirm_no: 'Cancel',
      touch_break: 'Mine',
      touch_place: 'Place',
      touch_jump: 'Jump',
      block_1: 'Grass Block',
      block_2: 'Dirt',
      block_3: 'Stone',
      block_4: 'Planks',
      block_5: 'Log',
      block_6: 'Leaves',
      block_7: 'Sand',
      block_8: 'Glass',
      block_9: 'Water',
      block_10: 'Diamond Ore',
      block_11: 'Snow Block',
      block_12: 'Bedrock',
      block_100: 'Apple',
      block_101: 'Carrot'
    }
  };

  var KEY = 'blocka_settings_v1';

  function defaults() {
    return {
      lang: (navigator.language || 'ru').toLowerCase().indexOf('ru') === 0 ? 'ru' : 'en',
      renderDist: 5,
      fov: 75,
      sens: 1.0,
      invertY: false,
      clouds: true,
      volume: 0.7
    };
  }

  function loadSettings() {
    var s = defaults();
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var p = JSON.parse(raw);
        for (var k in p) if (p.hasOwnProperty(k)) s[k] = p[k];
      }
    } catch (e) { /* ignore */ }
    return s;
  }

  function saveSettings(s) {
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* ignore */ }
  }

  function t(lang, key) {
    var d = DICT[lang] || DICT.en;
    if (d[key] != null) return d[key];
    return DICT.en[key] != null ? DICT.en[key] : key;
  }

  window.I18N = {
    DICT: DICT,
    KEY: KEY,
    defaults: defaults,
    loadSettings: loadSettings,
    saveSettings: saveSettings,
    t: t
  };
})();
