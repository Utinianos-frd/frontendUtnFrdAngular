import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
    const authService = inject(AuthService);
    const token = authService.getToken();
    const isLogin = req.url.endsWith('/auth/login');

    if (token && !isLogin) {
        req = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
    }

    return next(req).pipe(
        catchError((err: HttpErrorResponse) => {
            if (err.status === 401 && !isLogin) {
                authService.logout();
            }
            return throwError(() => err);
        })
    );
};
