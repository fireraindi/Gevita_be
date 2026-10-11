export type LeaveStatus = "Pending" | "Approved" | "Rejected";

export interface LeaveResponseData {
  id: number;
  startDate: string;
  endDate: string;
  reason: string;
  status: LeaveStatus;
  image: string | null;
  created_at: string;
}

export interface CreateLeaveSuccessResponse {
  status: "success";
  message: string;
  data: LeaveResponseData;
}

export interface LeaveHistoryResponse {
  status: "success";
  data: LeaveResponseData[];
}

export type ValidationErrorDetails = Record<string, string[]>;

export interface BadRequestErrorResponse {
  status: "error";
  statusCode: 400;
  errors: ValidationErrorDetails | string;
}

export interface UnauthorizedErrorResponse {
  status: "error";
  statusCode: 401;
  errors: "Unauthorized";
}

export interface InternalServerErrorResponse {
  status: "error";
  statusCode: 500;
  errors: "Internal server error";
}
