import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { API_URL } from '../config';

interface JsonApiResource {
    id: string;
    type: string;
    attributes: Record<string, unknown>;
}

/** Convierte un recurso JSON:API ({ id, type, attributes }) en un objeto plano { id, ...attributes }. */
function flatten<T>(resource: JsonApiResource): T {
    return { id: resource.id, ...resource.attributes } as T;
}

/**
 * Cliente genérico para la API, que sigue la especificación JSON:API.
 * Las rutas son relativas a API_URL (por ejemplo, 'organizations/5/groups').
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
    private http = inject(HttpClient);

    list<T>(path: string): Observable<T[]> {
        return this.http
            .get<{ data: JsonApiResource[] }>(`${API_URL}/${path}`)
            .pipe(map(res => res.data.map(r => flatten<T>(r))));
    }

    get<T>(path: string): Observable<T> {
        return this.http
            .get<{ data: JsonApiResource }>(`${API_URL}/${path}`)
            .pipe(map(res => flatten<T>(res.data)));
    }

    create<T>(path: string, type: string, attributes: object): Observable<T> {
        return this.http
            .post<{ data: JsonApiResource }>(`${API_URL}/${path}`, { data: { type, attributes } })
            .pipe(map(res => flatten<T>(res.data)));
    }

    update<T>(path: string, type: string, attributes: object): Observable<T> {
        return this.http
            .patch<{ data: JsonApiResource }>(`${API_URL}/${path}`, { data: { type, attributes } })
            .pipe(map(res => flatten<T>(res.data)));
    }

    delete(path: string): Observable<void> {
        return this.http.delete<void>(`${API_URL}/${path}`);
    }

    /** POST sin body, para acciones como "regenerar invitación". Ignora la respuesta. */
    action(path: string): Observable<void> {
        return this.http.post(`${API_URL}/${path}`, null).pipe(map(() => undefined));
    }
}

/** Arma un mensaje legible a partir de un error de la API. */
export function apiErrorMessage(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
        if (err.status === 0) return 'No se pudo conectar con el servidor';
        const first = err.error?.errors?.[0];
        if (first?.detail) {
            const field = first.source?.pointer?.split('/').pop();
            return field && field !== 'attributes' ? `${field}: ${first.detail}` : first.detail;
        }
        return `Error ${err.status}`;
    }
    return 'Ocurrió un error inesperado';
}
