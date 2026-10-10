import { Component, computed, effect, inject, input, OnInit, signal, untracked } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SelectModule } from 'primeng/select';
import {
  ActiveTask, Group, GROUP_ROLE_LABELS, MemberWorkload, MemberWorkloadDetail, Organization,
  TASK_STATUS_LABELS, WorkloadStatus, WORKLOAD_STATUS_COLORS, WORKLOAD_STATUS_LABELS,
} from '../../core/models';
import { apiErrorMessage } from '../../core/services/api.service';
import { GroupsService } from '../../core/services/groups.service';
import { OrganizationsService } from '../../core/services/organizations.service';
import { ProjectsService } from '../../core/services/projects.service';
import { WorkloadService } from '../../core/services/workload.service';
import { Feedback } from '../../shared/ui/feedback';

const STATUS_ORDER: WorkloadStatus[] = ['overloaded', 'busy', 'available'];

@Component({
  selector: 'app-workload',
  imports: [RouterLink, FormsModule, SelectModule],
  templateUrl: './workload.html',
})
export class Workload implements OnInit {
  /** Query params (?org=…&group=…), enlazados por withComponentInputBinding. */
  org = input<string>();
  group = input<string>();

  private orgsService = inject(OrganizationsService);
  private groupsService = inject(GroupsService);
  private projectsService = inject(ProjectsService);
  private workloadService = inject(WorkloadService);
  private feedback = inject(Feedback);
  private router = inject(Router);

  readonly statusLabels = WORKLOAD_STATUS_LABELS;
  readonly statusColors = WORKLOAD_STATUS_COLORS;
  readonly roleLabels = GROUP_ROLE_LABELS;
  readonly taskStatusLabels = TASK_STATUS_LABELS;

  organizations = signal<Organization[]>([]);
  groups = signal<Group[]>([]);
  members = signal<MemberWorkload[]>([]);
  loadingOrgs = signal(true);
  loadingWorkload = signal(false);
  /** Mensaje cuando no se puede ver el workload (por ejemplo, 403). */
  workloadError = signal<string | null>(null);

  // Detalle de un miembro
  expandedUserId = signal<number | null>(null);
  detail = signal<MemberWorkloadDetail | null>(null);
  loadingDetail = signal(false);
  /** Nombres de proyectos ya conocidos, por id. */
  projectNames = signal<Record<number, string>>({});

  // Umbral de sobrecarga
  thresholdDraft = signal<number | null>(null);
  savingThreshold = signal(false);

  selectedOrg = computed(() => this.organizations().find(o => o.id === this.org()) ?? null);
  selectedGroup = computed(() => this.groups().find(g => g.id === this.group()) ?? null);
  threshold = computed(() => this.selectedOrg()?.overload_threshold ?? 0);
  isOwner = computed(() => this.selectedOrg()?.role === 'owner');

  orgOptions = computed(() => this.organizations().map(o => ({ value: o.id, label: o.name })));
  groupOptions = computed(() => this.groups().map(g => ({ value: g.id, label: g.name })));

