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

export interface RemoveJobSuccessResponse {
  status: "success";
  statusCode: 200;
  message: "Success Remove job";
}

export interface JobListItem {
  id: number;
  userId: string;
  userName: string;
  name: string;
  salary: number;
}

export interface JobPagination {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

export interface JobListSuccessResponse {
  status: "success";
  statusCode: 200;
  message: string;
  data: JobListItem[];
  pagination: JobPagination;
}
