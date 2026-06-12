// Fábrica de veículos 3D procedurais com visual moderno: carrocerias
// arredondadas (RoundedBoxGeometry), pintura metálica com clearcoat,
// vidros escuros e faróis/lanternas de LED emissivos. Geometrias e
// materiais são cacheados; os grupos são clonados a cada spawn.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { CATEGORIES } from '../core/categories.js';

// --- materiais compartilhados -------------------------------------------

const TIRE_MAT = new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 0.95 });
const RIM_MAT = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.9, roughness: 0.25 });
const GLASS_MAT = new THREE.MeshPhysicalMaterial({
  color: 0x10141f, metalness: 0.9, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.1,
});
const TRIM_MAT = new THREE.MeshStandardMaterial({ color: 0x16181d, roughness: 0.7 });
const WHITE_MAT = new THREE.MeshPhysicalMaterial({
  color: 0xeef1f5, metalness: 0.4, roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.2,
});
const HEAD_MAT = new THREE.MeshStandardMaterial({
  color: 0xffffff, emissive: 0xe8f4ff, emissiveIntensity: 3,
});
const TAIL_MAT = new THREE.MeshStandardMaterial({
  color: 0x550000, emissive: 0xff2030, emissiveIntensity: 2.5,
});
const AMBER_MAT = new THREE.MeshStandardMaterial({
  color: 0x664400, emissive: 0xffb340, emissiveIntensity: 2.2,
});
const LIME_MAT = new THREE.MeshStandardMaterial({
  color: 0x224400, emissive: 0x84cc16, emissiveIntensity: 2,
});
const SIREN_RED = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 1 });
const SIREN_BLUE = new THREE.MeshStandardMaterial({ color: 0x0044ff, emissive: 0x0044ff, emissiveIntensity: 1 });

// As sirenes de todas as viaturas compartilham material; um único pulso
// global faz todas piscarem alternadamente.
export function pulseSirens(elapsed) {
  const phase = Math.sin(elapsed * 10) > 0;
  SIREN_RED.emissiveIntensity = phase ? 2.2 : 0.1;
  SIREN_BLUE.emissiveIntensity = phase ? 0.1 : 2.2;
}

function bodyMat(color) {
  return new THREE.MeshPhysicalMaterial({
    color, metalness: 0.65, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.12,
  });
}

// --- helpers de construção ----------------------------------------------

const TIRE_GEO = new THREE.CylinderGeometry(1, 1, 1, 16);
const RIM_GEO = new THREE.CylinderGeometry(1, 1, 1, 8);

// Caixa de cantos arredondados centrada em (x, y, z).
function rbox(g, mat, w, h, d, x, y, z, r = 0.14) {
  const radius = Math.min(r, Math.min(w, h, d) * 0.45);
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, radius), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  g.add(m);
  return m;
}

function box(g, mat, w, h, d, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  g.add(m);
  return m;
}

function addWheel(g, x, z, r = 0.45, w = 0.35) {
  const tire = new THREE.Mesh(TIRE_GEO, TIRE_MAT);
  tire.rotation.x = Math.PI / 2;
  tire.scale.set(r, w, r);
  tire.position.set(x, r, z);
  g.add(tire);
  const rim = new THREE.Mesh(RIM_GEO, RIM_MAT);
  rim.rotation.x = Math.PI / 2;
  rim.scale.set(r * 0.55, w + 0.05, r * 0.55);
  rim.position.set(x, r, z);
  g.add(rim);
}

// Barras de LED dianteira (branca) e traseira (vermelha), estilo EV moderno.
function addLightBars(g, frontX, rearX, y, halfWidth) {
  box(g, HEAD_MAT, 0.08, 0.1, halfWidth * 2, frontX, y, 0);
  box(g, TAIL_MAT, 0.08, 0.1, halfWidth * 2, rearX, y, 0);
}

// --- builders (veículo aponta para +X, chão em y=0) ----------------------
// userData.length = comprimento, userData.speed = velocidade base (u/s).

