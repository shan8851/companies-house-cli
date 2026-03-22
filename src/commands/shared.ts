import { CommanderError, InvalidArgumentError } from "commander";
import type { Command } from "commander";

import {
  createCompaniesHouseClient,
  type CompaniesHouseClient
} from "../lib/companiesHouseClient.js";
import { resolveCliConfig } from "../lib/config.js";
import { CliHandledError, toCliError } from "../lib/errors.js";
import type {
  CommandEnvelope,
  HumanRenderContext,
  ListCommandOptions,
  OutputMode,
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
    throw new InvalidArgumentError("Expected a positive integer.");
  }

  return parsedValue;
};

export const parseNonNegativeInteger = (value: string): number => {
  const parsedValue = Number.parseInt(value, 10);

  if (!Number.isInteger(parsedValue) || parsedValue < 0) {
    throw new InvalidArgumentError("Expected a non-negative integer.");
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
    throw new CommanderError(
      1,
      "command.invalidOption",
      "--all cannot be combined with a non-zero --start-index."
    );
  }

  return {
    all: options.all ?? false,
    ...(options.itemsPerPage !== undefined ? { itemsPerPage: options.itemsPerPage } : {}),
    startIndex: options.startIndex ?? 0
  };
};

export const resolveOutputMode = (command: Command): OutputMode => {
  const globalOptions = command.optsWithGlobals<{
    json?: boolean;
  }>();

  return globalOptions.json ? "json" : "human";
};

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

export interface ExecuteCommandOptions<TInput, TData> {
  command: Command;
  commandName: string;
  dependencies: RuntimeDependencies;
  execute: (context: CommandExecutionContext) => Promise<CommandEnvelope<TInput, TData>>;
  renderHuman: (
    envelope: CommandEnvelope<TInput, TData>,
    context: HumanRenderContext
  ) => string;
}

export const executeCommand = async <TInput, TData>({
  command,
  dependencies,
  execute,
  renderHuman
}: ExecuteCommandOptions<TInput, TData>): Promise<void> => {
  const outputMode = resolveOutputMode(command);

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

    if (outputMode === "json") {
      dependencies.writeStdout(`${JSON.stringify(envelope, null, 2)}\n`);
      return;
    }

    dependencies.writeStdout(`${renderHuman(envelope, resolveHumanRenderContext(command, dependencies))}\n`);
  } catch (error) {
    const cliError = toCliError(error);

    if (outputMode === "json") {
      dependencies.writeStderr(
        `${JSON.stringify(
          {
            error: {
              code: cliError.code,
              message: cliError.message,
              statusCode: cliError.statusCode ?? null
            }
          },
          null,
          2
        )}\n`
      );
    } else {
      dependencies.writeStderr(`Error: ${cliError.message}\n`);
    }

    throw new CliHandledError();
  }
};
