import type { Command } from "commander";

import {
  formatBoolean,
  formatList,
  renderKeyValueRows
} from "../lib/formatting.js";
import { normalizeCompanyNumber } from "../lib/companyNumber.js";
import { normalizeCompanyProfile } from "../lib/normalizers.js";
import type { CompanyInfoEnvelope } from "../types/normalized.js";
import type { RuntimeDependencies } from "../types/cli.js";
import { executeCommand } from "./shared.js";

const renderCompanyInfoHuman = (envelope: CompanyInfoEnvelope): string => {
  const company = envelope.data.company;
  const lines = [
    `${company.companyName ?? "Unknown company"} (${company.companyNumber ?? "unknown"})`,
    ...renderKeyValueRows([
      {
        label: "Status",
        value: company.companyStatus
      },
      {
        label: "Status detail",
        value: company.companyStatusDetail
      },
      {
        label: "Type",
        value: company.type
      },
      {
        label: "Subtype",
        value: company.subtype
      },
      {
        label: "Created",
        value: company.dateOfCreation
      },
      {
        label: "Cessation",
        value: company.dateOfCessation
      },
      {
        label: "Jurisdiction",
        value: company.jurisdiction
      },
      {
        label: "Registered office",
        value: company.registeredOfficeAddress?.formatted ?? null
      },
      {
        label: "SIC codes",
        value: formatList(company.sicCodes)
      },
      {
        label: "Has charges",
        value: formatBoolean(company.hasCharges, {
          false: "No",
          true: "Yes"
        })
      },
      {
        label: "Has insolvency history",
        value: formatBoolean(company.hasInsolvencyHistory, {
          false: "No",
          true: "Yes"
        })
      },
      {
        label: "Next accounts due",
        value: company.accounts.nextAccountsDueOn
      },
      {
        label: "Next accounts made up to",
        value: company.accounts.nextAccountsMadeUpTo
      },
      {
        label: "Accounts overdue",
        value: formatBoolean(company.accounts.overdue, {
          false: "No",
          true: "Yes"
        })
      },
      {
        label: "Next confirmation statement due",
        value: company.confirmationStatement.nextDueOn
      },
      {
        label: "Next confirmation made up to",
        value: company.confirmationStatement.nextMadeUpTo
      },
      {
        label: "Confirmation overdue",
        value: formatBoolean(company.confirmationStatement.overdue, {
          false: "No",
          true: "Yes"
        })
      }
    ])
  ];

  if (company.previousCompanyNames.length > 0) {
    lines.push("Previous names:");
    company.previousCompanyNames.forEach((previousCompanyName, index) => {
      lines.push(
        `  ${index + 1}. ${previousCompanyName.name ?? "Unknown"} | from ${
          previousCompanyName.effectiveFrom ?? "unknown"
        } | ceased ${previousCompanyName.ceasedOn ?? "unknown"}`
      );
    });
  }

  return lines.join("\n");
};

export const registerCompanyInfoCommand = (
  program: Command,
  dependencies: RuntimeDependencies
): void => {
  program
    .command("info <companyNumber>")
    .description("Get the company profile for a company number.")
    .action(async (companyNumber: string, _options: object, command: Command) => {
      const normalizedCompanyNumber = normalizeCompanyNumber(companyNumber);

      await executeCommand({
        command,
        commandName: "info",
        dependencies,
        execute: async ({ client }) => ({
          command: "info",
          data: {
            company: normalizeCompanyProfile(
              await client.getCompanyProfile(normalizedCompanyNumber)
            )
          },
          input: {
            companyNumber: normalizedCompanyNumber
          }
        }),
        renderHuman: renderCompanyInfoHuman
      });
    });
};
