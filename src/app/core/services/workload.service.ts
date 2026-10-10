import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { MemberWorkload, MemberWorkloadDetail } from '../models';
import { ApiService } from './api.service';

/** Carga de trabajo por grupo. Solo la ven el owner, los admins y el líder del grupo. */
@Injectable({ providedIn: 'root' })
export class WorkloadService {
    private api = inject(ApiService);

    group(orgId: string, groupId: string): Observable<MemberWorkload[]> {
        return this.api.list<MemberWorkload>(`organizations/${orgId}/groups/${groupId}/workload`);
    }

    member(orgId: string, groupId: string, userId: number): Observable<MemberWorkloadDetail> {
        return this.api.get<MemberWorkloadDetail>(`organizations/${orgId}/groups/${groupId}/workload/${userId}`);
    }
}
