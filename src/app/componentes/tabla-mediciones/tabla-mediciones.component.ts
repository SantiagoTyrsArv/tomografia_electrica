import { Component, inject } from '@angular/core';
import { InversionService } from '../../core/inversion.service';

@Component({
  selector: 'app-tabla-mediciones',
  templateUrl: './tabla-mediciones.component.html'
})
export class TablaMedicionesComponent {
  inv = inject(InversionService);

  marcar(i: number, e: Event): void {
    this.inv.cambiarMedicion(i, (e.target as HTMLInputElement).checked);
  }
}
