import { AfterViewInit, Component, ElementRef, ViewChild, effect, inject, input } from '@angular/core';
import { InversionService } from '../../core/inversion.service';
import { CZ } from '../../core/constantes';
import { interp, log10Modelo } from '../../utilidades/isolineas';

@Component({
  selector: 'app-perfil-vertical',
  templateUrl: './perfil-vertical.component.html'
})
export class PerfilVerticalComponent implements AfterViewInit {
  @ViewChild('perfil') perfilRef!: ElementRef<HTMLCanvasElement>;
  inv = inject(InversionService);
  x = input<number | null>(null);
  private listo = false;

  constructor() {
    effect(() => {
      this.inv.version();
      const x = this.x();
      if (this.listo) this.dibujar(x);
    });
  }

  ngAfterViewInit(): void {
    this.listo = true;
    this.dibujar(this.x());
  }

  private dibujar(x: number | null): void {
    const c = this.perfilRef.nativeElement, g = c.getContext('2d')!;
    g.clearRect(0, 0, c.width, c.height);
    if (x === null || !this.inv.hayModelo) return;
    const { lg, lo, hi } = log10Modelo(this.inv.modelo);
    const pad = 30;
    const px = (v: number) => pad + (v - lo) / (hi - lo) * (c.width - 2 * pad);
    const py = (z: number) => 10 + z / CZ * (c.height - 30);
    g.strokeStyle = '#ccc';
    g.lineWidth = 1;
    g.strokeRect(pad, 10, c.width - 2 * pad, c.height - 30);
    g.strokeStyle = '#1d4e89';
    g.lineWidth = 2;
    g.beginPath();
    for (let z = 0; z <= CZ; z += 0.25) {
      const v = interp(lg, x - 0.5, z - 0.5);
      if (z) g.lineTo(px(v), py(z));
      else g.moveTo(px(v), py(z));
    }
    g.stroke();
    g.fillStyle = '#333';
    g.font = '11px sans-serif';
    g.fillText('x = ' + x.toFixed(1) + ' m', pad, c.height - 5);
    g.fillText('0 m', 2, 14);
    g.fillText(CZ + ' m', 2, c.height - 20);
  }
}
