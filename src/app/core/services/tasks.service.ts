import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Comment, DependencyType, Task, TaskDependency } from '../models';
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

    // Comentarios

    listComments(path: TaskPath, taskId: string): Observable<Comment[]> {
        return this.api.list<Comment>(`${this.base(path)}${taskId}/comments`);
    }

    addComment(path: TaskPath, taskId: string, text: string): Observable<Comment> {
        return this.api.create<Comment>(`${this.base(path)}${taskId}/comments`, 'comments', { text });
    }

    // Dependencias entre tareas

    private dependenciesPath({ orgId, groupId, projectId }: TaskPath): string {
        return `organizations/${orgId}/groups/${groupId}/projects/${projectId}/dependencies`;
    }

    listDependencies(path: TaskPath): Observable<TaskDependency[]> {
        return this.api.list<TaskDependency>(this.dependenciesPath(path));
    }

    createDependency(
        path: TaskPath,
        dep: { blocking_task_id: number; blocked_task_id: number; dependency_type: DependencyType },
    ): Observable<TaskDependency> {
        return this.api.create<TaskDependency>(this.dependenciesPath(path), 'task_dependencies', dep);
    }

    deleteDependency(path: TaskPath, dependencyId: string): Observable<void> {
        return this.api.delete(`${this.dependenciesPath(path)}/${dependencyId}`);
    }
}
