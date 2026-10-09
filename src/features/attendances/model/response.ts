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
