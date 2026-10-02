import { Elysia } from "elysia";
import { staticPlugin } from "@elysia/static";
import { openapi } from "@elysia/openapi";

import { errorMiddleware } from "./middleware/error";
import { userController } from "./features/user/controller";
import { authController } from "./features/auth/controller";

const app = new Elysia()
  .use(openapi({
    path: "/swagger",
    provider: "swagger-ui",
    exclude: { paths: ["/uploads", "/uploads/*"] },
    documentation: {
      info: {
        title: "Gevita API",
        version: "1.0.0",
        description: "Dokumentasi interaktif API Gevita.",
      },
      tags: [
        { name: "Auth", description: "Registrasi, login, dan profil pengguna." },
        { name: "General", description: "Endpoint umum aplikasi." },
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
  .use(authController)
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
