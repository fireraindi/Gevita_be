import { Elysia } from "elysia";
import type { AuthResponse, LoginRequest } from "./model";
import { login } from "./service";

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

export const authController = new Elysia()
  .post("/api/auth/login", ({ body }) => handleLogin(body as LoginRequest));
