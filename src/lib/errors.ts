export class CompaniesHouseCliError extends Error {
  public readonly code: string;
  public readonly statusCode: number | undefined;

  public constructor(message: string, code: string, statusCode?: number) {
    super(message);
    this.name = "CompaniesHouseCliError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export class CliHandledError extends Error {
  public constructor() {
    super("CLI error already handled");
    this.name = "CliHandledError";
  }
}

export const toCliError = (error: unknown): CompaniesHouseCliError => {
  if (error instanceof CompaniesHouseCliError) {
    return error;
  }

  if (error instanceof Error) {
    return new CompaniesHouseCliError(
      error.message,
      "unexpected_error"
    );
  }

  return new CompaniesHouseCliError("An unexpected error occurred.", "unexpected_error");
};
