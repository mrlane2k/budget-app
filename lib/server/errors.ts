export class AppError extends Error {
  status: number;
  code: string;

  constructor(message: string, options?: { status?: number; code?: string }) {
    super(message);
    this.name = "AppError";
    this.status = options?.status ?? 500;
    this.code = options?.code ?? "APP_ERROR";
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
