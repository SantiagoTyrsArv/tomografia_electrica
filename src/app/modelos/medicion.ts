export interface Medicion {
  A: number;
  B: number;
  M: number;
  N: number;
  I: number;
  V: number;
  rep: number;
  desv: number;
  rhoa: number;
  manual: boolean | null;
  motivos: string[];
  activa: boolean;
}

export interface Umbrales {
  desv: number;
  ruido: number;
  vecinas: number;
}
