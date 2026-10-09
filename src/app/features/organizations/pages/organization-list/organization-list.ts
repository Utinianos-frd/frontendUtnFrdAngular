import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Organization, ORG_ROLE_LABELS } from '../../../../core/models';
import { OrganizationsService } from '../../../../core/services/organizations.service';
import { Feedback } from '../../../../shared/ui/feedback';
import { NameDialog } from '../../../../shared/ui/name-dialog';

const TILE_COLORS = ['#0050EF', '#008A00', '#AA00FF', '#D80073', '#00ABA9', '#F0A30A'];

@Component({
  selector: 'app-organization-list',
  imports: [RouterLink, FormsModule, NameDialog],
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

  color(index: number): string {
    return TILE_COLORS[index % TILE_COLORS.length];
  }

  create(name: string): void {
    this.creating.set(true);
    this.orgs.create(name).subscribe({
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

  join(): void {
    // Acepta tanto el token solo como un link que lo contenga al final.
    const token = this.joinToken().trim().split('/').pop() ?? '';
    if (!token) return;

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
