import { Elysia } from "elysia";
import { staticPlugin } from "@elysia/static";
import { openapi } from "@elysia/openapi";

import { config } from "./config";
import { errorMiddleware } from "./middleware/error";
import { protectedUserController, userController } from "./features/user/controller";
import { authController } from "./features/auth/controller";
import { attendancesController } from "./features/attendances/controller";
import { leavesController } from "./features/leaves/controller";
import { jobsController } from "./features/jobs/controller";
import { seedAdminUser } from "./db/seed-admin";

await seedAdminUser();

let app = new Elysia()
  .onRequest(({ request, set }) => {
    // CORS Headers
    set.headers["Access-Control-Allow-Origin"] = config.CORS_ORIGIN;
    set.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS";
    set.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization";
    set.headers["Access-Control-Allow-Credentials"] = "true";

    // Security Headers
    set.headers["X-Content-Type-Options"] = "nosniff";
    set.headers["X-Frame-Options"] = "DENY";
    set.headers["Referrer-Policy"] = "no-referrer";

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": config.CORS_ORIGIN,
          "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Allow-Credentials": "true",
        },
      });
    }
  });

if (config.NODE_ENV !== "production") {
  app = app.use(openapi({
    path: "/api-docs",
    provider: "swagger-ui",
    exclude: { paths: ["/uploads", "/uploads/*"] },
    documentation: {
      info: {
        title: "Gevita API",
        version: "1.0.0",
        description: "Dokumentasi interaktif API Gevita.",
      },
      tags: [
        { name: "Auth", description: "Login dan pengambilan profil pengguna terautentikasi." },
        { name: "Users", description: "Registrasi pengguna dan pengelolaan password." },
        { name: "General", description: "Endpoint umum aplikasi." },
        { name: "Attendances", description: "Pencatatan absensi." },
        { name: "Leaves", description: "Pengajuan dan manajemen cuti/izin pengguna." },
        { name: "Jobs", description: "Pengelolaan job category dan penugasan pekerjaan." },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
          },
        },
      },
    },
  }));
}

const server = app
  .use(await staticPlugin({ assets: "uploads", prefix: "/uploads" }))
  .use(errorMiddleware)
  .use(userController)
  .use(protectedUserController)
  .use(authController)
  .use(attendancesController)
  .use(leavesController)
  .use(jobsController)
  .get("/", () => "Hello Elysia", {
    detail: {
      tags: ["General"],
      summary: "Health check",
      description: "Memastikan API dapat dijangkau.",
    },
  })
  .listen(config.PORT);

console.log(
  `🦊 Elysia is running at ${server.server?.hostname}:${server.server?.port}`
);
