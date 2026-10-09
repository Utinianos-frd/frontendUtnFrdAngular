import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
    { path: '', redirectTo: 'home', pathMatch: 'full' },
    {
        path: 'auth',
        loadChildren: () => import('./features/auth/auth.routes').then(m => m.routes)
    },
    {
        path: 'not-found',
        loadComponent: () => import('./features/not-found/not-found').then(m => m.NotFound)
    },
    {
        // Pantallas privadas: comparten la barra superior (Shell) y requieren login.
        path: '',
        canActivate: [authGuard],
        loadComponent: () => import('./features/shell/shell').then(m => m.Shell),
        children: [
            {
                path: 'home',
                loadComponent: () => import('./features/home/home').then(m => m.Home)
            },
            {
                path: 'organizations',
                loadComponent: () => import('./features/organizations/pages/organization-list/organization-list').then(m => m.OrganizationList)
            },
            {
                path: 'organizations/:orgId',
                loadComponent: () => import('./features/organizations/pages/organization-detail/organization-detail').then(m => m.OrganizationDetail)
            },
            {
                path: 'organizations/:orgId/groups/:groupId',
                loadComponent: () => import('./features/organizations/pages/group-detail/group-detail').then(m => m.GroupDetail)
            },
            {
                path: 'organizations/:orgId/groups/:groupId/projects/:projectId',
                loadComponent: () => import('./features/organizations/pages/project-board/project-board').then(m => m.ProjectBoard)
            },
        ]
    },
    { path: '**', redirectTo: 'not-found' }
];
