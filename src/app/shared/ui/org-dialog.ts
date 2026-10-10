import { Component, effect, input, model, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';

export interface OrgDialogResult {
  name: string;
  logoUrl: string;
}

/**
 * Diálogo para crear/editar una organización: nombre + URL del logo,
 * con previsualización en vivo de la imagen.
 */
@Component({
  selector: 'app-org-dialog',
  imports: [DialogModule, InputText, FormsModule],
  template: `
    <p-dialog [header]="header()" [(visible)]="visible" [modal]="true" [style]="{ width: '26rem' }" [draggable]="false">
      <form (ngSubmit)="submit()" class="flex flex-col gap-4">
        <div class="flex flex-col gap-1">
          <label for="org-dialog-name" class="text-sm font-medium">Nombre</label>
          <input pInputText id="org-dialog-name" name="name" [(ngModel)]="name" placeholder="Ej: NORTE Studio"
            autocomplete="off" class="w-full" />
        </div>

        <div class="flex flex-col gap-1">
          <label for="org-dialog-logo" class="text-sm font-medium">URL del logo <span class="subtext font-normal">(opcional)</span></label>
          <input pInputText id="org-dialog-logo" name="logoUrl" type="url" [(ngModel)]="logoUrl"
            placeholder="https://…/logo.png" autocomplete="off" class="w-full" />
        </div>

        <!-- Previsualización -->
        <div class="flex items-center gap-3 p-3 rounded-[8px]" style="background: color-mix(in srgb, var(--text) 3%, transparent)">
          <div class="w-12 h-12 rounded-[10px] flex items-center justify-center flex-none overflow-hidden"
            style="background: var(--color-accent-900); color: var(--color-accent-300)">
            @if (logoUrl().trim() && !imageError()) {
              <img [src]="logoUrl().trim()" alt="Logo" class="w-full h-full object-cover" (error)="imageError.set(true)" />
            } @else {
              <span class="text-base font-medium">{{ (name().trim().slice(0, 1) || '?').toUpperCase() }}</span>
            }
          </div>
          <div class="text-xs text-muted min-w-0">
            @if (logoUrl().trim() && imageError()) {
              <span style="color: #f85149">No se pudo cargar la imagen desde esa URL.</span>
            } @else {
              Vista previa del logo
            }
          </div>
        </div>

        <div class="flex justify-end gap-2">
          <button type="button" class="btn btn-ghost" (click)="visible.set(false)">Cancelar</button>
          <button type="submit" class="btn btn-primary" [disabled]="!name().trim() || saving()">
            @if (saving()) { <i class="pi pi-spin pi-spinner"></i> }
            Guardar
          </button>
        </div>
      </form>
    </p-dialog>
  `,
})
export class OrgDialog {
  visible = model(false);
  header = input('Nueva organización');
  initialName = input('');
  initialLogoUrl = input('');
  saving = input(false);

  save = output<OrgDialogResult>();

  name = signal('');
  logoUrl = signal('');
  imageError = signal(false);

  constructor() {
    // Cada vez que se abre, carga los valores iniciales.
    effect(() => {
      if (this.visible()) {
        this.name.set(this.initialName());
        this.logoUrl.set(this.initialLogoUrl());
        this.imageError.set(false);
      }
    });
    // Al cambiar la URL, vuelve a intentar cargar la imagen.
    effect(() => {
      this.logoUrl();
      this.imageError.set(false);
    });
  }

  submit(): void {
    const name = this.name().trim();
    if (name) this.save.emit({ name, logoUrl: this.logoUrl().trim() });
  }
}
