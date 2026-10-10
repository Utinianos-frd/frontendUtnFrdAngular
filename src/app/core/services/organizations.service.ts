import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Invitation, Organization, OrgMember, OrgRole } from '../models';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class OrganizationsService {
    private api = inject(ApiService);

    list(): Observable<Organization[]> {
        return this.api.list<Organization>('organizations/');
    }

    get(orgId: string): Observable<Organization> {
        return this.api.get<Organization>(`organizations/${orgId}`);
    }

    create(name: string, logoUrl = ''): Observable<Organization> {
        return this.api.create<Organization>('organizations/', 'organizations', { name, logo_url: logoUrl });
    }

    update(orgId: string, changes: Partial<Pick<Organization, 'name' | 'overload_threshold' | 'logo_url'>>): Observable<Organization> {
        return this.api.update<Organization>(`organizations/${orgId}`, 'organizations', changes);
    }

    delete(orgId: string): Observable<void> {
        return this.api.delete(`organizations/${orgId}`);
    }

    join(token: string): Observable<Organization> {
        return this.api.create<Organization>('organizations/join', 'invitations', { token });
    }

    // Miembros

    members(orgId: string): Observable<OrgMember[]> {
        return this.api.list<OrgMember>(`organizations/${orgId}/members`);
    }

    changeMemberRole(orgId: string, userId: number, role: OrgRole): Observable<OrgMember> {
        return this.api.update<OrgMember>(`organizations/${orgId}/members/${userId}`, 'memberships', { role });
    }

    removeMember(orgId: string, userId: number): Observable<void> {
        return this.api.delete(`organizations/${orgId}/members/${userId}`);
    }

    // Invitación

    invitation(orgId: string): Observable<Invitation> {
        return this.api.get<Invitation>(`organizations/${orgId}/invite`);
    }

    regenerateInvitation(orgId: string): Observable<void> {
        return this.api.action(`organizations/${orgId}/invite/regenerate`);
    }

    deactivateInvitation(orgId: string): Observable<void> {
        return this.api.action(`organizations/${orgId}/invite/deactivate`);
    }
}
