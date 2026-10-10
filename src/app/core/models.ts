export type OrgRole = 'owner' | 'admin' | 'member';
export type GroupRole = 'group_lead' | 'contributor';
export type TaskStatus = 'pending' | 'in_progress' | 'done';
export type WorkloadStatus = 'available' | 'busy' | 'overloaded';

export interface Organization {
    id: string;
    name: string;
    /** URL del logo de la organización (vacío si no tiene). */
    logo_url: string;
    plan: string;
    plan_status: string;
    /** Cantidad de tareas activas a partir de la cual alguien se considera sobrecargado. */
    overload_threshold: number;
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

/** Carga de un miembro del grupo. Las tareas activas se suman en todos sus grupos. */
export interface MemberWorkload {
    id: string;
    user_id: number;
    username: string;
    group_role: GroupRole;
    active_task_count: number;
    status: WorkloadStatus;
}

export interface ActiveTask {
    task_id: number;
    title: string;
    status: TaskStatus;
    project_id: number;
    group_id: number;
}

export interface MemberWorkloadDetail extends Omit<MemberWorkload, 'group_role'> {
    active_tasks: ActiveTask[];
}

export const WORKLOAD_STATUS_LABELS: Record<WorkloadStatus, string> = {
    available: 'Disponible',
    busy: 'Ocupado',
    overloaded: 'Sobrecargado',
};

// Tonos de severidad legibles sobre las superficies oscuras de Nocturne.
export const WORKLOAD_STATUS_COLORS: Record<WorkloadStatus, string> = {
    available: '#3fb950',
    busy: '#d29922',
    overloaded: '#f85149',
};

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
