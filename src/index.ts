import { Elysia } from "elysia";

import { errorMiddleware } from "./middleware/error";
import { userController } from "./features/user/controller";

const app = new Elysia()
  .use(errorMiddleware)
  .use(userController)
  .get("/", () => "Hello Elysia")
  .listen(3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
