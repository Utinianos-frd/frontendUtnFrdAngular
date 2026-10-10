import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { SelectModule } from 'primeng/select';
import {
  Group, GroupMember, GROUP_ROLE_LABELS, Organization, OrgMember, Project,
} from '../../../../core/models';
import { AuthService } from '../../../../core/services/auth.service';
import { GroupsService } from '../../../../core/services/groups.service';
import { OrganizationsService } from '../../../../core/services/organizations.service';
import { ProjectsService } from '../../../../core/services/projects.service';
import { Feedback } from '../../../../shared/ui/feedback';
import { NameDialog } from '../../../../shared/ui/name-dialog';

type DialogMode = 'edit-group' | 'create-project' | 'edit-project' | null;

const PROJECT_COLORS = ['#008A00', '#AA00FF', '#00ABA9', '#D80073', '#F0A30A', '#0050EF'];

@Component({
  selector: 'app-group-detail',
  imports: [RouterLink, FormsModule, SelectModule, NameDialog],
  templateUrl: './group-detail.html',
})
export class GroupDetail implements OnInit {
  orgId = input.required<string>();
  groupId = input.required<string>();

  private orgsService = inject(OrganizationsService);
  private groupsService = inject(GroupsService);
  private projectsService = inject(ProjectsService);
  private auth = inject(AuthService);
  private feedback = inject(Feedback);
  private router = inject(Router);

  readonly roleLabels = GROUP_ROLE_LABELS;

  org = signal<Organization | null>(null);
  group = signal<Group | null>(null);
  projects = signal<Project[]>([]);
  members = signal<GroupMember[]>([]);
  orgMembers = signal<OrgMember[]>([]);
  loading = signal(true);

  dialogMode = signal<DialogMode>(null);
  editingProject = signal<Project | null>(null);
  saving = signal(false);
  userToAdd = signal<number | null>(null);
  leadCandidate = signal<number | null>(null);
  assigningLead = signal(false);

  currentUserId = computed(() => this.auth.currentUser()?.id);
  isOrgOwner = computed(() => this.org()?.role === 'owner');
  /** El workload lo ven el owner, los admins y el líder del grupo. */
  canSeeWorkload = computed(() => this.org()?.role === 'owner' || this.org()?.role === 'admin' || this.isGroupLead());

  lead = computed(() => this.members().find(m => m.role === 'group_lead') ?? null);
  isGroupLead = computed(() => this.lead()?.user_id === this.currentUserId());

  /**
   * Cualquier miembro de la organización puede ser líder, esté o no en el grupo
   * (si no está, el backend lo agrega). El líder anterior pasa a contributor.
   */
  leadCandidates = computed(() =>
    this.orgMembers()
      .filter(m => m.user_id !== this.lead()?.user_id)
      .map(m => ({ value: m.user_id, label: m.username }))
  );

  /** Miembros de la organización que todavía no están en el grupo. */
  addableUsers = computed(() => {
    const inGroup = new Set(this.members().map(m => m.user_id));
    return this.orgMembers()
      .filter(m => !inGroup.has(m.user_id))
      .map(m => ({ value: m.user_id, label: m.username }));
  });

  dialogHeader = computed(() => {
    switch (this.dialogMode()) {
      case 'edit-group': return 'Editar grupo';
      case 'create-project': return 'Nuevo proyecto';
      case 'edit-project': return 'Editar proyecto';
      default: return '';
    }
  });
  dialogInitial = computed(() => {
    switch (this.dialogMode()) {
      case 'edit-group': return this.group()?.name ?? '';
      case 'edit-project': return this.editingProject()?.name ?? '';
      default: return '';
    }
  });

  ngOnInit(): void {
    const orgId = this.orgId();
    const groupId = this.groupId();

    this.orgsService.get(orgId).subscribe({ next: org => this.org.set(org), error: () => {} });
    this.orgsService.members(orgId).subscribe({ next: m => this.orgMembers.set(m), error: () => {} });
    this.groupsService.get(orgId, groupId).subscribe({
      next: group => {
        this.group.set(group);
        this.loading.set(false);
      },
      error: err => {
        this.loading.set(false);
        this.feedback.error(err);
      },
    });
    this.loadProjects();
    this.loadMembers();
  }

  color(index: number): string {
    return PROJECT_COLORS[index % PROJECT_COLORS.length];
  }

  private loadProjects(): void {
    this.projectsService.list(this.orgId(), this.groupId()).subscribe({
      next: projects => this.projects.set(projects),
      error: err => this.feedback.error(err),
    });
  }

