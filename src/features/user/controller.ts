import { Elysia, t } from "elysia";
import { createUser } from "./service";
import type { RegisterRequest } from "./model/registerRequest";
import type { RegisterUserResponse } from "./model/userResponse";

export const userController = new Elysia({ prefix: "/api/users" }).post(
  "",
  async ({ body, set }): Promise<RegisterUserResponse> => {
    try {
      const user = await createUser(body as RegisterRequest);
      set.status = 201;
      return { status: "success", statusCode: 201, message: "Success create user", data: user };
    } catch (error) {
      // Elysia's equivalent of next(error): rethrow for the shared onError middleware.
      throw error;
    }
  },
  {
    response: {
      201: t.Object({
        status: t.Literal("success"),
        statusCode: t.Literal(201),
        message: t.String(),
        data: t.Object({
          id: t.String(),
          phone: t.String(),
          email: t.String(),
          position: t.String(),
          role: t.Union([t.Literal("admin"), t.Literal("employee")]),
          isActive: t.Boolean(),
          createdAt: t.Date(),
        }),
      }),
      400: t.Object({ status: t.Literal("error"), statusCode: t.Literal(400), errors: t.Unknown() }),
      409: t.Object({ status: t.Literal("error"), statusCode: t.Literal(409), errors: t.Unknown() }),
    },
    detail: {
      tags: ["Auth"],
      summary: "Register user",
      description: "Mendaftarkan pengguna baru. Foto profil bersifat opsional.",
      requestBody: {
        required: true,
        content: {
          "multipart/form-data": {
            schema: {
              type: "object",
              required: ["name", "phone", "email", "password", "position", "role"],
              properties: {
                name: { type: "string", minLength: 1, maxLength: 100 },
                phone: { type: "string", pattern: "^\\d{10,20}$", description: "10–20 digit nomor telepon." },
                email: { type: "string", format: "email", minLength: 5, maxLength: 100 },
                password: { type: "string", minLength: 4, maxLength: 100 },
                position: { type: "string", minLength: 1, maxLength: 100 },
                role: { type: "string", enum: ["admin", "employee"] },
                photo: { type: "string", format: "binary", description: "File foto profil opsional (JPG, PNG, atau WebP)." },
              },
            },
          },
          "application/json": {
            schema: {
              type: "object",
              required: ["name", "phone", "email", "password", "position", "role"],
              properties: {
                name: { type: "string", minLength: 1, maxLength: 100 },
                phone: { type: "string", pattern: "^\\d{10,20}$" },
                email: { type: "string", format: "email", minLength: 5, maxLength: 100 },
                password: { type: "string", minLength: 4, maxLength: 100 },
                position: { type: "string", minLength: 1, maxLength: 100 },
                role: { type: "string", enum: ["admin", "employee"] },
              },
            },
          },
        },
      },
    },
  },
);
