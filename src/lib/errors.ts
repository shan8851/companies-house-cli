import { CommanderError } from "commander";

export type CliErrorCode =
  | "AUTH_ERROR"
  | "INTERNAL_ERROR"
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "UPSTREAM_API_ERROR";

const EXIT_CODE_BY_ERROR: Record<CliErrorCode, number> = {
  AUTH_ERROR: 3,
  INTERNAL_ERROR: 4,
  INVALID_INPUT: 2,
  NOT_FOUND: 2,
  RATE_LIMITED: 3,
  UPSTREAM_API_ERROR: 3
};

const RETRYABLE_ERROR_CODES = new Set<CliErrorCode>([
  "RATE_LIMITED",
  "UPSTREAM_API_ERROR"
]);

export interface CompaniesHouseCliErrorOptions {
  code: CliErrorCode;
  details?: unknown;
  exitCode?: number;
  retryable?: boolean;
}

export class CompaniesHouseCliError extends Error {
  public readonly code: CliErrorCode;
  public readonly details: unknown;
  public readonly exitCode: number;
  public readonly retryable: boolean;

  public constructor(
    message: string,
    {
      code,
      details,
      exitCode = EXIT_CODE_BY_ERROR[code],
      retryable = RETRYABLE_ERROR_CODES.has(code)
    }: CompaniesHouseCliErrorOptions
  ) {
    super(message);
    this.name = "CompaniesHouseCliError";
    this.code = code;
    this.details = details;
    this.exitCode = exitCode;
    this.retryable = retryable;
  }
}

export class CliHandledError extends Error {
  public readonly exitCode: number;

  public constructor(exitCode: number) {
    super("CLI error already handled");
    this.name = "CliHandledError";
    this.exitCode = exitCode;
  }
}

export const createCliError = (
  code: CliErrorCode,
  message: string,
  details?: unknown
): CompaniesHouseCliError =>
  new CompaniesHouseCliError(message, {
    code,
    details
  });

export const isCliError = (error: unknown): error is CompaniesHouseCliError =>
  error instanceof Error &&
  "code" in error &&
  "exitCode" in error &&
  "retryable" in error;

const normalizeCommanderMessage = (message: string): string =>
  message.replace(/^error:\s*/u, "");

export const toCliError = (error: unknown): CompaniesHouseCliError => {
  if (isCliError(error)) {
    return error;
  }

  if (error instanceof CommanderError) {
    return createCliError("INVALID_INPUT", normalizeCommanderMessage(error.message));
  }

  if (error instanceof Error) {
    return createCliError("INTERNAL_ERROR", error.message);
  }

  return createCliError("INTERNAL_ERROR", "An unexpected internal error occurred.");
};
