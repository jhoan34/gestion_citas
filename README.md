# Gestión de Citas

Aplicación para administrar reservas y citas de servicios con proveedores, horarios disponibles y control de acceso por roles.

## Qué incluye

- Gestión de usuarios, roles y permisos (integrado con Clerk).
- Catálogo de categorías, servicios y proveedores.
- Disponibilidades por proveedor divididas en slots reservables.
- Registro de clientes, reservas, notificaciones y logs de auditoría.
- Tareas programadas con `cron` y almacenamiento de archivos con ImageKit.
- Empaquetado en un contenedor Docker único listo para desplegar en Render (`render.yaml`).

## Stack

- **Backend:** Express 5, TypeScript, Prisma 7, PostgreSQL (Neon), Clerk, ImageKit.
- **Frontend:** Vite, TypeScript.
- **Infraestructura:** Docker, Docker Compose, Render Blueprint.

## Cómo correrlo en local

### Con Docker

1. Crea `backend/.env` con las variables necesarias:
   ```env
   DATABASE_URL=postgresql://...
   CLERK_SECRET_KEY=...
   CLERK_PUBLISHABLE_KEY=...
   VITE_CLERK_PUBLISHABLE_KEY=...
   CLERK_WEBHOOK_SIGNING_SECRET=...
   FRONTEND_URL=http://localhost:4000
   ```
2. Levanta el servicio:
   ```bash
   docker compose up --build
   ```
   La aplicación queda disponible en `http://localhost:4000` (healthcheck en `/api/health`).

### Sin Docker

```bash
# Backend
cd backend
npm install
npx prisma generate
npm run dev

# Frontend (en otra terminal)
cd frontend
npm install
npm run dev
```
