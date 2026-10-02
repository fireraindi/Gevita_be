import { Elysia } from "elysia";
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
  .post("/api/auth/login", ({ body }) => handleLogin(body as LoginRequest));

const protectedAuthController = new Elysia()
  .use(authMiddleware)
  .get("/api/auth/me", async ({ authUser }) => ({
    status: "success" as const,
    statusCode: 200 as const,
    data: await getCurrentUser(authUser.id),
  }));

export const authController = new Elysia()
  .use(publicAuthController)
  .use(protectedAuthController);
