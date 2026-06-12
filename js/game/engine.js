// Motor visual 3D: infraestrutura digital noturna — a ponte é o foco,
// atravessando um "mar de dados" (grade estilo circuito com fluxos
// luminosos passando por baixo). À esquerda, o distrito da REDE LOCAL
// (prédios baixos e torre de comunicação, acento verde); à direita, o
// distrito da INTERNET (data center e torres de servidores, acento azul).
// Os veículos entram e saem por gateways em túnel nas duas pontas, então
// nunca surgem nem desaparecem "do nada".
// O modo cinematográfico troca a paleta para neon synthwave e orbita a câmera.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export const BRIDGE = {
  length: 240,        // ao longo do eixo X
  deckWidth: 26,
  deckY: 8,           // altura do tabuleiro sobre o piso de dados
  spawnX: 132,        // onde os veículos nascem/desaparecem (dentro dos túneis)
  lanesOut: [-3.4, -6.8, -10.2], // z das faixas sentido local -> internet (+X)
  lanesIn: [3.4, 6.8, 10.2],     // z das faixas sentido internet -> local (-X)
};

// Lados temáticos: esquerda = rede local (verde), direita = internet (azul).
const SIDE_THEMES = {
  local: { side: -1, color: 0x22c55e, css: '#4ade80', label: 'REDE LOCAL' },
  internet: { side: 1, color: 0x3b82f6, css: '#60a5fa', label: 'INTERNET' },
};

const PALETTES = {
  night: {
    skyTop: 0x02030a, skyMid: 0x061020, horizon: 0x0b1e30,
    fog: 0x030711, floor: 0x020409, grid: 0x18b4cf,
    neon: 0x9adbe8, hemiSky: 0x2c3a52, hemiGround: 0x04060a,
    moon: 0x9db4d6, accent: 0x31527f,
  },
  synthwave: {
    skyTop: 0x0d0221, skyMid: 0x3b0f54, horizon: 0xff2d78,
    fog: 0x2a0a3d, floor: 0x0a0218, grid: 0xff2d95,
    neon: 0xff2d95, hemiSky: 0x7a4fc0, hemiGround: 0x12041f,
    moon: 0xff7ad9, accent: 0x9d4dff,
  },
};

function makeTextSprite(text, color = '#ffffff') {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(5, 8, 16, 0.78)';
  ctx.beginPath();
  ctx.roundRect(8, 8, 496, 112, 24);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(8, 8, 496, 112, 24);
  ctx.stroke();
  ctx.font = '600 52px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(text, 256, 68);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
  sprite.scale.set(28, 7, 1);
  return sprite;
}

// --- céu, estrelas e lua --------------------------------------------------

