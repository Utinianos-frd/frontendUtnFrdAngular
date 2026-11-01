import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Dashboard, WorkloadStatus } from '../../core/models';
import { DashboardService } from '../../core/services/dashboard.service';
import { Feedback } from '../../shared/ui/feedback';

/** Pantalla "Inicio": panel con datos reales del usuario (GET /dashboard). */
@Component({
  selector: 'app-home',
  imports: [RouterLink],
  templateUrl: './home.html',
})
export class Home implements OnInit {
  private dashboardService = inject(DashboardService);
  private feedback = inject(Feedback);

  dashboard = signal<Dashboard | null>(null);
  loading = signal(true);

  readonly planLabel = computed(() => (this.dashboard()?.plan === 'pro' ? 'Pro' : 'Free'));

  ngOnInit(): void {
    this.dashboardService.get().subscribe({
      next: data => {
        this.dashboard.set(data);
        this.loading.set(false);
      },
      error: err => {
        this.loading.set(false);
        this.feedback.error(err);
      },
    });
  }

  /** Color de severidad para la etiqueta de carga de cada grupo. */
  loadColor(load: string): string {
    if (load === 'Alta') return '#f85149';
    if (load === 'Media') return '#d29922';
    return '#3fb950';
  }

  /** Altura de la barra del mini-gráfico de carga del equipo, según estado. */
  barHeight(status: WorkloadStatus): string {
    if (status === 'overloaded') return '58px';
    if (status === 'busy') return '40px';
    return '22px';
  }

  barColor(status: WorkloadStatus): string {
    if (status === 'overloaded') return '#f85149';
    if (status === 'busy') return '#d29922';
    return '#3fb950';
  }

  /** "Hace X" a partir de un ISO. */
  relativeTime(iso: string): string {
    const then = new Date(iso).getTime();
    if (isNaN(then)) return '';
    const secs = Math.max(0, Math.round((Date.now() - then) / 1000));
    if (secs < 60) return 'Recién';
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `Hace ${mins} min`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `Hace ${hrs} h`;
    const days = Math.floor(hrs / 24);
    return days === 1 ? 'Ayer' : `Hace ${days} días`;
  }
}
