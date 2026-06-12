// Motor visual 3D: noite urbana quase preta no estilo low-poly — prédios
// escuros com janelas grandes e esparsas iluminadas, placa "PACKET
// HIGHWAY" brilhando sobre a pista, postes com barra de luz, asfalto
// escuro com linhas amarelas e ponte estaiada sobre a baía.
// O modo cinematográfico troca a paleta para neon synthwave e orbita a câmera.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export const BRIDGE = {
  length: 240,        // ao longo do eixo X
  deckWidth: 26,
  deckY: 8,           // altura do tabuleiro sobre a água
  spawnX: 132,        // onde os veículos nascem/desaparecem
  lanesOut: [-3.4, -6.8, -10.2], // z das faixas sentido local -> internet (+X)
  lanesIn: [3.4, 6.8, 10.2],     // z das faixas sentido internet -> local (-X)
};

const PALETTES = {
  night: {
    skyTop: 0x010207, skyMid: 0x040a14, horizon: 0x0a1322,
    fog: 0x04060c, water: 0x031018,
    neon: 0x22d3ee, hemiSky: 0x32415e, hemiGround: 0x05070c,
    moon: 0x8fa8cc, accent: 0x35508a,
  },
  synthwave: {
    skyTop: 0x0d0221, skyMid: 0x3b0f54, horizon: 0xff2d78,
    fog: 0x2a0a3d, water: 0x12042a,
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

// --- cidade nas margens ---------------------------------------------------

// Janelas grandes e esparsas, como na referência: poucos retângulos
// iluminados (tons quentes e frios) sobre fachadas quase pretas.
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

const ROOF_MAT = new THREE.MeshStandardMaterial({ color: 0x05070d, roughness: 0.95 });
const BEACON_MAT = new THREE.MeshStandardMaterial({
  color: 0x550000, emissive: 0xff3344, emissiveIntensity: 2,
});

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

// Textura de quarteirões para o topo das plataformas urbanas: malha de
// ruas com pontos de iluminação pública.
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
  // Postes ao longo das ruas.
  ctx.fillStyle = '#ffd9a0';
  for (let i = 0; i < 200; i++) {
    const onVertical = Math.random() < 0.5;
    const street = Math.floor(Math.random() * 9) * 64;
    const along = Math.random() * 512;
    ctx.globalAlpha = 0.4 + Math.random() * 0.5;
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

function buildCity(scene, sideSign) {
  const L = BRIDGE.length;
  const groundSideMat = new THREE.MeshStandardMaterial({ color: 0x05080f, roughness: 1 });
  const groundTex = cityGroundTexture();
  groundTex.repeat.set(2, 5);
  const groundTopMat = new THREE.MeshStandardMaterial({ map: groundTex, roughness: 1 });
  const ground = new THREE.Mesh(
    new THREE.BoxGeometry(190, 16, 460),
    [groundSideMat, groundSideMat, groundTopMat, groundSideMat, groundSideMat, groundSideMat]
  );
  // Aterro desce até abaixo do nível da água (deckY - 16).
  ground.position.set(sideSign * (L / 2 + 100), BRIDGE.deckY - 8.6, 0);
  ground.receiveShadow = true;
  scene.add(ground);

  // Murada da orla na borda voltada para a água, também submersa na base.
  const seawall = new THREE.Mesh(
    new THREE.BoxGeometry(2.5, 18, 460),
    new THREE.MeshStandardMaterial({ color: 0x0c121f, roughness: 0.9 })
  );
  seawall.position.set(sideSign * (L / 2 + 4), BRIDGE.deckY - 9.4, 0);
  scene.add(seawall);

  for (let i = 0; i < 26; i++) {
    const w = 14 + Math.random() * 20;
    const d = 14 + Math.random() * 20;
    const h = 28 + Math.random() * 90;
    const x = sideSign * (L / 2 + 32 + Math.random() * 150);
    const z = (Math.random() - 0.5) * 420;
    // Mantém o corredor da via de acesso livre.
    if (Math.abs(z) < 22 && Math.abs(x) < L / 2 + 110) continue;
    const building = makeBuilding(w, h, d);
    building.position.set(x, BRIDGE.deckY - 0.6 + h / 2, z);
    building.castShadow = true;
    scene.add(building);
    // Luz de balizamento nos prédios altos.
    if (h > 78) {
      const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6), BEACON_MAT);
      beacon.position.set(x, BRIDGE.deckY - 0.6 + h + 1.2, z);
      scene.add(beacon);
    }
  }
}

// Orla próxima fechando o fundo: faixas de cais com torres escuras dos
// dois lados da baía, como os prédios atrás da via na referência.
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
      const tower = makeBuilding(w, h, d, 0.85);
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

// Pequenos barcos iluminados cruzando a baía.
function buildBoats(scene) {
  const hullMat = new THREE.MeshStandardMaterial({ color: 0x0a0f1a, roughness: 0.9 });
  const cabinMat = new THREE.MeshStandardMaterial({
    color: 0x1c2333, roughness: 0.7,
    emissive: 0xffd9a0, emissiveIntensity: 1.6,
  });
  const boats = [];
  const lanes = [
    { x: -38, speed: 4.5, z0: -180 },
    { x: 28, speed: -3.5, z0: 150 },
    { x: 86, speed: 5.5, z0: -60 },
  ];
  for (const cfg of lanes) {
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.2, 7), hullMat);
    hull.position.y = 0.35;
    boat.add(hull);
    const cabinBox = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.3, 2.4), cabinMat);
    cabinBox.position.set(0, 1.45, -0.8);
    boat.add(cabinBox);
    const mastLight = new THREE.Mesh(new THREE.SphereGeometry(0.18, 6, 4), cabinMat);
    mastLight.position.set(0, 2.55, -0.8);
    boat.add(mastLight);
    boat.position.set(cfg.x, BRIDGE.deckY - 16.2, cfg.z0);
    scene.add(boat);
    boats.push({ group: boat, speed: cfg.speed, phase: Math.random() * Math.PI * 2 });
  }
  return boats;
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
// tracejadas brancas entre as faixas, como na referência.
function roadTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024; canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#121318';
  ctx.fillRect(0, 0, 1024, 512);
  // Granulado sutil do asfalto.
  for (let i = 0; i < 1600; i++) {
    ctx.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.3)';
    ctx.fillRect(Math.random() * 1024, Math.random() * 512, 2, 2);
  }
  const zToY = (z) => ((z + 12) / 24) * 512;
  // Bordas externas: linha branca contínua discreta.
  ctx.fillStyle = '#8d949e';
  for (const z of [-11.4, 11.4]) ctx.fillRect(0, zToY(z) - 2, 1024, 4);
  // Junto ao canteiro: linhas amarelas contínuas.
  ctx.fillStyle = '#d9b13b';
  for (const z of [-1.6, 1.6]) ctx.fillRect(0, zToY(z) - 2.5, 1024, 5);
  // Separadores de faixa tracejados.
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