function buildSky(scene) {
  const uniforms = {
    topColor: { value: new THREE.Color(PALETTES.night.skyTop) },
    midColor: { value: new THREE.Color(PALETTES.night.skyMid) },
    horizonColor: { value: new THREE.Color(PALETTES.night.horizon) },
  };
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(1200, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms,
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 topColor; uniform vec3 midColor; uniform vec3 horizonColor;
        varying vec3 vDir;
        void main() {
          float h = vDir.y;
          vec3 col = h > 0.22
            ? mix(midColor, topColor, smoothstep(0.22, 0.9, h))
            : mix(horizonColor, midColor, smoothstep(-0.04, 0.22, h));
          gl_FragColor = vec4(col, 1.0);
        }`,
    })
  );
  scene.add(sky);

  const starPos = [];
  for (let i = 0; i < 450; i++) {
    const v = new THREE.Vector3().randomDirection().multiplyScalar(1150);
    if (v.y > 80) starPos.push(v.x, v.y, v.z);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({
    color: 0xaebed6, size: 1.3, sizeAttenuation: false,
    transparent: true, opacity: 0.5, fog: false, // céu não sofre névoa
  })));

  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(16, 24, 16),
    new THREE.MeshBasicMaterial({ color: 0xb9c4d8, fog: false })
  );
  moon.position.set(-380, 270, -380);
  scene.add(moon);

  return uniforms;
}

// --- texturas procedurais -------------------------------------------------

// Janelas grandes e esparsas sobre fachadas quase pretas.
function windowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128; canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#020409';
  ctx.fillRect(0, 0, 128, 256);
  const colors = ['#ffd28a', '#ffe9c9', '#bfe3ff', '#e8eef8'];
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 5; col++) {
      if (Math.random() > 0.2) continue;
      ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
      ctx.globalAlpha = 0.65 + Math.random() * 0.35;
      ctx.fillRect(col * 25.6 + 4, row * 28.4 + 6, 17, 12);
    }
  }
  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Painel de LEDs de rack de servidor: colunas de pontos verdes/azuis.
function ledPanelTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64; canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#01030a';
  ctx.fillRect(0, 0, 64, 128);
  const colors = ['#42f5b3', '#4aa8ff', '#e8f6ff', '#1ec8e0'];
  for (let row = 0; row < 26; row++) {
    for (let col = 0; col < 9; col++) {
      if (Math.random() > 0.3) continue;
      ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
      ctx.globalAlpha = 0.5 + Math.random() * 0.5;
      ctx.fillRect(col * 7 + 2, row * 5 + 2, 2.5, 1.6);
    }
  }
  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Grade de circuito para o piso (emissiveMap: linhas claras sobre preto).
function gridTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i <= 256; i += 64) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 256); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(256, i); ctx.stroke();
  }
  // Nós de circuito nos cruzamentos, alguns acesos.
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  for (let x = 0; x <= 256; x += 64) {
    for (let y = 0; y <= 256; y += 64) {
      if (Math.random() < 0.3) ctx.fillRect(x - 2, y - 2, 4, 4);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// Filetes luminosos do "rio de dados" (transparente, p/ blending aditivo).
function streakTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 128;
  const ctx = canvas.getContext('2d');
  for (let i = 0; i < 34; i++) {
    const y = Math.random() * 128;
    const x = Math.random() * 512;
    const len = 30 + Math.random() * 120;
    const grad = ctx.createLinearGradient(x, 0, x + len, 0);
    const c = Math.random() < 0.5 ? '160,225,255' : '220,245,255';
    grad.addColorStop(0, `rgba(${c},0)`);
    grad.addColorStop(0.7, `rgba(${c},${0.35 + Math.random() * 0.45})`);
    grad.addColorStop(1, `rgba(${c},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, len, 1.6 + Math.random() * 1.4);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

// Textura de quarteirões para o topo das plataformas urbanas.
function cityGroundTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#04070d';
  ctx.fillRect(0, 0, 512, 512);
  for (let gx = 0; gx < 8; gx++) {
    for (let gy = 0; gy < 8; gy++) {
      const shade = 7 + Math.floor(Math.random() * 6);
      ctx.fillStyle = `rgb(${shade}, ${shade + 3}, ${shade + 9})`;
      ctx.fillRect(gx * 64 + 7, gy * 64 + 7, 50, 50);
    }
  }
  ctx.fillStyle = '#bfe9f5';
  for (let i = 0; i < 170; i++) {
    const onVertical = Math.random() < 0.5;
    const street = Math.floor(Math.random() * 9) * 64;
    const along = Math.random() * 512;
    ctx.globalAlpha = 0.3 + Math.random() * 0.4;
    if (onVertical) ctx.fillRect(street - 1, along, 2.5, 2.5);
    else ctx.fillRect(along, street - 1, 2.5, 2.5);
  }
  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// --- elementos de cenário --------------------------------------------------

const ROOF_MAT = new THREE.MeshStandardMaterial({ color: 0x05070d, roughness: 0.95 });
const BEACON_MAT = new THREE.MeshStandardMaterial({
  color: 0x550000, emissive: 0xff3344, emissiveIntensity: 2,
});
const DARK_STRUCT_MAT = new THREE.MeshStandardMaterial({ color: 0x070b14, roughness: 0.9 });

function makeBuilding(w, h, d, emissiveIntensity = 1) {
  const sideMat = new THREE.MeshStandardMaterial({
    color: 0x04060c, roughness: 0.95,
    emissive: 0xffffff, emissiveMap: windowTexture(), emissiveIntensity,
  });
  return new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    [sideMat, sideMat, ROOF_MAT, ROOF_MAT, sideMat, sideMat]
  );
}

// Torre de servidores: bloco esguio com painéis de LED nas faces.
function makeServerTower(w, h, d) {
  const sideMat = new THREE.MeshStandardMaterial({
    color: 0x03050c, roughness: 0.85,
    emissive: 0xffffff, emissiveMap: ledPanelTexture(), emissiveIntensity: 1.3,
  });
  return new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    [sideMat, sideMat, ROOF_MAT, ROOF_MAT, sideMat, sideMat]
  );
}

