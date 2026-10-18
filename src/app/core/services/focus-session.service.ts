import { inject, Injectable, signal } from '@angular/core';
import { catchError, Observable, of, tap } from 'rxjs';
import { FocusSession, FocusSessionSummary, Pomodoro } from '../models';
import { ApiResult, ApiService } from './api.service';

export type PomodoroAction = 'pause' | 'resume' | 'cancel' | 'complete';

/** Metadata local de una tarea de la sesión: título y ruta para poder marcarla "done". */
export interface FocusTaskRef {
  id: number;
  title: string;
  orgId: string;
  groupId: string;
  projectId: string;
  done?: boolean;
}

const BASE = 'focus-sessions';
const refsKey = (sessionId: string) => `focus_refs_${sessionId}`;

/**
 * Estado de la sesión de Modo Foco activa. La sesión (y su resumen) vive en el backend;
 * acá se cachea la sesión activa y la metadata local de las tareas elegidas (títulos y
 * ruta org/grupo/proyecto), que la API de sesiones no devuelve, para sobrevivir recargas.
 */
@Injectable({ providedIn: 'root' })
export class FocusSessionService {
  private api = inject(ApiService);

  readonly activeSession = signal<FocusSession | null>(null);
  readonly taskRefs = signal<FocusTaskRef[]>([]);

  /** Consulta la sesión activa (404 → no hay). Se llama al arrancar la app. */
  loadActive(): Observable<FocusSession | null> {
    return this.api.get<FocusSession>(`${BASE}/active`).pipe(
      tap(session => {
        this.activeSession.set(session);
        this.taskRefs.set(this.restoreRefs(session));
      }),
      catchError(() => {
        this.activeSession.set(null);
        this.taskRefs.set([]);
        return of(null);
      }),
    );
  }

  start(goalText: string, refs: FocusTaskRef[]): Observable<FocusSession> {
    return this.api.create<FocusSession>(`${BASE}/`, 'focus_sessions', {
      goal_text: goalText,
      task_ids: refs.map(r => r.id),
    }).pipe(
      tap(session => {
        this.activeSession.set(session);
        this.persistRefs(session.id, refs);
        this.taskRefs.set(refs);
      }),
    );
  }

  end(sessionId: string): Observable<FocusSessionSummary> {
    return this.api.postData<FocusSessionSummary>(`${BASE}/${sessionId}/end`).pipe(
      tap(() => this.clear(sessionId)),
    );
  }

  startPomodoro(sessionId: string, taskId: number): Observable<Pomodoro> {
    return this.api.create<Pomodoro>(`${BASE}/${sessionId}/pomodoros`, 'pomodoros', { task_id: taskId });
  }

  pomodoroAction(sessionId: string, pomodoroId: string, action: PomodoroAction): Observable<ApiResult<Pomodoro>> {
    return this.api.updateMeta<Pomodoro>(`${BASE}/${sessionId}/pomodoros/${pomodoroId}`, 'pomodoros', { action });
  }

  /** Marca una tarea como completada en el estado local (el PATCH lo hace el componente). */
  markTaskDone(taskId: number): void {
    this.taskRefs.update(refs => refs.map(r => (r.id === taskId ? { ...r, done: true } : r)));
    const session = this.activeSession();
    if (session) this.persistRefs(session.id, this.taskRefs());
  }

  clear(sessionId?: string): void {
    const id = sessionId ?? this.activeSession()?.id;
    if (id) { try { localStorage.removeItem(refsKey(id)); } catch { /* ignore */ } }
    this.activeSession.set(null);
    this.taskRefs.set([]);
  }

  private persistRefs(sessionId: string, refs: FocusTaskRef[]): void {
    try { localStorage.setItem(refsKey(sessionId), JSON.stringify(refs)); } catch { /* ignore */ }
  }

  /** Recupera la metadata local; si falta (otro dispositivo), arma refs mínimas con los ids. */
  private restoreRefs(session: FocusSession): FocusTaskRef[] {
    try {
      const raw = localStorage.getItem(refsKey(session.id));
      if (raw) {
        const refs = JSON.parse(raw) as FocusTaskRef[];
        if (Array.isArray(refs) && refs.length) return refs;
      }
    } catch { /* ignore */ }
    return session.task_ids.map(id => ({ id, title: `Tarea #${id}`, orgId: '', groupId: '', projectId: '' }));
  }
}
