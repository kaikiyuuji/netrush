// Normalizador de eventos: converte pacotes brutos vindos dos leitores
// (PCAP, JSON, CSV) em eventos uniformes para o agregador.
//
// Entrada (por pacote):  { ts, l4, srcIp, dstIp, srcPort, dstPort, size }
// Saída  (por evento):   { ts, cat, dir, size }
//
// Privacidade: apenas metadados técnicos são mantidos; nenhum payload,
// URL ou conteúdo de aplicação passa deste ponto.

import { classify } from './classifier.js';
import { DirectionResolver } from './direction.js';

export function normalizeEvents(rawPackets) {
  const resolver = new DirectionResolver();
  const events = [];
  for (const p of rawPackets) {
    if (!p || !Number.isFinite(p.ts)) continue;
    const cat = classify(p.l4, p.srcPort, p.dstPort);
    const dir = resolver.resolve(p.srcIp, p.srcPort, p.dstIp, p.dstPort);
    events.push({
      ts: p.ts,
      cat,
      dir,
      size: Number.isFinite(p.size) && p.size > 0 ? p.size : 64,
    });
  }
  events.sort((a, b) => a.ts - b.ts);
  return events;
}
