import { Elysia, t } from "elysia";
import { changePassword, createUser, getUserById, getUsers } from "./service";
import type { RegisterRequest } from "./model/request";
import type { RegisterUserResponse } from "./model/response";
import type { UserDetailResponse } from "./model/response";
import type { UserListResponse } from "./model/response";
import { authMiddleware } from "../../middleware/auth";
import { assertAdmin } from "../../helpers/role";
import type { ChangePasswordInput } from "./validation";

export const userController = new Elysia({ prefix: "/api/users" }).use(authMiddleware).post(
  "",
  async ({ body, set, authUser }): Promise<RegisterUserResponse> => {
    try {
      assertAdmin(authUser);
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
          name: t.String(),
          phone: t.String(),
          email: t.String(),
          position: t.String(),
          role: t.Union([t.Literal("admin"), t.Literal("employee")]),
          isActive: t.Boolean(),
          createdAt: t.Date(),
          salary: t.Number(),
          supportSalary: t.Number(),
          overtimeSalary: t.Number(),
          pocketMoney: t.Number(),
          bank: t.String(),
          accountNumber: t.String(),
        }),
      }),
      400: t.Object({ status: t.Literal("error"), statusCode: t.Literal(400), errors: t.Record(t.String(), t.Array(t.String())) }),
      401: t.Object({ status: t.Literal("error"), statusCode: t.Literal(401), errors: t.String() }),
      403: t.Object({ status: t.Literal("error"), statusCode: t.Literal(403), errors: t.String() }),
      409: t.Object({ status: t.Literal("error"), statusCode: t.Literal(409), errors: t.String() }),
      500: t.Object({ status: t.Literal("error"), statusCode: t.Literal(500), errors: t.String() }),
    },
    detail: {
      tags: ["Users"],
      summary: "Register user",
      description: "Mendaftarkan pengguna baru. Foto profil bersifat opsional.",
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "multipart/form-data": {
            schema: {
              type: "object",
              required: ["name", "phone", "email", "password", "position", "role", "salary", "supportSalary", "overtimeSalary", "pocketMoney", "bank", "accountNumber"],
              properties: {
                name: { type: "string", minLength: 1, maxLength: 100 },
                phone: { type: "string", pattern: "^\\d{10,20}$", description: "10–20 digit nomor telepon." },
                email: { type: "string", format: "email", minLength: 5, maxLength: 100 },
                password: { type: "string", minLength: 4, maxLength: 100, pattern: "^\\d+$" },
                position: { type: "string", minLength: 1, maxLength: 100 },
                role: { type: "string", enum: ["admin", "employee"] },
                photo: { type: "string", format: "binary", description: "Foto profil opsional, maksimal 1 MB (JPG, PNG, atau WebP)." },
                salary: { type: "integer", minimum: 1 }, supportSalary: { type: "integer", minimum: 1 },
                overtimeSalary: { type: "integer", minimum: 1 }, pocketMoney: { type: "integer", minimum: 1 },
                bank: { type: "string", minLength: 1, maxLength: 100 }, accountNumber: { type: "string", minLength: 1, maxLength: 50 },
              },
            },
          },
          "application/json": {
            schema: {
              type: "object",
              required: ["name", "phone", "email", "password", "position", "role", "salary", "supportSalary", "overtimeSalary", "pocketMoney", "bank", "accountNumber"],
              properties: {
                name: { type: "string", minLength: 1, maxLength: 100 },
                phone: { type: "string", pattern: "^\\d{10,20}$" },
                email: { type: "string", format: "email", minLength: 5, maxLength: 100 },
                password: { type: "string", minLength: 4, maxLength: 100, pattern: "^\\d+$" },
                position: { type: "string", minLength: 1, maxLength: 100 },
                role: { type: "string", enum: ["admin", "employee"] },
                salary: { type: "integer", minimum: 1 }, supportSalary: { type: "integer", minimum: 1 },
                overtimeSalary: { type: "integer", minimum: 1 }, pocketMoney: { type: "integer", minimum: 1 },
                bank: { type: "string", minLength: 1, maxLength: 100 }, accountNumber: { type: "string", minLength: 1, maxLength: 50 },
              },
            },
          },
        },
      },
    },
  },
);

