import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { SelectModule } from 'primeng/select';
import { Group, Invitation, Organization, OrgMember, OrgRole, ORG_ROLE_LABELS } from '../../../../core/models';
import { AuthService } from '../../../../core/services/auth.service';
import { GroupsService } from '../../../../core/services/groups.service';
import { OrganizationsService } from '../../../../core/services/organizations.service';
import { Feedback } from '../../../../shared/ui/feedback';
import { NameDialog } from '../../../../shared/ui/name-dialog';
import { OrgDialog, OrgDialogResult } from '../../../../shared/ui/org-dialog';

type DialogMode = 'edit-org' | 'create-group' | 'edit-group' | null;

@Component({
  selector: 'app-organization-detail',
  imports: [RouterLink, FormsModule, SelectModule, NameDialog, OrgDialog],
  templateUrl: './organization-detail.html',
})
export class OrganizationDetail implements OnInit {
  /** Viene del parámetro :orgId de la ruta. */
  orgId = input.required<string>();

  private orgsService = inject(OrganizationsService);
  private groupsService = inject(GroupsService);
  private auth = inject(AuthService);
  private feedback = inject(Feedback);
  private router = inject(Router);

  readonly roleLabels = ORG_ROLE_LABELS;
  readonly roleOptions = (['owner', 'admin', 'member'] as OrgRole[]).map(value => ({ value, label: ORG_ROLE_LABELS[value] }));

  org = signal<Organization | null>(null);
  groups = signal<Group[]>([]);
  members = signal<OrgMember[]>([]);
  invitation = signal<Invitation | null>(null);
  loading = signal(true);

  dialogMode = signal<DialogMode>(null);
  editingGroup = signal<Group | null>(null);
  saving = signal(false);

  isOwner = computed(() => this.org()?.role === 'owner');
  isAdmin = computed(() => this.org()?.role === 'owner' || this.org()?.role === 'admin');
  currentUserId = computed(() => this.auth.currentUser()?.id);

  // El diálogo de organización (nombre + logo) y el de grupos (solo nombre) son distintos.
  orgDialogOpen = computed(() => this.dialogMode() === 'edit-org');
  groupDialogOpen = computed(() => this.dialogMode() === 'create-group' || this.dialogMode() === 'edit-group');
  dialogHeader = computed(() => (this.dialogMode() === 'create-group' ? 'Nuevo grupo' : 'Editar grupo'));
  dialogInitial = computed(() => (this.dialogMode() === 'edit-group' ? this.editingGroup()?.name ?? '' : ''));

  ngOnInit(): void {
    this.orgsService.get(this.orgId()).subscribe({
      next: org => {
        this.org.set(org);
        this.loading.set(false);
        if (this.isAdmin()) this.loadInvitation();
      },
      error: err => {
        this.loading.set(false);
        this.feedback.error(err);
      },
    });
    this.loadGroups();
    this.loadMembers();
  }

  private loadGroups(): void {
    this.groupsService.list(this.orgId()).subscribe({
      next: groups => this.groups.set(groups),
      error: err => this.feedback.error(err),
    });
  }

  private loadMembers(): void {
    this.orgsService.members(this.orgId()).subscribe({
      next: members => this.members.set(members),
      error: err => this.feedback.error(err),
    });
  }

  private loadInvitation(): void {
    this.orgsService.invitation(this.orgId()).subscribe({
      next: inv => this.invitation.set(inv),
      error: () => this.invitation.set(null),
    });
  }

  // Diálogo de nombre (organización y grupos)

  openDialog(mode: DialogMode, group: Group | null = null): void {
    this.editingGroup.set(group);
    this.dialogMode.set(mode);
  }

  onDialogVisibleChange(visible: boolean): void {
    if (!visible) this.dialogMode.set(null);
  }

  /** Guardar edición de la organización (nombre + logo). */
  onOrgSave({ name, logoUrl }: OrgDialogResult): void {
    this.saving.set(true);
    this.orgsService.update(this.orgId(), { name, logo_url: logoUrl }).subscribe({
      next: org => {
        this.saving.set(false);
        this.dialogMode.set(null);
        this.org.set(org);
        this.feedback.success('Organización actualizada');
      },
      error: err => {
        this.saving.set(false);
        this.feedback.error(err);
      },
    });
  }

