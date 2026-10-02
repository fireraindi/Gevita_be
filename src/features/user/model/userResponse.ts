export interface UserResponse {
  id: string;
  phone: string;
  email: string;
  position: string;
  role: "admin" | "employee";
  isActive: boolean;
  createdAt: Date;
}

export interface RegisterUserResponse {
  status: "success";
  statusCode: 201;
  message: "Success create user";
  data: UserResponse;
}
