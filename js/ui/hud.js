// HUD: legenda de veículos, contadores, protocolo dominante,
// gráfico de volume por segundo, alertas e barra de progresso.

import { CATEGORIES, CATEGORY_KEYS } from '../core/categories.js';

const VEHICLE_ICONS = {
  HTTPS: '🏍️', QUIC: '🚌', HTTP: '🚕', DNS: '🚲', SSH: '🚚',
  TCP: '🏎️', UDP: '🚓', ICMP: '🚐', ARP: '🚗', OTHER: '🚙',
};

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
    this.history = []; // últimas janelas: { counts, totalPackets, pps }
    this.totalPackets = 0;
    this.alertTimer = null;
    this.buildLegend();
  }

  buildLegend() {
    const el = document.getElementById('legend-items');
    for (const key of CATEGORY_KEYS) {
      const cat = CATEGORIES[key];
      const row = document.createElement('div');
      row.className = 'legend-row';
      row.innerHTML =
        `<span class="legend-icon">${VEHICLE_ICONS[key]}</span>` +
        `<span class="legend-swatch" style="background:${cat.css}"></span>` +
        `<span class="legend-proto">${cat.label}</span>` +
        `<span class="legend-vehicle">${cat.vehicle}</span>`;
      el.appendChild(row);
    }
  }

  setStatus(text) { this.statusEl.textContent = text; }

  showAlert(text, kind = 'warn') {
    this.alertEl.textContent = text;
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
        `<span style="color:${c.css}">${VEHICLE_ICONS[domKey]} ${c.label}</span>`;
    }
    const pps = Math.round(win.totalPackets * (1000 / windowMs));
    this.statPps.textContent = pps.toLocaleString('pt-BR');

    this.history.push(win);
    if (this.history.length > 90) this.history.shift();
    this.drawChart();
  }

  setVehicleCount(n, congested) {
    this.statVehicles.textContent = congested ? `${n} ⚠ congestionado` : String(n);
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
