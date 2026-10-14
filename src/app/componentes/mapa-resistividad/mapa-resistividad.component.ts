import { AfterViewInit, Component, ElementRef, ViewChild, effect, inject, output, signal } from '@angular/core';
import { InversionService } from '../../core/inversion.service';
import { CX, CZ, ESC, NC, NE, OH, OW, TUBO } from '../../core/constantes';
import { color } from '../../utilidades/colores';
import { interp, iso, log10Modelo } from '../../utilidades/isolineas';
import { med } from '../../utilidades/depuracion';

interface Punto {
  px: number;
  py: number;
  x: number;
  z: number;
}

@Component({
  selector: 'app-mapa-resistividad',
  templateUrl: './mapa-resistividad.component.html',
  styleUrl: './mapa-resistividad.component.css'
})
export class MapaResistividadComponent implements AfterViewInit {
  @ViewChild('mapa') mapaRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('lectura') lecturaRef!: ElementRef<HTMLSpanElement>;
  inv = inject(InversionService);
  perfil = output<number>();
  escala = signal('');
  zonas = signal('');

  private ctx!: CanvasRenderingContext2D;
  private off = document.createElement('canvas');
  private octx = this.off.getContext('2d')!;
  private lg: Float64Array = new Float64Array(NC);
  private lo = 0;
  private hi = 1;
  private dibujado = -1;
  private pendiente = false;
  private vista = { s: 1, x: 0, y: 0 };
  private cursor: Punto | null = null;
  private perfilX: number | null = null;
  private arrastre: { px: number; py: number; vx: number; vy: number; movio: boolean } | null = null;

  constructor() {
    this.off.width = OW;
    this.off.height = OH;
    effect(() => {
      this.inv.version();
      this.pedirDibujo();
    });
  }

  ngAfterViewInit(): void {
    const cv = this.mapaRef.nativeElement;
    this.ctx = cv.getContext('2d')!;
    cv.addEventListener('pointerdown', e => {
      const p = this.aModelo(e);
      this.arrastre = { px: p.px, py: p.py, vx: this.vista.x, vy: this.vista.y, movio: false };
      cv.setPointerCapture(e.pointerId);
    });
    cv.addEventListener('pointermove', e => {
      const p = this.aModelo(e);
      if (this.arrastre) {
        const dx = p.px - this.arrastre.px, dy = p.py - this.arrastre.py;
        if (Math.abs(dx) + Math.abs(dy) > 4) this.arrastre.movio = true;
        if (this.arrastre.movio) {
          this.vista.x = this.arrastre.vx + dx;
          this.vista.y = this.arrastre.vy + dy;
        }
      }
      if (p.x >= 0 && p.x <= CX && p.z >= 0 && p.z <= CZ && this.inv.hayModelo) {
        this.cursor = p;
        this.lecturaRef.nativeElement.textContent = `x ${p.x.toFixed(1)} m · profundidad ${p.z.toFixed(1)} m · ρ ${(10 ** interp(this.lg, p.x - 0.5, p.z - 0.5)).toFixed(1)} Ω·m`;
      } else this.cursor = null;
      this.pedirDibujo();
    });
    cv.addEventListener('pointerup', e => {
      if (this.arrastre && !this.arrastre.movio) {
        const p = this.aModelo(e);
        if (p.x >= 0 && p.x <= CX) {
          this.perfilX = p.x;
          this.perfil.emit(p.x);
        }
      }
      this.arrastre = null;
      this.pedirDibujo();
    });
    cv.addEventListener('pointerleave', () => {
      this.cursor = null;
      this.pedirDibujo();
    });
    cv.addEventListener('wheel', e => {
      e.preventDefault();
      const p = this.aModelo(e);
      this.zoom(e.deltaY < 0 ? 1.2 : 1 / 1.2, p.px, p.py);
    }, { passive: false });
  }

