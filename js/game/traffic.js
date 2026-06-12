// Gerenciador de tráfego: fila de spawns, escolha de faixa balanceada,
// movimento com car-following e trava anticolisão, fila de entrada fora
// da tela (para vazões altas nada é descartado de imediato), detecção de
// congestionamento e comboios.

import { BRIDGE } from './engine.js';
import { createVehicle, pulseSirens } from './vehicles.js';

const MAX_ON_BRIDGE = 320;   // capacidade total (inclui a fila de entrada)
const CONGESTION_AT = 110;   // a partir daqui o HUD acusa congestionamento
const MIN_GAP = 2.2;         // folga entre veículos, além dos comprimentos
const ENTRY_BUFFER = 70;     // profundidade da fila antes do início da ponte

export class TrafficManager {
  constructor(scene) {
    this.scene = scene;
    this.spawnQueue = []; // { at (s, relógio interno), cat, dir, sizeFactor }
    this.clock = 0;
    // Uma lista de veículos por faixa; faixas 0..2 em cada sentido.
    this.lanes = { out: [[], [], []], in: [[], [], []] };
    this.speedMultiplier = 1;
    this.onBridgeCount = 0;
    this.congested = false;
  }

  // spawns: [{cat, n, dirOutRatio, sizeFactor, convoy}], espalhados ao longo
  // de durationSec (a duração real da janela já dividida pela velocidade).
  enqueue(spawns, durationSec) {
    for (const s of spawns) {
      for (let i = 0; i < s.n; i++) {
        const dir = Math.random() < s.dirOutRatio ? 'out' : 'in';
        // Comboios nascem agrupados no início da janela (mas o sistema de
        // faixas os distribui, para não formar fila única).
        const at = s.convoy
          ? this.clock + i * Math.min(0.3, durationSec / Math.max(1, s.n))
          : this.clock + Math.random() * durationSec;
        this.spawnQueue.push({
          at, cat: s.cat, dir,
          sizeFactor: s.sizeFactor * (0.95 + Math.random() * 0.1),
        });
      }
    }
    this.spawnQueue.sort((a, b) => a.at - b.at);
  }

  // Botões da interface: gera imediatamente 1 veículo da categoria.
  spawnManual(cat) {
    this.spawnQueue.push({
      at: this.clock,
      cat,
      dir: Math.random() < 0.5 ? 'out' : 'in',
      sizeFactor: 0.95 + Math.random() * 0.15,
    });
    this.spawnQueue.sort((a, b) => a.at - b.at);
  }

  // Escolhe a faixa com mais espaço na entrada, com forte aleatorização
  // entre faixas parecidas para distribuir o fluxo (evita fila única).
  pickLane(dir) {
    const lanes = this.lanes[dir];
    let best = 0;
    let bestScore = -Infinity;
    for (let i = 0; i < lanes.length; i++) {
      const last = lanes[i][lanes[i].length - 1];
      const entrySpace = last
        ? last.progress - last.vehicle.userData.length / 2
        : 200;
      const score = entrySpace + Math.random() * 40;
      if (score > bestScore) { bestScore = score; best = i; }
    }
    return best;
  }

  spawn(item) {
    if (this.onBridgeCount >= MAX_ON_BRIDGE) return false;
    const vehicle = createVehicle(item.cat, item.sizeFactor);
    const laneIdx = this.pickLane(item.dir);
    const lane = this.lanes[item.dir][laneIdx];
    const last = lane[lane.length - 1];

    // Sem espaço na boca da ponte? Entra na fila fora da tela, atrás do
    // último veículo (progress negativo), em vez de ser descartado.
    let start = 0;
    if (last) {
      const limit = last.progress
        - (last.vehicle.userData.length + vehicle.userData.length) / 2 - MIN_GAP;
      start = Math.min(0, limit);
    }
    if (start < -ENTRY_BUFFER) return false; // fila desta faixa cheia

    const z = item.dir === 'out' ? BRIDGE.lanesOut[laneIdx] : BRIDGE.lanesIn[laneIdx];
    const x0 = item.dir === 'out' ? -BRIDGE.spawnX + start : BRIDGE.spawnX - start;
    vehicle.position.set(x0, BRIDGE.deckY + 0.02, z);
    vehicle.rotation.y = item.dir === 'out' ? 0 : Math.PI;
    this.scene.add(vehicle);
    lane.push({
      vehicle,
      dir: item.dir,
      cat: item.cat,
      progress: start,
      speed: last ? last.speed : 0,
      desired: vehicle.userData.speed * (0.9 + Math.random() * 0.2),
    });
    this.onBridgeCount++;
    return true;
  }

