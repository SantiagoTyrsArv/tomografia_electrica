const paleta = [[30, 60, 200], [0, 170, 220], [80, 200, 90], [250, 220, 50], [210, 40, 30]];

export function color(t: number): number[] {
  t = Math.max(0, Math.min(1, t)) * 4;
  const i = Math.min(3, Math.floor(t)), f = t - i;
  const a = paleta[i], b = paleta[i + 1];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}
