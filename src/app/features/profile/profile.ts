import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { InputText } from 'primeng/inputtext';
import { AuthService, CurrentUser, ProfileChanges } from '../../core/services/auth.service';
import { Feedback } from '../../shared/ui/feedback';

interface ProfileForm {
  first_name: string;
  last_name: string;
  age: number | null;
  phone: string;
  bio: string;
  avatar_url: string;
}

/** Pantalla de perfil: ver y editar los datos del usuario, incluido el avatar por URL. */
@Component({
  selector: 'app-profile',
  imports: [FormsModule, InputText],
  templateUrl: './profile.html',
})
export class Profile implements OnInit {
  private auth = inject(AuthService);
  private feedback = inject(Feedback);

  readonly user = this.auth.currentUser;

  form = signal<ProfileForm>({ first_name: '', last_name: '', age: null, phone: '', bio: '', avatar_url: '' });
  loading = signal(true);
  saving = signal(false);
  avatarError = signal(false);
  /** El campo de URL del avatar arranca plegado para no borrarlo sin querer. */
  avatarFieldOpen = signal(false);

  /** Nombre a mostrar: nombre completo si lo hay, si no el usuario. */
  readonly displayName = computed(() => {
    const f = this.form();
    const full = `${f.first_name} ${f.last_name}`.trim();
    return full || this.user()?.username || '';
  });

  ngOnInit(): void {
    const current = this.user();
    if (current) {
      this.seed(current);
      this.loading.set(false);
    } else {
      this.auth.loadCurrentUser().subscribe({
        next: u => { this.seed(u); this.loading.set(false); },
        error: () => this.loading.set(false),
      });
    }
  }

  private seed(u: CurrentUser): void {
    this.form.set({
      first_name: u.first_name ?? '',
      last_name: u.last_name ?? '',
      age: u.age ?? null,
      phone: u.phone ?? '',
      bio: u.bio ?? '',
      avatar_url: u.avatar_url ?? '',
    });
  }

  update(changes: Partial<ProfileForm>): void {
    if ('avatar_url' in changes) this.avatarError.set(false);
    this.form.update(f => ({ ...f, ...changes }));
  }

  initials(): string {
    const f = this.form();
    const base = (f.first_name || this.user()?.username || '?').slice(0, 2);
    return base.toUpperCase();
  }

  save(): void {
    const f = this.form();
    const changes: ProfileChanges = {
      first_name: f.first_name.trim(),
      last_name: f.last_name.trim(),
      age: f.age,
      phone: f.phone.trim(),
      bio: f.bio.trim(),
      avatar_url: f.avatar_url.trim(),
    };
    this.saving.set(true);
    this.auth.updateProfile(changes).subscribe({
      next: () => {
        this.saving.set(false);
        this.feedback.success('Perfil actualizado');
      },
      error: err => {
        this.saving.set(false);
        this.feedback.error(err);
      },
    });
  }
}
