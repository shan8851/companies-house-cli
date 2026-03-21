import type { Command } from "commander";

import { normalizeCompanyNumber } from "../lib/companyNumber.js";
import { formatList, renderKeyValueRows, renderPaginationSummary } from "../lib/formatting.js";
import { normalizeCharge } from "../lib/normalizers.js";
import { fetchPaginatedItems } from "../lib/pagination.js";
import type { ChargeApiItem, ChargeListApiResponse } from "../types/api.js";
import type { ChargesEnvelope } from "../types/normalized.js";
import type { RuntimeDependencies } from "../types/cli.js";
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

const renderChargesHuman = (envelope: ChargesEnvelope): string => {
  const summaryLines = [
    renderPaginationSummary(
      envelope.pagination?.returnedCount ?? envelope.data.charges.length,
      envelope.pagination?.totalResults ?? envelope.data.summary.totalCount,
      envelope.pagination?.fetchedAll ?? false
    ),
    ...renderKeyValueRows([
      {
        label: "Total charges",
        value:
          envelope.data.summary.totalCount !== null ? String(envelope.data.summary.totalCount) : null
      },
      {
        label: "Satisfied",
        value:
          envelope.data.summary.satisfiedCount !== null
            ? String(envelope.data.summary.satisfiedCount)
            : null
      },
      {
        label: "Part satisfied",
        value:
          envelope.data.summary.partSatisfiedCount !== null
            ? String(envelope.data.summary.partSatisfiedCount)
            : null
      }
    ])
  ];

  const chargeLines =
    envelope.data.charges.length === 0
      ? ["No charges found."]
      : envelope.data.charges.flatMap((charge, index) => [
          `${index + 1}. Charge ${charge.chargeCode ?? charge.chargeNumber ?? "unknown"} | ${
            charge.status ?? "status unknown"
          }`,
          ...renderKeyValueRows([
            {
              label: "   Created",
              value: charge.createdOn
            },
            {
              label: "   Delivered",
              value: charge.deliveredOn
            },
            {
              label: "   Classification",
              value: charge.classification
            },
            {
              label: "   Type",
              value: charge.type
            },
            {
              label: "   Persons entitled",
              value: formatList(charge.personsEntitled)
            },
            {
              label: "   Description",
              value: charge.briefDescription
            },
            {
              label: "   Satisfied",
              value: charge.satisfiedOn
            }
          ])
        ]);

  return [...summaryLines, "", ...chargeLines].join("\n");
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
