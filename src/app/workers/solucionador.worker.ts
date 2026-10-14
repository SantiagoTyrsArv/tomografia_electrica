/// <reference lib="webworker" />

import { Buffers, Configuracion, Trabajo } from '../modelos/mensajes';

const BC = 0.1;

let id = 0;
let nw = 1;
let NX = 0, NZ = 0, CX = 0, CZ = 0, N = 0, NC = 0, NE = 0, NB = 0;
let ctrl!: Int32Array;
let Kp!: Int32Array, Kj!: Int32Array, Kx!: Float64Array, Kd!: Float64Array;
let Lp!: Int32Array, Lj!: Int32Array, Lx!: Float64Array;
let U!: Float64Array, itF!: Int32Array, motF!: Int32Array, resF!: Float64Array;
let abmn!: Int32Array, dobs!: Float64Array, w!: Float64Array, f!: Float64Array, rw!: Float64Array, gt!: Float64Array;
let J!: Float64Array, m!: Float64Array, mPrev!: Float64Array, mPub!: Float64Array;
let gx!: Float64Array, gr!: Float64Array, gz!: Float64Array, gp!: Float64Array, gq!: Float64Array, gb!: Float64Array, gd!: Float64Array, P!: Float64Array;
let celdaNodos!: Int32Array, celdaBorde!: Uint8Array, elec!: Int32Array;
let cPtr!: Int32Array, cIdx!: Int32Array, cCoef!: Float64Array, lowK!: Int32Array, kdiag!: Int32Array;
let rr!: Float64Array, zz!: Float64Array, pp!: Float64Array, qq!: Float64Array;
let epoca = 0, cuentaRed = 0, ahorro = 0;

function iniciar(nuevoId: number, total: number, cfg: Configuracion, b: Buffers): void {
  id = nuevoId;
  nw = total;
  NX = cfg.NX;
  NZ = cfg.NZ;
  NE = cfg.NE;
  NB = cfg.NB;
  CX = NX - 1;
  CZ = NZ - 1;
  N = NX * NZ;
  NC = CX * CZ;
  ctrl = new Int32Array(b.ctrl);
  Kp = new Int32Array(b.Kp);
  Kj = new Int32Array(b.Kj);
  Kx = new Float64Array(b.Kx);
  Kd = new Float64Array(b.Kd);
  Lp = new Int32Array(b.Lp);
  Lj = new Int32Array(b.Lj);
  Lx = new Float64Array(b.Lx);
  U = new Float64Array(b.U);
  itF = new Int32Array(b.itF);
  motF = new Int32Array(b.motF);
  resF = new Float64Array(b.resF);
  abmn = new Int32Array(b.abmn);
  dobs = new Float64Array(b.dobs);
  w = new Float64Array(b.w);
  f = new Float64Array(b.f);
  rw = new Float64Array(b.rw);
  gt = new Float64Array(b.t);
  J = new Float64Array(b.J);
  m = new Float64Array(b.m);
  mPrev = new Float64Array(b.mPrev);
  mPub = new Float64Array(b.mPub);
  gx = new Float64Array(b.x);
  gr = new Float64Array(b.r);
  gz = new Float64Array(b.z);
  gp = new Float64Array(b.p);
  gq = new Float64Array(b.q);
  gb = new Float64Array(b.g);
  gd = new Float64Array(b.d);
  P = new Float64Array(b.P);
  rr = new Float64Array(N);
  zz = new Float64Array(N);
  pp = new Float64Array(N);
  qq = new Float64Array(N);
  postMessage({ type: 'listo', id });
}

function malla(orden: string): void {
  const nodo = orden === 'x' ? (ix: number, iz: number) => iz * NX + ix : (ix: number, iz: number) => ix * NZ + iz;
  celdaNodos = new Int32Array(4 * NC);
  celdaBorde = new Uint8Array(NC);
  for (let j = 0; j < CZ; j++) {
    for (let i = 0; i < CX; i++) {
      const c = j * CX + i;
      celdaNodos[4 * c] = nodo(i, j);
      celdaNodos[4 * c + 1] = nodo(i + 1, j);
      celdaNodos[4 * c + 2] = nodo(i, j + 1);
      celdaNodos[4 * c + 3] = nodo(i + 1, j + 1);
      let bb = 0;
      if (i === 0) bb |= 1;
      if (i === CX - 1) bb |= 2;
      if (j === CZ - 1) bb |= 4;
      celdaBorde[c] = bb;
    }
  }
  elec = new Int32Array(NE);
  for (let e = 0; e < NE; e++) elec[e] = nodo(1 + 2 * e, 0);
  for (let e = id; e < NE; e += nw) U.fill(0, e * N, (e + 1) * N);
  if (id === 0) patron();
}

