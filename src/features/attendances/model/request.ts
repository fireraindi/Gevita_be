export interface CheckInRequest {
  checkInPhoto: File;
}

export interface AttendanceHistoryQueryInput {
  month?: string | number;
  year?: string | number;
  limit?: number;
  desc?: string | boolean;
}

export interface ListAttendancesQueryInput {
  status?: string;
  start_date?: string;
  end_date?: string;
  limit?: string | number;
  page?: string | number;
}
