// Leitor de arquivos PCAP (clássico) e PCAPNG.
// Lê o arquivo inteiro de um ArrayBuffer e devolve pacotes brutos:
//   { ts (segundos, float), l4, srcIp, dstIp, srcPort, dstPort, size }

import { parseFrame } from './packetParser.js';

const MAX_PACKETS = 500000;

const PCAP_MAGIC_LE = 0xa1b2c3d4;       // little-endian, microssegundos
const PCAP_MAGIC_BE = 0xd4c3b2a1;
const PCAP_MAGIC_NS_LE = 0xa1b23c4d;    // nanossegundos
const PCAP_MAGIC_NS_BE = 0x4d3cb2a1;
const PCAPNG_SHB = 0x0a0d0d0a;

export function isPcapBuffer(buffer) {
  if (buffer.byteLength < 4) return false;
  const m = new DataView(buffer).getUint32(0, true);
  return m === PCAP_MAGIC_LE || m === PCAP_MAGIC_BE ||
         m === PCAP_MAGIC_NS_LE || m === PCAP_MAGIC_NS_BE ||
         m === PCAPNG_SHB;
}

export function parsePcapAuto(buffer) {
  const dv = new DataView(buffer);
  const magic = dv.getUint32(0, true);
  if (magic === PCAPNG_SHB) return parsePcapNg(buffer);
  return parsePcapClassic(buffer);
}

// ---------------------------------------------------------------- PCAP

export function parsePcapClassic(buffer) {
  const dv = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  if (buffer.byteLength < 24) throw new Error('Arquivo PCAP truncado');

  const magic = dv.getUint32(0, true);
  let little, nanos;
  if (magic === PCAP_MAGIC_LE) { little = true; nanos = false; }
  else if (magic === PCAP_MAGIC_NS_LE) { little = true; nanos = true; }
  else if (magic === PCAP_MAGIC_BE) { little = false; nanos = false; }
  else if (magic === PCAP_MAGIC_NS_BE) { little = false; nanos = true; }
  else throw new Error('Arquivo não reconhecido como PCAP');

  const linktype = dv.getUint32(20, little) & 0x0fffffff;
  const tsDiv = nanos ? 1e9 : 1e6;
  const packets = [];
  let off = 24;

  while (off + 16 <= buffer.byteLength && packets.length < MAX_PACKETS) {
    const tsSec = dv.getUint32(off, little);
    const tsFrac = dv.getUint32(off + 4, little);
    const inclLen = dv.getUint32(off + 8, little);
    const origLen = dv.getUint32(off + 12, little);
    off += 16;
    if (inclLen > 0x0fffffff || off + inclLen > buffer.byteLength) break;

    const frame = bytes.subarray(off, off + inclLen);
    const meta = parseFrame(frame, linktype);
    if (meta) {
      packets.push({
        ts: tsSec + tsFrac / tsDiv,
        l4: meta.l4,
        srcIp: meta.srcIp,
        dstIp: meta.dstIp,
        srcPort: meta.srcPort,
        dstPort: meta.dstPort,
        size: origLen || inclLen,
      });
    }
    off += inclLen;
  }
  return packets;
}

// -------------------------------------------------------------- PCAPNG

const BLOCK_SHB = 0x0a0d0d0a;
const BLOCK_IDB = 0x00000001;
const BLOCK_SPB = 0x00000003;
const BLOCK_EPB = 0x00000006;

function readIdbTsResol(dv, bodyStart, bodyEnd, little) {
  // Opções do IDB começam 8 bytes depois do início do corpo.
  let p = bodyStart + 8;
  let exp = 6; // padrão: microssegundos
  while (p + 4 <= bodyEnd) {
    const code = dv.getUint16(p, little);
    const len = dv.getUint16(p + 2, little);
    p += 4;
    if (code === 0) break; // opt_endofopt
    if (code === 9 && len >= 1) {
      const v = dv.getUint8(p);
      // bit alto 0 => potência de 10; bit alto 1 => potência de 2
      exp = (v & 0x80) ? -1 : (v & 0x7f);
    }
    p += (len + 3) & ~3;
  }
  return exp;
}

export function parsePcapNg(buffer) {
  const dv = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const packets = [];
  let off = 0;
  let little = true;
  let interfaces = []; // { linktype, tsDivisor }
  let syntheticTs = 0;

  while (off + 12 <= buffer.byteLength && packets.length < MAX_PACKETS) {
    const blockType = dv.getUint32(off, little);

    if (blockType === BLOCK_SHB) {
      // Determina a ordem de bytes da seção pelo byte-order magic.
      const bom = dv.getUint32(off + 8, true);
      little = bom === 0x1a2b3c4d;
      interfaces = [];
    }

    const totalLen = dv.getUint32(off + 4, little);
    if (totalLen < 12 || off + totalLen > buffer.byteLength) break;
    const bodyStart = off + 8;
    const bodyEnd = off + totalLen - 4;

    if (blockType === BLOCK_IDB) {
      const linktype = dv.getUint16(bodyStart, little);
      const exp = readIdbTsResol(dv, bodyStart, bodyEnd, little);
      const tsDivisor = exp === -1 ? null : Math.pow(10, exp);
      interfaces.push({ linktype, tsDivisor: tsDivisor ?? 1e6 });
    } else if (blockType === BLOCK_EPB) {
      const ifaceId = dv.getUint32(bodyStart, little);
      const tsHigh = dv.getUint32(bodyStart + 4, little);
      const tsLow = dv.getUint32(bodyStart + 8, little);
      const capLen = dv.getUint32(bodyStart + 12, little);
      const origLen = dv.getUint32(bodyStart + 16, little);
      const iface = interfaces[ifaceId] || { linktype: 1, tsDivisor: 1e6 };
      const tsUnits = tsHigh * 4294967296 + tsLow;
      const ts = tsUnits / iface.tsDivisor;
      const dataStart = bodyStart + 20;
      if (dataStart + capLen <= bodyEnd) {
        const meta = parseFrame(bytes.subarray(dataStart, dataStart + capLen), iface.linktype);
        if (meta) {
          packets.push({
            ts, l4: meta.l4,
            srcIp: meta.srcIp, dstIp: meta.dstIp,
            srcPort: meta.srcPort, dstPort: meta.dstPort,
            size: origLen || capLen,
          });
        }
      }
    } else if (blockType === BLOCK_SPB) {
      // Simple Packet Block não tem timestamp: sintetiza um relógio crescente.
      const origLen = dv.getUint32(bodyStart, little);
      const iface = interfaces[0] || { linktype: 1 };
      const capLen = Math.min(origLen, bodyEnd - (bodyStart + 4));
      const meta = parseFrame(bytes.subarray(bodyStart + 4, bodyStart + 4 + capLen), iface.linktype);
      syntheticTs += 0.001;
      if (meta) {
        packets.push({
          ts: syntheticTs, l4: meta.l4,
          srcIp: meta.srcIp, dstIp: meta.dstIp,
          srcPort: meta.srcPort, dstPort: meta.dstPort,
          size: origLen,
        });
      }
    }

    off += totalLen;
  }
  return packets;
}
