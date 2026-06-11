// Parser de quadros: extrai apenas metadados seguros (IPs, portas,
// protocolo, tamanho) de um quadro capturado. Nenhum byte de payload
// é retido — somente cabeçalhos são inspecionados.

function u16(b, o) { return (b[o] << 8) | b[o + 1]; }

function ipv4Str(b, o) {
  return `${b[o]}.${b[o + 1]}.${b[o + 2]}.${b[o + 3]}`;
}

function ipv6Str(b, o) {
  const parts = [];
  for (let i = 0; i < 8; i++) parts.push(u16(b, o + i * 2).toString(16));
  return parts.join(':');
}

const ETH_IPV4 = 0x0800;
const ETH_IPV6 = 0x86dd;
const ETH_ARP = 0x0806;
const ETH_VLAN = 0x8100;
const ETH_QINQ = 0x88a8;

// Linktypes do libpcap que sabemos interpretar.
export const LINKTYPE = { NULL: 0, ETHERNET: 1, RAW: 101, LINUX_SLL: 113, LINUX_SLL2: 276 };

function parseIPv4(b, o, len) {
  if (o + 20 > len) return null;
  const ihl = (b[o] & 0x0f) * 4;
  if (ihl < 20 || o + ihl > len) return null;
  const proto = b[o + 9];
  const srcIp = ipv4Str(b, o + 12);
  const dstIp = ipv4Str(b, o + 16);
  return finishL4(b, o + ihl, len, proto, srcIp, dstIp);
}

function parseIPv6(b, o, len) {
  if (o + 40 > len) return null;
  let next = b[o + 6];
  const srcIp = ipv6Str(b, o + 8);
  const dstIp = ipv6Str(b, o + 24);
  let p = o + 40;
  // Pula cabeçalhos de extensão comuns.
  for (let guard = 0; guard < 8; guard++) {
    if (next === 0 || next === 43 || next === 60) {
      if (p + 2 > len) return { l4: 'OTHER', srcIp, dstIp };
      const hdrLen = (b[p + 1] + 1) * 8;
      next = b[p];
      p += hdrLen;
    } else if (next === 44) { // fragmento
      if (p + 8 > len) return { l4: 'OTHER', srcIp, dstIp };
      next = b[p];
      p += 8;
    } else {
      break;
    }
  }
  return finishL4(b, p, len, next, srcIp, dstIp);
}

function finishL4(b, o, len, proto, srcIp, dstIp) {
  if (proto === 6 || proto === 17) {
    const l4 = proto === 6 ? 'TCP' : 'UDP';
    if (o + 4 > len) return { l4, srcIp, dstIp };
    return { l4, srcIp, dstIp, srcPort: u16(b, o), dstPort: u16(b, o + 2) };
  }
  if (proto === 1 || proto === 58) return { l4: 'ICMP', srcIp, dstIp };
  return { l4: 'OTHER', srcIp, dstIp };
}

function parseArp(b, o, len) {
  if (o + 28 > len) return { l4: 'ARP' };
  const hlen = b[o + 4];
  const plen = b[o + 5];
  if (plen !== 4) return { l4: 'ARP' };
  const spa = o + 8 + hlen;
  const tpa = spa + plen + hlen;
  if (tpa + plen > len) return { l4: 'ARP' };
  return { l4: 'ARP', srcIp: ipv4Str(b, spa), dstIp: ipv4Str(b, tpa) };
}

function parseByEthertype(b, o, len, ethertype) {
  // Atravessa tags VLAN, se houver.
  for (let guard = 0; guard < 4 && (ethertype === ETH_VLAN || ethertype === ETH_QINQ); guard++) {
    if (o + 4 > len) return null;
    ethertype = u16(b, o + 2);
    o += 4;
  }
  if (ethertype === ETH_IPV4) return parseIPv4(b, o, len);
  if (ethertype === ETH_IPV6) return parseIPv6(b, o, len);
  if (ethertype === ETH_ARP) return parseArp(b, o, len);
  return { l4: 'OTHER' };
}

// b: Uint8Array com o quadro; devolve {l4, srcIp?, dstIp?, srcPort?, dstPort?} ou null.
export function parseFrame(b, linktype) {
  const len = b.length;
  try {
    switch (linktype) {
      case LINKTYPE.ETHERNET: {
        if (len < 14) return null;
        return parseByEthertype(b, 14, len, u16(b, 12));
      }
      case LINKTYPE.LINUX_SLL: {
        if (len < 16) return null;
        return parseByEthertype(b, 16, len, u16(b, 14));
      }
      case LINKTYPE.LINUX_SLL2: {
        if (len < 20) return null;
        return parseByEthertype(b, 20, len, u16(b, 0));
      }
      case LINKTYPE.NULL: {
        if (len < 4) return null;
        const family = b[0] || b[3]; // host order, qualquer endianness
        if (family === 2) return parseIPv4(b, 4, len);
        return parseIPv6(b, 4, len);
      }
      case LINKTYPE.RAW: {
        const version = b[0] >> 4;
        if (version === 4) return parseIPv4(b, 0, len);
        if (version === 6) return parseIPv6(b, 0, len);
        return { l4: 'OTHER' };
      }
      default:
        return { l4: 'OTHER' };
    }
  } catch {
    return { l4: 'OTHER' };
  }
}
