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
