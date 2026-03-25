import type {
  CommandEnvelope,
  ErrorEnvelope,
  OutputMode,
  OutputOptions,
  RuntimeDependencies,
  SuccessEnvelope
} from "../types/cli.js";
import type { CompaniesHouseCliError } from "./errors.js";

import { JSON_SCHEMA_VERSION } from "./constants.js";
import { createCliError } from "./errors.js";

type SerializedCommandData<TInput, TData> = {
  input: TInput;
  pagination?: CommandEnvelope<TInput, TData>["pagination"];
} & TData;

const writeJson = (dependencies: RuntimeDependencies, value: unknown): void => {
  dependencies.writeStdout(`${JSON.stringify(value, null, 2)}\n`);
};

export const resolveOutputMode = (
  options: OutputOptions,
  dependencies: Pick<RuntimeDependencies, "stdoutIsTTY">
): OutputMode => {
  if (options.json && options.text) {
    throw createCliError("INVALID_INPUT", "Choose either --json or --text, not both.");
  }

  if (options.json) {
    return "json";
  }

  if (options.text) {
    return "text";
  }

  return dependencies.stdoutIsTTY ? "text" : "json";
};

export const serializeSuccessEnvelope = <TInput, TData extends Record<string, unknown>>(
  envelope: CommandEnvelope<TInput, TData>,
  requestedAt: string
): SuccessEnvelope<SerializedCommandData<TInput, TData>> => ({
  command: envelope.command,
  data: {
    input: envelope.input,
    ...(envelope.pagination ? { pagination: envelope.pagination } : {}),
    ...envelope.data
  },
  ok: true,
  requestedAt,
  schemaVersion: JSON_SCHEMA_VERSION
});

export const serializeErrorEnvelope = (
  commandName: string,
  error: CompaniesHouseCliError,
  requestedAt: string
): ErrorEnvelope => ({
  command: commandName,
  error: {
    code: error.code,
    ...(error.details !== undefined ? { details: error.details } : {}),
    message: error.message,
    retryable: error.retryable
  },
  ok: false,
  requestedAt,
  schemaVersion: JSON_SCHEMA_VERSION
});

export const writeCommandSuccess = <TInput, TData extends Record<string, unknown>>(
  envelope: CommandEnvelope<TInput, TData>,
  requestedAt: string,
  outputMode: OutputMode,
  dependencies: RuntimeDependencies,
  renderText: (envelope: CommandEnvelope<TInput, TData>) => string
): void => {
  if (outputMode === "json") {
    writeJson(dependencies, serializeSuccessEnvelope(envelope, requestedAt));
    return;
  }

  dependencies.writeStdout(`${renderText(envelope)}\n`);
};

export const writeCommandError = (
  commandName: string,
  error: CompaniesHouseCliError,
  requestedAt: string,
  outputMode: OutputMode,
  dependencies: RuntimeDependencies
): void => {
  if (outputMode === "json") {
    writeJson(dependencies, serializeErrorEnvelope(commandName, error, requestedAt));
    return;
  }

  dependencies.writeStderr(`${error.message}\n`);
};
