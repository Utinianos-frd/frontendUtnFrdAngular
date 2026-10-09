import { Component, computed, DestroyRef, effect, inject, OnInit, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';
import { AuthService } from '../../core/services/auth.service';

const THEME_KEY = 'theme';

/** Layout de las pantallas privadas: barra superior + contenido de la ruta. */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ToastModule, ConfirmDialogModule],
  templateUrl: './shell.html',
})
export class Shell implements OnInit {
  private authService = inject(AuthService);

  readonly tabs = [
    { path: '/home', label: 'Inicio' },
    { path: '/organizations', label: 'Organizaciones' },
  ];

  dark = signal(localStorage.getItem(THEME_KEY) === 'dark');
  username = computed(() => this.authService.currentUser()?.username ?? '');
  initials = computed(() => this.username().slice(0, 2).toUpperCase() || '?');

  constructor() {
    effect(() => {
      document.documentElement.classList.toggle('app-dark', this.dark());
      localStorage.setItem(THEME_KEY, this.dark() ? 'dark' : 'light');
    });
    // Al salir de las pantallas privadas (logout), el login vuelve al tema claro.
    inject(DestroyRef).onDestroy(() => document.documentElement.classList.remove('app-dark'));
  }

  ngOnInit(): void {
    this.authService.loadCurrentUser().subscribe({ error: () => {} });
  }

  toggleTheme(): void {
    this.dark.update(d => !d);
  }

  logout(): void {
    this.authService.logout();
  }
}
