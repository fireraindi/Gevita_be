export interface CreateJobRequest {
  userId: string;
  name: string;
  salary: number;
}

export interface UpdateJobRequest {
  name: string;
  salary: number;
}

export interface ListJobsQueryInput {
  name?: string;
  limit?: number | string;
  page?: number | string;
}
