// Heurística de direção do tráfego na ponte.
//   'out' = rede local -> internet (esquerda para direita)
//   'in'  = internet -> rede local (direita para esquerda)

export function isPrivateIp(ip) {
  if (!ip) return false;
  if (ip.includes(':')) {
    // IPv6: link-local, unique-local e loopback contam como "lado local".
    const low = ip.toLowerCase();
    return low === '::1' || low.startsWith('fe8') || low.startsWith('fe9') ||
           low.startsWith('fea') || low.startsWith('feb') ||
           low.startsWith('fc') || low.startsWith('fd');
  }
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(Number.isNaN)) return false;
  const [a, b] = parts;
  if (a === 10 || a === 127) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 169 && b === 254) return true;
  return false;
}

function flowKey(srcIp, srcPort, dstIp, dstPort) {
  const a = `${srcIp}:${srcPort ?? 0}`;
  const b = `${dstIp}:${dstPort ?? 0}`;
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

// Rastreia quem iniciou cada fluxo para usar como fallback quando
// os dois IPs são privados (ou os dois são públicos).
export class DirectionResolver {
  constructor() {
    this.initiators = new Map(); // flowKey -> "ip:porta" de quem mandou o 1º pacote
  }

  resolve(srcIp, srcPort, dstIp, dstPort) {
    const srcPriv = isPrivateIp(srcIp);
    const dstPriv = isPrivateIp(dstIp);
    if (srcPriv && !dstPriv) return 'out';
    if (!srcPriv && dstPriv) return 'in';

    // Ambíguo: quem iniciou a conexão é tratado como cliente (lado local).
    const key = flowKey(srcIp, srcPort, dstIp, dstPort);
    const srcId = `${srcIp}:${srcPort ?? 0}`;
    let initiator = this.initiators.get(key);
    if (initiator === undefined) {
      initiator = srcId;
      if (this.initiators.size < 200000) this.initiators.set(key, initiator);
    }
    return srcId === initiator ? 'out' : 'in';
  }
}
