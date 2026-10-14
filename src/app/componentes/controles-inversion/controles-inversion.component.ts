import { Component, inject } from '@angular/core';
import { InversionService } from '../../core/inversion.service';

@Component({
  selector: 'app-controles-inversion',
  templateUrl: './controles-inversion.component.html',
  styleUrl: './controles-inversion.component.css'
})
export class ControlesInversionComponent {
  inv = inject(InversionService);

  valor(e: Event): string {
    return (e.target as HTMLInputElement | HTMLSelectElement).value;
  }

  moverLambda(e: Event): void {
    this.inv.lambdaLog.set(+this.valor(e));
    this.inv.pedir();
  }

  cambiarPrec(e: Event): void {
    this.inv.prec.set(this.valor(e));
    this.inv.pedir();
  }
}
