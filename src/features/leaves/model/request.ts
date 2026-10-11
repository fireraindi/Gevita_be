export type LeaveCategory = "Sakit" | "Izin";

export interface CreateLeaveRequest {
  startDate: string;
  endDate: string;
  reason: string;
  category: LeaveCategory;
  image?: File | null | "";
}
