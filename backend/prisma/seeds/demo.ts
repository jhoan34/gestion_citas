// ======================================================
// SEED DEMO (solo test, NO producción)
// Se ejecuta únicamente con SEED_DEMO=true.
// Todo lo demo lleva marca .test@example.com / +51 9xx / user_test_*
// para poder identificarlo y borrarlo con resetDemo().
// Idempotente: primero limpia restos demo y luego crea todo.
// ======================================================

import type { PrismaClient } from "../../src/generated/prisma/client.js";

// ---------- Catálogo generalista demo ----------

const DEMO_CATEGORIES = [
  { name: "Salud", description: "Consultas médicas, odontología y especialidades" },
  { name: "Belleza y Peluquería", description: "Corte, color, peinado y barbería" },
  { name: "Bienestar", description: "Psicología, fisioterapia y masajes" },
  { name: "Consultoría Profesional", description: "Asesoría legal, contable y coaching" },
  { name: "Educación", description: "Tutorías, idiomas y formación" },
  { name: "Servicios Técnicos", description: "Reparación y mantenimiento a domicilio" },
] as const;

const DEMO_SERVICES = [
  { name: "Consulta general", description: "Consulta médica general de evaluación", duration_minutes: 30, price: 60, category: "Salud" },
  { name: "Limpieza dental", description: "Profilaxis e higiene dental completa", duration_minutes: 45, price: 80, category: "Salud" },
  { name: "Corte de cabello", description: "Corte y acabado profesional", duration_minutes: 30, price: 25, category: "Belleza y Peluquería" },
  { name: "Color + peinado", description: "Coloración completa con peinado", duration_minutes: 90, price: 70, category: "Belleza y Peluquería" },
  { name: "Afeitado barbería", description: "Afeitado clásico con toalla caliente", duration_minutes: 20, price: 15, category: "Belleza y Peluquería" },
  { name: "Sesión de psicología", description: "Sesión individual de 50 minutos", duration_minutes: 50, price: 70, category: "Bienestar" },
  { name: "Masaje relajante", description: "Masaje corporal relajante de 1 hora", duration_minutes: 60, price: 55, category: "Bienestar" },
  { name: "Asesoría legal", description: "Consulta legal inicial", duration_minutes: 45, price: 90, category: "Consultoría Profesional" },
  { name: "Asesoría contable", description: "Revisión contable y tributaria", duration_minutes: 60, price: 75, category: "Consultoría Profesional" },
  { name: "Tutoría de matemáticas", description: "Clase particular de matemáticas", duration_minutes: 60, price: 30, category: "Educación" },
  { name: "Clase de inglés", description: "Clase conversacional de inglés", duration_minutes: 45, price: 35, category: "Educación" },
  { name: "Reparación a domicilio", description: "Visita técnica de reparación general", duration_minutes: 60, price: 40, category: "Servicios Técnicos" },
] as const;

// ---------- Usuarios / proveedores / clientes demo ----------

const DEMO_USERS = [
  { clerkid: "user_test_admin_001", email: "admin.test@example.com", fullname: "Ada Admin (test)", phone: "+51 900 000 001", role: "admin" },
  { clerkid: "user_test_recep_001", email: "recepcion.test@example.com", fullname: "Rita Recepcionista (test)", phone: "+51 900 000 002", role: "recepcionista" },
  { clerkid: "user_test_prov_001", email: "proveedor.salud.test@example.com", fullname: "Dr. Demo Salud (test)", phone: "+51 900 000 011", role: "provider" },
  { clerkid: "user_test_prov_002", email: "proveedor.belleza.test@example.com", fullname: "Beto Barbería (test)", phone: "+51 900 000 012", role: "provider" },
  { clerkid: "user_test_prov_003", email: "proveedor.consult.test@example.com", fullname: "Ceci Consultora (test)", phone: "+51 900 000 013", role: "provider" },
] as const;

const DEMO_PROVIDERS = [
  {
    phone: "+51 911 111 001",
    userClerk: "user_test_prov_001",
    name: "Clínica Demo Salud",
    description: "Centro de salud de prueba para validar reservas",
    business_name: "Clínica Demo Salud S.A.C.",
    address: "Av. Prueba 123, Lima",
    services: ["Consulta general", "Limpieza dental"],
  },
  {
    phone: "+51 911 111 002",
    userClerk: "user_test_prov_002",
    name: "Barbería Demo Centro",
    description: "Barbería de prueba para validar agenda por slots",
    business_name: "Barbería Demo Centro E.I.R.L.",
    address: "Jr. Ensayo 456, Lima",
    services: ["Corte de cabello", "Afeitado barbería", "Color + peinado"],
  },
  {
    phone: "+51 911 111 003",
    userClerk: "user_test_prov_003",
    name: "Consultora Demo",
    description: "Consultora de prueba para servicios profesionales",
    business_name: "Consultora Demo S.A.C.",
    address: "Calle Muestra 789, Lima",
    services: ["Asesoría legal", "Asesoría contable"],
  },
] as const;

