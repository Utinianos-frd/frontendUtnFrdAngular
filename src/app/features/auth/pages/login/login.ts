import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PRIMENG_MODULES } from '../../../../shared/primeng/primeng';
import { AuthService } from '../../../../core/services/auth.service';
import { GoogleButton } from '../../components/google-button';

@Component({
  selector: 'app-login',
  imports: [PRIMENG_MODULES, ReactiveFormsModule, RouterLink, GoogleButton],
  templateUrl: './login.html',
  styles: ``,
})
export class Login {
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  loading = signal(false);
  errorMessage = signal<string | null>(null);

  form = inject(FormBuilder).nonNullable.group({
    username: ['', Validators.required],
    password: ['', Validators.required],
  });

  /** A dónde ir tras loguearse: la ruta protegida que se intentó abrir, o /home. */
  private target(): string {
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    // Solo rutas internas: debe empezar con "/" y no con "//" (evita open redirects).
    return returnUrl && returnUrl.startsWith('/') && !returnUrl.startsWith('//') ? returnUrl : '/home';
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    const { username, password } = this.form.getRawValue();
    this.authService.login(username, password).subscribe({
      next: () => this.router.navigateByUrl(this.target()),
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.errorMessage.set(
          err.error?.errors?.[0]?.detail ??
          (err.status === 0 ? 'No se pudo conectar con el servidor' : 'Error al iniciar sesión')
        );
      },
    });
  }

  /** Callback del botón de Google: cambia el ID token por una sesión JWT. */
  onGoogleCredential(idToken: string): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.authService.loginWithGoogle(idToken).subscribe({
      next: () => this.router.navigateByUrl(this.target()),
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.errorMessage.set(
          err.error?.errors?.[0]?.detail ??
          (err.status === 0 ? 'No se pudo conectar con el servidor' : 'No se pudo iniciar sesión con Google')
        );
      },
    });
  }
}