const builders = {
  HTTPS: (color) => { // moto esportiva
    const g = new THREE.Group();
    const mat = bodyMat(color);
    rbox(g, mat, 1.6, 0.5, 0.55, 0, 1.0, 0, 0.18);                 // carenagem
    const nose = rbox(g, mat, 0.65, 0.38, 0.42, 0.75, 1.2, 0, 0.14);
    nose.rotation.z = -0.25;
    const shield = box(g, GLASS_MAT, 0.34, 0.3, 0.36, 0.95, 1.45, 0);
    shield.rotation.z = -0.5;                                       // bolha
    rbox(g, TRIM_MAT, 0.6, 0.16, 0.42, -0.45, 1.32, 0, 0.07);       // banco
    box(g, HEAD_MAT, 0.07, 0.12, 0.2, 1.06, 1.18, 0);
    box(g, TAIL_MAT, 0.06, 0.08, 0.25, -0.88, 1.18, 0);
    const fork = box(g, TRIM_MAT, 0.09, 0.75, 0.09, 0.85, 0.6, 0);
    fork.rotation.z = 0.32;
    addWheel(g, 0.85, 0, 0.38, 0.18);
    addWheel(g, -0.85, 0, 0.38, 0.22);
    g.userData = { length: 2.4, speed: 26 };
    return g;
  },
  QUIC: (color) => { // ônibus elétrico urbano
    const g = new THREE.Group();
    const mat = bodyMat(color);
    rbox(g, mat, 10.4, 3.0, 2.6, 0, 2.25, 0, 0.3);
    box(g, GLASS_MAT, 9.6, 0.9, 2.64, -0.2, 2.95, 0);               // faixa de janelas
    box(g, GLASS_MAT, 0.12, 1.5, 2.3, 5.16, 2.6, 0);                // para-brisa
    box(g, AMBER_MAT, 0.08, 0.32, 1.6, 5.24, 3.55, 0);              // letreiro
    rbox(g, TRIM_MAT, 3.4, 0.3, 1.8, -0.5, 3.9, 0, 0.1);            // ar-condicionado
    box(g, TRIM_MAT, 10.4, 0.4, 2.62, 0, 0.85, 0);                  // saia
    box(g, HEAD_MAT, 0.08, 0.16, 0.4, 5.2, 1.25, 0.85);
    box(g, HEAD_MAT, 0.08, 0.16, 0.4, 5.2, 1.25, -0.85);
    box(g, TAIL_MAT, 0.08, 0.5, 0.22, -5.2, 1.7, 0.95);
    box(g, TAIL_MAT, 0.08, 0.5, 0.22, -5.2, 1.7, -0.95);
    addWheel(g, 3.5, 1.12, 0.62, 0.5); addWheel(g, 3.5, -1.12, 0.62, 0.5);
    addWheel(g, -3.5, 1.12, 0.62, 0.5); addWheel(g, -3.5, -1.12, 0.62, 0.5);
    g.userData = { length: 11.5, speed: 12 };
    return g;
  },
  HTTP: (color) => { // crossover táxi
    const g = new THREE.Group();
    const mat = bodyMat(color);
    rbox(g, mat, 4.4, 0.95, 1.95, 0, 1.1, 0, 0.2);
    rbox(g, GLASS_MAT, 2.7, 0.8, 1.75, -0.15, 1.85, 0, 0.3);        // cúpula de vidro
    box(g, TRIM_MAT, 4.4, 0.28, 1.97, 0, 0.62, 0);                  // saia
    box(g, AMBER_MAT, 0.55, 0.28, 0.3, -0.15, 2.42, 0);             // luminoso
    addLightBars(g, 2.21, -2.21, 1.1, 0.8);
    addWheel(g, 1.5, 0.95, 0.46); addWheel(g, 1.5, -0.95, 0.46);
    addWheel(g, -1.5, 0.95, 0.46); addWheel(g, -1.5, -0.95, 0.46);
    g.userData = { length: 4.8, speed: 20 };
    return g;
  },
  DNS: (color) => { // e-bike
    const g = new THREE.Group();
    const mat = bodyMat(color);
    const top = box(g, mat, 1.15, 0.09, 0.09, 0.05, 1.02, 0);
    top.rotation.z = 0.12;                                          // top tube
    const down = box(g, mat, 1.0, 0.09, 0.09, 0.1, 0.78, 0);
    down.rotation.z = -0.35;                                        // down tube
    box(g, mat, 0.09, 0.62, 0.09, -0.48, 0.85, 0);                  // seat tube
    const fork = box(g, TRIM_MAT, 0.07, 0.6, 0.07, 0.58, 0.62, 0);
    fork.rotation.z = 0.25;
    box(g, LIME_MAT, 0.45, 0.12, 0.1, 0.1, 0.9, 0);                 // bateria
    box(g, TRIM_MAT, 0.09, 0.09, 0.5, 0.62, 1.25, 0);               // guidão
    box(g, TRIM_MAT, 0.32, 0.07, 0.2, -0.5, 1.25, 0);               // selim
    addWheel(g, 0.62, 0, 0.36, 0.07);
    addWheel(g, -0.62, 0, 0.36, 0.07);
    g.userData = { length: 1.9, speed: 7 };
    return g;
  },
  SSH: (color) => { // caminhão baú elétrico
    const g = new THREE.Group();
    const mat = bodyMat(color);
    rbox(g, mat, 2.3, 2.0, 2.3, 2.75, 1.6, 0, 0.35);                // cabine aero
    const ws = box(g, GLASS_MAT, 0.12, 0.95, 2.0, 3.82, 2.05, 0);
    ws.rotation.z = -0.18;
    rbox(g, WHITE_MAT, 5.2, 2.9, 2.5, -0.95, 2.15, 0, 0.12);        // baú
    box(g, TRIM_MAT, 4.6, 0.5, 2.4, -0.95, 0.55, 0);                // saia aero
    box(g, HEAD_MAT, 0.08, 0.14, 1.4, 3.92, 1.05, 0);
    box(g, TAIL_MAT, 0.08, 0.5, 0.25, -3.56, 1.2, 1.0);
    box(g, TAIL_MAT, 0.08, 0.5, 0.25, -3.56, 1.2, -1.0);
    addWheel(g, 2.8, 1.15, 0.55, 0.45); addWheel(g, 2.8, -1.15, 0.55, 0.45);
    addWheel(g, -1.6, 1.15, 0.55, 0.45); addWheel(g, -1.6, -1.15, 0.55, 0.45);
    addWheel(g, -2.9, 1.15, 0.55, 0.45); addWheel(g, -2.9, -1.15, 0.55, 0.45);
    g.userData = { length: 8.2, speed: 13 };
    return g;
  },
  TCP: (color) => { // hipercarro
    const g = new THREE.Group();
    const mat = bodyMat(color);
    rbox(g, mat, 4.4, 0.6, 1.95, 0, 0.75, 0, 0.22);                 // cunha baixa
    rbox(g, GLASS_MAT, 1.9, 0.55, 1.55, -0.25, 1.25, 0, 0.3);       // cúpula
    box(g, TRIM_MAT, 4.4, 0.2, 1.97, 0, 0.42, 0);                   // difusor
    box(g, mat, 0.5, 0.07, 1.9, -2.05, 1.4, 0);                     // aerofólio
    box(g, TRIM_MAT, 0.08, 0.32, 0.08, -2.05, 1.2, 0.7);
    box(g, TRIM_MAT, 0.08, 0.32, 0.08, -2.05, 1.2, -0.7);
    addLightBars(g, 2.21, -2.21, 0.85, 0.85);
    addWheel(g, 1.45, 0.98, 0.46, 0.45); addWheel(g, 1.45, -0.98, 0.46, 0.45);
    addWheel(g, -1.45, 0.98, 0.46, 0.45); addWheel(g, -1.45, -0.98, 0.46, 0.45);
    g.userData = { length: 4.6, speed: 30 };
    return g;
  },
  UDP: (color) => { // viatura policial moderna
    const g = new THREE.Group();
    const mat = bodyMat(color);
    rbox(g, WHITE_MAT, 4.7, 0.95, 1.95, 0, 1.0, 0, 0.2);
    box(g, mat, 4.72, 0.3, 1.97, 0, 0.72, 0);                       // faixa azul
    rbox(g, GLASS_MAT, 2.4, 0.75, 1.8, -0.1, 1.8, 0, 0.28);
    box(g, TRIM_MAT, 0.5, 0.25, 1.6, 2.3, 0.8, 0);                  // para-choque
    box(g, SIREN_RED, 0.42, 0.12, 0.72, -0.1, 2.3, 0.4);            // giroflex slim
    box(g, SIREN_BLUE, 0.42, 0.12, 0.72, -0.1, 2.3, -0.4);
    addLightBars(g, 2.36, -2.36, 1.05, 0.8);
    addWheel(g, 1.55, 0.98, 0.46); addWheel(g, 1.55, -0.98, 0.46);
    addWheel(g, -1.55, 0.98, 0.46); addWheel(g, -1.55, -0.98, 0.46);
    g.userData = { length: 5.0, speed: 24 };
    return g;
  },
  ICMP: (color) => { // van de entrega elétrica
    const g = new THREE.Group();
    const mat = bodyMat(color);
    rbox(g, mat, 5.2, 2.35, 2.2, 0, 1.85, 0, 0.4);                  // monobloco
    const ws = box(g, GLASS_MAT, 0.14, 1.0, 1.95, 2.5, 2.35, 0);
    ws.rotation.z = -0.22;                                          // para-brisa
    box(g, GLASS_MAT, 1.2, 0.55, 2.24, 1.35, 2.5, 0);               // vidros frontais
    box(g, TRIM_MAT, 5.2, 0.3, 2.22, 0, 0.7, 0);
    box(g, HEAD_MAT, 0.08, 0.12, 1.3, 2.78, 1.2, 0);
    box(g, TAIL_MAT, 0.08, 0.6, 0.2, -2.62, 1.6, 0.9);
    box(g, TAIL_MAT, 0.08, 0.6, 0.2, -2.62, 1.6, -0.9);
    addWheel(g, 1.8, 1.1, 0.5, 0.4); addWheel(g, 1.8, -1.1, 0.5, 0.4);
    addWheel(g, -1.8, 1.1, 0.5, 0.4); addWheel(g, -1.8, -1.1, 0.5, 0.4);
    g.userData = { length: 5.6, speed: 16 };
    return g;
  },
  ARP: (color) => { // sedã fastback elétrico
    const g = new THREE.Group();
    const mat = bodyMat(color);
    rbox(g, mat, 4.8, 0.9, 1.9, 0, 0.95, 0, 0.2);
    rbox(g, GLASS_MAT, 2.8, 0.7, 1.7, -0.2, 1.68, 0, 0.32);         // fastback
    box(g, TRIM_MAT, 4.8, 0.22, 1.92, 0, 0.55, 0);
    addLightBars(g, 2.41, -2.41, 1.0, 0.78);
    addWheel(g, 1.55, 0.95, 0.45); addWheel(g, 1.55, -0.95, 0.45);
    addWheel(g, -1.55, 0.95, 0.45); addWheel(g, -1.55, -0.95, 0.45);
    g.userData = { length: 5.0, speed: 19 };
    return g;
  },
  OTHER: (color) => { // hatch compacto
    const g = new THREE.Group();
    const mat = bodyMat(color);
    rbox(g, mat, 3.3, 0.95, 1.75, 0, 1.0, 0, 0.22);
    rbox(g, GLASS_MAT, 1.9, 0.75, 1.6, -0.25, 1.8, 0, 0.3);
    box(g, TRIM_MAT, 3.3, 0.24, 1.77, 0, 0.58, 0);
    addLightBars(g, 1.66, -1.66, 1.05, 0.7);
    addWheel(g, 1.15, 0.88, 0.4); addWheel(g, 1.15, -0.88, 0.4);
    addWheel(g, -1.15, 0.88, 0.4); addWheel(g, -1.15, -0.88, 0.4);
    g.userData = { length: 3.8, speed: 18 };
    return g;
  },
};

const prototypes = new Map();

export function createVehicle(cat, sizeFactor = 1) {
  if (!prototypes.has(cat)) {
    const builder = builders[cat] || builders.OTHER;
    prototypes.set(cat, builder(CATEGORIES[cat]?.color ?? 0x888888));
  }
  const proto = prototypes.get(cat);
  const v = proto.clone();
  v.scale.setScalar(sizeFactor);
  v.userData = {
    ...proto.userData,
    length: proto.userData.length * sizeFactor,
    // Veículos maiores (pacotes maiores) andam mais devagar.
    speed: proto.userData.speed / (0.6 + 0.4 * sizeFactor),
  };
  return v;
}
