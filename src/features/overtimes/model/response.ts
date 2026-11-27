export interface OvertimeListItem {
  id: number;
  userId: string;
  timeFrame: number;
  start: string;
  end: string;
  description: string;
  date: string;
  status: boolean;
}

export interface OvertimeResponseData extends OvertimeListItem {
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

export interface DeleteOvertimeSuccessResponse {
  status: "success";
  message: "Data lembur berhasil dihapus";
}

export interface OvertimePagination {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

export interface ListOvertimesSuccessResponse {
  status: "success";
  message: "Data lembur berhasil diambil";
  data: OvertimeListItem[];
  pagination: OvertimePagination;
}
