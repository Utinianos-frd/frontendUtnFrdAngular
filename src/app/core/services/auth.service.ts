import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { map, Observable, tap } from 'rxjs';
import { API_URL } from '../config';

const TOKEN_KEY = 'token';
const REFRESH_KEY = 'refresh_token';

interface Tokens {
    access: string;
    refresh?: string;
}

export interface CurrentUser {
    id: number;
    username: string;
    email: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
    private http = inject(HttpClient);
    private router = inject(Router);

    /** Usuario logueado. Se completa al llamar a loadCurrentUser(). */
    readonly currentUser = signal<CurrentUser | null>(null);

    login(username: string, password: string): Observable<void> {
        const body = { data: { type: 'sessions', attributes: { username, password } } };

        return this.http.post<any>(`${API_URL}/auth/login`, body).pipe(
            map(res => extractTokens(res)),
            tap(tokens => {
                localStorage.setItem(TOKEN_KEY, tokens.access);
                if (tokens.refresh) localStorage.setItem(REFRESH_KEY, tokens.refresh);
            }),
            map(() => undefined)
        );
    }

    loadCurrentUser(): Observable<CurrentUser> {
        return this.http.get<any>(`${API_URL}/auth/me`).pipe(
            map(res => ({ id: Number(res.data.id), ...res.data.attributes }) as CurrentUser),
            tap(user => this.currentUser.set(user))
        );
    }

    logout(): void {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(REFRESH_KEY);
        this.currentUser.set(null);
        this.router.navigate(['/auth/login']);
    }

    getToken(): string | null {
        return localStorage.getItem(TOKEN_KEY);
    }

    isLoggedIn(): boolean {
        return !!this.getToken();
    }
}

// La API sigue JSON:API, así que los tokens pueden venir en data.attributes, en meta o en la raíz.
function extractTokens(res: any): Tokens {
    const source = res?.data?.attributes ?? res?.meta ?? res ?? {};
    const access = source.access ?? source.access_token ?? source.token;
    const refresh = source.refresh ?? source.refresh_token;

    if (!access) {
        throw new Error('La respuesta del login no contiene un token de acceso');
    }
    return { access, refresh };
}
