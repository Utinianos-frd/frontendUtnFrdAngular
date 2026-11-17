import { inject, Injectable } from '@angular/core';
import { ConfirmationService, MessageService } from 'primeng/api';
import { apiErrorMessage } from '../../core/services/api.service';

/**
 * Escapa el texto para que el ConfirmDialog (que renderiza `message` como HTML) muestre
 * datos del usuario — nombres de organizaciones, tareas, etc. — como texto literal y no
 * como marcado. Sin esto, un nombre como `<b>x</b>` o `<img src=x>` se interpretaría.
 */
export function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/** Atajos para mostrar toasts y pedir confirmaciones con PrimeNG. */
@Injectable({ providedIn: 'root' })
export class Feedback {
    private messages = inject(MessageService);
    private confirmation = inject(ConfirmationService);

    success(detail: string): void {
        this.messages.add({ severity: 'success', summary: 'Listo', detail, life: 3000 });
    }

    /** Muestra un error. Acepta un error de la API o un mensaje ya armado (string). */
    error(err: unknown): void {
        // Evita apilar errores idénticos cuando el usuario reintenta: limpia los toasts previos.
        this.messages.clear();
        const detail = typeof err === 'string' ? err : apiErrorMessage(err);
        this.messages.add({ severity: 'error', summary: 'Error', detail, life: 5000 });
    }

    warn(detail: string): void {
        this.messages.add({ severity: 'warn', summary: 'Atención', detail, life: 6000 });
    }

    info(detail: string): void {
        this.messages.add({ severity: 'info', summary: 'Modo Foco', detail, life: 4000 });
    }

    confirm(message: string, onAccept: () => void): void {
        this.confirmation.confirm({
            header: 'Confirmar',
            message: escapeHtml(message),
            icon: 'pi pi-question-circle',
            acceptLabel: 'Continuar',
            rejectLabel: 'Cancelar',
            rejectButtonProps: { severity: 'secondary', outlined: true },
            accept: onAccept,
        });
    }

    confirmDelete(message: string, onAccept: () => void): void {
        this.confirmation.confirm({
            header: 'Confirmar',
            message: escapeHtml(message),
            icon: 'pi pi-exclamation-triangle',
            acceptLabel: 'Eliminar',
            rejectLabel: 'Cancelar',
            acceptButtonProps: { severity: 'danger' },
            rejectButtonProps: { severity: 'secondary', outlined: true },
            accept: onAccept,
        });
    }
}
