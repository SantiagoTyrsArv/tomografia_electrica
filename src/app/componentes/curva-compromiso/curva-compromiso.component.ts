import { AfterViewInit, Component, ElementRef, ViewChild, effect, inject } from '@angular/core';
import { InversionService } from '../../core/inversion.service';
import { PuntoCurva } from '../../modelos/resultado';

@Component({
  selector: 'app-curva-compromiso',
  templateUrl: './curva-compromiso.component.html'
})
export class CurvaCompromisoComponent implements AfterViewInit {
  @ViewChild('curva') curvaRef!: ElementRef<HTMLCanvasElement>;
  inv = inject(InversionService);
  private listo = false;

  constructor() {
    effect(() => {
      const puntos = this.inv.puntos();
      const sug = this.inv.sugerido();
      if (this.listo) this.dibujar(puntos, sug);
    });
  }

  ngAfterViewInit(): void {
    this.listo = true;
  }

  private dibujar(puntos: PuntoCurva[], sugerido: PuntoCurva | null): void {
    const c = this.curvaRef.nativeElement, g = c.getContext('2d')!;
    g.clearRect(0, 0, c.width, c.height);
    if (!puntos.length) return;
    const xs = puntos.map(p => Math.log10(p.rug)), ys = puntos.map(p => Math.log10(p.phi));
    const x0 = Math.min(...xs), x1 = Math.max(...xs) + 1e-9, y0 = Math.min(...ys), y1 = Math.max(...ys) + 1e-9;
    const px = (v: number) => 40 + (v - x0) / (x1 - x0) * (c.width - 60);
    const py = (v: number) => c.height - 30 - (v - y0) / (y1 - y0) * (c.height - 50);
    g.strokeStyle = '#888';
    g.beginPath();
    puntos.forEach((p, i) => (i ? g.lineTo(px(xs[i]), py(ys[i])) : g.moveTo(px(xs[i]), py(ys[i]))));
    g.stroke();
    g.font = '11px sans-serif';
    puntos.forEach((p, i) => {
      g.fillStyle = p === sugerido ? '#d62828' : '#1d4e89';
      g.beginPath();
      g.arc(px(xs[i]), py(ys[i]), p === sugerido ? 6 : 4, 0, 7);
      g.fill();
      g.fillText('λ ' + p.l, px(xs[i]) + 7, py(ys[i]) - 5);
    });
    g.fillStyle = '#555';
    g.fillText('log rugosidad →', c.width - 110, c.height - 8);
    g.fillText('log error ↑', 4, 12);
  }
}
