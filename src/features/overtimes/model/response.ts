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
