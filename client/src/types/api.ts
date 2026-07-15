export interface ApiError {
  message: string;
  statusCode: number;
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
}