function entradas(c: number): number[][] {
  const a = celdaNodos[4 * c], b = celdaNodos[4 * c + 1], d = celdaNodos[4 * c + 2], e = celdaNodos[4 * c + 3];
  const out: number[][] = [];
  const arista = (u: number, v: number) => out.push([u, u, 0.5], [v, v, 0.5], [u, v, -0.5], [v, u, -0.5]);
  arista(a, b);
  arista(d, e);
  arista(a, d);
  arista(b, e);
  const bb = celdaBorde[c];
  if (bb & 1) out.push([a, a, BC], [d, d, BC]);
  if (bb & 2) out.push([b, b, BC], [e, e, BC]);
  if (bb & 4) out.push([d, d, BC], [e, e, BC]);
  return out;
}

function patron(): void {
  const filas: Set<number>[] = [];
  for (let i = 0; i < N; i++) filas.push(new Set<number>());
  const ents: number[][][] = [];
  for (let c = 0; c < NC; c++) {
    ents[c] = entradas(c);
    for (const [r, k] of ents[c]) filas[r].add(k);
  }
  let nnz = 0;
  let banda = 0;
  Kp[0] = 0;
  for (let i = 0; i < N; i++) {
    const arr = [...filas[i]].sort((a, b) => a - b);
    for (const j of arr) {
      Kj[nnz++] = j;
      if (Math.abs(i - j) > banda) banda = Math.abs(i - j);
    }
    Kp[i + 1] = nnz;
  }
  Atomics.store(ctrl, 7, nnz);
  kdiag = new Int32Array(N);
  for (let i = 0; i < N; i++) for (let k = Kp[i]; k < Kp[i + 1]; k++) if (Kj[k] === i) kdiag[i] = k;
  let total = 0;
  for (let c = 0; c < NC; c++) total += ents[c].length;
  cPtr = new Int32Array(NC + 1);
  cIdx = new Int32Array(total);
  cCoef = new Float64Array(total);
  let t = 0;
  for (let c = 0; c < NC; c++) {
    cPtr[c] = t;
    for (const [r, k, v] of ents[c]) {
      let pos = Kp[r];
      while (Kj[pos] !== k) pos++;
      cIdx[t] = pos;
      cCoef[t] = v;
      t++;
    }
  }
  cPtr[NC] = t;
  lowK = new Int32Array(3 * N);
  let ln = 0;
  Lp[0] = 0;
  for (let i = 0; i < N; i++) {
    for (let k = Kp[i]; k < Kp[i + 1]; k++) {
      if (Kj[k] <= i) {
        Lj[ln] = Kj[k];
        lowK[ln] = k;
        ln++;
      }
    }
    Lp[i + 1] = ln;
  }
  Atomics.store(ctrl, 8, ln);
  postMessage({ type: 'malla', nnz, n: N, banda, lnnz: ln });
}

function ensamblar(prec: string): void {
  const nnz = Atomics.load(ctrl, 7);
  Kx.fill(0, 0, nnz);
  for (let c = 0; c < NC; c++) {
    const s = Math.exp(-m[c]);
    for (let k = cPtr[c]; k < cPtr[c + 1]; k++) Kx[cIdx[k]] += s * cCoef[k];
  }
  for (let i = 0; i < N; i++) Kd[i] = 1 / Kx[kdiag[i]];
  if (prec === 'ic') ic0();
}

