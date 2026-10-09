import { inject, Injectable } from '@angular/core';
import { ConfirmationService, MessageService } from 'primeng/api';
import { apiErrorMessage } from '../../core/services/api.service';

/** Atajos para mostrar toasts y pedir confirmaciones con PrimeNG. */
@Injectable({ providedIn: 'root' })
export class Feedback {
    private messages = inject(MessageService);
    private confirmation = inject(ConfirmationService);

    success(detail: string): void {
        this.messages.add({ severity: 'success', summary: 'Listo', detail, life: 3000 });
    }

    error(err: unknown): void {
        this.messages.add({ severity: 'error', summary: 'Error', detail: apiErrorMessage(err), life: 5000 });
    }

    confirm(message: string, onAccept: () => void): void {
        this.confirmation.confirm({
            header: 'Confirmar',
            message,
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
            message,
            icon: 'pi pi-exclamation-triangle',
            acceptLabel: 'Eliminar',
            rejectLabel: 'Cancelar',
            acceptButtonProps: { severity: 'danger' },
            rejectButtonProps: { severity: 'secondary', outlined: true },
            accept: onAccept,
        });
    }
}
