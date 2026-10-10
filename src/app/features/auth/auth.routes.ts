import { Routes } from "@angular/router";

export const routes: Routes = [
    {
        path: '',
        loadComponent: () => import('./pages/layout/layout').then(m => m.Layout),
        children: [
            { path: 'login', loadComponent: () => import('./pages/login/login').then(m => m.Login) },
            { path: 'register', loadComponent: () => import('./pages/register/register').then(m => m.Register) },
            { path: '', redirectTo: 'login', pathMatch: 'full' }
        ]
    }
];
