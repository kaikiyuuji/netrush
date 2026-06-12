// Fábrica de veículos 3D em estilo low-poly chapado: caixas retas com
// materiais foscos, cabines escuras com teto na cor da carroceria e
// pares de faróis (brancos) e lanternas (vermelhas) quadrados e
// emissivos — legíveis mesmo na cena noturna. Geometrias e materiais
// são cacheados; os grupos são clonados a cada spawn.

import * as THREE from 'three';
import { CATEGORIES } from '../core/categories.js';

// --- materiais compartilhados -------------------------------------------

const TIRE_MAT = new THREE.MeshStandardMaterial({ color: 0x07080a, roughness: 1 });
const CABIN_MAT = new THREE.MeshStandardMaterial({ color: 0x171c28, roughness: 0.9 }); // vidros
const TRIM_MAT = new THREE.MeshStandardMaterial({ color: 0x10131a, roughness: 0.9 });
const CARGO_MAT = new THREE.MeshStandardMaterial({ color: 0x9aa3b2, roughness: 0.85 });
const POLICE_WHITE = new THREE.MeshStandardMaterial({ color: 0xd9dee6, roughness: 0.85 });
const HEAD_MAT = new THREE.MeshStandardMaterial({
  color: 0xffffff, emissive: 0xf2f7ff, emissiveIntensity: 2.6,
});
const TAIL_MAT = new THREE.MeshStandardMaterial({
  color: 0x550000, emissive: 0xff2222, emissiveIntensity: 2.2,
});
const AMBER_MAT = new THREE.MeshStandardMaterial({
  color: 0x664400, emissive: 0xffb340, emissiveIntensity: 2.2,
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

// Carroceria fosca, sem metalizado: visual chapado de low-poly.
function bodyMat(color) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.05 });
}

// --- helpers de construção ----------------------------------------------

const WHEEL_GEO = new THREE.CylinderGeometry(1, 1, 1, 10);

function box(g, mat, w, h, d, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  g.add(m);
  return m;
}

function addWheel(g, x, z, r = 0.42, w = 0.32) {
  const tire = new THREE.Mesh(WHEEL_GEO, TIRE_MAT);
  tire.rotation.x = Math.PI / 2;
  tire.scale.set(r, w, r);
  tire.position.set(x, r, z);
  g.add(tire);
}

// Par de luzes quadradas (faróis ou lanternas), uma de cada lado.
function lightPair(g, mat, x, y, zOff, s = 0.18) {
  box(g, mat, 0.07, s, s * 1.3, x, y, zOff);
  box(g, mat, 0.07, s, s * 1.3, x, y, -zOff);
}

// Cabine no estilo da referência: faixa de vidro escura com um teto fino
// na cor da carroceria por cima.
function cabin(g, mat, w, d, x, yBase, h = 0.7) {
  box(g, CABIN_MAT, w, h, d, x, yBase + h / 2, 0);
  box(g, mat, w * 0.96, 0.14, d * 0.98, x, yBase + h + 0.07, 0);
}

// --- builders (veículo aponta para +X, chão em y=0) ----------------------
// userData.length = comprimento, userData.speed = velocidade base (u/s).

