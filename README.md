# Tasker — Frontend (Angular)

Frontend de **Tasker**, hecho con Angular 21, PrimeNG y Tailwind CSS.

## Requisitos

- **Node.js** 20.19 o superior (recomendado: 22 LTS o 24). Verificá con `node -v`.
- **npm** (viene con Node).
- **Git**.
- El **backend** corriendo en `http://localhost:8000` (ver [Backend](#backend)).

No hace falta instalar Angular CLI de forma global: se usa con `npx ng` o con los scripts de npm.

## Levantar el proyecto

```bash
# 1. Clonar el repo
git clone https://github.com/Utinianos-frd/frontendUtnFrdAngular.git
cd frontendUtnFrdAngular

# 2. Instalar dependencias
npm install

# 3. Levantar el servidor de desarrollo
npm start
```

Abrí **http://localhost:4200**. Te va a redirigir a `/auth/login`.

La app se recarga sola cuando guardás cambios.

## Backend

El frontend consume la API en `http://localhost:8000/api/v1` (configurado en `src/app/core/services/auth.service.ts`, constante `API_URL`).

Antes de loguearte, asegurate de que el backend:

1. **Esté corriendo** en el puerto 8000. La documentación queda en http://localhost:8000/api/v1/docs/
2. **Tenga las migraciones aplicadas**:
   ```bash
   python manage.py migrate
   ```
3. **Tenga CORS habilitado** para `http://localhost:4200`.
4. **Tenga al menos un usuario.** Opciones:
   - `POST /api/v1/dev/seed`: crea una organización de prueba con un usuario por rol y devuelve las credenciales (solo con `DEBUG=True`).
   - `POST /api/v1/auth/register`: registra un usuario nuevo.

> El login pide **nombre de usuario** (no email) y contraseña.

### Probar el frontend sin backend

Para ver las pantallas protegidas sin loguearte, abrí la consola del navegador (F12) y ejecutá:

```js
localStorage.setItem('token', 'x')
```

Recargá y vas a poder entrar a `/home`. Las llamadas a la API van a fallar, pero se ve el diseño.
Para "cerrar sesión", hacé clic en el avatar o borrá el token con `localStorage.clear()`.

## Scripts útiles

| Comando         | Qué hace                                      |
| --------------- | --------------------------------------------- |
| `npm start`     | Servidor de desarrollo en `localhost:4200`    |
| `npm run build` | Compila para producción en `dist/`            |
| `npm test`      | Corre los tests unitarios (Vitest)            |

## Estructura

```
src/app/
├── core/
│   ├── config.ts       # API_URL
│   ├── models.ts       # interfaces (Organization, Group, Project, Task…) y etiquetas de roles/estados
│   ├── guards/         # authGuard: protege rutas si no hay token
│   ├── interceptors/   # agrega "Authorization: Bearer <token>" a cada request
│   └── services/
│       ├── api.service.ts            # cliente JSON:API genérico (list/get/create/update/delete)
│       ├── auth.service.ts           # login, logout, usuario actual
│       ├── organizations.service.ts  # organizaciones, miembros e invitaciones
│       ├── groups.service.ts         # grupos y sus miembros
│       ├── projects.service.ts
│       ├── tasks.service.ts
│       └── workload.service.ts       # carga de trabajo por grupo y por miembro
├── features/
│   ├── auth/           # layout + pantalla de login
│   ├── shell/          # barra superior común a las pantallas privadas
│   ├── home/           # dashboard "Inicio" (datos de ejemplo)
│   ├── organizations/  # ABMs: organizaciones → grupos → proyectos → tareas
│   ├── workload/       # panel de carga de trabajo
│   └── not-found/      # página 404
└── shared/
    ├── primeng/        # módulos de PrimeNG compartidos
    └── ui/             # NameDialog (diálogo de nombre) y Feedback (toasts y confirmaciones)
```

### Pantallas

| Ruta | Qué se hace |
| --- | --- |
| `/organizations` | Ver mis organizaciones, crear una, unirse con código de invitación |
| `/organizations/:orgId` | Editar/eliminar la org, ABM de grupos, roles de miembros, código de invitación |
| `/organizations/:orgId/groups/:groupId` | Editar/eliminar el grupo, ABM de proyectos, miembros del grupo |
| `.../projects/:projectId` | Tablero de tareas: crear, editar, asignar, cambiar estado, eliminar |
| `/workload?org=…&group=…` | Carga de trabajo de un grupo: tareas activas por miembro, estado (disponible/ocupado/sobrecargado), detalle de tareas y umbral de sobrecarga (owner). Solo owner, admins y líder del grupo |

### Permisos (los define el backend)

Los botones se muestran según tu rol, pero el que decide es el backend: si algo no está permitido, aparece su mensaje de error.

- **Owner de la org**: edita/elimina la organización, crea/edita/elimina grupos y proyectos, cambia roles en la organización (asignar "Owner" transfiere la propiedad), regenera/desactiva la invitación y **asigna el líder de cada grupo**. Puede elegir a cualquier miembro de la organización; si no estaba en el grupo, se suma solo, y el líder anterior pasa a contributor.
- **Owner/Admin**: ven todos los grupos, ven el código de invitación y pueden quitar miembros de la organización.
- **Group lead**: agrega miembros al grupo (como contributors), los quita y crea/edita/elimina tareas.
- **Contributor**: ve y cambia el estado solo de las tareas que tiene asignadas.

> Un grupo nuevo no tiene líder: el owner tiene que asignarlo para que se puedan sumar miembros y crear tareas.

Para probar cada rol, usá los usuarios que crea `POST /api/v1/dev/seed` (`owner`, `admin`, `member`, `grouplead`, `contributor`).

- Rutas en `src/app/app.routes.ts`.
- Configuración global (HttpClient, tema de PrimeNG, toasts) en `src/app/app.config.ts`.
- Estilos globales y tema claro/oscuro en `src/styles.css`.

## Problemas comunes

- **"No se pudo conectar con el servidor"** al loguearte: el backend no está corriendo en el puerto 8000.
- **Error de CORS en la consola**: falta habilitar `http://localhost:4200` en el backend.
- **"Credenciales inválidas"**: el usuario no existe (ver [Backend](#backend), punto 4).
- **El puerto 4200 está ocupado**: `npm start -- --port 4300`.
- **Errores raros después de un `git pull`**: volvé a correr `npm install`.