  private loadMembers(): void {
    this.groupsService.members(this.orgId(), this.groupId()).subscribe({
      next: members => this.members.set(members),
      error: err => this.feedback.error(err),
    });
  }

  // Diálogo de nombre (grupo y proyectos)

  openDialog(mode: DialogMode, project: Project | null = null): void {
    this.editingProject.set(project);
    this.dialogMode.set(mode);
  }

  onDialogVisibleChange(visible: boolean): void {
    if (!visible) this.dialogMode.set(null);
  }

  onDialogSave(name: string): void {
    const { orgId, groupId } = { orgId: this.orgId(), groupId: this.groupId() };
    const mode = this.dialogMode();

    const request: Observable<Group | Project> =
      mode === 'edit-group' ? this.groupsService.update(orgId, groupId, name) :
      mode === 'create-project' ? this.projectsService.create(orgId, groupId, name) :
      this.projectsService.update(orgId, groupId, this.editingProject()!.id, name);

    this.saving.set(true);
    request.subscribe({
      next: result => {
        this.saving.set(false);
        this.dialogMode.set(null);
        if (mode === 'edit-group') {
          this.group.set(result as Group);
          this.feedback.success('Grupo actualizado');
        } else {
          this.loadProjects();
          this.feedback.success(mode === 'create-project' ? 'Proyecto creado' : 'Proyecto actualizado');
        }
      },
      error: err => {
        this.saving.set(false);
        this.feedback.error(err);
      },
    });
  }

  // Grupo

  deleteGroup(): void {
    const group = this.group();
    if (!group) return;
    this.feedback.confirmDelete(`¿Eliminar el grupo "${group.name}" con todos sus proyectos?`, () => {
      this.groupsService.delete(this.orgId(), group.id).subscribe({
        next: () => {
          this.feedback.success('Grupo eliminado');
          this.router.navigate(['/organizations', this.orgId()]);
        },
        error: err => this.feedback.error(err),
      });
    });
  }

  // Proyectos

  deleteProject(project: Project): void {
    this.feedback.confirmDelete(`¿Eliminar el proyecto "${project.name}" y todas sus tareas?`, () => {
      this.projectsService.delete(this.orgId(), this.groupId(), project.id).subscribe({
        next: () => {
          this.projects.update(list => list.filter(p => p.id !== project.id));
          this.feedback.success('Proyecto eliminado');
        },
        error: err => this.feedback.error(err),
      });
    });
  }

  // Miembros del grupo

  addMember(): void {
    const userId = this.userToAdd();
    if (userId == null) return;
    this.groupsService.addMember(this.orgId(), this.groupId(), userId).subscribe({
      next: () => {
        this.userToAdd.set(null);
        this.loadMembers();
        this.feedback.success('Miembro agregado al grupo');
      },
      error: err => this.feedback.error(err),
    });
  }

  /** Asigna el líder del grupo (solo el owner de la organización). */
  assignLead(userId: number | null = this.leadCandidate()): void {
    if (userId == null) return;
    const username = this.orgMembers().find(m => m.user_id === userId)?.username
      ?? this.members().find(m => m.user_id === userId)?.username ?? 'El usuario';
    const current = this.lead();

    const doAssign = () => {
      this.assigningLead.set(true);
      this.groupsService.changeMemberRole(this.orgId(), this.groupId(), userId, 'group_lead').subscribe({
        next: () => {
          this.assigningLead.set(false);
          this.leadCandidate.set(null);
          // Cambian dos roles (el nuevo líder y el anterior), así que recargamos.
          this.loadMembers();
          this.feedback.success(`${username} es el nuevo líder del grupo`);
        },
        error: err => {
          this.assigningLead.set(false);
          this.feedback.error(err);
        },
      });
    };

    if (current) {
      this.feedback.confirm(`¿Hacer líder a ${username}? ${current.username} pasará a ser contributor.`, doAssign);
    } else {
      doAssign();
    }
  }

  removeMember(member: GroupMember): void {
    this.feedback.confirmDelete(`¿Quitar a ${member.username} del grupo?`, () => {
      this.groupsService.removeMember(this.orgId(), this.groupId(), member.user_id).subscribe({
        next: () => {
          this.members.update(list => list.filter(m => m.user_id !== member.user_id));
          this.feedback.success(`${member.username} fue quitado del grupo`);
        },
        error: err => this.feedback.error(err),
      });
    });
  }
}
