import type { Command } from "commander";

import type { RuntimeDependencies } from "../types/cli.js";
import { registerChargesCommand } from "./chargesCommand.js";
import { registerCompanyInfoCommand } from "./companyInfoCommand.js";
import { registerFilingsCommand } from "./filingsCommand.js";
import { registerInsolvencyCommand } from "./insolvencyCommand.js";
import { registerOfficersCommand } from "./officersCommand.js";
import { registerPscCommand } from "./pscCommand.js";
import { registerSearchCompaniesCommand } from "./searchCompaniesCommand.js";
import { registerSearchPeopleCommand } from "./searchPeopleCommand.js";

export const registerCommands = (
  program: Command,
  dependencies: RuntimeDependencies
): void => {
  registerSearchCompaniesCommand(program, dependencies);
  registerCompanyInfoCommand(program, dependencies);
  registerOfficersCommand(program, dependencies);
  registerFilingsCommand(program, dependencies);
  registerPscCommand(program, dependencies);
  registerSearchPeopleCommand(program, dependencies);
  registerChargesCommand(program, dependencies);
  registerInsolvencyCommand(program, dependencies);
};
