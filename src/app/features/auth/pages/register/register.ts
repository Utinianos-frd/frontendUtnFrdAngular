import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { PRIMENG_MODULES } from '../../../../shared/primeng/primeng';
import { AuthService } from '../../../../core/services/auth.service';

type Field = 'username' | 'email' | 'password';

/** Valida que "password" y "confirm" coincidan. */
function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const { password, confirm } = group.value;
  return password && confirm && password !== confirm ? { mismatch: true } : null;
}

@Component({
  selector: 'app-register',
  imports: [PRIMENG_MODULES, ReactiveFormsModule, RouterLink],
  templateUrl: './register.html',
})
export class Register {
  private authService = inject(AuthService);
  private router = inject(Router);

  loading = signal(false);
  /** Error general (sin campo asociado), por ejemplo "sin conexión". */
  errorMessage = signal<string | null>(null);
  /** Errores que devuelve el backend para cada campo. */
  serverErrors = signal<Partial<Record<Field, string>>>({});

  form = inject(FormBuilder).nonNullable.group(
    {
      username: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirm: ['', Validators.required],
    },
    { validators: passwordsMatch }
  );

  constructor() {
    // Al editar un campo, se borra el error del backend de ese campo.
    for (const field of ['username', 'email', 'password'] as Field[]) {
      this.form.controls[field].valueChanges.subscribe(() =>
        this.serverErrors.update(errors => ({ ...errors, [field]: undefined }))
      );
    }
  }

  showError(field: 'username' | 'email' | 'password' | 'confirm'): boolean {
    const control = this.form.controls[field];
    return control.touched && control.invalid;
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);
    this.serverErrors.set({});

    const { username, email, password } = this.form.getRawValue();
    this.authService.register(username.trim(), email.trim(), password).subscribe({
      next: () => this.router.navigate(['/organizations']),
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.handleError(err);
      },
    });
  }

  private handleError(err: HttpErrorResponse): void {
    if (err.status === 0) {
      this.errorMessage.set('No se pudo conectar con el servidor');
      return;
    }

    const errors: { detail: string; source?: { pointer?: string } }[] = err.error?.errors ?? [];
    const byField: Partial<Record<Field, string>> = {};
    const general: string[] = [];

    for (const e of errors) {
      // Los duplicados (409) no traen "pointer": deducimos el campo por el mensaje.
      const field = (e.source?.pointer?.split('/').pop() ??
        (/username/i.test(e.detail) ? 'username' : /email/i.test(e.detail) ? 'email' : undefined)) as Field | undefined;
      if (field && ['username', 'email', 'password'].includes(field)) {
        byField[field] = translate(e.detail);
      } else {
        general.push(translate(e.detail));
      }
    }

    this.serverErrors.set(byField);
    if (general.length) this.errorMessage.set(general.join(' '));
    else if (!errors.length) this.errorMessage.set('No se pudo crear la cuenta');
  }
}

/** El backend devuelve algunos mensajes de validación de Django en inglés. */
function translate(detail: string): string {
  const known: Record<string, string> = {
    'This field is required.': 'Este campo es obligatorio.',
    'Enter a valid email address.': 'Ingresá un email válido.',
    'Ensure this field has at least 8 characters.': 'Debe tener al menos 8 caracteres.',
    'A user with that username already exists.': 'Ya existe un usuario con ese nombre.',
  };
  return known[detail] ?? detail;
}
