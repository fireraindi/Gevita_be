export type LeaveCategory = "Sakit" | "Izin";

export interface ListLeavesQueryInput {
  search?: string;
  category?: LeaveCategory;
  start_date?: string;
  end_date?: string;
  limit?: number | string;
  page?: number | string;
}

export interface CreateLeaveRequest {
  startDate: string;
  endDate: string;
  reason: string;
  category: LeaveCategory;
  image?: File | null | "";
}
