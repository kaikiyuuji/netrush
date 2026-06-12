// netRush — ponto de entrada. Liga leitor -> normalizador -> agregador ->
// replay -> tráfego 3D -> HUD, e conecta os controles da interface.

import { parseFile } from './readers/index.js';
import { normalizeEvents } from './core/normalizer.js';
import { aggregate, vehiclesForWindow } from './core/aggregator.js';
import { Replay } from './core/replay.js';
import { createWorld } from './game/engine.js';
import { TrafficManager } from './game/traffic.js';
import { HUD } from './ui/hud.js';
import { generateDemo } from './demo/synthetic.js';
import { CATEGORY_KEYS } from './core/categories.js';

const world = createWorld(document.getElementById('scene-container'));
const traffic = new TrafficManager(world.scene);
const hud = new HUD();
const replay = new Replay();

const settings = {
  density: 1,
  maxPerSecond: 24,
  cinematic: false,
  windowMs: 500,
};

let rawPackets = null; // pacotes do arquivo atual (para reagregação ao mudar a janela)
let aggregated = null;

function setButtonLabel(btn, iconClass, text) {
  btn.innerHTML = `<i class="fa-solid ${iconClass}"></i> ${text}`;
}

// Detecção de anomalia: média/desvio móveis do total de pacotes por janela.
const anomaly = { values: [], lastAlert: -Infinity };
// Comboios: categorias presentes em N janelas consecutivas.
const streaks = Object.fromEntries(CATEGORY_KEYS.map((k) => [k, 0]));

function detectAnomaly(win) {
  const v = anomaly.values;
  if (v.length >= 12) {
    const mean = v.reduce((s, x) => s + x, 0) / v.length;
    const std = Math.sqrt(v.reduce((s, x) => s + (x - mean) ** 2, 0) / v.length);
    if (win.totalPackets > mean + 3 * std && win.totalPackets > 20 &&
        replay.clock - anomaly.lastAlert > 5) {
      anomaly.lastAlert = replay.clock;
      hud.showAlert('Tráfego anormal detectado: pico fora do padrão!', 'danger', 'fa-triangle-exclamation');
      world.triggerAlert();
    }
  }
  v.push(win.totalPackets);
  if (v.length > 40) v.shift();
}

replay.onWindow = (win, speed) => {
  hud.onWindow(win, settings.windowMs);
  detectAnomaly(win);

  const spawns = vehiclesForWindow(win, {
    windowMs: settings.windowMs,
    density: settings.density,
    maxPerSecond: settings.maxPerSecond,
    cinematic: settings.cinematic,
  });

  // Fluxos constantes (mesma categoria em 4+ janelas seguidas) viram comboios.
  for (const k of CATEGORY_KEYS) {
    streaks[k] = win.counts[k].packets > 0 ? streaks[k] + 1 : 0;
  }
  for (const s of spawns) {
    s.convoy = streaks[s.cat] >= 4 && s.n >= 3;
  }

  traffic.enqueue(spawns, settings.windowMs / 1000 / speed);
};

replay.onEnd = () => {
  hud.setStatus('Replay concluído. Use "Reiniciar" ou carregue outro arquivo.');
  setButtonLabel(btnPlay, 'fa-play', 'Iniciar');
};

// ------------------------------------------------------------ carga

async function loadPackets(packets, label) {
  if (!packets.length) {
    hud.setStatus(`Nenhum pacote reconhecido em ${label}.`);
    return;
  }
  rawPackets = packets;
  rebuild();
  const dur = (aggregated.lastTs - aggregated.firstTs).toFixed(1);
  hud.setStatus(
    `${label}: ${packets.length.toLocaleString('pt-BR')} pacotes, ${dur}s de tráfego. Pronto para reproduzir.`
  );
  btnPlay.disabled = false;
  btnReset.disabled = false;
}

function rebuild() {
  const events = normalizeEvents(rawPackets);
  aggregated = aggregate(events, settings.windowMs);
  replay.load(aggregated);
  traffic.clear();
  hud.reset();
  anomaly.values.length = 0;
  for (const k of CATEGORY_KEYS) streaks[k] = 0;
  setButtonLabel(btnPlay, 'fa-play', 'Iniciar');
}

