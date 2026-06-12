// Gerenciador de tráfego: fila de spawns, escolha de faixa, movimento
// com car-following (veículo desacelera se o da frente estiver perto),
// detecção de congestionamento e comboios.

import { BRIDGE } from './engine.js';
import { createVehicle, pulseSirens } from './vehicles.js';

const MAX_ON_BRIDGE = 140;
const MIN_GAP = 2.2; // espaço extra entre veículos, além dos comprimentos

export class TrafficManager {
  constructor(scene) {
    this.scene = scene;
    this.spawnQueue = []; // { at (s, relógio interno), cat, dir, sizeFactor, convoy }
    this.clock = 0;
    // Uma lista de veículos por faixa; faixas 0..2 em cada sentido.
    this.lanes = { out: [[], [], []], in: [[], [], []] };
    this.speedMultiplier = 1;
    this.onBridgeCount = 0;
    this.congested = false;
    this.convoyLane = { out: 0, in: 0 };
  }

  // spawns: [{cat, n, dirOutRatio, sizeFactor, convoy}], espalhados ao longo
  // de durationSec (a duração real da janela já dividida pela velocidade).
  enqueue(spawns, durationSec) {
    for (const s of spawns) {
      // Comboios nascem agrupados no início da janela e na mesma faixa.
      const convoyLane = s.convoy
        ? (this.convoyLane[s.dirOutRatio >= 0.5 ? 'out' : 'in'] =
            (this.convoyLane[s.dirOutRatio >= 0.5 ? 'out' : 'in'] + 1) % 3)
        : null;
      for (let i = 0; i < s.n; i++) {
        const dir = Math.random() < s.dirOutRatio ? 'out' : 'in';
        const at = s.convoy
          ? this.clock + i * Math.min(0.35, durationSec / Math.max(1, s.n))
          : this.clock + Math.random() * durationSec;
        this.spawnQueue.push({
          at, cat: s.cat, dir,
          sizeFactor: s.sizeFactor * (0.95 + Math.random() * 0.1),
          lane: s.convoy ? convoyLane : null,
        });
      }
    }
    this.spawnQueue.sort((a, b) => a.at - b.at);
  }

  pickLane(dir, preferred) {
    const lanes = this.lanes[dir];
    if (preferred !== null && preferred !== undefined) return preferred;
    // Escolhe a faixa com mais espaço livre na entrada.
    let best = 0;
    let bestScore = -Infinity;
    for (let i = 0; i < lanes.length; i++) {
      const last = lanes[i][lanes[i].length - 1];
      const score = last ? -last.progress + Math.random() : 1000 + Math.random();
      if (score > bestScore) { bestScore = score; best = i; }
    }
    return best;
  }

  spawn(item) {
    if (this.onBridgeCount >= MAX_ON_BRIDGE) return false;
    const laneIdx = this.pickLane(item.dir, item.lane);
    const lane = this.lanes[item.dir][laneIdx];
    const last = lane[lane.length - 1];
    // Não nasce em cima de outro veículo parado na entrada.
    if (last && last.progress < last.vehicle.userData.length + MIN_GAP + 2) return false;

    const vehicle = createVehicle(item.cat, item.sizeFactor);
    // Só nasce se houver espaço para o novo veículo inteiro mais a folga.
    if (last && last.progress - last.vehicle.userData.length / 2 <
        vehicle.userData.length / 2 + MIN_GAP) {
      return false;
    }
    const z = item.dir === 'out' ? BRIDGE.lanesOut[laneIdx] : BRIDGE.lanesIn[laneIdx];
    const x0 = item.dir === 'out' ? -BRIDGE.spawnX : BRIDGE.spawnX;
    vehicle.position.set(x0, BRIDGE.deckY + 0.1, z);
    vehicle.rotation.y = item.dir === 'out' ? 0 : Math.PI;
    this.scene.add(vehicle);
    lane.push({
      vehicle,
      dir: item.dir,
      cat: item.cat,
      progress: 0, // distância percorrida desde o spawn
      speed: 0,
      desired: vehicle.userData.speed * (0.9 + Math.random() * 0.2),
    });
    this.onBridgeCount++;
    return true;
  }

  update(dt, elapsed) {
    this.clock += dt;
    pulseSirens(elapsed);

    // Processa a fila de spawn (itens não posicionáveis são descartados
    // depois de 3 s — a ponte está cheia, e isso é o congestionamento).
    while (this.spawnQueue.length && this.spawnQueue[0].at <= this.clock) {
      const item = this.spawnQueue.shift();
      if (!this.spawn(item) && this.clock - item.at < 3) {
        item.at = this.clock + 0.4;
        this.spawnQueue.push(item);
        this.spawnQueue.sort((a, b) => a.at - b.at);
        break;
      }
    }

    const span = BRIDGE.spawnX * 2;
    // Congestionamento global desacelera todo mundo.
    const load = this.onBridgeCount / MAX_ON_BRIDGE;
    this.congested = load > 0.65;
    const globalFactor = this.congested ? Math.max(0.25, 1.3 - load) : 1;

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
              v.progress = Math.max(0, limit);
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
