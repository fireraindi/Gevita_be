export type AttendanceCheckInStatus = "Hadir" | "Terlambat";

export interface CheckInAttendanceData {
  id: number;
  userId: string;
  date: string;
  checkInTime: Date;
  status: AttendanceCheckInStatus;
  checkInPhoto: string;
}

export interface CheckInResponse {
  status: "success";
  statusCode: 200;
  message: "Success check in attendances";
  data: CheckInAttendanceData;
}

export interface CheckOutAttendanceData {
  id: number;
  userId: string;
  date: string;
  checkOutTime: Date;
}

export interface CheckOutResponse {
  status: "success";
  statusCode: 200;
  message: "Success check out attendances";
  data: CheckOutAttendanceData;
}

export interface TodayAttendanceData {
  id: number;
  check_in_time: Date;
  check_in_photo: string;
  check_out_time: Date | null;
  status: string;
}

export interface TodayAttendanceResponse {
  status: "success";
  statusCode: 200;
  data: TodayAttendanceData | null;
}