export const protectedUserController = new Elysia({ prefix: "/api/users" })
  .use(authMiddleware)
  .get("", async ({ authUser, query }): Promise<UserListResponse> => {
    assertAdmin(authUser);
    const userList = await getUsers(query);
    return {
      status: "success",
      statusCode: 200,
      message: "Success get users",
      data: userList,
    };
  }, {
    query: t.Object({
      search: t.Optional(t.String({ description: "Search keyword for name or phone" })),
    }),
    response: {
      200: t.Object({
        status: t.Literal("success"),
        statusCode: t.Literal(200),
        message: t.String(),
        data: t.Array(t.Object({
          id: t.String(),
          name: t.String(),
          phone: t.String(),
          position: t.String(),
          isActive: t.Boolean(),
        })),
      }),
      401: t.Object({ status: t.Literal("error"), statusCode: t.Literal(401), errors: t.Literal("Unauthorized") }),
      403: t.Object({ status: t.Literal("error"), statusCode: t.Literal(403), errors: t.Literal("Forbidden") }),
      500: t.Object({ status: t.Literal("error"), statusCode: t.Literal(500), errors: t.Literal("Internal server error") }),
    },
    detail: {
      tags: ["Users"],
      summary: "Get user list (Admin Only)",
      description: "Mengambil daftar seluruh pengguna dengan filter pencarian opsional pada nama atau nomor telepon. Hanya dapat diakses oleh user dengan role admin.",
      security: [{ bearerAuth: [] }],
    },
  })
  .get("/:id", async ({ authUser, params }): Promise<UserDetailResponse> => {
    assertAdmin(authUser);
    const user = await getUserById(params.id);
    return {
      status: "success",
      statusCode: 200,
      message: "Success get user detail",
      data: user,
    };
  }, {
    params: t.Object({ id: t.String({ description: "User UUID" }) }),
    response: {
      200: t.Object({
        status: t.Literal("success"),
        statusCode: t.Literal(200),
        message: t.String(),
        data: t.Object({
          id: t.String(),
          name: t.String(),
          phone: t.String(),
          email: t.String(),
          position: t.String(),
          role: t.Union([t.Literal("admin"), t.Literal("employee")]),
          isActive: t.Boolean(),
          photo: t.Nullable(t.String()),
          createdAt: t.Union([t.Date(), t.String()]),
          salary: t.Number(),
          supportSalary: t.Number(),
          overtimeSalary: t.Number(),
          pocketMoney: t.Number(),
          bank: t.String(),
          accountNumber: t.String(),
        }),
      }),
      401: t.Object({ status: t.Literal("error"), statusCode: t.Literal(401), errors: t.Literal("Unauthorized") }),
      403: t.Object({ status: t.Literal("error"), statusCode: t.Literal(403), errors: t.Literal("Forbidden") }),
      404: t.Object({ status: t.Literal("error"), statusCode: t.Literal(404), errors: t.Literal("User Not found") }),
      500: t.Object({ status: t.Literal("error"), statusCode: t.Literal(500), errors: t.Literal("Internal server error") }),
    },
    detail: {
      tags: ["Users"],
      summary: "Get user detail (Admin Only)",
      description: "Mengambil detail profil, payroll, dan rekening pengguna. Hanya admin yang dapat mengakses endpoint ini.",
      security: [{ bearerAuth: [] }],
    },
  })
  .put("", async ({ body, authUser }) => {
    await changePassword(authUser.id, body as ChangePasswordInput);
    return { status: "success" as const, statusCode: 200 as const, message: "Success update password user" };
  }, {
    response: {
      200: t.Object({ status: t.Literal("success"), statusCode: t.Literal(200), message: t.String() }),
      400: t.Object({ status: t.Literal("error"), statusCode: t.Literal(400), errors: t.Unknown() }),
      401: t.Object({ status: t.Literal("error"), statusCode: t.Literal(401), errors: t.String() }),
      // 422: t.Object({ status: t.Literal("error"), statusCode: t.Literal(422), errors: t.String() }),
    },
    detail: {
      tags: ["Users"],
      summary: "Change password",
      description: "Mengubah password pengguna yang sedang login.",
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: { "application/json": { schema: {
          type: "object",
          required: ["oldPassword", "newPassword"],
          properties: {
            oldPassword: { type: "string", minLength: 4, maxLength: 100 },
            newPassword: { type: "string", minLength: 4, maxLength: 100 },
          },
        } } },
      },
    },
  });
