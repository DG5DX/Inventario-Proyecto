# Backend Inventario y Préstamos

API REST construida con Node.js, Express y MongoDB para gestionar inventario, aulas y préstamos con autenticación JWT, autorización por roles, recordatorios por correo y trabajos programados.

## Requisitos

- Node.js 18+
- MongoDB 5+

## Instalación

```bash
npm install
```

Variables clave:

- `MONGO_URI`: cadena de conexión a MongoDB.
- `JWT_SECRET`: secreto para firmar los tokens.
- `SMTP_*`: credenciales SMTP para envío de correos.
- `MAIL_FROM`: remitente de los correos.
- `PORT`: puerto del servidor HTTP.

## Scripts NPM

- `npm run dev`: inicia el servidor con nodemon.
- `npm start`: inicia el servidor en modo producción.
- `npm run seed`: carga datos iniciales (admin, usuarios demo, categorías, aulas e ítems).
- `npm test`: ejecuta pruebas unitarias e integrales.
- `npm run lint`: ejecuta ESLint.

## Ejecución

```bash
npm run dev
```

La API queda disponible en `http://localhost:3000` (o el puerto definido).

Se expone un endpoint de salud:

```
GET /health
```

## Autenticación

- Registro: `POST /api/auth/register`
- Login: `POST /api/auth/login`
- Perfil actual: `GET /api/auth/me`

El login devuelve un token JWT que debe enviarse en el header `Authorization: Bearer <token>`.

## Recursos principales

- Categorías (`/api/categorias`): CRUD solo para rol **Admin**.
- Aulas (`/api/aulas`): CRUD solo para rol **Admin**.
- Ítems (`/api/items`): lectura para cualquier usuario autenticado, gestión solo **Admin**.
- Préstamos (`/api/prestamos`):
  - Usuarios comunes crean solicitudes (`POST /api/prestamos`).
  - Admin gestiona estados (`/aprobar`, `/rechazar`, `/devolver`, `/aplazar`).
  - Recordatorios automáticos 24h antes de la fecha estimada.

## Ejemplos cURL

Autenticación:

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@demo.com","password":"Admin123!"}'
```

Crear préstamo (usuario común):

```bash
curl -X POST http://localhost:3000/api/prestamos \
  -H "Authorization: Bearer <TOKEN_USUARIO>" \
  -H "Content-Type: application/json" \
  -d '{"item":"<ITEM_ID>","aula":"<AULA_ID>","cantidad_prestamo":1}'
```

Aprobar préstamo (admin):

```bash
curl -X POST http://localhost:3000/api/prestamos/<ID>/aprobar \
  -H "Authorization: Bearer <TOKEN_ADMIN>" \
  -H "Content-Type: application/json" \
  -d '{"fecha_estimada":"2024-12-31T15:00:00.000Z"}'
```

## Pruebas

Las pruebas usan `mongodb-memory-server` y `supertest`.

```bash
npm test
```

## Seeds

```bash
npm run seed
```

Crea un administrador (`admin@demo.com / Admin123!`), un usuario común (`usuario@demo.com / Usuario123!`), categorías, aulas e ítems de ejemplo.

## Jobs

Se programa un recordatorio diario a las 09:00 (zona horaria configurable con `TZ`) para préstamos aprobados cuya fecha estimada esté dentro de las próximas 24 horas.