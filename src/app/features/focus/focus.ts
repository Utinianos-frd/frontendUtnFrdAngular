import { Component, computed, effect, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ConfirmationService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';
import { interval, Subscription } from 'rxjs';
import { FocusSession, FocusSessionSummary, FocusTask, Pomodoro } from '../../core/models';
import { FocusSessionService } from '../../core/services/focus-session.service';
import { TaskPath, TasksService } from '../../core/services/tasks.service';
import { Feedback } from '../../shared/ui/feedback';
import { PluralPipe } from '../../shared/pipes/plural.pipe';

/** Pantalla de concentración: timer Pomodoro contra las tareas elegidas (RF-48/52/53). */
@Component({
  selector: 'app-focus',
  imports: [ToastModule, ConfirmDialogModule, PluralPipe],
  templateUrl: './focus.html',
})
export class Focus implements OnInit, OnDestroy {
  private focus = inject(FocusSessionService);
  private tasksService = inject(TasksService);
  private feedback = inject(Feedback);
  private confirmation = inject(ConfirmationService);
  private router = inject(Router);

  readonly session = this.focus.activeSession;
  readonly tasks = computed<FocusTask[]>(() => this.session()?.tasks ?? []);

  activeTaskId = signal<number | null>(null);
  pomodoro = signal<Pomodoro | null>(null);
  remaining = signal(0);          // segundos restantes del pomodoro
  busy = signal(false);

  // Overlays
  breakMinutes = signal<number | null>(null);
  breakRemaining = signal(0);     // segundos restantes del descanso
  consecutive = signal(0);
  summary = signal<FocusSessionSummary | null>(null);

  private tick?: Subscription;
  private endAt = 0;
  private breakTick?: Subscription;
  private breakEndAt = 0;
  private readonly baseTitle = typeof document !== 'undefined' ? document.title : 'Tasker';

  readonly running = computed(() => this.pomodoro()?.status === 'running');
  readonly paused = computed(() => this.pomodoro()?.status === 'paused');
  readonly activeTask = computed(() => this.tasks().find(t => t.id === this.activeTaskId()) ?? null);
  readonly allDone = computed(() => this.tasks().length > 0 && this.tasks().every(t => t.status === 'done'));
  readonly breakOver = computed(() => this.breakRemaining() <= 0);

  // Anillo de progreso (r = 130).
  readonly RING = 2 * Math.PI * 130;
  readonly ringOffset = computed(() => {
    const p = this.pomodoro();
    if (!p) return this.RING;
    const total = p.duration_minutes * 60;
    const frac = total ? this.remaining() / total : 0;
    return this.RING * (1 - frac);
  });

  constructor() {
    // Mientras corre el pomodoro, mostramos el tiempo en el título de la pestaña.
    effect(() => {
      if (typeof document === 'undefined') return;
      document.title = this.running() ? `${this.formatTime(this.remaining())} · ${this.baseTitle}` : this.baseTitle;
    });
  }

  ngOnInit(): void {
    if (this.session()) {
      this.initFromSession(this.session()!);
    } else {
      // Recarga directa en /focus: buscamos la sesión activa.
      this.focus.loadActive().subscribe(session => {
        if (session) this.initFromSession(session);
        else this.router.navigate(['/home']);
      });
    }
  }

  ngOnDestroy(): void {
    this.stopTimer();
    this.stopBreakTimer();
    if (typeof document !== 'undefined') document.title = this.baseTitle;
  }

  /** Al cargar la sesión: restaura el pomodoro en curso (si lo hay) o elige la primera tarea pendiente. */
  private initFromSession(session: FocusSession): void {
    const cp = session.current_pomodoro;
    if (cp) {
      this.pomodoro.set({
        id: String(cp.id), task_id: cp.task_id, status: cp.status,
        duration_minutes: cp.duration_minutes, started_at: cp.started_at,
        completed_at: null, remaining_seconds: cp.remaining_seconds,
      });
      this.remaining.set(cp.remaining_seconds);
      this.activeTaskId.set(cp.task_id);
      if (cp.status === 'running') {
        if (cp.remaining_seconds <= 0) this.completePomodoro();
        else this.startTimer();
      }
      // 'paused': se muestra pausado, sin arrancar el timer.
    } else {
      this.pickInitialTask();
    }
  }

  private pickInitialTask(): void {
    const next = this.tasks().find(t => t.status !== 'done');
    this.activeTaskId.set(next ? next.id : null);
  }

  isDone(task: FocusTask): boolean {
    return task.status === 'done';
  }

  selectTask(task: FocusTask): void {
    // No se cambia de tarea con un pomodoro en curso, ni se elige una ya completada.
    if (this.pomodoro() || this.isDone(task)) return;
    this.activeTaskId.set(task.id);
  }

  private taskPath(task: FocusTask): TaskPath {
    return { orgId: String(task.org_id), groupId: String(task.group_id), projectId: String(task.project_id) };
  }

  // ---- Timer local ----

  private startTimer(): void {
    this.endAt = Date.now() + this.remaining() * 1000;
    this.stopTimer();
    this.tick = interval(1000).subscribe(() => {
      const left = Math.max(0, Math.round((this.endAt - Date.now()) / 1000));
      this.remaining.set(left);
      if (left <= 0) {
        this.stopTimer();
        this.completePomodoro();
      }
    });
  }

  private stopTimer(): void {
    this.tick?.unsubscribe();
    this.tick = undefined;
  }

  formatTime(secs: number): string {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  /** Tiempo trabajado: "1 h 20 min" si pasa la hora, si no mm:ss. */
  formatWorked(secs: number): string {
    if (secs >= 3600) {
      const h = Math.floor(secs / 3600);
      const m = Math.floor((secs % 3600) / 60);
      return `${h} h ${m} min`;
    }
    return this.formatTime(secs);
  }

  // ---- Pomodoro ----

  startPomodoro(): void {
    const session = this.session();
    const taskId = this.activeTaskId();
    if (!session || taskId == null || this.busy()) return;

    // Pedimos permiso de notificaciones al iniciar el primer pomodoro, no al cargar la pantalla.
    this.ensureNotificationPermission();

    this.busy.set(true);
    this.focus.startPomodoro(session.id, taskId).subscribe({
      next: pomodoro => {
        this.pomodoro.set(pomodoro);
        this.remaining.set(pomodoro.duration_minutes * 60);
        this.startTimer();
        this.busy.set(false);
      },
      error: err => {
        this.busy.set(false);
        this.feedback.error(err);
      },
    });
  }

  pausePomodoro(): void {
    this.sendAction('pause');
  }

  resumePomodoro(): void {
    this.sendAction('resume');
  }

  cancelPomodoro(): void {
    this.sendAction('cancel');
  }

  private completePomodoro(): void {
    const session = this.session();
    const pomodoro = this.pomodoro();
    if (!session || !pomodoro) return;

    this.busy.set(true);
    this.focus.pomodoroAction(session.id, pomodoro.id, 'complete').subscribe({
      next: ({ meta }) => {
        this.pomodoro.set(null);
        this.remaining.set(0);
        this.busy.set(false);
        this.notifyPomodoroDone();
        this.consecutive.set(Number(meta?.['consecutive_completed'] ?? 0));
        this.startBreak(Number(meta?.['suggested_break_minutes'] ?? 5));
      },
      error: err => {
        this.busy.set(false);
        // p. ej. 409 "El pomodoro todavía no terminó": mantenemos el pomodoro (no rompemos el estado),
        // así el usuario puede pausarlo o cancelarlo.
        this.feedback.error(err);
      },
    });
  }

  private sendAction(action: 'pause' | 'resume' | 'cancel'): void {
    const session = this.session();
    const pomodoro = this.pomodoro();
    if (!session || !pomodoro || this.busy()) return;

    if (action === 'cancel') this.stopTimer();
    this.busy.set(true);
    this.focus.pomodoroAction(session.id, pomodoro.id, action).subscribe({
      next: ({ data }) => {
        this.busy.set(false);
        if (action === 'cancel') {
          this.stopTimer();
          this.pomodoro.set(null);
          this.remaining.set(0);
          return;
        }
        this.pomodoro.set(data);
        // Sincronizamos el tiempo restante con el que recalcula el backend.
        if (data.remaining_seconds != null) this.remaining.set(data.remaining_seconds);
        if (action === 'pause') this.stopTimer();
        else this.startTimer(); // resume
      },
      error: err => {
        this.busy.set(false);
        this.feedback.error(err);
      },
    });
  }

  // ---- Aviso y descanso ----

  private notifyPomodoroDone(): void {
    try {
      const audio = new Audio('assets/sounds/pomodoro-done.wav');
      audio.play().catch(() => { /* el navegador puede bloquear el autoplay */ });
    } catch { /* ignore */ }
    try {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('¡Pomodoro completado!', { body: 'Tomate un descanso.' });
      }
    } catch { /* ignore */ }
  }

  private ensureNotificationPermission(): void {
    try {
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
      }
    } catch { /* ignore */ }
  }

  private startBreak(mins: number): void {
    this.breakMinutes.set(mins);
    this.breakRemaining.set(mins * 60);
    this.breakEndAt = Date.now() + mins * 60 * 1000;
    this.stopBreakTimer();
    this.breakTick = interval(1000).subscribe(() => {
      const left = Math.max(0, Math.round((this.breakEndAt - Date.now()) / 1000));
      this.breakRemaining.set(left);
      if (left <= 0) this.stopBreakTimer();
    });
  }

  private stopBreakTimer(): void {
    this.breakTick?.unsubscribe();
    this.breakTick = undefined;
  }

  dismissBreak(): void {
    this.stopBreakTimer();
    this.breakMinutes.set(null);
    this.breakRemaining.set(0);
  }

  /** "Empezar otro pomodoro": cierra el descanso y arranca uno nuevo (solo al terminar el descanso). */
  startAnotherPomodoro(): void {
    this.dismissBreak();
    this.startPomodoro();
  }

  // ---- Tareas ----

  completeTask(task: FocusTask): void {
    if (this.isDone(task) || this.busy()) return;
    this.busy.set(true);
    this.tasksService.update(this.taskPath(task), String(task.id), { status: 'done' }).subscribe({
      next: () => {
        this.busy.set(false);
        this.focus.markTaskDone(task.id);
        this.feedback.success(`"${task.title}" completada`);
        this.afterTaskCompleted(task);
      },
      error: err => {
        this.busy.set(false);
        this.feedback.error(err); // p. ej. 409 si está bloqueada o ya estaba completada
      },
    });
  }

  /** Tras completar una tarea: pasa a la próxima pendiente; si había un pomodoro sobre ella, pregunta. */
  private afterTaskCompleted(task: FocusTask): void {
    const p = this.pomodoro();
    const pomodoroOnTask = p != null && p.task_id === task.id && (this.running() || this.paused());

    if (pomodoroOnTask) {
      this.confirmation.confirm({
        header: 'Tarea completada',
        message: '¿Seguir el pomodoro con la próxima tarea o cancelarlo?',
        icon: 'pi pi-question-circle',
        acceptLabel: 'Seguir con la próxima',
        rejectLabel: 'Cancelar pomodoro',
        rejectButtonProps: { severity: 'secondary', outlined: true },
        accept: () => this.goToNextTask(),
        reject: () => this.cancelPomodoro(),
      });
    } else if (this.activeTaskId() === task.id) {
      this.goToNextTask();
    }
  }

  /**
   * Pasa a la próxima tarea pendiente. Si hay un pomodoro en curso, lo mueve a esa tarea en el
   * backend (switch_task) y actualiza la tarea con la respuesta; si falla, no cambia la tarea actual.
   * Si no queda ninguna pendiente, deja la selección vacía.
   */
  private goToNextTask(): void {
    const next = this.tasks().find(t => t.status !== 'done');
    const nextId = next ? next.id : null;
    const session = this.session();
    const pomodoro = this.pomodoro();

    if (nextId != null && session && pomodoro && (this.running() || this.paused())) {
      this.busy.set(true);
      this.focus.switchPomodoroTask(session.id, pomodoro.id, nextId).subscribe({
        next: ({ data }) => {
          this.pomodoro.set(data);
          if (data.remaining_seconds != null) this.remaining.set(data.remaining_seconds);
          this.activeTaskId.set(data.task_id);
          this.busy.set(false);
        },
        error: err => {
          this.busy.set(false);
          this.feedback.error(err); // no cambiamos la tarea actual si el backend lo rechaza
        },
      });
      return;
    }

    this.activeTaskId.set(nextId);
  }

  // ---- Terminar sesión ----

  endSession(): void {
    const session = this.session();
    if (!session || this.busy()) return;
    this.stopTimer();
    this.stopBreakTimer();
    this.busy.set(true);
    this.focus.end(session.id).subscribe({
      next: summary => {
        this.summary.set(summary);
        this.pomodoro.set(null);
        this.breakMinutes.set(null);
        this.busy.set(false);
      },
      error: err => {
        this.busy.set(false);
        this.feedback.error(err);
      },
    });
  }

  leave(): void {
    this.summary.set(null);
    this.router.navigate(['/home']);
  }
}
