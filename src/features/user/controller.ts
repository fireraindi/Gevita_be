import { Elysia } from "elysia";
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
);
