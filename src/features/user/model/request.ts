export interface RegisterRequest {
  name: string;
  phone: string;
  email: string;
  password: string;
  position: string;
  role: "admin" | "employee";
  photo?: File;
  salary: number;
  supportSalary: number;
  overtimeSalary: number;
  pocketMoney: number;
  bank: string;
  accountNumber: string;
}

export interface UpdateUserRequest {
  isActive?: boolean;
  name?: string;
  phone?: string;
  email?: string;
  password?: string;
  position?: string;
  role?: "admin" | "employee";
  photo?: File;
  salary?: number;
  supportSalary?: number;
  overtimeSalary?: number;
  pocketMoney?: number;
  bank?: string;
  accountNumber?: string;
}