// Torre de comunicação: mastro afilado com plataformas e balizamento.
function makeCommTower(h) {
  const g = new THREE.Group();
  const mastMat = new THREE.MeshStandardMaterial({ color: 0x1a2230, roughness: 0.7, metalness: 0.5 });
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 2.2, h, 4), mastMat);
  mast.position.y = h / 2;
  g.add(mast);
  for (const frac of [0.55, 0.78]) {
    const ring = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.5, 4.2), mastMat);
    ring.position.y = h * frac;
    g.add(ring);
  }
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, h * 0.25, 4), mastMat);
  antenna.position.y = h + h * 0.125;
  g.add(antenna);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.8, 8, 6), BEACON_MAT);
  beacon.position.y = h * 1.27;
  g.add(beacon);
  return g;
}

// Plataforma comum das margens (aterro + murada, descendo até o piso).
function buildPlatform(scene, sideSign) {
  const L = BRIDGE.length;
  const groundSideMat = new THREE.MeshStandardMaterial({ color: 0x05080f, roughness: 1 });
  const groundTex = cityGroundTexture();
  groundTex.repeat.set(2, 5);
  const groundTopMat = new THREE.MeshStandardMaterial({ map: groundTex, roughness: 1 });
  const ground = new THREE.Mesh(
    new THREE.BoxGeometry(190, 16, 460),
    [groundSideMat, groundSideMat, groundTopMat, groundSideMat, groundSideMat, groundSideMat]
  );
  ground.position.set(sideSign * (L / 2 + 100), BRIDGE.deckY - 8.6, 0);
  ground.receiveShadow = true;
  scene.add(ground);

  const seawall = new THREE.Mesh(
    new THREE.BoxGeometry(2.5, 18, 460),
    new THREE.MeshStandardMaterial({ color: 0x0c121f, roughness: 0.9 })
  );
  seawall.position.set(sideSign * (L / 2 + 4), BRIDGE.deckY - 9.4, 0);
  scene.add(seawall);
}

// Distrito da rede local (esquerda): quarteirões baixos e torres de
// comunicação — escala doméstica.
function buildLocalDistrict(scene) {
  const L = BRIDGE.length;
  buildPlatform(scene, -1);
  for (let i = 0; i < 24; i++) {
    const w = 10 + Math.random() * 14;
    const d = 10 + Math.random() * 14;
    const h = 12 + Math.random() * 38;
    const x = -(L / 2 + 32 + Math.random() * 150);
    const z = (Math.random() - 0.5) * 420;
    if (Math.abs(z) < 26 && Math.abs(x) < L / 2 + 135) continue; // corredor do gateway
    const building = makeBuilding(w, h, d);
    building.position.set(x, BRIDGE.deckY - 0.6 + h / 2, z);
    building.castShadow = true;
    scene.add(building);
  }
  for (const [x, z] of [[-200, -120], [-260, 90]]) {
    const tower = makeCommTower(46 + Math.random() * 14);
    tower.position.set(x, BRIDGE.deckY - 0.6, z);
    scene.add(tower);
  }
}

