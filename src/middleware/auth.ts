  import { Elysia } from "elysia";
  import { UnauthorizedError } from "../errors/errors";
  import { verifyToken } from "../helpers/token";

  export const authMiddleware = new Elysia({ name: "auth-middleware" }).derive(
    { as: "scoped" },
    ({ request }) => {
      const authorization = request.headers.get("authorization");
      const match = authorization?.match(/^Bearer\s+(.+)$/i);
      if (!match) throw new UnauthorizedError("Unauthorized");

      return { authUser: verifyToken(match[1]) };
    },
  );
