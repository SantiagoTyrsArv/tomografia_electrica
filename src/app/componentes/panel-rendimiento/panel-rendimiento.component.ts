import { Component, computed, inject } from '@angular/core';
import { InversionService } from '../../core/inversion.service';
import { PoolWorkersService } from '../../core/pool-workers.service';
import { RendimientoService } from '../../core/rendimiento.service';

@Component({
  selector: 'app-panel-rendimiento',
  templateUrl: './panel-rendimiento.component.html',
  styleUrl: './panel-rendimiento.component.css'
})
export class PanelRendimientoComponent {
  inv = inject(InversionService);
  pool = inject(PoolWorkersService);
  rend = inject(RendimientoService);

  malla = computed(() => {
    const d = this.pool.malla();
    if (!d) return ['-'];
    const csr = (d.n + 1) * 4 + d.nnz * 12;
    const ic = (d.n + 1) * 4 + d.lnnz * 12;
    const densa = d.n * d.n * 8;
    return [
      `Nodos ${d.n} · no ceros ${d.nnz} (${(d.nnz / d.n).toFixed(1)} por fila) · llenado ${(d.nnz / (d.n * d.n) * 100).toFixed(3)}%`,
      `CSR ${(csr / 1024).toFixed(1)} KB · factor IC(0) ${(ic / 1024).toFixed(1)} KB · densa ${(densa / 1048576).toFixed(1)} MB por copia`,
      `Ancho de banda ${d.banda} · producto matriz-vector ${2 * d.nnz} flops`
    ];
  });
}
