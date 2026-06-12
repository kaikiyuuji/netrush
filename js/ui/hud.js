// HUD: legenda de veículos, contadores, protocolo dominante,
// gráfico de volume por segundo, alertas e barra de progresso.

import { CATEGORIES, CATEGORY_KEYS } from '../core/categories.js';

// Ícones Font Awesome 6 (free/solid) por categoria.
const VEHICLE_ICONS = {
  HTTPS: 'fa-motorcycle', QUIC: 'fa-bus', HTTP: 'fa-taxi', DNS: 'fa-bicycle',
  SSH: 'fa-truck-moving', TCP: 'fa-car-side', UDP: 'fa-car-on',
  ICMP: 'fa-van-shuttle', ARP: 'fa-car-rear', OTHER: 'fa-car',
};

function icon(key) {
  return `<i class="fa-solid ${VEHICLE_ICONS[key]}"></i>`;
}

function formatBytes(n) {
  if (!Number.isFinite(n)) return '—';
  if (n < 1024) return `${Math.round(n)} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

const FEED_MAX_ROWS = 40;

export class HUD {
  constructor() {
    this.statPackets = document.getElementById('stat-packets');
    this.statDominant = document.getElementById('stat-dominant');
    this.statPps = document.getElementById('stat-pps');
    this.statVehicles = document.getElementById('stat-vehicles');
    this.statusEl = document.getElementById('status');
    this.alertEl = document.getElementById('alert-banner');
    this.progressEl = document.getElementById('progress-fill');
    this.chartCanvas = document.getElementById('chart');
    this.chartCtx = this.chartCanvas.getContext('2d');
    this.feedEl = document.getElementById('feed-items');
    this.history = []; // últimas janelas: { counts, totalPackets, pps }
    this.totalPackets = 0;
    this.alertTimer = null;
    this.onSpawnRequest = null; // callback(categoria) dos botões de geração
    this.buildLegend();
    this.buildSpawner();
  }

  buildLegend() {
    const el = document.getElementById('legend-items');
    for (const key of CATEGORY_KEYS) {
      const cat = CATEGORIES[key];
      const row = document.createElement('div');
      row.className = 'legend-row';
      row.innerHTML =
        `<span class="legend-icon" style="color:${cat.css}">${icon(key)}</span>` +
        `<span class="legend-proto">${cat.label}</span>` +
        `<span class="legend-vehicle">${cat.vehicle}</span>`;
      el.appendChild(row);
    }
  }

  // Painel lateral: um botão por tipo de requisição que gera um veículo
  // daquele tipo na ponte.
  buildSpawner() {
    const el = document.getElementById('spawner-items');
    for (const key of CATEGORY_KEYS) {
      const cat = CATEGORIES[key];
      const btn = document.createElement('button');
      btn.className = 'spawn-btn';
      btn.style.setProperty('--cat-color', cat.css);
      btn.title = `Gerar 1 ${cat.vehicle.toLowerCase()} (${cat.label})`;
      btn.innerHTML =
        `<span class="legend-icon" style="color:${cat.css}">${icon(key)}</span>` +
        `<span>${cat.label}</span>`;
      btn.addEventListener('click', () => {
        if (this.onSpawnRequest) this.onSpawnRequest(key);
      });
      el.appendChild(btn);
    }
  }

  // Feed do tráfego passando: nome (categoria), tamanho e direção de cada
  // requisição amostrada na janela. Itens novos entram no topo.
  addFeedEntries(entries) {
    if (!entries.length) return;
    const frag = document.createDocumentFragment();
    for (const e of entries) {
      const cat = CATEGORIES[e.cat];
      if (!cat) continue;
      const row = document.createElement('div');
      row.className = 'feed-row';
      const dirIcon = e.manual
        ? '<i class="fa-solid fa-hand-pointer feed-dir manual"></i>'
        : e.dir === 'out'
          ? '<i class="fa-solid fa-arrow-right feed-dir out"></i>'
          : '<i class="fa-solid fa-arrow-left feed-dir in"></i>';
      row.innerHTML =
        `<span class="legend-icon" style="color:${cat.css}">${icon(e.cat)}</span>` +
        `<span class="feed-name">${cat.label}</span>` +
        dirIcon +
        `<span class="feed-size">${e.manual ? 'manual' : formatBytes(e.size)}</span>`;
      frag.prepend(row);
    }
    this.feedEl.prepend(frag);
    while (this.feedEl.childElementCount > FEED_MAX_ROWS) {
      this.feedEl.lastElementChild.remove();
    }
  }

  setStatus(text) { this.statusEl.textContent = text; }

  showAlert(text, kind = 'warn', iconClass = 'fa-triangle-exclamation') {
    this.alertEl.innerHTML = `<i class="fa-solid ${iconClass}"></i> ${text}`;
    this.alertEl.className = `alert show ${kind}`;
    clearTimeout(this.alertTimer);
    this.alertTimer = setTimeout(() => { this.alertEl.className = 'alert'; }, 4000);
  }

  reset() {
    this.history = [];
    this.totalPackets = 0;
    this.statPackets.textContent = '0';
    this.statDominant.textContent = '—';
    this.statPps.textContent = '0';
    this.progressEl.style.width = '0%';
    this.feedEl.replaceChildren();
    this.drawChart();
  }

  onWindow(win, windowMs) {
    this.totalPackets += win.totalPackets;
    this.statPackets.textContent = this.totalPackets.toLocaleString('pt-BR');

    let domKey = null;
    let domCount = 0;
    for (const k of CATEGORY_KEYS) {
      if (win.counts[k].packets > domCount) { domCount = win.counts[k].packets; domKey = k; }
    }
    if (domKey) {
      const c = CATEGORIES[domKey];
      this.statDominant.innerHTML =
        `<span style="color:${c.css}">${icon(domKey)} ${c.label}</span>`;
    }
    const pps = Math.round(win.totalPackets * (1000 / windowMs));
    this.statPps.textContent = pps.toLocaleString('pt-BR');

    this.history.push(win);
    if (this.history.length > 90) this.history.shift();
    this.drawChart();
  }

  setVehicleCount(n, congested) {
    this.statVehicles.innerHTML = congested
      ? `${n} <i class="fa-solid fa-traffic-light"></i> congestionado`
      : String(n);
    this.statVehicles.style.color = congested ? '#fbbf24' : '';
  }

  setProgress(p) { this.progressEl.style.width = `${(p * 100).toFixed(1)}%`; }

  // Gráfico de barras empilhadas: volume por janela, colorido por categoria.
  drawChart() {
    const ctx = this.chartCtx;
    const W = this.chartCanvas.width;
    const H = this.chartCanvas.height;
    ctx.clearRect(0, 0, W, H);
    if (!this.history.length) return;
    const max = Math.max(...this.history.map((w) => w.totalPackets), 1);
    const barW = W / 90;
    for (let i = 0; i < this.history.length; i++) {
      const win = this.history[i];
      const x = W - (this.history.length - i) * barW;
      let y = H;
      for (const k of CATEGORY_KEYS) {
        const pk = win.counts[k].packets;
        if (!pk) continue;
        const h = (pk / max) * (H - 4);
        ctx.fillStyle = CATEGORIES[k].css;
        ctx.fillRect(x, y - h, Math.max(1, barW - 1), h);
        y -= h;
      }
    }
  }
}
