// Fábrica de veículos 3D procedurais. Cada categoria de tráfego tem um
// veículo próprio, construído com primitivas. Geometrias e materiais são
// cacheados e os grupos são clonados a cada spawn (clones compartilham
// geometria/material, então o custo por veículo é baixo).

import * as THREE from 'three';
import { CATEGORIES } from '../core/categories.js';

const WHEEL_GEO = new THREE.CylinderGeometry(0.45, 0.45, 0.35, 10);
const WHEEL_MAT = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.9 });
const GLASS_MAT = new THREE.MeshStandardMaterial({ color: 0x93c5fd, roughness: 0.1, metalness: 0.6 });
const SIREN_RED = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 1 });
const SIREN_BLUE = new THREE.MeshStandardMaterial({ color: 0x0044ff, emissive: 0x0044ff, emissiveIntensity: 1 });

// As sirenes de todas as viaturas compartilham material; um único pulso
// global faz todas piscarem alternadamente.
export function pulseSirens(elapsed) {
  const phase = Math.sin(elapsed * 10) > 0;
  SIREN_RED.emissiveIntensity = phase ? 1.6 : 0.1;
  SIREN_BLUE.emissiveIntensity = phase ? 0.1 : 1.6;
}
const DARK_MAT = new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.8 });
const WHITE_MAT = new THREE.MeshStandardMaterial({ color: 0xf4f4f5, roughness: 0.6 });

function bodyMat(color) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.25 });
}

function addWheel(group, x, z, scale = 1) {
  const w = new THREE.Mesh(WHEEL_GEO, WHEEL_MAT);
  w.rotation.x = Math.PI / 2;
  w.scale.setScalar(scale);
  w.position.set(x, 0.45 * scale, z);
  group.add(w);
}

function box(group, mat, w, h, d, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  group.add(m);
  return m;
}

// Cada builder devolve um Group com o veículo apontando para +X.
// userData.length = comprimento, userData.speed = velocidade base (u/s).

