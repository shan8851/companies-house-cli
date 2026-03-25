import type { Command } from "commander";

import { createColours } from "../lib/colours.js";
import { normalizeCompanyNumber } from "../lib/companyNumber.js";
import {
  compactRowValues,
  renderPaginationSummary,
  renderWrappedText,
  withFallback
} from "../lib/formatting.js";
import { normalizeFiling } from "../lib/normalizers.js";
import { fetchPaginatedItems } from "../lib/pagination.js";
import { createCliError } from "../lib/errors.js";
import type { FilingHistoryApiItem, FilingHistoryApiResponse } from "../types/api.js";
import type { HumanRenderContext, RuntimeDependencies } from "../types/cli.js";
import type { FilingsEnvelope } from "../types/normalized.js";
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

const FILINGS_HELP_EXAMPLES = [
  "ch filings 09215862",
  "ch filings 09215862 --type accounts",
  "ch filings 09215862 --type accounts --include-links",
  "ch filings 09215862 --all"
].join("\n  ");

const resolveCategoryFilter = (options: FilingsCommandOptions): string | undefined => {
  if (options.category && options.type && options.category !== options.type) {
    throw createCliError(
      "INVALID_INPUT",
      "--category and --type must match when both are provided."
    );
  }

  return options.category ?? options.type;
};

const renderCategoryTag = (
  category: string | null,
  context: HumanRenderContext
): string | null => {
  if (category === null) {
    return null;
  }

  const colours = createColours(context.ansiEnabled);
  const tagLabel = `[${category}]`;

  if (category === "accounts") {
    return colours.cyan(tagLabel);
  }

  if (category === "confirmation-statement") {
    return colours.accentGreen(tagLabel);
  }

  return tagLabel;
};

const renderFilingsHuman = (
  envelope: FilingsEnvelope,
  context: HumanRenderContext
): string => {
  const colours = createColours(context.ansiEnabled);
  const summary = envelope.pagination
    ? colours.dim(
        renderPaginationSummary(
          envelope.pagination.returnedCount,
          envelope.pagination.totalResults,
          envelope.pagination.fetchedAll
        )
      )
    : null;
  const filingBlocks =
    envelope.data.filings.length === 0
      ? [colours.dim("No filings found.")]
      : envelope.data.filings.map((filing) => {
          const header = [
            colours.dim(withFallback(filing.date, "unknown date")),
            colours.bold(colours.bright(withFallback(filing.type, "unknown type"))),
            renderCategoryTag(filing.category, context),
            filing.pages !== null
              ? colours.dim(`(${filing.pages} ${filing.pages === 1 ? "page" : "pages"})`)
              : null
          ]
            .filter((value): value is string => value !== null)
            .join(" ");
          const metadata = compactRowValues(
            filing.subcategory !== null ? `Subcategory ${filing.subcategory}` : null,
            filing.transactionId !== null ? `Transaction ${filing.transactionId}` : null
          );

          return [
            header,
            ...renderWrappedText(filing.description, context, {
              indent: 2,
              style: colours.dim
            }),
            ...(metadata !== null
              ? renderWrappedText(metadata, context, {
                  indent: 2,
                  style: colours.dim
                })
              : []),
            ...(envelope.input.includeLinks
              ? [
                  ...renderWrappedText(filing.documentMetadataUrl, context, {
                    indent: 2,
                    style: (value: string) => colours.dim(colours.underline(value))
                  }),
                  ...renderWrappedText(filing.documentContentUrl, context, {
                    indent: 2,
                    style: (value: string) => colours.dim(colours.underline(value))
                  })
                ]
              : [])
          ].join("\n");
        });

  return [summary, ...filingBlocks]
    .filter((line): line is string => line !== null)
    .join("\n\n");
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
      .option("--json", "Force JSON output.")
      .option("--text", "Force text output.")
      .addHelpText("after", `\nExamples:\n  ${FILINGS_HELP_EXAMPLES}`)
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
