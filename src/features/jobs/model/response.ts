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

export interface UpdateJobResponseData {
  id: number;
  name: string;
  salary: number;
}

export interface UpdateJobSuccessResponse {
  status: "success";
  statusCode: 200;
  message: "Success update job";
  data: UpdateJobResponseData;
}
