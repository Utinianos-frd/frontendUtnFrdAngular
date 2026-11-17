import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Organization, ORG_ROLE_LABELS } from '../../../../core/models';
import { OrganizationsService } from '../../../../core/services/organizations.service';
import { Feedback } from '../../../../shared/ui/feedback';
import { OrgDialog, OrgDialogResult } from '../../../../shared/ui/org-dialog';

@Component({
  selector: 'app-organization-list',
  imports: [RouterLink, FormsModule, OrgDialog],
  templateUrl: './organization-list.html',
})
export class OrganizationList implements OnInit {
  private orgs = inject(OrganizationsService);
  private feedback = inject(Feedback);
  private router = inject(Router);

  readonly roleLabels = ORG_ROLE_LABELS;

  organizations = signal<Organization[]>([]);
  loading = signal(true);
  creating = signal(false);
  dialogOpen = signal(false);
  joinToken = signal('');
  joining = signal(false);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.orgs.list().subscribe({
      next: list => {
        this.organizations.set(list);
        this.loading.set(false);
      },
      error: err => {
        this.feedback.error(err);
        this.loading.set(false);
      },
    });
  }

  create({ name, logoUrl }: OrgDialogResult): void {
    this.creating.set(true);
    this.orgs.create(name, logoUrl).subscribe({
      next: org => {
        this.creating.set(false);
        this.dialogOpen.set(false);
        this.feedback.success(`Organización "${org.name}" creada`);
        this.router.navigate(['/organizations', org.id]);
      },
      error: err => {
        this.creating.set(false);
        this.feedback.error(err);
      },
    });
  }

  /** El código de invitación es un UUID; lo aceptamos solo o dentro de un link. */
  private readonly UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

  join(): void {
    // Validamos en el front: buscamos un UUID en lo pegado (token suelto o link que lo contenga).
    const token = this.joinToken().trim().match(this.UUID_RE)?.[0];
    if (!token) {
      this.feedback.error('El código de invitación no es válido');
      return;
    }

    this.joining.set(true);
    this.orgs.join(token).subscribe({
      next: () => {
        this.joining.set(false);
        this.joinToken.set('');
        this.feedback.success('Te uniste a la organización');
        this.load();
      },
      error: err => {
        this.joining.set(false);
        this.feedback.error(err);
      },
    });
  }
}
