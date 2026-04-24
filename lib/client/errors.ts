export class ClientRequestError extends Error {
  status?: number;
  details?: unknown;

  constructor(message: string, options?: { status?: number; details?: unknown }) {
    super(message);
    this.name = "ClientRequestError";
    this.status = options?.status;
    this.details = options?.details;
  }
}

export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ClientRequestError) {
    return error.message;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}
