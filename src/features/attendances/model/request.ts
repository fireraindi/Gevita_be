export interface CheckInRequest {
  checkInPhoto: File;
}

export interface AttendanceHistoryQueryInput {
  month?: string | number;
  year?: string | number;
  limit?: number;
  desc?: string | boolean;
}