const builders = {
  HTTPS: (color) => { // motocicleta
    const g = new THREE.Group();
    const mat = bodyMat(color);
    box(g, mat, 1.6, 0.45, 0.5, 0, 0.85, 0);          // chassi
    box(g, mat, 0.5, 0.5, 0.45, -0.3, 1.25, 0);        // tanque/banco
    box(g, DARK_MAT, 0.15, 0.8, 0.7, 0.8, 1.25, 0);    // guidão
    addWheel(g, 0.9, 0, 0.85);
    addWheel(g, -0.9, 0, 0.85);
    g.userData = { length: 2.4, speed: 26 };
    return g;
  },
  QUIC: (color) => { // ônibus urbano
    const g = new THREE.Group();
    const mat = bodyMat(color);
    box(g, mat, 10.5, 3.1, 2.6, 0, 2.1, 0);
    box(g, GLASS_MAT, 10.0, 1.0, 2.65, 0, 2.7, 0);     // janelas corridas
    box(g, WHITE_MAT, 10.5, 0.5, 2.6, 0, 0.75, 0);     // saia
    addWheel(g, 3.6, 1.1, 1.3); addWheel(g, 3.6, -1.1, 1.3);
    addWheel(g, -3.6, 1.1, 1.3); addWheel(g, -3.6, -1.1, 1.3);
    g.userData = { length: 11.5, speed: 12 };
    return g;
  },
  HTTP: (color) => { // táxi
    const g = new THREE.Group();
    const mat = bodyMat(color);
    box(g, mat, 4.4, 1.0, 2.0, 0, 1.0, 0);
    box(g, mat, 2.3, 0.85, 1.8, -0.2, 1.9, 0);
    box(g, GLASS_MAT, 2.0, 0.6, 1.85, -0.2, 1.95, 0);
    box(g, DARK_MAT, 0.8, 0.35, 0.5, -0.2, 2.5, 0);    // luminoso "TAXI"
    addWheel(g, 1.5, 1.0); addWheel(g, 1.5, -1.0);
    addWheel(g, -1.5, 1.0); addWheel(g, -1.5, -1.0);
    g.userData = { length: 4.8, speed: 20 };
    return g;
  },
  DNS: (color) => { // bicicleta
    const g = new THREE.Group();
    const mat = bodyMat(color);
    box(g, mat, 1.3, 0.12, 0.12, 0, 0.85, 0);
    box(g, mat, 0.12, 0.7, 0.12, 0.55, 1.0, 0);
    box(g, mat, 0.12, 0.7, 0.12, -0.5, 1.0, 0);
    box(g, DARK_MAT, 0.1, 0.1, 0.5, 0.55, 1.4, 0);     // guidão
    box(g, DARK_MAT, 0.35, 0.1, 0.25, -0.5, 1.4, 0);   // selim
    addWheel(g, 0.65, 0, 0.7);
    addWheel(g, -0.65, 0, 0.7);
    g.userData = { length: 1.9, speed: 7 };
    return g;
  },
  SSH: (color) => { // caminhão baú
    const g = new THREE.Group();
    const mat = bodyMat(color);
    box(g, mat, 2.2, 1.9, 2.3, 2.7, 1.55, 0);          // cabine
    box(g, GLASS_MAT, 0.3, 0.8, 2.0, 3.7, 2.0, 0);
    box(g, WHITE_MAT, 5.2, 2.9, 2.5, -0.9, 2.15, 0);   // baú
    box(g, mat, 5.2, 0.4, 2.5, -0.9, 0.7, 0);
    addWheel(g, 2.8, 1.15, 1.2); addWheel(g, 2.8, -1.15, 1.2);
    addWheel(g, -1.6, 1.15, 1.2); addWheel(g, -1.6, -1.15, 1.2);
    addWheel(g, -2.9, 1.15, 1.2); addWheel(g, -2.9, -1.15, 1.2);
    g.userData = { length: 8.2, speed: 13 };
    return g;
  },
  TCP: (color) => { // carro esportivo
    const g = new THREE.Group();
    const mat = bodyMat(color);
    box(g, mat, 4.3, 0.7, 2.0, 0, 0.75, 0);
    box(g, GLASS_MAT, 1.8, 0.55, 1.7, -0.3, 1.35, 0);  // cúpula baixa
    box(g, mat, 0.8, 0.35, 1.9, -1.9, 1.15, 0);        // aerofólio
    addWheel(g, 1.45, 1.0); addWheel(g, 1.45, -1.0);
    addWheel(g, -1.45, 1.0); addWheel(g, -1.45, -1.0);
    g.userData = { length: 4.6, speed: 30 };
    return g;
  },
  UDP: (color) => { // carro de polícia
    const g = new THREE.Group();
    const mat = bodyMat(color);
    box(g, WHITE_MAT, 4.6, 1.0, 2.0, 0, 1.0, 0);
    box(g, mat, 4.6, 0.45, 2.05, 0, 0.75, 0);          // faixa azul
    box(g, mat, 2.4, 0.85, 1.85, -0.1, 1.9, 0);
    box(g, GLASS_MAT, 2.1, 0.6, 1.9, -0.1, 1.95, 0);
    const sirenR = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.6), SIREN_RED);
    sirenR.position.set(-0.1, 2.5, 0.45);
    g.add(sirenR);
    const sirenB = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.6), SIREN_BLUE);
    sirenB.position.set(-0.1, 2.5, -0.45);
    g.add(sirenB);
    g.userData = { length: 5.0, speed: 24 };
    return g;
  },
  ICMP: (color) => { // van
    const g = new THREE.Group();
    const mat = bodyMat(color);
    box(g, mat, 5.2, 2.4, 2.2, 0, 1.7, 0);
    box(g, GLASS_MAT, 0.3, 0.8, 1.9, 2.45, 2.1, 0);
    box(g, GLASS_MAT, 3.0, 0.6, 2.25, -0.6, 2.3, 0);
    addWheel(g, 1.8, 1.1, 1.1); addWheel(g, 1.8, -1.1, 1.1);
    addWheel(g, -1.8, 1.1, 1.1); addWheel(g, -1.8, -1.1, 1.1);
    g.userData = { length: 5.6, speed: 16 };
    return g;
  },
  ARP: (color) => { // sedã
    const g = new THREE.Group();
    const mat = bodyMat(color);
    box(g, mat, 4.7, 1.0, 1.95, 0, 1.0, 0);
    box(g, mat, 2.5, 0.8, 1.8, -0.1, 1.85, 0);
    box(g, GLASS_MAT, 2.2, 0.55, 1.85, -0.1, 1.9, 0);
    addWheel(g, 1.55, 0.98); addWheel(g, 1.55, -0.98);
    addWheel(g, -1.55, 0.98); addWheel(g, -1.55, -0.98);
    g.userData = { length: 5.0, speed: 19 };
    return g;
  },
  OTHER: (color) => { // carro compacto
    const g = new THREE.Group();
    const mat = bodyMat(color);
    box(g, mat, 3.4, 1.0, 1.8, 0, 0.95, 0);
    box(g, mat, 1.9, 0.8, 1.7, -0.3, 1.75, 0);
    box(g, GLASS_MAT, 1.7, 0.55, 1.75, -0.3, 1.8, 0);
    addWheel(g, 1.15, 0.9); addWheel(g, 1.15, -0.9);
    addWheel(g, -1.15, 0.9); addWheel(g, -1.15, -0.9);
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