  update(dt, elapsed) {
    this.clock += dt;
    pulseSirens(elapsed);

    // Processa a fila de spawn. Itens sem espaço tentam de novo em breve
    // (sem travar os demais) e só são descartados depois de 3 s.
    const retry = [];
    while (this.spawnQueue.length && this.spawnQueue[0].at <= this.clock) {
      const item = this.spawnQueue.shift();
      if (!this.spawn(item) && this.clock - item.at < 3) {
        item.at = this.clock + 0.25 + Math.random() * 0.3;
        retry.push(item);
      }
    }
    if (retry.length) {
      this.spawnQueue.push(...retry);
      this.spawnQueue.sort((a, b) => a.at - b.at);
    }

    const span = BRIDGE.spawnX * 2;
    // Congestionamento desacelera todo mundo gradualmente.
    this.congested = this.onBridgeCount > CONGESTION_AT;
    const globalFactor = this.congested
      ? Math.max(0.35, 1 - (this.onBridgeCount - CONGESTION_AT) / 400)
      : 1;

    for (const dir of ['out', 'in']) {
      for (const lane of this.lanes[dir]) {
        // lane[0] é o veículo mais à frente.
        for (let i = 0; i < lane.length; i++) {
          const v = lane[i];
          let target = v.desired * globalFactor;
          const ahead = i > 0 ? lane[i - 1] : null;
          if (ahead) {
            const gap = ahead.progress - v.progress
              - (ahead.vehicle.userData.length + v.vehicle.userData.length) / 2;
            // Frenagem antecipada: começa a reduzir bem antes de encostar.
            if (gap < MIN_GAP) target = Math.min(target, Math.max(0, ahead.speed - 2));
            else if (gap < MIN_GAP * 4) {
              target = Math.min(target, ahead.speed + (gap - MIN_GAP) * 1.2);
            }
          }
          // Aceleração/frenagem suaves.
          v.speed += (target - v.speed) * Math.min(1, dt * 2.5);
          v.progress += v.speed * dt * this.speedMultiplier;
          // Trava rígida: nunca avança além do para-choque do veículo da
          // frente (o da frente já foi atualizado neste frame).
          if (ahead) {
            const limit = ahead.progress - 0.7
              - (ahead.vehicle.userData.length + v.vehicle.userData.length) / 2;
            if (v.progress > limit) {
              v.progress = limit;
              v.speed = Math.min(v.speed, ahead.speed);
            }
          }
          const x = dir === 'out' ? -BRIDGE.spawnX + v.progress : BRIDGE.spawnX - v.progress;
          v.vehicle.position.x = x;
        }
        // Remove os que chegaram do outro lado.
        while (lane.length && lane[0].progress > span) {
          const done = lane.shift();
          this.scene.remove(done.vehicle);
          this.onBridgeCount--;
        }
      }
    }
  }

  clear() {
    for (const dir of ['out', 'in']) {
      for (const lane of this.lanes[dir]) {
        for (const v of lane) this.scene.remove(v.vehicle);
        lane.length = 0;
      }
    }
    this.spawnQueue.length = 0;
    this.onBridgeCount = 0;
    this.congested = false;
  }
}
