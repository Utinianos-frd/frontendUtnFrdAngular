import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

interface Group {
  name: string;
  lead: string;
  members: number;
  projects: number;
  load: string;
}

/** Pantalla "Inicio". Por ahora muestra datos de ejemplo del diseño. */
@Component({
  selector: 'app-home',
  imports: [RouterLink],
  templateUrl: './home.html',
})
export class Home {
  readonly planTier = 'Pro';

  readonly groups: Group[] = [
    { name: 'Producto', lead: 'Manuel Ruiz', members: 8, projects: 3, load: 'Alta' },
    { name: 'Diseño', lead: 'Diego Paz', members: 5, projects: 2, load: 'Media' },
    { name: 'Infraestructura', lead: 'Sol Aguirre', members: 4, projects: 1, load: 'Baja' },
  ];

  readonly activity = [
    { icon: 'pi-check', text: 'Diego Paz completó "Diseñar wireframes de onboarding"', time: 'Hace 12 min' },
    { icon: 'pi-lock-open', text: 'Se desbloqueó la tarea "Prototipo interactivo"', time: 'Hace 12 min' },
    { icon: 'pi-user-plus', text: 'Sol Aguirre se unió al grupo Infraestructura', time: 'Hace 1 h' },
    { icon: 'pi-sitemap', text: 'Nueva dependencia agregada en "Migración API"', time: 'Hace 3 h' },
  ];

  // barHeight/barColor son solo para el mini-gráfico de ejemplo del dashboard.
  readonly workloadMini = [
    { initials: 'MR', status: 'Disponible', barHeight: '22px', barColor: '#3fb950' },
    { initials: 'DP', status: 'Sobrecargado', barHeight: '58px', barColor: '#f85149' },
    { initials: 'SA', status: 'Ocupado', barHeight: '40px', barColor: '#d29922' },
  ];

  /** Color de severidad para la etiqueta de carga de cada grupo. */
  loadColor(load: string): string {
    if (load === 'Alta') return '#f85149';
    if (load === 'Media') return '#d29922';
    return '#3fb950';
  }
}
