import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

export const adminGuard: CanActivateFn = () => {
  const router = inject(Router);
  const token = localStorage.getItem('token');
  const isAdmin = localStorage.getItem('is_admin') === 'true';

  if (!token) {
    router.navigate(['/login']);
    return false;
  }

  if (isAdmin) {
    return true;
  }

  router.navigate(['/']);
  return false;
};