function ic0(): void {
  for (let i = 0; i < N; i++) {
    const ini = Lp[i], fin = Lp[i + 1];
    for (let k = ini; k < fin; k++) {
      const j = Lj[k];
      let s = Kx[lowK[k]];
      let p = ini, q = Lp[j];
      const qf = Lp[j + 1] - 1;
      while (p < k && q < qf) {
        const a = Lj[p], b = Lj[q];
        if (a === b) {
          s -= Lx[p] * Lx[q];
          p++;
          q++;
        } else if (a < b) p++;
        else q++;
      }
      if (j < i) Lx[k] = s / Lx[qf];
      else Lx[k] = Math.sqrt(s > 1e-30 ? s : 1e-30);
    }
  }
}

function precondicionar(prec: string, r: Float64Array, z: Float64Array): void {
  if (prec === 'ic') {
    for (let i = 0; i < N; i++) {
      let s = r[i];
      const d = Lp[i + 1] - 1;
      for (let k = Lp[i]; k < d; k++) s -= Lx[k] * z[Lj[k]];
      z[i] = s / Lx[d];
    }
    for (let i = N - 1; i >= 0; i--) {
      const d = Lp[i + 1] - 1;
      z[i] /= Lx[d];
      const zi = z[i];
      for (let k = Lp[i]; k < d; k++) z[Lj[k]] -= Lx[k] * zi;
    }
  } else {
    for (let i = 0; i < N; i++) z[i] = r[i] * Kd[i];
  }
}

function mv(x: Float64Array, y: Float64Array): void {
  for (let i = 0; i < N; i++) {
    let s = 0;
    for (let k = Kp[i]; k < Kp[i + 1]; k++) s += Kx[k] * x[Kj[k]];
    y[i] = s;
  }
}

function dot(a: Float64Array, b: Float64Array): number {
  let s = 0;
  for (let i = 0; i < N; i++) s += a[i] * b[i];
  return s;
}

function resolver(e: number, prec: string): void {
  const x = U.subarray(e * N, (e + 1) * N);
  mv(x, qq);
  for (let i = 0; i < N; i++) rr[i] = -qq[i];
  rr[elec[e]] += 1;
  precondicionar(prec, rr, zz);
  pp.set(zz);
  let rz = dot(rr, zz);
  let rn = Math.sqrt(dot(rr, rr));
  let mejor = rn, itMejor = 0, it = 0, motivo = 0;
  while (true) {
    if (rn < 1e-8) { motivo = 0; break; }
    if (it >= 3000) { motivo = 1; break; }
    if (it - itMejor > 60) { motivo = 2; break; }
    mv(pp, qq);
    const a = rz / dot(pp, qq);
    for (let i = 0; i < N; i++) {
      x[i] += a * pp[i];
      rr[i] -= a * qq[i];
    }
    rn = Math.sqrt(dot(rr, rr));
    if (rn < mejor * 0.95) {
      mejor = rn;
      itMejor = it;
    }
    precondicionar(prec, rr, zz);
    const rz2 = dot(rr, zz);
    const bt = rz2 / rz;
    rz = rz2;
    for (let i = 0; i < N; i++) pp[i] = zz[i] + bt * pp[i];
    it++;
  }
  itF[e] = it;
  motF[e] = motivo;
  resF[e] = rn;
}

function barrera(): void {
  const g = Atomics.load(ctrl, 1);
  if (Atomics.add(ctrl, 0, 1) === nw - 1) {
    Atomics.store(ctrl, 0, 0);
    Atomics.store(ctrl, 3, Atomics.load(ctrl, 2) !== epoca ? 1 : 0);
    Atomics.add(ctrl, 1, 1);
    Atomics.notify(ctrl, 1);
  } else {
    while (Atomics.load(ctrl, 1) === g) Atomics.wait(ctrl, 1, g);
  }
  if (Atomics.load(ctrl, 3) === 1) throw 'cancelado';
}

function directo(prec: string): void {
  let e: number;
  while ((e = Atomics.add(ctrl, 4, 1)) < NE) {
    if (Atomics.load(ctrl, 2) !== epoca) break;
    resolver(e, prec);
  }
  barrera();
}

function reducir(fn: (lo: number, hi: number) => number, len: number): number {
  const s = (cuentaRed++ & 1) * NB;
  const bs = Math.ceil(len / NB);
  for (let k = id; k < NB; k += nw) {
    const lo = k * bs, hi = Math.min(len, lo + bs);
    P[s + k] = lo < hi ? fn(lo, hi) : 0;
  }
  barrera();
  let t = 0;
  for (let k = 0; k < NB; k++) t += P[s + k];
  return t;
}

