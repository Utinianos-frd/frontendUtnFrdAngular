import { Component, effect, input, model, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';

/**
 * Diálogo con un solo campo de texto. Se usa para crear/editar
 * organizaciones, grupos, proyectos y tareas (todos tienen un "nombre").
 */
@Component({
  selector: 'app-name-dialog',
  imports: [DialogModule, InputText, FormsModule],
  template: `
    <p-dialog [header]="header()" [(visible)]="visible" [modal]="true" [style]="{ width: '24rem' }" [draggable]="false">
      <form (ngSubmit)="submit()" class="flex flex-col gap-4">
        <div class="flex flex-col gap-1">
          <label for="name-dialog-input" class="text-sm font-medium">{{ label() }}</label>
          <input pInputText id="name-dialog-input" name="name" [(ngModel)]="value" [placeholder]="placeholder()"
            autocomplete="off" class="w-full" />
        </div>
        <div class="flex justify-end gap-2">
          <button type="button" class="btn btn-ghost" (click)="visible.set(false)">Cancelar</button>
          <button type="submit" class="btn btn-primary" [disabled]="!value().trim() || saving()">
            @if (saving()) { <i class="pi pi-spin pi-spinner"></i> }
            Guardar
          </button>
        </div>
      </form>
    </p-dialog>
  `,
})
export class NameDialog {
  visible = model(false);
  header = input('Nuevo');
  label = input('Nombre');
  placeholder = input('');
  /** Valor inicial al abrir el diálogo (vacío para crear, el nombre actual para editar). */
  initialValue = input('');
  saving = input(false);

  save = output<string>();

  value = signal('');

  constructor() {
    // Cada vez que se abre, carga el valor inicial.
    effect(() => {
      if (this.visible()) this.value.set(this.initialValue());
    });
  }

  submit(): void {
    const name = this.value().trim();
    if (name) this.save.emit(name);
  }
}
