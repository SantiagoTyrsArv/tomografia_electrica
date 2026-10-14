import { Injectable, signal } from '@angular/core';

interface Evento extends PerformanceEventTiming {
  interactionId: number;
}

@Injectable({ providedIn: 'root' })
export class RendimientoService {
  inp = signal('sin interacciones aún');
  inpOk = signal(true);
  desglose = signal('');
  largas = signal('0');
  iteracion = signal('-');
  private interacciones = new Map<number, Evento>();
  private nLargas = 0;
  private msLargas = 0;
  private maxLarga = 0;

  iniciar(): void {
    try {
      new PerformanceObserver(l => {
        for (const e of l.getEntries() as Evento[]) {
          if (!e.interactionId) continue;
          const p = this.interacciones.get(e.interactionId);
          if (!p || e.duration > p.duration) this.interacciones.set(e.interactionId, e);
        }
        this.mostrarINP();
      }).observe({ type: 'event', buffered: true, durationThreshold: 16 } as PerformanceObserverInit);
    } catch {
      this.inp.set('No disponible en este navegador');
    }
    try {
      new PerformanceObserver(l => {
        for (const e of l.getEntries()) {
          this.nLargas++;
          this.msLargas += e.duration;
          this.maxLarga = Math.max(this.maxLarga, e.duration);
        }
        this.largas.set(`${this.nLargas} tareas largas · ${this.msLargas.toFixed(0)} ms en total · máx ${this.maxLarga.toFixed(0)} ms`);
      }).observe({ type: 'longtask', buffered: true });
    } catch {
      this.largas.set('No disponible en este navegador');
    }
    new PerformanceObserver(l => {
      for (const e of l.getEntries()) if (e.name.startsWith('gn-')) this.iteracion.set(`iteración ${e.name.slice(3)}: ${e.duration.toFixed(0)} ms`);
    }).observe({ type: 'measure', buffered: true });
  }

  medirIteracion(it: number, dt: number): void {
    const fin = performance.now();
    performance.measure('gn-' + it, { start: fin - dt, end: fin });
  }

  private mostrarINP(): void {
    const arr = [...this.interacciones.values()].sort((a, b) => b.duration - a.duration);
    if (!arr.length) return;
    const e = arr[Math.min(arr.length - 1, Math.floor(arr.length / 50))];
    const ent = e.processingStart - e.startTime;
    const proc = e.processingEnd - e.processingStart;
    const pres = e.startTime + e.duration - e.processingEnd;
    this.inpOk.set(e.duration <= 200);
    this.inp.set(`${e.duration} ms (${e.name}, ${arr.length} interacciones)`);
    this.desglose.set(`retraso de entrada ${ent.toFixed(1)} · procesamiento ${proc.toFixed(1)} · presentación ${pres.toFixed(1)} ms`);
  }
}
