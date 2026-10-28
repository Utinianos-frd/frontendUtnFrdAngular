import { Component, computed, effect, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';
import { AuthService } from '../../core/services/auth.service';
import { FocusSessionService } from '../../core/services/focus-session.service';

const THEME_KEY = 'theme';

/** Layout de las pantallas privadas: barra superior + contenido de la ruta. */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ToastModule, ConfirmDialogModule],
  templateUrl: './shell.html',
})
export class Shell implements OnInit {
  private authService = inject(AuthService);
  private focus = inject(FocusSessionService);
  private router = inject(Router);

  readonly tabs = [
    { path: '/home', label: 'Inicio', icon: 'pi-th-large' },
    { path: '/organizations', label: 'Organizaciones', icon: 'pi-building' },
    { path: '/workload', label: 'Workload', icon: 'pi-chart-bar' },
  ];

  username = computed(() => this.authService.currentUser()?.username ?? '');
  initials = computed(() => this.username().slice(0, 2).toUpperCase() || '?');

  // Tema: oscuro por defecto. La clase .app-dark se aplica también en index.html
  // antes de renderizar; acá la mantenemos sincronizada con la preferencia guardada.
  dark = signal(localStorage.getItem(THEME_KEY) !== 'light');

  /** Fecha de hoy en español, p. ej. "Vie 10 oct". */
  readonly todayLabel = new Intl.DateTimeFormat('es-AR', {
    weekday: 'short', day: 'numeric', month: 'short',
  }).format(new Date()).replace('.', '');

  constructor() {
    effect(() => {
      document.documentElement.classList.toggle('app-dark', this.dark());
      localStorage.setItem(THEME_KEY, this.dark() ? 'dark' : 'light');
    });
  }

  toggleTheme(): void {
    this.dark.update(d => !d);
  }

  ngOnInit(): void {
    this.authService.loadCurrentUser().subscribe({ error: () => {} });
    // Si hay una sesión de Modo Foco activa (p. ej. tras recargar), volvemos a ella.
    this.focus.loadActive().subscribe(session => {
      if (session) this.router.navigate(['/focus']);
    });
  }

  logout(): void {
    this.authService.logout();
  }
}
