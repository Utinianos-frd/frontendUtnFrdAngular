import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
    { path: '', redirectTo: 'home', pathMatch: 'full' },
    {
        path: 'home',
        canActivate: [authGuard],
        loadComponent: () => import('./features/home/home').then(m => m.Home)
    },
    {
        path: 'auth',
        loadChildren: () => import('./features/auth/auth.routes').then(m => m.routes)
    },
    {
        path: 'not-found',
        loadComponent: () => import('./features/not-found/not-found').then(m => m.NotFound)
    },
    { path: '**', redirectTo: 'not-found' }
];
