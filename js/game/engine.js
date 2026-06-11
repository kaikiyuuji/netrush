// Motor visual 3D: cena, ponte suspensa, água, iluminação e câmera.

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

function makeTextSprite(text, color = '#ffffff', bg = 'rgba(10,15,30,0.75)') {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(8, 8, 496, 112, 24);
  ctx.fill();
  ctx.font = 'bold 56px system-ui, sans-serif';
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

function buildCable(scene, zSide, material) {
  const L = BRIDGE.length;
  const towerX = L / 4;
  const top = BRIDGE.deckY + 34;
  const sag = BRIDGE.deckY + 3;
  const pts = [
    new THREE.Vector3(-L / 2 - 8, BRIDGE.deckY + 2, zSide),
    new THREE.Vector3(-towerX, top, zSide),
    new THREE.Vector3(0, sag, zSide),
    new THREE.Vector3(towerX, top, zSide),
    new THREE.Vector3(L / 2 + 8, BRIDGE.deckY + 2, zSide),
  ];
  const curve = new THREE.CatmullRomCurve3(pts);
  const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 64, 0.35, 6), material);
  scene.add(tube);

  // Pendurais verticais ligando o cabo ao tabuleiro.
  const hangerMat = material;
  for (let i = 1; i < 24; i++) {
    const t = i / 24;
    const p = curve.getPoint(t);
    if (Math.abs(p.x) > L / 2 - 4) continue;
    const h = p.y - BRIDGE.deckY;
    if (h < 1.5) continue;
    const hanger = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, h, 4), hangerMat);
    hanger.position.set(p.x, BRIDGE.deckY + h / 2, zSide);
    scene.add(hanger);
  }
}

function buildBridge(scene) {
  const L = BRIDGE.length;
  const W = BRIDGE.deckWidth;
  const deckMat = new THREE.MeshStandardMaterial({ color: 0x3a3f4a, roughness: 0.9 });
  const steelMat = new THREE.MeshStandardMaterial({ color: 0xb33939, roughness: 0.5, metalness: 0.4 });
  const lineMat = new THREE.MeshStandardMaterial({ color: 0xe8e8e0, roughness: 0.8 });

  const deck = new THREE.Mesh(new THREE.BoxGeometry(L, 1.6, W), deckMat);
  deck.position.y = BRIDGE.deckY - 0.8;
  deck.receiveShadow = true;
  scene.add(deck);

  // Canteiro central e guarda-corpos.
  const median = new THREE.Mesh(new THREE.BoxGeometry(L, 0.9, 0.8), lineMat);
  median.position.set(0, BRIDGE.deckY + 0.45, 0);
  scene.add(median);
  for (const z of [-W / 2 + 0.4, W / 2 - 0.4]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(L, 1.4, 0.3), steelMat);
    rail.position.set(0, BRIDGE.deckY + 0.7, z);
    scene.add(rail);
  }

  // Faixas pintadas separando as pistas.
  const dashGeo = new THREE.BoxGeometry(3, 0.05, 0.25);
  for (const z of [-6.8 + 1.7, -3.4 + 1.7 - 3.4, 6.8 - 1.7, 3.4 - 1.7 + 3.4]) {
    for (let x = -L / 2 + 4; x < L / 2 - 4; x += 8) {
      const dash = new THREE.Mesh(dashGeo, lineMat);
      dash.position.set(x, BRIDGE.deckY + 0.03, z);
      scene.add(dash);
    }
  }

  // Torres da ponte pênsil.
  const towerGeo = new THREE.BoxGeometry(2.4, 44, 2.4);
  const crossGeo = new THREE.BoxGeometry(2, 2.4, W + 6);
  for (const tx of [-L / 4, L / 4]) {
    for (const tz of [-W / 2 - 1.5, W / 2 + 1.5]) {
      const tower = new THREE.Mesh(towerGeo, steelMat);
      tower.position.set(tx, BRIDGE.deckY - 8 + 22, tz);
      tower.castShadow = true;
      scene.add(tower);
    }
    for (const cy of [BRIDGE.deckY + 14, BRIDGE.deckY + 30]) {
      const cross = new THREE.Mesh(crossGeo, steelMat);
      cross.position.set(tx, cy, 0);
      scene.add(cross);
    }
  }

  buildCable(scene, -W / 2 - 1.5, steelMat);
  buildCable(scene, W / 2 + 1.5, steelMat);

  // Pilares na água.
  const pierGeo = new THREE.CylinderGeometry(2.2, 3, 14, 10);
  const pierMat = new THREE.MeshStandardMaterial({ color: 0x6b7280, roughness: 0.95 });
  for (const tx of [-L / 4, L / 4]) {
    const pier = new THREE.Mesh(pierGeo, pierMat);
    pier.position.set(tx, BRIDGE.deckY - 9, 0);
    scene.add(pier);
  }

  // Margens: "REDE LOCAL" à esquerda, "INTERNET" à direita.
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x2f3e2f, roughness: 1 });
  for (const side of [-1, 1]) {
    const ground = new THREE.Mesh(new THREE.BoxGeometry(80, 10, 160), groundMat);
    ground.position.set(side * (L / 2 + 40), BRIDGE.deckY - 5.6, 0);
    scene.add(ground);
  }

  const localGate = new THREE.Mesh(
    new THREE.BoxGeometry(3, 16, W + 10),
    new THREE.MeshStandardMaterial({ color: 0x14532d, emissive: 0x16a34a, emissiveIntensity: 0.35 })
  );
  localGate.position.set(-L / 2 - 6, BRIDGE.deckY + 4, 0);
  scene.add(localGate);

  const netGate = new THREE.Mesh(
    new THREE.BoxGeometry(3, 16, W + 10),
    new THREE.MeshStandardMaterial({ color: 0x1e3a8a, emissive: 0x3b82f6, emissiveIntensity: 0.35 })
  );
  netGate.position.set(L / 2 + 6, BRIDGE.deckY + 4, 0);
  scene.add(netGate);

  const labelLocal = makeTextSprite('REDE LOCAL', '#4ade80');
  labelLocal.position.set(-L / 2 - 6, BRIDGE.deckY + 18, 0);
  scene.add(labelLocal);
  const labelNet = makeTextSprite('INTERNET', '#60a5fa');
  labelNet.position.set(L / 2 + 6, BRIDGE.deckY + 18, 0);
  scene.add(labelNet);
}

