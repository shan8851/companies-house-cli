export interface PaginationMeta {
  fetchedAll: boolean;
  itemsPerPage: number;
  returnedCount: number;
  startIndex: number;
  totalResults: number | null;
}

export interface CommandEnvelope<TInput, TData> {
  command: string;
  data: TData;
  input: TInput;
  pagination?: PaginationMeta;
}

export interface JsonEnvelopeError {
  code: string;
  details?: unknown;
  message: string;
  retryable: boolean;
}

export interface ErrorEnvelope {
  command: string;
  error: JsonEnvelopeError;
  ok: false;
  requestedAt: string;
  schemaVersion: "1";
}

export interface SuccessEnvelope<TData> {
  command: string;
  data: TData;
  ok: true;
  requestedAt: string;
  schemaVersion: "1";
}

export interface ListCommandOptions {
  all?: boolean;
  itemsPerPage?: number;
  startIndex?: number;
}

export interface RuntimeDependencies {
  cwd: string;
  env: NodeJS.ProcessEnv;
  fetchImplementation: typeof fetch;
  stdoutColumns?: number;
  stdoutIsTTY?: boolean;
  writeStderr: (text: string) => void;
  writeStdout: (text: string) => void;
}

export interface OutputOptions {
  color?: boolean;
  json?: boolean;
  text?: boolean;
}

export type OutputMode = "json" | "text";

export interface HumanRenderContext {
  ansiEnabled: boolean;
  terminalWidth: number;
}
