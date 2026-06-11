// Motor de replay: reproduz as janelas agregadas como se o tráfego
// estivesse acontecendo agora. Mantém um relógio virtual que avança
// com a velocidade escolhida (0.5x a 10x) e emite cada janela quando
// o relógio a alcança.

export class Replay {
  constructor() {
    this.windows = [];
    this.windowMs = 500;
    this.firstTs = 0;
    this.lastTs = 0;
    this.clock = 0;        // segundos no tempo do dataset
    this.cursor = 0;       // próxima janela a emitir
    this.speed = 1;
    this.playing = false;
    this.onWindow = null;  // callback(janela, speed)
    this.onEnd = null;
  }

  load(aggregated) {
    this.windows = aggregated.windows;
    this.windowMs = aggregated.windowMs;
    this.firstTs = aggregated.firstTs;
    this.lastTs = aggregated.lastTs;
    this.reset();
  }

  reset() {
    this.clock = this.firstTs;
    this.cursor = 0;
    this.playing = false;
  }

  play() { if (this.windows.length) this.playing = true; }
  pause() { this.playing = false; }
  setSpeed(s) { this.speed = s; }

  get duration() { return Math.max(0, this.lastTs - this.firstTs); }
  get progress() {
    return this.duration > 0
      ? Math.min(1, (this.clock - this.firstTs) / this.duration)
      : (this.cursor > 0 ? 1 : 0);
  }
  get finished() { return this.windows.length > 0 && this.cursor >= this.windows.length; }

  // dtReal em segundos (tempo real decorrido desde o último frame)
  update(dtReal) {
    if (!this.playing || this.finished) return;
    this.clock += dtReal * this.speed;
    while (this.cursor < this.windows.length && this.windows[this.cursor].t0 <= this.clock) {
      const win = this.windows[this.cursor++];
      if (this.onWindow) this.onWindow(win, this.speed);
    }
    if (this.finished) {
      this.playing = false;
      if (this.onEnd) this.onEnd();
    }
  }
}
