import type { Command } from "commander";

import { createColours } from "../lib/colours.js";
import { normalizeCompanyNumber } from "../lib/companyNumber.js";
import {
  compactRowValues,
  formatList,
  humanizeEnumValue,
  renderPaginationSummary,
  renderWrappedText,
  withFallback
} from "../lib/formatting.js";
import { normalizeCharge } from "../lib/normalizers.js";
import { fetchPaginatedItems } from "../lib/pagination.js";
import type { ChargeApiItem, ChargeListApiResponse } from "../types/api.js";
import type { HumanRenderContext, RuntimeDependencies } from "../types/cli.js";
import type { ChargesEnvelope } from "../types/normalized.js";
import {
  addListOptions,
  executeCommand,
  resolveListOptions
} from "./shared.js";

interface ChargesCommandOptions {
  all?: boolean;
  itemsPerPage?: number;
  startIndex?: number;
}

const renderChargeStatus = (
  chargeStatus: string | null,
  context: HumanRenderContext
): string | null => {
  if (chargeStatus === null) {
    return null;
  }

  const colours = createColours(context.ansiEnabled);
  const formattedStatus = humanizeEnumValue(chargeStatus);

  if (chargeStatus === "outstanding") {
    return colours.amber(formattedStatus);
  }

  if (chargeStatus === "satisfied") {
    return colours.accentGreen(formattedStatus);
  }

  if (chargeStatus === "part-satisfied") {
    return colours.dim(formattedStatus);
  }

  return formattedStatus;
};

const renderChargesHuman = (
  envelope: ChargesEnvelope,
  context: HumanRenderContext
): string => {
  const colours = createColours(context.ansiEnabled);
  const summaryLines = [
    colours.dim(
      renderPaginationSummary(
        envelope.pagination?.returnedCount ?? envelope.data.charges.length,
        envelope.pagination?.totalResults ?? envelope.data.summary.totalCount,
        envelope.pagination?.fetchedAll ?? false
      )
    ),
    compactRowValues(
      envelope.data.summary.totalCount !== null
        ? colours.bright(`${envelope.data.summary.totalCount} total`)
        : null,
      envelope.data.summary.satisfiedCount !== null
        ? colours.accentGreen(`${envelope.data.summary.satisfiedCount} satisfied`)
        : null,
      envelope.data.summary.partSatisfiedCount !== null
        ? colours.dim(`${envelope.data.summary.partSatisfiedCount} part satisfied`)
        : null
    )
  ].filter((line): line is string => line !== null);
  const chargeBlocks =
    envelope.data.charges.length === 0
      ? [colours.dim("No charges found.")]
      : envelope.data.charges.map((charge) => {
          const datesLine = compactRowValues(
            charge.createdOn !== null ? `Created ${charge.createdOn}` : null,
            charge.deliveredOn !== null ? `Delivered ${charge.deliveredOn}` : null,
            charge.satisfiedOn !== null ? `Satisfied ${charge.satisfiedOn}` : null
          );
          const metadataLine = compactRowValues(
            charge.classification,
            charge.type,
            formatList(charge.personsEntitled)
          );

          return [
            [
              colours.bold(
                colours.bright(
                  `Charge ${withFallback(charge.chargeCode, String(charge.chargeNumber ?? "unknown"))}`
                )
              ),
              renderChargeStatus(charge.status, context)
            ]
              .filter((value): value is string => value !== null)
              .join(" "),
            ...(datesLine !== null
              ? renderWrappedText(datesLine, context, { indent: 2, style: colours.dim })
              : []),
            ...(metadataLine !== null
              ? renderWrappedText(metadataLine, context, { indent: 2, style: colours.dim })
              : []),
            ...renderWrappedText(charge.briefDescription, context, {
              indent: 2,
              style: colours.dim
            })
          ].join("\n");
        });

  return [...summaryLines, ...(summaryLines.length > 0 ? [""] : []), ...chargeBlocks].join("\n\n");
};

export const registerChargesCommand = (
  program: Command,
  dependencies: RuntimeDependencies
): void => {
  addListOptions(
    program.command("charges <companyNumber>").description("List company charges.")
  ).action(async (companyNumber: string, options: ChargesCommandOptions, command: Command) => {
    const normalizedCompanyNumber = normalizeCompanyNumber(companyNumber);

    await executeCommand({
      command,
      commandName: "charges",
      dependencies,
      execute: async ({ client }) => {
        const listOptions = resolveListOptions(options);
        const firstPageSummary = await client.listCharges({
          companyNumber: normalizedCompanyNumber,
          itemsPerPage:
            (listOptions.all ?? false)
              ? listOptions.itemsPerPage ?? 100
              : listOptions.itemsPerPage ?? 10,
          startIndex: listOptions.startIndex ?? 0
        });
        const paginatedItems = listOptions.all
          ? await fetchPaginatedItems<ChargeApiItem, ChargeListApiResponse>({
              fetchPage: ({ itemsPerPage, startIndex }) =>
                client.listCharges({
                  companyNumber: normalizedCompanyNumber,
                  itemsPerPage,
                  startIndex
                }),
              options: listOptions
            })
          : {
              items: firstPageSummary.items ?? [],
              pagination: {
                fetchedAll: false,
                itemsPerPage: listOptions.itemsPerPage ?? 10,
                returnedCount: firstPageSummary.items?.length ?? 0,
                startIndex: listOptions.startIndex ?? 0,
                totalResults: firstPageSummary.total_count ?? null
              }
            };

        return {
          command: "charges",
          data: {
            charges: paginatedItems.items.map(normalizeCharge),
            summary: {
              partSatisfiedCount: firstPageSummary.part_satisfied_count ?? null,
              satisfiedCount: firstPageSummary.satisfied_count ?? null,
              totalCount: firstPageSummary.total_count ?? null,
              unfilteredCount: firstPageSummary.unfiletered_count ?? null
            }
          },
          input: {
            companyNumber: normalizedCompanyNumber
          },
          pagination: paginatedItems.pagination
        } satisfies ChargesEnvelope;
      },
      renderHuman: renderChargesHuman
    });
  });
};
