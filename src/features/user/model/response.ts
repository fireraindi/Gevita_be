export interface UserResponse {
  id: string;
  name: string;
  phone: string;
  email: string;
  position: string;
  role: "admin" | "employee";
  isActive: boolean;
  createdAt: Date;
  salary: number;
  supportSalary: number;
  overtimeSalary: number;
  pocketMoney: number;
  bank: string;
  accountNumber: string;
}

export interface RegisterUserResponse {
  status: "success";
  statusCode: 201;
  message: "Success create user";
  data: UserResponse;
}

export interface UserDetailData {
  id: string;
  name: string;
  phone: string;
  email: string;
  position: string;
  role: "admin" | "employee";
  isActive: boolean;
  photo: string | null;
  createdAt: Date | string;
  salary: number;
  supportSalary: number;
  overtimeSalary: number;
  pocketMoney: number;
  bank: string;
  accountNumber: string;
}

export interface UserDetailResponse {
  status: "success";
  statusCode: 200;
  message: string;
  data: UserDetailData;
}

export interface UserListItemData {
  id: string;
  name: string;
  phone: string;
  position: string;
  isActive: boolean;
}

export interface UserListResponse {
  status: "success";
  statusCode: 200;
  message: string;
  data: UserListItemData[];
}
