import { z } from "zod";

const photoSchema = z
  .instanceof(File)
  .refine((file) => ["image/jpeg", "image/png", "image/webp"].includes(file.type), {
    message: "Photo must be a jpg, jpeg, png, or webp image",
  })
  .optional();

export const createUserSchema = z.object({
  name: z.string().trim().min(1).max(100),
  phone: z.string().regex(/^\d{10,20}$/, "Phone must contain 10 to 20 digits"),
  email: z.string().trim().min(5).max(100).email(),
  password: z.string().min(4).max(100),
  position: z.string().trim().min(1).max(100),
  role: z.enum(["admin", "employee"]),
  photo: photoSchema,
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
