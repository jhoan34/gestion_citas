import type { Request, Response, NextFunction } from "express"
import { db } from "../lib/db.js"
import { getAuth, clerkClient } from "@clerk/express";
import { Prisma } from "../generated/prisma/client.js";


export type AuthedUser = Prisma.UserGetPayload<{
    include: { role: true }
}>

export interface AuthedRequest extends Request {
    user?: AuthedUser;
}

type ClerkSdkUser = Awaited<ReturnType<typeof clerkClient.users.getUser>>;

// El SDK de Clerk usa camelCase. Mismos requerimientos que el webhook:
// email (requerido), fullname (requerido), phone (opcional).
function sdkToPayload(clerkUser: ClerkSdkUser) {
    const email =
        clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)?.emailAddress ??
        clerkUser.emailAddresses[0]?.emailAddress ??
        null;
    if (!email) return null;

    const fullname =
        `${clerkUser.firstName ?? ""} ${clerkUser.lastName ?? ""}`.trim() || null;
    const phone = clerkUser.phoneNumbers[0]?.phoneNumber;

    return { email, fullname, ...(phone ? { phone } : {}) };
}


export default async function protectRoutes(req: AuthedRequest, res: Response, next: NextFunction) {
    try {
        const { userId } = getAuth(req)
        if (!userId) {
            res.status(401).json({ message: "unauthorized" })
            return
        }

        let user = await db.user.findUnique({
            where: { clerkid: userId },
            include: { role: true },
        });

        if (!user) {
            // Red de seguridad: el webhook aún no sincronizó (race entre
            // signup y entrega Svix). Upsert idempotente: no compite con el webhook.
            let clerkUser: ClerkSdkUser;
            try {
                clerkUser = await clerkClient.users.getUser(userId);
            } catch (error) {
                console.error("Error al obtener el usuario de Clerk:", error instanceof Error ? error.message : error);
                res.status(401).json({ message: "unauthorized" })
                return
            }

            const payload = sdkToPayload(clerkUser);
            if (!payload) {
                res.status(401).json({ message: "account not synced, retry" })
                return
            }

            const cliente = await db.roles.findUnique({ where: { name: "cliente" } });
            try {
                user = await db.user.upsert({
                    where: { clerkid: userId },
                    update: { ...payload, is_active: true },
                    create: { clerkid: userId, ...payload, role_id: cliente?.id ?? null, is_active: true },
                    include: { role: true },
                });
            } catch (e) {
                // Email/teléfono ya registrados con otro clerkid: re-leer en vez de fallar.
                if (typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002") {
                    console.warn("protectRoutes: conflicto UNIQUE, re-leyendo usuario:", payload.email);
                    user = await db.user.findUnique({ where: { clerkid: userId }, include: { role: true } });
                    if (!user) {
                        res.status(401).json({ message: "account not synced, retry" })
                        return
                    }
                } else {
                    throw e;
                }
            }
        }

        if (!user?.is_active) {
            res.status(403).json({ message: "account disabled" })
            return
        }

        req.user = user;
        next()
    } catch (error) {
        console.error("Error en protectRoutes:", error instanceof Error ? error.message : error);
        res.status(401).json({ message: "unauthorized" })
    }
}
