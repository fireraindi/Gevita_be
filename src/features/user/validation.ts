import { z } from "zod";

const photoSchema = z
  .instanceof(File)
  .refine((file) => ["image/jpeg", "image/png", "image/webp"].includes(file.type), {
    message: "Photo must be a jpg, jpeg, png, or webp image",
  })
  .refine((file) => file.size <= 1024 * 1024, { message: "Photo size must not exceed 1MB" })
  .optional();

export const createUserSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name must not exceed 100 characters"),
  phone: z.string().regex(/^\d{10,20}$/, "Phone must contain 10 to 20 digits"),
  email: z.string().trim().min(5, "Email is required").max(100).email("Invalid email address"),
  password: z.string().min(4, "Password must be at least 4 characters").max(100, "Password must not exceed 100 characters").regex(/^\d+$/, "Password must contain only numbers"),
  position: z.string().trim().min(1, "Position is required").max(100),
  role: z.enum(["admin", "employee"], { error: "Role must be admin or employee" }),
  photo: photoSchema,
  salary: z.coerce.number().int("Salary must be an integer").positive("Salary must be a positive number"),
  supportSalary: z.coerce.number().int("Support salary must be an integer").positive("Support salary must be a positive number"),
  overtimeSalary: z.coerce.number().int("Overtime salary must be an integer").positive("Overtime salary must be a positive number"),
  pocketMoney: z.coerce.number().int("Pocket money must be an integer").positive("Pocket money must be a positive number"),
  bank: z.string().trim().min(1, "Bank is required").max(100),
  accountNumber: z.string().trim().min(1, "Account number is required").max(50),
});

export const updateUserSchema = z.object({
  isActive: z.preprocess((value) => {
    if (value === "true") return true;
    if (value === "false") return false;
    return value;
  }, z.boolean()).optional(),
  name: z.string().trim().min(1, "Name is required").max(100, "Name must not exceed 100 characters").optional(),
  phone: z.string().regex(/^\d{10,20}$/, "Phone must contain 10 to 20 digits").optional(),
  email: z.string().trim().min(5, "Email is required").max(100).email("Invalid email address").optional(),
  password: z.string().min(4, "Password must be at least 4 characters").max(100, "Password must not exceed 100 characters").regex(/^\d+$/, "Password must contain only numbers").optional().or(z.literal("")).optional(),
  position: z.string().trim().min(1, "Position is required").max(100).optional(),
  role: z.enum(["admin", "employee"], { error: "Role must be admin or employee" }).optional(),
  photo: photoSchema.optional(),
  salary: z.coerce.number().int("Salary must be an integer").positive("Salary must be a positive number").optional(),
  supportSalary: z.coerce.number().int("Support salary must be an integer").positive("Support salary must be a positive number").optional(),
  overtimeSalary: z.coerce.number().int("Overtime salary must be an integer").positive("Overtime salary must be a positive number").optional(),
  pocketMoney: z.coerce.number().int("Pocket money must be an integer").positive("Pocket money must be a positive number").optional(),
  bank: z.string().trim().min(1, "Bank is required").max(100).optional(),
  accountNumber: z.string().trim().min(1, "Account number is required").max(50).optional(),
});

export const changePasswordSchema = z.object({
  oldPassword: z.string().min(4).max(100),
  newPassword: z.string().min(4).max(100),
});

export const userListQuerySchema = z.object({
  search: z.string().trim().optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type UserListQuery = z.infer<typeof userListQuerySchema>;
