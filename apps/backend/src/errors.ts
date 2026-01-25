export type ProblemDetails = {
  code: string;
  message: string;
  details?: unknown;
};

export class AppError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly details?: unknown;

  constructor(input: { code: string; message: string; statusCode: number; details?: unknown }) {
    super(input.message);
    this.name = "AppError";
    this.code = input.code;
    this.statusCode = input.statusCode;
    this.details = input.details;
  }

  toProblemDetails(): ProblemDetails {
    return { code: this.code, message: this.message, details: this.details };
  }
}
