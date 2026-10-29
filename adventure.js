/* ============================================================
   DRAGÓN DE FUEGO — MODO AVENTURA
   Santuario de dragones: Chimuelo y la Furia Luminosa.
   Alimenta, acaricia, entrena y vuela con ellos.
   ============================================================ */
(() => {
  'use strict';

  const dg = window.dragonGame;
  if (!dg) return;

  const $ = (id) => document.getElementById(id);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const hexA = (hex, a) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  };
  const mixHex = (a, b, amount) => {
    const from = parseInt(a.slice(1), 16);
    const to = parseInt(b.slice(1), 16);
    const channel = (shift) => Math.round(
      ((from >> shift) & 255) + (((to >> shift) & 255) - ((from >> shift) & 255)) * amount
    );
    return '#' + [16, 8, 0]
      .map((shift) => channel(shift).toString(16).padStart(2, '0'))
      .join('');
  };

  const SAVE_KEY = 'dragon.adventure.v1';
  const MAX = 100;
  const PET_CD = 8000;
  const GOAL = 9000;
  const W = 480;
  const H = 270;

  /* ---------------- paletas de los dragones ---------------- */
  const THEMES = {
    toothless: {
      body: '#1b2234', dark: '#0b101d', belly: '#2e3d5e', edge: '#4b6292',
      eye: '#a8ff5c', pupil: '#0d160c', fin: '#e23b3b', finDark: '#8f1b26',
      glow: '#7cf5ff', spike: '#2b3a58'
    },
    light: {
      body: '#f4f9ff', dark: '#c9daef', belly: '#ffffff', edge: '#a6c6e8',
      eye: '#7cf5ff', pupil: '#0d2430', fin: '#dff4ff', finDark: '#9fd8f0',
      glow: '#b6f7ff', spike: '#dcecff'
    }
  };

  /* ---------------- datos de los dragones ---------------- */
  const DRAGONS = {
    toothless: {
      id: 'toothless',
      name: 'CHIMUELO',
      short: 'Chimuelo',
      desc: 'Furia Nocturna · curioso y leal',
      lines: {
        idle: [
          'Chimuelo te mira con curiosidad y ladea la cabeza.',
          'Chimuelo golpea la roca con la cola, impaciente.',
          'Chimuelo olfatea la cesta de peces.'
        ],
        hungry: [
          'A Chimuelo le rugen las tripas.',
          'Chimuelo te enseña los dientes… y luego sonríe.'
        ],
        tired: [
          'Chimuelo bosteza y se enrosca sobre la roca.',
          'Chimuelo parpadea, medio dormido.'
        ],
        happy: [
          'Chimuelo ronronea como un gato enorme.',
          'Chimuelo da una voltereta en el aire y aterriza a tu lado.'
        ],
        feed: [
          '¡Glups! Chimuelo devora el pescado de un bocado.',
          'Chimuelo te lame la mano para darte las gracias.'
        ],
        pet: [
          'Chimuelo cierra los ojos y ronronea.',
          'Chimuelo apoya la cabeza en tu hombro.'
        ]
      },
      tricks: [
        { at: 20, name: 'Plasma de fuego' },
        { at: 45, name: 'Vuelo rasante' },
        { at: 70, name: 'Ecolocalización' }
      ]
    },
    light: {
      id: 'light',
      name: 'FURIA LUMINOSA',
      short: 'la Furia Luminosa',
      desc: 'Furia Luminosa · libre y juguetona',
      lines: {
        idle: [
          'La Furia Luminosa brilla bajo la luz del atardecer.',
          'La Furia Luminosa se desvanece un instante y reaparece más cerca.',
          'La Furia Luminosa observa el mar con calma.'
        ],
        hungry: [
          'La Furia Luminosa mira la cesta con mucho interés.',
          'La Furia Luminosa golpea suavemente el suelo con la cola.'
        ],
        tired: [
          'La Furia Luminosa se acurruca contra Chimuelo.',
          'La Furia Luminosa cierra los ojos y suspira.'
        ],
        happy: [
          'La Furia Luminosa traza círculos de luz en el aire.',
          'La Furia Luminosa te roza la mano con el hocico.'
        ],
        feed: [
          'La Furia Luminosa atrapa el pez al vuelo.',
          'La Furia Luminosa come despacio, saboreando cada bocado.'
        ],
        pet: [
          'La Furia Luminosa emite un zumbido suave y luminoso.',
          'La Furia Luminosa se deja acariciar y brilla un poco más.'
        ]
      },
      tricks: [
        { at: 20, name: 'Camuflaje' },
        { at: 45, name: 'Destello' },
        { at: 70, name: 'Paso de niebla' }
      ]
    }
  };
  const IDS = Object.keys(DRAGONS);

  /* ---------------- guardado ---------------- */
  function defaults() {
    return {
      v: 1,
      day: 1,
      fish: 3,
      active: 'toothless',
      lastSeen: Date.now(),
      dragons: {
        toothless: { hunger: 82, mood: 78, energy: 88, bond: 8, petAt: 0 },
        light: { hunger: 74, mood: 86, energy: 92, bond: 6, petAt: 0 }
      }
    };
  }

  function load() {
    const base = defaults();
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return base;
      const data = JSON.parse(raw);
      if (!data || data.v !== 1) return base;
      base.day = Math.max(1, Math.floor(data.day) || 1);
      base.fish = clamp(Math.floor(data.fish) || 0, 0, 999);
      base.active = data.active === 'light' ? 'light' : 'toothless';
      base.lastSeen = Number(data.lastSeen) || Date.now();
      for (const id of IDS) {
        const src = data.dragons && data.dragons[id];
        if (!src) continue;
        const dst = base.dragons[id];
        for (const key of ['hunger', 'mood', 'energy', 'bond']) {
          const value = Number(src[key]);
          dst[key] = Number.isFinite(value) ? clamp(value, 0, MAX) : dst[key];
        }
        dst.petAt = Number(src.petAt) || 0;
      }
    } catch (e) { /* datos corruptos: empezar de cero */ }
    return base;
  }

  function save() {
    S.lastSeen = Date.now();
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(S));
    } catch (e) { /* modo privado */ }
  }

  let S = load();
  let active = S.active;

  /* desgaste por el tiempo que la pestaña estuvo cerrada */
  function applyOffline() {
    const minutes = (Date.now() - S.lastSeen) / 60000;
    if (!(minutes > 5)) return 0;
    const hunger = Math.min(45, minutes * 0.3);
    const mood = Math.min(30, minutes * 0.18);
    const energy = Math.min(60, minutes * 0.5);
    for (const id of IDS) {
      const d = S.dragons[id];
      d.hunger = clamp(d.hunger - hunger, 0, MAX);
      d.mood = clamp(d.mood - mood, 0, MAX);
      d.energy = clamp(d.energy + energy, 0, MAX);
    }
    return minutes;
  }

  /* ---------------- referencias del DOM ---------------- */
  const ui = {
    root: $('adventure'),
    scene: $('advScene'),
    day: $('advDay'),
    fish: $('advFish'),
    mute: $('advMute'),
    close: $('advClose'),
    sub: $('advSub'),
    bubble: $('advBubble'),
    name: $('advName'),
    desc: $('advDesc'),
    level: $('advLevel'),
    barHunger: $('barHunger'),
    valHunger: $('valHunger'),
    barMood: $('barMood'),
    valMood: $('valMood'),
    barEnergy: $('barEnergy'),
    valEnergy: $('valEnergy'),
    barBond: $('barBond'),
    valBond: $('valBond'),
    tricks: $('advTricks'),
    hint: $('advHint'),
    feed: $('actFeed'),
    pet: $('actPet'),
    train: $('actTrain'),
    fly: $('actFly'),
    rest: $('actRest'),
    pickToothless: $('pickToothless'),
    pickLight: $('pickLight'),
    pickToothlessText: $('pickToothlessText'),
    pickLightText: $('pickLightText'),
    pickToothlessHearts: $('pickToothlessHearts'),
    pickLightHearts: $('pickLightHearts'),
    trainModal: $('advTrainModal'),
    trainTitle: $('trainTitle'),
    trainSub: $('trainSub'),
    trainMarker: $('trainMarker'),
    trainRounds: $('trainRounds'),
    trainHit: $('trainHit'),
    trainCancel: $('trainCancel'),
    flyModal: $('advFlyModal'),
    flyTitle: $('flyTitle'),
    flySub: $('flySub'),
    flyCanvas: $('advFly'),
    flyFlap: $('flyFlap'),
    flyAbort: $('flyAbort'),
    resultModal: $('advResult'),
    resultEyebrow: $('resultEyebrow'),
    resultTitle: $('resultTitle'),
    resultGrid: $('resultGrid'),
    resultText: $('resultText'),
    resultClose: $('resultClose'),
    btnAdventure: $('btnAdventure')
  };

  if (!ui.root || !ui.scene || !ui.flyCanvas) return;

  const sctx = ui.scene.getContext('2d');
  const fctx = ui.flyCanvas.getContext('2d');
  sctx.scale(2, 2);
  fctx.scale(2, 2);
  sctx.imageSmoothingEnabled = true;
  fctx.imageSmoothingEnabled = true;

  /* ---------------- estado de la aventura ---------------- */
  let isOpen = false;
  let raf = 0;
  let last = 0;
  let sceneT = 0;
  let bubbleUntil = 0;
  let hintUntil = 0;
  let idleClock = 0;
  let decayAcc = 0;
  let uiClock = 0;
  let saveClock = 0;
  let resultOpen = false;
  let fx = [];

  const train = {
    active: false, done: false, presses: 0, scores: [],
    t: 0, pos: 0.5, speed: 1.55, wait: 0
  };

  const mission = {
    active: false, dragon: 'toothless', t: 0, distance: 0,
    speed: 150, y: 150, vy: 0, flap: false, lastFlap: -1,
    fish: 0, rings: 0, hits: 0, invuln: 0, shake: 0, slow: 1,
    rocks: [], fishes: [], ringsArr: [], parts: [],
    spawnRock: 1.4, spawnFish: 0.6, spawnRing: 2
  };

  const stars = Array.from({ length: 46 }, () => ({
    x: Math.random() * W,
    y: 8 + Math.random() * 110,
    s: Math.random() < 0.8 ? 1 : 2,
    tw: rand(0.6, 2),
    ph: rand(0, 6.28)
  }));

  const flies = Array.from({ length: 16 }, () => ({
    x: rand(16, 464),
    y: rand(148, 240),
    ph: rand(0, 6.28),
    sp: rand(0.25, 0.7),
    r: Math.random() < 0.5 ? 1 : 2,
    color: Math.random() < 0.55 ? '#ffd166' : '#9af3ff'
  }));

  /* ---------------- ayudas ---------------- */
  const cur = () => S.dragons[active];
  const capName = (id) => (id === 'toothless' ? 'Chimuelo' : 'La Furia Luminosa');
  const short = (id) => DRAGONS[id].short;

  function setBar(bar, label, value, text) {
    bar.style.width = clamp(value, 0, MAX) + '%';
    label.textContent = text;
  }

  function setHint(text, kind = '', seconds = 4) {
    ui.hint.textContent = text;
    ui.hint.className = 'adv__hint' + (kind ? ' ' + kind : '');
    hintUntil = sceneT + seconds;
  }

  function say(text) {
    ui.bubble.textContent = text;
    ui.bubble.classList.add('is-on');
    bubbleUntil = sceneT + 3.8;
  }

  function snd(fn) {
    try {
      dg.sfx.init();
      fn();
    } catch (e) { /* sin audio */ }
  }

  function gainBond(id, amount) {
    const def = DRAGONS[id];
    const d = S.dragons[id];
    const before = d.bond;
    d.bond = clamp(d.bond + amount, 0, MAX);
    const unlocked = def.tricks.filter((tr) => before < tr.at && d.bond >= tr.at);
    if (unlocked.length) {
      snd(() => dg.sfx.zone());
      setHint(`¡${capName(id)} ha aprendido «${unlocked[0].name}»!`, 'is-good', 6);
    }
    return Math.round((d.bond - before) * 10) / 10;
  }

  /* desgaste suave tras cada acción */
  function tick(scale) {
    for (const id of IDS) {
      const d = S.dragons[id];
      d.hunger = clamp(d.hunger - 2.2 * scale, 0, MAX);
      d.mood = clamp(d.mood - (d.hunger < 25 ? 2.4 : 1.1) * scale, 0, MAX);
      if (id !== active) d.energy = clamp(d.energy - 0.6 * scale, 0, MAX);
    }
  }

  /* ---------------- interfaz ---------------- */
  function refreshUI() {
    const d = cur();
    const def = DRAGONS[active];

    ui.day.textContent = 'DÍA ' + S.day;
    ui.fish.textContent = String(S.fish);
    ui.name.textContent = def.name;
    ui.desc.textContent = def.desc;
    ui.sub.textContent = 'Día ' + S.day + ' · los dragones viven junto al mar.';
    ui.level.textContent = 'Nv. ' + (1 + Math.floor(d.bond / 20));

    setBar(ui.barHunger, ui.valHunger, d.hunger, Math.round(d.hunger));
    setBar(ui.barMood, ui.valMood, d.mood, Math.round(d.mood));
    setBar(ui.barEnergy, ui.valEnergy, d.energy, Math.round(d.energy));
    setBar(ui.barBond, ui.valBond, d.bond, Math.round(d.bond) + '%');

    ui.tricks.innerHTML = def.tricks
      .map((tr) => {
        const on = d.bond >= tr.at;
        return '<li class="' + (on ? '' : 'is-locked') + '">' + tr.name +
          '<em>' + (on ? 'APRENDIDO' : 'VÍNCULO ' + tr.at + '%') + '</em></li>';
      })
      .join('');

    const hearts = (id) => {
      const dd = S.dragons[id];
      const filled = Math.round(dd.bond / 20);
      return Array.from({ length: 5 }, (_, i) =>
        '<i class="' + (i < filled ? 'is-on' : '') + '">♥</i>'
      ).join('');
    };

    for (const id of IDS) {
      const dd = S.dragons[id];
      const btn = id === 'toothless' ? ui.pickToothless : ui.pickLight;
      const label = id === 'toothless' ? ui.pickToothlessText : ui.pickLightText;
      const heartsBox = id === 'toothless' ? ui.pickToothlessHearts : ui.pickLightHearts;
      btn.classList.toggle('is-active', id === active);
      label.textContent = 'Vínculo ' + Math.round(dd.bond) + '%';
      heartsBox.innerHTML = hearts(id);
    }

    const petLeft = Math.max(0, d.petAt + PET_CD - Date.now());
    ui.feed.disabled = S.fish < 1;
    ui.pet.disabled = petLeft > 0;
    ui.train.disabled = d.energy < 18 || d.mood < 20;
    ui.fly.disabled = d.energy < 22;

    ui.feed.querySelector('small').textContent = S.fish < 1 ? 'sin peces' : '1 pez';
    ui.pet.querySelector('small').textContent = petLeft > 0 ? Math.ceil(petLeft / 1000) + 's' : 'gratis';
    ui.train.querySelector('small').textContent = d.energy < 18 ? 'sin energía' : '18 energía';
    ui.fly.querySelector('small').textContent = d.energy < 22 ? 'sin energía' : '22 energía';

    ui.feed.title = S.fish < 1 ? 'Hace falta un pez. Vuela para pescar.' : '';
    ui.pet.title = petLeft > 0 ? 'Espera ' + Math.ceil(petLeft / 1000) + ' s' : '';
    ui.train.title = d.mood < 20 ? 'Necesita cariño antes de entrenar.' : d.energy < 18 ? 'Necesita descansar.' : '';
    ui.fly.title = d.energy < 22 ? 'Necesita descansar.' : '';

    if (hintUntil <= sceneT) {
      let text = 'Alimenta, acaricia y entrena para ganarte su confianza.';
      let kind = '';
      if (S.fish < 1) {
        text = 'No quedan peces: vuelve a volar para pescar más.';
        kind = 'is-warn';
      } else if (d.hunger < 25) {
        text = short(active) + ' tiene hambre. Dale un pez.';
        kind = 'is-warn';
      } else if (d.mood < 25) {
        text = short(active) + ' necesita cariño. Acarícialo un rato.';
        kind = 'is-warn';
      } else if (d.energy < 22) {
        text = short(active) + ' está agotado. Descansad hasta mañana.';
        kind = 'is-warn';
      } else if (d.bond >= MAX) {
        text = 'Vínculo máximo: ' + short(active) + ' confía en ti por completo.';
        kind = 'is-good';
      }
      ui.hint.textContent = text;
      ui.hint.className = 'adv__hint' + (kind ? ' ' + kind : '');
    }
  }

  function syncMute() {
    const off = dg.sfx.muted;
    ui.mute.classList.toggle('is-off', off);
    ui.mute.setAttribute('aria-label', off ? 'Activar sonido' : 'Silenciar sonido');
    ui.mute.title = off ? 'Activar sonido (M)' : 'Silenciar sonido (M)';
  }

  /* ---------------- partículas de la escena ---------------- */
  function headPos(id) {
    return id === 'toothless' ? { x: 196, y: 146 } : { x: 296, y: 144 };
  }

  function spawnFx(id, n, kind, color) {
    const p = headPos(id);
    for (let i = 0; i < n; i++) {
      fx.push({
        x: p.x + rand(-16, 16),
        y: p.y + rand(-10, 10),
        vx: rand(-16, 16),
        vy: rand(-46, -20),
        life: rand(0.7, 1.5),
        max: 1.5,
        color,
        kind,
        s: rand(2, 4)
      });
    }
  }

  function updateFx(dt) {
    for (const p of fx) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 10 * dt;
      p.life -= dt;
    }
    fx = fx.filter((p) => p.life > 0);
  }

  function drawFx() {
    for (const p of fx) {
      const a = clamp(p.life / p.max, 0, 1);
      sctx.globalAlpha = a;
      sctx.fillStyle = p.color;
      if (p.kind === 'heart') {
        const x = Math.round(p.x);
        const y = Math.round(p.y);
        const s = Math.max(1, Math.round(p.s));
        sctx.fillRect(x - s, y, s, s);
        sctx.fillRect(x + s, y, s, s);
        sctx.fillRect(x - s * 2, y - s, s * 3, s);
        sctx.fillRect(x - s, y - s * 2, s * 2, s);
        sctx.fillRect(x, y + s, s, s);
      } else {
        sctx.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s);
      }
    }
    sctx.globalAlpha = 1;
  }

  /* ---------------- abrir / cerrar ---------------- */
  function open() {
    if (isOpen) return;
    isOpen = true;
    sceneT = 0;
    bubbleUntil = 0;
    hintUntil = 0;
    idleClock = 0;
    decayAcc = 0;
    uiClock = 0;
    saveClock = 0;
    fx = [];

    dg.suspendArcade();
    document.body.classList.add('is-adv');
    ui.root.classList.add('is-open');
    ui.root.setAttribute('aria-hidden', 'false');

    const away = applyOffline();
    S.active = active;
    save();
    refreshUI();
    syncMute();

    ui.bubble.classList.remove('is-on');
    if (away > 30) {
      say('Has estado fuera ' + Math.round(away) + ' min. A tus dragones les rugen las tripas…');
    } else {
      say('Chimuelo y la Furia Luminosa te reciben en el santuario.');
    }

    ui.close.focus({ preventScroll: true });
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function closeAdventure() {
    if (!isOpen) return;
    if (mission.active) abortMission(true);
    if (train.active) cancelTrain(true);
    closeResult(true);

    isOpen = false;
    cancelAnimationFrame(raf);
    raf = 0;
    document.body.classList.remove('is-adv');
    ui.root.classList.remove('is-open');
    ui.root.setAttribute('aria-hidden', 'true');
    save();
    dg.showTitle();
    if (ui.btnAdventure) ui.btnAdventure.focus({ preventScroll: true });
  }

  /* ---------------- bucle ---------------- */
  function modalOpen() {
    return !ui.trainModal.hidden || !ui.resultModal.hidden || !ui.flyModal.hidden;
  }

  function updateIdle(dt) {
    if (modalOpen()) return;

    decayAcc += dt;
    if (decayAcc >= 1) {
      const secs = decayAcc;
      decayAcc = 0;
      for (const id of IDS) {
        const d = S.dragons[id];
        d.hunger = clamp(d.hunger - 0.012 * secs, 0, MAX);
        d.mood = clamp(d.mood - 0.008 * secs, 0, MAX);
        d.energy = clamp(d.energy + 0.005 * secs, 0, MAX);
      }
      refreshUI();
    }

    idleClock += dt;
    if (idleClock > 16 && bubbleUntil <= sceneT) {
      idleClock = 0;
      const d = cur();
      const lines = DRAGONS[active].lines;
      if (d.hunger < 25) say(pick(lines.hungry));
      else if (d.energy < 25) say(pick(lines.tired));
      else if (d.mood > 76) say(pick(lines.happy));
      else say(pick(lines.idle));
    }
  }

  function frame(now) {
    if (!isOpen) return;
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    sceneT += dt;

    if (bubbleUntil && sceneT > bubbleUntil) {
      bubbleUntil = 0;
      ui.bubble.classList.remove('is-on');
    }

    if (mission.active) {
      updateMission(dt);
      drawMission();
    } else {
      updateIdle(dt);
      updateTrain(dt);
      drawScene(dt);
      updateFx(dt);
      drawFx();
    }

    uiClock += dt;
    saveClock += dt;
    if (uiClock >= 1) {
      uiClock = 0;
      refreshUI();
    }
    if (saveClock >= 20) {
      saveClock = 0;
      save();
    }

    raf = requestAnimationFrame(frame);
  }

  /* ---------------- dibujo: dragones ---------------- */
  function drawWing(g, th, ox, k, fill) {
    g.save();
    g.translate(ox, 0);
    g.scale(k, k);
    g.fillStyle = fill;
    g.strokeStyle = hexA(th.edge, 0.8);
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(-24, -30);
    g.quadraticCurveTo(-35, -55, -12, -61);
    g.quadraticCurveTo(3, -50, 11, -30);
    g.quadraticCurveTo(-6, -21, -24, -30);
    g.closePath();
    g.fill();
    g.stroke();

    g.strokeStyle = hexA(th.edge, 0.45);
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(-24, -30);
    g.lineTo(-16, -47);
    g.moveTo(-12, -61);
    g.lineTo(-8, -38);
    g.stroke();
    g.restore();
  }

  function drawDragon(g, id, x, y, s, dir, t, active) {
    const th = THEMES[id];
    const breathe = Math.sin(t * 1.7 + (id === 'light' ? 1.4 : 0)) * 0.9;
    const blink = Math.sin(t * 0.9 + (id === 'light' ? 2.4 : 0)) > 0.985;
    const sway = Math.sin(t * 1.25 + (id === 'light' ? 0.8 : 0)) * 3;

    g.save();
    g.translate(x, y);
    g.scale(dir * s, s);

    g.fillStyle = 'rgba(0,0,0,0.32)';
    g.beginPath();
    g.ellipse(-6, 3, 42, 6, 0, 0, Math.PI * 2);
    g.fill();

    if (active) {
      const pulse = 0.1 + Math.sin(t * 2) * 0.03;
      g.fillStyle = hexA(th.glow, pulse);
      g.beginPath();
      g.ellipse(-4, -26, 56, 44, 0, 0, Math.PI * 2);
      g.fill();
    }

    g.translate(0, breathe);

    /* cola */
    g.strokeStyle = th.dark;
    g.lineWidth = 8;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(-26, -22);
    g.bezierCurveTo(-46, -17, -56, -33 + sway, -71, -27 + sway);
    g.stroke();

    g.save();
    g.translate(-71, -27 + sway);
    g.rotate(-0.4);
    g.fillStyle = th.fin;
    g.beginPath();
    g.moveTo(1, 0);
    g.quadraticCurveTo(-11, -11, -18, -2);
    g.quadraticCurveTo(-11, 7, 1, 0);
    g.closePath();
    g.fill();
    g.fillStyle = th.finDark;
    g.fillRect(-14, -2, 9, 2);
    g.restore();

    /* ala lejana */
    drawWing(g, th, -6, 0.8, th.dark);

    /* cuerpo */
    const bodyShade = g.createLinearGradient(-8, -40, -8, -5);
    bodyShade.addColorStop(0, th.edge);
    bodyShade.addColorStop(0.42, th.body);
    bodyShade.addColorStop(1, th.dark);
    g.fillStyle = bodyShade;
    g.beginPath();
    g.ellipse(-8, -22, 27, 18, -0.12, 0, Math.PI * 2);
    g.fill();

    g.fillStyle = th.dark;
    g.beginPath();
    g.ellipse(-15, -31, 17, 7, -0.28, 0, Math.PI * 2);
    g.fill();

    const bellyShade = g.createLinearGradient(0, 0, 0, 9);
    bellyShade.addColorStop(0, th.belly);
    bellyShade.addColorStop(1, th.edge);
    g.fillStyle = bellyShade;
    g.beginPath();
    g.ellipse(6, -13, 13, 10, -0.05, 0, Math.PI * 2);
    g.fill();

    /* patas */
    g.fillStyle = th.dark;
    g.beginPath();
    g.ellipse(-20, -9, 13, 9, 0, 0, Math.PI * 2);
    g.fill();

    g.fillStyle = th.body;
    g.beginPath();
    g.ellipse(10, -8, 5, 10, -0.12, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = th.dark;
    g.fillRect(7, -1, 8, 3);

    /* cuello y cabeza */
    g.strokeStyle = th.body;
    g.lineWidth = 13;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(2, -30);
    g.quadraticCurveTo(10, -41, 16, -43);
    g.stroke();

    g.fillStyle = id === 'light' ? th.fin : th.dark;
    g.beginPath();
    g.moveTo(9, -48);
    g.lineTo(2, -62);
    g.lineTo(15, -54);
    g.closePath();
    g.fill();
    g.beginPath();
    g.moveTo(17, -51);
    g.lineTo(19, -65);
    g.lineTo(26, -53);
    g.closePath();
    g.fill();

    g.fillStyle = th.body;
    g.beginPath();
    g.ellipse(20, -42, 13, 11, 0, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.ellipse(31, -38, 9, 6.5, 0, 0, Math.PI * 2);
    g.fill();

    g.fillStyle = th.dark;
    g.beginPath();
    g.ellipse(19, -50, 10, 4.5, 0.1, 0, Math.PI * 2);
    g.fill();

    g.strokeStyle = th.dark;
    g.lineWidth = 1.4;
    g.beginPath();
    g.moveTo(27, -33);
    g.quadraticCurveTo(34, -32, 39, -34);
    g.stroke();

    if (blink) {
      g.strokeStyle = th.eye;
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(16, -46);
      g.lineTo(26, -46);
      g.stroke();
    } else {
      g.fillStyle = th.eye;
      g.beginPath();
      g.ellipse(21, -46, 5, 4.6, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = th.pupil;
      g.beginPath();
      g.ellipse(21, -46, 1.7, 3.9, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#ffffff';
      g.fillRect(19, -49, 2, 2);
    }

    g.fillStyle = th.dark;
    g.fillRect(36, -40, 2, 2);

    /* ala cercana */
    drawWing(g, th, 2, 1, id === 'light' ? th.fin : th.spike);

    if (id === 'light') {
      for (let i = 0; i < 4; i++) {
        const a = (t * 0.8 + i * 1.7) % 6.283;
        const px2 = Math.cos(a) * (26 + i * 4) - 4;
        const py2 = Math.sin(a) * (16 + i * 2) - 30;
        g.globalAlpha = 0.35 + Math.sin(a * 2) * 0.25;
        g.fillStyle = th.glow;
        g.fillRect(Math.round(px2), Math.round(py2), 2, 2);
      }
      g.globalAlpha = 1;
    }

    g.restore();
  }

  /* ---------------- dibujo: escena ---------------- */
  function drawScene(dt) {
    const g = sctx;
    const horizon = 140;
    const ground = 176;

    const sky = g.createLinearGradient(0, 0, 0, horizon + 20);
    sky.addColorStop(0, '#140c28');
    sky.addColorStop(0.42, '#4a1f4d');
    sky.addColorStop(0.72, '#a83a4e');
    sky.addColorStop(0.9, '#f0794d');
    sky.addColorStop(1, '#ffc27a');
    g.fillStyle = sky;
    g.fillRect(0, 0, W, H);

    for (const s of stars) {
      const tw = 0.3 + 0.7 * Math.abs(Math.sin(sceneT * s.tw + s.ph));
      const fade = clamp((horizon - 30 - s.y) / 70, 0, 1);
      g.fillStyle = 'rgba(255,240,210,' + (0.7 * tw * fade).toFixed(3) + ')';
      g.fillRect(s.x | 0, s.y | 0, s.s, s.s);
    }

    const glow = g.createRadialGradient(240, 120, 4, 240, 120, 86);
    glow.addColorStop(0, 'rgba(255,214,140,0.55)');
    glow.addColorStop(0.55, 'rgba(255,150,90,0.18)');
    glow.addColorStop(1, 'rgba(255,120,80,0)');
    g.fillStyle = glow;
    g.fillRect(140, 20, 200, 180);

    const sun = g.createLinearGradient(0, 92, 0, 142);
    sun.addColorStop(0, '#fff3c8');
    sun.addColorStop(0.6, '#ffce80');
    sun.addColorStop(1, '#ff9a5a');
    g.fillStyle = sun;
    g.beginPath();
    g.arc(240, 122, 30, 0, Math.PI * 2);
    g.fill();

    g.fillStyle = 'rgba(255,190,130,0.16)';
    for (let i = 0; i < 3; i++) {
      const cy = 66 + i * 26;
      const cw = 110 + i * 46;
      const cx = ((sceneT * (4 + i * 2) + i * 150) % (W + 200)) - 100;
      g.beginPath();
      g.ellipse(cx, cy, cw * 0.5, 6 + i * 2, 0, 0, Math.PI * 2);
      g.fill();
    }

    /* islas lejanas */
    g.fillStyle = '#3b1c3f';
    g.beginPath();
    g.moveTo(0, horizon);
    g.lineTo(0, 128);
    g.quadraticCurveTo(30, 120, 58, 132);
    g.quadraticCurveTo(80, 136, 104, horizon);
    g.closePath();
    g.fill();

    g.fillStyle = '#331739';
    g.beginPath();
    g.moveTo(360, horizon);
    g.lineTo(386, 124);
    g.quadraticCurveTo(420, 116, 448, 130);
    g.quadraticCurveTo(468, 134, 480, 128);
    g.lineTo(480, horizon);
    g.closePath();
    g.fill();

    /* mar */
    const sea = g.createLinearGradient(0, horizon, 0, 220);
    sea.addColorStop(0, '#c25a54');
    sea.addColorStop(0.45, '#6b2b4a');
    sea.addColorStop(1, '#2a1330');
    g.fillStyle = sea;
    g.fillRect(0, horizon, W, 100);

    g.fillStyle = 'rgba(255,214,150,0.5)';
    for (let i = 0; i < 9; i++) {
      const yy = horizon + 3 + i * 3.4;
      const ww = 34 - i * 2.6;
      const off = Math.sin(sceneT * 1.4 + i) * 4;
      g.fillRect(240 - ww / 2 + off, yy, Math.max(3, ww), 1);
    }

    g.fillStyle = 'rgba(255,160,120,0.14)';
    for (let i = 0; i < 12; i++) {
      const yy = horizon + 8 + ((i * 7.5) % 46);
      const xx = ((i * 53 + sceneT * 6) % (W + 60)) - 30;
      g.fillRect(xx, yy, 14 + (i % 3) * 8, 1);
    }

    /* aves */
    g.strokeStyle = 'rgba(30,14,32,0.6)';
    g.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) {
      const bx = ((sceneT * 12 + i * 64) % (W + 80)) - 40;
      const by = 74 + i * 11 + Math.sin(sceneT + i) * 2;
      g.beginPath();
      g.moveTo(bx - 4, by);
      g.lineTo(bx, by - 2);
      g.lineTo(bx + 4, by);
      g.stroke();
    }

    /* acantilado */
    g.fillStyle = '#1b1230';
    g.beginPath();
    g.moveTo(0, 194);
    g.lineTo(56, 180);
    g.lineTo(126, 176);
    g.lineTo(210, 173);
    g.lineTo(300, 174);
    g.lineTo(388, 177);
    g.lineTo(452, 183);
    g.lineTo(480, 192);
    g.lineTo(480, H);
    g.lineTo(0, H);
    g.closePath();
    g.fill();

    g.strokeStyle = '#3a2850';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(0, 194);
    g.lineTo(56, 180);
    g.lineTo(126, 176);
    g.lineTo(210, 173);
    g.lineTo(300, 174);
    g.lineTo(388, 177);
    g.lineTo(452, 183);
    g.lineTo(480, 192);
    g.stroke();

    g.fillStyle = 'rgba(10,6,20,0.55)';
    for (let i = 0; i < 14; i++) {
      const rx = (i * 41 + 17) % W;
      const ry = 196 + ((i * 29) % 62);
      g.fillRect(rx, ry, 3 + (i % 3) * 5, 2);
    }

    g.fillStyle = '#120b20';
    g.fillRect(0, 236, W, H - 236);
    g.fillStyle = 'rgba(255,150,110,0.06)';
    g.fillRect(0, 236, W, 2);

    /* hierba */
    g.strokeStyle = '#2d2145';
    g.lineWidth = 1.5;
    for (let i = 0; i < 16; i++) {
      const gx = 12 + i * 29;
      const gy = 180 + (i % 3) * 2;
      const bend = Math.sin(sceneT * 1.2 + i) * 1.6;
      g.beginPath();
      g.moveTo(gx, gy);
      g.quadraticCurveTo(gx + bend, gy - 6, gx + 3 + bend, gy - 9);
      g.stroke();
    }

    /* luciérnagas */
    for (const f of flies) {
      const yy = f.y + Math.sin(sceneT * f.sp + f.ph) * 5;
      const xx = f.x + Math.cos(sceneT * f.sp * 0.7 + f.ph) * 6;
      const a = 0.3 + 0.55 * Math.abs(Math.sin(sceneT * 1.4 + f.ph));
      g.globalAlpha = a;
      g.fillStyle = f.color;
      g.fillRect(xx | 0, yy | 0, f.r, f.r);
      g.globalAlpha = 1;
    }

    /* dragones */
    drawDragon(g, 'toothless', 176, ground, 1, 1, sceneT, active === 'toothless');
    drawDragon(g, 'light', 306, ground, 1, -1, sceneT, active === 'light');
  }

  /* ---------------- acciones del santuario ---------------- */
  function selectDragon(id) {
    if (!DRAGONS[id] || id === active) return;
    active = id;
    S.active = id;
    const d = cur();
    snd(() => dg.sfx.click());
    refreshUI();
    if (d.hunger < 25) say(pick(DRAGONS[id].lines.hungry));
    else say(DRAGONS[id].name + ' se acerca y te mira a los ojos.');
    save();
  }

  function feed() {
    if (!isOpen) return;
    const d = cur();
    if (S.fish < 1) {
      setHint('No quedan peces. Vuela para pescar más.', 'is-warn', 4);
      snd(() => dg.sfx.hit());
      return;
    }
    if (d.hunger >= 98) {
      setHint(short(active) + ' está lleno por ahora.', '', 4);
      snd(() => dg.sfx.click());
      return;
    }
    S.fish -= 1;
    d.hunger = clamp(d.hunger + 26, 0, MAX);
    d.mood = clamp(d.mood + 6, 0, MAX);
    tick(0.5);
    const gained = gainBond(active, 2.4);
    spawnFx(active, 5, 'heart', '#ff6f91');
    say(pick(DRAGONS[active].lines.feed));
    setHint('+2.4% de vínculo · hambre ' + Math.round(d.hunger) + '/100', 'is-good', 3.5);
    snd(() => dg.sfx.heart());
    refreshUI();
    save();
    return gained;
  }

  function pet() {
    if (!isOpen) return;
    const d = cur();
    const left = d.petAt + PET_CD - Date.now();
    if (left > 0) {
      setHint('Dale un respiro: ' + Math.ceil(left / 1000) + ' s.', '', 3);
      return;
    }
    d.petAt = Date.now();
    d.mood = clamp(d.mood + 9, 0, MAX);
    d.energy = clamp(d.energy + 2, 0, MAX);
    tick(0.35);
    const gained = gainBond(active, 2.2);
    spawnFx(active, 7, 'heart', '#ff9ab5');
    say(pick(DRAGONS[active].lines.pet));
    setHint('+2.2% de vínculo · ' + short(active) + ' está más feliz', 'is-good', 3.5);
    snd(() => dg.sfx.heart());
    refreshUI();
    save();
    return gained;
  }

  function rest() {
    if (!isOpen) return;
    S.day += 1;
    for (const id of IDS) {
      const d = S.dragons[id];
      d.hunger = clamp(d.hunger - 18, 4, MAX);
      d.mood = clamp(d.mood + 14, 0, MAX);
      d.energy = clamp(d.energy + 52, 0, MAX);
      d.petAt = 0;
    }
    spawnFx(active, 8, 'heart', '#b6f7ff');
    say('La noche cae sobre el santuario. Los dragones duermen enroscados.');
    setHint('Día ' + S.day + ': todos han descansado. Energía recuperada.', 'is-good', 5);
    snd(() => dg.sfx.zone());
    refreshUI();
    save();
  }

  /* ---------------- entrenamiento ---------------- */
  const PTS = { perfect: 100, good: 72, ok: 48, fail: 20 };
  const LABEL = { perfect: 'PERFECTO', good: 'BIEN', ok: 'FLOJO', fail: 'FALLO' };

  function startTrain() {
    if (!isOpen || train.active) return;
    const d = cur();
    if (d.energy < 18) {
      setHint(short(active) + ' no tiene energía para entrenar.', 'is-warn', 4);
      snd(() => dg.sfx.hit());
      return;
    }
    if (d.mood < 20) {
      setHint(short(active) + ' está triste. Acarícialo antes de entrenar.', 'is-warn', 4);
      snd(() => dg.sfx.hit());
      return;
    }

    train.active = true;
    train.done = false;
    train.presses = 0;
    train.scores = [];
    train.wait = 0;
    train.t = rand(0, 1);
    train.speed = 1.45;
    train.pos = 0.5;

    ui.trainTitle.textContent = active === 'toothless' ? 'PLASMA EN EL AIRE' : 'DANZA DE LUZ';
    ui.trainSub.textContent = active === 'toothless'
      ? 'Chimuelo carga el disparo. Pulsa cuando la marca cruce la zona dorada.'
      : 'La Furia Luminosa traza un aro de luz. Pulsa cuando la marca cruce el centro.';
    ui.trainRounds.querySelectorAll('span').forEach((el) => { el.className = ''; });
    ui.trainHit.textContent = '¡AHORA!';
    ui.trainModal.hidden = false;
    ui.trainModal.classList.add('is-open');
    drawTrainMarker();
    snd(() => dg.sfx.click());
  }

  function nextRound() {
    train.t = rand(0, 0.9);
    train.speed = 1.4 + train.presses * 0.28;
    train.pos = 0;
    ui.trainHit.textContent = '¡AHORA!';
  }

  function drawTrainMarker() {
    ui.trainMarker.style.left = (clamp(train.pos, 0, 1) * 100).toFixed(2) + '%';
  }

  function updateTrain(dt) {
    if (!train.active || train.done) return;
    if (train.wait > 0) {
      train.wait -= dt;
      if (train.wait <= 0) nextRound();
      return;
    }
    train.t += dt;
    const cycle = (train.t * train.speed) % 2;
    train.pos = cycle <= 1 ? cycle : 2 - cycle;
    drawTrainMarker();
  }

  function trainPress() {
    if (!train.active || train.done || train.wait > 0) return;
    const d = Math.abs(train.pos - 0.5);
    let grade;
    if (d <= 0.065) grade = 'perfect';
    else if (d <= 0.16) grade = 'good';
    else if (d <= 0.29) grade = 'ok';
    else grade = 'fail';

    train.scores.push(grade);
    train.presses += 1;

    const dot = ui.trainRounds.children[train.presses - 1];
    if (dot) dot.className = 'is-' + grade;

    ui.trainHit.textContent = LABEL[grade];
    ui.trainMarker.classList.add('is-hit');
    window.setTimeout(() => ui.trainMarker.classList.remove('is-hit'), 220);

    if (grade === 'perfect') snd(() => dg.sfx.gem(4));
    else if (grade === 'fail') snd(() => dg.sfx.hit());
    else snd(() => dg.sfx.gem(1));

    if (train.presses >= 3) {
      train.done = true;
      window.setTimeout(finishTrain, 520);
    } else {
      train.wait = 0.85;
    }
  }

  function finishTrain() {
    if (!train.active) return;
    const scores = train.scores.slice(0, 3);
    let total = 0;
    let perfect = 0;
    let good = 0;
    for (const s of scores) {
      total += PTS[s] || 0;
      if (s === 'perfect') perfect += 1;
      else if (s === 'good') good += 1;
    }

    const d = cur();
    d.energy = clamp(d.energy - 18, 0, MAX);
    d.mood = clamp(d.mood + 4 + perfect * 3 + good, 0, MAX);
    tick(0.5);
    const bond = gainBond(active, 1.8 + perfect * 1.6 + good * 0.9 + (scores.includes('ok') ? 0.4 : 0));

    train.active = false;
    train.done = false;
    ui.trainModal.hidden = true;
    ui.trainModal.classList.remove('is-open');

    const avg = total / 300;
    const title = perfect >= 2 ? '¡PERFECTO!' : total >= 200 ? '¡GRAN SESIÓN!' : total >= 110 ? 'BUEN INTENTO' : 'HAY QUE PRACTICAR';
    const who = capName(active);
    const proud = active === 'toothless' ? 'solo, orgulloso' : 'sola, orgullosa';
    const text = perfect >= 2
      ? short(active) + ' repite el truco ' + proud + '. Su confianza crece.'
      : total >= 110
        ? short(active) + ' aprende poco a poco y no quiere parar.'
        : short(active) + ' se distrae, pero sabe que volveréis a intentarlo.';
    const cells = [
      { label: 'PUNTOS', value: String(total) },
      { label: 'VÍNCULO', value: '+' + (Math.round(bond * 10) / 10) + '%' },
      { label: 'ÁNIMO', value: '+' + (4 + perfect * 3 + good) }
    ];

    showResult({
      eyebrow: '◆ entrenamiento ◆',
      title,
      cells,
      text: text + (avg > 0.9 ? '' : '')
    });
    snd(() => dg.sfx.zone());
    refreshUI();
    save();
  }

  function cancelTrain(silent) {
    if (!train.active) return;
    train.active = false;
    train.done = false;
    ui.trainModal.hidden = true;
    ui.trainModal.classList.remove('is-open');
    if (!silent) {
      setHint('Entrenamiento cancelado. No se ha gastado energía.', '', 3.5);
      snd(() => dg.sfx.click());
    }
  }

  /* ---------------- resultado ---------------- */
  function showResult(data) {
    ui.resultEyebrow.textContent = data.eyebrow || '◆ resultado ◆';
    ui.resultTitle.textContent = data.title || '¡BUEN TRABAJO!';
    ui.resultText.textContent = data.text || '';
    ui.resultGrid.innerHTML = (data.cells || [])
      .map((c) => '<div class="result__cell"><span>' + c.label + '</span><b>' + c.value + '</b></div>')
      .join('');
    ui.resultModal.hidden = false;
    ui.resultModal.classList.add('is-open');
    resultOpen = true;
    ui.resultClose.focus({ preventScroll: true });
  }

  function closeResult(silent) {
    if (!resultOpen) return;
    resultOpen = false;
    ui.resultModal.hidden = true;
    ui.resultModal.classList.remove('is-open');
    if (!silent) refreshUI();
  }

  /* ---------------- misión de vuelo ---------------- */
  const FLY_TITLES = {
    toothless: ['ACANTILADOS DEL ALBA', 'PASO DE LAS NUBES', 'MAR DE BRASA'],
    light: ['LAGUNA DE LUZ', 'BAHÍA DE CRISTAL', 'EL MUNDO OCULTO']
  };

  const WORLD_REGIONS = [
    {
      name: 'ACANTILADOS DEL ALBA',
      skyTop: '#172447', skyHorizon: '#f5a078', sun: '#fff0bd',
      sea: '#5797a8', seaDeep: '#173a58',
      far: '#8295ac', mid: '#52647b', near: '#283749', glow: '#ffc58f'
    },
    {
      name: 'ISLAS ESMERALDA',
      skyTop: '#103346', skyHorizon: '#7dd0c2', sun: '#e1ffd9',
      sea: '#50c7b5', seaDeep: '#11536a',
      far: '#70bbb0', mid: '#328b84', near: '#1b5155', glow: '#a8ffe1'
    },
    {
      name: 'VOLCANES DE CRISTAL',
      skyTop: '#321d3c', skyHorizon: '#f58b68', sun: '#ffe1a0',
      sea: '#a54f52', seaDeep: '#3e2444',
      far: '#a77b83', mid: '#704650', near: '#422b3b', glow: '#ffb17a'
    },
    {
      name: 'REINO DE LAS AURORAS',
      skyTop: '#071d3b', skyHorizon: '#52b9bc', sun: '#d8fff1',
      sea: '#2a9fae', seaDeep: '#0a2949',
      far: '#8eb8c7', mid: '#436e87', near: '#18364e', glow: '#8bffe1'
    }
  ];

  function getWorldPalette(progress) {
    const position = clamp(progress, 0, 1) * (WORLD_REGIONS.length - 1);
    const index = Math.floor(position);
    const from = WORLD_REGIONS[index];
    const to = WORLD_REGIONS[Math.min(index + 1, WORLD_REGIONS.length - 1)];
    const blend = position - index;
    return {
      name: WORLD_REGIONS[Math.min(Math.floor(progress * WORLD_REGIONS.length), WORLD_REGIONS.length - 1)].name,
      skyTop: mixHex(from.skyTop, to.skyTop, blend),
      skyHorizon: mixHex(from.skyHorizon, to.skyHorizon, blend),
      sun: mixHex(from.sun, to.sun, blend),
      sea: mixHex(from.sea, to.sea, blend),
      seaDeep: mixHex(from.seaDeep, to.seaDeep, blend),
      far: mixHex(from.far, to.far, blend),
      mid: mixHex(from.mid, to.mid, blend),
      near: mixHex(from.near, to.near, blend),
      glow: mixHex(from.glow, to.glow, blend)
    };
  }

  function startFly() {
    if (!isOpen || mission.active) return;
    const d = cur();
    if (d.energy < 22) {
      setHint(short(active) + ' no tiene energía para volar. Descansad.', 'is-warn', 4);
      snd(() => dg.sfx.hit());
      return;
    }

    d.energy = clamp(d.energy - 22, 0, MAX);

    mission.active = true;
    mission.dragon = active;
    mission.t = 0;
    mission.distance = 0;
    mission.speed = 148;
    mission.y = 140;
    mission.vy = 0;
    mission.flap = false;
    mission.lastFlap = -1;
    mission.fish = 0;
    mission.rings = 0;
    mission.hits = 0;
    mission.invuln = 0;
    mission.shake = 0;
    mission.parts = [];
    mission.rocks = [];
    mission.fishes = [];
    mission.ringsArr = [];
    mission.spawnRock = 1.5;
    mission.spawnFish = 0.5;
    mission.spawnRing = 2.4;
    mission.title = pick(FLY_TITLES[active]);

    ui.flyTitle.textContent = mission.title;
    ui.flySub.textContent = active === 'toothless'
      ? 'Chimuelo recorrerá cuatro regiones. Recoge peces, cruza los aros y esquiva las rocas.'
      : 'La Furia Luminosa recorrerá cuatro regiones. Recoge peces, cruza los aros y esquiva las rocas.';
    ui.flyModal.hidden = false;
    ui.flyModal.classList.add('is-open');
    refreshUI();
    save();
    snd(() => dg.sfx.flap());
    drawMission();
  }

  function flyFlap() {
    if (!mission.active) return;
    const now = mission.t;
    if (now - mission.lastFlap < 0.1) return;
    mission.lastFlap = now;
    mission.vy = -168;
    mission.flap = true;
    snd(() => dg.sfx.flap());
  }

  function spawnRockMission() {
    const tall = Math.random() < 0.3;
    const y = rand(56, 190);
    mission.rocks.push({
      x: W + 30, y, w: tall ? 26 : 20, h: tall ? 40 : 24,
      seed: Math.random()
    });
    if (tall) {
      const y2 = y > 130 ? rand(50, 92) : rand(150, 190);
      mission.rocks.push({ x: W + 30, y: y2, w: 20, h: 24, seed: Math.random() });
    }
  }

  function spawnFishMission() {
    const base = rand(60, 190);
    mission.fishes.push({ x: W + 20, y: base, ph: rand(0, 6.28) });
    if (Math.random() < 0.5) mission.fishes.push({ x: W + 42, y: base + rand(-24, 24), ph: rand(0, 6.28) });
  }

  function spawnRingMission() {
    mission.ringsArr.push({ x: W + 40, y: rand(70, 190), passed: false, r: 26 });
  }

  function missionBurst(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      mission.parts.push({
        x, y,
        vx: rand(-70, 30),
        vy: rand(-60, 60),
        life: rand(0.4, 0.9),
        max: 0.9,
        color,
        s: Math.random() < 0.5 ? 2 : 3
      });
    }
  }

  function updateMission(dt) {
    if (!mission.active) return;

    mission.t += dt;
    const progress = clamp(mission.distance / GOAL, 0, 1);
    mission.speed = 148 + progress * 96;
    mission.distance += mission.speed * dt;

    mission.vy += 380 * dt;
    mission.y += mission.vy * dt;
    if (mission.y < 36) { mission.y = 36; mission.vy = Math.max(0, mission.vy); }
    if (mission.y > 208) { mission.y = 208; mission.vy = Math.min(0, mission.vy); }
    mission.flap = false;

    if (mission.invuln > 0) mission.invuln -= dt;
    if (mission.shake > 0) mission.shake = Math.max(0, mission.shake - dt * 18);

    mission.spawnRock -= dt;
    if (mission.spawnRock <= 0) {
      mission.spawnRock = rand(1.55, 2.15) - progress * 0.2;
      spawnRockMission();
    }
    mission.spawnFish -= dt;
    if (mission.spawnFish <= 0) {
      mission.spawnFish = rand(0.75, 1.3);
      spawnFishMission();
    }
    mission.spawnRing -= dt;
    if (mission.spawnRing <= 0) {
      mission.spawnRing = rand(2.4, 3.4);
      spawnRingMission();
    }

    const dx = 104;
    const dy = mission.y;
    const speed = mission.speed;

    for (const r of mission.rocks) r.x -= speed * dt;
    for (const f of mission.fishes) f.x -= speed * dt;
    for (const r of mission.ringsArr) r.x -= speed * dt;

    for (const r of mission.rocks) {
      if (mission.invuln > 0) break;
      if (Math.abs(r.x - dx) < (r.w / 2 + 13) && Math.abs(r.y - dy) < (r.h / 2 + 9)) {
        mission.hits += 1;
        mission.invuln = 1.35;
        mission.shake = 5;
        mission.vy = -110;
        missionBurst(dx, dy, '#ff8a6b', 12);
        snd(() => dg.sfx.hit());
        break;
      }
    }

    for (const f of mission.fishes) {
      if (f.dead) continue;
      if (Math.abs(f.x - dx) < 20 && Math.abs(f.y - dy) < 16) {
        f.dead = true;
        mission.fish += 1;
        missionBurst(f.x, f.y, '#ffd166', 6);
        snd(() => dg.sfx.gem(2));
      }
    }

    for (const r of mission.ringsArr) {
      if (r.passed || r.x > dx) continue;
      r.passed = true;
      if (Math.abs(r.y - dy) < r.r + 2) {
        mission.rings += 1;
        mission.fish += 1;
        missionBurst(dx, r.y, '#9af3ff', 10);
        snd(() => dg.sfx.gem(5));
      }
    }

    for (const p of mission.parts) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx -= 40 * dt;
      p.life -= dt;
    }

    mission.parts = mission.parts.filter((p) => p.life > 0);
    mission.rocks = mission.rocks.filter((r) => r.x > -40);
    mission.fishes = mission.fishes.filter((f) => f.x > -30 && !f.dead);
    mission.ringsArr = mission.ringsArr.filter((r) => r.x > -40);

    if (mission.hits >= 5) {
      finishMission(false);
      return;
    }
    if (mission.distance >= GOAL) finishMission(true);
  }

  function drawMissionDragon(g, id, x, y, t, vy) {
    const th = THEMES[id];
    const tilt = clamp(vy / 520, -0.32, 0.42);
    const flap = Math.sin(t * 10);

    g.save();
    g.translate(x, y);
    g.rotate(tilt);

    const bodyShade = g.createLinearGradient(-2, -13, 7, 11);
    bodyShade.addColorStop(0, th.edge);
    bodyShade.addColorStop(0.38, th.body);
    bodyShade.addColorStop(1, th.dark);
    const wingShade = g.createLinearGradient(-8, -30, 12, 0);
    wingShade.addColorStop(0, th.edge);
    wingShade.addColorStop(0.5, id === 'light' ? th.fin : th.spike);
    wingShade.addColorStop(1, th.dark);
    const shadow = g.createRadialGradient(-4, 28, 1, -4, 28, 35);
    shadow.addColorStop(0, 'rgba(7,15,28,0.3)');
    shadow.addColorStop(1, 'rgba(7,15,28,0)');
    g.fillStyle = shadow;
    g.beginPath();
    g.ellipse(-4, 28, 35, 9, 0, 0, Math.PI * 2);
    g.fill();

    /* cola */
    g.strokeStyle = th.dark;
    g.lineWidth = 6;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(-16, 0);
    g.bezierCurveTo(-30, 2, -38, -6, -50, -4);
    g.stroke();
    g.save();
    g.translate(-50, -4);
    g.fillStyle = th.fin;
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(-8, -8);
    g.lineTo(-13, 0);
    g.lineTo(-8, 6);
    g.closePath();
    g.fill();
    g.restore();

    /* ala lejana */
    g.fillStyle = th.dark;
    g.beginPath();
    g.moveTo(-2, -2);
    g.quadraticCurveTo(-16, -20 - flap * 9, 6, -26 - flap * 11);
    g.quadraticCurveTo(15, -14 - flap * 5, 17, -2);
    g.closePath();
    g.fill();

    /* cuerpo */
    g.fillStyle = bodyShade;
    g.beginPath();
    g.ellipse(0, 0, 21, 9, -0.06, 0, Math.PI * 2);
    g.fill();
    const bellyShade = g.createLinearGradient(0, 0, 0, 9);
    bellyShade.addColorStop(0, th.belly);
    bellyShade.addColorStop(1, th.edge);
    g.fillStyle = bellyShade;
    g.beginPath();
    g.ellipse(2, 4, 14, 4.5, 0, 0, Math.PI * 2);
    g.fill();

    /* cabeza */
    g.fillStyle = bodyShade;
    g.beginPath();
    g.ellipse(21, -4, 10, 8, 0, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.ellipse(29, -2, 8, 5.5, 0, 0, Math.PI * 2);
    g.fill();

    g.fillStyle = id === 'light' ? th.fin : th.dark;
    g.beginPath();
    g.moveTo(16, -10);
    g.lineTo(12, -20);
    g.lineTo(21, -13);
    g.closePath();
    g.fill();

    g.fillStyle = th.eye;
    g.beginPath();
    g.ellipse(23, -7, 3.6, 3.2, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = th.pupil;
    g.fillRect(22, -9, 2, 4);

    /* ala cercana */
    g.fillStyle = wingShade;
    g.beginPath();
    g.moveTo(0, -1);
    g.quadraticCurveTo(-12, -26 - flap * 10, 10, -30 - flap * 12);
    g.quadraticCurveTo(19, -16 - flap * 6, 19, -1);
    g.closePath();
    g.fill();
    g.strokeStyle = hexA(th.edge, 0.7);
    g.lineWidth = 1;
    g.stroke();

    g.restore();
  }

  function drawCloud(g, x, y, scale, color, alpha) {
    g.save();
    g.globalAlpha = alpha;
    g.fillStyle = color;
    g.beginPath();
    g.ellipse(x, y, 34 * scale, 7 * scale, 0, 0, Math.PI * 2);
    g.ellipse(x - 15 * scale, y - 4 * scale, 17 * scale, 10 * scale, 0, 0, Math.PI * 2);
    g.ellipse(x + 2 * scale, y - 8 * scale, 19 * scale, 13 * scale, 0, 0, Math.PI * 2);
    g.ellipse(x + 20 * scale, y - 3 * scale, 18 * scale, 9 * scale, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  function drawIsland(g, x, base, width, height, palette, detail) {
    g.save();
    g.translate(x, base);
    g.fillStyle = palette;
    g.beginPath();
    g.moveTo(-width * 0.62, 2);
    g.lineTo(-width * 0.28, -height * 0.66);
    g.lineTo(-width * 0.12, -height);
    g.lineTo(width * 0.02, -height * 0.56);
    g.lineTo(width * 0.2, -height * 0.82);
    g.lineTo(width * 0.36, -height * 0.38);
    g.lineTo(width * 0.62, 2);
    g.closePath();
    g.fill();

    g.globalAlpha = 0.24;
    g.fillStyle = detail;
    g.beginPath();
    g.moveTo(-width * 0.28, -height * 0.66);
    g.lineTo(-width * 0.12, -height);
    g.lineTo(width * 0.02, -height * 0.56);
    g.lineTo(width * 0.2, -height * 0.82);
    g.lineTo(width * 0.36, -height * 0.38);
    g.lineTo(width * 0.05, -height * 0.52);
    g.lineTo(-width * 0.08, -height * 0.4);
    g.closePath();
    g.fill();
    g.restore();
  }

  function drawMission() {
    const g = fctx;
    const t = mission.t;
    const shake = mission.shake;
    const progress = clamp(mission.distance / GOAL, 0, 1);
    const palette = getWorldPalette(progress);
    const horizon = 187;

    g.save();
    if (shake > 0) g.translate(rand(-shake, shake), rand(-shake, shake));

    const sky = g.createLinearGradient(0, 0, 0, horizon + 28);
    sky.addColorStop(0, palette.skyTop);
    sky.addColorStop(0.58, palette.skyHorizon);
    sky.addColorStop(1, palette.glow);
    g.fillStyle = sky;
    g.fillRect(-10, -10, W + 20, horizon + 40);

    const sunX = 362;
    const sunY = 119 + Math.sin(t * 0.16) * 2;
    const sun = g.createRadialGradient(sunX, sunY, 8, sunX, sunY, 96);
    sun.addColorStop(0, hexA(palette.sun, 0.64));
    sun.addColorStop(0.38, hexA(palette.glow, 0.24));
    sun.addColorStop(1, hexA(palette.glow, 0));
    g.fillStyle = sun;
    g.fillRect(sunX - 100, sunY - 100, 200, 200);

    g.fillStyle = palette.sun;
    g.beginPath();
    g.arc(sunX, sunY, 21, 0, Math.PI * 2);
    g.fill();

    for (let i = 0; i < 7; i++) {
      const speed = 0.035 + (i % 3) * 0.018;
      const x = ((i * 113 - mission.distance * speed) % (W + 180) + W + 180) % (W + 180) - 90;
      const y = 31 + (i % 4) * 22;
      const scale = 0.54 + (i % 3) * 0.2;
      drawCloud(g, x, y, scale, palette.sun, 0.07 + (i % 2) * 0.035);
    }

    for (let i = 0; i < 5; i++) {
      const width = 126 + (i % 2) * 28;
      const x = ((i * 132 - mission.distance * 0.12) % (W + width) + W + width) % (W + width) - width * 0.5;
      drawIsland(g, x, horizon + 13, width, 38 + (i % 3) * 13, palette.far, palette.sun);
    }

    for (let i = 0; i < 4; i++) {
      const width = 102 + (i % 2) * 30;
      const x = ((i * 174 - mission.distance * 0.28) % (W + width) + W + width) % (W + width) - width * 0.5;
      drawIsland(g, x, horizon + 23, width, 26 + (i % 3) * 12, palette.mid, palette.glow);
    }

    const sea = g.createLinearGradient(0, horizon, 0, H);
    sea.addColorStop(0, palette.sea);
    sea.addColorStop(0.35, mixHex(palette.sea, palette.seaDeep, 0.42));
    sea.addColorStop(1, palette.seaDeep);
    g.fillStyle = sea;
    g.fillRect(-10, horizon, W + 20, H - horizon);

    const reflection = g.createLinearGradient(0, horizon, 0, H);
    reflection.addColorStop(0, hexA(palette.sun, 0.34));
    reflection.addColorStop(1, hexA(palette.sun, 0));
    g.fillStyle = reflection;
    g.beginPath();
    g.moveTo(sunX - 8, horizon);
    g.lineTo(sunX + 8, horizon);
    g.lineTo(sunX + 90, H);
    g.lineTo(sunX - 90, H);
    g.closePath();
    g.fill();

    for (let i = 0; i < 23; i++) {
      const depth = (i + 1) / 24;
      const y = horizon + 5 + depth * depth * 76;
      const span = 5 + depth * 56 + Math.sin(t * 1.7 + i) * (2 + depth * 3);
      const offset = Math.sin(t * 0.7 + i * 1.8) * (8 + depth * 20);
      g.globalAlpha = 0.07 + (1 - depth) * 0.12;
      g.strokeStyle = i % 3 === 0 ? palette.sun : '#d6f5f2';
      g.lineWidth = 0.5 + depth * 1.2;
      g.beginPath();
      g.moveTo(sunX + offset - span, y);
      g.lineTo(sunX + offset + span, y);
      g.stroke();
    }
    g.globalAlpha = 1;

    const cliffShift = (mission.distance * 0.72) % 120;
    for (let side = 0; side < 2; side++) {
      const x = side === 0 ? -54 - cliffShift : W + 54 - cliffShift;
      const base = H + 10;
      const width = 138;
      const height = 68 + (Math.floor(mission.distance / 190) % 3) * 13;
      const cliff = g.createLinearGradient(x, base - height, x + width, base);
      cliff.addColorStop(0, palette.mid);
      cliff.addColorStop(0.45, palette.near);
      cliff.addColorStop(1, palette.seaDeep);
      g.fillStyle = cliff;
      g.beginPath();
      g.moveTo(x - width * 0.55, base);
      g.lineTo(x - width * 0.22, base - height * 0.52);
      g.lineTo(x + width * 0.08, base - height);
      g.lineTo(x + width * 0.34, base - height * 0.64);
      g.lineTo(x + width * 0.7, base - height * 0.78);
      g.lineTo(x + width * 1.1, base);
      g.closePath();
      g.fill();
      g.globalAlpha = 0.32;
      g.strokeStyle = palette.glow;
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(x - width * 0.22, base - height * 0.52);
      g.lineTo(x + width * 0.08, base - height);
      g.lineTo(x + width * 0.34, base - height * 0.64);
      g.stroke();
      g.globalAlpha = 1;
    }

    const vignette = g.createRadialGradient(W / 2, H * 0.42, 72, W / 2, H * 0.42, 310);
    vignette.addColorStop(0, 'rgba(5,12,28,0)');
    vignette.addColorStop(1, 'rgba(5,12,28,0.32)');
    g.fillStyle = vignette;
    g.fillRect(0, 0, W, H);

    /* aros */
    for (const r of mission.ringsArr) {
      g.save();
      const ringColor = r.passed ? 'rgba(255,209,102,0.25)' : palette.sun;
      g.shadowColor = r.passed ? 'transparent' : palette.glow;
      g.shadowBlur = r.passed ? 0 : 10;
      g.strokeStyle = ringColor;
      g.lineWidth = 3;
      g.beginPath();
      g.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      g.stroke();
      if (!r.passed) {
        g.shadowBlur = 0;
        g.strokeStyle = 'rgba(255,255,255,0.58)';
        g.lineWidth = 1;
        g.beginPath();
        g.arc(r.x, r.y, r.r - 4, 0, Math.PI * 2);
        g.stroke();
      }
      g.restore();
    }

    /* peces */
    for (const f of mission.fishes) {
      const yy = f.y + Math.sin(t * 3 + f.ph) * 3;
      const fishShade = g.createLinearGradient(f.x, yy - 4, f.x, yy + 4);
      fishShade.addColorStop(0, '#fff3bb');
      fishShade.addColorStop(0.55, '#ffc45e');
      fishShade.addColorStop(1, '#d98244');
      g.fillStyle = fishShade;
      g.beginPath();
      g.ellipse(f.x, yy, 7, 4, 0, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.moveTo(f.x - 6, yy);
      g.lineTo(f.x - 13, yy - 5);
      g.lineTo(f.x - 13, yy + 5);
      g.closePath();
      g.fill();
      g.fillStyle = '#3a1c1c';
      g.fillRect(f.x + 3, yy - 1, 2, 2);
    }

    /* roca */
    for (const r of mission.rocks) {
      const rockShade = g.createLinearGradient(r.x - r.w / 2, r.y - r.h / 2, r.x + r.w / 2, r.y + r.h / 2);
      rockShade.addColorStop(0, palette.far);
      rockShade.addColorStop(0.42, palette.mid);
      rockShade.addColorStop(1, palette.near);
      g.fillStyle = rockShade;
      g.beginPath();
      g.moveTo(r.x - r.w / 2, r.y + r.h / 2);
      g.lineTo(r.x - r.w / 2 + 3, r.y - r.h / 3);
      g.lineTo(r.x - 2, r.y - r.h / 2);
      g.lineTo(r.x + r.w / 3, r.y - r.h / 3);
      g.lineTo(r.x + r.w / 2, r.y + r.h / 3);
      g.closePath();
      g.fill();
      g.fillStyle = hexA(palette.glow, 0.22);
      g.beginPath();
      g.moveTo(r.x - r.w / 2 + 3, r.y - r.h / 3);
      g.lineTo(r.x - 2, r.y - r.h / 2);
      g.lineTo(r.x + r.w / 3, r.y - r.h / 3);
      g.lineTo(r.x, r.y - r.h / 8);
      g.closePath();
      g.fill();
    }

    /* partículas */
    for (const p of mission.parts) {
      g.globalAlpha = clamp(p.life / p.max, 0, 1);
      g.fillStyle = p.color;
      g.fillRect(p.x | 0, p.y | 0, p.s, p.s);
    }
    g.globalAlpha = 1;

    /* dragón */
    if (!(mission.invuln > 0 && Math.floor(mission.t * 12) % 2 === 0)) {
      drawMissionDragon(g, mission.dragon, 104, mission.y, t, mission.vy);
    }

    g.restore();

    /* HUD */
    g.font = '8px "Press Start 2P", monospace';
    g.textAlign = 'left';
    g.textBaseline = 'top';
    g.fillStyle = 'rgba(0,0,0,0.55)';
    g.fillText('PECES ' + mission.fish, 13, 13);
    g.fillStyle = '#ffe9c9';
    g.fillText('PECES ' + mission.fish, 12, 12);
    g.font = '6px "Press Start 2P", monospace';
    g.fillStyle = 'rgba(6,16,30,0.68)';
    g.fillText(palette.name, 13, 28);
    g.fillStyle = '#ffffff';
    g.fillText(palette.name, 12, 27);
    g.font = '5px "Press Start 2P", monospace';
    g.fillStyle = 'rgba(255,255,255,0.76)';
    g.fillText((progress * 100 | 0) + '%  ·  ' + (mission.distance / 1000).toFixed(1) + ' KM', 12, 39);

    g.fillStyle = 'rgba(0,0,0,0.5)';
    g.fillRect(W - 142, 12, 130, 8);
    const pr = clamp(mission.distance / GOAL, 0, 1);
    g.fillStyle = '#ffd166';
    g.fillRect(W - 142, 12, 130 * pr, 8);
    g.strokeStyle = 'rgba(255,233,201,0.4)';
    g.lineWidth = 1;
    g.strokeRect(W - 142.5, 11.5, 131, 9);

    for (let i = 0; i < 5; i++) {
      g.fillStyle = i < 5 - mission.hits ? '#ff6f91' : 'rgba(20,10,26,0.75)';
      const hx = W - 142 + i * 10;
      const hy = 26;
      g.fillRect(hx, hy, 6, 3);
      g.fillRect(hx - 2, hy - 2, 3, 3);
      g.fillRect(hx + 5, hy - 2, 3, 3);
      g.fillRect(hx + 1, hy + 3, 4, 2);
    }
  }

  function finishMission(complete) {
    if (!mission.active) return;
    mission.active = false;

    const d = S.dragons[mission.dragon];
    const caught = mission.fish;
    const rings = mission.rings;
    const bonus = complete ? 6 : 2;
    const totalFish = caught + bonus;
    S.fish = clamp(S.fish + totalFish, 0, 999);
    d.mood = clamp(d.mood + (complete ? 10 : 4), 0, MAX);
    const bond = gainBond(mission.dragon, (complete ? 3.2 : 1.2) + rings * 0.5);
    tick(0.6);

    ui.flyModal.hidden = true;
    ui.flyModal.classList.remove('is-open');

    const who = capName(mission.dragon);
    const title = complete
      ? (rings >= 3 ? '¡VUELO PERFECTO!' : '¡BUEN VUELO!')
      : 'VUELO INTERRUMPIDO';
    const text = complete
      ? who + (mission.dragon === 'toothless' ? ' aterriza orgulloso con ' : ' aterriza orgullosa con ') + totalFish + ' peces en la cesta. El vínculo se fortalece.'
      : who + ' se ha cansado y vuelve al santuario con ' + totalFish + ' peces. Descansad y volved a intentarlo.';

    showResult({
      eyebrow: complete ? '◆ misión completada ◆' : '◆ misión interrumpida ◆',
      title,
      cells: [
        { label: 'PECES', value: '+' + totalFish },
        { label: 'AROS', value: String(rings) },
        { label: 'VÍNCULO', value: '+' + (Math.round(bond * 10) / 10) + '%' },
        { label: 'DISTANCIA', value: (mission.distance / 1000).toFixed(1) + ' km' }
      ],
      text
    });

    refreshUI();
    save();
    snd(() => (complete ? dg.sfx.zone() : dg.sfx.over()));
  }

  function abortMission(silent) {
    if (!mission.active) return;
    mission.active = false;
    const d = S.dragons[mission.dragon];
    d.energy = clamp(d.energy + 11, 0, MAX);
    ui.flyModal.hidden = true;
    ui.flyModal.classList.remove('is-open');
    if (!silent) {
      setHint('Vuelo cancelado. Habéis recuperado parte de la energía.', '', 3.5);
      snd(() => dg.sfx.click());
      refreshUI();
      save();
    }
  }

  /* ---------------- eventos ---------------- */
  ui.btnAdventure.addEventListener('click', () => {
    open();
  });

  ui.close.addEventListener('click', closeAdventure);
  ui.mute.addEventListener('click', () => {
    dg.sfx.init();
    dg.toggleMute();
    syncMute();
  });

  ui.pickToothless.addEventListener('click', () => selectDragon('toothless'));
  ui.pickLight.addEventListener('click', () => selectDragon('light'));

  ui.feed.addEventListener('click', feed);
  ui.pet.addEventListener('click', pet);
  ui.train.addEventListener('click', startTrain);
  ui.fly.addEventListener('click', startFly);
  ui.rest.addEventListener('click', rest);

  ui.trainHit.addEventListener('click', trainPress);
  ui.trainCancel.addEventListener('click', () => cancelTrain(false));
  ui.flyFlap.addEventListener('click', flyFlap);
  ui.flyAbort.addEventListener('click', () => abortMission(false));
  ui.resultClose.addEventListener('click', () => closeResult(false));

  ui.flyCanvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    flyFlap();
  });

  /* clic sobre un dragón de la escena para elegirlo */
  ui.scene.addEventListener('click', (e) => {
    if (mission.active) return;
    const rect = ui.scene.getBoundingClientRect();
    if (!rect.width) return;
    const x = (e.clientX - rect.left) * (W / rect.width);
    const y = (e.clientY - rect.top) * (H / rect.height);
    const near = (hx, hy) => Math.hypot(x - hx, y - hy) < 58;
    if (near(196, 134)) selectDragon('toothless');
    else if (near(286, 134)) selectDragon('light');
  });

  const KEYS = [
    'Space', 'Enter', 'Escape', 'ArrowUp', 'ArrowDown', 'KeyW', 'KeyS',
    'KeyX', 'KeyK', 'KeyZ', 'KeyJ', 'KeyP', 'KeyM', 'KeyA', 'KeyR'
  ];

  window.addEventListener('keydown', (e) => {
    if (!isOpen) return;
    const code = e.code;
    if (!KEYS.includes(code)) return;

    const onButton = e.target && e.target.tagName === 'BUTTON';
    const idle = !mission.active && !train.active && !resultOpen;
    if (idle && onButton && (code === 'Space' || code === 'Enter')) {
      e.stopPropagation();
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    if (e.repeat) return;

    if (mission.active) {
      if (code === 'Space' || code === 'ArrowUp' || code === 'KeyW') flyFlap();
      else if (code === 'Escape') abortMission(false);
      return;
    }
    if (train.active) {
      if (code === 'Space' || code === 'Enter' || code === 'ArrowUp' || code === 'KeyW') trainPress();
      else if (code === 'Escape') cancelTrain(false);
      return;
    }
    if (resultOpen) {
      if (code === 'Escape' || code === 'Space' || code === 'Enter') closeResult(false);
      return;
    }

    if (code === 'Escape') closeAdventure();
    else if (code === 'KeyM') {
      dg.sfx.init();
      dg.toggleMute();
      syncMute();
    } else if (code === 'KeyA') feed();
    else if (code === 'KeyR') rest();
    else if (code === 'ArrowDown' || code === 'KeyS') selectDragon(active === 'toothless' ? 'light' : 'toothless');
  }, true);

  window.addEventListener('beforeunload', save);

  /* ---------------- arranque ---------------- */
  refreshUI();
  syncMute();

  window.dragonAdventure = {
    open,
    close: closeAdventure,
    save,
    refreshUI,
    selectDragon,
    feed,
    pet,
    rest,
    startTrain,
    trainPress,
    finishTrain,
    cancelTrain,
    startFly,
    flyFlap,
    finishMission,
    abortMission,
    showResult,
    closeResult,
    step(dt) {
      if (mission.active) {
        updateMission(dt);
        drawMission();
      } else {
        updateIdle(dt);
        updateTrain(dt);
        drawScene(dt);
        updateFx(dt);
        drawFx();
      }
    },
    get state() { return S; },
    get active() { return active; },
    get train() { return train; },
    get mission() { return mission; },
    get isOpen() { return isOpen; }
  };
})();
