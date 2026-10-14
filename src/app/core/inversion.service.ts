import { Injectable, signal } from '@angular/core';
import { MemoriaCompartidaService } from './memoria-compartida.service';
import { PoolWorkersService } from './pool-workers.service';
import { RendimientoService } from './rendimiento.service';
import { CX, CZ, N, NC, NDMAX, NE, VERSION } from './constantes';
import { Medicion, Umbrales } from '../modelos/medicion';
import { Banco, FilaBanco, Fin, Iteracion, MensajeWorker } from '../modelos/mensajes';
import { FilaRepro, PuntoCurva, Resultado } from '../modelos/resultado';
import { parsear } from '../utilidades/parser-dat';
import { depurar, resumir } from '../utilidades/depuracion';
import { sugerir } from '../utilidades/curvatura';
import { descargar, huella } from '../utilidades/exportar';

interface Opciones {
  lambda: number;
  prec: string;
  tibio: boolean;
  maxIt: number;
}

@Injectable({ providedIn: 'root' })
export class InversionService {
  medidas = signal<Medicion[]>([]);
  resumen = signal('');
  umbrales = signal<Umbrales>({ desv: 5, ruido: 0.05, vecinas: 2.5 });
  lambdaLog = signal(2);
  prec = signal('ic');
  orden = signal('x');
  nwSel = signal(4);
  estado = signal('Iniciando…');
  version = signal(0);
  log = signal<Iteracion[]>([]);
  ultimo = signal<Resultado | null>(null);
  puntos = signal<PuntoCurva[]>([]);
  sugerido = signal<PuntoCurva | null>(null);
  banco = signal<FilaBanco[]>([]);
  repro = signal<FilaRepro[]>([]);
  textoReproEstado = signal('');
  textoCancel = signal('-');
  textoAhorro = signal('-');
  textoInterno = signal('-');
  textoMemoria = signal('-');
  urlDescarga = signal<string | null>(null);
  coi = signal(false);

  modelo = new Float64Array(NC);
  hayModelo = false;
  private corriendo = false;
  private pendiente = false;
  private ocupado = false;
  private datosCargados = false;
  private curvaOn = false;
  private tCancel = 0;

  constructor(private mem: MemoriaCompartidaService, private pool: PoolWorkersService, private rend: RendimientoService) {
    this.pool.alMensaje = d => this.recibir(d);
  }

  lambda(): number {
    return 10 ** this.lambdaLog();
  }

  async arrancar(): Promise<void> {
    this.rend.iniciar();
    this.coi.set(crossOriginIsolated);
    if (!crossOriginIsolated) {
      this.estado.set('El servidor no envía COOP/COEP: SharedArrayBuffer no está disponible');
      return;
    }
    this.mem.crear();
    this.textoMemoria.set((this.mem.totalBytes / 1048576).toFixed(1) + ' MB en SharedArrayBuffer');
    await this.pool.crear(this.nwSel(), this.orden());
    await this.pool.medirMensajes();
    this.estado.set('Listo. Cargue medidas.dat o genere datos de prueba.');
  }

  private recibir(d: MensajeWorker): void {
    if (d.type === 'iter') {
      this.mem.modeloPublicado(this.modelo);
      this.hayModelo = true;
      this.version.update(v => v + 1);
      this.rend.medirIteracion(d.it, d.dt);
      this.log.update(l => [...l, d]);
    }
    if (d.type === 'fin') this.corriendo = false;
  }

  private ceder(): Promise<void> {
    return new Promise(r => setTimeout(r, 0));
  }

  private escribirDatos(): number {
    const act = this.medidas().filter(m => m.activa).slice(0, NDMAX);
    act.forEach((m, i) => {
      this.mem.abmn[4 * i] = m.A;
      this.mem.abmn[4 * i + 1] = m.B;
      this.mem.abmn[4 * i + 2] = m.M;
      this.mem.abmn[4 * i + 3] = m.N;
      const d = m.V / m.I;
      this.mem.dobs[i] = d;
      this.mem.w[i] = 1 / (Math.max(m.desv, 0.003) * Math.abs(d) + 1e-9);
    });
    Atomics.store(this.mem.ctrl, 5, act.length);
    return act.length;
  }