function propios(fn: (lo: number, hi: number) => void): void {
  const bs = Math.ceil(NC / NB);
  for (let k = id; k < NB; k += nw) {
    const lo = k * bs, hi = Math.min(NC, lo + bs);
    if (lo < hi) fn(lo, hi);
  }
}

function ltl(v: Float64Array, c: number): number {
  const i = c % CX, j = (c - i) / CX;
  let s = 0;
  if (i > 0) s += v[c] - v[c - 1];
  if (i < CX - 1) s += v[c] - v[c + 1];
  if (j > 0) s += v[c] - v[c - CX];
  if (j < CZ - 1) s += v[c] - v[c + CX];
  return s;
}

function vecinos(c: number): number {
  const i = c % CX, j = (c - i) / CX;
  let n = 0;
  if (i > 0) n++;
  if (i < CX - 1) n++;
  if (j > 0) n++;
  if (j < CZ - 1) n++;
  return n;
}

function predecir(nd: number): void {
  for (let i = id; i < nd; i += nw) {
    const A = abmn[4 * i], B = abmn[4 * i + 1], M = abmn[4 * i + 2], Nn = abmn[4 * i + 3];
    f[i] = U[A * N + elec[M]] - U[B * N + elec[M]] - U[A * N + elec[Nn]] + U[B * N + elec[Nn]];
  }
}

function jacobiano(nd: number): void {
  for (let i = id; i < nd; i += nw) {
    const A = abmn[4 * i], B = abmn[4 * i + 1], M = abmn[4 * i + 2], Nn = abmn[4 * i + 3];
    const oA = A * N, oB = B * N, oM = M * N, oN = Nn * N;
    const fi = U[oA + elec[M]] - U[oB + elec[M]] - U[oA + elec[Nn]] + U[oB + elec[Nn]];
    f[i] = fi;
    rw[i] = w[i] * (dobs[i] - fi);
    const fila = i * NC;
    for (let c = 0; c < NC; c++) {
      const q = 4 * c;
      const n0 = celdaNodos[q], n1 = celdaNodos[q + 1], n2 = celdaNodos[q + 2], n3 = celdaNodos[q + 3];
      const a0 = U[oA + n0] - U[oB + n0], a1 = U[oA + n1] - U[oB + n1], a2 = U[oA + n2] - U[oB + n2], a3 = U[oA + n3] - U[oB + n3];
      const b0 = U[oM + n0] - U[oN + n0], b1 = U[oM + n1] - U[oN + n1], b2 = U[oM + n2] - U[oN + n2], b3 = U[oM + n3] - U[oN + n3];
      let s = 0.5 * ((a0 - a1) * (b0 - b1) + (a2 - a3) * (b2 - b3) + (a0 - a2) * (b0 - b2) + (a1 - a3) * (b1 - b3));
      const bb = celdaBorde[c];
      if (bb & 1) s += BC * (a0 * b0 + a2 * b2);
      if (bb & 2) s += BC * (a1 * b1 + a3 * b3);
      if (bb & 4) s += BC * (a2 * b2 + a3 * b3);
      J[fila + c] = w[i] * Math.exp(-m[c]) * s;
    }
  }
  barrera();
}

