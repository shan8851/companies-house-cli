import type { Command } from "commander";

import {
  formatDateOfBirth,
  renderKeyValueRows,
  renderPaginationSummary
} from "../lib/formatting.js";
import { normalizeCompanyNumber } from "../lib/companyNumber.js";
import { normalizeOfficer } from "../lib/normalizers.js";
import { fetchPaginatedItems } from "../lib/pagination.js";
import type { OfficerApiItem, OfficerListApiResponse } from "../types/api.js";
import type { OfficersEnvelope } from "../types/normalized.js";
import type { RuntimeDependencies } from "../types/cli.js";
import {
  addListOptions,
  executeCommand,
  resolveListOptions
} from "./shared.js";

interface OfficersCommandOptions {
  all?: boolean;
  itemsPerPage?: number;
  orderBy?: string;
  registerType?: string;
  registerView?: string;
  startIndex?: number;
}

const renderOfficersHuman = (envelope: OfficersEnvelope): string => {
  const summaryLines = [
    renderPaginationSummary(
      envelope.pagination?.returnedCount ?? envelope.data.officers.length,
      envelope.pagination?.totalResults ?? null,
      envelope.pagination?.fetchedAll ?? false
    ),
    ...renderKeyValueRows([
      {
        label: "Active officers",
        value:
          envelope.data.summary.activeCount !== null
            ? String(envelope.data.summary.activeCount)
            : null
      },
      {
        label: "Resigned officers",
        value:
          envelope.data.summary.resignedCount !== null
            ? String(envelope.data.summary.resignedCount)
            : null
      }
    ])
  ];

  const officerLines =
    envelope.data.officers.length === 0
      ? ["No officers found."]
      : envelope.data.officers.flatMap((officer, index) => [
          `${index + 1}. ${officer.name ?? "Unknown officer"} | ${officer.officerRole ?? "role unknown"}`,
          ...renderKeyValueRows([
            {
              label: "   Appointed",
              value: officer.appointedOn
            },
            {
              label: "   Resigned",
              value: officer.resignedOn
            },
            {
              label: "   Occupation",
              value: officer.occupation
            },
            {
              label: "   Nationality",
              value: officer.nationality
            },
            {
              label: "   Date of birth",
              value: formatDateOfBirth(officer.dateOfBirth)
            },
            {
              label: "   Address",
              value: officer.address?.formatted ?? officer.principalOfficeAddress?.formatted ?? null
            }
          ])
        ]);

  return [...summaryLines, "", ...officerLines].join("\n");
};

export const registerOfficersCommand = (
  program: Command,
  dependencies: RuntimeDependencies
): void => {
  addListOptions(
    program
      .command("officers <companyNumber>")
      .description("List company officers.")
      .option("--order-by <orderBy>", "Sort order to request from Companies House.")
      .option("--register-type <registerType>", "Register type filter.")
      .option("--register-view <registerView>", "Register view filter.")
  ).action(async (companyNumber: string, options: OfficersCommandOptions, command: Command) => {
    const normalizedCompanyNumber = normalizeCompanyNumber(companyNumber);

    await executeCommand({
      command,
      commandName: "officers",
      dependencies,
      execute: async ({ client }) => {
        const listOptions = resolveListOptions(options);
        const firstPageSummary = await client.listOfficers({
          companyNumber: normalizedCompanyNumber,
          itemsPerPage:
            (listOptions.all ?? false)
              ? listOptions.itemsPerPage ?? 100
              : listOptions.itemsPerPage ?? 10,
          startIndex: listOptions.startIndex ?? 0,
          ...(options.orderBy !== undefined ? { orderBy: options.orderBy } : {}),
          ...(options.registerType !== undefined
            ? { registerType: options.registerType }
            : {}),
          ...(options.registerView !== undefined
            ? { registerView: options.registerView }
            : {})
        });
        const paginatedItems = listOptions.all
          ? await fetchPaginatedItems<OfficerApiItem, OfficerListApiResponse>({
              fetchPage: ({ itemsPerPage, startIndex }) =>
                client.listOfficers({
                  companyNumber: normalizedCompanyNumber,
                  itemsPerPage,
                  startIndex,
                  ...(options.orderBy !== undefined ? { orderBy: options.orderBy } : {}),
                  ...(options.registerType !== undefined
                    ? { registerType: options.registerType }
                    : {}),
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
          command: "officers",
          data: {
            officers: paginatedItems.items.map(normalizeOfficer),
            summary: {
              activeCount: firstPageSummary.active_count ?? null,
              resignedCount: firstPageSummary.resigned_count ?? null
            }
          },
          input: {
            companyNumber: normalizedCompanyNumber,
            orderBy: options.orderBy ?? null,
            registerType: options.registerType ?? null,
            registerView: options.registerView ?? null
          },
          pagination: paginatedItems.pagination
        } satisfies OfficersEnvelope;
      },
      renderHuman: renderOfficersHuman
    });
  });
};
