export interface JobResponseData {
  id: number;
  userId: string;
  name: string;
  salary: number;
}

export interface CreateJobSuccessResponse {
  status: "success";
  message: "Create job success";
  data: JobResponseData;
}
