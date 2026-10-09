import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { DialogModule } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { MultiSelectModule } from 'primeng/multiselect';
import { SelectModule } from 'primeng/select';
import {
  Group, GroupMember, Organization, Project, Task, TaskStatus, TASK_STATUS_LABELS,
} from '../../../../core/models';
import { AuthService } from '../../../../core/services/auth.service';
import { GroupsService } from '../../../../core/services/groups.service';
import { OrganizationsService } from '../../../../core/services/organizations.service';
import { ProjectsService } from '../../../../core/services/projects.service';
import { TaskPath, TasksService } from '../../../../core/services/tasks.service';
import { Feedback } from '../../../../shared/ui/feedback';
import { NameDialog } from '../../../../shared/ui/name-dialog';

const COLUMNS: { status: TaskStatus; color: string }[] = [
  { status: 'pending', color: '#0050EF' },
  { status: 'in_progress', color: '#00ABA9' },
  { status: 'done', color: '#008A00' },
];

interface TaskForm {
  title: string;
  status: TaskStatus;
  assignee_ids: number[];
}

@Component({
  selector: 'app-project-board',
  imports: [RouterLink, FormsModule, DialogModule, InputText, SelectModule, MultiSelectModule, NameDialog],
  templateUrl: './project-board.html',
})
export class ProjectBoard implements OnInit {
  orgId = input.required<string>();
  groupId = input.required<string>();
  projectId = input.required<string>();

  private orgsService = inject(OrganizationsService);
  private groupsService = inject(GroupsService);
  private projectsService = inject(ProjectsService);
  private tasksService = inject(TasksService);
  private auth = inject(AuthService);
  private feedback = inject(Feedback);
  private router = inject(Router);

  readonly statusLabels = TASK_STATUS_LABELS;
  readonly statusOptions = COLUMNS.map(c => ({ value: c.status, label: TASK_STATUS_LABELS[c.status] }));

  org = signal<Organization | null>(null);
  group = signal<Group | null>(null);
  project = signal<Project | null>(null);
  tasks = signal<Task[]>([]);
  members = signal<GroupMember[]>([]);
  loading = signal(true);

  // Diálogo de tarea
  taskDialogOpen = signal(false);
  editingTask = signal<Task | null>(null);
  form = signal<TaskForm>({ title: '', status: 'pending', assignee_ids: [] });
  savingTask = signal(false);

  // Diálogo de nombre del proyecto
  projectDialogOpen = signal(false);
  savingProject = signal(false);

  currentUserId = computed(() => this.auth.currentUser()?.id);
  isOrgOwner = computed(() => this.org()?.role === 'owner');
  isGroupLead = computed(() =>
    this.members().some(m => m.user_id === this.currentUserId() && m.role === 'group_lead')
  );
  isGroupMember = computed(() => this.members().some(m => m.user_id === this.currentUserId()));

  memberOptions = computed(() => this.members().map(m => ({ value: m.user_id, label: m.username })));
  private usernames = computed(() => new Map(this.members().map(m => [m.user_id, m.username])));

  columns = computed(() =>
    COLUMNS.map(col => {
      const tasks = this.tasks().filter(t => t.status === col.status);
      return { ...col, label: TASK_STATUS_LABELS[col.status], tasks };
    })
  );

  private get path(): TaskPath {
    return { orgId: this.orgId(), groupId: this.groupId(), projectId: this.projectId() };
  }

  ngOnInit(): void {
    const { orgId, groupId, projectId } = this.path;
    this.orgsService.get(orgId).subscribe({ next: o => this.org.set(o), error: () => {} });
    this.groupsService.get(orgId, groupId).subscribe({ next: g => this.group.set(g), error: () => {} });
    this.groupsService.members(orgId, groupId).subscribe({ next: m => this.members.set(m), error: () => {} });
    this.projectsService.get(orgId, groupId, projectId).subscribe({
      next: project => {
        this.project.set(project);
        this.loading.set(false);
      },
      error: err => {
        this.loading.set(false);
        this.feedback.error(err);
      },
    });
    this.loadTasks();
  }

