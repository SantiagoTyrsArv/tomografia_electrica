import { CX, CZ, ESC } from '../core/constantes';

export function interp(lg: Float64Array, gx: number, gz: number): number {
  gx = Math.max(0, Math.min(CX - 1, gx));
  gz = Math.max(0, Math.min(CZ - 1, gz));
  const i = Math.min(CX - 2, Math.floor(gx)), j = Math.min(CZ - 2, Math.floor(gz));
  const tx = gx - i, tz = gz - j, c = j * CX + i;
  return (lg[c] * (1 - tx) + lg[c + 1] * tx) * (1 - tz) + (lg[c + CX] * (1 - tx) + lg[c + CX + 1] * tx) * tz;
}

export function log10Modelo(modelo: Float64Array): { lg: Float64Array; lo: number; hi: number } {
  const lg = new Float64Array(modelo.length);
  let lo = Infinity, hi = -Infinity;
  for (let c = 0; c < modelo.length; c++) {
    lg[c] = modelo[c] / Math.LN10;
    if (lg[c] < lo) lo = lg[c];
    if (lg[c] > hi) hi = lg[c];
  }
  if (hi - lo < 0.1) hi = lo + 0.1;
  return { lg, lo, hi };
}

export function iso(g: CanvasRenderingContext2D, lg: Float64Array, nivel: number): void {
  g.beginPath();
  for (let j = 0; j < CZ - 1; j++) {
    for (let i = 0; i < CX - 1; i++) {
      const c = j * CX + i;
      const v = [lg[c], lg[c + 1], lg[c + CX + 1], lg[c + CX]];
      const q = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]];
      const pts: number[][] = [];
      for (let k = 0; k < 4; k++) {
        const a = v[k], b = v[(k + 1) % 4];
        if ((a < nivel) !== (b < nivel)) {
          const t = (nivel - a) / (b - a), p = q[k], r = q[(k + 1) % 4];
          pts.push([(p[0] + (r[0] - p[0]) * t + 0.5) * ESC, (p[1] + (r[1] - p[1]) * t + 0.5) * ESC]);
        }
      }
      if (pts.length >= 2) {
        g.moveTo(pts[0][0], pts[0][1]);
        g.lineTo(pts[1][0], pts[1][1]);
      }
      if (pts.length === 4) {
        g.moveTo(pts[2][0], pts[2][1]);
        g.lineTo(pts[3][0], pts[3][1]);
      }
    }
  }
  g.stroke();
}