  /** Guardar creación/edición de un grupo (solo nombre). */
  onGroupSave(name: string): void {
    const orgId = this.orgId();
    const mode = this.dialogMode();
    const group = this.editingGroup();

    const request: Observable<Group> =
      mode === 'create-group' ? this.groupsService.create(orgId, name) :
      this.groupsService.update(orgId, group!.id, name);

    this.saving.set(true);
    request.subscribe({
      next: result => {
        this.saving.set(false);
        this.dialogMode.set(null);
        if (mode === 'create-group') {
          // Un grupo nuevo no tiene líder: vamos a su página para asignarlo.
          this.feedback.success('Grupo creado. Ahora asignale un líder.');
          this.router.navigate(['/organizations', orgId, 'groups', result.id]);
        } else {
          this.loadGroups();
          this.feedback.success('Grupo actualizado');
        }
      },
      error: err => {
        this.saving.set(false);
        this.feedback.error(err);
      },
    });
  }

  // Organización

  deleteOrg(): void {
    const org = this.org();
    if (!org) return;
    this.feedback.confirmDelete(`¿Eliminar la organización "${org.name}"? Se borrarán sus grupos, proyectos y tareas.`, () => {
      this.orgsService.delete(org.id).subscribe({
        next: () => {
          this.feedback.success('Organización eliminada');
          this.router.navigate(['/organizations']);
        },
        error: err => this.feedback.error(err),
      });
    });
  }

  // Grupos

  deleteGroup(group: Group): void {
    this.feedback.confirmDelete(`¿Eliminar el grupo "${group.name}"?`, () => {
      this.groupsService.delete(this.orgId(), group.id).subscribe({
        next: () => {
          this.groups.update(list => list.filter(g => g.id !== group.id));
          this.feedback.success('Grupo eliminado');
        },
        error: err => this.feedback.error(err),
      });
    });
  }

  // Miembros

  changeRole(member: OrgMember, role: OrgRole): void {
    if (role === member.role) return;
    if (role === 'owner') {
      // Asignar owner traspasa la propiedad: el owner actual (vos) pasa a admin.
      this.members.update(list => list.map(m => ({ ...m })));
      this.feedback.confirm(
        `¿Transferir la propiedad de la organización a ${member.username}? Vos pasarás a ser Admin.`,
        () => this.doChangeRole(member, role)
      );
      return;
    }
    this.doChangeRole(member, role);
  }

  private doChangeRole(member: OrgMember, role: OrgRole): void {
    this.orgsService.changeMemberRole(this.orgId(), member.user_id, role).subscribe({
      next: updated => {
        this.feedback.success(`${member.username} ahora es ${ORG_ROLE_LABELS[updated.role]}`);
        if (role === 'owner') {
          // Cambió también nuestro rol: recargamos la organización y los miembros.
          this.orgsService.get(this.orgId()).subscribe(org => this.org.set(org));
          this.loadMembers();
        } else {
          this.members.update(list => list.map(m => (m.user_id === member.user_id ? { ...m, role: updated.role } : m)));
        }
      },
      error: err => {
        // Fuerza a que el select vuelva al valor original.
        this.members.update(list => list.map(m => ({ ...m })));
        this.feedback.error(err);
      },
    });
  }

  removeMember(member: OrgMember): void {
    this.feedback.confirmDelete(`¿Quitar a ${member.username} de la organización?`, () => {
      this.orgsService.removeMember(this.orgId(), member.user_id).subscribe({
        next: () => {
          this.members.update(list => list.filter(m => m.user_id !== member.user_id));
          this.feedback.success(`${member.username} fue quitado de la organización`);
        },
        error: err => this.feedback.error(err),
      });
    });
  }

  // Invitación

  copyInvite(): void {
    const token = this.invitation()?.token;
    if (!token) return;
    navigator.clipboard.writeText(token).then(
      () => this.feedback.success('Código de invitación copiado'),
      () => this.feedback.error(null)
    );
  }

  regenerateInvite(): void {
    this.feedback.confirm('¿Generar un código nuevo? El código actual dejará de funcionar.', () => this.doRegenerateInvite());
  }

  private doRegenerateInvite(): void {
    this.orgsService.regenerateInvitation(this.orgId()).subscribe({
      next: () => {
        this.loadInvitation();
        this.feedback.success('Se generó un nuevo código. El anterior ya no sirve.');
      },
      error: err => this.feedback.error(err),
    });
  }

  deactivateInvite(): void {
    this.orgsService.deactivateInvitation(this.orgId()).subscribe({
      next: () => {
        this.loadInvitation();
        this.feedback.success('Invitación desactivada');
      },
      error: err => this.feedback.error(err),
    });
  }
}