  private aModelo(e: MouseEvent): Punto {
    const cv = this.mapaRef.nativeElement;
    const r = cv.getBoundingClientRect();
    const px = (e.clientX - r.left) * cv.width / r.width, py = (e.clientY - r.top) * cv.height / r.height;
    const k = cv.width / OW * this.vista.s;
    return { px, py, x: (px - this.vista.x) / k / ESC, z: (py - this.vista.y) / k / ESC };
  }

  zoom(f: number, px?: number, py?: number): void {
    const cv = this.mapaRef.nativeElement;
    px = px ?? cv.width / 2;
    py = py ?? cv.height / 2;
    this.vista.x = px - (px - this.vista.x) * f;
    this.vista.y = py - (py - this.vista.y) * f;
    this.vista.s *= f;
    this.pedirDibujo();
  }

  ajustar(): void {
    this.vista = { s: 1, x: 0, y: 0 };
    this.pedirDibujo();
  }

  private pedirDibujo(): void {
    if (this.pendiente) return;
    this.pendiente = true;
    requestAnimationFrame(() => this.dibujar());
  }

  private construirImagen(): void {
    const r = log10Modelo(this.inv.modelo);
    this.lg = r.lg;
    this.lo = r.lo;
    this.hi = r.hi;
    const img = this.octx.createImageData(OW, OH);
    let k = 0;
    for (let py = 0; py < OH; py++) {
      const gz = (py + 0.5) / ESC - 0.5;
      for (let px = 0; px < OW; px++) {
        const c = color((interp(this.lg, (px + 0.5) / ESC - 0.5, gz) - this.lo) / (this.hi - this.lo));
        img.data[k++] = c[0];
        img.data[k++] = c[1];
        img.data[k++] = c[2];
        img.data[k++] = 255;
      }
    }
    const g = this.octx;
    g.putImageData(img, 0, 0);
    g.lineWidth = 0.6;
    g.strokeStyle = 'rgba(0,0,0,0.45)';
    for (let i = 1; i < 6; i++) iso(g, this.lg, this.lo + (this.hi - this.lo) * i / 6);
    const umbral = Math.log10(Math.exp(med(this.inv.modelo)) / 3);
    g.lineWidth = 2;
    g.strokeStyle = '#ff00d4';
    iso(g, this.lg, umbral);
    let n = 0;
    for (let c = 0; c < NC; c++) if (this.lg[c] < umbral) n++;
    this.zonas.set(n ? `${n} celdas candidatas a fuga (ρ < 1/3 de la mediana del modelo)` : 'Sin zonas candidatas');
    g.setLineDash([6, 4]);
    g.strokeStyle = '#fff';
    g.beginPath();
    g.moveTo(0, TUBO * ESC);
    g.lineTo(OW, TUBO * ESC);
    g.stroke();
    g.setLineDash([]);
    g.fillStyle = '#000';
    for (let e = 0; e < NE; e++) g.fillRect((1 + 2 * e) * ESC - 1, 0, 2, 4);
    this.escala.set(`ρ ${(10 ** this.lo).toFixed(1)} – ${(10 ** this.hi).toFixed(1)} Ω·m`);
  }

  private dibujar(): void {
    this.pendiente = false;
    if (!this.inv.hayModelo || !this.ctx) return;
    const v = this.inv.version();
    if (this.dibujado !== v) {
      this.construirImagen();
      this.dibujado = v;
    }
    const cv = this.mapaRef.nativeElement, ctx = this.ctx;
    const k = cv.width / OW * this.vista.s;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.setTransform(k, 0, 0, k, this.vista.x, this.vista.y);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.off, 0, 0);
    ctx.lineWidth = 1 / k;
    if (this.perfilX !== null) {
      ctx.strokeStyle = '#000';
      ctx.beginPath();
      ctx.moveTo(this.perfilX * ESC, 0);
      ctx.lineTo(this.perfilX * ESC, OH);
      ctx.stroke();
    }
    if (this.cursor) {
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath();
      ctx.moveTo(this.cursor.x * ESC, 0);
      ctx.lineTo(this.cursor.x * ESC, OH);
      ctx.moveTo(0, this.cursor.z * ESC);
      ctx.lineTo(OW, this.cursor.z * ESC);
      ctx.stroke();
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
}
