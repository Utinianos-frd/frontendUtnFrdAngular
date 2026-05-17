import { Routes } from "@angular/router";

export const routes: Routes = [
    {
        path: '',
        loadComponent: () => import('./pages/layout/layout').then(m => m.Layout),
        children: [
            { path: 'login', loadComponent: () => import('./pages/login/login').then(m => m.Login) },
            { path: '', redirectTo: 'login', pathMatch: 'full' }
        ]
    }
];
