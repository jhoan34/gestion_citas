// ======================================================
// ENTRY POINT del seed: `npx prisma db seed`
// - Siempre ejecuta el seed BASE (apto prod).
// - El seed DEMO solo corre con SEED_DEMO=true.
// - SEED_RESET_DEMO=true borra únicamente datos demo (.test).
// ======================================================

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { seedBase } from "./seeds/base.js";
import { resetDemo, seedDemo } from "./seeds/demo.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("Falta DATABASE_URL en el entorno (.env)");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  const withDemo = process.env.SEED_DEMO === "true";
  const resetOnly = process.env.SEED_RESET_DEMO === "true";

  if (resetOnly) {
    console.log("→ SEED_RESET_DEMO=true: borrando solo datos demo...");
    await resetDemo(prisma);
    console.log("✓ Demo eliminada.");
    return;
  }

  await seedBase(prisma);

  if (withDemo) {
    await seedDemo(prisma);
  } else {
    console.log("ℹ Demo omitida. Usa SEED_DEMO=true npx prisma db seed para datos de prueba.");
  }
}

try {
  await main();
} catch (e) {
  console.error("✗ Seed falló:", e);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