// Distrito da internet (direita): lajes de data center e torres de
// servidores com painéis de LED — escala industrial.
function buildInternetDistrict(scene) {
  const L = BRIDGE.length;
  buildPlatform(scene, 1);
  for (let i = 0; i < 9; i++) { // lajes largas e baixas (data halls)
    const w = 26 + Math.random() * 16;
    const d = 30 + Math.random() * 22;
    const h = 12 + Math.random() * 10;
    const x = L / 2 + 40 + Math.random() * 140;
    const z = (Math.random() - 0.5) * 420;
    if (Math.abs(z) < 30 && Math.abs(x) < L / 2 + 135) continue;
    const hall = makeServerTower(w, h, d);
    hall.position.set(x, BRIDGE.deckY - 0.6 + h / 2, z);
    hall.castShadow = true;
    scene.add(hall);
  }
  for (let i = 0; i < 8; i++) { // torres de servidores esguias
    const w = 10 + Math.random() * 8;
    const d = 10 + Math.random() * 8;
    const h = 45 + Math.random() * 50;
    const x = L / 2 + 60 + Math.random() * 130;
    const z = (Math.random() - 0.5) * 400;
    if (Math.abs(z) < 30) continue;
    const tower = makeServerTower(w, h, d);
    tower.position.set(x, BRIDGE.deckY - 0.6 + h / 2, z);
    tower.castShadow = true;
    scene.add(tower);
    if (h > 75) {
      const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6), BEACON_MAT);
      beacon.position.set(x, BRIDGE.deckY - 0.6 + h + 1.2, z);
      scene.add(beacon);
    }
  }
}

// Orla distante fechando o horizonte dos dois lados da baía.
function buildFarSkyline(scene) {
  const landMat = new THREE.MeshStandardMaterial({ color: 0x04070d, roughness: 1 });
  for (const zSide of [-1, 1]) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(1100, 18, 160), landMat);
    strip.position.set(0, BRIDGE.deckY - 20, zSide * 300);
    scene.add(strip);
    for (let i = 0; i < 20; i++) {
      const w = 22 + Math.random() * 36;
      const d = 18 + Math.random() * 30;
      const h = 50 + Math.random() * 115;
      const x = -520 + Math.random() * 1040;
      const z = zSide * (255 + Math.random() * 95);
      const tower = makeBuilding(w, h, d, 0.7);
      tower.position.set(x, BRIDGE.deckY - 11 + h / 2, z);
      scene.add(tower);
      if (h > 130) {
        const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 6), BEACON_MAT);
        beacon.position.set(x, BRIDGE.deckY - 11 + h + 1.4, z);
        scene.add(beacon);
      }
    }
  }
}

// Partículas discretas de dados subindo lentamente pela cena.
function buildParticles(scene) {
  const count = 320;
  const positions = new Float32Array(count * 3);
  const speeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = -550 + Math.random() * 1100;
    positions[i * 3 + 1] = Math.random() * 140;
    positions[i * 3 + 2] = -420 + Math.random() * 840;
    speeds[i] = 1.5 + Math.random() * 2.5;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const points = new THREE.Points(geo, new THREE.PointsMaterial({
    color: 0x7fd8ef, size: 1.4, sizeAttenuation: true,
    transparent: true, opacity: 0.4, depthWrite: false,
  }));
  scene.add(points);
  return { geo, positions, speeds, count };
}

// Piso "mar de dados": grade de circuito + dois rios de dados fluindo
// sob a ponte (um por sentido).
function buildDataFloor(scene) {
  const floorMat = new THREE.MeshStandardMaterial({
    color: PALETTES.night.floor, metalness: 0.8, roughness: 0.35,
    emissive: new THREE.Color(PALETTES.night.grid),
    emissiveMap: gridTexture(), emissiveIntensity: 0.45,
  });
  floorMat.emissiveMap.repeat.set(40, 40);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = BRIDGE.deckY - 16;
  floor.receiveShadow = true;
  scene.add(floor);

  const rivers = [];
  for (const cfg of [{ z: -8, dir: 1 }, { z: 8, dir: -1 }]) {
    const tex = streakTexture();
    tex.repeat.x = 3;
    const mat = new THREE.MeshBasicMaterial({
      map: tex, transparent: true, opacity: 0.55,
      blending: THREE.AdditiveBlending, depthWrite: false,
      color: PALETTES.night.grid,
    });
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(1600, 22), mat);
    strip.rotation.x = -Math.PI / 2;
    strip.position.set(0, BRIDGE.deckY - 15.85, cfg.z);
    scene.add(strip);
    rivers.push({ tex, mat, dir: cfg.dir });
  }
  return { floorMat, rivers };
}

