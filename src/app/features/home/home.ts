import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';

type Tab = 'inicio' | 'tablero' | 'workload' | 'organizacion';

interface Group {
  name: string;
  lead: string;
  members: number;
  projects: number;
  load: string;
}

@Component({
  selector: 'app-home',
  imports: [],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home implements OnInit {
  private authService = inject(AuthService);

  readonly tabs: { id: Tab; label: string }[] = [
    { id: 'inicio', label: 'Inicio' },
    { id: 'tablero', label: 'Tablero' },
    { id: 'workload', label: 'Workload' },
    { id: 'organizacion', label: 'Organización' },
  ];

  activeTab = signal<Tab>('inicio');
  dark = signal(false);
  username = signal('');

  initials = computed(() => this.username().slice(0, 2).toUpperCase() || '?');

  // Datos de ejemplo hasta que existan los endpoints correspondientes.
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

  ngOnInit(): void {
    this.authService.me().subscribe({
      next: res => {
        const attrs = res?.data?.attributes ?? res?.data ?? res ?? {};
        this.username.set(attrs.username ?? attrs.first_name ?? '');
      },
      error: () => this.username.set(''),
    });
  }

  toggleTheme(): void {
    this.dark.update(d => !d);
  }

  logout(): void {
    this.authService.logout();
  }
}