  /** Primero los sobrecargados, después por cantidad de tareas. */
  sortedMembers = computed(() =>
    [...this.members()].sort((a, b) =>
      STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) ||
      b.active_task_count - a.active_task_count ||
      a.username.localeCompare(b.username)
    )
  );

  summary = computed(() => {
    const count = (s: WorkloadStatus) => this.members().filter(m => m.status === s).length;
    return {
      total: this.members().length,
      available: count('available'),
      busy: count('busy'),
      overloaded: count('overloaded'),
      tasks: this.members().reduce((sum, m) => sum + m.active_task_count, 0),
    };
  });

  constructor() {
    // Al cambiar de organización: cargar sus grupos.
    effect(() => {
      const orgId = this.org();
      if (!orgId) return;
      untracked(() => this.loadGroups(orgId));
    });

    // Al cambiar de grupo: cargar el workload.
    effect(() => {
      const orgId = this.org();
      const groupId = this.group();
      untracked(() => {
        this.collapse();
        if (orgId && groupId) this.loadWorkload(orgId, groupId);
        else this.members.set([]);
      });
    });

    effect(() => {
      const t = this.threshold();
      untracked(() => this.thresholdDraft.set(t || null));
    });
  }

  ngOnInit(): void {
    this.orgsService.list().subscribe({
      next: orgs => {
        this.organizations.set(orgs);
        this.loadingOrgs.set(false);
        if (!this.org() || !orgs.some(o => o.id === this.org())) {
          // Por defecto, la primera organización donde podés ver workloads (owner/admin).
          const first = orgs.find(o => o.role !== 'member') ?? orgs[0];
          if (first) this.select(first.id, undefined);
        }
      },
      error: err => {
        this.loadingOrgs.set(false);
        this.feedback.error(err);
      },
    });
  }

  /** Cambia la selección actualizando la URL (que a su vez dispara las cargas). */
  select(orgId: string | undefined, groupId: string | undefined): void {
    this.router.navigate([], {
      queryParams: { org: orgId ?? null, group: groupId ?? null },
      replaceUrl: true,
    });
  }

  private loadGroups(orgId: string): void {
    this.groups.set([]);
    this.groupsService.list(orgId).subscribe({
      next: groups => {
        this.groups.set(groups);
        if (!groups.some(g => g.id === this.group())) {
          this.select(orgId, groups[0]?.id);
        }
      },
      error: err => this.feedback.error(err),
    });
  }

  loadWorkload(orgId = this.org(), groupId = this.group()): void {
    if (!orgId || !groupId) return;
    this.loadingWorkload.set(true);
    this.workloadError.set(null);
    this.workloadService.group(orgId, groupId).subscribe({
      next: members => {
        this.members.set(members);
        this.loadingWorkload.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.members.set([]);
        this.loadingWorkload.set(false);
        this.workloadError.set(
          err.status === 403
            ? 'Solo el owner, los admins y el líder de este grupo pueden ver su carga de trabajo.'
            : apiErrorMessage(err)
        );
      },
    });
  }

  /** Ancho de la barra: tareas activas sobre el umbral (tope 100%). */
  loadPct(member: MemberWorkload): number {
    const t = this.threshold();
    if (!t) return 0;
    return Math.min(100, Math.round((member.active_task_count / t) * 100));
  }

  // Detalle de un miembro

  toggle(member: MemberWorkload): void {
    if (this.expandedUserId() === member.user_id) {
      this.collapse();
      return;
    }
    const orgId = this.org();
    const groupId = this.group();
    if (!orgId || !groupId) return;

    this.expandedUserId.set(member.user_id);
    this.detail.set(null);
    this.loadingDetail.set(true);
    this.workloadService.member(orgId, groupId, member.user_id).subscribe({
      next: detail => {
        this.detail.set(detail);
        this.loadingDetail.set(false);
        this.loadProjectNames(orgId, detail.active_tasks);
      },
      error: err => {
        this.loadingDetail.set(false);
        this.feedback.error(err);
      },
    });
  }

  private collapse(): void {
    this.expandedUserId.set(null);
    this.detail.set(null);
  }

  /** Las tareas activas pueden ser de otros grupos: pedimos los proyectos de cada grupo que aparezca. */
  private loadProjectNames(orgId: string, tasks: ActiveTask[]): void {
    const known = this.projectNames();
    const groupIds = new Set(tasks.filter(t => !(t.project_id in known)).map(t => t.group_id));
    for (const groupId of groupIds) {
      this.projectsService.list(orgId, String(groupId)).subscribe({
        next: projects =>
          this.projectNames.update(names => ({
            ...names,
            ...Object.fromEntries(projects.map(p => [Number(p.id), p.name])),
          })),
        // Si no tenemos acceso a ese grupo, mostramos el id del proyecto.
        error: () => {},
      });
    }
  }

  projectName(task: ActiveTask): string {
    return this.projectNames()[task.project_id] ?? `Proyecto #${task.project_id}`;
  }

  // Umbral

  saveThreshold(): void {
    const orgId = this.org();
    const value = this.thresholdDraft();
    if (!orgId || value == null || value < 1) return;

    this.savingThreshold.set(true);
    this.orgsService.update(orgId, { overload_threshold: value }).subscribe({
      next: updated => {
        this.savingThreshold.set(false);
        this.organizations.update(list => list.map(o => (o.id === orgId ? { ...o, ...updated } : o)));
        this.feedback.success(`Umbral de sobrecarga actualizado a ${updated.overload_threshold} tareas`);
        // Los estados (disponible/ocupado/sobrecargado) dependen del umbral.
        this.loadWorkload();
      },
      error: err => {
        this.savingThreshold.set(false);
        this.feedback.error(err);
      },
    });
  }
}
