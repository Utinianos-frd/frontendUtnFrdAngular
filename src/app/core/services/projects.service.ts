import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Project } from '../models';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class ProjectsService {
    private api = inject(ApiService);

    private base(orgId: string, groupId: string) {
        return `organizations/${orgId}/groups/${groupId}/projects/`;
    }

    list(orgId: string, groupId: string): Observable<Project[]> {
        return this.api.list<Project>(this.base(orgId, groupId));
    }

    get(orgId: string, groupId: string, projectId: string): Observable<Project> {
        return this.api.get<Project>(`${this.base(orgId, groupId)}${projectId}`);
    }

    create(orgId: string, groupId: string, name: string): Observable<Project> {
        return this.api.create<Project>(this.base(orgId, groupId), 'projects', { name });
    }

    update(orgId: string, groupId: string, projectId: string, name: string): Observable<Project> {
        return this.api.update<Project>(`${this.base(orgId, groupId)}${projectId}`, 'projects', { name });
    }

    delete(orgId: string, groupId: string, projectId: string): Observable<void> {
        return this.api.delete(`${this.base(orgId, groupId)}${projectId}`);
    }
}
