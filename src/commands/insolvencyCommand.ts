import type { Command } from "commander";

import { normalizeCompanyNumber } from "../lib/companyNumber.js";
import { renderKeyValueRows } from "../lib/formatting.js";
import { normalizeInsolvencyCases } from "../lib/normalizers.js";
import type { InsolvencyEnvelope } from "../types/normalized.js";
import type { RuntimeDependencies } from "../types/cli.js";
import { executeCommand } from "./shared.js";

const renderInsolvencyHuman = (envelope: InsolvencyEnvelope): string => {
  if (envelope.data.cases.length === 0) {
    return envelope.data.status
      ? `No insolvency cases found.\nStatus: ${envelope.data.status}`
      : "No insolvency cases found.";
  }

  const caseLines = envelope.data.cases.flatMap((insolvencyCase, index) => [
    `${index + 1}. ${insolvencyCase.type ?? "Unknown case type"} | ${
      insolvencyCase.number ?? "No case number"
    }`,
    ...renderKeyValueRows(
      insolvencyCase.caseDates.map((caseDate, caseDateIndex) => ({
        label: `   Date ${caseDateIndex + 1}`,
        value: `${caseDate.type ?? "unknown"}: ${caseDate.date ?? "unknown"}`
      }))
    ),
    ...insolvencyCase.practitioners.map(
      (practitioner, practitionerIndex) =>
        `   Practitioner ${practitionerIndex + 1}: ${
          practitioner.name ?? "Unknown"
        } | ${practitioner.role ?? "role unknown"}`
    )
  ]);

  return [`Status: ${envelope.data.status ?? "unknown"}`, ...caseLines].join("\n");
};

export const registerInsolvencyCommand = (
  program: Command,
  dependencies: RuntimeDependencies
): void => {
  program
    .command("insolvency <companyNumber>")
    .description("Show insolvency information for a company.")
    .action(async (companyNumber: string, _options: object, command: Command) => {
      const normalizedCompanyNumber = normalizeCompanyNumber(companyNumber);

      await executeCommand({
        command,
        commandName: "insolvency",
        dependencies,
        execute: async ({ client }) => {
          const insolvency = await client.getInsolvency(normalizedCompanyNumber);

          return {
            command: "insolvency",
            data: {
              cases: normalizeInsolvencyCases(insolvency),
              status: insolvency?.status ?? null
            },
            input: {
              companyNumber: normalizedCompanyNumber
            }
          } satisfies InsolvencyEnvelope;
        },
        renderHuman: renderInsolvencyHuman
      });
    });
};