function normal(lam: number, nd: number): number {
  propios((lo, hi) => {
    for (let c = lo; c < hi; c++) {
      let d = 0, g = 0;
      for (let i = 0; i < nd; i++) {
        const v = J[i * NC + c];
        d += v * v;
        g += v * rw[i];
      }
      gd[c] = d + lam * vecinos(c) + 1e-10;
      gb[c] = g - lam * ltl(m, c);
      gx[c] = 0;
      gr[c] = gb[c];
      gz[c] = gr[c] / gd[c];
      gp[c] = gz[c];
    }
  });
  let rz = reducir((lo, hi) => {
    let s = 0;
    for (let c = lo; c < hi; c++) s += gr[c] * gz[c];
    return s;
  }, NC);
  const rz0 = rz;
  let k = 0;
  while (k < 80 && rz0 > 0 && Math.sqrt(rz / rz0) > 1e-3) {
    barrera();
    for (let i = id; i < nd; i += nw) {
      let s = 0;
      const o = i * NC;
      for (let c = 0; c < NC; c++) s += J[o + c] * gp[c];
      gt[i] = s;
    }
    barrera();
    const pq = reducir((lo, hi) => {
      let s = 0;
      for (let c = lo; c < hi; c++) {
        let v = 0;
        for (let i = 0; i < nd; i++) v += J[i * NC + c] * gt[i];
        v += lam * ltl(gp, c);
        gq[c] = v;
        s += gp[c] * v;
      }
      return s;
    }, NC);
    const a = rz / pq;
    const rz2 = reducir((lo, hi) => {
      let s = 0;
      for (let c = lo; c < hi; c++) {
        gx[c] += a * gp[c];
        gr[c] -= a * gq[c];
        gz[c] = gr[c] / gd[c];
        s += gr[c] * gz[c];
      }
      return s;
    }, NC);
    const bt = rz2 / rz;
    rz = rz2;
    propios((lo, hi) => {
      for (let c = lo; c < hi; c++) gp[c] = gz[c] + bt * gp[c];
    });
    k++;
    ahorro += 2 * nw * NC * 8;
  }
  return k;
}

function paso(): void {
  propios((lo, hi) => {
    for (let c = lo; c < hi; c++) {
      mPrev[c] = m[c];
      let d = gx[c];
      if (d > 1) d = 1;
      if (d < -1) d = -1;
      let v = m[c] + d;
      if (v < -0.69) v = -0.69;
      if (v > 11.5) v = 11.5;
      m[c] = v;
    }
  });
  barrera();
}

function publicar(): void {
  const pub = 1 - Atomics.load(ctrl, 6);
  mPub.set(m, pub * NC);
  Atomics.store(ctrl, 6, pub);
}

function estadoDirecto(): { total: number; max: number; est: number } {
  let total = 0, max = 0, est = 0;
  for (let e = 0; e < NE; e++) {
    total += itF[e];
    if (itF[e] > max) max = itF[e];
    if (motF[e] === 2) est++;
  }
  return { total, max, est };
}

function inicioFrio(prec: string, nd: number): void {
  propios((lo, hi) => m.fill(0, lo, hi));
  for (let e = id; e < NE; e += nw) U.fill(0, e * N, (e + 1) * N);
  barrera();
  if (id === 0) {
    ensamblar(prec);
    Atomics.store(ctrl, 4, 0);
  }
  barrera();
  directo(prec);
  predecir(nd);
  barrera();
  const a = reducir((lo, hi) => {
    let s = 0;
    for (let i = lo; i < hi; i++) s += w[i] * w[i] * dobs[i] * f[i];
    return s;
  }, nd);
  const b = reducir((lo, hi) => {
    let s = 0;
    for (let i = lo; i < hi; i++) s += w[i] * w[i] * f[i] * f[i];
    return s;
  }, nd);
  const rho = a / b > 0 ? a / b : 1;
  propios((lo, hi) => m.fill(Math.log(rho), lo, hi));
  for (let e = id; e < NE; e += nw) for (let i = e * N; i < (e + 1) * N; i++) U[i] *= rho;
  barrera();
}

