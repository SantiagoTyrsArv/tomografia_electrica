export interface Configuracion {
  NX: number;
  NZ: number;
  NE: number;
  NB: number;
  NDMAX: number;
}

export interface Buffers {
  ctrl: SharedArrayBuffer;
  Kp: SharedArrayBuffer;
  Kj: SharedArrayBuffer;
  Kx: SharedArrayBuffer;
  Kd: SharedArrayBuffer;
  Lp: SharedArrayBuffer;
  Lj: SharedArrayBuffer;
  Lx: SharedArrayBuffer;
  U: SharedArrayBuffer;
  itF: SharedArrayBuffer;
  motF: SharedArrayBuffer;
  resF: SharedArrayBuffer;
  abmn: SharedArrayBuffer;
  dobs: SharedArrayBuffer;
  w: SharedArrayBuffer;
  f: SharedArrayBuffer;
  rw: SharedArrayBuffer;
  t: SharedArrayBuffer;
  J: SharedArrayBuffer;
  m: SharedArrayBuffer;
  mPrev: SharedArrayBuffer;
  mPub: SharedArrayBuffer;
  x: SharedArrayBuffer;
  r: SharedArrayBuffer;
  z: SharedArrayBuffer;
  p: SharedArrayBuffer;
  q: SharedArrayBuffer;
  g: SharedArrayBuffer;
  d: SharedArrayBuffer;
  P: SharedArrayBuffer;
}

export interface Trabajo {
  type: string;
  epoca: number;
  lambda: number;
  prec: string;
  tibio: boolean;
  maxIt: number;
}

export interface InfoMalla {
  type: 'malla';
  nnz: number;
  n: number;
  banda: number;
  lnnz: number;
}

export interface Iteracion {
  type: 'iter';
  it: number;
  phi: number;
  chi2: number;
  rug: number;
  fwdTotal: number;
  fwdMax: number;
  fwdEst: number;
  dt: number;
  ahorro: number;
}

export interface Fin {
  type: 'fin';
  cancelado: boolean;
  it: number;
  phi: number;
  chi2: number;
  rug: number;
  motivo: string;
  nd: number;
  interno: number;
  directoTotal: number;
  ms: number;
  ahorro: number;
  lambda: number;
  prec: string;
}

export interface FilaBanco {
  tipo: string;
  construccion: number;
  total: number;
  prom: number;
  max: number;
  est: number;
  ms: number;
}

export interface Banco {
  type: 'banco';
  out: FilaBanco[] | null;
}

export type MensajeWorker =
  | { type: 'listo'; id: number }
  | { type: 'sintetico'; ok: boolean }
  | { type: 'eco' }
  | InfoMalla
  | Iteracion
  | Fin
  | Banco;
