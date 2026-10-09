export type OrgRole = 'owner' | 'admin' | 'member';
export type GroupRole = 'group_lead' | 'contributor';
export type TaskStatus = 'pending' | 'in_progress' | 'done';

export interface Organization {
    id: string;
    name: string;
    plan: string;
    plan_status: string;
    /** Rol del usuario logueado en esta organización. */
    role: OrgRole;
}

export interface OrgMember {
    id: string;
    user_id: number;
    username: string;
    role: OrgRole;
}

export interface Invitation {
    id: string;
    token: string;
    active: boolean;
}

export interface Group {
    id: string;
    name: string;
    organization_id: number;
}

export interface GroupMember {
    id: string;
    user_id: number;
    username: string;
    role: GroupRole;
}

export interface Project {
    id: string;
    name: string;
    group_id: number;
}

export interface Task {
    id: string;
    title: string;
    status: TaskStatus;
    project_id: number;
    assignee_ids: number[];
}

export const ORG_ROLE_LABELS: Record<OrgRole, string> = {
    owner: 'Owner',
    admin: 'Admin',
    member: 'Miembro',
};

export const GROUP_ROLE_LABELS: Record<GroupRole, string> = {
    group_lead: 'Group lead',
    contributor: 'Contributor',
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
    pending: 'Por hacer',
    in_progress: 'En curso',
    done: 'Completada',
};
