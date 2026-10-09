import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Task } from '../models';
import { ApiService } from './api.service';

export interface TaskPath {
    orgId: string;
    groupId: string;
    projectId: string;
}

export type TaskChanges = Partial<Pick<Task, 'title' | 'status' | 'assignee_ids'>>;

@Injectable({ providedIn: 'root' })
export class TasksService {
    private api = inject(ApiService);

    private base({ orgId, groupId, projectId }: TaskPath) {
        return `organizations/${orgId}/groups/${groupId}/projects/${projectId}/tasks/`;
    }

    list(path: TaskPath): Observable<Task[]> {
        return this.api.list<Task>(this.base(path));
    }

    create(path: TaskPath, changes: TaskChanges & { title: string }): Observable<Task> {
        return this.api.create<Task>(this.base(path), 'tasks', changes);
    }

    update(path: TaskPath, taskId: string, changes: TaskChanges): Observable<Task> {
        return this.api.update<Task>(`${this.base(path)}${taskId}`, 'tasks', changes);
    }

    delete(path: TaskPath, taskId: string): Observable<void> {
        return this.api.delete(`${this.base(path)}${taskId}`);
    }
}
