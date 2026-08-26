export interface ApiErrorResponse {
  errorCode: string;
  message: string;
  correlationId: string;
  timestamp: string;
  statusCode: number;
}
