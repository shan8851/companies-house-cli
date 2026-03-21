import type { Command } from "commander";

import { normalizeCompanyNumber } from "../lib/companyNumber.js";
import {
  formatDateOfBirth,
  formatList,
  renderKeyValueRows,
  renderPaginationSummary
} from "../lib/formatting.js";
import { normalizePsc } from "../lib/normalizers.js";
import { fetchPaginatedItems } from "../lib/pagination.js";
import type { PscApiItem, PscListApiResponse } from "../types/api.js";
import type { PscEnvelope } from "../types/normalized.js";
import type { RuntimeDependencies } from "../types/cli.js";
import {
  addListOptions,
  executeCommand,
  resolveListOptions
} from "./shared.js";

interface PscCommandOptions {
  all?: boolean;
  itemsPerPage?: number;
  registerView?: string;
  startIndex?: number;
}

const renderPscHuman = (envelope: PscEnvelope): string => {
  const summaryLines = [
    renderPaginationSummary(
      envelope.pagination?.returnedCount ?? envelope.data.psc.length,
      envelope.pagination?.totalResults ?? null,
      envelope.pagination?.fetchedAll ?? false
    ),
    ...renderKeyValueRows([
      {
        label: "Active PSC entries",
        value:
          envelope.data.summary.activeCount !== null
            ? String(envelope.data.summary.activeCount)
            : null
      },
      {
        label: "Ceased PSC entries",
        value:
          envelope.data.summary.ceasedCount !== null
            ? String(envelope.data.summary.ceasedCount)
            : null
      }
    ])
  ];

  const pscLines =
    envelope.data.psc.length === 0
      ? ["No persons with significant control found."]
      : envelope.data.psc.flatMap((psc, index) => [
          `${index + 1}. ${psc.name ?? psc.description ?? "Unknown PSC"} | ${psc.kind ?? "kind unknown"}`,
          ...renderKeyValueRows([
            {
              label: "   Notified",
              value: psc.notifiedOn
            },
            {
              label: "   Ceased",
              value: psc.ceasedOn
            },
            {
              label: "   Nationality",
              value: psc.nationality
            },
            {
              label: "   Country of residence",
              value: psc.countryOfResidence
            },
            {
              label: "   Date of birth",
              value: formatDateOfBirth(psc.dateOfBirth)
            },
            {
              label: "   Address",
              value: psc.address?.formatted ?? psc.principalOfficeAddress?.formatted ?? null
            },
            {
              label: "   Natures of control",
              value: formatList(psc.naturesOfControl)
            }
          ])
        ]);

  return [...summaryLines, "", ...pscLines].join("\n");
};

export const registerPscCommand = (
  program: Command,
  dependencies: RuntimeDependencies
): void => {
  addListOptions(
    program
      .command("psc <companyNumber>")
      .description("List persons with significant control for a company.")
      .option("--register-view <registerView>", "Register view filter.")
  ).action(async (companyNumber: string, options: PscCommandOptions, command: Command) => {
    const normalizedCompanyNumber = normalizeCompanyNumber(companyNumber);

    await executeCommand({
      command,
      commandName: "psc",
      dependencies,
      execute: async ({ client }) => {
        const listOptions = resolveListOptions(options);
        const firstPageSummary = await client.listPsc({
          companyNumber: normalizedCompanyNumber,
          itemsPerPage:
            (listOptions.all ?? false)
              ? listOptions.itemsPerPage ?? 100
              : listOptions.itemsPerPage ?? 10,
          startIndex: listOptions.startIndex ?? 0,
          ...(options.registerView !== undefined
            ? { registerView: options.registerView }
            : {})
        });
        const paginatedItems = listOptions.all
          ? await fetchPaginatedItems<PscApiItem, PscListApiResponse>({
              fetchPage: ({ itemsPerPage, startIndex }) =>
                client.listPsc({
                  companyNumber: normalizedCompanyNumber,
                  itemsPerPage,
                  startIndex,
                  ...(options.registerView !== undefined
                    ? { registerView: options.registerView }
                    : {})
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
                totalResults: firstPageSummary.total_results ?? null
              }
            };

        return {
          command: "psc",
          data: {
            psc: paginatedItems.items.map(normalizePsc),
            summary: {
              activeCount: firstPageSummary.active_count ?? null,
              ceasedCount: firstPageSummary.ceased_count ?? null
            }
          },
          input: {
            companyNumber: normalizedCompanyNumber,
            registerView: options.registerView ?? null
          },
          pagination: paginatedItems.pagination
        } satisfies PscEnvelope;
      },
      renderHuman: renderPscHuman
    });
  });
};
