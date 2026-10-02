export interface LoginRequest {
  identifier: string;
  password: string;
}

export interface AuthResponse {
  status: "success";
  statusCode: 200;
  message: "Success login user";
  data: {
    token: string;
  };
}