// Placa luminosa "PACKET HIGHWAY" sobre a pista, como na referência.
function buildHighwaySign(scene) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024; canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#03141a';
  ctx.fillRect(0, 0, 1024, 256);
  ctx.strokeStyle = '#7defff';
  ctx.lineWidth = 7;
  ctx.shadowColor = '#22d3ee';
  ctx.shadowBlur = 22;
  ctx.beginPath();
  ctx.roundRect(14, 14, 996, 228, 14);
  ctx.stroke();
  ctx.font = 'bold 96px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#9ff3ff';
  ctx.shadowBlur = 28;
  ctx.fillText('PACKET HIGHWAY', 512, 134);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  const backTex = tex.clone();
  backTex.repeat.x = -1;
  backTex.needsUpdate = true;

  const faceMat = new THREE.MeshBasicMaterial({ map: tex });
  const backMat = new THREE.MeshBasicMaterial({ map: backTex });
  const edgeMat = new THREE.MeshStandardMaterial({ color: 0x0a0f18, roughness: 0.9 });
  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 5.5, 22),
    [faceMat, backMat, edgeMat, edgeMat, edgeMat, edgeMat]
  );
  panel.position.set(18, BRIDGE.deckY + 11, 0);
  scene.add(panel);

  const pole = new THREE.Mesh(
    new THREE.BoxGeometry(0.35, 8, 0.35),
    new THREE.MeshStandardMaterial({ color: 0x0c1018, roughness: 0.9 })
  );
  pole.position.set(18, BRIDGE.deckY + 4.3, 0);
  scene.add(pole);
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

  // Vias de acesso nas margens: longas o bastante para a fila de entrada
  // que se forma fora da tela (veículos nascem em x = ±132 e podem
  // aguardar até ~70 unidades atrás desse ponto).
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

  // Postes de iluminação: haste escura com barra de luz creme no topo,
  // como na referência.
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x12161f, roughness: 0.8 });
  const lampMat = new THREE.MeshStandardMaterial({
    color: 0xfff2d4, emissive: 0xffe9b8, emissiveIntensity: 2.4,
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
  // Apenas alguns pontos de luz reais para os "poços" de iluminação.
  for (const x of [-90, -30, 30, 90]) {
    const light = new THREE.PointLight(0xffd9a0, 280, 70, 2);
    light.position.set(x, BRIDGE.deckY + 7, 0);
    scene.add(light);
  }

  buildHighwaySign(scene);

  // Portais de chegada: REDE LOCAL (verde) e INTERNET (azul).
  const gates = [
    { x: -L / 2 - 5, color: 0x16a34a, label: 'REDE LOCAL', css: '#4ade80' },
    { x: L / 2 + 5, color: 0x3b82f6, label: 'INTERNET', css: '#60a5fa' },
  ];
  for (const gcfg of gates) {
    const mat = new THREE.MeshStandardMaterial({
      color: 0x080c14, emissive: gcfg.color, emissiveIntensity: 1.6,
    });
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.7, 15, 0.7), mat);
      post.position.set(gcfg.x, BRIDGE.deckY + 7.5, side * (W / 2 + 1.6));
      scene.add(post);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, W + 4), mat);
    beam.position.set(gcfg.x, BRIDGE.deckY + 15, 0);
    scene.add(beam);
    const label = makeTextSprite(gcfg.label, gcfg.css);
    label.position.set(gcfg.x, BRIDGE.deckY + 20, 0);
    scene.add(label);
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
  // Posição baixa, perto da pista, como na referência.
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

  // Iluminação base (noite fechada).
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

  // Luz de alerta (pulsa em vermelho quando há tráfego anormal).
  const alertLight = new THREE.PointLight(0xff2222, 0, 400);
  alertLight.position.set(0, 60, 0);
  scene.add(alertLight);

  // Céu, estrelas, lua, cidades, orla e barcos.
  const skyUniforms = buildSky(scene);
  buildCity(scene, -1);
  buildCity(scene, 1);
  buildFarSkyline(scene);
  const boats = buildBoats(scene);

  // Água com ondulação por shader.
  const waterUniform = { value: 0 };
  const waterMat = new THREE.MeshPhysicalMaterial({
    color: PALETTES.night.water, roughness: 0.25, metalness: 0.6,
  });
  waterMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = waterUniform;
    shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       transformed.z += sin(position.x * 0.05 + uTime) * 0.4
                      + cos(position.y * 0.04 + uTime * 0.7) * 0.3;`
    );
  };
  const water = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600, 96, 96), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.y = BRIDGE.deckY - 16;
  scene.add(water);

  // Fita de LED da ponte (cor e intensidade mudam com o modo).
  const neonMat = new THREE.MeshStandardMaterial({
    color: 0x06222a, emissive: PALETTES.night.neon, emissiveIntensity: 0.9,
  });
  buildBridge(scene, neonMat);

  scene.fog = new THREE.Fog(PALETTES.night.fog, 280, 1000);

  const state = { cinematic: false, alertPulse: 0, orbitT: 0 };

  function applyPalette(p) {
    skyUniforms.topColor.value.setHex(p.skyTop);
    skyUniforms.midColor.value.setHex(p.skyMid);
    skyUniforms.horizonColor.value.setHex(p.horizon);
    scene.fog.color.setHex(p.fog);
    waterMat.color.setHex(p.water);
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
    waterUniform.value = elapsed;
    // Balizamento dos pilones e prédios piscando devagar (material compartilhado).
    BEACON_MAT.emissiveIntensity = 1.2 + Math.sin(elapsed * 2.2) * 1.1;

    // Barcos cruzando a baía, balançando de leve.
    for (const b of boats) {
      b.group.position.z += b.speed * dt;
      if (b.group.position.z > 215) b.group.position.z = -215;
      if (b.group.position.z < -215) b.group.position.z = 215;
      b.group.position.y = BRIDGE.deckY - 16.2 + Math.sin(elapsed * 1.6 + b.phase) * 0.2;
      b.group.rotation.x = Math.sin(elapsed * 1.3 + b.phase) * 0.04;
    }

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
