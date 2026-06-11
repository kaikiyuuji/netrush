// Leitor de datasets convertidos (JSON ou CSV) com nomes de colunas flexíveis.
// Aceita, por exemplo, exportações do tshark:
//   tshark -r captura.pcap -T fields -E header=y -E separator=, \
//     -e frame.time_epoch -e ip.src -e ip.dst -e tcp.srcport -e tcp.dstport \
//     -e udp.srcport -e udp.dstport -e _ws.col.protocol -e frame.len > dados.csv

const FIELD_ALIASES = {
  ts: ['ts', 'time', 'timestamp', 'epoch', 'frame.time_epoch', 'frame_time_epoch'],
  srcIp: ['src', 'srcip', 'src_ip', 'source', 'ip.src', 'ip_src', 'saddr', 'source_ip'],
  dstIp: ['dst', 'dstip', 'dst_ip', 'destination', 'ip.dst', 'ip_dst', 'daddr', 'destination_ip'],
  srcPort: ['sport', 'srcport', 'src_port', 'tcp.srcport', 'udp.srcport', 'source_port'],
  dstPort: ['dport', 'dstport', 'dst_port', 'tcp.dstport', 'udp.dstport', 'destination_port'],
  proto: ['proto', 'protocol', 'l4', '_ws.col.protocol', 'ip.proto', 'ip_proto'],
  size: ['size', 'len', 'length', 'bytes', 'frame.len', 'frame_len', 'packet_size'],
};

function buildFieldMap(headerKeys) {
  const map = {};
  const lower = headerKeys.map((k) => k.trim().toLowerCase());
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    for (const alias of aliases) {
      const i = lower.indexOf(alias);
      if (i !== -1) { map[field] = headerKeys[i]; break; }
    }
  }
  return map;
}

const PROTO_NUMBERS = { 1: 'ICMP', 6: 'TCP', 17: 'UDP', 58: 'ICMP' };

function normalizeProto(value) {
  if (value === undefined || value === null || value === '') return 'OTHER';
  const num = Number(value);
  if (Number.isFinite(num) && PROTO_NUMBERS[num]) return PROTO_NUMBERS[num];
  const s = String(value).trim().toUpperCase();
  if (s.startsWith('TCP') || ['HTTP', 'HTTPS', 'TLS', 'SSL', 'SSH', 'TLSV1.2', 'TLSV1.3'].includes(s)) return 'TCP';
  if (s.startsWith('UDP') || ['QUIC', 'DNS', 'MDNS', 'DHCP', 'NTP'].includes(s)) {
    // Mantém a categoria fina via portas; aqui só decide o transporte.
    return s === 'QUIC' || s === 'DNS' || s === 'MDNS' ? 'UDP' : 'UDP';
  }
  if (s.startsWith('ICMP') || s === 'PING') return 'ICMP';
  if (s === 'ARP') return 'ARP';
  return 'OTHER';
}

function toPacket(get) {
  let ts = Number(get('ts'));
  if (!Number.isFinite(ts)) return null;
  if (ts > 1e15) ts /= 1e6;      // microssegundos -> segundos
  else if (ts > 1e12) ts /= 1e3; // milissegundos -> segundos
  const sp = Number(get('srcPort'));
  const dp = Number(get('dstPort'));
  return {
    ts,
    l4: normalizeProto(get('proto')),
    srcIp: get('srcIp') ? String(get('srcIp')).trim() : undefined,
    dstIp: get('dstIp') ? String(get('dstIp')).trim() : undefined,
    srcPort: Number.isFinite(sp) ? sp : undefined,
    dstPort: Number.isFinite(dp) ? dp : undefined,
    size: Number(get('size')) || 64,
  };
}

export function parseJsonDataset(text) {
  let data = JSON.parse(text);
  if (data && !Array.isArray(data)) {
    data = data.packets || data.events || data.data || [];
  }
  if (!Array.isArray(data) || !data.length) return [];
  const map = buildFieldMap(Object.keys(data[0]));
  const packets = [];
  for (const row of data) {
    const p = toPacket((f) => (map[f] !== undefined ? row[map[f]] : undefined));
    if (p) packets.push(p);
  }
  return packets;
}

function splitCsvLine(line) {
  // Divisão simples com suporte a aspas.
  const out = [];
  let cur = '';
  let quoted = false;
  for (const ch of line) {
    if (ch === '"') quoted = !quoted;
    else if (ch === ',' && !quoted) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

export function parseCsvDataset(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length);
  if (lines.length < 2) return [];
  const header = splitCsvLine(lines[0]);
  const map = buildFieldMap(header);
  const colIndex = {};
  for (const [field, name] of Object.entries(map)) colIndex[field] = header.indexOf(name);
  const packets = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    const p = toPacket((f) => (colIndex[f] !== undefined && colIndex[f] !== -1 ? cols[colIndex[f]] : undefined));
    if (p) packets.push(p);
  }
  return packets;
}
