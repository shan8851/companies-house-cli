import type { Command } from "commander";

import { renderPaginationSummary, renderKeyValueRows } from "../lib/formatting.js";
import { normalizeCompanySearchResult } from "../lib/normalizers.js";
import { fetchPaginatedItems } from "../lib/pagination.js";
import type { CompanySearchApiItem, CompanySearchApiResponse } from "../types/api.js";
import type { SearchCompaniesEnvelope } from "../types/normalized.js";
import type { RuntimeDependencies } from "../types/cli.js";
import {
  addListOptions,
  executeCommand,
  resolveListOptions
} from "./shared.js";

interface SearchCompaniesCommandOptions {
  all?: boolean;
  itemsPerPage?: number;
  restrictions?: string;
  startIndex?: number;
}

const renderSearchCompaniesHuman = (envelope: SearchCompaniesEnvelope): string => {
  const companyLines =
    envelope.data.companies.length === 0
      ? ["No companies found."]
      : envelope.data.companies.flatMap((company, index) => [
          `${index + 1}. ${company.name ?? "Unknown company"} (${company.companyNumber ?? "unknown"})`,
          ...renderKeyValueRows([
            {
              label: "   Status",
              value: company.companyStatus
            },
            {
              label: "   Type",
              value: company.companyType
            },
            {
              label: "   Created",
              value: company.dateOfCreation
            },
            {
              label: "   Address",
              value: company.address?.formatted ?? null
            },
            {
              label: "   Description",
              value: company.description
            }
          ])
        ]);

  const summary = envelope.pagination
    ? renderPaginationSummary(
        envelope.pagination.returnedCount,
        envelope.pagination.totalResults,
        envelope.pagination.fetchedAll
      )
    : null;

  return [summary, ...companyLines].filter((line): line is string => line !== null).join("\n");
};

export const registerSearchCompaniesCommand = (
  program: Command,
  dependencies: RuntimeDependencies
): void => {
  addListOptions(
    program
      .command("search <query>")
      .description("Search companies by name.")
      .option(
        "--restrictions <restrictions>",
        "Search restrictions to pass through to Companies House."
      )
  ).action(async (query: string, options: SearchCompaniesCommandOptions, command: Command) => {
    await executeCommand({
      command,
      commandName: "search",
      dependencies,
      execute: async ({ client }) => {
        const listOptions = resolveListOptions(options);
        const result = await fetchPaginatedItems<
          CompanySearchApiItem,
          CompanySearchApiResponse
        >({
          fetchPage: ({ itemsPerPage, startIndex }) =>
            client.searchCompanies({
              itemsPerPage,
              query,
              startIndex,
              ...(options.restrictions !== undefined
                ? { restrictions: options.restrictions }
                : {})
            }),
          options: listOptions
        });

        return {
          command: "search",
          data: {
            companies: result.items.map(normalizeCompanySearchResult)
          },
          input: {
            query,
            restrictions: options.restrictions ?? null
          },
          pagination: result.pagination
        } satisfies SearchCompaniesEnvelope;
      },
      renderHuman: renderSearchCompaniesHuman
    });
  });
};
