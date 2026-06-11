// Ponto de entrada dos leitores: detecta o formato do arquivo
// (PCAP/PCAPNG pelo magic number, JSON/CSV pelo conteúdo/extensão)
// e devolve a lista de pacotes brutos.

import { isPcapBuffer, parsePcapAuto } from './pcapReader.js';
import { parseJsonDataset, parseCsvDataset } from './datasetReader.js';

export async function parseFile(file) {
  const buffer = await file.arrayBuffer();
  if (isPcapBuffer(buffer)) {
    return parsePcapAuto(buffer);
  }
  const text = new TextDecoder('utf-8', { fatal: false }).decode(buffer);
  const trimmed = text.trimStart();
  const name = (file.name || '').toLowerCase();
  if (trimmed.startsWith('{') || trimmed.startsWith('[') || name.endsWith('.json')) {
    return parseJsonDataset(text);
  }
  if (name.endsWith('.csv') || trimmed.includes(',')) {
    return parseCsvDataset(text);
  }
  throw new Error('Formato de arquivo não reconhecido. Use PCAP, PCAPNG, JSON ou CSV.');
}