export function createWorld(container) {
  const scene = new THREE.Scene();

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const camera = new THREE.PerspectiveCamera(
    50, container.clientWidth / container.clientHeight, 0.5, 1500
  );
  camera.position.set(95, 75, 130);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, BRIDGE.deckY, 0);
  controls.maxPolarAngle = Math.PI / 2.05;
  controls.minDistance = 25;
  controls.maxDistance = 500;
  controls.enableDamping = true;

  // Iluminação.
  const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x30405a, 0.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff3e0, 1.6);
  sun.position.set(120, 160, 80);
  sun.castShadow = true;
  sun.shadow.camera.left = -160;
  sun.shadow.camera.right = 160;
  sun.shadow.camera.top = 120;
  sun.shadow.camera.bottom = -120;
  sun.shadow.mapSize.set(2048, 2048);
  scene.add(sun);

  // Luz de alerta (pulsa em vermelho quando há tráfego anormal).
  const alertLight = new THREE.PointLight(0xff2222, 0, 400);
  alertLight.position.set(0, 60, 0);
  scene.add(alertLight);

  // Água.
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x10314f, roughness: 0.25, metalness: 0.5,
  });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.y = BRIDGE.deckY - 16;
  scene.add(water);

  buildBridge(scene);

  const dayBg = new THREE.Color(0x87b7e0);
  const cineBg = new THREE.Color(0x2b1a3d);
  scene.background = dayBg.clone();
  scene.fog = new THREE.Fog(dayBg.clone(), 250, 900);

  const state = {
    cinematic: false,
    alertPulse: 0,   // >0 ativa pulso vermelho
    orbitT: 0,
  };

  function setCinematic(on) {
    state.cinematic = on;
    if (on) {
      scene.background.copy(cineBg);
      scene.fog.color.copy(cineBg);
      hemi.intensity = 0.45;
      hemi.color.set(0x9a7bd8);
      sun.color.set(0xff9a5c);
      sun.intensity = 1.9;
      sun.position.set(-180, 40, 120); // sol baixo, pôr do sol
      waterMat.color.set(0x251040);
    } else {
      scene.background.copy(dayBg);
      scene.fog.color.copy(dayBg);
      hemi.intensity = 0.9;
      hemi.color.set(0xbfd9ff);
      sun.color.set(0xfff3e0);
      sun.intensity = 1.6;
      sun.position.set(120, 160, 80);
      waterMat.color.set(0x10314f);
    }
  }

  function triggerAlert() { state.alertPulse = 3; }

  function update(dt, elapsed) {
    if (state.alertPulse > 0) {
      state.alertPulse -= dt;
      alertLight.intensity = Math.max(0, Math.sin(elapsed * 14) * 0.5 + 0.5) * 600;
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
