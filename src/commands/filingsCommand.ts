import { CommanderError, type Command } from "commander";

import { normalizeCompanyNumber } from "../lib/companyNumber.js";
import { renderKeyValueRows, renderPaginationSummary } from "../lib/formatting.js";
import { normalizeFiling } from "../lib/normalizers.js";
import { fetchPaginatedItems } from "../lib/pagination.js";
import type { FilingHistoryApiItem, FilingHistoryApiResponse } from "../types/api.js";
import type { FilingsEnvelope } from "../types/normalized.js";
import type { RuntimeDependencies } from "../types/cli.js";
import {
  addListOptions,
  executeCommand,
  resolveListOptions
} from "./shared.js";

interface FilingsCommandOptions {
  all?: boolean;
  category?: string;
  includeLinks?: boolean;
  itemsPerPage?: number;
  startIndex?: number;
  type?: string;
}

const resolveCategoryFilter = (options: FilingsCommandOptions): string | undefined => {
  if (options.category && options.type && options.category !== options.type) {
    throw new CommanderError(
      1,
      "command.invalidOption",
      "--category and --type must match when both are provided."
    );
  }

  return options.category ?? options.type;
};

const renderFilingsHuman = (envelope: FilingsEnvelope): string => {
  const summary = envelope.pagination
    ? renderPaginationSummary(
        envelope.pagination.returnedCount,
        envelope.pagination.totalResults,
        envelope.pagination.fetchedAll
      )
    : null;

  const filingLines =
    envelope.data.filings.length === 0
      ? ["No filings found."]
      : envelope.data.filings.flatMap((filing, index) => [
          `${index + 1}. ${filing.date ?? "unknown date"} | ${filing.type ?? "unknown type"} | ${
            filing.description ?? "No description"
          }`,
          ...renderKeyValueRows([
            {
              label: "   Category",
              value: filing.category
            },
            {
              label: "   Subcategory",
              value: filing.subcategory
            },
            {
              label: "   Pages",
              value: filing.pages !== null ? String(filing.pages) : null
            },
            {
              label: "   Transaction",
              value: filing.transactionId
            },
            {
              label: "   Document metadata",
              value: filing.documentMetadataUrl
            },
            {
              label: "   Document download",
              value: filing.documentContentUrl
            }
          ])
        ]);

  return [summary, ...filingLines].filter((line): line is string => line !== null).join("\n");
};

export const registerFilingsCommand = (
  program: Command,
  dependencies: RuntimeDependencies
): void => {
  addListOptions(
    program
      .command("filings <companyNumber>")
      .description("List filing history for a company.")
      .option("--category <category>", "Comma-separated filing categories.")
      .option(
        "--include-links",
        "Include direct document content URLs derived from Companies House document metadata links."
      )
      .option("--type <category>", "Alias for --category.")
  ).action(async (companyNumber: string, options: FilingsCommandOptions, command: Command) => {
    const normalizedCompanyNumber = normalizeCompanyNumber(companyNumber);

    await executeCommand({
      command,
      commandName: "filings",
      dependencies,
      execute: async ({ client }) => {
        const listOptions = resolveListOptions(options);
        const category = resolveCategoryFilter(options);
        const result = await fetchPaginatedItems<
          FilingHistoryApiItem,
          FilingHistoryApiResponse
        >({
          fetchPage: ({ itemsPerPage, startIndex }) =>
            client.listFilings({
              companyNumber: normalizedCompanyNumber,
              itemsPerPage,
              startIndex,
              ...(category !== undefined ? { category } : {})
            }),
          options: listOptions
        });

        return {
          command: "filings",
          data: {
            filings: result.items.map((item) =>
              normalizeFiling(item, {
                includeLinks: options.includeLinks ?? false
              })
            )
          },
          input: {
            category: category ?? null,
            companyNumber: normalizedCompanyNumber,
            includeLinks: options.includeLinks ?? false
          },
          pagination: result.pagination
        } satisfies FilingsEnvelope;
      },
      renderHuman: renderFilingsHuman
    });
  });
};
