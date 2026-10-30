import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

// Endpoints de auth que no llevan token ni disparan un refresh al recibir 401.
const PUBLIC_AUTH_PATHS = ['/auth/login', '/auth/register', '/auth/token/refresh'];

const withToken = (req: HttpRequest<unknown>, token: string) =>
    req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });

export const authInterceptor: HttpInterceptorFn = (req, next) => {
    const authService = inject(AuthService);
    const token = authService.getToken();
    const isPublicAuth = PUBLIC_AUTH_PATHS.some(path => req.url.endsWith(path));

    if (isPublicAuth || !token) {
        return next(req);
    }

    return next(withToken(req, token)).pipe(
        catchError((err: HttpErrorResponse) => {
            if (err.status !== 401) {
                return throwError(() => err);
            }

            // Access token vencido: pedimos uno nuevo y reintentamos una sola vez.
            // Si el refresh también falla (vencido o inválido), cerramos la sesión.
            return authService.refreshAccessToken().pipe(
                catchError(refreshErr => {
                    authService.logout();
                    return throwError(() => refreshErr);
                }),
                switchMap(newToken => next(withToken(req, newToken)))
            );
        })
    );
};
