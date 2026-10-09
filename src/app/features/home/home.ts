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
    { text: 'Diego Paz completó "Diseñar wireframes de onboarding"', time: 'Hace 12 min' },
    { text: 'Se desbloqueó la tarea "Prototipo interactivo"', time: 'Hace 12 min' },
    { text: 'Sol Aguirre se unió al grupo Infraestructura', time: 'Hace 1 h' },
    { text: 'Nueva dependencia agregada en "Migración API"', time: 'Hace 3 h' },
  ];

  readonly workloadMini = [
    { initials: 'MR', status: 'Disponible' },
    { initials: 'DP', status: 'Sobrecargado' },
    { initials: 'SA', status: 'Ocupado' },
  ];
}
