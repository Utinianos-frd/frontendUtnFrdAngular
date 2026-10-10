import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { routes } from './app.routes';
import { providePrimeNG } from 'primeng/config';
import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';

// Escala de acento del design system "Nocturne" (ver src/styles.css).
const NocturnePreset = definePreset(Aura, {
  semantic: {
    primary: {
      50:  '#f9f9ff',
      100: '#f5f4ff',
      200: '#e7e5fe',
      300: '#d2cefd',
      400: '#b5abfc',
      500: '#968ae0',
      600: '#796cbf',
      700: '#5d5294',
      800: '#423a6a',
      900: '#2b2741',
      950: '#1b1830',
    },
  },
});

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
    providePrimeNG({
      theme: {
        preset: NocturnePreset,
        options: {
          darkModeSelector: '.app-dark',
        },
      },
    }),
    MessageService,
    ConfirmationService,
  ],
};
