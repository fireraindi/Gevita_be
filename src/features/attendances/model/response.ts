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

export interface AttendanceHistoryItem {
  id: number;
  date: string;
  check_in_time: string;
  check_out_time: string | null;
  check_in_photo: string;
  status: string;
}

export interface AttendanceHistoryResponse {
  status: "success";
  statusCode: 200;
  data: AttendanceHistoryItem[];
}

export interface AttendanceStatsData {
  totalAttendance: number;
  sickLeave: number;
  personalLeave: number;
}

export interface AttendanceStatsResponse {
  status: "success";
  statusCode: 200;
  message: "Success get stats attendance";
  data: AttendanceStatsData;
}

export type AttendanceListStatus = "Hadir" | "Terlambat" | "Tidak Hadir" | "Sakit" | "Izin" | "Dinas" | "Ditolak";

export interface AttendanceListItem {
  id: number;
  userId: string;
  name: string;
  date: string;
  checkInTime: string;
  checkOutTime: string | null;
  checkInPhoto: string;
  status: AttendanceListStatus;
}

export interface PaginationData {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

export interface ListAttendancesResponse {
  status: "success";
  message: "Success get attendances";
  data: AttendanceListItem[];
  pagination: PaginationData;
}

export interface RejectAttendanceData {
  id: number;
  userId: string;
  name: string;
  date: string;
  checkInTime: string;
  checkOutTime: string | null;
  status: "Ditolak";
}

export interface RejectAttendanceResponse {
  status: "success";
  message: "Success reject attendance";
  data: RejectAttendanceData;
}
