import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login.component')
      .then(m => m.LoginComponent),
    data: { animation: 'LoginPage' }
  },
  {
    path: 'register',
    loadComponent: () => import('./features/auth/register/register.component')
      .then(m => m.RegisterComponent),
    data: { animation: 'RegisterPage' }
  },
  {
    path: 'onboarding',
    loadComponent: () => import('./features/onboarding/onboarding.component')
      .then(m => m.OnboardingComponent),
    canActivate: [authGuard],
    data: { animation: 'OnboardingPage' }
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./features/dashboard/dashboard.component')
      .then(m => m.DashboardComponent),
    canActivate: [authGuard],
    data: { animation: 'DashboardPage' }
  },
  {
    path: 'groups',
    loadComponent: () => import('./features/groups/group-list/group-list.component')
      .then(m => m.GroupListComponent),
    canActivate: [authGuard],
    data: { animation: 'GroupsPage' }
  },
  {
    path: 'groups/:id',
    loadComponent: () => import('./features/groups/group-detail/group-detail.component')
      .then(m => m.GroupDetailComponent),
    canActivate: [authGuard],
    data: { animation: 'GroupDetailPage' }
  },
  {
    path: 'profile',
    loadComponent: () => import('./features/profile/profile.component')
      .then(m => m.ProfileComponent),
    canActivate: [authGuard],
    data: { animation: 'ProfilePage' }
  },
  { path: '**', redirectTo: 'dashboard' }
];