import { Component, inject } from '@angular/core';
import { InversionService } from '../../core/inversion.service';
import { Umbrales } from '../../modelos/medicion';

@Component({
  selector: 'app-carga-medidas',
  templateUrl: './carga-medidas.component.html',
  styleUrl: './carga-medidas.component.css'
})
export class CargaMedidasComponent {
  inv = inject(InversionService);

  async leerArchivo(e: Event): Promise<void> {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (f) this.inv.cargarTexto(await f.text());
  }

  cambiarUmbral(campo: keyof Umbrales, e: Event): void {
    const v = +(e.target as HTMLInputElement).value;
    this.inv.umbrales.update(u => ({ ...u, [campo]: v }));
  }
}
