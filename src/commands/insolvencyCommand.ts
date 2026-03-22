import type { Command } from "commander";

import { createColours } from "../lib/colours.js";
import { normalizeCompanyNumber } from "../lib/companyNumber.js";
import { compactRowValues, renderWrappedText } from "../lib/formatting.js";
import { normalizeInsolvencyCases } from "../lib/normalizers.js";
import type { HumanRenderContext, RuntimeDependencies } from "../types/cli.js";
import type { InsolvencyEnvelope } from "../types/normalized.js";
import { executeCommand } from "./shared.js";

const renderInsolvencyHuman = (
  envelope: InsolvencyEnvelope,
  context: HumanRenderContext
): string => {
  const colours = createColours(context.ansiEnabled);

  if (envelope.data.cases.length === 0) {
    return colours.dim("No insolvency history.");
  }

  const caseBlocks = envelope.data.cases.map((insolvencyCase) => {
    const caseDateLines = insolvencyCase.caseDates.flatMap((caseDate) =>
      renderWrappedText(
        compactRowValues(caseDate.type, caseDate.date) ?? "Unknown case date",
        context,
        {
          indent: 2,
          style: colours.dim
        }
      )
    );
    const practitionerLines = insolvencyCase.practitioners.flatMap((practitioner) => {
      const header = compactRowValues(practitioner.name, practitioner.role) ?? "Unknown practitioner";
      const appointmentDates = compactRowValues(
        practitioner.appointedOn !== null ? `Appointed ${practitioner.appointedOn}` : null,
        practitioner.ceasedToActOn !== null ? `Ceased ${practitioner.ceasedToActOn}` : null
      );

      return [
        colours.dim(`  ${header}`),
        ...(appointmentDates !== null
          ? renderWrappedText(appointmentDates, context, {
              indent: 4,
              style: colours.dim
            })
          : []),
        ...renderWrappedText(practitioner.address?.formatted ?? null, context, {
          indent: 4,
          style: colours.dim
        })
      ];
    });
    const notesLines = insolvencyCase.notes.flatMap((note) =>
      renderWrappedText(note, context, {
        indent: 2,
        style: colours.dim
      })
    );

    return [
      [
        colours.bold(colours.bright(insolvencyCase.number ?? "No case number")),
        colours.bright(insolvencyCase.type ?? "Unknown case type")
      ].join(" "),
      ...caseDateLines,
      ...practitionerLines,
      ...notesLines
    ].join("\n");
  });
  const statusLine =
    envelope.data.status !== null
      ? colours.dim(`Status: ${envelope.data.status}`)
      : null;

  return [statusLine, ...caseBlocks]
    .filter((block): block is string => block !== null)
    .join("\n\n");
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
