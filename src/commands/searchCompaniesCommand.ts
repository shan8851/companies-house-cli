import type { Command } from "commander";

import { createColours } from "../lib/colours.js";
import { normalizeCompanySearchResult } from "../lib/normalizers.js";
import { fetchPaginatedItems } from "../lib/pagination.js";
import {
  compactRowValues,
  humanizeEnumValue,
  renderPaginationSummary,
  renderWrappedText,
  withFallback
} from "../lib/formatting.js";
import type { CompanySearchApiItem, CompanySearchApiResponse } from "../types/api.js";
import type { HumanRenderContext } from "../types/cli.js";
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

const SEARCH_HELP_EXAMPLES = [
  'ch search "Revolut"',
  'ch search "Revolut" --items-per-page 5',
  'ch search "Revolut" --start-index 20',
  'ch search "Revolut" --json'
].join("\n  ");

const formatCompanyStatus = (
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

const renderSearchCompaniesHuman = (
  envelope: SearchCompaniesEnvelope,
  context: HumanRenderContext
): string => {
  const colours = createColours(context.ansiEnabled);
  const companyBlocks =
    envelope.data.companies.length === 0
      ? [colours.dim("No companies found.")]
      : envelope.data.companies.map((company) => {
          const heading = [
            colours.bold(colours.bright(withFallback(company.name, "Unknown company"))),
            colours.cyan(`(${withFallback(company.companyNumber, "unknown")})`)
          ].join(" ");
          const metadata = compactRowValues(
            company.companyType,
            company.dateOfCreation !== null ? `Created ${company.dateOfCreation}` : null
          );
          const detailLines = [
            formatCompanyStatus(company.companyStatus, context),
            ...(metadata !== null ? renderWrappedText(metadata, context, { style: colours.dim }) : []),
            ...renderWrappedText(company.address?.formatted ?? null, context, {
              style: colours.dim
            }),
            ...renderWrappedText(company.description, context, {
              style: colours.dim
            })
          ].filter((line): line is string => line !== null);

          return [heading, ...detailLines].join("\n");
        });

  const summary = envelope.pagination
    ? colours.dim(
        renderPaginationSummary(
          envelope.pagination.returnedCount,
          envelope.pagination.totalResults,
          envelope.pagination.fetchedAll
        )
      )
    : null;

  return [summary, ...companyBlocks]
    .filter((line): line is string => line !== null)
    .join("\n\n");
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
      .option("--json", "Force JSON output.")
      .option("--text", "Force text output.")
      .addHelpText("after", `\nExamples:\n  ${SEARCH_HELP_EXAMPLES}`)
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
