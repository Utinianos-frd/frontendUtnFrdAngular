// URL relativa: las llamadas salen al mismo origen que la app y el dev-server
// las reenvía al backend (ver proxy.conf.json), evitando CORS. En producción,
// serví la app detrás de un reverse proxy que mande /api/v1 al backend.
export const API_URL = '/api/v1';
