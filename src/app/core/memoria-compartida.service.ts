import { Injectable } from '@angular/core';
import { N, NB, NC, NDMAX, NE } from './constantes';
import { Buffers } from '../modelos/mensajes';

@Injectable({ providedIn: 'root' })
export class MemoriaCompartidaService {
  buf!: Buffers;
  ctrl!: Int32Array;
  mPub!: Float64Array;
  m!: Float64Array;
  f!: Float64Array;
  abmn!: Int32Array;
  dobs!: Float64Array;
  w!: Float64Array;
  totalBytes = 0;

  crear(): void {
    const sab = (n: number) => new SharedArrayBuffer(n);
    this.buf = {
      ctrl: sab(64), Kp: sab((N + 1) * 4), Kj: sab(5 * N * 4), Kx: sab(5 * N * 8), Kd: sab(N * 8),
      Lp: sab((N + 1) * 4), Lj: sab(3 * N * 4), Lx: sab(3 * N * 8),
      U: sab(NE * N * 8), itF: sab(NE * 4), motF: sab(NE * 4), resF: sab(NE * 8),
      abmn: sab(4 * NDMAX * 4), dobs: sab(NDMAX * 8), w: sab(NDMAX * 8), f: sab(NDMAX * 8), rw: sab(NDMAX * 8), t: sab(NDMAX * 8),
      J: sab(NDMAX * NC * 8), m: sab(NC * 8), mPrev: sab(NC * 8), mPub: sab(2 * NC * 8),
      x: sab(NC * 8), r: sab(NC * 8), z: sab(NC * 8), p: sab(NC * 8), q: sab(NC * 8), g: sab(NC * 8), d: sab(NC * 8),
      P: sab(2 * NB * 8)
    };
    this.ctrl = new Int32Array(this.buf.ctrl);
    this.mPub = new Float64Array(this.buf.mPub);
    this.m = new Float64Array(this.buf.m);
    this.f = new Float64Array(this.buf.f);
    this.abmn = new Int32Array(this.buf.abmn);
    this.dobs = new Float64Array(this.buf.dobs);
    this.w = new Float64Array(this.buf.w);
    this.totalBytes = Object.values(this.buf).reduce((s: number, b: SharedArrayBuffer) => s + b.byteLength, 0);
  }

  nuevaEpoca(): number {
    return Atomics.add(this.ctrl, 2, 1) + 1;
  }

  cancelar(): void {
    Atomics.add(this.ctrl, 2, 1);
  }

  modeloPublicado(destino: Float64Array): void {
    const p = Atomics.load(this.ctrl, 6);
    destino.set(this.mPub.subarray(p * NC, (p + 1) * NC));
  }
}
