import { Elysia } from "elysia";
import { staticPlugin } from "@elysia/static";

import { errorMiddleware } from "./middleware/error";
import { userController } from "./features/user/controller";
import { authController } from "./features/auth/controller";

const app = new Elysia()
  .use(await staticPlugin({ assets: "uploads", prefix: "/uploads" }))
  .use(errorMiddleware)
  .use(userController)
  .use(authController)
  .get("/", () => "Hello Elysia")
  .listen(3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
