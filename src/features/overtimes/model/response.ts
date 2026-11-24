export interface OvertimeResponseData {
  id: number;
  userId: string;
  timeFrame: number;
  start: string;
  end: string;
  description: string;
  date: string;
  createdAt: string;
}

export interface CreateOvertimeSuccessResponse {
  status: "success";
  message: "Data lembur berhasil dibuat";
  data: OvertimeResponseData;
}

export interface UpdateOvertimeSuccessResponse {
  status: "success";
  message: "Data lembur berhasil diperbarui";
  data: OvertimeResponseData;
}

export interface OvertimeDetailData {
  id: number;
  userId: string;
  timeFrame: number;
  start: string;
  end: string;
  description: string;
  date: string;
}

export interface DetailOvertimeSuccessResponse {
  status: "success";
  message: "Data lembur berhasil diambil";
  data: OvertimeDetailData;
}
