import { Injectable, signal } from '@angular/core';
import { MemoriaCompartidaService } from './memoria-compartida.service';
import { NB, NC, NDMAX, NE, NX, NZ } from './constantes';
import { InfoMalla, MensajeWorker } from '../modelos/mensajes';

@Injectable({ providedIn: 'root' })
export class PoolWorkersService {
  workers: Worker[] = [];
  nw = 4;
  tPool = 0;
  malla = signal<InfoMalla | null>(null);
  textoPool = signal('-');
  textoMensajes = signal('-');
  alMensaje: (d: MensajeWorker) => void = () => {};
  private espera: Record<string, { n: number; r: (d: any) => void }> = {};

  constructor(private mem: MemoriaCompartidaService) {}

  esperar<T>(tipo: string, n = 1): Promise<T> {
    return new Promise<T>(r => {
      this.espera[tipo] = { n, r };
    });
  }

  private recibir(d: MensajeWorker): void {
    if (d.type === 'malla') this.malla.set(d);
    this.alMensaje(d);
    const q = this.espera[d.type];
    if (q && --q.n === 0) {
      delete this.espera[d.type];
      q.r(d);
    }
  }

  async crear(n: number, orden: string): Promise<void> {
    const t0 = performance.now();
    this.workers.forEach(w => w.terminate());
    this.workers = [];
    this.nw = n;
    const p = this.esperar('listo', n);
    for (let i = 0; i < n; i++) {
      const w = new Worker(new URL('../workers/solucionador.worker', import.meta.url), { type: 'module' });
      w.onmessage = e => this.recibir(e.data);
      this.workers.push(w);
      w.postMessage({ type: 'init', id: i, nw: n, cfg: { NX, NZ, NE, NB, NDMAX }, b: this.mem.buf });
    }
    await p;
    this.tPool = performance.now() - t0;
    this.textoPool.set(this.tPool.toFixed(1) + ' ms (' + n + ' Workers)');
    await this.enviarMalla(orden);
  }

  async enviarMalla(orden: string): Promise<void> {
    const p = this.esperar('malla');
    this.enviar({ type: 'malla', orden });
    await p;
  }

  enviar(msg: object): void {
    this.workers.forEach(w => w.postMessage(msg));
  }

  async medirMensajes(): Promise<void> {
    const bytes = 1142 * NC * 8;
    let a = new Float64Array(bytes / 8);
    let t = performance.now();
    let p = this.esperar('eco');
    this.workers[0].postMessage({ type: 'eco', datos: a });
    await p;
    const tCopia = performance.now() - t;
    a = new Float64Array(bytes / 8);
    t = performance.now();
    p = this.esperar('eco');
    this.workers[0].postMessage({ type: 'eco', datos: a, devolver: true }, [a.buffer]);
    await p;
    const tTransf = performance.now() - t;
    t = performance.now();
    p = this.esperar('eco');
    this.workers[0].postMessage({ type: 'eco' });
    await p;
    const tSab = performance.now() - t;
    this.textoMensajes.set(`Jacobiano ${(bytes / 1048576).toFixed(1)} MB: copia ${tCopia.toFixed(1)} ms · transferible ida y vuelta ${tTransf.toFixed(1)} ms · aviso con memoria compartida ${tSab.toFixed(2)} ms`);
  }
}
