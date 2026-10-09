import { Elysia } from "elysia";
import { staticPlugin } from "@elysia/static";
import { openapi } from "@elysia/openapi";

import { errorMiddleware } from "./middleware/error";
import { protectedUserController, userController } from "./features/user/controller";
import { authController } from "./features/auth/controller";
import { attendancesController } from "./features/attendances/controller";

const app = new Elysia()
  .use(openapi({
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
  }))
  .use(await staticPlugin({ assets: "uploads", prefix: "/uploads" }))
  .use(errorMiddleware)
  .use(userController)
  .use(protectedUserController)
  .use(authController)
  .use(attendancesController)
  .get("/", () => "Hello Elysia", {
    detail: {
      tags: ["General"],
      summary: "Health check",
      description: "Memastikan API dapat dijangkau.",
    },
  })
  .listen(3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
