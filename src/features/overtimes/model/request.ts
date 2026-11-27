export interface CreateOvertimeRequest {
  userId: string;
  timeFrame: number;
  start: string;
  end: string;
  description: string;
  date: string;
}

export interface UpdateOvertimeRequest {
  timeFrame: number;
  start: string;
  end: string;
  description: string;
  date: string;
}

export interface ListOvertimesQueryInput {
  name?: string;
  start_date?: string;
  end_date?: string;
  limit?: number | string;
  page?: number | string;
}