// Gateway em túnel: os veículos nascem e somem lá dentro, emergindo pela
// boca iluminada — e a via continua para dentro da fachada, dando
// sensação de continuidade com o distrito.
function buildGateway(scene, theme) {
  const s = theme.side;
  const facade = makeBuilding(34, 28, 46, 0.9);
  facade.position.set(s * 229, BRIDGE.deckY - 0.6 + 14, 0);
  scene.add(facade);

  // Túnel (paredes + teto) cobrindo a fila de entrada (x 124..212).
  // As paredes descem até o aterro para não flutuar na borda da via.
  for (const zSide of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(88, 10.5, 1.2), DARK_STRUCT_MAT);
    wall.position.set(s * 168, BRIDGE.deckY + 3.95, zSide * 14.4);
    scene.add(wall);
  }
  const roof = new THREE.Mesh(new THREE.BoxGeometry(88, 1, 30.5), DARK_STRUCT_MAT);
  roof.position.set(s * 168, BRIDGE.deckY + 9.5, 0);
  roof.castShadow = true;
  scene.add(roof);

  // Boca do túnel: moldura emissiva na cor do lado.
  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x06090f, emissive: theme.color, emissiveIntensity: 1.8,
  });
  for (const zSide of [-1, 1]) {
    const column = new THREE.Mesh(new THREE.BoxGeometry(1.0, 12.5, 1.2), frameMat);
    column.position.set(s * 124, BRIDGE.deckY + 4.95, zSide * 15);
    scene.add(column);
  }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.4, 31.2), frameMat);
  lintel.position.set(s * 124, BRIDGE.deckY + 10.2, 0);
  scene.add(lintel);

  // Frisos discretos no teto, na cor do lado.
  const ribMat = new THREE.MeshStandardMaterial({
    color: 0x06090f, emissive: theme.color, emissiveIntensity: 0.7,
  });
  for (let i = 0; i < 5; i++) {
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.25, 30.5), ribMat);
    rib.position.set(s * (136 + i * 16), BRIDGE.deckY + 10.05, 0);
    scene.add(rib);
  }

  // Luz lateral na boca: destaca os veículos chegando/saindo.
  const mouthLight = new THREE.PointLight(theme.color, 140, 48, 2);
  mouthLight.position.set(s * 118, BRIDGE.deckY + 6, 0);
  scene.add(mouthLight);

  const label = makeTextSprite(theme.label, theme.css);
  label.position.set(s * 124, BRIDGE.deckY + 17, 0);
  scene.add(label);
}

// --- ponte estaiada -------------------------------------------------------

const UNIT_CABLE = new THREE.CylinderGeometry(0.07, 0.07, 1, 6);
const CABLE_MAT = new THREE.MeshStandardMaterial({ color: 0x4c5668, metalness: 0.7, roughness: 0.45 });
const PYLON_MAT = new THREE.MeshStandardMaterial({ color: 0x39404e, metalness: 0.5, roughness: 0.55 });
const UP = new THREE.Vector3(0, 1, 0);

function cable(scene, a, b) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const mesh = new THREE.Mesh(UNIT_CABLE, CABLE_MAT);
  mesh.scale.set(1, len, 1);
  mesh.position.copy(a).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(UP, dir.normalize());
  scene.add(mesh);
}

