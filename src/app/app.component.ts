import { Component, OnInit, inject, signal } from '@angular/core';
import { InversionService } from './core/inversion.service';
import { VERSION } from './core/constantes';
import { CargaMedidasComponent } from './componentes/carga-medidas/carga-medidas.component';
import { ControlesInversionComponent } from './componentes/controles-inversion/controles-inversion.component';
import { MapaResistividadComponent } from './componentes/mapa-resistividad/mapa-resistividad.component';
import { PerfilVerticalComponent } from './componentes/perfil-vertical/perfil-vertical.component';
import { CurvaCompromisoComponent } from './componentes/curva-compromiso/curva-compromiso.component';
import { PanelRendimientoComponent } from './componentes/panel-rendimiento/panel-rendimiento.component';
import { TablaMedicionesComponent } from './componentes/tabla-mediciones/tabla-mediciones.component';

@Component({
  selector: 'app-root',
  imports: [
    CargaMedidasComponent,
    ControlesInversionComponent,
    MapaResistividadComponent,
    PerfilVerticalComponent,
    CurvaCompromisoComponent,
    PanelRendimientoComponent,
    TablaMedicionesComponent
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  inv = inject(InversionService);
  version = VERSION;
  nucleos = navigator.hardwareConcurrency;
  perfilX = signal<number | null>(null);

  ngOnInit(): void {
    this.inv.arrancar();
  }
}
