import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'login',
    loadComponent: () => import('./features/auth/login/login.component')
    .then(m => m.LoginComponent) },
  { path: 'register',
    loadComponent: () => import('./features/auth/register/register.component')
    .then(m => m.RegisterComponent) },
  { path: 'dashboard',
    loadComponent: () => import('./features/dashboard/dashboard.component')
    .then(m => m.DashboardComponent),
    canActivate: [authGuard] },
  { path: 'groups',
    loadComponent: () => import('./features/groups/group-list/group-list.component')
    .then(m => m.GroupListComponent),
    canActivate: [authGuard] },
  { path: 'groups/:id',
    loadComponent: () => import('./features/groups/group-detail/group-detail.component')
    .then(m => m.GroupDetailComponent),
    canActivate: [authGuard] },
  { path: '**', redirectTo: 'dashboard' }
];