const DEMO_CLIENTS = [
  { name: "Cliente Uno (test)", email: "cliente1.test@example.com", phone: "+51 922 222 001" },
  { name: "Cliente Dos (test)", email: "cliente2.test@example.com", phone: "+51 922 222 002" },
  { name: "Cliente Tres (test)", email: "cliente3.test@example.com", phone: "+51 922 222 003" },
  { name: "Cliente Cuatro (test)", email: "cliente4.test@example.com", phone: "+51 922 222 004" },
  { name: "Cliente Cinco (test)", email: "cliente5.test@example.com", phone: "+51 922 222 005" },
] as const;

// ---------- Helpers de fecha ----------

/** Fecha local del día (hoy + offset) a la hora indicada. */
function dayAt(offsetDays: number, hour: number, minute = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

// ---------- Limpieza demo ----------

const TEST_PROVIDER_PHONES = DEMO_PROVIDERS.map((p) => p.phone);
const TEST_USER_IDS = DEMO_USERS.map((u) => u.clerkid);
const TEST_CLIENT_EMAILS = DEMO_CLIENTS.map((c) => c.email);
const DEMO_SERVICE_NAMES = DEMO_SERVICES.map((s) => s.name);
const DEMO_CATEGORY_NAMES = DEMO_CATEGORIES.map((c) => c.name);

export async function resetDemo(prisma: PrismaClient) {
  // Orden inverso a las FK. Todo filtrado por marcas test.
  const testProviders = await prisma.services_providers.findMany({
    where: { phone: { in: TEST_PROVIDER_PHONES } },
    select: { id: true },
  });
  const providerIds = testProviders.map((p) => p.id);

  if (providerIds.length > 0) {
    const avails = await prisma.availabilities.findMany({
      where: { service_provider_id: { in: providerIds } },
      select: { id: true },
    });
    const availIds = avails.map((a) => a.id);

    if (availIds.length > 0) {
      const slots = await prisma.slots.findMany({
        where: { availability_id: { in: availIds } },
        select: { id: true },
      });
      const slotIds = slots.map((s) => s.id);
      if (slotIds.length > 0) {
        await prisma.reservations.deleteMany({ where: { slot_id: { in: slotIds } } });
      }
      await prisma.slots.deleteMany({ where: { availability_id: { in: availIds } } });
    }
    await prisma.availabilities.deleteMany({ where: { service_provider_id: { in: providerIds } } });
  }

  // Reservas que apunten a clientes test por si quedó alguna huérfana de slot
  const testClients = await prisma.clients.findMany({
    where: { email: { in: TEST_CLIENT_EMAILS } },
    select: { id: true },
  });
  if (testClients.length > 0) {
    await prisma.reservations.deleteMany({
      where: { client_id: { in: testClients.map((c) => c.id) } },
    });
  }

  await prisma.notifications.deleteMany({ where: { user_id: { in: TEST_USER_IDS } } });
  await prisma.audit_logs.deleteMany({ where: { user_id: { in: TEST_USER_IDS } } });
  await prisma.services_providers.deleteMany({ where: { phone: { in: TEST_PROVIDER_PHONES } } });
  await prisma.services.deleteMany({ where: { name: { in: DEMO_SERVICE_NAMES } } });
  await prisma.services_categories.deleteMany({ where: { name: { in: DEMO_CATEGORY_NAMES } } });
  await prisma.clients.deleteMany({ where: { email: { in: TEST_CLIENT_EMAILS } } });
  await prisma.user.deleteMany({ where: { clerkid: { in: TEST_USER_IDS } } });
}

// ---------- Seed demo ----------

export async function seedDemo(prisma: PrismaClient) {
  console.log("→ [demo] limpiando restos demo previos...");
  await resetDemo(prisma);

  console.log("→ [demo] categorías...");
  for (const c of DEMO_CATEGORIES) {
    await prisma.services_categories.upsert({
      where: { name: c.name },
      update: { description: c.description },
      create: { name: c.name, description: c.description },
    });
  }
  const categories = await prisma.services_categories.findMany({
    where: { name: { in: DEMO_CATEGORY_NAMES } },
  });
  const catId = new Map(categories.map((c) => [c.name, c.id]));

  console.log("→ [demo] servicios...");
  for (const s of DEMO_SERVICES) {
    const category_id = catId.get(s.category);
    if (category_id === undefined) throw new Error(`Categoría demo no encontrada: ${s.category}`);
    await prisma.services.upsert({
      where: { name: s.name },
      update: {
        description: s.description,
        duration_minutes: s.duration_minutes,
        price: s.price,
        category_id,
        is_active: true,
      },
      create: {
        name: s.name,
        description: s.description,
        duration_minutes: s.duration_minutes,
        price: s.price,
        category_id,
        is_active: true,
      },
    });
  }
  const services = await prisma.services.findMany({
    where: { name: { in: DEMO_SERVICE_NAMES } },
    select: { id: true, name: true },
  });
  const serviceId = new Map(services.map((s) => [s.name, s.id]));

  console.log("→ [demo] usuarios test...");
  const roles = await prisma.roles.findMany();
  const roleId = new Map(roles.map((r) => [r.name, r.id]));
  for (const u of DEMO_USERS) {
    const rId = roleId.get(u.role);
    if (rId === undefined) throw new Error(`Rol no encontrado para demo: ${u.role} (corre el seed base primero)`);
    await prisma.user.upsert({
      where: { clerkid: u.clerkid },
      update: { email: u.email, fullname: u.fullname, phone: u.phone, role_id: rId, is_active: true },
      create: {
        clerkid: u.clerkid,
        email: u.email,
        fullname: u.fullname,
        phone: u.phone,
        role_id: rId,
        is_active: true,
      },
    });
  }

  console.log("→ [demo] proveedores + M2M servicios...");
  for (const p of DEMO_PROVIDERS) {
    const svcIds = p.services.map((name) => {
      const id = serviceId.get(name);
      if (id === undefined) throw new Error(`Servicio demo no encontrado: ${name}`);
      return { id };
    });
    await prisma.services_providers.upsert({
      where: { phone: p.phone },
      update: {
        user_id: p.userClerk,
        name: p.name,
        description: p.description,
        business_name: p.business_name,
        address: p.address,
        is_active: true,
        services: { set: [], connect: svcIds },
      },
      create: {
        user_id: p.userClerk,
        name: p.name,
        description: p.description,
        business_name: p.business_name,
        phone: p.phone,
        address: p.address,
        is_active: true,
        services: { connect: svcIds },
      },
    });
  }
  const providers = await prisma.services_providers.findMany({
    where: { phone: { in: TEST_PROVIDER_PHONES } },
    select: { id: true, phone: true },
  });

  console.log("→ [demo] clientes...");
  for (const c of DEMO_CLIENTS) {
    await prisma.clients.upsert({
      where: { email: c.email },
      update: { name: c.name, phone: c.phone },
      create: { name: c.name, email: c.email, phone: c.phone },
    });
  }
  const clients = await prisma.clients.findMany({
    where: { email: { in: TEST_CLIENT_EMAILS } },
    orderBy: { email: "asc" },
  });

  console.log("→ [demo] disponibilidades (mañana y pasado, 09-13 y 14-17)...");
  const availabilities: { id: number; service_provider_id: number; start: Date; end: Date }[] = [];
  for (const pv of providers) {
    for (const dayOffset of [1, 2]) {
      for (const [hStart, hEnd] of [[9, 13], [14, 17]] as const) {
        const start = dayAt(dayOffset, hStart);
        const end = dayAt(dayOffset, hEnd);
        const a = await prisma.availabilities.create({
          data: { service_provider_id: pv.id, start_time: start, end_time: end, is_available: true },
        });
        availabilities.push({ id: a.id, service_provider_id: pv.id, start, end });
      }
    }
  }

  console.log("→ [demo] slots cada 30 min...");
  const SLOT_MIN = 30;
  let slotCount = 0;
  for (const a of availabilities) {
    for (let t = a.start; addMinutes(t, SLOT_MIN) <= a.end; t = addMinutes(t, SLOT_MIN)) {
      await prisma.slots.create({
        data: {
          availability_id: a.id,
          start_time: t,
          end_time: addMinutes(t, SLOT_MIN),
          status: "available",
        },
      });
      slotCount++;
    }
  }

  console.log("→ [demo] reservas de ejemplo...");
  const providerByPhone = new Map(providers.map((p) => [p.phone, p.id]));
  const barberiaId = providerByPhone.get("+51 911 111 002");
  const clinicaId = providerByPhone.get("+51 911 111 001");
  const consultoraId = providerByPhone.get("+51 911 111 003");
  if (barberiaId === undefined || clinicaId === undefined || consultoraId === undefined) {
    throw new Error("Proveedores demo no encontrados tras crearlos");
  }
  const corteId = serviceId.get("Corte de cabello");
  const consultaId = serviceId.get("Consulta general");
  const legalId = serviceId.get("Asesoría legal");
  if (corteId === undefined || consultaId === undefined || legalId === undefined) {
    throw new Error("Servicios demo no encontrados tras crearlos");
  }
  const freeSlots = await prisma.slots.findMany({
    where: {
      status: "available",
      availability: { service_provider_id: { in: [barberiaId, clinicaId, consultoraId] } },
    },
    include: { availability: { select: { service_provider_id: true } } },
    orderBy: { start_time: "asc" },
    take: 12,
  });
  const pickSlotFor = (providerId: number, used: Set<number>) => {
    const s = freeSlots.find((x) => x.availability.service_provider_id === providerId && !used.has(x.id));
    if (!s) throw new Error("Sin slots libres demo para armar reservas (inconsistencia)");
    used.add(s.id);
    return s.id;
  };
  const used = new Set<number>();
  const getClient = (i: number) => {
    const c = clients[i];
    if (!c) throw new Error("Faltan clientes demo");
    return c.id;
  };

  const demoReservations = [
    { provider: barberiaId, service: corteId, client: getClient(0), status: "pending", notes: "Reserva demo pendiente de confirmación" },
    { provider: clinicaId, service: consultaId, client: getClient(1), status: "confirmed", notes: "Reserva demo confirmada" },
    { provider: consultoraId, service: legalId, client: getClient(2), status: "cancelled", notes: "Reserva demo cancelada (slot liberado)" },
    { provider: barberiaId, service: corteId, client: getClient(3), status: "completed", notes: "Reserva demo completada" },
  ] as const;

  const createdReservationIds: number[] = [];
  for (const r of demoReservations) {
    const slot_id = pickSlotFor(r.provider, used);
    const created = await prisma.reservations.create({
      data: {
        client_id: r.client,
        slot_id,
        service_provider_id: r.provider,
        service_id: r.service,
        status: r.status,
        notes: r.notes,
      },
    });
    createdReservationIds.push(created.id);
    // pending/confirmed/completed ocupan el slot; cancelled lo libera
    await prisma.slots.update({
      where: { id: slot_id },
      data: { status: r.status === "cancelled" ? "available" : "booked" },
    });
  }

  console.log("→ [demo] notificaciones + auditoría...");
  await prisma.notifications.createMany({
    data: [
      {
        user_id: "user_test_prov_002",
        type: "reservation_created",
        title: "Nueva reserva demo",
        message: "Tienes una reserva pendiente de confirmación (demo).",
        status: "unread",
      },
      {
        user_id: "user_test_recep_001",
        type: "reservation_confirmed",
        title: "Reserva confirmada (demo)",
        message: "La reserva de Clínica Demo Salud fue confirmada.",
        status: "unread",
      },
      {
        user_id: "user_test_admin_001",
        type: "reservation_cancelled",
        title: "Reserva cancelada (demo)",
        message: "Se liberó un slot de Consultora Demo.",
        status: "read",
      },
    ],
  });
  const firstReservationId = createdReservationIds[0];
  if (firstReservationId === undefined) throw new Error("No se crearon reservas demo");
  await prisma.audit_logs.createMany({
    data: [
      {
        user_id: "user_test_admin_001",
        action: "seed",
        entity: "Roles",
        entity_id: 0,
        changes: JSON.stringify({ seed: "base+demo", note: "Seed demo ejecutado" }),
      },
      {
        user_id: "user_test_recep_001",
        action: "create",
        entity: "Reservations",
        entity_id: firstReservationId,
        changes: JSON.stringify({ status: "pending", note: "Reserva demo creada por seed" }),
      },
      {
        user_id: "user_test_prov_002",
        action: "update",
        entity: "Slots",
        entity_id: 0,
        changes: JSON.stringify({ status: "booked", note: "Slot ocupado por reserva demo" }),
      },
    ],
  });

  console.log(
    `✓ [demo] ${DEMO_CATEGORIES.length} categorías, ${DEMO_SERVICES.length} servicios, ` +
      `${DEMO_USERS.length} usuarios, ${DEMO_PROVIDERS.length} proveedores, ` +
      `${DEMO_CLIENTS.length} clientes, ${availabilities.length} disponibilidades, ` +
      `${slotCount} slots, ${demoReservations.length} reservas.`,
  );
}
