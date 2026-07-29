export interface HttpErrorOptions {
  level?: "error" | "info" | "warn";
  displayMessage?: boolean;
}

export class HttpError extends Error {
  statusCode: number;
  level: string;
  displayMessage: boolean;
  constructor(message: string, statusCode: number, options?: HttpErrorOptions) {
    super(message);
    this.statusCode = statusCode;
    this.displayMessage = options?.displayMessage ?? false;
    this.level = options?.level || "error";
  }
}

export class BaseError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
  }
}

export class BadRequestError extends BaseError {
  constructor(message: string) {
    super(message, 400);
  }
}

export class InternalServerError extends BaseError {
  constructor(message: string) {
    super(message, 500);
  }
}
