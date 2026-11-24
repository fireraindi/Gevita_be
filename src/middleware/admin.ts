import { Elysia } from "elysia";
import { requireActiveAdmin } from "../helpers/role";
import { authenticateRequest } from "./auth";

export const activeAdminMiddleware = new Elysia({ name: "active-admin-middleware" }).derive(
  { as: "scoped" },
  async ({ request }) => {
    const authUser = await authenticateRequest(request);
    await requireActiveAdmin(authUser);
    return { authUser };
  },
);