  private async lanzar(o: Opciones): Promise<Fin> {
    this.corriendo = true;
    this.escribirDatos();
    this.estado.set('Invirtiendo con λ = ' + o.lambda.toPrecision(3) + '…');
    this.log.set([]);
    const ep = this.mem.nuevaEpoca();
    const pr = this.pool.esperar<Fin>('fin');
    this.pool.enviar({ type: 'correr', epoca: ep, lambda: o.lambda, prec: o.prec, tibio: o.tibio, maxIt: o.maxIt });
    const d = await pr;
    this.corriendo = false;
    if (d.cancelado) {
      this.estado.set('Cálculo cancelado en un punto seguro');
    } else {
      this.ultimo.set({ ...d, workers: this.pool.nw, orden: this.orden(), hash: huella(this.modelo) });
      this.estado.set(`Listo: ${d.it} iteraciones · χ² ${d.chi2.toFixed(3)} · ${d.motivo} · ${(d.ms / 1000).toFixed(1)} s`);
      this.textoAhorro.set((d.ahorro / 1048576).toFixed(1) + ' MB que no se copiaron entre hilos');
      this.textoInterno.set(d.interno + ' iteraciones internas de GC (sistema normal), ' + d.directoTotal + ' en problemas directos');
    }
    return d;
  }

  pedir(): void {
    if (!this.datosCargados || this.ocupado) return;
    this.pendiente = true;
    if (this.corriendo) {
      if (!this.tCancel) this.tCancel = performance.now();
      this.mem.cancelar();
    } else this.ciclo();
  }

  private async ciclo(): Promise<void> {
    while (this.pendiente) {
      this.pendiente = false;
      const d = await this.lanzar({ lambda: this.lambda(), prec: this.prec(), tibio: this.hayModelo, maxIt: 12 });
      if (d.cancelado && this.tCancel) {
        this.textoCancel.set((performance.now() - this.tCancel).toFixed(1) + ' ms (crear el pool cuesta ' + this.pool.tPool.toFixed(1) + ' ms)');
        this.tCancel = 0;
      }
    }
  }

  async detener(): Promise<void> {
    this.pendiente = false;
    this.curvaOn = false;
    if (this.corriendo) {
      this.mem.cancelar();
      while (this.corriendo) await this.ceder();
    }
  }

  async cargarTexto(txt: string): Promise<void> {
    await this.detener();
    const lista = parsear(txt);
    if (!lista.length) {
      this.estado.set('El archivo no tiene mediciones válidas');
      return;
    }
    depurar(lista, this.umbrales());
    this.medidas.set(lista);
    this.resumen.set(resumir(lista));
    this.datosCargados = true;
    this.hayModelo = false;
    this.pedir();
  }

  redepurar(): void {
    const lista = this.medidas();
    if (!lista.length) return;
    depurar(lista, this.umbrales());
    this.medidas.set([...lista]);
    this.resumen.set(resumir(lista));
    this.pedir();
  }

  cambiarMedicion(i: number, valor: boolean): void {
    const m = this.medidas()[i];
    m.manual = valor;
    m.activa = valor;
    this.resumen.set(resumir(this.medidas()));
    this.pedir();
  }

  async generar(): Promise<void> {
    await this.detener();
    this.ocupado = true;
    const lista: number[][] = [];
    for (let a = 1; a <= 5; a++) for (let n = 1; n <= 8; n++) for (let k = 0; k + (n + 2) * a <= NE - 1; k++) lista.push([k, k + a, k + a + n * a, k + 2 * a + n * a]);
    lista.forEach((l, i) => this.mem.abmn.set(l, 4 * i));
    Atomics.store(this.mem.ctrl, 5, lista.length);
    for (let j = 0; j < CZ; j++) {
      for (let i = 0; i < CX; i++) {
        const x = i + 0.5, z = j + 0.5;
        let r = 100;
        if (Math.hypot(x - 50, z - 3) < 2.5) r = 12;
        if (Math.hypot(x - 22, z - 7) < 4) r = 350;
        this.mem.m[j * CX + i] = Math.log(r);
      }
    }
    const p = this.pool.esperar('sintetico');
    this.pool.enviar({ type: 'sintetico', epoca: this.mem.nuevaEpoca() });
    await p;
    let s = 20261013;
    const rnd = () => {
      s = (s * 16807) % 2147483647;
      return s / 2147483647;
    };
    const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
    let txt = '# 48 electrodos, espaciamiento 2.0 m, arreglo dipolo-dipolo\n# A B M N I(mA) V(mV) rep desv\n';
    lista.forEach((l, i) => {
      const I = 102.4 + (rnd() - 0.5) * 0.4;
      let desv = 0.003 + rnd() * 0.012;
      if (rnd() < 0.05) desv = 0.05 + rnd() * 0.1;
      let R = this.mem.f[i] * (1 + gauss() * desv);
      if (rnd() < 0.01) R = -R * 0.3;
      if (rnd() < 0.01) R = R * 1e-4;
      txt += `${l[0] + 1} ${l[1] + 1} ${l[2] + 1} ${l[3] + 1} ${I.toFixed(1)} ${(R * I).toFixed(4)} 4 ${(desv * 100).toFixed(1)}%\n`;
    });
    this.ocupado = false;
    this.urlDescarga.set(URL.createObjectURL(new Blob([txt], { type: 'text/plain' })));
    await this.cargarTexto(txt);
  }

