// Agregador temporal: agrupa eventos normalizados em janelas fixas
// (ex.: 500 ms) e acumula, por categoria, pacotes, bytes e direção.
// É a partir dessas janelas que o replay decide quantos veículos criar —
// nunca 1 pacote = 1 veículo.

import { CATEGORY_KEYS } from './categories.js';

function emptyCounts() {
  const c = {};
  for (const k of CATEGORY_KEYS) {
    c[k] = { packets: 0, bytes: 0, out: 0, in: 0 };
  }
  return c;
}

export function aggregate(events, windowMs = 500) {
  if (!events.length) return { windows: [], firstTs: 0, lastTs: 0, windowMs };
  const windowSec = windowMs / 1000;
  const firstTs = events[0].ts;
  const lastTs = events[events.length - 1].ts;
  const windows = [];
  let current = null;

  for (const e of events) {
    const idx = Math.floor((e.ts - firstTs) / windowSec);
    if (!current || current.index !== idx) {
      current = {
        index: idx,
        t0: firstTs + idx * windowSec, // tempo (do dataset) de início da janela
        counts: emptyCounts(),
        totalPackets: 0,
        totalBytes: 0,
      };
      windows.push(current);
    }
    const c = current.counts[e.cat];
    c.packets += 1;
    c.bytes += e.size;
    if (e.dir === 'out') c.out += 1; else c.in += 1;
    current.totalPackets += 1;
    current.totalBytes += e.size;
  }

  return { windows, firstTs, lastTs, windowMs };
}

// Converte a contagem de pacotes de uma janela em quantidade de veículos.
// Usa uma razão "pacotes por veículo" ajustada pela densidade e limitada
// por um teto global, mantendo proporção entre categorias.
// Ex. (janela de 1 s, densidade 1): 800 HTTPS -> 16, 300 QUIC -> 6,
// 80 DNS -> 2, 10 ICMP -> 1.
export function vehiclesForWindow(win, opts) {
  const {
    windowMs = 500,
    density = 1,          // multiplicador visual (0.2x a 3x)
    maxPerSecond = 24,    // limite máximo de veículos por segundo
    cinematic = false,    // modo cinematográfico realça protocolos raros
  } = opts;

  const basePacketsPerVehicle = 50 * (windowMs / 1000);
  const ppv = Math.max(1, basePacketsPerVehicle / density);
  const result = []; // { cat, n, dirOutRatio, sizeFactor }

  for (const [cat, c] of Object.entries(win.counts)) {
    if (c.packets <= 0) continue;
    let n = Math.round(c.packets / ppv);
    // Protocolos raros aparecem ocasionalmente para dar variedade.
    if (n === 0) {
      const chance = cinematic ? 0.9 : 0.5;
      n = Math.random() < chance ? 1 : 0;
    }
    if (n <= 0) continue;
    const avgSize = c.bytes / c.packets;
    // Pacotes maiores -> veículos maiores e mais lentos.
    const sizeFactor = Math.min(1.45, Math.max(0.85, 0.85 + (avgSize / 1500) * 0.6));
    result.push({
      cat,
      n,
      dirOutRatio: c.packets > 0 ? c.out / c.packets : 0.5,
      sizeFactor,
    });
  }

  // Teto global proporcional.
  const maxPerWindow = Math.max(1, Math.round(maxPerSecond * (windowMs / 1000)));
  const total = result.reduce((s, r) => s + r.n, 0);
  if (total > maxPerWindow) {
    const scale = maxPerWindow / total;
    for (const r of result) r.n = Math.max(1, Math.floor(r.n * scale));
  }
  return result;
}
