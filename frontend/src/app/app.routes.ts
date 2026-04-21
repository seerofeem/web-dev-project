import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./components/home/home.component').then(m => m.HomeComponent)
  },
  {
    path: 'games/:id',
    loadComponent: () => import('./components/game-detail/game-detail.component').then(m => m.GameDetailComponent)
  },
  {
    path: 'steam/:appid',
    loadComponent: () => import('./components/game-detail/game-detail.component').then(m => m.GameDetailComponent)
  },
  {
    path: 'login',
    loadComponent: () => import('./components/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'profile',
    loadComponent: () => import('./components/profile/profile.component').then(m => m.ProfileComponent),
    canActivate: [authGuard]
  },
  { path: '**', redirectTo: '' }
];
