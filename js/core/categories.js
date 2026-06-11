// Categorias de tráfego e seu mapeamento visual (veículo + cor).
// A cor é usada tanto no corpo do veículo 3D quanto na legenda/gráfico do HUD.

export const CATEGORIES = {
  HTTPS: { label: 'HTTPS',        vehicle: 'Motocicleta',    color: 0x2dd4bf, css: '#2dd4bf' },
  QUIC:  { label: 'QUIC',         vehicle: 'Ônibus urbano',  color: 0xa78bfa, css: '#a78bfa' },
  HTTP:  { label: 'HTTP',         vehicle: 'Táxi',           color: 0xfacc15, css: '#facc15' },
  DNS:   { label: 'DNS',          vehicle: 'Bicicleta',      color: 0x84cc16, css: '#84cc16' },
  SSH:   { label: 'SSH',          vehicle: 'Caminhão baú',   color: 0xfb923c, css: '#fb923c' },
  TCP:   { label: 'TCP genérico', vehicle: 'Carro esportivo',color: 0xef4444, css: '#ef4444' },
  UDP:   { label: 'UDP genérico', vehicle: 'Carro de polícia',color: 0x3b82f6, css: '#3b82f6' },
  ICMP:  { label: 'ICMP/ping',    vehicle: 'Van',            color: 0x9ca3af, css: '#9ca3af' },
  ARP:   { label: 'ARP',          vehicle: 'Sedã',           color: 0x38bdf8, css: '#38bdf8' },
  OTHER: { label: 'Outros',       vehicle: 'Carro compacto', color: 0x78716c, css: '#a8a29e' },
};

export const CATEGORY_KEYS = Object.keys(CATEGORIES);
