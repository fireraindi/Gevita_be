export interface CheckInRequest {
  checkInPhoto: File;
}

export interface AttendanceHistoryQueryInput {
  month?: string | number;
  year?: string | number;
}
