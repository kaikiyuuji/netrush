// Testes dos módulos puros (leitores, classificador, direção, agregador).
// Uso: node scripts/test_parsers.mjs   (requer samples/ gerados antes)

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

import { parsePcapAuto, isPcapBuffer } from '../js/readers/pcapReader.js';
import { parseJsonDataset, parseCsvDataset } from '../js/readers/datasetReader.js';
import { normalizeEvents } from '../js/core/normalizer.js';
import { aggregate, vehiclesForWindow } from '../js/core/aggregator.js';
import { classify } from '../js/core/classifier.js';
import { isPrivateIp, DirectionResolver } from '../js/core/direction.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
function ok(name, fn) {
  fn();
  passed++;
  console.log(`  ✔ ${name}`);
}

console.log('classificador:');
ok('TCP 443 -> HTTPS', () => assert.equal(classify('TCP', 50000, 443), 'HTTPS'));
ok('UDP 443 -> QUIC', () => assert.equal(classify('UDP', 443, 50000), 'QUIC'));
ok('TCP 80 -> HTTP', () => assert.equal(classify('TCP', 50000, 80), 'HTTP'));
ok('UDP 53 -> DNS', () => assert.equal(classify('UDP', 53, 40000), 'DNS'));
ok('TCP 22 -> SSH', () => assert.equal(classify('TCP', 22, 40000), 'SSH'));
ok('TCP 5000 -> TCP', () => assert.equal(classify('TCP', 5000, 6000), 'TCP'));
ok('UDP 9000 -> UDP', () => assert.equal(classify('UDP', 9000, 9001), 'UDP'));
ok('ICMP/ARP/desconhecido', () => {
  assert.equal(classify('ICMP'), 'ICMP');
  assert.equal(classify('ARP'), 'ARP');
  assert.equal(classify('GRE'), 'OTHER');
});

console.log('direção:');
ok('IPs privados', () => {
  assert.equal(isPrivateIp('192.168.0.1'), true);
  assert.equal(isPrivateIp('10.1.2.3'), true);
  assert.equal(isPrivateIp('172.16.5.5'), true);
  assert.equal(isPrivateIp('172.32.0.1'), false);
  assert.equal(isPrivateIp('8.8.8.8'), false);
});
ok('local->externo = out, externo->local = in', () => {
  const r = new DirectionResolver();
  assert.equal(r.resolve('192.168.0.5', 50000, '8.8.8.8', 443), 'out');
  assert.equal(r.resolve('8.8.8.8', 443, '192.168.0.5', 50000), 'in');
});
ok('fallback por iniciador do fluxo', () => {
  const r = new DirectionResolver();
  assert.equal(r.resolve('1.1.1.1', 40000, '2.2.2.2', 443), 'out'); // iniciou
  assert.equal(r.resolve('2.2.2.2', 443, '1.1.1.1', 40000), 'in');  // respondeu
});

console.log('pcap:');
const pcapBuf = readFileSync(join(root, 'samples', 'sample.pcap'));
const ab = pcapBuf.buffer.slice(pcapBuf.byteOffset, pcapBuf.byteOffset + pcapBuf.byteLength);
ok('magic number reconhecido', () => assert.equal(isPcapBuffer(ab), true));
const packets = parsePcapAuto(ab);
ok(`parse devolve pacotes (${packets.length})`, () => assert.ok(packets.length > 500));
ok('metadados extraídos', () => {
  const p = packets.find((x) => x.l4 === 'TCP' && (x.srcPort === 443 || x.dstPort === 443));
  assert.ok(p, 'esperava pacote TCP 443');
  assert.ok(p.srcIp && p.dstIp);
  assert.ok(p.size > 0);
  assert.ok(p.ts > 1e9);
});
ok('contém ICMP e ARP', () => {
  assert.ok(packets.some((p) => p.l4 === 'ICMP'));
  assert.ok(packets.some((p) => p.l4 === 'ARP'));
});

console.log('datasets:');
const jsonPackets = parseJsonDataset(readFileSync(join(root, 'samples', 'sample-traffic.json'), 'utf8'));
const csvPackets = parseCsvDataset(readFileSync(join(root, 'samples', 'sample-traffic.csv'), 'utf8'));
ok('JSON e CSV batem com o PCAP', () => {
  assert.equal(jsonPackets.length, packets.length);
  assert.equal(csvPackets.length, packets.length);
});

console.log('pipeline:');
const events = normalizeEvents(packets);
ok('normalização preserva eventos e classifica', () => {
  assert.equal(events.length, packets.length);
  assert.ok(events.some((e) => e.cat === 'HTTPS'));
  assert.ok(events.some((e) => e.cat === 'DNS'));
  assert.ok(events.every((e) => e.dir === 'out' || e.dir === 'in'));
});
const agg = aggregate(events, 500);
ok(`agregação em janelas de 500 ms (${agg.windows.length} janelas)`, () => {
  assert.ok(agg.windows.length > 50);
  const total = agg.windows.reduce((s, w) => s + w.totalPackets, 0);
  assert.equal(total, events.length);
});
ok('janelas ordenadas no tempo', () => {
  for (let i = 1; i < agg.windows.length; i++) {
    assert.ok(agg.windows[i].t0 > agg.windows[i - 1].t0);
  }
});
ok('conversão proporcional em veículos (sem caos visual)', () => {
  // Janela artificial com o exemplo da especificação.
  const win = {
    counts: {
      HTTPS: { packets: 800, bytes: 800 * 600, out: 400, in: 400 },
      QUIC: { packets: 300, bytes: 300 * 1200, out: 50, in: 250 },
      DNS: { packets: 80, bytes: 80 * 100, out: 40, in: 40 },
      ICMP: { packets: 10, bytes: 840, out: 5, in: 5 },
    },
    totalPackets: 1190,
  };
  const spawns = vehiclesForWindow(win, { windowMs: 1000, density: 1, maxPerSecond: 100 });
  const byCat = Object.fromEntries(spawns.map((s) => [s.cat, s.n]));
  assert.equal(byCat.HTTPS, 16);
  assert.equal(byCat.QUIC, 6);
  assert.equal(byCat.DNS, 2);
  assert.ok((byCat.ICMP ?? 0) <= 1); // protocolo raro: 0 ou 1 veículo
  const total = spawns.reduce((s, x) => s + x.n, 0);
  assert.ok(total < 30, `esperava bem menos que 1190 veículos, obteve ${total}`);
});
ok('teto global de veículos por segundo é respeitado', () => {
  const win = {
    counts: { HTTPS: { packets: 5000, bytes: 5000 * 500, out: 2500, in: 2500 } },
    totalPackets: 5000,
  };
  const spawns = vehiclesForWindow(win, { windowMs: 500, density: 3, maxPerSecond: 10 });
  const total = spawns.reduce((s, x) => s + x.n, 0);
  assert.ok(total <= 5, `máx 5 por janela de 500 ms com teto de 10/s, obteve ${total}`);
});

console.log(`\n${passed} testes passaram.`);
