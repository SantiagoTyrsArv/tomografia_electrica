import { NE } from '../core/constantes';
import { Medicion } from '../modelos/medicion';

export function parsear(txt: string): Medicion[] {
  const out: Medicion[] = [];
  for (const l of txt.split(/\r?\n/)) {
    const s = l.trim();
    if (!s || s[0] === '#') continue;
    const p = s.split(/\s+/);
    if (p.length < 8) continue;
    const m: Medicion = {
      A: +p[0] - 1,
      B: +p[1] - 1,
      M: +p[2] - 1,
      N: +p[3] - 1,
      I: +p[4],
      V: +p[5],
      rep: +p[6],
      desv: parseFloat(p[7]) / 100,
      rhoa: 0,
      manual: null,
      motivos: [],
      activa: true
    };
    if ([m.A, m.B, m.M, m.N, m.I, m.V, m.desv].some(isNaN)) continue;
    if ([m.A, m.B, m.M, m.N].some(e => e < 0 || e >= NE)) continue;
    out.push(m);
  }
  return out;
}
