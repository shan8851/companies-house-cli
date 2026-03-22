#!/usr/bin/env node

import { realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import { Command, CommanderError } from "commander";

const require = createRequire(import.meta.url);
const packageJson = require("../package.json") as { version: string };

import { registerCommands } from "./commands/index.js";
import { CliHandledError } from "./lib/errors.js";
import type { RuntimeDependencies } from "./types/cli.js";
import { createDefaultRuntimeDependencies } from "./commands/shared.js";

export const createProgram = (dependencies: RuntimeDependencies): Command => {
  const program = new Command();

  program
    .name('ch')
    .description('Agent-friendly UK Companies House CLI.')
    .version(packageJson.version)
    .option('--json', 'Emit normalized JSON output.')
    .option('--no-color', 'Disable ANSI colour and styling in human output.')
    .showHelpAfterError()
    .showSuggestionAfterError()
    .configureOutput({
      writeErr: (text) => {
        dependencies.writeStderr(text);
      },
      writeOut: (text) => {
        dependencies.writeStdout(text);
      },
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
