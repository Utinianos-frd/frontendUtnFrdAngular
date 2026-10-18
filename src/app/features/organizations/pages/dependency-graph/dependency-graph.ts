import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DialogModule } from 'primeng/dialog';
import { SelectModule } from 'primeng/select';
import {
  DependencyType, DEPENDENCY_TYPE_LABELS, Group, GroupMember, Organization, Project,
  Task, TaskDependency, TaskStatus, TASK_STATUS_LABELS,
} from '../../../../core/models';
import { AuthService } from '../../../../core/services/auth.service';
import { GroupsService } from '../../../../core/services/groups.service';
import { OrganizationsService } from '../../../../core/services/organizations.service';
import { ProjectsService } from '../../../../core/services/projects.service';
import { TaskPath, TasksService } from '../../../../core/services/tasks.service';
import { Feedback } from '../../../../shared/ui/feedback';

// Geometría del layout (px).
const NODE_W = 210;
const NODE_H = 68;
const GAP_X = 90;
const GAP_Y = 24;
const MARGIN = 28;

const STATUS_DOT: Record<TaskStatus, string> = {
  pending: 'var(--color-neutral-500)',
  in_progress: 'var(--color-accent)',
  done: 'var(--color-neutral-700)',
};

interface GraphNode {
  task: Task;
  x: number;
  y: number;
}

interface GraphEdge {
  dep: TaskDependency;
  d: string;
  color: string;
  dash: string;
  /** FF cuya tarea bloqueante aún no está "done". */
  pendingFF: boolean;
}

interface DepForm {
  blocking: number | null;
  blocked: number | null;
  type: DependencyType;
}

@Component({
  selector: 'app-dependency-graph',
  imports: [RouterLink, FormsModule, DialogModule, SelectModule],
  templateUrl: './dependency-graph.html',
})
export class DependencyGraph implements OnInit {
  orgId = input.required<string>();
  groupId = input.required<string>();
  projectId = input.required<string>();

  private orgsService = inject(OrganizationsService);
  private groupsService = inject(GroupsService);
  private projectsService = inject(ProjectsService);
  private tasksService = inject(TasksService);
  private auth = inject(AuthService);
  private feedback = inject(Feedback);

  readonly NODE_W = NODE_W;
  readonly NODE_H = NODE_H;
  readonly statusLabels = TASK_STATUS_LABELS;
  readonly typeLabels = DEPENDENCY_TYPE_LABELS;
  readonly typeOptions = (['FS', 'FF'] as DependencyType[]).map(value => ({ value, label: DEPENDENCY_TYPE_LABELS[value] }));

  org = signal<Organization | null>(null);
  group = signal<Group | null>(null);
  project = signal<Project | null>(null);
  tasks = signal<Task[]>([]);
  dependencies = signal<TaskDependency[]>([]);
  members = signal<GroupMember[]>([]);
  loading = signal(true);

  depDialogOpen = signal(false);
  savingDep = signal(false);
  form = signal<DepForm>({ blocking: null, blocked: null, type: 'FS' });

  private currentUserId = computed(() => this.auth.currentUser()?.id);
  isGroupLead = computed(() =>
    this.members().some(m => m.user_id === this.currentUserId() && m.role === 'group_lead')
  );

  statusDot(status: TaskStatus): string {
    return STATUS_DOT[status];
  }

  taskOptions = computed(() => this.tasks().map(t => ({ value: Number(t.id), label: t.title })));