  async cambiarOrden(orden: string): Promise<void> {
    this.orden.set(orden);
    await this.detener();
    this.ocupado = true;
    await this.pool.enviarMalla(orden);
    this.ocupado = false;
    this.pedir();
  }

  async cambiarWorkers(n: number): Promise<void> {
    this.nwSel.set(n);
    await this.detener();
    this.ocupado = true;
    await this.pool.crear(n, this.orden());
    this.ocupado = false;
    this.pedir();
  }

  async comparar(): Promise<void> {
    await this.detener();
    this.ocupado = true;
    this.banco.set([]);
    const p = this.pool.esperar<Banco>('banco');
    this.pool.enviar({ type: 'banco', epoca: this.mem.nuevaEpoca() });
    const d = await p;
    this.ocupado = false;
    if (d.out) this.banco.set(d.out);
  }

  async reproducir(): Promise<void> {
    if (!this.datosCargados) return;
    await this.detener();
    this.ocupado = true;
    const original = this.pool.nw;
    const filas: FilaRepro[] = [];
    const copias: Float64Array[] = [];
    this.repro.set([]);
    for (const n of [2, 4, 8]) {
      this.textoReproEstado.set(`Corriendo con ${n} Workers…`);
      await this.pool.crear(n, this.orden());
      const d = await this.lanzar({ lambda: this.lambda(), prec: this.prec(), tibio: false, maxIt: 8 });
      copias.push(this.modelo.slice());
      let dif = 0;
      for (let i = 0; i < NC; i++) dif = Math.max(dif, Math.abs(this.modelo[i] - copias[0][i]));
      filas.push({ workers: n, hash: huella(this.modelo), phi: d.phi.toPrecision(17), dif, segundos: (d.ms / 1000).toFixed(1) + ' s' });
      this.repro.set([...filas]);
      await this.ceder();
    }
    this.textoReproEstado.set('');
    await this.pool.crear(original, this.orden());
    this.ocupado = false;
  }

  async curva(): Promise<void> {
    if (!this.datosCargados) return;
    await this.detener();
    this.ocupado = true;
    this.curvaOn = true;
    this.puntos.set([]);
    this.sugerido.set(null);
    const lams = [10000, 3000, 1000, 300, 100, 30, 10, 3, 1];
    let tibio = false;
    for (const l of lams) {
      if (!this.curvaOn) break;
      const d = await this.lanzar({ lambda: l, prec: this.prec(), tibio, maxIt: 6 });
      if (d.cancelado) break;
      tibio = true;
      this.puntos.update(p => [...p, { l, phi: d.phi, rug: d.rug + 1e-9, it: d.it }]);
      this.sugerido.set(sugerir(this.puntos()));
      await this.ceder();
    }
    this.curvaOn = false;
    this.ocupado = false;
  }

  usarSugerido(): void {
    const s = this.sugerido();
    if (!s) return;
    this.lambdaLog.set(Math.log10(s.l));
    this.pedir();
  }

  exportar(): void {
    const u = this.ultimo();
    if (!u) return;
    const r = {
      version: VERSION,
      fecha: new Date().toISOString(),
      malla: { columnas: CX, filas: CZ, dx_m: 1, dz_m: 1, nodos: N, electrodos: NE, espaciamiento_m: 2, orden_nodos: u.orden },
      lambda: u.lambda,
      precondicionador: u.prec,
      criterio_parada: {
        directo: 'residual relativo < 1e-8, o sin mejorar 5% en 60 iteraciones (estancamiento), tope 3000',
        normal: 'sqrt(r·z / r0·z0) < 1e-3, tope 80',
        externo: 'chi² ≤ 1, o mejora < 1%, o el ajuste empeora, tope de iteraciones'
      },
      resultado: { iteraciones: u.it, phi: u.phi, chi2: u.chi2, rugosidad: u.rug, motivo: u.motivo, iteraciones_internas: u.interno, iteraciones_directo: u.directoTotal, workers: u.workers, huella_modelo: u.hash },
      umbrales: this.umbrales(),
      medidas: this.medidas().map(m => ({ A: m.A + 1, B: m.B + 1, M: m.M + 1, N: m.N + 1, I: m.I, V: m.V, rep: m.rep, desv: m.desv, rhoa: m.rhoa, activa: m.activa, manual: m.manual, motivos: m.motivos })),
      resistividad: Array.from(this.modelo, v => Math.exp(v))
    };
    descargar('inversion-' + u.hash + '.json', JSON.stringify(r, null, 1), 'application/json');
  }
}
