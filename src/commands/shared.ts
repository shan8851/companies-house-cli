import type { Command } from "commander";

import {
  createCompaniesHouseClient,
  type CompaniesHouseClient
} from "../lib/companiesHouseClient.js";
import { resolveCliConfig } from "../lib/config.js";
import { CliHandledError, createCliError, toCliError } from "../lib/errors.js";
import {
  resolveOutputMode,
  writeCommandError,
  writeCommandSuccess
} from "../lib/output.js";
import type {
  CommandEnvelope,
  HumanRenderContext,
  ListCommandOptions,
  OutputOptions,
  RuntimeDependencies
} from "../types/cli.js";

export const createDefaultRuntimeDependencies = (): RuntimeDependencies => ({
  cwd: process.cwd(),
  env: process.env,
  fetchImplementation: fetch,
  stdoutColumns: process.stdout.columns,
  stdoutIsTTY: process.stdout.isTTY,
  writeStderr: (text) => {
    process.stderr.write(text);
  },
  writeStdout: (text) => {
    process.stdout.write(text);
  }
});

export const parsePositiveInteger = (value: string): number => {
  const parsedValue = Number.parseInt(value, 10);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    throw createCliError("INVALID_INPUT", "Expected a positive integer.");
  }

  return parsedValue;
};

export const parseNonNegativeInteger = (value: string): number => {
  const parsedValue = Number.parseInt(value, 10);

  if (!Number.isInteger(parsedValue) || parsedValue < 0) {
    throw createCliError("INVALID_INPUT", "Expected a non-negative integer.");
  }

  return parsedValue;
};

export const addListOptions = (command: Command): Command =>
  command
    .option("--items-per-page <number>", "Items to fetch per page.", parsePositiveInteger)
    .option("--start-index <number>", "Zero-based start index.", parseNonNegativeInteger, 0)
    .option("--all", "Fetch all available pages.");

export const resolveListOptions = (options: ListCommandOptions): ListCommandOptions => {
  if ((options.all ?? false) && (options.startIndex ?? 0) !== 0) {
    throw createCliError(
      "INVALID_INPUT",
      "--all cannot be combined with a non-zero --start-index."
    );
  }

  return {
    all: options.all ?? false,
    ...(options.itemsPerPage !== undefined ? { itemsPerPage: options.itemsPerPage } : {}),
    startIndex: options.startIndex ?? 0
  };
};

const resolveOutputOptions = (command: Command): OutputOptions =>
  command.optsWithGlobals<OutputOptions>();

const DEFAULT_TERMINAL_WIDTH = 80;

const resolveHumanRenderContext = (
  command: Command,
  dependencies: RuntimeDependencies
): HumanRenderContext => {
  const globalOptions = command.optsWithGlobals<{
    color?: boolean;
  }>();
  const stdoutIsTTY = dependencies.stdoutIsTTY ?? false;
  const colorDisabledByFlag = globalOptions.color === false;
  const colorDisabledByEnv = "NO_COLOR" in dependencies.env;
  const terminalWidth =
    typeof dependencies.stdoutColumns === "number" && dependencies.stdoutColumns > 0
      ? dependencies.stdoutColumns
      : DEFAULT_TERMINAL_WIDTH;

  return {
    ansiEnabled: stdoutIsTTY && !colorDisabledByFlag && !colorDisabledByEnv,
    terminalWidth
  };
};

export interface CommandExecutionContext {
  client: CompaniesHouseClient;
}

export interface ExecuteCommandOptions<TInput, TData extends Record<string, unknown>> {
  command: Command;
  commandName: string;
  dependencies: RuntimeDependencies;
  execute: (context: CommandExecutionContext) => Promise<CommandEnvelope<TInput, TData>>;
  renderHuman: (
    envelope: CommandEnvelope<TInput, TData>,
    context: HumanRenderContext
  ) => string;
}

export const executeCommand = async <TInput, TData extends Record<string, unknown>>({
  command,
  commandName,
  dependencies,
  execute,
  renderHuman
}: ExecuteCommandOptions<TInput, TData>): Promise<void> => {
  const requestedAt = new Date().toISOString();
  const outputMode = resolveOutputMode(resolveOutputOptions(command), dependencies);

  try {
    const config = resolveCliConfig({
      cwd: dependencies.cwd,
      env: dependencies.env
    });
    const client = createCompaniesHouseClient({
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      fetchImplementation: dependencies.fetchImplementation
    });
    const envelope = await execute({
      client
    });
    const humanRenderContext = resolveHumanRenderContext(command, dependencies);

    writeCommandSuccess(
      envelope,
      requestedAt,
      outputMode,
      dependencies,
      (commandEnvelope) => renderHuman(commandEnvelope, humanRenderContext)
    );
  } catch (error) {
    const cliError = toCliError(error);

    writeCommandError(commandName, cliError, requestedAt, outputMode, dependencies);

    throw new CliHandledError(cliError.exitCode);
  }
};
