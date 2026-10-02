export interface RegisterRequest {
  name: string;
  phone: string;
  email: string;
  password: string;
  position: string;
  role: "admin" | "employee";
  photo?: File;
}