function correr(job: Trabajo): void {
  epoca = job.epoca;
  cuentaRed = 0;
  ahorro = 0;
  const nd = Atomics.load(ctrl, 5);
  const lam = job.lambda, prec = job.prec;
  const t0 = performance.now();
  let interno = 0, directoTotal = 0;
  try {
    if (!job.tibio) inicioFrio(prec, nd);
    let prev = Infinity, prevRug = 0, motivo = '', it = 0, phi = 0, rug = 0;
    for (it = 0; ; it++) {
      const ti = performance.now();
      if (id === 0) {
        ensamblar(prec);
        Atomics.store(ctrl, 4, 0);
      }
      barrera();
      directo(prec);
      jacobiano(nd);
      phi = reducir((lo, hi) => {
        let s = 0;
        for (let i = lo; i < hi; i++) s += rw[i] * rw[i];
        return s;
      }, nd);
      rug = reducir((lo, hi) => {
        let s = 0;
        for (let c = lo; c < hi; c++) {
          if (c % CX < CX - 1) s += (m[c] - m[c + 1]) ** 2;
          if (c + CX < NC) s += (m[c] - m[c + CX]) ** 2;
        }
        return s;
      }, NC);
      const ed = estadoDirecto();
      directoTotal += ed.total;
      if (it > 0 && phi > prev) {
        propios((lo, hi) => {
          for (let c = lo; c < hi; c++) m[c] = mPrev[c];
        });
        barrera();
        phi = prev;
        rug = prevRug;
        motivo = 'estancado: el paso empeoró el ajuste, se conserva el modelo anterior';
        break;
      }
      ahorro += NE * N * 8 + nd * NC * 8;
      if (id === 0) {
        publicar();
        postMessage({ type: 'iter', it, phi, chi2: phi / nd, rug, fwdTotal: ed.total, fwdMax: ed.max, fwdEst: ed.est, dt: performance.now() - ti, ahorro });
      }
      if (phi / nd <= 1) { motivo = 'chi² ≤ 1: el modelo explica los datos dentro del ruido'; break; }
      if (it > 0 && (prev - phi) / prev < 0.01) { motivo = 'estancado: mejora del ajuste menor al 1%'; break; }
      if (it >= job.maxIt) { motivo = 'máximo de iteraciones externas'; break; }
      prev = phi;
      prevRug = rug;
      interno += normal(lam, nd);
      paso();
    }
    if (id === 0) postMessage({ type: 'fin', cancelado: false, it, phi, chi2: phi / nd, rug, motivo, nd, interno, directoTotal, ms: performance.now() - t0, ahorro, lambda: lam, prec });
  } catch (err) {
    if (err !== 'cancelado') throw err;
    if (id === 0) postMessage({ type: 'fin', cancelado: true });
  }
}

function banco(job: Trabajo): void {
  epoca = job.epoca;
  cuentaRed = 0;
  const out: Record<string, object> = {};
  try {
    for (const prec of ['diag', 'ic']) {
      for (let e = id; e < NE; e += nw) U.fill(0, e * N, (e + 1) * N);
      barrera();
      let tc = 0;
      if (id === 0) {
        const t = performance.now();
        ensamblar(prec);
        tc = performance.now() - t;
        Atomics.store(ctrl, 4, 0);
      }
      barrera();
      const t = performance.now();
      directo(prec);
      if (id === 0) {
        const ed = estadoDirecto();
        out[prec] = { tipo: prec, construccion: tc, total: ed.total, prom: ed.total / NE, max: ed.max, est: ed.est, ms: performance.now() - t };
      }
    }
    if (id === 0) postMessage({ type: 'banco', out: Object.values(out) });
  } catch (err) {
    if (err !== 'cancelado') throw err;
    if (id === 0) postMessage({ type: 'banco', out: null });
  }
}

function sintetico(job: Trabajo): void {
  epoca = job.epoca;
  const nd = Atomics.load(ctrl, 5);
  try {
    for (let e = id; e < NE; e += nw) U.fill(0, e * N, (e + 1) * N);
    barrera();
    if (id === 0) {
      ensamblar('ic');
      Atomics.store(ctrl, 4, 0);
    }
    barrera();
    directo('ic');
    predecir(nd);
    barrera();
    for (let e = id; e < NE; e += nw) U.fill(0, e * N, (e + 1) * N);
    barrera();
    if (id === 0) postMessage({ type: 'sintetico', ok: true });
  } catch (err) {
    if (err !== 'cancelado') throw err;
    if (id === 0) postMessage({ type: 'sintetico', ok: false });
  }
}

addEventListener('message', ({ data }: MessageEvent) => {
  if (data.type === 'init') iniciar(data.id, data.nw, data.cfg, data.b);
  else if (data.type === 'malla') malla(data.orden);
  else if (data.type === 'correr') correr(data);
  else if (data.type === 'banco') banco(data);
  else if (data.type === 'sintetico') sintetico(data);
  else if (data.type === 'eco') {
    if (data.devolver) postMessage({ type: 'eco', datos: data.datos }, [data.datos.buffer]);
    else postMessage({ type: 'eco' });
  }
});