  /** Nodos + aristas con posiciones calculadas (layout por capas tipo DAG). */
  graph = computed<{ nodes: GraphNode[]; edges: GraphEdge[]; width: number; height: number }>(() => {
    const tasks = this.tasks();
    const deps = this.dependencies();

    // Tareas por id; sintetiza nodos para extremos que no estén en el listado
    // (p. ej. a un contributor podría faltarle una de las dos tareas).
    const byId = new Map<number, Task>();
    for (const t of tasks) byId.set(Number(t.id), t);
    const ensure = (id: number, title: string) => {
      if (!byId.has(id)) {
        byId.set(id, { id: String(id), title, status: 'pending', project_id: 0, assignee_ids: [] });
      }
    };
    for (const d of deps) {
      ensure(d.blocking_task_id, d.blocking_task_title);
      ensure(d.blocked_task_id, d.blocked_task_title);
    }

    // Aristas válidas (ambos extremos presentes) y grado de entrada.
    const edgesRaw = deps.filter(d => byId.has(d.blocking_task_id) && byId.has(d.blocked_task_id));
    const parents = new Map<number, number[]>(); // blocked <- [blocking...]
    for (const id of byId.keys()) parents.set(id, []);
    for (const d of edgesRaw) parents.get(d.blocked_task_id)!.push(d.blocking_task_id);

    // Capa = camino más largo desde una raíz (longest-path layering). El backend
    // garantiza que no hay ciclos, pero igual usamos un guard por si acaso.
    const layerCache = new Map<number, number>();
    const inProgress = new Set<number>();
    const layerOf = (id: number): number => {
      if (layerCache.has(id)) return layerCache.get(id)!;
      if (inProgress.has(id)) return 0; // corta un ciclo inesperado
      inProgress.add(id);
      const ps = parents.get(id) ?? [];
      const layer = ps.length ? Math.max(...ps.map(p => layerOf(p) + 1)) : 0;
      inProgress.delete(id);
      layerCache.set(id, layer);
      return layer;
    };

    const ids = [...byId.keys()];
    const byLayer = new Map<number, number[]>();
    for (const id of ids) {
      const l = layerOf(id);
      if (!byLayer.has(l)) byLayer.set(l, []);
      byLayer.get(l)!.push(id);
    }

    // Posiciones.
    const pos = new Map<number, { x: number; y: number }>();
    let maxRow = 0;
    const layers = [...byLayer.keys()].sort((a, b) => a - b);
    for (const l of layers) {
      const col = byLayer.get(l)!;
      col.forEach((id, row) => {
        pos.set(id, {
          x: MARGIN + l * (NODE_W + GAP_X),
          y: MARGIN + row * (NODE_H + GAP_Y),
        });
        if (row > maxRow) maxRow = row;
      });
    }

    const nodes: GraphNode[] = ids.map(id => ({ task: byId.get(id)!, ...pos.get(id)! }));

    const edges: GraphEdge[] = edgesRaw.map(dep => {
      const a = pos.get(dep.blocking_task_id)!;
      const b = pos.get(dep.blocked_task_id)!;
      const x1 = a.x + NODE_W;
      const y1 = a.y + NODE_H / 2;
      const x2 = b.x - 4;
      const y2 = b.y + NODE_H / 2;
      const dx = Math.max(40, (x2 - x1) / 2);
      const d = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;

      const blockingDone = byId.get(dep.blocking_task_id)!.status === 'done';
      const pendingFF = dep.dependency_type === 'FF' && !blockingDone;
      let color = 'var(--color-accent)';
      if (dep.dependency_type === 'FF') color = pendingFF ? '#d29922' : 'var(--color-accent-300)';
      const dash = dep.dependency_type === 'FF' ? '6 5' : '';
      return { dep, d, color, dash, pendingFF };
    });

    const maxLayer = layers.length ? layers[layers.length - 1] : 0;
    const width = MARGIN * 2 + (maxLayer + 1) * NODE_W + maxLayer * GAP_X;
    const height = MARGIN * 2 + (maxRow + 1) * NODE_H + maxRow * GAP_Y;
    return { nodes, edges, width, height };
  });

  private get path(): TaskPath {
    return { orgId: this.orgId(), groupId: this.groupId(), projectId: this.projectId() };
  }

  ngOnInit(): void {
    const { orgId, groupId } = this.path;
    this.orgsService.get(orgId).subscribe({ next: o => this.org.set(o), error: () => {} });
    this.groupsService.get(orgId, groupId).subscribe({ next: g => this.group.set(g), error: () => {} });
    this.groupsService.members(orgId, groupId).subscribe({ next: m => this.members.set(m), error: () => {} });
    this.projectsService.get(orgId, groupId, this.projectId()).subscribe({ next: p => this.project.set(p), error: () => {} });
    this.reload();
  }

  private reload(): void {
    this.loading.set(true);
    this.tasksService.list(this.path).subscribe({
      next: tasks => {
        this.tasks.set(tasks);
        this.tasksService.listDependencies(this.path).subscribe({
          next: deps => {
            this.dependencies.set(deps);
            this.loading.set(false);
          },
          error: err => {
            this.loading.set(false);
            this.feedback.error(err);
          },
        });
      },
      error: err => {
        this.loading.set(false);
        this.feedback.error(err);
      },
    });
  }

  // Alta de dependencia

  openDepDialog(): void {
    this.form.set({ blocking: null, blocked: null, type: 'FS' });
    this.depDialogOpen.set(true);
  }

  updateForm(changes: Partial<DepForm>): void {
    this.form.update(f => ({ ...f, ...changes }));
  }

  saveDependency(): void {
    const { blocking, blocked, type } = this.form();
    if (blocking == null || blocked == null) return;

    this.savingDep.set(true);
    this.tasksService.createDependency(this.path, {
      blocking_task_id: blocking,
      blocked_task_id: blocked,
      dependency_type: type,
    }).subscribe({
      next: () => {
        this.savingDep.set(false);
        this.depDialogOpen.set(false);
        this.feedback.success('Dependencia creada');
        this.reload(); // el estado "blocked" de las tareas puede haber cambiado
      },
      error: err => {
        this.savingDep.set(false);
        this.feedback.error(err); // muestra el detalle del backend (ciclo, duplicada, etc.)
      },
    });
  }

  deleteDependency(dep: TaskDependency): void {
    this.feedback.confirmDelete(
      `¿Eliminar la dependencia "${dep.blocking_task_title}" → "${dep.blocked_task_title}"?`,
      () => {
        this.tasksService.deleteDependency(this.path, dep.id).subscribe({
          next: () => {
            this.feedback.success('Dependencia eliminada');
            this.reload();
          },
          error: err => this.feedback.error(err),
        });
      },
    );
  }
}