  private loadTasks(): void {
    this.tasksService.list(this.path).subscribe({
      next: tasks => this.tasks.set(tasks),
      error: err => this.feedback.error(err),
    });
  }

  assigneeInitials(task: Task): string[] {
    return task.assignee_ids.map(id => (this.usernames().get(id) ?? '?').slice(0, 2).toUpperCase());
  }

  assigneeNames(task: Task): string {
    return task.assignee_ids.map(id => this.usernames().get(id) ?? `#${id}`).join(', ');
  }

  // Crear / editar tarea

  openTaskDialog(task: Task | null = null, status: TaskStatus = 'pending'): void {
    this.editingTask.set(task);
    this.form.set(
      task
        ? { title: task.title, status: task.status, assignee_ids: [...task.assignee_ids] }
        : { title: '', status, assignee_ids: [] }
    );
    this.taskDialogOpen.set(true);
  }

  updateForm(changes: Partial<TaskForm>): void {
    this.form.update(f => ({ ...f, ...changes }));
  }

  saveTask(): void {
    const form = this.form();
    const title = form.title.trim();
    if (!title) return;

    const editing = this.editingTask();
    const request = editing
      ? this.tasksService.update(this.path, editing.id, { ...form, title })
      : this.tasksService.create(this.path, { title, assignee_ids: form.assignee_ids });

    this.savingTask.set(true);
    request.subscribe({
      next: saved => {
        // Al crear, el backend ignora el estado y la deja "pending"; si se eligió otro, lo actualizamos.
        if (!editing && form.status !== saved.status) {
          this.tasksService.update(this.path, saved.id, { status: form.status }).subscribe({
            next: () => this.loadTasks(),
            error: err => this.feedback.error(err),
          });
        }
        this.savingTask.set(false);
        this.taskDialogOpen.set(false);
        this.loadTasks();
        this.feedback.success(editing ? 'Tarea actualizada' : 'Tarea creada');
      },
      error: err => {
        this.savingTask.set(false);
        this.feedback.error(err);
      },
    });
  }

  changeStatus(task: Task, status: TaskStatus): void {
    if (status === task.status) return;
    // Actualización optimista: movemos la tarjeta y revertimos si falla.
    this.tasks.update(list => list.map(t => (t.id === task.id ? { ...t, status } : t)));
    this.tasksService.update(this.path, task.id, { status }).subscribe({
      error: err => {
        this.tasks.update(list => list.map(t => (t.id === task.id ? { ...t, status: task.status } : t)));
        this.feedback.error(err);
      },
    });
  }

  deleteTask(task: Task): void {
    this.feedback.confirmDelete(`¿Eliminar la tarea "${task.title}"?`, () => {
      this.tasksService.delete(this.path, task.id).subscribe({
        next: () => {
          this.tasks.update(list => list.filter(t => t.id !== task.id));
          this.feedback.success('Tarea eliminada');
        },
        error: err => this.feedback.error(err),
      });
    });
  }

  // Proyecto

  renameProject(name: string): void {
    const { orgId, groupId, projectId } = this.path;
    this.savingProject.set(true);
    this.projectsService.update(orgId, groupId, projectId, name).subscribe({
      next: project => {
        this.project.set(project);
        this.savingProject.set(false);
        this.projectDialogOpen.set(false);
        this.feedback.success('Proyecto actualizado');
      },
      error: err => {
        this.savingProject.set(false);
        this.feedback.error(err);
      },
    });
  }

  deleteProject(): void {
    const project = this.project();
    if (!project) return;
    const { orgId, groupId } = this.path;
    this.feedback.confirmDelete(`¿Eliminar el proyecto "${project.name}" y todas sus tareas?`, () => {
      this.projectsService.delete(orgId, groupId, project.id).subscribe({
        next: () => {
          this.feedback.success('Proyecto eliminado');
          this.router.navigate(['/organizations', orgId, 'groups', groupId]);
        },
        error: err => this.feedback.error(err),
      });
    });
  }
}
