# 📦 Backend — Sistema de Gestión de Inventario y Préstamos

API REST construida con **Node.js + Express + MongoDB** para el Centro Agroturístico SENA Regional Santander.

---

## 📋 Tabla de Contenidos

- [Requisitos](#requisitos)
- [Instalación](#instalación)
- [Variables de entorno](#variables-de-entorno)
- [Scripts disponibles](#scripts-disponibles)
- [Estructura del proyecto](#estructura-del-proyecto)
- [API — Endpoints](#api--endpoints)
- [Autenticación](#autenticación)
- [Roles y permisos](#roles-y-permisos)
- [Ciclo de vida del préstamo](#ciclo-de-vida-del-préstamo)
- [Sistema de emails](#sistema-de-emails)
- [Pruebas](#pruebas)
- [Despliegue en producción](#despliegue-en-producción)

---

## Requisitos

| Herramienta | Versión mínima |
|---|---|
| Node.js | 18.0.0 |
| npm | 9.0.0 |
| MongoDB | 6.0 (local) o Atlas |
| Git | cualquier versión |

Verificar instalaciones:
```bash
node --version
npm --version
mongod --version
```

---

## Instalación

```bash
# 1. Clonar el repositorio
git clone https://github.com/DG5DX/Inventario-Proyecto.git
cd Inventario-Proyecto/backend

# 2. Instalar dependencias
npm install

# 3. Crear archivo de variables de entorno
cp .env.example .env
# Editar .env con los valores correctos (ver sección Variables de entorno)

# 4. Cargar datos iniciales
npm run seed

# 5. Iniciar el servidor
npm run dev        # desarrollo (hot-reload con nodemon)
npm start          # producción
```

El servidor queda disponible en `http://localhost:3000`.

---

## Variables de entorno

Crear un archivo `.env` en la raíz del backend con las siguientes variables:

```env
# Base de datos
MONGO_URI=mongodb://localhost:27017/inventario
# Para MongoDB Atlas: mongodb+srv://usuario:password@cluster.mongodb.net/inventario

# Seguridad
JWT_SECRET=cambia_esto_por_un_secreto_largo_y_aleatorio_de_al_menos_32_chars

# Servidor
PORT=3000
NODE_ENV=development

# Frontend (se usa para armar links en los correos)
FRONTEND_URL=http://localhost:5173

# Correo SMTP (Gmail con App Password recomendado)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=tu_correo@gmail.com
SMTP_PASS=xxxx_xxxx_xxxx_xxxx
MAIL_FROM="Sistema Inventario SENA <tu_correo@gmail.com>"

# Zona horaria para los cron jobs
TZ=America/Bogota

# Solo para seeds: permite ejecutar contra MongoDB Atlas
# SEEDS_ALLOW_CLOUD=true
```

> **Obtener App Password de Gmail:** Cuenta Google → Seguridad → Verificación en dos pasos → Contraseñas de aplicaciones.

---

## Scripts disponibles

```bash
npm run dev          # Servidor en desarrollo con nodemon (hot-reload)
npm start            # Servidor en producción
npm run seed         # Sembrar datos iniciales (no borra existentes)
npm run seed:reset   # Limpiar BD completa y resembrar desde cero
npm run seed:users   # Resembrar solo usuarios
npm run seed:cuentadantes  # Resembrar solo cuentadantes
npm run seed:zones   # Resembrar solo sedes
npm run seed:classrooms    # Resembrar solo ambientes
npm run seed:items   # Resembrar solo ítems
npm test             # Ejecutar suite de pruebas (Jest + Supertest)
npm run lint         # Análisis estático con ESLint
```

### Credenciales de prueba (después de `npm run seed`)

| Rol | Email | Contraseña |
|---|---|---|
| SuperAdmin | superadmin@inventario.com | SuperAdmin123! |
| Admin | admin@inventario.com | Admin1234! |
| Usuario | carlos.morales@inventario.com | User1234! |
| Usuario | laura.perez@inventario.com | User1234! |

---

## Estructura del proyecto

```
backend/
├── src/
│   ├── config/
│   │   ├── db.js              # Conexión a MongoDB
│   │   └── logger.js          # Configuración de Winston
│   ├── controllers/           # Lógica de cada recurso
│   │   ├── authController.js
│   │   ├── loanController.js
│   │   ├── itemController.js
│   │   ├── zoneController.js
│   │   ├── classroomController.js
│   │   ├── userController.js
│   │   └── cuentadanteController.js
│   ├── middlewares/
│   │   ├── authJWT.js         # Verificación de token JWT
│   │   ├── roleGuard.js       # Control de acceso por rol (RBAC)
│   │   ├── validate.js        # Procesa errores de express-validator
│   │   └── errorHandler.js    # Manejador global de errores
│   ├── models/                # Esquemas Mongoose
│   │   ├── User.js
│   │   ├── Zone.js
│   │   ├── Classroom.js
│   │   ├── Item.js
│   │   ├── Loan.js
│   │   ├── Cuentadante.js
│   │   └── PasswordReset.js
│   ├── routes/                # Definición de rutas Express
│   │   ├── index.js           # Agrupador de rutas /api
│   │   ├── authRoutes.js
│   │   ├── loanRoutes.js
│   │   ├── itemRoutes.js
│   │   ├── zoneRoutes.js
│   │   ├── classroomRoutes.js
│   │   ├── userRoutes.js
│   │   ├── cuentadanteRoutes.js
│   │   └── healthRoutes.js
│   ├── services/
│   │   ├── loanService.js     # Lógica de negocio de préstamos
│   │   └── mailService.js     # Envío de emails (Nodemailer)
│   ├── validators/            # Reglas express-validator
│   │   ├── authValidator.js
│   │   ├── loanValidator.js
│   │   ├── itemValidator.js
│   │   ├── zoneValidator.js
│   │   └── classroomValidator.js
│   ├── jobs/
│   │   └── reminderJob.js     # Cron jobs (recordatorios y vencimientos)
│   ├── tests/
│   │   ├── setup.js
│   │   ├── auth.test.js
│   │   ├── loans.test.js
│   │   └── items.test.js
│   └── app.js                 # Configuración de Express y middlewares
├── public/                    # Frontend compilado (build de producción)
├── seeds.js                   # Script de datos iniciales
├── migrate-activo.js          # Migración one-time: campo activo
├── server.js                  # Punto de entrada (conecta DB e inicia servidor)
├── package.json
└── .env                       # Variables de entorno (no subir al repo)
```

---

## API — Endpoints

Todos los endpoints protegidos requieren el header:
```
Authorization: Bearer <JWT>
```

### Autenticación — `/api/auth`

| Método | Ruta | Descripción | Acceso |
|---|---|---|---|
| POST | `/register` | Registro de nuevo usuario | Público |
| POST | `/login` | Inicio de sesión, devuelve JWT | Público |
| GET | `/me` | Perfil del usuario autenticado | Auth |
| POST | `/request-password-reset` | Solicitar enlace de recuperación | Público |
| GET | `/verify-reset-token/:token` | Verificar validez del token | Público |
| POST | `/reset-password` | Restablecer contraseña con token | Público |
| POST | `/hint-email` | Buscar cuenta por nombre (email enmascarado) | Público |
| POST | `/send-email-hint` | Enviar correo con la dirección al usuario | Público |

### Sedes — `/api/zonas`

| Método | Ruta | Descripción | Acceso |
|---|---|---|---|
| GET | `/` | Listar sedes activas | Auth |
| POST | `/` | Crear sede | SuperAdmin |
| PUT | `/:id` | Actualizar sede | SuperAdmin |
| DELETE | `/:id` | Inhabilitar sede (cascade) | SuperAdmin |
| PATCH | `/:id/reactivar` | Reactivar sede inhabilitada | SuperAdmin |

### Ambientes — `/api/aulas`

| Método | Ruta | Descripción | Acceso |
|---|---|---|---|
| GET | `/` | Listar ambientes activos (filtro: `?zona=id`) | Auth |
| POST | `/` | Crear ambiente | SuperAdmin |
| PUT | `/:id` | Actualizar ambiente | SuperAdmin |
| DELETE | `/:id` | Inhabilitar ambiente (cascade) | SuperAdmin |
| PATCH | `/:id/reactivar` | Reactivar ambiente | SuperAdmin |

### Ítems — `/api/items`

| Método | Ruta | Descripción | Acceso |
|---|---|---|---|
| GET | `/` | Listar ítems activos (filtros: `?zona=`, `?aula=`, `?q=`) | Auth |
| GET | `/:id` | Detalle de un ítem | Auth |
| POST | `/` | Crear ítem | Admin |
| PUT | `/:id` | Actualizar ítem | Admin |
| DELETE | `/:id` | Inhabilitar ítem | Admin |
| PATCH | `/:id/reactivar` | Reactivar ítem | SuperAdmin |
| POST | `/bulk` | Carga masiva desde Excel (máx. 500 filas) | Admin |
| GET | `/:id/stock-info` | Info de stock con unidades en préstamo | Admin |
| POST | `/:id/ajuste-stock` | Ajuste manual: `entrada`, `baja` o `ajuste` | Admin |

### Préstamos — `/api/prestamos`

| Método | Ruta | Descripción | Acceso |
|---|---|---|---|
| GET | `/` | Listar préstamos (scope automático por rol) | Auth |
| GET | `/:id` | Detalle de un préstamo | Auth |
| POST | `/` | Crear solicitud de préstamo | Comun |
| POST | `/:id/aprobar` | Aprobar con cantidades y fecha | Admin |
| POST | `/:id/rechazar` | Rechazar con observación | Admin |
| POST | `/:id/aplazar` | Ampliar fecha estimada | Admin |
| POST | `/:id/notificar-devolucion` | Usuario notifica devolución (parcial/total) | Comun |
| POST | `/:id/confirmar-parcial` | Admin confirma recepción de un ítem | Admin |
| POST | `/:id/devolver` | Cierre manual del préstamo | Admin |
| POST | `/:id/forzar-cierre` | Forzar cierre por vencimiento | Admin |
| DELETE | `/:id` | Eliminar préstamo (solo no activos) | Admin |

### Usuarios — `/api/users`

| Método | Ruta | Descripción | Acceso |
|---|---|---|---|
| GET | `/` | Listar todos los usuarios | Admin |
| GET | `/:id` | Obtener usuario por ID | Admin |
| POST | `/` | Crear usuario (admin o superadmin) | SuperAdmin |
| PATCH | `/:id/role` | Cambiar rol de un usuario | SuperAdmin |

### Cuentadantes — `/api/cuentadantes`

| Método | Ruta | Descripción | Acceso |
|---|---|---|---|
| GET | `/` | Listar cuentadantes activos | Auth |
| POST | `/` | Crear cuentadante | Admin |
| PUT | `/:id` | Actualizar cuentadante | Admin |
| DELETE | `/:id` | Inhabilitar cuentadante | SuperAdmin |
| PATCH | `/:id/reactivar` | Reactivar cuentadante | SuperAdmin |

### Health — `/health`

| Método | Ruta | Descripción | Acceso |
|---|---|---|---|
| GET | `/` | Estado básico del servidor y DB | Público |
| GET | `/detailed` | Métricas detalladas (memoria, latencia DB, OS) | Público |
| GET | `/ready` | Readiness probe (Kubernetes/Docker) | Público |

---

## Autenticación

El sistema usa **JWT (JSON Web Token)** sin estado (stateless):

- El token se emite al hacer login o registro con expiración de **12 horas**.
- El payload contiene `{ sub: userId, rol: userRol }` firmado con `HS256`.
- El middleware `authJWT.js` verifica el token en cada petición protegida.
- Las contraseñas se almacenan con **bcrypt** (10 rondas de sal), nunca en texto plano.
- El reset de contraseña usa tokens criptográficamente seguros (`crypto.randomBytes`) de **un solo uso** con TTL de 1 hora.

---

## Roles y permisos

```
SuperAdmin  ─── hereda todo de Admin
    └── Admin  ─── hereda todo de Comun
            └── Comun
```

| Acción | Comun | Admin | SuperAdmin |
|---|:---:|:---:|:---:|
| Explorar catálogo | ✓ | ✓ | ✓ |
| Crear solicitud de préstamo | ✓ | ✓ | ✓ |
| Ver sus propios préstamos | ✓ | ✓ | ✓ |
| Notificar devolución | ✓ | ✓ | ✓ |
| Aprobar / rechazar préstamos | — | ✓ | ✓ |
| CRUD de ítems, ambientes | — | ✓ | ✓ |
| Ajuste de stock | — | ✓ | ✓ |
| CRUD de sedes | — | — | ✓ |
| Gestionar roles de usuario | — | — | ✓ |
| Reactivar elementos inhabilitados | — | — | ✓ |

---

## Ciclo de vida del préstamo

```
[Usuario crea] → Pendiente
                     │
          ┌──────────┴──────────┐
       Aprobado             Rechazado (terminal)
          │
     ┌────┴────┐
  Aplazado   Devuelto / Cerrado (terminal)
```

Los estados del **ítem dentro del préstamo** son independientes del estado del préstamo:
`Pendiente → Aprobado → Devuelto | Usado | Eliminado | Rechazado`

---

## Sistema de emails

Los correos se envían de forma **asíncrona** (`setImmediate`) para no bloquear la respuesta HTTP. Las notificaciones cubren:

| Evento | Destinatario |
|---|---|
| Nueva solicitud creada | Todos los admins |
| Préstamo aprobado | Usuario solicitante |
| Préstamo rechazado | Usuario solicitante |
| Préstamo aplazado | Usuario solicitante |
| Usuario notifica devolución | Todos los admins |
| Admin confirma devolución | Usuario solicitante |
| Recordatorio 24h antes (cron 9:00 AM) | Usuario |
| Alerta vencimiento (cron 10:00 AM) | Usuario + Admins |
| Reset de contraseña | Usuario |

---

## Pruebas

```bash
# Ejecutar todos los tests
npm test

# Las pruebas usan mongodb-memory-server (no requieren MongoDB real)
# y supertest para peticiones HTTP.

# Análisis de código
npm run lint
```

---

## Despliegue en producción

### Build completo (backend + frontend juntos)

```bash
# 1. Compilar el frontend
cd frontend
VITE_API_URL=/api npm run build

# 2. Copiar el build al backend
cp -r dist/ ../backend/public/

# 3. Configurar variables de producción en el servidor
NODE_ENV=production
MONGO_URI=mongodb+srv://...   # Atlas recomendado
JWT_SECRET=secreto_largo_y_seguro
FRONTEND_URL=https://tu-dominio.com
# ... resto de variables SMTP

# 4. Iniciar
npm start
```

El backend sirve automáticamente los archivos estáticos del frontend y aplica el fallback SPA a `index.html` para todas las rutas que no sean de la API.

### Recomendaciones de producción

- Usar **PM2** para gestión de procesos: `pm2 start server.js --name inventario`
- Configurar **Nginx** como proxy inverso (puerto 80/443 → 3000)
- Usar **MongoDB Atlas** con IP whitelist configurada
- Generar `JWT_SECRET` con: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`
- Activar logs en nivel `info` con `NODE_ENV=production`

---

## Migración de base de datos

Si actualizas desde una versión anterior que no tenía el campo `activo` en los modelos, ejecutar **una sola vez**:

```bash
node migrate-activo.js
```

Este script agrega `activo: true` a todos los documentos existentes de las colecciones `zones`, `classrooms`, `items` y `cuentadantes`. Es **idempotente**: no modifica documentos que ya tienen el campo.

---

*Centro Agroturístico SENA · Regional Santander · 2026*