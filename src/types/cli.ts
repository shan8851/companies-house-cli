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

export type OutputMode = "human" | "json";

export interface HumanRenderContext {
  ansiEnabled: boolean;
  terminalWidth: number;
}
