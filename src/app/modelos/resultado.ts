import { Fin } from './mensajes';

export interface Resultado extends Fin {
  workers: number;
  orden: string;
  hash: string;
}

export interface PuntoCurva {
  l: number;
  phi: number;
  rug: number;
  it: number;
}

export interface FilaRepro {
  workers: number;
  hash: string;
  phi: string;
  dif: number;
  segundos: string;
}
