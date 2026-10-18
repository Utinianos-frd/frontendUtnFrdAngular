import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { interval, Subscription } from 'rxjs';
import { FocusSessionSummary, Pomodoro } from '../../core/models';
import { FocusSessionService, FocusTaskRef } from '../../core/services/focus-session.service';
import { TasksService } from '../../core/services/tasks.service';
import { Feedback } from '../../shared/ui/feedback';

/** Pantalla de concentración: timer Pomodoro contra las tareas elegidas (RF-48/52/53). */
@Component({
  selector: 'app-focus',
  imports: [],
  templateUrl: './focus.html',
})
export class Focus implements OnInit, OnDestroy {
  private focus = inject(FocusSessionService);
  private tasksService = inject(TasksService);
  private feedback = inject(Feedback);
  private router = inject(Router);

  readonly session = this.focus.activeSession;
  readonly refs = this.focus.taskRefs;

  activeTaskId = signal<number | null>(null);
  pomodoro = signal<Pomodoro | null>(null);
  remaining = signal(0);          // segundos restantes del pomodoro
  busy = signal(false);

  // Overlays
  breakMinutes = signal<number | null>(null);
  consecutive = signal(0);
  summary = signal<FocusSessionSummary | null>(null);

  private tick?: Subscription;
  private endAt = 0;

  readonly running = computed(() => this.pomodoro()?.status === 'running');
  readonly paused = computed(() => this.pomodoro()?.status === 'paused');
  readonly activeRef = computed(() => this.refs().find(r => r.id === this.activeTaskId()) ?? null);
  readonly allDone = computed(() => this.refs().length > 0 && this.refs().every(r => r.done));

  // Anillo de progreso (r = 130).
  readonly RING = 2 * Math.PI * 130;
  readonly ringOffset = computed(() => {
    const p = this.pomodoro();
    if (!p) return this.RING;
    const total = p.duration_minutes * 60;
    const frac = total ? this.remaining() / total : 0;
    return this.RING * (1 - frac);
  });

  ngOnInit(): void {
    if (this.session()) {
      this.pickInitialTask();
    } else {
      // Recarga directa en /focus: buscamos la sesión activa.
      this.focus.loadActive().subscribe(session => {
        if (session) this.pickInitialTask();
        else this.router.navigate(['/home']);
      });
    }
  }

  ngOnDestroy(): void {
    this.stopTimer();
  }

  private pickInitialTask(): void {
    const pending = this.refs().find(r => !r.done) ?? this.refs()[0];
    this.activeTaskId.set(pending ? pending.id : null);
  }

  selectTask(ref: FocusTaskRef): void {
    // No se cambia de tarea con un pomodoro en curso.
    if (this.pomodoro()) return;
    this.activeTaskId.set(ref.id);
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

  // ---- Pomodoro ----

  startPomodoro(): void {
    const session = this.session();
    const taskId = this.activeTaskId();
    if (!session || taskId == null || this.busy()) return;

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
    this.sendAction('pause', () => this.stopTimer());
  }

  resumePomodoro(): void {
    this.sendAction('resume', () => this.startTimer());
  }

  cancelPomodoro(): void {
    this.stopTimer();
    this.sendAction('cancel', () => {
      this.pomodoro.set(null);
      this.remaining.set(0);
    });
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
        this.breakMinutes.set(Number(meta?.['suggested_break_minutes'] ?? 5));
        this.consecutive.set(Number(meta?.['consecutive_completed'] ?? 0));
      },
      error: err => {
        this.busy.set(false);
        this.feedback.error(err);
      },
    });
  }

  private sendAction(action: 'pause' | 'resume' | 'cancel', onOk: () => void): void {
    const session = this.session();
    const pomodoro = this.pomodoro();
    if (!session || !pomodoro || this.busy()) return;

    this.busy.set(true);
    this.focus.pomodoroAction(session.id, pomodoro.id, action).subscribe({
      next: ({ data }) => {
        this.pomodoro.set(action === 'cancel' ? null : data);
        onOk();
        this.busy.set(false);
      },
      error: err => {
        this.busy.set(false);
        this.feedback.error(err);
      },
    });
  }

  dismissBreak(): void {
    this.breakMinutes.set(null);
  }

  // ---- Tareas ----

  completeTask(ref: FocusTaskRef): void {
    if (ref.done || !ref.orgId) return;
    this.busy.set(true);
    this.tasksService.update(
      { orgId: ref.orgId, groupId: ref.groupId, projectId: ref.projectId },
      String(ref.id),
      { status: 'done' },
    ).subscribe({
      next: () => {
        this.focus.markTaskDone(ref.id);
        this.busy.set(false);
        this.feedback.success(`"${ref.title}" completada`);
      },
      error: err => {
        this.busy.set(false);
        this.feedback.error(err); // p. ej. 409 si está bloqueada por una dependencia
      },
    });
  }

  // ---- Terminar sesión ----

  endSession(): void {
    const session = this.session();
    if (!session || this.busy()) return;
    this.stopTimer();
    this.busy.set(true);
    this.focus.end(session.id).subscribe({
      next: summary => {
        this.summary.set(summary);
        this.pomodoro.set(null);
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
