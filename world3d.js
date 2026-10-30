(() => {
  'use strict';

  if (!window.THREE) {
    const root = document.getElementById('world3d');
    const loading = document.getElementById('worldLoading');
    const exit = document.getElementById('worldExit');
    const button = document.getElementById('btnWorld');
    const openUnavailable = () => {
      root.classList.add('is-open');
      root.setAttribute('aria-hidden', 'false');
      document.body.classList.add('is-world');
      window.dragonGame.suspendArcade();
      loading.hidden = false;
      loading.textContent = 'NO SE PUDO CARGAR THREE.JS.\nREVISA TU CONEXIÓN A INTERNET Y RECARGA LA PÁGINA.';
      exit.focus({ preventScroll: true });
    };
    button.addEventListener('click', openUnavailable);
    exit.addEventListener('click', () => {
      root.classList.remove('is-open');
      root.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('is-world');
      window.dragonGame.showTitle();
      button.focus({ preventScroll: true });
    });
    return;
  }

  const root = document.getElementById('world3d');
  const canvas = document.getElementById('worldCanvas');
  const loading = document.getElementById('worldLoading');
  const regionLabel = document.getElementById('worldRegion');
  const positionLabel = document.getElementById('worldPosition');
  const exitButton = document.getElementById('worldExit');
  const menuButton = document.getElementById('btnWorld');
  const lobby = document.getElementById('worldLobby');
  const lobbyBack = document.getElementById('worldLobbyBack');
  const botStartButton = document.getElementById('worldBotStart');
  const localStartButton = document.getElementById('worldLocalStart');
  const createRoomButton = document.getElementById('worldCreateRoom');
  const joinForm = document.getElementById('worldJoinForm');
  const roomCodeInput = document.getElementById('worldRoomCode');
  const networkStatus = document.getElementById('worldNetworkStatus');
  const invitePanel = document.getElementById('worldInvite');
  const inviteCodeOutput = document.getElementById('worldInviteCode');
  const inviteStatus = document.getElementById('worldInviteStatus');
  const inviteCancelButton = document.getElementById('worldInviteCancel');
  const modeLabel = document.getElementById('worldModeLabel');
  const worldHint = document.getElementById('worldHint');
  const heldKeys = new Set();
  const touchButtons = new Set();
  const playerCharacters = ['toothless', 'light'];
  const CHUNK_SIZE = 32;
  const CELL_SIZE = 2;
  const CELLS_PER_CHUNK = CHUNK_SIZE / CELL_SIZE;
  const VISIBLE_RADIUS = 3;
  const BIOME_LENGTH = 176;
  const UP = new THREE.Vector3(0, 1, 0);
  const tempObject = new THREE.Object3D();
  const tempColor = new THREE.Color();
  const wildlifeGeometry = new THREE.BoxGeometry(1, 1, 1);

  const BIOMES = [
    { name: 'ISLAS DEL ALBA', ground: '#527b49', grass: '#78a953', soil: '#71543e', rock: '#777774', leaves: '#347147' },
    { name: 'BOSQUE ESMERALDA', ground: '#397760', grass: '#66aa82', soil: '#50463b', rock: '#617378', leaves: '#235c49' },
    { name: 'VALLE DE OBSIDIANA', ground: '#61565e', grass: '#997a6d', soil: '#403640', rock: '#302c39', leaves: '#624655' },
    { name: 'CUMBRES DE CRISTAL', ground: '#7795a0', grass: '#bbd7bd', soil: '#526475', rock: '#96b1c2', leaves: '#407f8d' }
  ];

  const WILDLIFE_COLORS = [
    { bird: '#f5d477', belly: '#fff1cb', beak: '#ec8d49', animal: '#bd7044', dark: '#593c36' },
    { bird: '#8fe0cc', belly: '#e5fff0', beak: '#e9a54c', animal: '#9b7655', dark: '#453d39' },
    { bird: '#d8a8dc', belly: '#f8e8f4', beak: '#edaa6b', animal: '#b58a75', dark: '#52434c' },
    { bird: '#d8edff', belly: '#ffffff', beak: '#eca35f', animal: '#d2e0e0', dark: '#586e7b' }
  ];

  const controls = [
    { forward: false, back: false, left: false, right: false, jump: false, fly: false },
    { forward: false, back: false, left: false, right: false, jump: false, fly: false }
  ];

  let renderer;
  let scene;
  let camera;
  let terrainMaterial;
  let foliageMaterial;
  let trunkMaterial;
  let sharedBlock;
  let water;
  let skyDome;
  let light;
  let crystalGeometry;
  let crystalMaterial;
  let isOpen = false;
  let frame = 0;
  let lastTime = 0;
  let hudTimer = 0;
  let cameraYaw = 0;
  let cameraTilt = 21;
  let crystalsFound = 0;
  let pointerId = null;
  let lastPointerX = 0;
  let lastPointerY = 0;
  let playMode = 'lobby';
  let peer = null;
  let roomConnection = null;
  let peerLoader;
  let networkTimer = 0;
  let networkSent = 0;
  let networkReceived = 0;
  let remoteCameraYaw = 0;

  const chunks = new Map();
  const crystals = new Set();
  const clouds = [];
  const wildlife = new Set();
  let wildlifeMaterials = [];
  const players = [];
  const remoteStates = [null, null];

  function hash(x, z) {
    const value = Math.sin(x * 127.1 + z * 311.7) * 43758.5453123;
    return value - Math.floor(value);
  }

  function positiveModulo(value, divisor) {
    return ((value % divisor) + divisor) % divisor;
  }

  function biomeAt(x, z) {
    const band = Math.floor((BIOME_LENGTH / 2 - z) / BIOME_LENGTH);
    const crossBand = Math.floor((x + BIOME_LENGTH / 2) / BIOME_LENGTH);
    return BIOMES[positiveModulo(band + crossBand * 2, BIOMES.length)];
  }

  function heightAt(x, z) {
    const gridX = Math.floor(x / CELL_SIZE);
    const gridZ = Math.floor(z / CELL_SIZE);
    const hills = Math.sin(gridX * 0.21) + Math.cos(gridZ * 0.18) + Math.sin((gridX + gridZ) * 0.12);
    return THREE.MathUtils.clamp(Math.floor(1.7 + hills * 0.57 + hash(gridX, gridZ) * 0.8), 0, 3);
  }

  function groundAt(x, z) {
    return 2 + heightAt(x, z) * 2 - 0.18;
  }

  function colorAt(hex, seed, amount = 0.09) {
    return tempColor.set(hex).offsetHSL(0, 0, (seed - 0.5) * amount);
  }

  function setInstance(mesh, index, x, y, z, sx, sy, sz, color) {
    tempObject.position.set(x, y, z);
    tempObject.scale.set(sx, sy, sz);
    tempObject.rotation.set(0, 0, 0);
    tempObject.updateMatrix();
    mesh.setMatrixAt(index, tempObject.matrix);
    if (color) mesh.setColorAt(index, color);
  }

  function makeMaterial(color, options = {}) {
    return new THREE.MeshStandardMaterial({
      color,
      roughness: 0.86,
      metalness: 0.02,
      ...options
    });
  }

  function buildWorld() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color('#a9d8e6');
    scene.fog = new THREE.Fog('#a9d8e6', 90, 300);

    camera = new THREE.PerspectiveCamera(50, 1, 0.1, 550);
    camera.position.set(0, 13, 23);

    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: 'high-performance'
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.82;

    sharedBlock = new THREE.BoxGeometry(2, 2, 2);
    terrainMaterial = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1 });
    foliageMaterial = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.94 });
    trunkMaterial = makeMaterial('#ffffff');
    crystalGeometry = new THREE.OctahedronGeometry(0.62, 0);
    crystalMaterial = makeMaterial('#8af6ef', {
      emissive: '#32b5a7',
      emissiveIntensity: 0.72,
      roughness: 0.27,
      metalness: 0.16
    });
    wildlifeMaterials = WILDLIFE_COLORS.map((colors) => ({
      bird: makeMaterial(colors.bird, { roughness: 0.78 }),
      belly: makeMaterial(colors.belly, { roughness: 0.88 }),
      beak: makeMaterial(colors.beak, { roughness: 0.72 }),
      animal: makeMaterial(colors.animal, { roughness: 0.92 }),
      dark: makeMaterial(colors.dark, { roughness: 0.92 })
    }));

    const hemisphere = new THREE.HemisphereLight('#e9fbff', '#53634d', 0.45);
    scene.add(hemisphere);

    light = new THREE.DirectionalLight('#fff0ce', 0.62);
    light.position.set(-32, 54, 30);
    scene.add(light);
    scene.add(light.target);

    const waterMaterial = makeMaterial('#4e9eaf', {
      transparent: true,
      opacity: 0.7,
      roughness: 0.32,
      metalness: 0.08
    });
    water = new THREE.Mesh(new THREE.PlaneGeometry(20000, 20000), waterMaterial);
    water.rotation.x = -Math.PI / 2;
    water.position.y = -0.85;
    water.receiveShadow = true;
    scene.add(water);

    const domeMaterial = new THREE.MeshBasicMaterial({
      color: '#b9e2ed',
      side: THREE.BackSide,
      fog: false
    });
    skyDome = new THREE.Mesh(new THREE.SphereGeometry(440, 24, 16), domeMaterial);
    scene.add(skyDome);

    createClouds();
    players.push(createDragon(0), createDragon(1));
    buildNearbyChunks(true);
    updateBiomeColors(0, 0);
    resize();
  }

  function addBox(parent, material, position, size, castShadow = true) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
    mesh.position.set(...position);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = false;
    parent.add(mesh);
    return mesh;
  }

  const DRAGON_APPEARANCES = {
    toothless: {
      body: '#263449',
      dark: '#111c2c',
      belly: '#627b79',
      wing: '#416f65',
      eye: '#c1ff69',
      claw: '#dce4cb',
      marker: '#ff985b',
      fin: '#e66c58',
      glow: '#86efff'
    },
    light: {
      body: '#e8f4ec',
      dark: '#9eb9c4',
      belly: '#ffffff',
      wing: '#77b9c9',
      eye: '#48dded',
      claw: '#405667',
      marker: '#85efff',
      fin: '#83dce4',
      glow: '#86efff'
    }
  };

  function applyDragonAppearance(player, character) {
    const appearance = DRAGON_APPEARANCES[character];
    const materials = player.group.userData.appearanceMaterials;
    if (!appearance || !materials || player.group.userData.character === character) return;
    for (const key of ['body', 'dark', 'belly', 'wing', 'eye', 'claw', 'marker', 'fin', 'collar']) {
      materials[key].color.set(key === 'collar' ? appearance.marker : appearance[key]);
    }
    materials.eye.emissive.set(appearance.eye);
    materials.marker.emissive.set(appearance.marker);
    player.group.userData.glow.visible = character === 'light';
    player.group.userData.glow.color.set(appearance.glow);
    player.group.userData.character = character;
  }

  function createDragon(id) {
    const group = new THREE.Group();
    scene.add(group);

    const primary = id === 0 ? '#263449' : '#e8f4ec';
    const dark = id === 0 ? '#111c2c' : '#9eb9c4';
    const bellyColor = id === 0 ? '#627b79' : '#ffffff';
    const wingColor = id === 0 ? '#416f65' : '#77b9c9';
    const eyeColor = id === 0 ? '#c1ff69' : '#48dded';
    const body = makeMaterial(primary, { roughness: 0.69 });
    const darkMaterial = makeMaterial(dark, { roughness: 0.73 });
    const belly = makeMaterial(bellyColor, { roughness: 0.82 });
    const wing = makeMaterial(wingColor, { roughness: 0.7, side: THREE.DoubleSide });
    const eye = makeMaterial(eyeColor, { emissive: eyeColor, emissiveIntensity: 0.55 });
    const white = makeMaterial('#fff9dc', { roughness: 0.35 });
    const claw = makeMaterial(id === 0 ? '#dce4cb' : '#405667', { roughness: 0.5 });

    const markerColor = id === 0 ? '#ff985b' : '#85efff';
    const markerMaterial = makeMaterial(markerColor, {
      emissive: markerColor,
      emissiveIntensity: 0.7,
      roughness: 0.36
    });
    const marker = new THREE.Mesh(
      new THREE.TorusGeometry(0.79, 0.075, 7, 18),
      markerMaterial
    );
    marker.rotation.x = Math.PI / 2;
    marker.position.set(0, 0.12, 0);
    marker.castShadow = false;
    group.add(marker);

    addBox(group, darkMaterial, [0, 0.54, 0.03], [0.93, 0.52, 1.1]);
    const bodyMesh = addBox(group, body, [0, 0.91, 0.02], [0.86, 0.78, 1.56]);
    addBox(group, belly, [0, 0.55, -0.2], [0.64, 0.42, 0.93], false);
    addBox(group, body, [0, 0.97, -0.91], [0.76, 0.74, 0.78]);
    addBox(group, body, [0, 0.77, -1.37], [0.72, 0.38, 0.54]);
    addBox(group, darkMaterial, [0, 0.68, -1.6], [0.46, 0.16, 0.19]);

    for (const sign of [-1, 1]) {
      addBox(group, darkMaterial, [sign * 0.28, 1.44, -0.87], [0.16, 0.42, 0.2])
        .rotation.z = sign * -0.24;
      addBox(group, white, [sign * 0.29, 1.12, -1.272], [0.23, 0.24, 0.1], false);
      addBox(group, eye, [sign * 0.29, 1.12, -1.333], [0.11, 0.16, 0.06], false);

      const wingRoot = new THREE.Group();
      wingRoot.position.set(sign * 0.39, 1.15, 0.12);
      group.add(wingRoot);
      const membrane = addBox(wingRoot, wing, [sign * 0.64, 0, 0.25], [1.32, 0.095, 0.87]);
      membrane.rotation.x = 0.04;
      addBox(wingRoot, darkMaterial, [sign * 1.17, 0.02, 0.72], [0.32, 0.09, 0.34]);
      addBox(wingRoot, wing, [sign * 0.55, 0.03, 0.91], [0.56, 0.09, 0.37]);

      const leg = new THREE.Group();
      leg.position.set(sign * 0.3, 0.48, sign < 0 ? 0.52 : -0.46);
      group.add(leg);
      addBox(leg, body, [0, -0.02, 0], [0.32, 0.4, 0.38]);
      addBox(leg, darkMaterial, [0, -0.26, -0.08], [0.4, 0.16, 0.5]);
      for (const toe of [-1, 0, 1]) {
        addBox(leg, claw, [toe * 0.115, -0.3, -0.27], [0.075, 0.07, 0.1], false);
      }
      group.userData[sign < 0 ? 'leftWing' : 'rightWing'] = wingRoot;
      group.userData[sign < 0 ? 'leftLeg' : 'rightLeg'] = leg;
    }

    const tail = new THREE.Group();
    tail.position.set(0, 0.76, 0.74);
    group.add(tail);
    addBox(tail, darkMaterial, [0, 0, 0.42], [0.44, 0.37, 0.9]);
    addBox(tail, body, [0, 0, 0.97], [0.28, 0.25, 0.67]);
    const finMaterial = makeMaterial(id === 0 ? '#e66c58' : '#83dce4');
    const fin = addBox(tail, finMaterial, [0, 0.03, 1.41], [0.7, 0.18, 0.44]);
    fin.rotation.y = Math.PI / 4;

    const collarMaterial = makeMaterial(markerColor);
    const collar = addBox(group, collarMaterial, [0, 0.78, 0.83], [0.48, 0.32, 0.2]);
    collar.rotation.z = Math.PI / 4;
    group.userData.tail = tail;
    group.userData.body = bodyMesh;
    group.userData.appearanceMaterials = {
      body,
      dark: darkMaterial,
      belly,
      wing,
      eye,
      claw,
      marker: markerMaterial,
      fin: finMaterial,
      collar: collarMaterial
    };

    const glow = new THREE.PointLight('#86efff', 0.8, 8);
    glow.position.set(0, 1.5, 0);
    group.add(glow);
    group.userData.glow = glow;

    group.scale.setScalar(1.22);
    const x = id === 0 ? -1.5 : 1.5;
    const z = 0;
    group.position.set(x, groundAt(x, z), z);

    return {
      id,
      group,
      velocityX: 0,
      velocityZ: 0,
      velocityY: 0,
      yaw: 0,
      grounded: true,
      jumpWasDown: false,
      walkTime: 0,
      x,
      z
    };
  }

  function makeLeafMesh(x, y, z, scale, color, array) {
    array.push({ x, y, z, scale, color });
  }

  function makeWildlifeBox(parent, material, position, size) {
    const mesh = new THREE.Mesh(wildlifeGeometry, material);
    mesh.position.set(...position);
    mesh.scale.set(...size);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    parent.add(mesh);
    return mesh;
  }

  function createBird(x, y, z, materials, phase) {
    const group = new THREE.Group();
    group.scale.setScalar(2.2);
    group.position.set(x, y, z);
    makeWildlifeBox(group, materials.bird, [0, 0, 0], [0.42, 0.31, 0.72]);
    makeWildlifeBox(group, materials.belly, [0, -0.1, -0.09], [0.31, 0.14, 0.47]);
    makeWildlifeBox(group, materials.bird, [0, 0.16, -0.34], [0.3, 0.3, 0.3]);
    makeWildlifeBox(group, materials.beak, [0, 0.1, -0.55], [0.11, 0.09, 0.18]);

    const wings = [];
    for (const sign of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(sign * 0.16, 0.08, 0.02);
      group.add(pivot);
      makeWildlifeBox(pivot, materials.bird, [sign * 0.34, 0, 0.02], [0.72, 0.1, 0.32]);
      wings.push(pivot);
    }

    scene.add(group);
    const bird = {
      type: 'bird',
      group,
      wings,
      originX: x,
      originY: y,
      originZ: z,
      phase,
      speed: 0.38 + hash(x, z) * 0.3,
      radius: 2.4 + hash(z, x) * 3.4
    };
    wildlife.add(bird);
    return bird;
  }

  function createGroundAnimal(x, z, materials, phase, scale) {
    const group = new THREE.Group();
    group.scale.setScalar(scale);
    makeWildlifeBox(group, materials.animal, [0, 0.48, 0], [0.53, 0.43, 0.78]);
    makeWildlifeBox(group, materials.belly, [0, 0.4, -0.1], [0.38, 0.27, 0.42]);
    makeWildlifeBox(group, materials.animal, [0, 0.65, -0.43], [0.37, 0.4, 0.38]);
    makeWildlifeBox(group, materials.dark, [-0.12, 0.72, -0.6], [0.055, 0.07, 0.045]);
    makeWildlifeBox(group, materials.dark, [0.12, 0.72, -0.6], [0.055, 0.07, 0.045]);
    makeWildlifeBox(group, materials.belly, [0, 0.59, -0.63], [0.17, 0.13, 0.14]);
    makeWildlifeBox(group, materials.belly, [0, 0.85, 0.38], [0.2, 0.2, 0.2]);

    const legs = [];
    for (const side of [-1, 1]) {
      for (const end of [-1, 1]) {
        const leg = new THREE.Group();
        leg.position.set(side * 0.17, 0.36, end * 0.24);
        group.add(leg);
        makeWildlifeBox(leg, materials.animal, [0, -0.16, 0], [0.13, 0.4, 0.15]);
        makeWildlifeBox(leg, materials.dark, [0, -0.34, -0.015], [0.16, 0.09, 0.2]);
        legs.push(leg);
      }
    }

    const floor = groundAt(x, z);
    group.position.set(x, floor + 0.18, z);
    scene.add(group);
    const animal = {
      type: 'animal',
      group,
      legs,
      originX: x,
      originZ: z,
      floor,
      phase,
      speed: 0.18 + hash(x, z + 19) * 0.2,
      radius: 0.9 + hash(z - 7, x + 3) * 1.6
    };
    wildlife.add(animal);
    return animal;
  }

  function createChunkWildlife(chunkX, chunkZ, biome) {
    const creatures = [];
    const originX = chunkX * CHUNK_SIZE;
    const originZ = chunkZ * CHUNK_SIZE;
    const biomeIndex = BIOMES.indexOf(biome);
    const materials = wildlifeMaterials[biomeIndex];
    const seed = hash(chunkX + 401, chunkZ - 271);
    const animalSeed = hash(chunkX - 181, chunkZ + 397);

    if (seed > 0.84 || (chunkX === 0 && chunkZ === -1)) {
      const startingFlock = chunkX === 0 && chunkZ === -1;
      const x = startingFlock
        ? 2
        : originX + 5 + hash(chunkX + 13, chunkZ + 31) * (CHUNK_SIZE - 10);
      const z = startingFlock
        ? -9
        : originZ + 5 + hash(chunkX - 17, chunkZ + 7) * (CHUNK_SIZE - 10);
      const y = groundAt(x, z) + 2.7 + hash(x + 2, z - 5) * 1.6;
      const count = startingFlock || seed > 0.91 ? 2 : 1;
      for (let i = 0; i < count; i++) {
        const offset = (i - (count - 1) / 2) * 1.8;
        creatures.push(createBird(
          x + offset,
          y + hash(x + i, z - i) * 0.8,
          z + offset * 0.55,
          materials,
          hash(x + 23 + i, z - 19) * Math.PI * 2
        ));
      }
    }

    if (animalSeed > 0.9 || (chunkX === -1 && chunkZ === -1)) {
      const startingAnimal = chunkX === -1 && chunkZ === -1;
      const x = startingAnimal
        ? -7
        : originX + 6 + hash(chunkX + 43, chunkZ - 23) * (CHUNK_SIZE - 12);
      const z = startingAnimal
        ? -7
        : originZ + 6 + hash(chunkX - 37, chunkZ + 29) * (CHUNK_SIZE - 12);
      creatures.push(createGroundAnimal(
        x,
        z,
        materials,
        hash(x - 11, z + 17) * Math.PI * 2,
        startingAnimal ? 1.5 : 1 + hash(chunkX + 61, chunkZ + 3) * 0.22
      ));
    }

    return creatures;
  }

  function createChunk(chunkX, chunkZ) {
    const key = chunkX + ',' + chunkZ;
    if (chunks.has(key)) return;

    const blocks = [];
    const leaves = [];
    const trunks = [];
    const chunkCrystals = [];
    const chunkWildlife = [];
    const chunkCenterZ = chunkZ * CHUNK_SIZE + CHUNK_SIZE / 2;
    const biome = biomeAt(chunkX * CHUNK_SIZE + CHUNK_SIZE / 2, chunkCenterZ);

    for (let cellX = 0; cellX < CELLS_PER_CHUNK; cellX++) {
      for (let cellZ = 0; cellZ < CELLS_PER_CHUNK; cellZ++) {
        const x = chunkX * CHUNK_SIZE + cellX * CELL_SIZE + CELL_SIZE / 2;
        const z = chunkZ * CHUNK_SIZE + cellZ * CELL_SIZE + CELL_SIZE / 2;
        const surface = heightAt(x, z);
        const seed = hash(x, z);
        const accentChance = hash(x + 410, z - 220);

        for (let level = 0; level <= surface; level++) {
          const groundColor = level === surface
            ? (biome.grass)
            : (level === surface - 1 ? biome.soil : biome.rock);
          blocks.push({
            x, z, y: 1 + level * 2,
            color: colorAt(groundColor, hash(x + level * 9, z - level * 13)).clone()
          });
        }

        if (seed > 0.945 && (cellX > 1 && cellX < CELLS_PER_CHUNK - 2) &&
          (cellZ > 1 && cellZ < CELLS_PER_CHUNK - 2)) {
          const top = (surface + 1) * 2;
          const trunkX = x + (hash(x + 9, z) - 0.5) * 0.75;
          const trunkZ = z + (hash(x, z + 9) - 0.5) * 0.75;
          makeLeafMesh(trunkX, top + 1.2, trunkZ, [0.25, 0.8, 0.25], '#76513d', trunks);
          makeLeafMesh(trunkX, top + 2.55, trunkZ, [0.92, 0.83, 0.91], biome.leaves, leaves);
          makeLeafMesh(trunkX - 0.65, top + 2.05, trunkZ + 0.15, [0.59, 0.57, 0.61], biome.leaves, leaves);
          makeLeafMesh(trunkX + 0.63, top + 2.1, trunkZ - 0.1, [0.57, 0.6, 0.59], biome.leaves, leaves);
          makeLeafMesh(trunkX + 0.03, top + 3.25, trunkZ + 0.05, [0.6, 0.59, 0.65], biome.grass, leaves);
        } else if (accentChance > 0.976) {
          const top = (surface + 1) * 2;
          makeLeafMesh(x, top + 0.38, z, [0.29, 0.39, 0.29], biome.grass, leaves);
        }
      }
    }

    const shardCount = 1 + (hash(chunkX + 61, chunkZ - 39) > 0.54 ? 1 : 0);
    for (let shard = 0; shard < shardCount; shard++) {
      const localX = Math.floor(hash(chunkX + 190 + shard * 7, chunkZ + 3) * CELLS_PER_CHUNK);
      const localZ = Math.floor(hash(chunkX - 10, chunkZ + 260 + shard * 11) * CELLS_PER_CHUNK);
      const x = chunkX * CHUNK_SIZE + localX * CELL_SIZE + CELL_SIZE / 2;
      const z = chunkZ * CHUNK_SIZE + localZ * CELL_SIZE + CELL_SIZE / 2;
      const crystal = new THREE.Mesh(crystalGeometry, crystalMaterial);
      crystal.position.set(x, (heightAt(x, z) + 1) * 2 + 0.95, z);
      crystal.rotation.x = hash(x, z) * 0.5;
      crystal.userData.baseY = crystal.position.y;
      crystal.userData.phase = hash(z + 71, x - 13) * Math.PI * 2;
      crystal.castShadow = false;
      scene.add(crystal);
      crystals.add(crystal);
      chunkCrystals.push(crystal);
    }

    const terrain = makeChunkMesh(blocks, terrainMaterial);
    const foliage = makeChunkMesh(leaves, foliageMaterial);
    const trunksMesh = makeChunkMesh(trunks, trunkMaterial);
    chunkWildlife.push(...createChunkWildlife(chunkX, chunkZ, biome));
    scene.add(terrain, foliage, trunksMesh);
    chunks.set(key, {
      chunkX,
      chunkZ,
      meshes: [terrain, foliage, trunksMesh],
      crystals: chunkCrystals,
      wildlife: chunkWildlife
    });
  }

  function makeChunkMesh(instances, material) {
    const mesh = new THREE.InstancedMesh(sharedBlock, material, Math.max(instances.length, 1));
    mesh.count = instances.length;
    for (let i = 0; i < instances.length; i++) {
      const item = instances[i];
      setInstance(
        mesh,
        i,
        item.x,
        item.y,
        item.z,
        item.scale ? item.scale[0] : 1,
        item.scale ? item.scale[1] : 1,
        item.scale ? item.scale[2] : 1,
        colorAt(item.color, hash(item.x + i * 7, item.z - i * 11), 0.08)
      );
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    return mesh;
  }

  function buildNearbyChunks(force = false) {
    if (!players.length) return;
    const centerX = players.reduce((sum, player) => sum + player.x, 0) / players.length;
    const centerZ = players.reduce((sum, player) => sum + player.z, 0) / players.length;
    const baseChunkX = Math.floor(centerX / CHUNK_SIZE);
    const baseChunkZ = Math.floor(centerZ / CHUNK_SIZE);
    const required = new Set();

    for (let dx = -VISIBLE_RADIUS; dx <= VISIBLE_RADIUS; dx++) {
      for (let dz = -VISIBLE_RADIUS; dz <= VISIBLE_RADIUS; dz++) {
        const chunkX = baseChunkX + dx;
        const chunkZ = baseChunkZ + dz;
        const key = chunkX + ',' + chunkZ;
        required.add(key);
        createChunk(chunkX, chunkZ);
      }
    }

    for (const [key, chunk] of chunks) {
      if (required.has(key)) continue;
      for (const mesh of chunk.meshes) {
        scene.remove(mesh);
        mesh.dispose();
      }
      for (const crystal of chunk.crystals) {
        scene.remove(crystal);
        crystals.delete(crystal);
      }
      for (const creature of chunk.wildlife) {
        scene.remove(creature.group);
        wildlife.delete(creature);
      }
      chunks.delete(key);
    }
  }

  function createClouds() {
    const cloudMaterial = makeMaterial('#fff8e9', { transparent: true, opacity: 0.74, roughness: 1 });
    for (let i = 0; i < 13; i++) {
      const group = new THREE.Group();
      group.position.set((hash(i, 8) - 0.5) * 260, 25 + hash(i, 13) * 26, (hash(i, 19) - 0.5) * 310);
      group.scale.setScalar(1.6 + hash(i + 4, 2) * 3);
      for (let puff = 0; puff < 4; puff++) {
        const shape = addBox(
          group,
          cloudMaterial,
          [(puff - 1.5) * 0.9, hash(puff, i) * 0.22, hash(i, puff) * 0.4],
          [1.35, 0.38 + hash(i + puff, 1) * 0.18, 1.05],
          false
        );
        shape.castShadow = false;
      }
      scene.add(group);
      clouds.push({ group, baseX: group.position.x, baseY: group.position.y, phase: i * 0.8 });
    }
  }

  function updateBiomeColors(x, z) {
    const biome = biomeAt(x, z);
    const fogColor = new THREE.Color(biome.grass).lerp(new THREE.Color('#a8d7e5'), 0.58);
    scene.fog.color.copy(fogColor);
    scene.background.copy(fogColor);
    skyDome.material.color.copy(fogColor).lerp(new THREE.Color('#e3f7ff'), 0.28);
    water.material.color.set(biome.ground).lerp(new THREE.Color('#317b9c'), 0.72);
    light.color.set(biome.grass).lerp(new THREE.Color('#fff1d2'), 0.65);
    regionLabel.textContent = biome.name;
  }

  function resize() {
    if (!renderer || !camera) return;
    const width = Math.max(1, root.clientWidth);
    const height = Math.max(1, root.clientHeight);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  }

  function loadPeerJs() {
    if (window.Peer) return Promise.resolve(window.Peer);
    if (peerLoader) return peerLoader;
    peerLoader = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js';
      script.async = true;
      script.onload = () => {
        if (window.Peer) resolve(window.Peer);
        else reject(new Error('PeerJS se cargó, pero no está disponible.'));
      };
      script.onerror = () => reject(new Error('No se pudo cargar PeerJS. Revisa tu conexión a Internet.'));
      document.head.appendChild(script);
    }).catch((error) => {
      peerLoader = null;
      throw error;
    });
    return peerLoader;
  }

  function startPlay(mode) {
    playMode = mode;
    lobby.hidden = true;
    invitePanel.hidden = mode !== 'online-host';
    networkStatus.textContent = '';
    if (mode === 'online-client') remoteStates.fill(null);
    root.classList.remove('world3d--bot', 'world3d--online-host', 'world3d--online-client');
    if (mode === 'bot') {
      applyDragonAppearance(players[0], playerCharacters[0]);
      applyDragonAppearance(players[1], playerCharacters[0] === 'toothless' ? 'light' : 'toothless');
      root.classList.add('world3d--bot');
      modeLabel.textContent = '1 JUGADOR · COMPAÑERO BOT';
      worldHint.innerHTML = '<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> + <kbd>ESPACIO</kbd> · <kbd>F</kbd> VOLAR';
    } else if (mode === 'online-host') {
      applyDragonAppearance(players[0], playerCharacters[0]);
      applyDragonAppearance(players[1], playerCharacters[1]);
      root.classList.add('world3d--online-host');
      modeLabel.textContent = 'SALA ONLINE · ERES EL JUGADOR 1';
      worldHint.innerHTML = '<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> + <kbd>ESPACIO</kbd> · <kbd>F</kbd> VOLAR';
    } else if (mode === 'online-client') {
      applyDragonAppearance(players[0], playerCharacters[0]);
      applyDragonAppearance(players[1], playerCharacters[1]);
      root.classList.add('world3d--online-client');
      modeLabel.textContent = 'SALA ONLINE · ERES EL JUGADOR 2';
      worldHint.innerHTML = '<kbd>↑</kbd><kbd>←</kbd><kbd>↓</kbd><kbd>→</kbd> + <kbd>ENTER</kbd> · <kbd>R</kbd> VOLAR';
    } else {
      applyDragonAppearance(players[0], playerCharacters[0]);
      applyDragonAppearance(players[1], playerCharacters[1]);
      modeLabel.textContent = 'COOPERATIVO LOCAL · 2 JUGADORES';
      worldHint.innerHTML = '<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> + <kbd>ESPACIO</kbd> · <kbd>↑</kbd><kbd>←</kbd><kbd>↓</kbd><kbd>→</kbd> + <kbd>ENTER</kbd> · <kbd>F/R</kbd>';
    }
    if (mode === 'online-host') inviteStatus.textContent = 'Esperando al jugador 2…';
  }

  function showNetworkError(error) {
    const message = error && error.message ? error.message : String(error);
    const destination = playMode === 'online-host' ? inviteStatus : networkStatus;
    destination.textContent = `Error de conexión: ${message}`;
    console.error('Error de conexión de la sala:', error);
  }

  function closeOnlineSession() {
    const connection = roomConnection;
    const activePeer = peer;
    roomConnection = null;
    peer = null;
    if (connection) connection.close();
    if (activePeer && !activePeer.destroyed) activePeer.destroy();
  }

  function registerConnection(connection, role) {
    roomConnection = connection;
    connection.on('open', () => {
      if (role === 'client') {
        startPlay('online-client');
        invitePanel.hidden = true;
      } else {
        remoteCameraYaw = cameraYaw;
        controls[1].forward = false;
        controls[1].back = false;
        controls[1].left = false;
        controls[1].right = false;
        controls[1].jump = false;
        controls[1].fly = false;
        inviteStatus.textContent = '¡Jugador 2 conectado! Ya pueden jugar.';
        invitePanel.hidden = true;
      }
    });
    connection.on('data', (data) => {
      networkReceived += 1;
      if (!data || typeof data !== 'object') return;
      if (role === 'host' && data.type === 'input' && data.controls) {
        if (Number.isFinite(data.cameraYaw)) remoteCameraYaw = data.cameraYaw;
        if (data.character === 'toothless' || data.character === 'light') {
          applyDragonAppearance(players[1], data.character);
        }
        for (const action of ['forward', 'back', 'left', 'right', 'jump', 'fly']) {
          controls[1][action] = data.controls[action] === true;
        }
      } else if (role === 'client' && data.type === 'state' && Array.isArray(data.players)) {
        for (const state of data.players) {
          if (!Number.isInteger(state.id)) continue;
          const player = players[state.id];
          if (!player || ![state.x, state.y, state.z, state.yaw].every(Number.isFinite)) continue;
          remoteStates[state.id] = {
            x: state.x,
            y: state.y,
            z: state.z,
            yaw: state.yaw,
            grounded: state.grounded === true,
            wing: Number.isFinite(state.wing) ? state.wing : 0
          };
          if (state.character === 'toothless' || state.character === 'light') {
            applyDragonAppearance(player, state.character);
          }
        }
      }
    });
    connection.on('close', () => {
      if (roomConnection !== connection) return;
      roomConnection = null;
      if (role === 'host') {
        controls[1].forward = false;
        controls[1].back = false;
        controls[1].left = false;
        controls[1].right = false;
        controls[1].jump = false;
        controls[1].fly = false;
        invitePanel.hidden = false;
        inviteStatus.textContent = 'El jugador 2 se desconectó. Esperando que vuelva a unirse…';
      } else {
        playMode = 'lobby';
        controls[1].forward = false;
        controls[1].back = false;
        controls[1].left = false;
        controls[1].right = false;
        controls[1].jump = false;
        controls[1].fly = false;
        lobby.hidden = false;
        networkStatus.textContent = 'Se perdió la conexión con la sala. Intenta unirte de nuevo.';
      }
    });
    connection.on('error', showNetworkError);
  }

  async function createRoom() {
    createRoomButton.disabled = true;
    networkStatus.textContent = 'Creando sala online…';
    try {
      const PeerClient = await loadPeerJs();
      const randomValue = new Uint32Array(1);
      window.crypto.getRandomValues(randomValue);
      const code = String(randomValue[0] % 1000000).padStart(6, '0');
      peer = new PeerClient(`dragon-${code}`, { debug: 0 });
      peer.on('open', () => {
        startPlay('online-host');
        inviteCodeOutput.textContent = code;
      });
      peer.on('connection', (connection) => {
        if (roomConnection) {
          connection.close();
          return;
        }
        registerConnection(connection, 'host');
      });
      peer.on('error', (error) => {
        if (error.type === 'unavailable-id') {
          showNetworkError(new Error('Ese código ya está ocupado. Cierra la sala e inténtalo otra vez.'));
          closeOnlineSession();
          return;
        }
        showNetworkError(error);
      });
    } catch (error) {
      showNetworkError(error);
    } finally {
      createRoomButton.disabled = false;
    }
  }

  async function joinRoom(event) {
    event.preventDefault();
    const code = roomCodeInput.value.trim();
    if (!/^\d{6}$/.test(code)) {
      networkStatus.textContent = 'Escribe el código de sala de seis dígitos.';
      roomCodeInput.focus();
      return;
    }
    const joinButton = joinForm.querySelector('button[type="submit"]');
    joinButton.disabled = true;
    networkStatus.textContent = 'Conectando con el jugador 1…';
    try {
      const PeerClient = await loadPeerJs();
      peer = new PeerClient({ debug: 0 });
      peer.on('open', () => {
        const connection = peer.connect(`dragon-${code}`, { reliable: true });
        registerConnection(connection, 'client');
      });
      peer.on('error', (error) => {
        if (error.type === 'peer-unavailable') {
          networkStatus.textContent = 'No se encontró esa sala. Revisa el código o espera a que el jugador 1 la cree.';
          closeOnlineSession();
          return;
        }
        showNetworkError(error);
      });
    } catch (error) {
      showNetworkError(error);
    } finally {
      joinButton.disabled = false;
    }
  }

  function openWorld() {
    if (isOpen) return;
    if (!window.THREE) {
      loading.hidden = false;
      loading.textContent = 'NO SE PUDO CARGAR THREE.JS.\nREVISA TU CONEXIÓN A INTERNET Y RECARGA LA PÁGINA.';
      return;
    }
    try {
      if (!renderer) buildWorld();
      isOpen = true;
      root.classList.add('is-open');
      lobby.hidden = false;
      invitePanel.hidden = true;
      networkStatus.textContent = '';
      root.classList.remove('world3d--bot', 'world3d--online-host', 'world3d--online-client');
      playMode = 'lobby';
      root.classList.toggle('world3d--touch', navigator.maxTouchPoints > 0 || 'ontouchstart' in window);
      root.setAttribute('aria-hidden', 'false');
      document.body.classList.add('is-world');
      window.dragonGame.suspendArcade();
      loading.hidden = true;
      resize();
      lastTime = performance.now();
      updateBiomeColors(
        players.reduce((sum, player) => sum + player.x, 0) / players.length,
        players.reduce((sum, player) => sum + player.z, 0) / players.length
      );
      updateCamera(1);
      frame = requestAnimationFrame(animate);
      canvas.focus({ preventScroll: true });
    } catch (error) {
      root.classList.add('is-open');
      root.setAttribute('aria-hidden', 'false');
      document.body.classList.add('is-world');
      window.dragonGame.suspendArcade();
      loading.hidden = false;
      loading.textContent = 'NO SE PUDO CREAR EL MUNDO 3D. RECARGA LA PÁGINA E INTÉNTALO DE NUEVO.';
      console.error('Error al crear el mundo 3D:', error);
    }
  }

  function closeWorld() {
    if (!isOpen) return;
    isOpen = false;
    cancelAnimationFrame(frame);
    closeOnlineSession();
    heldKeys.clear();
    touchButtons.clear();
    clearControls();
    root.classList.remove('is-open');
    root.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('is-world');
    window.dragonGame.showTitle();
    if (menuButton) menuButton.focus({ preventScroll: true });
  }

  function clearControls() {
    for (const input of controls) {
      input.forward = false;
      input.back = false;
      input.left = false;
      input.right = false;
      input.jump = false;
      input.fly = false;
    }
    root.querySelectorAll('.is-pressed').forEach((button) => button.classList.remove('is-pressed'));
  }

  function setControl(player, action, enabled) {
    if (!controls[player] || !Object.hasOwn(controls[player], action)) return;
    controls[player][action] = enabled;
  }

  function updateKeyboardControls() {
    const keyMappings = [
      { player: 0, forward: ['KeyW'], back: ['KeyS'], left: ['KeyA'], right: ['KeyD'], jump: ['Space'], fly: ['KeyF'] },
      { player: 1, forward: ['ArrowUp'], back: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'], jump: ['Enter'], fly: ['KeyR'] }
    ];
    for (const mapping of keyMappings) {
      if ((playMode === 'online-host' && mapping.player === 1) ||
        (playMode === 'online-client' && mapping.player === 0)) continue;
      for (const action of ['forward', 'back', 'left', 'right', 'jump', 'fly']) {
        const keys = mapping[action];
        setControl(mapping.player, action,
          touchButtons.has(`${mapping.player}:${action}`) || keys.some((key) => heldKeys.has(key)));
      }
    }
  }

  function updateGamepadControls() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (let index = 0; index < 2; index++) {
      const pad = pads[index];
      if (!pad || !pad.connected) continue;
      if ((playMode === 'online-host' && index === 1) ||
        (playMode === 'online-client' && index === 0)) continue;
      const axisX = pad.axes[0] || 0;
      const axisY = pad.axes[1] || 0;
      const trigger = (button) => Boolean(pad.buttons[button] && pad.buttons[button].pressed);
      const dead = 0.22;
      const player = controls[index];
      player.left ||= axisX < -dead || trigger(14);
      player.right ||= axisX > dead || trigger(15);
      player.forward ||= axisY < -dead || trigger(12);
      player.back ||= axisY > dead || trigger(13);
      player.jump ||= trigger(0);
      player.fly ||= trigger(1);
    }
  }

  function updateBotControls() {
    if (playMode !== 'bot') return;
    const leader = players[0];
    const bot = players[1];
    const targetX = leader.x + Math.sin(leader.yaw) * 2.4;
    const targetZ = leader.z + Math.cos(leader.yaw) * 2.4;
    const deltaX = targetX - bot.x;
    const deltaZ = targetZ - bot.z;
    const distance = Math.hypot(deltaX, deltaZ);
    if (distance <= 1.8) {
      controls[1].forward = false;
      controls[1].back = false;
      controls[1].left = false;
      controls[1].right = false;
      controls[1].jump = false;
      controls[1].fly = false;
      return;
    }
    const sin = Math.sin(cameraYaw);
    const cos = Math.cos(cameraYaw);
    const localRight = deltaX * cos - deltaZ * sin;
    const localForward = -deltaX * sin - deltaZ * cos;
    const deadZone = 0.35;
    controls[1].right = localRight > deadZone;
    controls[1].left = localRight < -deadZone;
    controls[1].forward = localForward > deadZone;
    controls[1].back = localForward < -deadZone;
    controls[1].jump = false;
    controls[1].fly = false;
  }

  function movementVector(input, yaw = cameraYaw) {
    let right = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    let forward = (input.forward ? 1 : 0) - (input.back ? 1 : 0);
    const length = Math.hypot(right, forward);
    if (length > 1) {
      right /= length;
      forward /= length;
    }
    const sin = Math.sin(yaw);
    const cos = Math.cos(yaw);
    return {
      x: right * cos - forward * sin,
      z: -right * sin - forward * cos,
      moving: length > 0
    };
  }

  function updatePlayer(player, dt, elapsed) {
    const input = controls[player.id];
    const controlYaw = playMode === 'online-host' && player.id === 1 ? remoteCameraYaw : cameraYaw;
    const direction = movementVector(input, controlYaw);
    const targetSpeed = direction.moving ? 7.3 : 0;
    const acceleration = 1 - Math.exp(-11 * dt);
    const targetX = direction.x * targetSpeed;
    const targetZ = direction.z * targetSpeed;
    player.velocityX += (targetX - player.velocityX) * acceleration;
    player.velocityZ += (targetZ - player.velocityZ) * acceleration;

    player.x += player.velocityX * dt;
    player.z += player.velocityZ * dt;
    player.grounded = false;

    const floor = groundAt(player.x, player.z);
    if (input.fly) player.velocityY = Math.min(5.2, player.velocityY + 18 * dt);
    else player.velocityY -= 21 * dt;
    player.group.position.y += player.velocityY * dt;
    if (player.group.position.y <= floor) {
      player.group.position.y = floor;
      player.velocityY = 0;
      player.grounded = true;
    }

    if (input.jump && !player.jumpWasDown && player.grounded) {
      player.velocityY = 8.5;
      player.grounded = false;
    }
    player.jumpWasDown = input.jump;

    const moving = Math.hypot(player.velocityX, player.velocityZ) > 0.55;
    if (moving) {
      player.yaw = Math.atan2(-player.velocityX, -player.velocityZ);
      player.walkTime += dt * Math.min(1.5, Math.hypot(player.velocityX, player.velocityZ) / 5.2);
    }
    player.group.rotation.y = player.yaw;
    player.group.position.x = player.x;
    player.group.position.z = player.z;
    player.group.position.y += player.grounded ? Math.abs(Math.sin(elapsed * 2.8 + player.id)) * 0.028 : 0;
    for (const crystal of crystals) {
      const distance = Math.hypot(crystal.position.x - player.x, crystal.position.z - player.z);
      if (distance < 1.55 && Math.abs(crystal.position.y - player.group.position.y - 0.75) < 2.35) {
        crystalsFound += 1;
        scene.remove(crystal);
        crystals.delete(crystal);
        break;
      }
    }

    const wingMotion = Math.sin(elapsed * (moving || input.fly ? 11 : 2.3) + player.id * Math.PI) *
      (moving || input.fly ? 0.48 : 0.13);
    player.group.userData.leftWing.rotation.x = wingMotion;
    player.group.userData.rightWing.rotation.x = -wingMotion;
    player.group.userData.leftWing.rotation.z = moving ? -0.11 : 0;
    player.group.userData.rightWing.rotation.z = moving ? 0.11 : 0;
    player.group.userData.leftLeg.rotation.x = moving ? Math.sin(player.walkTime * 8) * 0.43 : 0;
    player.group.userData.rightLeg.rotation.x = moving ? -Math.sin(player.walkTime * 8) * 0.43 : 0;
    player.group.userData.tail.rotation.y = Math.sin(elapsed * 2.2 + player.id) * 0.2;
    player.group.userData.body.scale.y = 1 + Math.sin(elapsed * 2.3 + player.id * 1.6) * 0.018;
  }

  function updateRemotePlayers(dt) {
    const smooth = 1 - Math.exp(-14 * dt);
    for (const player of players) {
      const state = remoteStates[player.id];
      if (!state) continue;
      player.x += (state.x - player.x) * smooth;
      player.z += (state.z - player.z) * smooth;
      player.group.position.x = player.x;
      player.group.position.y += (state.y - player.group.position.y) * smooth;
      player.group.position.z = player.z;
      const angleDelta = Math.atan2(Math.sin(state.yaw - player.yaw), Math.cos(state.yaw - player.yaw));
      player.yaw += angleDelta * smooth;
      player.group.rotation.y = player.yaw;
      player.grounded = state.grounded;
      player.group.userData.leftWing.rotation.x +=
        (state.wing - player.group.userData.leftWing.rotation.x) * smooth;
      player.group.userData.rightWing.rotation.x = -player.group.userData.leftWing.rotation.x;
    }
  }

  function updateCamera(dt) {
    const midpointX = (players[0].x + players[1].x) / 2;
    const midpointZ = (players[0].z + players[1].z) / 2;
    const separation = Math.hypot(players[0].x - players[1].x, players[0].z - players[1].z);
    const distance = THREE.MathUtils.clamp(14 + separation * 0.55, 14, 40);
    const pitch = THREE.MathUtils.degToRad(cameraTilt);
    const horizontal = Math.cos(pitch) * distance;
    const averageHeight = (players[0].group.position.y + players[1].group.position.y) / 2;
    const target = new THREE.Vector3(midpointX, averageHeight + 1.6 + separation * 0.035, midpointZ);
    const desiredPosition = new THREE.Vector3(
      midpointX + Math.sin(cameraYaw) * horizontal,
      target.y + Math.sin(pitch) * distance,
      midpointZ + Math.cos(cameraYaw) * horizontal
    );
    const smooth = 1 - Math.exp(-4.2 * dt);
    camera.position.lerp(desiredPosition, smooth);
    camera.lookAt(target);

    light.position.set(midpointX - 32, 54, midpointZ + 30);
    light.target.position.set(midpointX, 0, midpointZ);
    if (water) water.position.set(midpointX, -0.85, midpointZ);
    if (skyDome) skyDome.position.set(midpointX, 0, midpointZ);

    const region = biomeAt(midpointX, midpointZ);
    const targetFog = new THREE.Color(region.grass).lerp(new THREE.Color('#a8d7e5'), 0.58);
    scene.fog.color.lerp(targetFog, Math.min(1, dt * 0.75));
    scene.background.copy(scene.fog.color);
    skyDome.material.color.copy(scene.fog.color).lerp(new THREE.Color('#e3f7ff'), 0.28);
    water.material.color.set(region.ground).lerp(new THREE.Color('#317b9c'), 0.72);
    light.color.set(region.grass).lerp(new THREE.Color('#fff1d2'), 0.65);
    regionLabel.textContent = region.name;

    return { midpointX, midpointZ };
  }

  function updateClouds(elapsed) {
    for (const cloud of clouds) {
      cloud.group.position.x = cloud.baseX + Math.sin(elapsed * 0.035 + cloud.phase) * 12;
      cloud.group.position.y = cloud.baseY + Math.sin(elapsed * 0.2 + cloud.phase) * 0.8;
    }
  }

  function updateWildlife(elapsed, dt) {
    for (const creature of wildlife) {
      const angle = elapsed * creature.speed + creature.phase;
      if (creature.type === 'bird') {
        creature.group.position.set(
          creature.originX + Math.cos(angle) * creature.radius,
          creature.originY + Math.sin(angle * 1.7) * 1.15,
          creature.originZ + Math.sin(angle) * creature.radius
        );
        creature.group.rotation.y = Math.atan2(Math.sin(angle), -Math.cos(angle));
        const flap = Math.sin(elapsed * 8 + creature.phase) * 0.72;
        creature.wings[0].rotation.z = -flap;
        creature.wings[1].rotation.z = flap;
        continue;
      }

      const nextX = creature.originX + Math.cos(angle) * creature.radius;
      const nextZ = creature.originZ + Math.sin(angle) * creature.radius;
      const directionX = nextX - creature.group.position.x;
      const directionZ = nextZ - creature.group.position.z;
      creature.floor = groundAt(nextX, nextZ);
      creature.group.position.set(nextX, creature.floor + 0.18 + Math.abs(Math.sin(angle * 8)) * 0.045, nextZ);
      creature.group.rotation.y = Math.atan2(-directionX, -directionZ);
      const step = Math.sin(elapsed * 9 + creature.phase) * Math.min(0.55, dt * 10);
      creature.legs[0].rotation.x = step;
      creature.legs[3].rotation.x = step;
      creature.legs[1].rotation.x = -step;
      creature.legs[2].rotation.x = -step;
    }
  }

  function updateCrystals(elapsed, dt) {
    for (const crystal of crystals) {
      crystal.rotation.y += dt * 1.4;
      crystal.position.y = crystal.userData.baseY + Math.sin(elapsed * 2.1 + crystal.userData.phase) * 0.22;
    }
  }

  function sendNetworkFrame(dt) {
    if (!roomConnection || !roomConnection.open) return;
    networkTimer += dt;
    if (networkTimer < 1 / 15) return;
    networkTimer = 0;
    if (playMode === 'online-host') {
      roomConnection.send({
        type: 'state',
        players: players.map((player) => ({
          id: player.id,
          x: player.x,
          y: player.group.position.y,
          z: player.z,
          yaw: player.yaw,
          grounded: player.grounded,
          wing: player.group.userData.leftWing.rotation.x,
          character: player.group.userData.character
        }))
      });
      networkSent += 1;
    } else if (playMode === 'online-client') {
      roomConnection.send({
        type: 'input',
        controls: { ...controls[1] },
        cameraYaw,
        character: playerCharacters[1]
      });
      networkSent += 1;
    }
  }

  function animate(now) {
    if (!isOpen) return;
    frame = requestAnimationFrame(animate);
    const dt = Math.min(0.04, Math.max(0, (now - lastTime) / 1000));
    lastTime = now;
    const elapsed = now / 1000;

    updateKeyboardControls();
    updateGamepadControls();
    updateBotControls();
    if (playMode === 'online-client') updateRemotePlayers(dt);
    else for (const player of players) updatePlayer(player, dt, elapsed);
    sendNetworkFrame(dt);
    const center = updateCamera(dt);
    buildNearbyChunks();
    updateClouds(elapsed);
    updateWildlife(elapsed, dt);
    updateCrystals(elapsed, dt);

    hudTimer += dt;
    if (hudTimer >= 0.14) {
      hudTimer = 0;
      positionLabel.textContent =
        `X ${Math.round(center.midpointX)} · Z ${Math.round(center.midpointZ)} · CRISTALES ${crystalsFound}`;
    }

    renderer.render(scene, camera);
  }

  menuButton.addEventListener('click', openWorld);
  exitButton.addEventListener('click', closeWorld);
  root.querySelectorAll('.world3d__character-option').forEach((button) => {
    button.addEventListener('click', () => {
      const player = Number(button.dataset.player);
      const character = button.dataset.character;
      if (!Number.isInteger(player) || player < 0 || player > 1 || !DRAGON_APPEARANCES[character]) return;
      playerCharacters[player] = character;
      root.querySelectorAll(`.world3d__character-option[data-player="${player}"]`).forEach((option) => {
        const selected = option === button;
        option.classList.toggle('is-selected', selected);
        option.setAttribute('aria-pressed', String(selected));
      });
    });
  });
  botStartButton.addEventListener('click', () => startPlay('bot'));
  localStartButton.addEventListener('click', () => startPlay('local'));
  createRoomButton.addEventListener('click', createRoom);
  joinForm.addEventListener('submit', joinRoom);
  lobbyBack.addEventListener('click', closeWorld);
  inviteCancelButton.addEventListener('click', () => {
    closeOnlineSession();
    playMode = 'lobby';
    controls[1].forward = false;
    controls[1].back = false;
    controls[1].left = false;
    controls[1].right = false;
    controls[1].jump = false;
    controls[1].fly = false;
    invitePanel.hidden = true;
    lobby.hidden = false;
    networkStatus.textContent = 'Sala cancelada.';
  });
  window.addEventListener('resize', resize);
  window.addEventListener('blur', () => {
    heldKeys.clear();
    touchButtons.clear();
    clearControls();
  });

  window.addEventListener('keydown', (event) => {
    if (!isOpen) return;
    const allowed = [
      'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'KeyF', 'KeyR',
      'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Escape'
    ];
    if (!allowed.includes(event.code)) return;
    event.preventDefault();
    if (event.code === 'Escape') {
      closeWorld();
      return;
    }
    heldKeys.add(event.code);
  }, { passive: false });

  window.addEventListener('keyup', (event) => {
    heldKeys.delete(event.code);
  });

  canvas.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    pointerId = event.pointerId;
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
    if (event.isTrusted) canvas.setPointerCapture(event.pointerId);
  });

  canvas.addEventListener('pointermove', (event) => {
    if (event.pointerId !== pointerId) return;
    const deltaX = event.clientX - lastPointerX;
    const deltaY = event.clientY - lastPointerY;
    cameraYaw -= deltaX * 0.008;
    cameraTilt = THREE.MathUtils.clamp(cameraTilt + deltaY * 0.16, 8, 78);
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
  });

  const releaseLook = (event) => {
    if (event.pointerId === pointerId) pointerId = null;
  };
  canvas.addEventListener('pointerup', releaseLook);
  canvas.addEventListener('pointercancel', releaseLook);
  canvas.addEventListener('lostpointercapture', releaseLook);

  root.querySelectorAll('.world3d__pads [data-move]').forEach((button) => {
    const player = Number(button.closest('[data-player]').dataset.player);
    const action = button.dataset.move;
    const key = `${player}:${action}`;

    const press = (event) => {
      event.preventDefault();
      touchButtons.add(key);
      button.classList.add('is-pressed');
      if (button.setPointerCapture && event.isTrusted && event.pointerId !== undefined) {
        button.setPointerCapture(event.pointerId);
      }
    };

    const release = (event) => {
      if (event) event.preventDefault();
      touchButtons.delete(key);
      button.classList.remove('is-pressed');
    };

    button.addEventListener('pointerdown', press);
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('lostpointercapture', release);
    button.addEventListener('contextmenu', (event) => event.preventDefault());
  });

  window.addEventListener('gamepadconnected', () => {
    document.getElementById('worldHint').textContent = playMode === 'bot'
      ? 'MANDO 1 + BOT · MOUSE: GIRAR CÁMARA'
      : 'MANDOS · MOUSE: GIRAR CÁMARA';
  });

  window.addEventListener('gamepaddisconnected', () => {
    document.getElementById('worldHint').textContent = 'W A S D + ESPACIO · F VOLAR';
  });

  window.dragonWorld = {
    open: openWorld,
    close: closeWorld,
    get players() {
      return players.map(({ id, x, z, grounded, group }) => ({
        id,
        x,
        y: group.position.y,
        z,
        grounded,
        character: group.userData.character
      }));
    },
    get chunkCount() { return chunks.size; },
    get wildlifeCount() {
      let birds = 0;
      let animals = 0;
      for (const creature of wildlife) {
        if (creature.type === 'bird') birds += 1;
        else animals += 1;
      }
      return { birds, animals, total: wildlife.size };
    },
    get isOpen() { return isOpen; },
    get network() {
      return {
        mode: playMode,
        connected: Boolean(roomConnection && roomConnection.open),
        sent: networkSent,
        received: networkReceived,
        remoteControls: { ...controls[1] }
      };
    },
    setControl,
    step(dt) {
      updateKeyboardControls();
      updateGamepadControls();
      updateBotControls();
      const elapsed = performance.now() / 1000;
      if (playMode === 'online-client') updateRemotePlayers(dt);
      else for (const player of players) updatePlayer(player, dt, elapsed);
      sendNetworkFrame(dt);
      const center = updateCamera(dt);
      buildNearbyChunks();
      updateClouds(elapsed);
      updateWildlife(elapsed, dt);
      updateCrystals(elapsed, dt);
      return center;
    }
  };
})();