async function handleFile(file) {
  hud.setStatus(`Lendo ${file.name}…`);
  btnPlay.disabled = true;
  try {
    const packets = await parseFile(file);
    await loadPackets(packets, file.name);
  } catch (err) {
    console.error(err);
    hud.setStatus(`Erro ao ler ${file.name}: ${err.message}`);
  }
}

// ------------------------------------------------------------ controles

const btnPlay = document.getElementById('btn-play');
const btnReset = document.getElementById('btn-reset');
const fileInput = document.getElementById('file-input');

fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) handleFile(fileInput.files[0]);
});

document.getElementById('btn-demo').addEventListener('click', () => {
  loadPackets(generateDemo(), 'Demo sintética');
});

btnPlay.addEventListener('click', () => {
  if (replay.finished) { replay.reset(); traffic.clear(); hud.reset(); }
  if (replay.playing) {
    replay.pause();
    setButtonLabel(btnPlay, 'fa-play', 'Continuar');
    hud.setStatus('Pausado.');
  } else {
    replay.play();
    setButtonLabel(btnPlay, 'fa-pause', 'Pausar');
    hud.setStatus('Reproduzindo tráfego…');
  }
});

btnReset.addEventListener('click', () => {
  replay.reset();
  traffic.clear();
  hud.reset();
  anomaly.values.length = 0;
  setButtonLabel(btnPlay, 'fa-play', 'Iniciar');
  hud.setStatus('Replay reiniciado.');
});

document.getElementById('speed-select').addEventListener('change', (e) => {
  replay.setSpeed(Number(e.target.value));
});

document.getElementById('window-select').addEventListener('change', (e) => {
  settings.windowMs = Number(e.target.value);
  if (rawPackets) { rebuild(); hud.setStatus(`Janela de agregação: ${settings.windowMs} ms.`); }
});

const densityRange = document.getElementById('density-range');
densityRange.addEventListener('input', () => {
  settings.density = Number(densityRange.value);
  document.getElementById('density-value').textContent = `${settings.density.toFixed(1)}x`;
});

const maxvpsRange = document.getElementById('maxvps-range');
maxvpsRange.addEventListener('input', () => {
  settings.maxPerSecond = Number(maxvpsRange.value);
  document.getElementById('maxvps-value').textContent = String(settings.maxPerSecond);
});

document.getElementById('cinematic-toggle').addEventListener('change', (e) => {
  settings.cinematic = e.target.checked;
  world.setCinematic(settings.cinematic);
});

// Arrastar e soltar arquivo.
let dragCount = 0;
window.addEventListener('dragenter', (e) => { e.preventDefault(); if (++dragCount === 1) document.body.classList.add('dragging'); });
window.addEventListener('dragleave', (e) => { e.preventDefault(); if (--dragCount === 0) document.body.classList.remove('dragging'); });
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => {
  e.preventDefault();
  dragCount = 0;
  document.body.classList.remove('dragging');
  if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
});

// ------------------------------------------------------------ loop

let rushHourShown = false;
let last = performance.now();
let elapsed = 0;

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  elapsed += dt;

  replay.update(dt);
  traffic.speedMultiplier = Math.min(2.5, Math.sqrt(replay.speed)); // replays rápidos aceleram um pouco o trânsito
  traffic.update(dt, elapsed);
  world.update(dt, elapsed);

  hud.setVehicleCount(traffic.onBridgeCount, traffic.congested);
  hud.setProgress(replay.progress);

  // Horário de pico: ponte muito ocupada.
  if (traffic.congested && !rushHourShown) {
    rushHourShown = true;
    hud.showAlert('Horário de pico: a ponte está congestionada!', 'warn', 'fa-traffic-light');
  } else if (!traffic.congested && traffic.onBridgeCount < 40) {
    rushHourShown = false;
  }
}
requestAnimationFrame(frame);
