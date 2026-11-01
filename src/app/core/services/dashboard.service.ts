import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Dashboard } from '../models';
import { ApiService } from './api.service';

/** Panel de inicio: agregados reales del usuario (GET /api/v1/dashboard). */
@Injectable({ providedIn: 'root' })
export class DashboardService {
    private api = inject(ApiService);

    get(): Observable<Dashboard> {
        return this.api.get<Dashboard>('dashboard');
    }
}
