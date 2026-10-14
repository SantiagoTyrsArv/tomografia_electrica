import { PuntoCurva } from '../modelos/resultado';

export function sugerir(puntos: PuntoCurva[]): PuntoCurva | null {
  if (puntos.length < 3) return null;
  let mejor = -1;
  let elegido: PuntoCurva | null = null;
  for (let i = 1; i < puntos.length - 1; i++) {
    const p = [puntos[i - 1], puntos[i], puntos[i + 1]].map(q => [Math.log10(q.rug), Math.log10(q.phi)]);
    const a = Math.hypot(p[1][0] - p[0][0], p[1][1] - p[0][1]);
    const b = Math.hypot(p[2][0] - p[1][0], p[2][1] - p[1][1]);
    const c = Math.hypot(p[2][0] - p[0][0], p[2][1] - p[0][1]);
    const area = Math.abs((p[1][0] - p[0][0]) * (p[2][1] - p[0][1]) - (p[2][0] - p[0][0]) * (p[1][1] - p[0][1]));
    const k = a * b * c > 0 ? 2 * area / (a * b * c) : 0;
    if (k > mejor) {
      mejor = k;
      elegido = puntos[i];
    }
  }
  return elegido;
}
