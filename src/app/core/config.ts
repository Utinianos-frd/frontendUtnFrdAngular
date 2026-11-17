// URL relativa: las llamadas salen al mismo origen que la app y el dev-server
// las reenvía al backend (ver proxy.conf.json), evitando CORS. En producción,
// serví la app detrás de un reverse proxy que mande /api/v1 al backend.
export const API_URL = '/api/v1';

// Client ID de la app de Google (Google Cloud Console → APIs y servicios → Credenciales
// → ID de cliente de OAuth 2.0, tipo "Aplicación web"). No es un secreto: viaja al navegador.
// Tiene que coincidir con GOOGLE_CLIENT_ID del backend. Mientras esté vacío, el botón de
// "Continuar con Google" queda deshabilitado.
// Acordate de agregar el origen de la app (p. ej. http://localhost:4200) en "Orígenes de
// JavaScript autorizados" de ese ID de cliente.
export const GOOGLE_CLIENT_ID = '365531425287-ec6q19jk9rakcpfgvkavrodc6nln9b5l.apps.googleusercontent.com';
