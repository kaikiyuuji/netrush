// Gera arquivos de exemplo em samples/:
//   - sample.pcap          (PCAP clássico, Ethernet/IPv4, só cabeçalhos)
//   - sample-traffic.json  (dataset JSON no formato aceito pelo netRush)
//   - sample-traffic.csv   (mesmo tráfego em CSV)
// Uso: node scripts/generate_samples.mjs

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
mkdirSync(join(root, 'samples'), { recursive: true });

function rint(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
function pick(arr) { return arr[rint(0, arr.length - 1)]; }

const LOCAL = [192, 168, 1, 50];
const SERVERS = [
  [104, 18, 32, 7], [142, 250, 79, 14], [151, 101, 1, 69], [13, 226, 2, 10],
];
const ipStr = (ip) => ip.join('.');

// ------------------------------------------------ tráfego sintético (90 s)

const flows = []; // { ts, l4, src, dst, sport, dport, size }
const t0 = Math.floor(Date.now() / 1000) - 3600;

for (let t = 0; t < 90; t += 0.05) {
  const burst = t > 25 && t < 40 ? 4 : 1; // rajada de download no meio
  if (Math.random() < 0.25 * burst) {
    const srv = pick(SERVERS);
    const up = Math.random() < 0.4;
    flows.push({
      ts: t0 + t, l4: 'TCP',
      src: up ? LOCAL : srv, dst: up ? srv : LOCAL,
      sport: up ? rint(40000, 65000) : 443, dport: up ? 443 : rint(40000, 65000),
      size: up ? rint(80, 400) : rint(800, 1500),
    });
  }
  if (t > 50 && Math.random() < 0.35) { // QUIC na reta final
    const srv = pick(SERVERS);
    flows.push({ ts: t0 + t, l4: 'UDP', src: srv, dst: LOCAL, sport: 443, dport: rint(40000, 65000), size: rint(900, 1400) });
  }
  if (Math.random() < 0.04) {
    flows.push({ ts: t0 + t, l4: 'UDP', src: LOCAL, dst: [8, 8, 8, 8], sport: rint(40000, 65000), dport: 53, size: rint(60, 120) });
    flows.push({ ts: t0 + t + 0.02, l4: 'UDP', src: [8, 8, 8, 8], dst: LOCAL, sport: 53, dport: rint(40000, 65000), size: rint(100, 350) });
  }
  if (Math.random() < 0.015) {
    flows.push({ ts: t0 + t, l4: 'TCP', src: LOCAL, dst: pick(SERVERS), sport: rint(40000, 65000), dport: 80, size: rint(200, 800) });
  }
  if (t > 60 && t < 80 && Math.random() < 0.06) {
    flows.push({ ts: t0 + t, l4: 'TCP', src: LOCAL, dst: [203, 0, 113, 9], sport: rint(40000, 65000), dport: 22, size: rint(90, 250) });
  }
  if (Math.random() < 0.02) {
    flows.push({ ts: t0 + t, l4: 'TCP', src: LOCAL, dst: pick(SERVERS), sport: rint(40000, 65000), dport: rint(3000, 9000), size: rint(100, 900) });
  }
  if (Math.random() < 0.015) {
    flows.push({ ts: t0 + t, l4: 'UDP', src: pick(SERVERS), dst: LOCAL, sport: rint(10000, 30000), dport: rint(10000, 30000), size: rint(80, 500) });
  }
}
for (let t = 2; t < 90; t += 6) {
  flows.push({ ts: t0 + t, l4: 'ICMP', src: LOCAL, dst: [8, 8, 8, 8], size: 84 });
  flows.push({ ts: t0 + t + 0.03, l4: 'ICMP', src: [8, 8, 8, 8], dst: LOCAL, size: 84 });
}
for (let t = 5; t < 90; t += 20) {
  flows.push({ ts: t0 + t, l4: 'ARP', src: LOCAL, dst: [192, 168, 1, 1], size: 42 });
}
flows.sort((a, b) => a.ts - b.ts);

// ------------------------------------------------ montagem do PCAP

function buildFrame(f) {
  if (f.l4 === 'ARP') {
    const buf = Buffer.alloc(42);
    buf.writeUInt16BE(0x0806, 12); // ethertype ARP
    buf.writeUInt16BE(1, 14);      // htype ethernet
    buf.writeUInt16BE(0x0800, 16); // ptype IPv4
    buf[18] = 6; buf[19] = 4;      // hlen, plen
    buf.writeUInt16BE(1, 20);      // request
    Buffer.from(f.src).copy(buf, 28); // SPA
    Buffer.from(f.dst).copy(buf, 38); // TPA
    return buf;
  }
  const l4len = f.l4 === 'TCP' ? 20 : f.l4 === 'UDP' ? 8 : 8;
  const ipLen = 20 + l4len;
  const buf = Buffer.alloc(14 + ipLen);
  buf.writeUInt16BE(0x0800, 12);   // ethertype IPv4
  const ip = 14;
  buf[ip] = 0x45;                  // versão 4, IHL 5
  buf.writeUInt16BE(Math.max(ipLen, f.size - 14), ip + 2);
  buf[ip + 8] = 64;                // TTL
  buf[ip + 9] = f.l4 === 'TCP' ? 6 : f.l4 === 'UDP' ? 17 : 1;
  Buffer.from(f.src).copy(buf, ip + 12);
  Buffer.from(f.dst).copy(buf, ip + 16);
  const l4 = ip + 20;
  if (f.l4 === 'TCP' || f.l4 === 'UDP') {
    buf.writeUInt16BE(f.sport, l4);
    buf.writeUInt16BE(f.dport, l4 + 2);
    if (f.l4 === 'TCP') buf[l4 + 12] = 0x50; // data offset 5
  } else {
    buf[l4] = 8; // ICMP echo request
  }
  return buf;
}

const chunks = [];
const header = Buffer.alloc(24);
header.writeUInt32LE(0xa1b2c3d4, 0); // magic (LE, microssegundos)
header.writeUInt16LE(2, 4);          // major
header.writeUInt16LE(4, 6);          // minor
header.writeUInt32LE(65535, 16);     // snaplen
header.writeUInt32LE(1, 20);         // linktype Ethernet
chunks.push(header);

for (const f of flows) {
  const frame = buildFrame(f);
  const rec = Buffer.alloc(16);
  rec.writeUInt32LE(Math.floor(f.ts), 0);
  rec.writeUInt32LE(Math.round((f.ts % 1) * 1e6), 4);
  rec.writeUInt32LE(frame.length, 8);  // incl_len (capturamos só cabeçalhos)
  rec.writeUInt32LE(f.size, 12);       // orig_len (tamanho real do pacote)
  chunks.push(rec, frame);
}
writeFileSync(join(root, 'samples', 'sample.pcap'), Buffer.concat(chunks));

// ------------------------------------------------ JSON e CSV

const rows = flows.map((f) => ({
  ts: Number(f.ts.toFixed(6)),
  src_ip: ipStr(f.src),
  dst_ip: ipStr(f.dst),
  src_port: f.sport ?? '',
  dst_port: f.dport ?? '',
  protocol: f.l4,
  size: f.size,
}));
writeFileSync(join(root, 'samples', 'sample-traffic.json'), JSON.stringify(rows, null, 1));

const csvHeader = 'ts,src_ip,dst_ip,src_port,dst_port,protocol,size';
const csvLines = rows.map((r) =>
  [r.ts, r.src_ip, r.dst_ip, r.src_port, r.dst_port, r.protocol, r.size].join(',')
);
writeFileSync(join(root, 'samples', 'sample-traffic.csv'), [csvHeader, ...csvLines].join('\n') + '\n');

console.log(`Gerados ${flows.length} pacotes em samples/sample.pcap, sample-traffic.json e sample-traffic.csv`);
