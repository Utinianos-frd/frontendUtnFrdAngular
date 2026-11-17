import { inject, Injectable, signal } from '@angular/core';
import { catchError, Observable, of, tap } from 'rxjs';
import { FocusSession, FocusSessionSummary, FocusTask, Pomodoro } from '../models';
import { ApiResult, ApiService } from './api.service';

export type PomodoroAction = 'pause' | 'resume' | 'cancel' | 'complete';

const BASE = 'focus-sessions';

/**
 * Estado de la sesión de Modo Foco activa. Todo (la sesión, sus tareas y el pomodoro en curso)
 * vive en el backend y llega en la propia sesión, así funciona en cualquier dispositivo y
 * sobrevive recargas sin depender de localStorage.
 */
@Injectable({ providedIn: 'root' })
export class FocusSessionService {
  private api = inject(ApiService);

  readonly activeSession = signal<FocusSession | null>(null);

  constructor() {
    // Limpieza: las versiones viejas cacheaban las tareas en localStorage (focus_refs_*). Ya no se usa.
    this.removeLegacyRefs();
  }

  /** Tareas de la sesión activa, en el orden que manda el backend. */
  tasks(): FocusTask[] {
    return this.activeSession()?.tasks ?? [];
  }

  /**
   * Consulta la sesión activa. El backend devuelve `data: null` (200) cuando no hay ninguna;
   * también toleramos un error (p. ej. 404 de versiones anteriores) como "sin sesión".
   */
  loadActive(): Observable<FocusSession | null> {
    return this.api.getNullable<FocusSession>(`${BASE}/active`).pipe(
      tap(session => this.activeSession.set(session)),
      catchError(() => {
        this.activeSession.set(null);
        return of(null);
      }),
    );
  }

  start(goalText: string, taskIds: number[]): Observable<FocusSession> {
    return this.api.create<FocusSession>(`${BASE}/`, 'focus_sessions', {
      goal_text: goalText,
      task_ids: taskIds,
    }).pipe(
      tap(session => this.activeSession.set(session)),
    );
  }

  end(sessionId: string): Observable<FocusSessionSummary> {
    return this.api.postData<FocusSessionSummary>(`${BASE}/${sessionId}/end`).pipe(
      tap(() => this.clear()),
    );
  }

  startPomodoro(sessionId: string, taskId: number): Observable<Pomodoro> {
    return this.api.create<Pomodoro>(`${BASE}/${sessionId}/pomodoros`, 'pomodoros', { task_id: taskId });
  }

  pomodoroAction(sessionId: string, pomodoroId: string, action: PomodoroAction): Observable<ApiResult<Pomodoro>> {
    return this.api.updateMeta<Pomodoro>(`${BASE}/${sessionId}/pomodoros/${pomodoroId}`, 'pomodoros', { action });
  }

  /** Pasa el pomodoro en curso a otra tarea de la sesión (debe estar sin completar ni bloqueada). */
  switchPomodoroTask(sessionId: string, pomodoroId: string, taskId: number): Observable<ApiResult<Pomodoro>> {
    return this.api.updateMeta<Pomodoro>(
      `${BASE}/${sessionId}/pomodoros/${pomodoroId}`, 'pomodoros', { action: 'switch_task', task_id: taskId },
    );
  }

  /** Marca una tarea como completada en el estado local (el PATCH lo hace el componente). */
  markTaskDone(taskId: number): void {
    this.activeSession.update(session =>
      session
        ? { ...session, tasks: session.tasks.map(t => (t.id === taskId ? { ...t, status: 'done' } : t)) }
        : session
    );
  }

  clear(): void {
    this.activeSession.set(null);
  }

  /** Borra las claves focus_refs_* que pudieron quedar de versiones anteriores. */
  private removeLegacyRefs(): void {
    try {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('focus_refs_')) keys.push(key);
      }
      keys.forEach(k => localStorage.removeItem(k));
    } catch { /* ignore */ }
  }
}
