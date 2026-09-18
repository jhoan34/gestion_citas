import express from "express"
import { db } from "../lib/db.js"
import { verifyWebhook } from "@clerk/express/webhooks";
import "dotenv/config";

const router = express.Router();

// El payload de Clerk por webhook usa snake_case.
// Solo se modelan los campos necesarios para sincronizar User.
interface ClerkWebhookUserData {
    id: string;
    primary_email_address_id?: string | null;
    email_addresses?: { id: string; email_address: string }[];
    first_name?: string | null;
    last_name?: string | null;
    phone_numbers?: { phone_number: string }[];
}

// Construye el payload exigido por schema.prisma:
// email (UNIQUE, requerido), fullname (requerido), phone (UNIQUE, opcional).
// Devuelve null si no hay email: sin él no se puede crear el User.
function toUserPayload(data: ClerkWebhookUserData) {
    const email =
        data.email_addresses?.find((e) => e.id === data.primary_email_address_id)?.email_address ??
        data.email_addresses?.[0]?.email_address ??
        null;
    if (!email) return null;

    const fullname =
        `${data.first_name ?? ""} ${data.last_name ?? ""}`.trim() || email;
    const phone = data.phone_numbers?.[0]?.phone_number;

    return { email, fullname, ...(phone ? { phone } : {}) };
}

// Conflicto de UNIQUE (email o phone ya existen con otro clerkid).
function isUniqueConflict(e: unknown): boolean {
    return typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";
}

router.post(
    "/",
    express.raw({ type: "application/json" }),
    async (req, res) => {
        let evt;
        try {
            // Lee CLERK_WEBHOOK_SIGNING_SECRET del .env por defecto.
            evt = await verifyWebhook(req);
        } catch (error) {
            console.error("Webhook de Clerk con firma inválida:", error instanceof Error ? error.message : error);
            // 400 (no 500): la firma no se arregla reintentando.
            res.status(400).json({ message: "Invalid webhook signature" });
            return;
        }

        try {
            if (evt.type === "user.created" || evt.type === "user.updated") {
                const data = evt.data as unknown as ClerkWebhookUserData;
                const payload = toUserPayload(data);

                if (!payload) {
                    console.warn(`Webhook ${evt.type} sin email (clerkid=${data.id}), omitido`);
                    res.status(200).json({ message: "Sin email, omitido" });
                    return;
                }

                // Rol "cliente" por defecto solo al crear; en updates no se toca el rol.
                let role_id: number | null = null;
                if (evt.type === "user.created") {
                    const cliente = await db.roles.findUnique({ where: { name: "cliente" } });
                    role_id = cliente?.id ?? null;
                }

                try {
                    // password_hash queda null: la auth es vía Clerk.
                    await db.user.upsert({
                        where: { clerkid: data.id },
                        update: { ...payload, is_active: true },
                        create: { clerkid: data.id, ...payload, role_id, is_active: true },
                    });
                } catch (e) {
                    if (isUniqueConflict(e)) {
                        console.warn(`Webhook ${evt.type} en conflicto UNIQUE, omitido:`, payload.email);
                        res.status(200).json({ message: "Conflicto UNIQUE, omitido" });
                        return;
                    }
                    throw e;
                }
            }

            if (evt.type === "user.deleted") {
                const data = evt.data as unknown as { id?: string };
                if (data.id) {
                    // Soft-delete: User tiene dependientes
                    // (Services_providers, notifications, audit_logs) y el DELETE violaría FKs.
                    await db.user.updateMany({
                        where: { clerkid: data.id },
                        data: { is_active: false },
                    });
                }
            }

            res.status(200).json({ message: "Webhook procesado correctamente" });
        } catch (error) {
            console.error("Error al procesar el webhook de Clerk:", error instanceof Error ? error.message : error);
            res.status(500).json({ message: "Error interno del servidor" });
        }
    }
)

export default router
