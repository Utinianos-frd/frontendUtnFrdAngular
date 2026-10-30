import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { authInterceptor } from './auth.interceptor';
import { API_URL } from '../config';

const REFRESH_URL = `${API_URL}/auth/token/refresh`;
const ORGS_URL = `${API_URL}/organizations/`;

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let router: Router;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('agrega el header Authorization cuando hay token', () => {
    localStorage.setItem('token', 'access-1');

    http.get(ORGS_URL).subscribe();

    const req = httpMock.expectOne(ORGS_URL);
    expect(req.request.headers.get('Authorization')).toBe('Bearer access-1');
    req.flush({});
  });

  it('no agrega token al login', () => {
    localStorage.setItem('token', 'access-1');

    http.post(`${API_URL}/auth/login`, {}).subscribe();

    const req = httpMock.expectOne(`${API_URL}/auth/login`);
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('ante un 401 refresca el token y reintenta el request', () => {
    localStorage.setItem('token', 'viejo');
    localStorage.setItem('refresh_token', 'refresh-1');
    let body: unknown;

    http.get(ORGS_URL).subscribe(res => (body = res));

    httpMock.expectOne(ORGS_URL).flush(null, { status: 401, statusText: 'Unauthorized' });

    const refreshReq = httpMock.expectOne(REFRESH_URL);
    expect(refreshReq.request.body).toEqual({ refresh: 'refresh-1' });
    refreshReq.flush({ access: 'nuevo' });

    const retry = httpMock.expectOne(ORGS_URL);
    expect(retry.request.headers.get('Authorization')).toBe('Bearer nuevo');
    retry.flush({ data: [] });

    expect(body).toEqual({ data: [] });
    expect(localStorage.getItem('token')).toBe('nuevo');
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('varios 401 simultáneos comparten un único refresh', () => {
    localStorage.setItem('token', 'viejo');
    localStorage.setItem('refresh_token', 'refresh-1');

    http.get(`${API_URL}/a`).subscribe();
    http.get(`${API_URL}/b`).subscribe();

    httpMock.expectOne(`${API_URL}/a`).flush(null, { status: 401, statusText: 'Unauthorized' });
    httpMock.expectOne(`${API_URL}/b`).flush(null, { status: 401, statusText: 'Unauthorized' });

    httpMock.expectOne(REFRESH_URL).flush({ access: 'nuevo' });

    httpMock.expectOne(`${API_URL}/a`).flush({});
    httpMock.expectOne(`${API_URL}/b`).flush({});
  });

  it('si el refresh falla, cierra la sesión', () => {
    localStorage.setItem('token', 'viejo');
    localStorage.setItem('refresh_token', 'vencido');
    let failed = false;

    http.get(ORGS_URL).subscribe({ error: () => (failed = true) });

    httpMock.expectOne(ORGS_URL).flush(null, { status: 401, statusText: 'Unauthorized' });
    httpMock.expectOne(REFRESH_URL).flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(failed).toBe(true);
    expect(localStorage.getItem('token')).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(['/auth/login']);
  });

  it('sin refresh token guardado, cierra la sesión sin llamar al backend', () => {
    localStorage.setItem('token', 'viejo');

    http.get(ORGS_URL).subscribe({ error: () => {} });

    httpMock.expectOne(ORGS_URL).flush(null, { status: 401, statusText: 'Unauthorized' });
    httpMock.expectNone(REFRESH_URL);

    expect(router.navigate).toHaveBeenCalledWith(['/auth/login']);
  });

  it('otros errores pasan sin tocar la sesión', () => {
    localStorage.setItem('token', 'access-1');
    let status = 0;

    http.get(ORGS_URL).subscribe({ error: err => (status = err.status) });

    httpMock.expectOne(ORGS_URL).flush(null, { status: 403, statusText: 'Forbidden' });

    expect(status).toBe(403);
    expect(localStorage.getItem('token')).toBe('access-1');
  });
});
