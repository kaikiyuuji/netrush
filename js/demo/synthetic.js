// Gerador de tráfego sintético para o modo demonstração: 2 minutos de
// navegação simulada (HTTPS/QUIC dominantes, DNS pontilhado, rajadas de
// download, um ping periódico e um pico anômalo de UDP no meio).

function rint(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
function pick(arr) { return arr[rint(0, arr.length - 1)]; }

const LOCAL = '192.168.0.42';
const SERVERS = ['104.18.32.7', '142.250.79.14', '151.101.1.69', '13.226.2.10', '185.199.108.153'];

export function generateDemo() {
  const packets = [];
  const t0 = Date.now() / 1000;
  const dur = 120;

  const push = (ts, l4, dstPort, size, fromLocal = Math.random() < 0.45, server = pick(SERVERS)) => {
    packets.push({
      ts: t0 + ts,
      l4,
      srcIp: fromLocal ? LOCAL : server,
      dstIp: fromLocal ? server : LOCAL,
      srcPort: fromLocal ? rint(40000, 65000) : dstPort,
      dstPort: fromLocal ? dstPort : rint(40000, 65000),
      size,
    });
  };

  for (let t = 0; t < dur; t += 0.05) {
    // HTTPS constante com ondas de intensidade (gera comboios de motos).
    const wave = 1 + Math.sin(t / 9) * 0.7;
    const httpsRate = 14 * wave + (t > 30 && t < 50 ? 50 : 0); // rajada de download
    if (Math.random() < httpsRate * 0.05) {
      push(t, 'TCP', 443, t > 30 && t < 50 ? rint(1200, 1500) : rint(80, 1400));
    }
    // QUIC (vídeo) na segunda metade.
    if (t > 55 && Math.random() < 0.55) push(t, 'UDP', 443, rint(900, 1400));
    // DNS pontilhado.
    if (Math.random() < 0.035) {
      push(t, 'UDP', 53, rint(60, 130), true);
      push(t + 0.02, 'UDP', 53, rint(100, 400), false);
    }
    // HTTP legado ocasional.
    if (Math.random() < 0.012) push(t, 'TCP', 80, rint(200, 900));
    // Sessão SSH entre 70 s e 100 s.
    if (t > 70 && t < 100 && Math.random() < 0.08) push(t, 'TCP', 22, rint(90, 300));
    // TCP/UDP genéricos.
    if (Math.random() < 0.02) push(t, 'TCP', rint(3000, 9000), rint(100, 1200));
    if (Math.random() < 0.015) push(t, 'UDP', rint(10000, 30000), rint(80, 600));
    // Outros protocolos raros.
    if (Math.random() < 0.004) push(t, 'OTHER', 0, rint(60, 200));
  }

  // Ping a cada 5 s.
  for (let t = 1; t < dur; t += 5) {
    push(t, 'ICMP', 0, 84, true);
    push(t + 0.04, 'ICMP', 0, 84, false);
  }
  // ARP a cada ~15 s.
  for (let t = 3; t < dur; t += 15) {
    packets.push({ ts: t0 + t, l4: 'ARP', srcIp: LOCAL, dstIp: '192.168.0.1', size: 42 });
    packets.push({ ts: t0 + t + 0.01, l4: 'ARP', srcIp: '192.168.0.1', dstIp: LOCAL, size: 42 });
  }
  // Pico anômalo de UDP (dispara o alerta de tráfego anormal).
  for (let t = 88; t < 91; t += 0.01) {
    if (Math.random() < 0.8) push(t, 'UDP', rint(1024, 65000), rint(60, 1400), false);
  }

  packets.sort((a, b) => a.ts - b.ts);
  return packets;
}
