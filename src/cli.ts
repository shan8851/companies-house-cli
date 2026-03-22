#!/usr/bin/env node

import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { Command, CommanderError } from "commander";

import { registerCommands } from "./commands/index.js";
import { CliHandledError } from "./lib/errors.js";
import type { RuntimeDependencies } from "./types/cli.js";
import { createDefaultRuntimeDependencies } from "./commands/shared.js";

export const createProgram = (dependencies: RuntimeDependencies): Command => {
  const program = new Command();

  program
    .name("ch")
    .description("Agent-friendly UK Companies House CLI.")
    .version("0.1.0")
    .option("--json", "Emit normalized JSON output.")
    .showHelpAfterError()
    .showSuggestionAfterError()
    .configureOutput({
      writeErr: (text) => {
        dependencies.writeStderr(text);
      },
      writeOut: (text) => {
        dependencies.writeStdout(text);
      }
    })
    .exitOverride();

  registerCommands(program, dependencies);

  return program;
};

export const runCli = async (
  argv: string[],
  dependencies: RuntimeDependencies = createDefaultRuntimeDependencies()
): Promise<number> => {
  const program = createProgram(dependencies);

  try {
    await program.parseAsync(argv, {
      from: "user"
    });

    return 0;
  } catch (error) {
    if (error instanceof CliHandledError) {
      return 1;
    }

    if (error instanceof CommanderError) {
      return error.exitCode;
    }

    dependencies.writeStderr(
      `Error: ${error instanceof Error ? error.message : "Unexpected error."}\n`
    );

    return 1;
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
