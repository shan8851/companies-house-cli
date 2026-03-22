import type { Command } from "commander";

import { createColours } from "../lib/colours.js";
import {
  formatList,
  humanizeEnumValue,
  joinSections,
  renderKeyValueRows,
  renderSection
} from "../lib/formatting.js";
import { normalizeCompanyNumber } from "../lib/companyNumber.js";
import { normalizeCompanyProfile } from "../lib/normalizers.js";
import type { HumanRenderContext, RuntimeDependencies } from "../types/cli.js";
import type { CompanyInfoEnvelope } from "../types/normalized.js";
import { executeCommand } from "./shared.js";

const identity = (value: string): string => value;

const renderCompanyStatus = (
  companyStatus: string | null,
  context: HumanRenderContext
): string | null => {
  if (companyStatus === null) {
    return null;
  }

  const colours = createColours(context.ansiEnabled);
  const formattedStatus = humanizeEnumValue(companyStatus);

  if (companyStatus === "active") {
    return colours.accentGreen(formattedStatus);
  }

  if (companyStatus === "dissolved") {
    return colours.dangerRed(formattedStatus);
  }

  return colours.amber(formattedStatus);
};

const renderYesNoValue = (
  value: boolean | null,
  context: HumanRenderContext,
  options?: {
    falseStyle?: (value: string) => string;
    trueStyle?: (value: string) => string;
  }
): string | null => {
  if (value === null) {
    return null;
  }

  const colours = createColours(context.ansiEnabled);

  return value
    ? (options?.trueStyle ?? colours.amber)("Yes")
    : (options?.falseStyle ?? colours.dim)("No");
};

const renderCompanyInfoHuman = (
  envelope: CompanyInfoEnvelope,
  context: HumanRenderContext
): string => {
  const company = envelope.data.company;
  const colours = createColours(context.ansiEnabled);
  const labelStyle = (value: string): string => colours.dim(value);
  const brightValueStyle = (value: string): string => colours.bright(value);
  const header = [
    colours.bold(colours.bright(company.companyName ?? "Unknown company")),
    colours.cyan(`(${company.companyNumber ?? "unknown"})`)
  ].join(" ");
  const companyDetailsSection = renderSection(
    "Company Details",
    renderKeyValueRows(
      [
        {
          label: "Status",
          labelStyle,
          value: company.companyStatus,
          valueStyle: (value: string) =>
            renderCompanyStatus(value.toLowerCase(), context) ?? brightValueStyle(value)
        },
        {
          label: "Status detail",
          labelStyle,
          value: company.companyStatusDetail,
          valueStyle: brightValueStyle
        },
        {
          label: "Type",
          labelStyle,
          value: company.type,
          valueStyle: brightValueStyle
        },
        {
          label: "Subtype",
          labelStyle,
          value: company.subtype,
          valueStyle: brightValueStyle
        },
        {
          label: "Created",
          labelStyle,
          value: company.dateOfCreation,
          valueStyle: brightValueStyle
        },
        {
          label: "Cessation",
          labelStyle,
          value: company.dateOfCessation,
          valueStyle: brightValueStyle
        },
        {
          label: "Jurisdiction",
          labelStyle,
          value: company.jurisdiction,
          valueStyle: brightValueStyle
        },
        {
          label: "Registered office",
          labelStyle,
          value: company.registeredOfficeAddress?.formatted ?? null,
          valueStyle: brightValueStyle
        },
        {
          label: "SIC codes",
          labelStyle,
          value: formatList(company.sicCodes),
          valueStyle: brightValueStyle
        },
        {
          label: "Has charges",
          labelStyle,
          value: renderYesNoValue(company.hasCharges, context),
          valueStyle: identity
        },
        {
          label: "Has insolvency history",
          labelStyle,
          value: renderYesNoValue(company.hasInsolvencyHistory, context),
          valueStyle: identity
        }
      ],
      context
    ),
    context
  );
  const accountsSection = renderSection(
    "Accounts",
    renderKeyValueRows(
      [
        {
          label: "Next accounts due",
          labelStyle,
          value: company.accounts.nextAccountsDueOn,
          valueStyle: brightValueStyle
        },
        {
          label: "Next accounts made up to",
          labelStyle,
          value: company.accounts.nextAccountsMadeUpTo,
          valueStyle: brightValueStyle
        },
        {
          label: "Accounts overdue",
          labelStyle,
          value: renderYesNoValue(company.accounts.overdue, context, {
            falseStyle: colours.dim,
            trueStyle: (value: string) => colours.bold(colours.dangerRed(value))
          }),
          valueStyle: identity
        }
      ],
      context
    ),
    context
  );
  const confirmationSection = renderSection(
    "Confirmation Statement",
    renderKeyValueRows(
      [
        {
          label: "Next confirmation due",
          labelStyle,
          value: company.confirmationStatement.nextDueOn,
          valueStyle: brightValueStyle
        },
        {
          label: "Next confirmation made up to",
          labelStyle,
          value: company.confirmationStatement.nextMadeUpTo,
          valueStyle: brightValueStyle
        },
        {
          label: "Confirmation overdue",
          labelStyle,
          value: renderYesNoValue(company.confirmationStatement.overdue, context),
          valueStyle: identity
        }
      ],
      context
    ),
    context
  );
  const previousNamesSection = renderSection(
    "Previous Names",
    company.previousCompanyNames.map((previousCompanyName) => {
      const metadata = [
        previousCompanyName.effectiveFrom !== null
          ? `From ${previousCompanyName.effectiveFrom}`
          : null,
        previousCompanyName.ceasedOn !== null ? `Ceased ${previousCompanyName.ceasedOn}` : null
      ]
        .filter((value): value is string => value !== null)
        .join(" | ");

      return [
        colours.bright(previousCompanyName.name ?? "Unknown name"),
        metadata.length > 0 ? colours.dim(metadata) : null
      ]
        .filter((value): value is string => value !== null)
        .join(" ");
    }),
    context
  );

  return joinSections([
    header,
    companyDetailsSection,
    accountsSection,
    confirmationSection,
    previousNamesSection
  ]);
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
