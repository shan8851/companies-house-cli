#!/usr/bin/env node

import { realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import { Command, CommanderError } from "commander";

const require = createRequire(import.meta.url);
const packageJson = require("../package.json") as { version: string };

import { registerCommands } from "./commands/index.js";
import { createDefaultRuntimeDependencies } from "./commands/shared.js";
import { CliHandledError, toCliError } from "./lib/errors.js";
import { resolveOutputMode, writeCommandError } from "./lib/output.js";
import type { OutputMode, OutputOptions, RuntimeDependencies } from "./types/cli.js";

const TOP_LEVEL_HELP_EXAMPLES = [
  'ch search "Revolut"',
  "ch info 09215862",
  "ch officers 09215862 --all",
  "ch filings 09215862 --type accounts --include-links",
  "ch psc 09215862",
  'ch search-person "Nik Storonsky"',
  "ch charges 09215862",
  "ch insolvency 09215862",
  'ch search "Revolut" | jq'
].join("\n  ");

const getRawOutputOptions = (argv: string[]): OutputOptions => ({
  json: argv.includes("--json"),
  text: argv.includes("--text")
});

const resolveCommandName = (argv: string[], program: Command): string => {
  const knownCommandNames = new Set(program.commands.map((command) => command.name()));
  const firstNonOptionArgument = argv.find((argument) => !argument.startsWith("-"));

  if (firstNonOptionArgument === "help") {
    const helpTarget = argv.find(
      (argument, index) => index > argv.indexOf("help") && !argument.startsWith("-")
    );

    return helpTarget && knownCommandNames.has(helpTarget) ? helpTarget : "cli";
  }

  return firstNonOptionArgument && knownCommandNames.has(firstNonOptionArgument)
    ? firstNonOptionArgument
    : "cli";
};

const getParseErrorOutputMode = (
  outputOptions: OutputOptions,
  dependencies: RuntimeDependencies
): OutputMode => (outputOptions.json ? "json" : dependencies.stdoutIsTTY ? "text" : "json");

export const createProgram = (
  dependencies: RuntimeDependencies,
  options: {
    suppressErrorOutput?: boolean;
  } = {}
): Command => {
  const program = new Command();
  const suppressErrorOutput = options.suppressErrorOutput ?? false;

  program
    .name("ch")
    .description("Agent-friendly UK Companies House CLI.")
    .version(packageJson.version)
    .option("--json", "Force JSON output.")
    .option("--text", "Force text output.")
    .option("--no-color", "Disable ANSI colour and styling in text output.")
    .showHelpAfterError()
    .showSuggestionAfterError()
    .configureOutput({
      outputError: (text, write) => {
        if (suppressErrorOutput) {
          return;
        }

        write(text);
      },
      writeErr: (text) => {
        if (suppressErrorOutput) {
          return;
        }

        dependencies.writeStderr(text);
      },
      writeOut: (text) => {
        dependencies.writeStdout(text);
      }
    })
    .exitOverride();

  registerCommands(program, dependencies);
  program.addHelpText(
    "after",
    `\nOutput defaults to text in a TTY and JSON when piped. Use --json or --text to override.\n\nExamples:\n  ${TOP_LEVEL_HELP_EXAMPLES}`
  );

  return program;
};

export const runCli = async (
  argv: string[],
  dependencies: RuntimeDependencies = createDefaultRuntimeDependencies()
): Promise<number> => {
  const outputOptions = getRawOutputOptions(argv);
  const requestedAt = new Date().toISOString();
  const parseErrorOutputMode = getParseErrorOutputMode(outputOptions, dependencies);
  let parseOutputMode: OutputMode;

  try {
    parseOutputMode = resolveOutputMode(outputOptions, dependencies);
  } catch (error) {
    const program = createProgram(dependencies);
    const cliError = toCliError(error);

    writeCommandError(
      resolveCommandName(argv, program),
      cliError,
      requestedAt,
      parseErrorOutputMode,
      dependencies
    );

    return cliError.exitCode;
  }

  const program = createProgram(dependencies, {
    suppressErrorOutput: parseOutputMode === "json"
  });
  const commandName = resolveCommandName(argv, program);

  try {
    await program.parseAsync(argv, {
      from: "user"
    });

    return 0;
  } catch (error) {
    if (error instanceof CliHandledError) {
      return error.exitCode;
    }

    if (error instanceof CommanderError) {
      if (error.exitCode === 0) {
        return 0;
      }

      const cliError = toCliError(error);

      if (parseOutputMode === "json") {
        writeCommandError(commandName, cliError, requestedAt, parseOutputMode, dependencies);
      }

      return cliError.exitCode;
    }

    const cliError = toCliError(error);

    writeCommandError(commandName, cliError, requestedAt, parseOutputMode, dependencies);

    return cliError.exitCode;
  }
};

const isEntrypoint = (() => {
  if (process.argv[1] === undefined) return false;
  const scriptPath = fileURLToPath(import.meta.url);
  try {
    return realpathSync(process.argv[1]) === realpathSync(scriptPath);
  } catch {
    return scriptPath === process.argv[1];
  }
})();

if (isEntrypoint) {
  const dependencies = createDefaultRuntimeDependencies();

  void runCli(process.argv.slice(2), dependencies).then((exitCode) => {
    process.exitCode = exitCode;
  });
}
