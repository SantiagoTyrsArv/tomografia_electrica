import { Medicion, Umbrales } from '../modelos/medicion';

export function factor(m: Medicion): number {
  const r = (a: number, b: number) => Math.abs(a - b) * 2;
  return 2 * Math.PI / (1 / r(m.A, m.M) - 1 / r(m.B, m.M) - 1 / r(m.A, m.N) + 1 / r(m.B, m.N));
}

export function med(arr: ArrayLike<number>): number {
  const s = Array.from(arr).sort((a, b) => a - b);
  if (!s.length) return 0;
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
}

export function depurar(medidas: Medicion[], u: Umbrales): number {
  const grupos: Record<string, Medicion[]> = {};
  for (const m of medidas) {
    m.rhoa = factor(m) * m.V / m.I;
    m.motivos = [];
    if (m.desv > u.desv / 100) m.motivos.push('desviación alta');
    if (Math.abs(m.V) < u.ruido) m.motivos.push('voltaje bajo el ruido');
    if (!(m.rhoa > 0)) m.motivos.push('ρa negativa');
    const a = m.B - m.A;
    const k = a + '_' + Math.round((m.M - m.B) / a);
    if (!grupos[k]) grupos[k] = [];
    grupos[k].push(m);
  }
  for (const k in grupos) {
    const g = grupos[k];
    for (const m of g) {
      if (!(m.rhoa > 0)) continue;
      const vec = g.filter(o => o !== m && o.rhoa > 0 && Math.abs(o.A - m.A) <= 2).map(o => Math.log(o.rhoa));
      if (vec.length >= 2 && Math.abs(Math.log(m.rhoa) - med(vec)) > Math.log(u.vecinas)) m.motivos.push('atípica frente a sus vecinas');
    }
  }
  for (const m of medidas) m.activa = m.manual !== null ? m.manual : m.motivos.length === 0;
  const buenas = medidas.filter(m => m.rhoa > 0).map(m => m.rhoa);
  return buenas.length ? med(buenas) : 100;
}

export function resumir(medidas: Medicion[]): string {
  if (!medidas.length) return '';
  const fuera = medidas.filter(m => !m.activa);
  const cuenta: Record<string, number> = {};
  for (const m of fuera) for (const r of (m.motivos.length ? m.motivos : ['manual'])) cuenta[r] = (cuenta[r] || 0) + 1;
  return `${medidas.length} mediciones · ${medidas.length - fuera.length} activas · ${fuera.length} descartadas (${(fuera.length / medidas.length * 100).toFixed(1)}%) ` + Object.entries(cuenta).map(([k, v]) => `· ${k}: ${v}`).join(' ');
}
