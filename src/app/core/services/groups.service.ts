import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Group, GroupMember, GroupRole } from '../models';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class GroupsService {
    private api = inject(ApiService);

    private base(orgId: string) {
        return `organizations/${orgId}/groups`;
    }

    list(orgId: string): Observable<Group[]> {
        return this.api.list<Group>(this.base(orgId));
    }

    get(orgId: string, groupId: string): Observable<Group> {
        return this.api.get<Group>(`${this.base(orgId)}/${groupId}`);
    }

    create(orgId: string, name: string): Observable<Group> {
        return this.api.create<Group>(this.base(orgId), 'groups', { name });
    }

    update(orgId: string, groupId: string, name: string): Observable<Group> {
        return this.api.update<Group>(`${this.base(orgId)}/${groupId}`, 'groups', { name });
    }

    delete(orgId: string, groupId: string): Observable<void> {
        return this.api.delete(`${this.base(orgId)}/${groupId}`);
    }

    // Miembros del grupo

    members(orgId: string, groupId: string): Observable<GroupMember[]> {
        return this.api.list<GroupMember>(`${this.base(orgId)}/${groupId}/members`);
    }

    addMember(orgId: string, groupId: string, userId: number): Observable<GroupMember> {
        return this.api.create<GroupMember>(`${this.base(orgId)}/${groupId}/members`, 'group_memberships', { user_id: userId });
    }

    changeMemberRole(orgId: string, groupId: string, userId: number, role: GroupRole): Observable<GroupMember> {
        return this.api.update<GroupMember>(`${this.base(orgId)}/${groupId}/members/${userId}`, 'group_memberships', { role });
    }

    removeMember(orgId: string, groupId: string, userId: number): Observable<void> {
        return this.api.delete(`${this.base(orgId)}/${groupId}/members/${userId}`);
    }
}
