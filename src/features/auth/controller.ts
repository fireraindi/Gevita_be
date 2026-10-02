import { Elysia, t } from "elysia";
import type { AuthResponse, LoginRequest } from "./model";
import { getCurrentUser, login } from "./service";
import { authMiddleware } from "../../middleware/auth";

async function handleLogin(body: LoginRequest): Promise<AuthResponse> {
  try {
    const token = await login(body);
    return {
      status: "success",
      statusCode: 200,
      message: "Success login user",
      data: { token },
    };
  } catch (error) {
    throw error;
  }
}

const publicAuthController = new Elysia()
  .post("/api/auth/login", ({ body }) => handleLogin(body as LoginRequest), {
    response: {
      200: t.Object({
        status: t.Literal("success"),
        statusCode: t.Literal(200),
        message: t.String(),
        data: t.Object({ token: t.String({ description: "JWT access token." }) }),
      }),
      400: t.Object({ status: t.Literal("error"), statusCode: t.Literal(400), errors: t.Unknown() }),
      401: t.Object({ status: t.Literal("error"), statusCode: t.Literal(401), errors: t.String() }),
      403: t.Object({ status: t.Literal("error"), statusCode: t.Literal(403), errors: t.String() }),
    },
    detail: {
      tags: ["Auth"],
      summary: "Login",
      description: "Login menggunakan email atau nomor telepon dan password untuk memperoleh JWT yang berlaku tiga hari.",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["identifier", "password"],
              properties: {
                identifier: { type: "string", minLength: 1, description: "Email atau nomor telepon pengguna." },
                password: { type: "string", minLength: 1 },
              },
            },
          },
        },
      },
    },
  });

const protectedAuthController = new Elysia()
  .use(authMiddleware)
  .get("/api/auth/me", async ({ authUser }) => ({
    status: "success" as const,
    statusCode: 200 as const,
    data: await getCurrentUser(authUser.id),
  }), {
    response: {
      200: t.Object({
        status: t.Literal("success"),
        statusCode: t.Literal(200),
        data: t.Object({
          id: t.String(),
          name: t.String(),
          email: t.String(),
          position: t.String(),
          photo: t.Union([t.String(), t.Null()]),
          role: t.Union([t.Literal("admin"), t.Literal("employee")]),
          is_active: t.Boolean(),
        }),
      }),
      401: t.Object({ status: t.Literal("error"), statusCode: t.Literal(401), errors: t.String() }),
      403: t.Object({ status: t.Literal("error"), statusCode: t.Literal(403), errors: t.String() }),
      404: t.Object({ status: t.Literal("error"), statusCode: t.Literal(404), errors: t.String() }),
    },
    detail: {
      tags: ["Auth"],
      summary: "Get current user profile",
      description: "Mengambil profil pengguna yang terautentikasi dari JWT Bearer.",
      security: [{ bearerAuth: [] }],
    },
  });

export const authController = new Elysia()
  .use(publicAuthController)
  .use(protectedAuthController);