// Asfalto quase preto com linhas amarelas contínuas junto ao canteiro e
// tracejadas brancas entre as faixas.
function roadTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024; canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#121318';
  ctx.fillRect(0, 0, 1024, 512);
  for (let i = 0; i < 1600; i++) {
    ctx.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.3)';
    ctx.fillRect(Math.random() * 1024, Math.random() * 512, 2, 2);
  }
  const zToY = (z) => ((z + 12) / 24) * 512;
  ctx.fillStyle = '#8d949e';
  for (const z of [-11.4, 11.4]) ctx.fillRect(0, zToY(z) - 2, 1024, 4);
  ctx.fillStyle = '#d9b13b';
  for (const z of [-1.6, 1.6]) ctx.fillRect(0, zToY(z) - 2.5, 1024, 5);
  ctx.fillStyle = '#c8cdd3';
  for (const z of [-5.1, -8.5, 5.1, 8.5]) {
    for (let x = 0; x < 1024; x += 86) ctx.fillRect(x, zToY(z) - 2, 40, 4);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.repeat.x = 5;
  tex.anisotropy = 4;
  return tex;
}

function buildBridge(scene, neonMat) {
  const L = BRIDGE.length;
  const W = BRIDGE.deckWidth;
  const deckMat = new THREE.MeshStandardMaterial({ color: 0x14161c, roughness: 0.9 });

  const deck = new THREE.Mesh(new THREE.BoxGeometry(L, 1.4, W), deckMat);
  deck.position.y = BRIDGE.deckY - 0.7;
  deck.receiveShadow = true;
  scene.add(deck);

  const road = new THREE.Mesh(
    new THREE.PlaneGeometry(L, 24),
    new THREE.MeshStandardMaterial({ map: roadTexture(), roughness: 0.95 })
  );
  road.rotation.x = -Math.PI / 2;
  road.position.y = BRIDGE.deckY + 0.02;
  road.receiveShadow = true;
  scene.add(road);

  // Vias de acesso: atravessam os túneis dos gateways e entram nas
  // fachadas, dando continuidade visual à pista.
  for (const side of [-1, 1]) {
    const approach = new THREE.Mesh(new THREE.BoxGeometry(95, 0.5, W), deckMat);
    approach.position.set(side * (L / 2 + 47), BRIDGE.deckY - 0.26, 0);
    approach.receiveShadow = true;
    scene.add(approach);
  }

  // Canteiro central com fita de LED discreta.
  const median = new THREE.Mesh(
    new THREE.BoxGeometry(L, 0.8, 0.7),
    new THREE.MeshStandardMaterial({ color: 0x2b313c, roughness: 0.85 })
  );
  median.position.set(0, BRIDGE.deckY + 0.4, 0);
  scene.add(median);
  const medianLed = new THREE.Mesh(new THREE.BoxGeometry(L, 0.07, 0.18), neonMat);
  medianLed.position.set(0, BRIDGE.deckY + 0.84, 0);
  scene.add(medianLed);

  // Parapeitos com fita de LED nas bordas.
  const parapetMat = new THREE.MeshStandardMaterial({ color: 0x161b24, roughness: 0.8, metalness: 0.3 });
  for (const side of [-1, 1]) {
    const parapet = new THREE.Mesh(new THREE.BoxGeometry(L, 1.1, 0.35), parapetMat);
    parapet.position.set(0, BRIDGE.deckY + 0.55, side * (W / 2 - 0.4));
    scene.add(parapet);
    const led = new THREE.Mesh(new THREE.BoxGeometry(L, 0.07, 0.2), neonMat);
    led.position.set(0, BRIDGE.deckY + 1.14, side * (W / 2 - 0.4));
    scene.add(led);
  }

  // Pilones (seção losango) e leque de estais.
  for (const px of [-L / 4, L / 4]) {
    const pylon = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 2.6, 58, 4), PYLON_MAT);
    pylon.rotation.y = Math.PI / 4;
    pylon.position.set(px, BRIDGE.deckY - 8 + 29, 0);
    pylon.castShadow = true;
    scene.add(pylon);

    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 6), BEACON_MAT);
    beacon.position.set(px, BRIDGE.deckY + 50.8, 0);
    scene.add(beacon);

    const top = new THREE.Vector3(px, BRIDGE.deckY + 47, 0);
    for (const dx of [16, 28, 40, 52]) {
      for (const dirX of [-1, 1]) {
        for (const zSide of [-1, 1]) {
          const anchorX = px + dirX * dx;
          if (Math.abs(anchorX) > L / 2 - 2) continue;
          cable(scene, top, new THREE.Vector3(anchorX, BRIDGE.deckY + 0.6, zSide * (W / 2 - 0.5)));
        }
      }
    }

    const pier = new THREE.Mesh(
      new THREE.CylinderGeometry(2.4, 3.4, 14, 10),
      new THREE.MeshStandardMaterial({ color: 0x1b2029, roughness: 0.95 })
    );
    pier.position.set(px, BRIDGE.deckY - 9, 0);
    scene.add(pier);
  }

  // Postes de iluminação: haste escura com barra de luz fria no topo.
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x12161f, roughness: 0.8 });
  const lampMat = new THREE.MeshStandardMaterial({
    color: 0xeef4ff, emissive: 0xdfe9ff, emissiveIntensity: 2.2,
  });
  for (let x = -105; x <= 105; x += 30) {
    for (const side of [-1, 1]) {
      const pole = new THREE.Mesh(new THREE.BoxGeometry(0.18, 6.8, 0.18), poleMat);
      pole.position.set(x, BRIDGE.deckY + 3.4, side * 11.6);
      scene.add(pole);
      const head = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.16, 0.5), lampMat);
      head.position.set(x, BRIDGE.deckY + 6.85, side * 11.3);
      scene.add(head);
    }
  }
  // Poços de luz fria sobre a pista para destacar os veículos.
  for (const x of [-90, -30, 30, 90]) {
    const light = new THREE.PointLight(0xcfe2ff, 260, 70, 2);
    light.position.set(x, BRIDGE.deckY + 7, 0);
    scene.add(light);
  }
}

