/* ============================================================
   DRAGÓN DE FUEGO — arcade endless flyer
   Canvas interno 480x270, escalado nearest-neighbor.
   ============================================================ */
(() => {
  'use strict';

  /* ---------------- configuración ---------------- */
  const VW = 480;
  const VH = 270;
  const GROUND = 246;

  const CFG = {
    gravity: 760,
    flap: -228,
    maxFall: 330,
    scrollStart: 84,
    scrollMax: 214,
    fireCost: 26,
    fireRegen: 15,
    invuln: 1.6,
    zoneLength: 420,
    maxHearts: 3
  };

  /* ---------------- utilidades ---------------- */
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);
  const randInt = (a, b) => Math.floor(rand(a, b + 1));
  const hit = (a, b) =>
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  const hexToRgb = (h) => {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const rgb = (c) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
  const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
  const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

  const store = {
    get(k, d) {
      try {
        const v = localStorage.getItem(k);
        return v === null ? d : v;
      } catch (e) {
        return d;
      }
    },
    set(k, v) {
      try {
        localStorage.setItem(k, v);
      } catch (e) { /* modo privado */ }
    }
  };

  /* ---------------- zonas / paletas ---------------- */
  const ZONES = [
    {
      name: 'VALLE DE BRASA',
      sky: ['#1a0f2e', '#4a1d4f'],
      far: '#2a1745', mid: '#3d1f54', near: '#22102f', rock: '#1a0c26',
      star: '#ffe9b0', accent: '#ff8f3f', ember: false
    },
    {
      name: 'CANON DE CENIZA',
      sky: ['#071226', '#0d3345'],
      far: '#0c2338', mid: '#123a48', near: '#08161f', rock: '#0a151f',
      star: '#bfe9ff', accent: '#5fd6c8', ember: false
    },
    {
      name: 'CRATER DEL DRAGON',
      sky: ['#1c0507', '#4a130d'],
      far: '#2a0a0c', mid: '#45130f', near: '#1c0608', rock: '#160406',
      star: '#ffb08a', accent: '#ff5a2b', ember: true
    },
    {
      name: 'AURORA HELADA',
      sky: ['#04121a', '#0b3a3a'],
      far: '#0a2a33', mid: '#0f4048', near: '#061a1f', rock: '#081418',
      star: '#c8ffe8', accent: '#7df2c8', ember: false
    }
  ];

  const zonePal = (z) => ({
    sky0: hexToRgb(z.sky[0]),
    sky1: hexToRgb(z.sky[1]),
    far: hexToRgb(z.far),
    mid: hexToRgb(z.mid),
    near: hexToRgb(z.near),
    rock: hexToRgb(z.rock),
    star: hexToRgb(z.star),
    accent: hexToRgb(z.accent)
  });

  const clonePal = (p) => ({ ...p });

  const mixPal = (a, b, t) => {
    const o = {};
    for (const k in a) o[k] = mix(a[k], b[k], t);
    return o;
  };

  /* ---------------- audio (WebAudio, sin archivos) ---------------- */
  const sfx = {
    ctx: null,
    master: null,
    noiseBuf: null,
    muted: store.get('dragon.muted', '0') === '1',

    init() {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!this.ctx) {
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.55;
        this.master.connect(this.ctx.destination);

        const len = Math.floor(this.ctx.sampleRate * 0.6);
        const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
        this.noiseBuf = buf;
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    },

    setMuted(m) {
      this.muted = m;
      store.set('dragon.muted', m ? '1' : '0');
      if (this.master) {
        this.master.gain.setTargetAtTime(m ? 0 : 0.55, this.ctx.currentTime, 0.02);
      }
    },

    tone(freq, dur, opt = {}) {
      if (this.muted) return;
      this.init();
      if (!this.ctx) return;
      const { type = 'square', vol = 0.16, slide = 0, delay = 0 } = opt;
      const t0 = this.ctx.currentTime + delay;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      if (slide) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
      }
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g);
      g.connect(this.master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.03);
    },

    noise(dur, vol = 0.12, freq = 1400, delay = 0) {
      if (this.muted) return;
      this.init();
      if (!this.ctx || !this.noiseBuf) return;
      const t0 = this.ctx.currentTime + delay;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = freq;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(vol, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(filter);
      filter.connect(g);
      g.connect(this.master);
      src.start(t0);
      src.stop(t0 + dur + 0.03);
    },

    flap() {
      this.noise(0.08, 0.1, 700);
      this.tone(185, 0.09, { type: 'triangle', vol: 0.08, slide: -90 });
    },
    fire() {
      this.tone(560, 0.16, { type: 'sawtooth', vol: 0.11, slide: -400 });
      this.noise(0.14, 0.09, 2000);
    },
    gem(combo) {
      const base = 620 + combo * 70;
      this.tone(base, 0.055, { type: 'square', vol: 0.085 });
      this.tone(base * 1.5, 0.08, { type: 'square', vol: 0.075, delay: 0.05 });
    },
    heart() {
      [523, 659, 784, 1046].forEach((f, i) =>
        this.tone(f, 0.1, { type: 'triangle', vol: 0.09, delay: i * 0.055 })
      );
    },
    hit() {
      this.tone(170, 0.26, { type: 'sawtooth', vol: 0.15, slide: -120 });
      this.noise(0.2, 0.16, 750);
    },
    enemy() {
      this.tone(300, 0.09, { type: 'square', vol: 0.1, slide: -170 });
      this.noise(0.08, 0.09, 2600);
    },
    over() {
      [392, 330, 262, 175].forEach((f, i) =>
        this.tone(f, 0.26, { type: 'square', vol: 0.12, delay: i * 0.16 })
      );
    },
    zone() {
      [523, 659, 784, 1046].forEach((f, i) =>
        this.tone(f, 0.13, { type: 'triangle', vol: 0.08, delay: i * 0.075 })
      );
    },
    click() {
      this.tone(900, 0.045, { type: 'square', vol: 0.06 });
    }
  };

  /* ---------------- lienzo ---------------- */
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  canvas.width = VW;
  canvas.height = VH;
  ctx.imageSmoothingEnabled = false;

  /* ---------------- entrada ---------------- */
  const input = { flap: false, fire: false };

  const els = {
    title: document.getElementById('screenTitle'),
    pause: document.getElementById('screenPause'),
    over: document.getElementById('screenOver'),
    titleBest: document.getElementById('titleBest'),
    overScore: document.getElementById('overScore'),
    overDist: document.getElementById('overDist'),
    overBest: document.getElementById('overBest'),
    newRecord: document.getElementById('newRecord'),
    footBest: document.getElementById('footBest'),
    btnPause: document.getElementById('btnPause'),
    btnMute: document.getElementById('btnMute'),
    btnFlap: document.getElementById('btnFlap'),
    btnFire: document.getElementById('btnFire')
  };

  /* ---------------- estado ---------------- */
  const game = {
    state: 'title',
    stateTime: 0,
    time: 0,
    scrollX: 0,
    speed: CFG.scrollStart,
    distance: 0,
    score: 0,
    best: parseInt(store.get('dragon.best', '0'), 10) || 0,
    isRecord: false,
    hearts: CFG.maxHearts,
    furia: 100,
    combo: 1,
    comboTimer: 0,
    zone: 0,
    zoneFrom: zonePal(ZONES[0]),
    zoneTo: zonePal(ZONES[0]),
    zoneMix: 1,
    pal: zonePal(ZONES[0]),
    banner: 0,
    bannerText: '',
    shake: 0,
    flash: 0,
    spawnTimer: 1.2,
    enemyTimer: 4.5,
    gemTimer: 2.2,
    lastGapY: 132,
    overShown: false,
    player: null,
    obstacles: [],
    enemies: [],
    gems: [],
    fireballs: [],
    particles: [],
    floaters: [],
    embers: []
  };

  const stars = Array.from({ length: 72 }, () => ({
    x: Math.random() * VW,
    y: 12 + Math.random() * 178,
    s: Math.random() < 0.82 ? 1 : 2,
    tw: rand(0.6, 2.1),
    ph: rand(0, 6.28)
  }));

  /* ---------------- condiciones de aparición ---------------- */
  function obRects(ob) {
    if (ob.type === 'gate') {
      return [
        { x: ob.x, y: 0, w: ob.w, h: ob.topH },
        { x: ob.x, y: GROUND - ob.botH, w: ob.w, h: ob.botH }
      ];
    }
    return [{ x: ob.x, y: ob.y, w: ob.w, h: ob.h }];
  }

  function spawnClear(x, y, w, h) {
    const r = { x, y, w, h };
    for (const ob of game.obstacles) {
      for (const o of obRects(ob)) {
        if (hit(r, { x: o.x - 8, y: o.y - 8, w: o.w + 16, h: o.h + 16 })) return false;
      }
    }
    return true;
  }

  /* ---------------- efectos ---------------- */
  function explode(x, y, color, n = 12, spread = 130, gravity = 140) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const sp = rand(18, spread);
      game.particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: rand(0.25, 0.7),
        max: 0.7,
        color,
        size: rand(1, 3),
        grav: gravity
      });
    }
  }

  function floater(x, y, text, color) {
    game.floaters.push({ x, y, text, color, life: 0.9, max: 0.9 });
  }

  function dust(x, y) {
    for (let i = 0; i < 6; i++) {
      game.particles.push({
        x: x + rand(-8, 8),
        y,
        vx: rand(-40, 20),
        vy: rand(-70, -20),
        life: rand(0.2, 0.45),
        max: 0.45,
        color: '#c9a27a',
        size: rand(1, 2),
        grav: 240
      });
    }
  }

  /* ---------------- pantallas ---------------- */
  const pad6 = (n) => String(Math.max(0, Math.floor(n))).padStart(6, '0');

  function show(el) { el.classList.add('is-open'); }
  function hide(el) { el.classList.remove('is-open'); }
  function hideAllScreens() { hide(els.title); hide(els.pause); hide(els.over); }

  function refreshBest() {
    els.titleBest.textContent = pad6(game.best);
    els.footBest.textContent = pad6(game.best);
  }

  function refreshMute() {
    els.btnMute.classList.toggle('is-off', sfx.muted);
    els.btnMute.setAttribute('aria-label', sfx.muted ? 'Activar sonido' : 'Silenciar sonido');
    els.btnMute.title = sfx.muted ? 'Sonido (M)' : 'Silencio (M)';
  }

  function toggleMute() {
    sfx.init();
    sfx.setMuted(!sfx.muted);
    refreshMute();
    if (!sfx.muted) sfx.click();
  }

  /* ---------------- ciclo de partida ---------------- */
  function suspendArcade() {
    game.state = 'suspended';
    game.stateTime = 0;
    input.flap = false;
    input.fire = false;
    hideAllScreens();
    els.btnPause.classList.add('is-hidden');
    document.body.classList.remove('is-playing');
  }

  function showTitle() {
    game.state = 'title';
    game.stateTime = 0;
    input.flap = false;
    input.fire = false;
    hideAllScreens();
    show(els.title);
    els.btnPause.classList.add('is-hidden');
    document.body.classList.remove('is-playing');
    refreshBest();
    refreshMute();
  }

  function startGame() {
    sfx.init();
    hideAllScreens();

    game.state = 'playing';
    game.stateTime = 0;
    game.speed = CFG.scrollStart;
    game.distance = 0;
    game.score = 0;
    game.hearts = CFG.maxHearts;
    game.furia = 100;
    game.combo = 1;
    game.comboTimer = 0;
    game.zone = 0;
    game.pal = zonePal(ZONES[0]);
    game.zoneFrom = clonePal(game.pal);
    game.zoneTo = clonePal(game.pal);
    game.zoneMix = 1;
    game.banner = 2.8;
    game.bannerText = ZONES[0].name;
    game.shake = 0;
    game.flash = 0;
    game.spawnTimer = 1.1;
    game.enemyTimer = 5;
    game.gemTimer = 2;
    game.lastGapY = 132;
    game.overShown = false;
    game.isRecord = false;

    game.obstacles.length = 0;
    game.enemies.length = 0;
    game.gems.length = 0;
    game.fireballs.length = 0;
    game.particles.length = 0;
    game.floaters.length = 0;
    game.embers.length = 0;

    game.player = {
      x: 96, y: 138, vy: 0, tilt: 0, wing: 0,
      invuln: 1.2, dead: false, flapGlow: 0, spin: 0, muzzle: 0
    };

    input.flap = false;
    input.fire = false;
    els.btnPause.classList.remove('is-hidden');
    document.body.classList.add('is-playing');
  }

  function pauseGame() {
    if (game.state !== 'playing') return;
    game.state = 'paused';
    game.stateTime = 0;
    show(els.pause);
    els.btnPause.classList.add('is-hidden');
    document.body.classList.remove('is-playing');
  }

  function resumeGame() {
    if (game.state !== 'paused') return;
    game.state = 'playing';
    game.stateTime = 0;
    hide(els.pause);
    els.btnPause.classList.remove('is-hidden');
    document.body.classList.add('is-playing');
    input.flap = false;
    input.fire = false;
  }

  function togglePause() {
    if (game.state === 'playing') pauseGame();
    else if (game.state === 'paused') resumeGame();
  }

  function gameOver() {
    if (game.state !== 'playing') return;
    game.state = 'over';
    game.stateTime = 0;
    game.overShown = false;
    game.player.dead = true;
    game.player.vy = -150;
    game.player.spin = 0.15;
    game.shake = 11;
    game.flash = 0.8;
    game.banner = 0;
    sfx.over();
    els.btnPause.classList.add('is-hidden');
    document.body.classList.remove('is-playing');

    const sc = Math.floor(game.score);
    if (sc > game.best) {
      game.best = sc;
      game.isRecord = true;
      store.set('dragon.best', String(game.best));
      refreshBest();
    }
  }

  function showOverScreen() {
    game.overShown = true;
    els.overScore.textContent = pad6(game.score);
    els.overDist.textContent = Math.floor(game.distance) + ' m';
    els.overBest.textContent = pad6(game.best);
    els.newRecord.hidden = !game.isRecord;
    show(els.over);
  }

  /* ---------------- acciones ---------------- */
  function flap() {
    const p = game.player;
    if (!p || p.dead) return;
    p.vy = CFG.flap;
    p.flapGlow = 1;
    sfx.flap();
    for (let i = 0; i < 3; i++) {
      game.particles.push({
        x: p.x - 12 + rand(-4, 4),
        y: p.y + rand(0, 8),
        vx: rand(-70, -20),
        vy: rand(-20, 30),
        life: rand(0.2, 0.4),
        max: 0.4,
        color: i === 0 ? '#ffd166' : '#ff8a3d',
        size: rand(1, 2),
        grav: 40
      });
    }
  }

  function fireBreath() {
    if (game.state !== 'playing') return;
    const p = game.player;
    if (!p || p.dead) return;
    if (game.furia < CFG.fireCost) {
      game.furia = Math.min(100, game.furia);
      floater(p.x + 16, p.y - 18, 'SIN FUEGO', '#ff9a7a');
      return;
    }
    game.furia -= CFG.fireCost;
    p.muzzle = 0.12;
    p.vy += 18;
    game.fireballs.push({
      x: p.x + 21,
      y: p.y - 3,
      vx: 330 + game.speed * 0.5,
      r: 5,
      life: 1.5
    });
    sfx.fire();
    for (let i = 0; i < 5; i++) {
      game.particles.push({
        x: p.x + 24,
        y: p.y - 3 + rand(-2, 2),
        vx: rand(60, 180),
        vy: rand(-30, 30),
        life: rand(0.12, 0.28),
        max: 0.28,
        color: i % 2 ? '#ffd166' : '#ff6b2b',
        size: rand(1, 2),
        grav: -30
      });
    }
  }

  /* ---------------- daño ---------------- */
  function damage(x, y) {
    const p = game.player;
    if (!p || p.invuln > 0 || p.dead) return;

    game.hearts--;
    p.invuln = CFG.invuln;
    game.combo = 1;
    game.comboTimer = 0;
    game.shake = 8;
    game.flash = 0.55;
    sfx.hit();
    explode(p.x, p.y, '#ff5a3d', 20, 170);
    exploreSparks(x, y);
    floater(p.x, p.y - 20, 'AUCH', '#ff9a7a');

    if (game.hearts <= 0) gameOver();
  }

  function exploreSparks(x, y) {
    for (let i = 0; i < 8; i++) {
      game.particles.push({
        x, y,
        vx: rand(-90, 50),
        vy: rand(-90, 40),
        life: rand(0.2, 0.5),
        max: 0.5,
        color: '#ffe9c9',
        size: rand(1, 2),
        grav: 220
      });
    }
  }

  /* ---------------- actualización ---------------- */
  function updateShake(dt) {
    game.shake = Math.max(0, game.shake - dt * 26);
  }

  function update(dt) {
    game.time += dt;
    game.stateTime += dt;
    updateShake(dt);

    if (game.state === 'title') {
      updateTitle(dt);
      return;
    }
    if (game.state === 'paused') return;
    if (game.state === 'suspended') return;

    if (game.state === 'over') {
      updateDead(dt);
      updateParticles(dt);
      updateFloaters(dt);
      updateEmbers(dt);
      game.flash = Math.max(0, game.flash - dt * 1.6);
      if (!game.overShown && game.stateTime > 0.9) showOverScreen();
      return;
    }

    updateScrolling(dt);
    updatePlayer(dt);
    updateSpawning(dt);
    updateObstacles(dt);
    updateEnemies(dt);
    updateGems(dt);
    updateFireballs(dt);
    updateCollisions();
    updateParticles(dt);
    updateFloaters(dt);
    updateEmbers(dt);
    updateCombo(dt);
    game.flash = Math.max(0, game.flash - dt * 2.4);
  }

  function updateTitle(dt) {
    game.scrollX += 30 * dt;
    const p = game.player;
    if (!p) return;
    p.dead = false;
    p.invuln = 0;
    p.x = 116;
    p.y = 142 + Math.sin(game.time * 1.6) * 7;
    p.vy = 0;
    p.tilt = Math.sin(game.time * 1.6) * 0.05;
    p.wing += dt * 7;
  }

  function updateDead(dt) {
    const p = game.player;
    if (!p) return;
    p.spin += dt * 3.4;
    p.vy += 700 * dt;
    p.y += p.vy * dt;
    p.x += 26 * dt;
    p.tilt = lerp(p.tilt, 0.6, Math.min(1, dt * 3));
  }

  function updateScrolling(dt) {
    game.speed = CFG.scrollStart + Math.min(CFG.scrollMax - CFG.scrollStart, game.distance * 0.11);
    game.scrollX += game.speed * dt;
    game.distance += game.speed * dt * 0.062;
    game.score += game.speed * dt * 0.09;

    const zi = Math.floor(game.distance / CFG.zoneLength) % ZONES.length;
    if (zi !== game.zone) enterZone(zi);

    if (game.zoneMix < 1) {
      game.zoneMix = Math.min(1, game.zoneMix + dt / 2.2);
      const t = game.zoneMix;
      const e = t * t * (3 - 2 * t);
      game.pal = mixPal(game.zoneFrom, game.zoneTo, e);
    }
    if (game.banner > 0) game.banner = Math.max(0, game.banner - dt);
  }

  function enterZone(i) {
    game.zone = i;
    game.zoneFrom = clonePal(game.pal);
    game.zoneTo = zonePal(ZONES[i]);
    game.zoneMix = 0;
    game.banner = 2.8;
    game.bannerText = ZONES[i].name;
    sfx.zone();
  }

  function updatePlayer(dt) {
    const p = game.player;
    if (!p) return;

    p.invuln = Math.max(0, p.invuln - dt);
    p.flapGlow = Math.max(0, p.flapGlow - dt * 3);
    p.muzzle = Math.max(0, p.muzzle - dt);
    game.furia = Math.min(100, game.furia + CFG.fireRegen * dt);

    if (input.flap) {
      input.flap = false;
      flap();
    }
    if (input.fire) {
      input.fire = false;
      fireBreath();
    }
    if (p.dead) return;

    p.vy = Math.min(CFG.maxFall, p.vy + CFG.gravity * dt);
    p.y += p.vy * dt;

    if (p.y < 38) {
      p.y = 38;
      p.vy = Math.max(0, p.vy);
    }
    if (p.y > GROUND - 9) {
      p.y = GROUND - 9;
      if (p.vy > 120) dust(p.x, GROUND);
      p.vy = -175;
      if (p.invuln <= 0) damage(p.x, p.y + 8);
    }

    p.tilt = lerp(p.tilt, clamp(p.vy / 430, -0.4, 0.5), Math.min(1, dt * 10));
    p.wing += dt * (11 + Math.max(0, p.flapGlow) * 26);
  }

  /* ---------------- aparición de obstáculos ---------------- */
  function updateSpawning(dt) {
    game.spawnTimer -= dt;
    if (game.spawnTimer <= 0) {
      if (Math.random() < 0.22) spawnRock();
      else spawnGate();
      game.spawnTimer = clamp(1.55 - game.distance * 0.0007, 0.95, 1.55) * rand(0.9, 1.12);
    }

    game.enemyTimer -= dt;
    if (game.enemyTimer <= 0) {
      if (game.distance > 55) spawnEnemy();
      game.enemyTimer = rand(2.8, 5.2) * clamp(1.1 - game.distance * 0.0002, 0.72, 1.1);
    }

    game.gemTimer -= dt;
    if (game.gemTimer <= 0) {
      if (game.hearts < CFG.maxHearts && Math.random() < 0.14) spawnHeart();
      else spawnGems();
      game.gemTimer = rand(2.2, 3.6);
    }
  }

  function spawnGate() {
    const w = 44;
    const x = VW + 26;
    const gap = clamp(112 - game.distance * 0.022, 86, 112);
    const minC = 42 + gap / 2;
    const maxC = GROUND - 50 - gap / 2;
    const c = clamp(game.lastGapY + rand(-58, 58), minC, maxC);
    game.lastGapY = c;

    const ob = {
      type: 'gate',
      x,
      w,
      topH: c - gap / 2,
      botH: GROUND - (c + gap / 2),
      gapY: c
    };
    game.obstacles.push(ob);

    const rects = obRects(ob);
    game.gems = game.gems.filter((g) => {
      const r = { x: g.x - 5, y: g.y - 6, w: 10, h: 12 };
      return !rects.some((o) => hit(r, o));
    });

    if (Math.random() < 0.55) {
      game.gems.push({ type: 'gem', x: x + w / 2, y: c, ph: rand(0, 6), dead: false });
    }
  }

  function spawnRock() {
    const w = randInt(34, 50);
    const h = randInt(26, 42);
    const x = VW + 26;
    const y = rand(52, GROUND - h - 34);
    if (!spawnClear(x, y, w, h)) return;
    game.obstacles.push({ type: 'rock', x, y, w, h });
    if (Math.random() < 0.4) {
      game.gems.push({ type: 'gem', x: x + w / 2, y: y - 17, ph: rand(0, 6), dead: false });
    }
  }

  function spawnGems() {
    const n = randInt(3, 5);
    const baseY = rand(58, GROUND - 52);
    const baseX = VW + 30;
    const amp = rand(8, 20) * (Math.random() < 0.5 ? -1 : 1);
    for (let i = 0; i < n; i++) {
      const x = baseX + i * 21;
      const y = clamp(baseY + Math.sin(i * 0.85) * amp, 46, GROUND - 34);
      if (!spawnClear(x - 7, y - 9, 14, 18)) continue;
      game.gems.push({ type: 'gem', x, y, ph: rand(0, 6), dead: false });
    }
  }

  function spawnHeart() {
    const x = VW + 34;
    const y = rand(60, GROUND - 60);
    if (!spawnClear(x - 8, y - 10, 16, 20)) return;
    game.gems.push({ type: 'heart', x, y, ph: rand(0, 6), dead: false });
  }

  function spawnEnemy() {
    const y = rand(60, GROUND - 58);
    if (!spawnClear(VW + 16, y - 12, 22, 24)) return;
    game.enemies.push({
      x: VW + 26,
      y,
      baseY: y,
      ph: rand(0, 6.28),
      amp: rand(6, 22),
      r: 9,
      flap: rand(9, 13),
      dead: false
    });
  }

  /* ---------------- entidades ---------------- */
  function updateObstacles(dt) {
    for (const ob of game.obstacles) ob.x -= game.speed * dt;
    game.obstacles = game.obstacles.filter((ob) => ob.x + ob.w > -30);
  }

  function updateEnemies(dt) {
    for (const e of game.enemies) {
      e.x -= (game.speed * 0.78 + 40) * dt;
      e.y = e.baseY + Math.sin(game.time * 1.7 + e.ph) * e.amp;
    }
  }

  function updateGems(dt) {
    for (const g of game.gems) {
      g.x -= game.speed * dt;
      g.ph += dt;
    }
  }

  function updateFireballs(dt) {
    for (const f of game.fireballs) {
      f.x += f.vx * dt;
      f.life -= dt;
      if (f.life <= 0 || f.x > VW + 40) f.dead = true;
      if (Math.random() < 0.55) {
        game.particles.push({
          x: f.x - 5,
          y: f.y + rand(-2, 2),
          vx: rand(-40, 10),
          vy: rand(-18, 18),
          life: rand(0.1, 0.25),
          max: 0.25,
          color: Math.random() < 0.5 ? '#ffd166' : '#ff6b2b',
          size: rand(1, 2),
          grav: -20
        });
      }
    }
  }

  function updateCollisions() {
    const p = game.player;
    if (!p) return;
    const pr = { x: p.x - 11, y: p.y - 6, w: 22, h: 13 };

    for (const g of game.gems) {
      if (g.dead) continue;
      if (hit(pr, { x: g.x - 6, y: g.y - 9, w: 12, h: 18 })) collect(g);
    }

    for (const f of game.fireballs) {
      if (f.dead) continue;

      for (const e of game.enemies) {
        if (e.dead) continue;
        const dx = f.x - e.x;
        const dy = f.y - e.y;
        const rr = f.r + e.r;
        if (dx * dx + dy * dy < rr * rr) {
          f.dead = true;
          e.dead = true;
          game.score += 25;
          game.combo = Math.min(5, game.combo + 1);
          game.comboTimer = 3.2;
          sfx.enemy();
          explode(e.x, e.y, '#b06bd6', 16, 160);
          floater(e.x, e.y - 10, '+25', '#e0b3ff');
          break;
        }
      }
      if (f.dead) continue;

      for (const ob of game.obstacles) {
        let solid = false;
        for (const r of obRects(ob)) {
          if (f.x > r.x && f.x < r.x + r.w && f.y > r.y && f.y < r.y + r.h) {
            solid = true;
            break;
          }
        }
        if (solid) {
          f.dead = true;
          explode(f.x, f.y, '#ffb347', 7, 80, 70);
          break;
        }
      }
    }

    if (p.invuln <= 0 && !p.dead) {
      for (const ob of game.obstacles) {
        let touched = false;
        for (const r of obRects(ob)) {
          if (hit(pr, r)) {
            touched = true;
            break;
          }
        }
        if (touched) {
          damage(p.x, p.y);
          break;
        }
      }

      if (p.invuln <= 0) {
        for (const e of game.enemies) {
          if (e.dead) continue;
          if (hit(pr, { x: e.x - 8, y: e.y - 7, w: 16, h: 14 })) {
            e.dead = true;
            explode(e.x, e.y, '#b06bd6', 16, 160);
            damage(e.x, e.y);
            break;
          }
        }
      }
    }

    game.gems = game.gems.filter((g) => !g.dead && g.x > -20);
    game.enemies = game.enemies.filter((e) => !e.dead && e.x > -40);
    game.fireballs = game.fireballs.filter((f) => !f.dead);
  }

  function collect(g) {
    g.dead = true;
    if (g.type === 'heart') {
      game.hearts = Math.min(CFG.maxHearts, game.hearts + 1);
      game.furia = Math.min(100, game.furia + 20);
      sfx.heart();
      floater(g.x, g.y - 10, '+VIDA', '#ff9a9a');
      explode(g.x, g.y, '#ff8a8a', 12, 110, 30);
      return;
    }
    const val = 10 * game.combo;
    game.score += val;
    game.furia = Math.min(100, game.furia + 7);
    game.combo = Math.min(5, game.combo + 1);
    game.comboTimer = 3.2;
    sfx.gem(game.combo);
    floater(g.x, g.y - 10, '+' + val, '#7cf5ff');
    explode(g.x, g.y, '#7cf5ff', 8, 95, 15);
  }

  function updateCombo(dt) {
    if (game.comboTimer > 0) {
      game.comboTimer -= dt;
      if (game.comboTimer <= 0) game.combo = 1;
    }
  }

  function updateParticles(dt) {
    for (const p of game.particles) {
      p.life -= dt;
      p.vy += (p.grav || 0) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    if (game.particles.length > 320) game.particles.splice(0, game.particles.length - 320);
    game.particles = game.particles.filter((p) => p.life > 0 && p.y < VH + 30);
  }

  function updateFloaters(dt) {
    for (const f of game.floaters) {
      f.life -= dt;
      f.y -= 24 * dt;
    }
    game.floaters = game.floaters.filter((f) => f.life > 0);
  }

  function updateEmbers(dt) {
    if (ZONES[game.zone].ember && game.embers.length < 60 && Math.random() < dt * 26) {
      game.embers.push({
        x: rand(0, VW),
        y: VH + 4,
        vx: rand(-10, 10),
        vy: -rand(14, 38),
        life: rand(2, 4.5),
        max: 4.5,
        s: Math.random() < 0.75 ? 1 : 2
      });
    }
    for (const e of game.embers) {
      e.life -= dt;
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      e.vx += Math.sin(game.time + e.y * 0.05) * 4 * dt;
    }
    game.embers = game.embers.filter((e) => e.life > 0 && e.y > -10);
  }

  /* ---------------- render ---------------- */
  function text(str, x, y, size, color, align = 'left') {
    ctx.font = size + 'px "Press Start 2P", monospace';
    ctx.textAlign = align;
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillText(str, x + 1, y + 1);
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
  }

  function drawBackground() {
    const pal = game.pal;

    const sky = ctx.createLinearGradient(0, 0, 0, GROUND + 30);
    sky.addColorStop(0, rgb(pal.sky0));
    sky.addColorStop(1, rgb(pal.sky1));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, VW, VH);

    for (const s of stars) {
      const tw = 0.35 + 0.65 * Math.abs(Math.sin(game.time * s.tw + s.ph));
      const x = (((s.x - game.scrollX * 0.04) % VW) + VW) % VW;
      ctx.fillStyle = rgba(pal.star, 0.75 * tw);
      ctx.fillRect(x | 0, s.y | 0, s.s, s.s);
    }

    drawMoon();

    drawRidge(game.scrollX * 0.1, 206, 48, rgb(pal.far), 1.7);
    drawRidge(game.scrollX * 0.22, 226, 64, rgb(pal.mid), 4.1);
    drawRidge(game.scrollX * 0.42, 250, 74, rgb(pal.near), 9.3);

    ctx.fillStyle = rgb(pal.rock);
    ctx.fillRect(0, GROUND, VW, VH - GROUND);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(0, GROUND, VW, 2);

    const off = game.scrollX % 46;
    for (let x = -off; x < VW + 46; x += 46) {
      ctx.fillStyle = 'rgba(255,225,190,0.05)';
      ctx.fillRect(x + 9, GROUND + 5, 11, 2);
      ctx.fillRect(x + 27, GROUND + 13, 6, 1);
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(x + 17, GROUND + 8, 7, 2);
    }
  }

  function drawMoon() {
    const x = 388;
    const y = 54;
    ctx.save();
    ctx.globalAlpha = 0.1;
    ctx.fillStyle = '#ffe9b0';
    ctx.beginPath();
    ctx.arc(x, y, 36, 0, 6.2832);
    ctx.fill();

    ctx.globalAlpha = 0.95;
    ctx.fillStyle = '#f4e7c3';
    ctx.beginPath();
    ctx.arc(x, y, 21, 0, 6.2832);
    ctx.fill();

    ctx.globalAlpha = 0.16;
    ctx.fillStyle = '#a48f66';
    ctx.beginPath();
    ctx.arc(x - 7, y - 4, 5, 0, 6.2832);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 6, y + 7, 4, 0, 6.2832);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 5, y - 8, 3, 0, 6.2832);
    ctx.fill();
    ctx.restore();
  }

  function drawRidge(offset, baseY, amp, color, seed) {
    ctx.beginPath();
    ctx.moveTo(-4, GROUND + 4);
    for (let x = -4; x <= VW + 4; x += 5) {
      const wx = x + offset;
      const h =
        Math.sin(wx * 0.0061 + seed) * 0.5 +
        Math.sin(wx * 0.0133 + seed * 2.1) * 0.3 +
        Math.sin(wx * 0.0271 + seed * 3.3) * 0.2;
      ctx.lineTo(x, baseY - Math.abs(h) * amp);
    }
    ctx.lineTo(VW + 4, GROUND + 4);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,220,180,0.07)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function drawEmbers() {
    for (const e of game.embers) {
      const a = clamp(e.life / 1.6, 0, 1);
      ctx.fillStyle = 'rgba(255,124,60,' + (0.55 * a).toFixed(3) + ')';
      ctx.fillRect(e.x | 0, e.y | 0, e.s, e.s);
    }
  }

  function drawObstacles() {
    const pal = game.pal;
    const dark = rgb(pal.rock);
    const edge = rgb(mix(pal.rock, [255, 225, 195], 0.46));
    const shade = 'rgba(0,0,0,0.35)';

    for (const ob of game.obstacles) {
      if (ob.type === 'gate') {
        if (ob.topH > 0) {
          ctx.fillStyle = dark;
          ctx.fillRect(ob.x, 0, ob.w, ob.topH);
          ctx.beginPath();
          ctx.moveTo(ob.x, ob.topH);
          for (let i = 0; i < 5; i++) {
            const sw = ob.w / 5;
            ctx.lineTo(ob.x + i * sw + sw * 0.5, ob.topH + (i % 2 ? 4 : 7));
            ctx.lineTo(ob.x + (i + 1) * sw, ob.topH);
          }
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = edge;
          ctx.fillRect(ob.x + 2, 0, 3, Math.max(0, ob.topH - 4));
          ctx.fillStyle = shade;
          ctx.fillRect(ob.x + ob.w - 7, 0, 7, ob.topH);
          ctx.fillStyle = rgba(pal.accent, 0.35);
          ctx.fillRect(ob.x + ob.w - 2, 8, 2, Math.max(0, ob.topH - 18));
        }

        const y = GROUND - ob.botH;
        if (ob.botH > 0) {
          ctx.fillStyle = dark;
          ctx.fillRect(ob.x, y, ob.w, ob.botH);
          ctx.beginPath();
          ctx.moveTo(ob.x, y);
          for (let i = 0; i < 5; i++) {
            const sw = ob.w / 5;
            ctx.lineTo(ob.x + i * sw + sw * 0.5, y - (i % 2 ? 4 : 7));
            ctx.lineTo(ob.x + (i + 1) * sw, y);
          }
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = edge;
          ctx.fillRect(ob.x + 2, y + 4, 3, Math.max(0, ob.botH - 4));
          ctx.fillStyle = shade;
          ctx.fillRect(ob.x + ob.w - 7, y, 7, ob.botH);
          ctx.fillStyle = rgba(pal.accent, 0.35);
          ctx.fillRect(ob.x + ob.w - 2, y + 9, 2, Math.max(0, ob.botH - 18));
        }
      } else {
        ctx.fillStyle = dark;
        ctx.beginPath();
        ctx.moveTo(ob.x, ob.y + 7);
        ctx.lineTo(ob.x + 7, ob.y);
        ctx.lineTo(ob.x + ob.w - 6, ob.y + 2);
        ctx.lineTo(ob.x + ob.w, ob.y + 10);
        ctx.lineTo(ob.x + ob.w - 4, ob.y + ob.h - 2);
        ctx.lineTo(ob.x + 8, ob.y + ob.h);
        ctx.lineTo(ob.x + 2, ob.y + ob.h - 8);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = edge;
        ctx.fillRect(ob.x + 6, ob.y + 3, 3, 4);
        ctx.fillStyle = shade;
        ctx.fillRect(ob.x + ob.w - 9, ob.y + 9, 5, Math.max(0, ob.h - 13));
      }
    }
  }

  const HEART = ['0110110', '1111111', '1111111', '0111110', '0011100', '0001000'];

  function drawHeart(x, y, s, filled) {
    x = Math.round(x);
    y = Math.round(y);
    for (let r = 0; r < HEART.length; r++) {
      for (let c = 0; c < 7; c++) {
        if (HEART[r][c] !== '1') continue;
        if (filled) {
          ctx.fillStyle = r < 2 ? '#ff6b6b' : r < 4 ? '#e23b3b' : '#b02a2a';
        } else {
          ctx.fillStyle = 'rgba(120,60,80,0.38)';
        }
        ctx.fillRect(x + c * s, y + r * s, s, s);
      }
    }
  }

  function drawGem(x, y) {
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = '#7cf5ff';
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, 6.2832);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#4fd6ee';
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 0);
    ctx.lineTo(0, 7);
    ctx.lineTo(-5, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#d8feff';
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(2.5, -1);
    ctx.lineTo(0, 1);
    ctx.lineTo(-2.5, -1);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawGems() {
    for (const g of game.gems) {
      const bob = Math.sin(g.ph * 3) * 1.5;
      if (g.type === 'heart') {
        ctx.save();
        ctx.globalAlpha = 0.2;
        ctx.fillStyle = '#ff6b6b';
        ctx.beginPath();
        ctx.arc(g.x, g.y + bob, 10, 0, 6.2832);
        ctx.fill();
        ctx.restore();
        drawHeart(g.x - 7, g.y + bob - 7, 2, true);
      } else {
        drawGem(g.x, g.y + bob);
      }
    }
  }

  function drawEnemies() {
    for (const e of game.enemies) {
      if (e.dead) continue;
      const fl = Math.sin(game.time * e.flap + e.ph);
      ctx.save();
      ctx.translate(Math.round(e.x), Math.round(e.y));

      ctx.fillStyle = '#4b2477';
      ctx.beginPath();
      ctx.moveTo(-2, 0);
      ctx.lineTo(-15, -6 - fl * 5);
      ctx.lineTo(-7, 5 + fl * 3);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(2, 0);
      ctx.lineTo(15, -6 - fl * 5);
      ctx.lineTo(7, 5 + fl * 3);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#8a4fc4';
      ctx.beginPath();
      ctx.moveTo(-2, 0);
      ctx.lineTo(-11, -3 - fl * 3);
      ctx.lineTo(-6, 3 + fl * 2);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(2, 0);
      ctx.lineTo(11, -3 - fl * 3);
      ctx.lineTo(6, 3 + fl * 2);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#6b3fa0';
      ctx.beginPath();
      ctx.arc(0, 0, 6.5, 0, 6.2832);
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(-5, -5);
      ctx.lineTo(-7, -11);
      ctx.lineTo(-2, -6);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(5, -5);
      ctx.lineTo(7, -11);
      ctx.lineTo(2, -6);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#ffd166';
      ctx.fillRect(-4, -2, 2, 2);
      ctx.fillRect(2, -2, 2, 2);
      ctx.fillStyle = '#fff8e7';
      ctx.fillRect(-2, 3, 1, 2);
      ctx.fillRect(1, 3, 1, 2);

      ctx.restore();
    }
  }

  function drawFireballs() {
    for (const f of game.fireballs) {
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = '#ff6b2b';
      ctx.beginPath();
      ctx.arc(f.x, f.y, 9, 0, 6.2832);
      ctx.fill();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = '#ff8a3d';
      ctx.beginPath();
      ctx.arc(f.x, f.y, 5, 0, 6.2832);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#ffe9a8';
      ctx.beginPath();
      ctx.arc(f.x + 1, f.y, 2.4, 0, 6.2832);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawWing(x, y, phase, fill, edge, scale) {
    const ang = Math.sin(phase) * 0.55 - 0.2;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.scale(scale, scale);

    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-7, -15, -19, -25);
    ctx.quadraticCurveTo(-14, -13, -16, -6);
    ctx.quadraticCurveTo(-9, -7, -7, 1);
    ctx.quadraticCurveTo(-3, -3, 3, 3);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = edge;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-19, -25);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-16, -6);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-7, 1);
    ctx.stroke();

    ctx.strokeStyle = '#7a1c33';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-9, -13, -19, -25);
    ctx.stroke();

    ctx.restore();
  }

  function drawDragon(x, y, wing, tilt, opts) {
    const muzzle = opts.muzzle || 0;
    const BODY = '#e8483c';
    const DARK = '#9c2230';
    const LIT = '#ff7a55';
    const BELLY = '#ffc46b';
    const HORN = '#ffeccd';

    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.rotate(tilt);

    const wag = Math.sin(wing * 0.9) * 3;

    ctx.lineCap = 'round';
    ctx.strokeStyle = DARK;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(-10, 2);
    ctx.quadraticCurveTo(-26, 6 + wag, -36, 2 + wag * 1.6);
    ctx.stroke();

    ctx.strokeStyle = BODY;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-10, 2);
    ctx.quadraticCurveTo(-26, 6 + wag, -36, 2 + wag * 1.6);
    ctx.stroke();

    ctx.fillStyle = LIT;
    ctx.beginPath();
    ctx.moveTo(-35, 2 + wag * 1.6);
    ctx.lineTo(-46, -5 + wag * 1.6);
    ctx.lineTo(-43, 7 + wag * 1.6);
    ctx.closePath();
    ctx.fill();

    drawWing(-2, -4, wing + Math.PI, 'rgba(120,30,60,0.92)', 'rgba(80,20,45,0.9)', 0.9);

    ctx.fillStyle = LIT;
    for (let i = 0; i < 4; i++) {
      const sx = -12 + i * 7;
      const sy = -6 - Math.sin(i * 1.2) * 2;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + 3, sy - 6);
      ctx.lineTo(sx + 6, sy);
      ctx.closePath();
      ctx.fill();
    }

    ctx.fillStyle = BODY;
    ctx.beginPath();
    ctx.ellipse(0, 0, 14, 9, 0, 0, 6.2832);
    ctx.fill();

    ctx.fillStyle = BELLY;
    ctx.beginPath();
    ctx.ellipse(1, 3.5, 10, 4.5, 0, 0, 6.2832);
    ctx.fill();

    ctx.strokeStyle = DARK;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(0, 0, 14, 9, 0, 0, 6.2832);
    ctx.stroke();

    ctx.fillStyle = DARK;
    ctx.beginPath();
    ctx.moveTo(-4, 7);
    ctx.lineTo(-8, 14);
    ctx.lineTo(-3, 13);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(5, 6);
    ctx.lineTo(3, 13);
    ctx.lineTo(8, 12);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = BODY;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(6, -2);
    ctx.quadraticCurveTo(11, -7, 14, -6);
    ctx.stroke();

    ctx.fillStyle = BODY;
    ctx.beginPath();
    ctx.ellipse(16, -6, 7, 5.5, -0.25, 0, 6.2832);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(18, -9);
    ctx.lineTo(26, -6);
    ctx.lineTo(25, -2);
    ctx.lineTo(17, -2);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = DARK;
    ctx.beginPath();
    ctx.moveTo(18, -1.6);
    ctx.lineTo(25, -2);
    ctx.lineTo(24, 0.2);
    ctx.lineTo(18, 1.2);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = HORN;
    ctx.beginPath();
    ctx.moveTo(11, -10);
    ctx.lineTo(6, -17);
    ctx.lineTo(14, -11);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(15, -11);
    ctx.lineTo(16, -18);
    ctx.lineTo(19, -10);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#fff8e7';
    ctx.beginPath();
    ctx.ellipse(18, -7.5, 2.4, 2.2, 0, 0, 6.2832);
    ctx.fill();
    ctx.fillStyle = '#231129';
    ctx.beginPath();
    ctx.ellipse(18.6, -7.4, 1.1, 1.7, 0, 0, 6.2832);
    ctx.fill();

    ctx.fillStyle = 'rgba(35,17,41,0.55)';
    ctx.fillRect(22, -5, 1, 1);

    drawWing(-1, -6, wing, '#ff5d54', '#c73350', 1);

    if (muzzle > 0) {
      ctx.globalAlpha = Math.min(1, muzzle * 9);
      ctx.fillStyle = '#ffd166';
      ctx.beginPath();
      ctx.arc(26, -4, 4, 0, 6.2832);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  function drawPlayer() {
    const p = game.player;
    if (!p) return;
    if (p.invuln > 0 && !p.dead && Math.floor(game.time * 18) % 2 === 0) return;
    const tilt = p.tilt + (p.dead ? p.spin : 0);
    drawDragon(p.x, p.y, p.wing, tilt, { muzzle: p.muzzle, dead: p.dead });
  }

  function drawParticles() {
    for (const p of game.particles) {
      const a = clamp(p.life / p.max, 0, 1);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x | 0, p.y | 0, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  function drawFloaters() {
    for (const f of game.floaters) {
      const a = clamp(f.life / f.max, 0, 1);
      ctx.globalAlpha = a;
      text(f.text, f.x, f.y, 6, f.color, 'center');
    }
    ctx.globalAlpha = 1;
  }

  function drawFlame(x, y) {
    ctx.fillStyle = '#ff8a3d';
    ctx.beginPath();
    ctx.moveTo(x + 3, y + 9);
    ctx.lineTo(x, y + 4);
    ctx.lineTo(x + 2, y);
    ctx.lineTo(x + 3, y + 3.4);
    ctx.lineTo(x + 5, y + 1);
    ctx.lineTo(x + 6, y + 5);
    ctx.lineTo(x + 6, y + 9);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(x + 3, y + 5, 2, 3);
  }

  function drawHUD() {
    const band = ctx.createLinearGradient(0, 0, 0, 42);
    band.addColorStop(0, 'rgba(7,3,12,0.82)');
    band.addColorStop(1, 'rgba(7,3,12,0)');
    ctx.fillStyle = band;
    ctx.fillRect(0, 0, VW, 42);

    for (let i = 0; i < CFG.maxHearts; i++) drawHeart(10 + i * 16, 8, 2, i < game.hearts);

    const bx = 68;
    const by = 10;
    const bw = 78;
    const bh = 7;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
    ctx.fillStyle = '#1d0f28';
    ctx.fillRect(bx, by, bw, bh);
    const fw = Math.round((bw * game.furia) / 100);
    if (fw > 0) {
      ctx.fillStyle = '#ff8a3d';
      ctx.fillRect(bx, by, fw, bh);
      ctx.fillStyle = '#ffd166';
      ctx.fillRect(bx, by, fw, 2);
    }
    const cost = Math.round((bw * CFG.fireCost) / 100);
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(bx + cost, by, 1, bh);
    drawFlame(bx - 10, by - 1);

    text(pad6(game.score), VW - 10, 8, 8, '#ffe9c9', 'right');
    text(Math.floor(game.distance) + ' M', VW - 10, 22, 6, 'rgba(255,233,201,0.62)', 'right');

    if (game.combo > 1) {
      const pulse = 0.85 + 0.15 * Math.sin(game.time * 10);
      ctx.save();
      ctx.translate(VW / 2, 9);
      ctx.scale(pulse, pulse);
      text('x' + game.combo, 0, 0, 8, '#7cf5ff', 'center');
      ctx.restore();
    }
  }

  function drawBanner() {
    if (game.banner <= 0) return;
    const a = clamp(Math.min(game.banner * 1.7, (2.8 - game.banner) * 1.7), 0, 1);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(7,3,12,0.55)';
    ctx.fillRect(0, 74, VW, 34);
    ctx.fillStyle = rgba(game.pal.accent, 0.85);
    ctx.fillRect(0, 74, VW, 1);
    ctx.fillRect(0, 107, VW, 1);
    text('ZONA ' + (game.zone + 1), VW / 2, 80, 6, rgba(game.pal.accent, 0.95), 'center');
    text(game.bannerText, VW / 2, 90, 8, '#ffe9c9', 'center');
    ctx.restore();
  }

  function drawFlash() {
    if (game.flash <= 0) return;
    ctx.fillStyle = 'rgba(255,60,30,' + (game.flash * 0.45).toFixed(3) + ')';
    ctx.fillRect(0, 0, VW, VH);
  }

  function render() {
    if (game.state === 'suspended') return;
    ctx.save();
    if (game.shake > 0) {
      ctx.translate(rand(-game.shake, game.shake), rand(-game.shake, game.shake));
    }

    drawBackground();
    drawEmbers();
    drawObstacles();
    drawGems();
    drawEnemies();
    drawFireballs();
    drawPlayer();
    drawParticles();
    drawFloaters();

    ctx.restore();

    if (game.state !== 'title') drawHUD();
    drawBanner();
    drawFlash();
  }

  /* ---------------- controles ---------------- */
  const CONTROL_KEYS = [
    'Space', 'ArrowUp', 'ArrowDown', 'KeyW', 'KeyS',
    'KeyX', 'KeyK', 'KeyZ', 'KeyJ', 'KeyP', 'Escape', 'KeyM', 'Enter'
  ];

  window.addEventListener('keydown', (e) => {
    if (CONTROL_KEYS.includes(e.code)) e.preventDefault();
    if (e.repeat) return;

    if (e.code === 'KeyM') {
      toggleMute();
      return;
    }
    if (e.code === 'KeyP' || e.code === 'Escape') {
      togglePause();
      return;
    }

    if (e.code === 'Space' || e.code === 'Enter') {
      if (game.state === 'title') {
        startGame();
        return;
      }
      if (game.state === 'over') {
        if (game.stateTime > 0.55) startGame();
        return;
      }
      if (game.state === 'paused') {
        resumeGame();
        return;
      }
      if (game.state === 'playing') {
        input.flap = true;
        sfx.init();
        return;
      }
    }

    if (game.state !== 'playing') return;
    if (e.code === 'ArrowUp' || e.code === 'KeyW') {
      input.flap = true;
      sfx.init();
    } else if (e.code === 'KeyX' || e.code === 'KeyK' || e.code === 'KeyZ' || e.code === 'KeyJ') {
      input.fire = true;
      sfx.init();
    }
  });

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    sfx.init();
    sfx.click();
    const action = btn.dataset.action;
    if (action === 'start' || action === 'restart') startGame();
    else if (action === 'resume') resumeGame();
    else if (action === 'pause') togglePause();
    else if (action === 'menu') showTitle();
    else if (action === 'mute') toggleMute();
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  });

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (game.state === 'playing') {
      input.flap = true;
      sfx.init();
    }
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  els.btnFlap.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (game.state === 'playing') {
      input.flap = true;
      sfx.init();
    }
  });

  els.btnFire.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (game.state === 'playing') {
      input.fire = true;
      sfx.init();
    }
  });

  window.addEventListener('blur', () => {
    if (game.state === 'playing') pauseGame();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game.state === 'playing') pauseGame();
  });

  if (navigator.maxTouchPoints > 0 || 'ontouchstart' in window) {
    document.body.classList.add('is-touch');
  }

  /* ---------------- arranque ---------------- */
  refreshBest();
  refreshMute();
  els.btnPause.classList.add('is-hidden');

  game.player = {
    x: 116, y: 142, vy: 0, tilt: 0, wing: 0,
    invuln: 0, dead: false, flapGlow: 0, spin: 0, muzzle: 0
  };

  // gancho de depuración (útil para pruebas manuales desde la consola)
  window.dragonGame = {
    game, update, render, startGame, pauseGame, resumeGame,
    suspendArcade, showTitle, input, sfx, toggleMute, refreshMute
  };

  let last = performance.now();

  function loop(now) {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    update(dt);
    render();
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
})();


