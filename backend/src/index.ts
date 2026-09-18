import express from "express"
import cors from "cors"
import { clerkMiddleware } from "@clerk/express"
import { PORT } from "./scripts/port.js"
import { getAllowedOrigins } from "./lib/origins.js"
import path from "node:path"
import job from "./lib/cron.js"
import { existsSync } from "node:fs";
import clerkWebhook from "./webhooks/clerk.js"
import authRouter from "./routes/auth.js"
import authRoutes from "./routes/auth.js"


const STATIC_DIR = process.env.STATIC_DIR || path.join(process.cwd(), "dist");

const app = express()

// Healthcheck independiente: debe responder aunque Clerk esté caído/lento.
// Render y el HEALTHCHECK de Docker lo usan para decidir si el servicio vive.
app.get("/api/health", (req, res) => {
  res.sendStatus(200);
});

app.use("/api/webhook/clerk",  clerkWebhook)

app.use(express.json())
app.use(clerkMiddleware)
app.use(
    cors({
        origin: (origin, callback) => {
            if(!origin) return callback(null, true)
            const allowed = getAllowedOrigins()
            if(allowed.includes(origin) || process.env.NODE_ENV !== "production"){
                return callback(null, true)
            }
            return callback(new Error(`Origin ${origin} not allowed by CORS`))
        },
        credentials : true,
    })
)

// Requiere clerkMiddleware (req.auth) y express.json(); por eso va después de ambos.
app.use("/api/auth", authRouter);

app.use("/api/auth", authRoutes)

const staticIndex = path.join(STATIC_DIR, "index.html")
const hasFrontend = existsSync(staticIndex);

if (hasFrontend) {
  // Si hay build, sirve los archivos estáticos del frontend
  app.use(express.static(STATIC_DIR));
  // Para cualquier ruta que no sea /api, envía el index.html (soporte de SPA)
  app.get("/{*splat}", (req, res, next) => {
    // Si la ruta empieza con /api, deja que siga al resto de middlewares/rutas
    if (req.path.startsWith("/api")) {
      next();
      return;
    }
    // En caso contrario, responde con el index.html del frontend
    res.sendFile(staticIndex);
  });
} else {
  // Si no hay build, la ruta raíz devuelve un mensaje simple de la API
  app.get("/", (_req, res) => {
    res.json({ message: "API funcionando" });
  });
}

// Función asíncrona que arranca el servidor
const start = async () => {
  try {

    app.listen(PORT as number, "0.0.0.0", () => {
      console.log(`Servidor corriendo en http://localhost:${PORT}`);
      // Solo en producción se inicia el cron de health check (mantener el servicio vivo)
      if (process.env.NODE_ENV === "production") {
        console.log("Iniciando cron de health check...");
        job.start();
      }
    });
  } catch (error) {
    // Si algo falla al arrancar, muestra el error y detiene el proceso
    console.error("Error al iniciar el servidor:", error);
    process.exit(1);
  }
};

// Ejecuta la función de arranque (el 'void' ignora la promesa al no esperarla)
void start();