// --- mundo ----------------------------------------------------------------

export function createWorld(container) {
  const scene = new THREE.Scene();

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  container.appendChild(renderer.domElement);

  const camera = new THREE.PerspectiveCamera(
    50, container.clientWidth / container.clientHeight, 0.5, 2000
  );
  // Posição baixa, perto da pista.
  camera.position.set(75, 30, 88);

  // Câmera livre: arrastar para orbitar, botão direito para deslocar,
  // roda do mouse para zoom.
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, BRIDGE.deckY + 2, 0);
  controls.maxPolarAngle = Math.PI / 2.02;
  controls.minDistance = 12;
  controls.maxDistance = 600;
  controls.enableDamping = true;
  controls.enablePan = true;
  controls.screenSpacePanning = true;
  controls.zoomSpeed = 1.1;

  // Iluminação base (noite tecnológica).
  const hemi = new THREE.HemisphereLight(PALETTES.night.hemiSky, PALETTES.night.hemiGround, 0.42);
  scene.add(hemi);
  const moonLight = new THREE.DirectionalLight(PALETTES.night.moon, 1.3);
  moonLight.position.set(-160, 220, -120);
  moonLight.castShadow = true;
  moonLight.shadow.camera.left = -170;
  moonLight.shadow.camera.right = 170;
  moonLight.shadow.camera.top = 130;
  moonLight.shadow.camera.bottom = -130;
  moonLight.shadow.mapSize.set(2048, 2048);
  scene.add(moonLight);
  const accent = new THREE.DirectionalLight(PALETTES.night.accent, 0.35);
  accent.position.set(220, 60, 160);
  scene.add(accent);

  // Tintas laterais sutis reforçando a divisão local (verde) / internet (azul).
  const localTint = new THREE.PointLight(SIDE_THEMES.local.color, 180, 160, 2);
  localTint.position.set(-145, 26, 0);
  scene.add(localTint);
  const netTint = new THREE.PointLight(SIDE_THEMES.internet.color, 180, 160, 2);
  netTint.position.set(145, 26, 0);
  scene.add(netTint);

  // Luz de alerta (pulsa em vermelho quando há tráfego anormal).
  const alertLight = new THREE.PointLight(0xff2222, 0, 400);
  alertLight.position.set(0, 60, 0);
  scene.add(alertLight);

  // Céu, distritos, orla, piso de dados e partículas.
  const skyUniforms = buildSky(scene);
  buildLocalDistrict(scene);
  buildInternetDistrict(scene);
  buildFarSkyline(scene);
  const { floorMat, rivers } = buildDataFloor(scene);
  const particles = buildParticles(scene);

  // Fita de LED da ponte (cor e intensidade mudam com o modo).
  const neonMat = new THREE.MeshStandardMaterial({
    color: 0x06222a, emissive: PALETTES.night.neon, emissiveIntensity: 0.9,
  });
  buildBridge(scene, neonMat);
  buildGateway(scene, SIDE_THEMES.local);
  buildGateway(scene, SIDE_THEMES.internet);

  scene.fog = new THREE.Fog(PALETTES.night.fog, 280, 1000);

  const state = { cinematic: false, alertPulse: 0, orbitT: 0 };

  function applyPalette(p) {
    skyUniforms.topColor.value.setHex(p.skyTop);
    skyUniforms.midColor.value.setHex(p.skyMid);
    skyUniforms.horizonColor.value.setHex(p.horizon);
    scene.fog.color.setHex(p.fog);
    floorMat.color.setHex(p.floor);
    floorMat.emissive.setHex(p.grid);
    for (const r of rivers) r.mat.color.setHex(p.grid);
    neonMat.emissive.setHex(p.neon);
    hemi.color.setHex(p.hemiSky);
    hemi.groundColor.setHex(p.hemiGround);
    moonLight.color.setHex(p.moon);
    accent.color.setHex(p.accent);
  }

  function setCinematic(on) {
    state.cinematic = on;
    applyPalette(on ? PALETTES.synthwave : PALETTES.night);
    accent.intensity = on ? 1.2 : 0.35;
    hemi.intensity = on ? 0.5 : 0.42;
    neonMat.emissiveIntensity = on ? 3.0 : 0.9;
  }

  function triggerAlert() { state.alertPulse = 3; }

  function update(dt, elapsed) {
    // Balizamento piscando devagar (material compartilhado).
    BEACON_MAT.emissiveIntensity = 1.2 + Math.sin(elapsed * 2.2) * 1.1;

    // Rios de dados fluindo sob a ponte, um por sentido.
    for (const r of rivers) r.tex.offset.x -= r.dir * dt * 0.05;

    // Partículas de dados subindo lentamente.
    const pos = particles.positions;
    for (let i = 0; i < particles.count; i++) {
      pos[i * 3 + 1] += particles.speeds[i] * dt;
      if (pos[i * 3 + 1] > 150) pos[i * 3 + 1] = 1;
    }
    particles.geo.attributes.position.needsUpdate = true;

    if (state.alertPulse > 0) {
      state.alertPulse -= dt;
      alertLight.intensity = Math.max(0, Math.sin(elapsed * 14) * 0.5 + 0.5) * 900;
      if (state.alertPulse <= 0) alertLight.intensity = 0;
    }
    if (state.cinematic) {
      // Câmera orbita lentamente em modo cinematográfico.
      state.orbitT += dt * 0.05;
      const r = 150;
      camera.position.x = Math.cos(state.orbitT) * r;
      camera.position.z = Math.sin(state.orbitT) * r;
      camera.position.y = 60 + Math.sin(state.orbitT * 0.5) * 18;
      camera.lookAt(0, BRIDGE.deckY, 0);
    } else {
      controls.update();
    }
    renderer.render(scene, camera);
  }

  function resize() {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  }
  window.addEventListener('resize', resize);

  return { scene, camera, renderer, controls, update, setCinematic, triggerAlert };
}
