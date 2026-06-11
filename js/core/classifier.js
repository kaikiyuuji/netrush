// Classificador de protocolo: recebe o protocolo de transporte (L3/L4)
// e as portas, e devolve uma das categorias de visualização.

function portsInclude(srcPort, dstPort, port) {
  return srcPort === port || dstPort === port;
}

export function classify(l4, srcPort, dstPort) {
  switch (l4) {
    case 'ARP':
      return 'ARP';
    case 'ICMP':
      return 'ICMP';
    case 'TCP':
      if (portsInclude(srcPort, dstPort, 443)) return 'HTTPS';
      if (portsInclude(srcPort, dstPort, 80) || portsInclude(srcPort, dstPort, 8080)) return 'HTTP';
      if (portsInclude(srcPort, dstPort, 53)) return 'DNS';
      if (portsInclude(srcPort, dstPort, 22)) return 'SSH';
      return 'TCP';
    case 'UDP':
      if (portsInclude(srcPort, dstPort, 443)) return 'QUIC';
      if (portsInclude(srcPort, dstPort, 53) || portsInclude(srcPort, dstPort, 5353)) return 'DNS';
      return 'UDP';
    default:
      return 'OTHER';
  }
}
