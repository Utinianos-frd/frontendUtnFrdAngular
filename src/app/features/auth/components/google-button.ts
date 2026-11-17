import {
  AfterViewInit,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { GOOGLE_CLIENT_ID } from '../../../core/config';

/** Tipos mínimos de Google Identity Services (window.google.accounts.id). */
interface GoogleCredentialResponse {
  credential: string;
}
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize(config: {
            client_id: string;
            callback: (response: GoogleCredentialResponse) => void;
          }): void;
          renderButton(parent: HTMLElement, options: Record<string, unknown>): void;
        };
      };
    };
    onGoogleLibraryLoad?: () => void;
  }
}

const GSI_SRC = 'https://accounts.google.com/gsi/client';
let gsiLoader: Promise<void> | null = null;

/** Carga el script de Google Identity Services una sola vez para toda la app. */
function loadGoogleIdentity(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (gsiLoader) return gsiLoader;

  gsiLoader = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GSI_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      gsiLoader = null;
      reject(new Error('No se pudo cargar Google Identity Services'));
    };
    document.head.appendChild(script);
  });
  return gsiLoader;
}

/**
 * Botón oficial "Iniciar sesión con Google". Carga Google Identity Services, lo inicializa
 * con el GOOGLE_CLIENT_ID y, al elegir una cuenta, emite el ID token por (credential).
 * Si no hay client id configurado, muestra un botón deshabilitado con una nota.
 */
@Component({
  selector: 'app-google-button',
  standalone: true,
  template: `
    @if (configured) {
      <div #target class="flex justify-center"></div>
    } @else {
      <button
        type="button"
        disabled
        class="w-full flex items-center justify-center gap-3 rounded-lg border border-[var(--surface-border,#3a3c4e)] px-4 py-3 opacity-60 cursor-not-allowed"
        title="Falta configurar GOOGLE_CLIENT_ID">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" class="w-5 h-5 shrink-0">
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
        </svg>
        <span class="font-medium">Continuar con Google</span>
      </button>
    }
    @if (loadError()) {
      <small class="text-red-500 block text-center mt-2">{{ loadError() }}</small>
    }
  `,
})
export class GoogleButton implements AfterViewInit, OnDestroy {
  private zone = inject(NgZone);
  private host = inject(ElementRef<HTMLElement>);

  /** Texto del botón de Google: 'signin_with' | 'signup_with' | 'continue_with'. */
  text = input<'signin_with' | 'signup_with' | 'continue_with'>('continue_with');

  /** Emite el ID token (JWT) que Google devuelve al elegir una cuenta. */
  credential = output<string>();

  readonly configured = !!GOOGLE_CLIENT_ID;
  readonly loadError = signal<string | null>(null);

  private target = viewChild<ElementRef<HTMLElement>>('target');
  private resizeObserver?: ResizeObserver;

  async ngAfterViewInit(): Promise<void> {
    if (!this.configured) return;

    try {
      await loadGoogleIdentity();
    } catch (e) {
      this.zone.run(() => this.loadError.set((e as Error).message));
      return;
    }

    const id = window.google!.accounts.id;
    id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      // El callback de Google corre fuera de la zona de Angular: lo reentramos.
      callback: (res: GoogleCredentialResponse) =>
        this.zone.run(() => this.credential.emit(res.credential)),
    });

    this.renderButton();

    // Google pide un ancho fijo en px: lo seguimos al del contenedor.
    this.resizeObserver = new ResizeObserver(() => this.renderButton());
    this.resizeObserver.observe(this.host.nativeElement);
  }

  private renderButton(): void {
    const el = this.target()?.nativeElement;
    if (!el || !window.google?.accounts?.id) return;

    const width = Math.min(400, Math.max(200, Math.floor(this.host.nativeElement.offsetWidth) || 320));
    el.replaceChildren();
    window.google.accounts.id.renderButton(el, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: this.text(),
      shape: 'rectangular',
      logo_alignment: 'left',
      width,
    });
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }
}
