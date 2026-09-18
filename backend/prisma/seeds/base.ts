// ======================================================
// SEED BASE (apto para producción)
// Roles, permisos, matriz rol-permiso y config del sistema.
// Idempotente: usa upsert, se puede re-ejecutar sin duplicar.
// ======================================================

import type { PrismaClient } from "../../src/generated/prisma/client.js";

const ROLES = [
  { name: "admin", description: "Acceso total al sistema y su configuración" },
  { name: "provider", description: "Proveedor o profesional que ofrece servicios y gestiona su agenda" },
  { name: "cliente", description: "Cliente final que reserva y gestiona sus citas" },
  { name: "recepcionista", description: "Gestiona agenda, clientes y reservas sin acceso a configuración" },
] as const;

const PERMISSIONS = [
  // Usuarios y roles
  { name: "users:read", description: "Ver usuarios del sistema" },
  { name: "users:manage", description: "Crear, editar y desactivar usuarios" },
  { name: "roles:manage", description: "Gestionar roles y sus permisos" },
  // Servicios
  { name: "services:read", description: "Ver categorías y servicios" },
  { name: "services:manage", description: "Crear y editar servicios" },
  { name: "categories:manage", description: "Crear y editar categorías de servicios" },
  { name: "availabilities:manage", description: "Gestionar disponibilidades de proveedores" },
  // Reservas
  { name: "reservations:read", description: "Ver reservas" },
  { name: "reservations:create", description: "Crear reservas" },
  { name: "reservations:manage", description: "Confirmar, cancelar y editar reservas" },
  { name: "slots:manage", description: "Gestionar slots de la agenda" },
  { name: "clients:manage", description: "Gestionar ficha de clientes" },
  // Sistema
  { name: "config:manage", description: "Gestionar configuración del sistema" },
  { name: "audit:read", description: "Ver registros de auditoría" },
  { name: "notifications:read", description: "Ver notificaciones propias" },
] as const;

// Matriz rol -> permisos. Todo lo no listado = denegado.
const ROLE_MATRIX: Record<string, string[]> = {
  admin: PERMISSIONS.map((p) => p.name),
  provider: [
    "services:read",
    "availabilities:manage",
    "slots:manage",
    "reservations:read",
    "reservations:manage",
    "clients:manage",
    "notifications:read",
  ],
  recepcionista: [
    "users:read",
    "services:read",
    "availabilities:manage",
    "slots:manage",
    "reservations:read",
    "reservations:create",
    "reservations:manage",
    "clients:manage",
    "notifications:read",
  ],
  cliente: [
    "services:read",
    "reservations:read",
    "reservations:create",
    "notifications:read",
  ],
};

const SYSTEM_CONFIG = [
  { key: "app_name", value: "GestionCitas", description: "Nombre público de la aplicación" },
  { key: "booking_slot_minutes", value: "30", description: "Duración por defecto de cada slot en minutos" },
  { key: "cancellation_limit_hours", value: "24", description: "Horas mínimas antes de la cita para cancelar sin penalización" },
  { key: "default_timezone", value: "America/Lima", description: "Zona horaria por defecto para agenda y notificaciones" },
  { key: "max_advance_booking_days", value: "30", description: "Días máximos de anticipación para reservar" },
] as const;

export async function seedBase(prisma: PrismaClient) {
  console.log("→ [base] Roles...");
  for (const r of ROLES) {
    await prisma.roles.upsert({
      where: { name: r.name },
      update: { description: r.description },
      create: { name: r.name, description: r.description },
    });
  }

  console.log("→ [base] Permissions...");
  for (const p of PERMISSIONS) {
    await prisma.permissions.upsert({
      where: { name: p.name },
      update: { description: p.description },
      create: { name: p.name, description: p.description },
    });
  }

  console.log("→ [base] role_permissions...");
  const roles = await prisma.roles.findMany();
  const perms = await prisma.permissions.findMany();
  const roleId = new Map(roles.map((r) => [r.name, r.id]));
  const permId = new Map(perms.map((p) => [p.name, p.id]));

  for (const [roleName, permNames] of Object.entries(ROLE_MATRIX)) {
    const rId = roleId.get(roleName);
    if (rId === undefined) throw new Error(`Rol base no encontrado: ${roleName}`);
    for (const permName of permNames) {
      const pId = permId.get(permName);
      if (pId === undefined) throw new Error(`Permiso base no encontrado: ${permName}`);
      await prisma.role_permissions.upsert({
        where: { role_id_permission_id: { role_id: rId, permission_id: pId } },
        update: {},
        create: { role_id: rId, permission_id: pId },
      });
    }
  }

  console.log("→ [base] System_config...");
  for (const c of SYSTEM_CONFIG) {
    await prisma.system_config.upsert({
      where: { key: c.key },
      update: { value: c.value, description: c.description },
      create: { key: c.key, value: c.value, description: c.description },
    });
  }

  console.log(
    `✓ [base] ${ROLES.length} roles, ${PERMISSIONS.length} permisos, ` +
      `${Object.values(ROLE_MATRIX).reduce((n, a) => n + a.length, 0)} asignaciones, ` +
      `${SYSTEM_CONFIG.length} configs.`,
  );
}