const builders = {
  HTTPS: (color) => { // motocicleta
    const g = new THREE.Group();
    const mat = bodyMat(color);
    box(g, mat, 1.7, 0.45, 0.5, 0, 1.0, 0);            // chassi
    box(g, mat, 0.6, 0.3, 0.45, 0.25, 1.38, 0);        // tanque
    box(g, TRIM_MAT, 0.55, 0.18, 0.4, -0.5, 1.32, 0);  // banco
    const fork = box(g, TRIM_MAT, 0.09, 0.7, 0.09, 0.8, 0.6, 0);
    fork.rotation.z = 0.3;
    box(g, HEAD_MAT, 0.07, 0.18, 0.22, 0.88, 1.15, 0);
    box(g, TAIL_MAT, 0.07, 0.14, 0.2, -0.88, 1.15, 0);
    addWheel(g, 0.8, 0, 0.36, 0.16);
    addWheel(g, -0.8, 0, 0.36, 0.18);
    g.userData = { length: 2.4, speed: 26 };
    return g;
  },
  QUIC: (color) => { // ônibus urbano
    const g = new THREE.Group();
    const mat = bodyMat(color);
    box(g, mat, 10.4, 2.7, 2.55, 0, 2.0, 0);
    box(g, CABIN_MAT, 9.9, 0.8, 2.58, -0.1, 2.85, 0);  // faixa de janelas
    box(g, AMBER_MAT, 0.07, 0.3, 1.5, 5.22, 3.05, 0);  // letreiro
    box(g, TRIM_MAT, 3.0, 0.25, 1.7, -0.5, 3.5, 0);    // ar-condicionado
    box(g, TRIM_MAT, 10.4, 0.35, 2.57, 0, 0.78, 0);    // saia
    lightPair(g, HEAD_MAT, 5.21, 1.1, 0.85, 0.22);
    lightPair(g, TAIL_MAT, -5.21, 1.3, 0.9, 0.26);
    addWheel(g, 3.5, 1.1, 0.55, 0.45); addWheel(g, 3.5, -1.1, 0.55, 0.45);
    addWheel(g, -3.5, 1.1, 0.55, 0.45); addWheel(g, -3.5, -1.1, 0.55, 0.45);
    g.userData = { length: 11.5, speed: 12 };
    return g;
  },
  HTTP: (color) => { // táxi
    const g = new THREE.Group();
    const mat = bodyMat(color);
    box(g, mat, 4.3, 0.85, 1.9, 0, 1.02, 0);
    cabin(g, mat, 2.4, 1.75, -0.15, 1.45);
    box(g, AMBER_MAT, 0.5, 0.24, 0.3, -0.15, 2.45, 0); // luminoso
    lightPair(g, HEAD_MAT, 2.16, 1.05, 0.62);
    lightPair(g, TAIL_MAT, -2.16, 1.05, 0.62);
    addWheel(g, 1.45, 0.93, 0.44); addWheel(g, 1.45, -0.93, 0.44);
    addWheel(g, -1.45, 0.93, 0.44); addWheel(g, -1.45, -0.93, 0.44);
    g.userData = { length: 4.8, speed: 20 };
    return g;
  },
  DNS: (color) => { // bicicleta
    const g = new THREE.Group();
    const mat = bodyMat(color);
    const top = box(g, mat, 1.15, 0.09, 0.09, 0.05, 1.0, 0);
    top.rotation.z = 0.12;
    const down = box(g, mat, 1.0, 0.09, 0.09, 0.1, 0.76, 0);
    down.rotation.z = -0.35;
    box(g, mat, 0.09, 0.6, 0.09, -0.46, 0.85, 0);
    const fork = box(g, TRIM_MAT, 0.07, 0.6, 0.07, 0.56, 0.6, 0);
    fork.rotation.z = 0.25;
    box(g, TRIM_MAT, 0.08, 0.08, 0.45, 0.6, 1.22, 0);  // guidão
    box(g, TRIM_MAT, 0.3, 0.07, 0.18, -0.48, 1.22, 0); // selim
    box(g, HEAD_MAT, 0.06, 0.1, 0.1, 0.72, 1.0, 0);
    addWheel(g, 0.6, 0, 0.34, 0.07);
    addWheel(g, -0.6, 0, 0.34, 0.07);
    g.userData = { length: 1.9, speed: 7 };
    return g;
  },
  SSH: (color) => { // caminhão baú
    const g = new THREE.Group();
    const mat = bodyMat(color);
    box(g, mat, 2.1, 1.75, 2.2, 2.85, 1.5, 0);          // cabine
    box(g, CABIN_MAT, 0.08, 0.65, 1.95, 3.9, 1.95, 0);  // para-brisa
    box(g, CARGO_MAT, 5.4, 2.55, 2.45, -0.85, 1.95, 0); // baú
    box(g, TRIM_MAT, 4.8, 0.4, 2.4, -0.85, 0.55, 0);    // saia
    lightPair(g, HEAD_MAT, 3.91, 0.95, 0.75, 0.2);
    lightPair(g, TAIL_MAT, -3.56, 1.2, 0.95, 0.24);
    addWheel(g, 2.9, 1.08, 0.5, 0.42); addWheel(g, 2.9, -1.08, 0.5, 0.42);
    addWheel(g, -1.4, 1.08, 0.5, 0.42); addWheel(g, -1.4, -1.08, 0.5, 0.42);
    addWheel(g, -2.8, 1.08, 0.5, 0.42); addWheel(g, -2.8, -1.08, 0.5, 0.42);
    g.userData = { length: 8.2, speed: 13 };
    return g;
  },
  TCP: (color) => { // carro esportivo
    const g = new THREE.Group();
    const mat = bodyMat(color);
    box(g, mat, 4.3, 0.55, 1.9, 0, 0.78, 0);
    box(g, CABIN_MAT, 1.8, 0.45, 1.62, -0.2, 1.28, 0);
    box(g, mat, 1.6, 0.12, 1.5, -0.2, 1.56, 0);         // teto
    box(g, mat, 0.45, 0.08, 1.85, -2.0, 1.3, 0);        // aerofólio
    box(g, TRIM_MAT, 0.08, 0.3, 0.08, -2.0, 1.1, 0.65);
    box(g, TRIM_MAT, 0.08, 0.3, 0.08, -2.0, 1.1, -0.65);
    lightPair(g, HEAD_MAT, 2.16, 0.82, 0.6);
    lightPair(g, TAIL_MAT, -2.16, 0.82, 0.6);
    addWheel(g, 1.42, 0.93, 0.42, 0.4); addWheel(g, 1.42, -0.93, 0.42, 0.4);
    addWheel(g, -1.42, 0.93, 0.42, 0.4); addWheel(g, -1.42, -0.93, 0.42, 0.4);
    g.userData = { length: 4.6, speed: 30 };
    return g;
  },
  UDP: (color) => { // carro de polícia
    const g = new THREE.Group();
    const mat = bodyMat(color);
    box(g, POLICE_WHITE, 4.6, 0.85, 1.9, 0, 0.98, 0);
    box(g, mat, 4.62, 0.26, 1.92, 0, 0.66, 0);          // faixa azul
    box(g, CABIN_MAT, 2.3, 0.7, 1.78, -0.1, 1.75, 0);
    box(g, POLICE_WHITE, 2.15, 0.13, 1.7, -0.1, 2.16, 0); // teto
    box(g, SIREN_RED, 0.4, 0.16, 0.62, -0.1, 2.32, 0.36);
    box(g, SIREN_BLUE, 0.4, 0.16, 0.62, -0.1, 2.32, -0.36);
    box(g, TRIM_MAT, 0.4, 0.25, 1.55, 2.3, 0.75, 0);    // para-choque
    lightPair(g, HEAD_MAT, 2.31, 1.0, 0.62);
    lightPair(g, TAIL_MAT, -2.31, 1.0, 0.62);
    addWheel(g, 1.5, 0.93, 0.44); addWheel(g, 1.5, -0.93, 0.44);
    addWheel(g, -1.5, 0.93, 0.44); addWheel(g, -1.5, -0.93, 0.44);
    g.userData = { length: 5.0, speed: 24 };
    return g;
  },
  ICMP: (color) => { // van
    const g = new THREE.Group();
    const mat = bodyMat(color);
    box(g, mat, 5.1, 2.1, 2.15, 0, 1.75, 0);
    box(g, CABIN_MAT, 0.08, 0.8, 1.95, 2.56, 2.25, 0);  // para-brisa
    box(g, CABIN_MAT, 1.1, 0.55, 2.17, 1.5, 2.4, 0);    // vidros frontais
    box(g, TRIM_MAT, 5.1, 0.3, 2.17, 0, 0.72, 0);
    lightPair(g, HEAD_MAT, 2.56, 1.0, 0.7, 0.2);
    lightPair(g, TAIL_MAT, -2.56, 1.5, 0.85, 0.24);
    addWheel(g, 1.75, 1.05, 0.48, 0.38); addWheel(g, 1.75, -1.05, 0.48, 0.38);
    addWheel(g, -1.75, 1.05, 0.48, 0.38); addWheel(g, -1.75, -1.05, 0.48, 0.38);
    g.userData = { length: 5.6, speed: 16 };
    return g;
  },
  ARP: (color) => { // sedã
    const g = new THREE.Group();
    const mat = bodyMat(color);
    box(g, mat, 4.7, 0.85, 1.9, 0, 0.98, 0);
    cabin(g, mat, 2.6, 1.75, -0.15, 1.4);
    lightPair(g, HEAD_MAT, 2.36, 1.0, 0.62);
    lightPair(g, TAIL_MAT, -2.36, 1.0, 0.62);
    addWheel(g, 1.5, 0.93, 0.44); addWheel(g, 1.5, -0.93, 0.44);
    addWheel(g, -1.5, 0.93, 0.44); addWheel(g, -1.5, -0.93, 0.44);
    g.userData = { length: 5.0, speed: 19 };
    return g;
  },
  OTHER: (color) => { // carro compacto
    const g = new THREE.Group();
    const mat = bodyMat(color);
    box(g, mat, 3.2, 0.85, 1.7, 0, 0.98, 0);
    cabin(g, mat, 1.7, 1.55, -0.2, 1.4, 0.65);
    lightPair(g, HEAD_MAT, 1.61, 1.0, 0.55, 0.16);
    lightPair(g, TAIL_MAT, -1.61, 1.0, 0.55, 0.16);
    addWheel(g, 1.05, 0.88, 0.4); addWheel(g, 1.05, -0.88, 0.4);
    addWheel(g, -1.05, 0.88, 0.4); addWheel(g, -1.05, -0.88, 0.4);
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
