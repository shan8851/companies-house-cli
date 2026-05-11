import type { Command } from "commander";

import { createColours } from "../lib/colours.js";
import {
  compactRowValues,
  humanizeEnumValue,
  renderPaginationSummary,
  renderWrappedText,
  withFallback
} from "../lib/formatting.js";
import { createCliError } from "../lib/errors.js";
import { normalizeCompanySearchResult } from "../lib/normalizers.js";
import { fetchPaginatedItems } from "../lib/pagination.js";
import type { CompanySearchApiItem, CompanySearchApiResponse } from "../types/api.js";
import type { HumanRenderContext, RuntimeDependencies } from "../types/cli.js";
import type { AdvancedSearchCompaniesEnvelope } from "../types/normalized.js";
import { addListOptions, executeCommand, resolveListOptions } from "./shared.js";

interface AdvancedSearchCompaniesCommandOptions {
  all?: boolean;
  companyNameExcludes?: string;
  companyNameIncludes?: string;
  companyStatus?: string;
  companySubtype?: string;
  companyType?: string;
  dissolvedFrom?: string;
  dissolvedTo?: string;
  incorporatedFrom?: string;
  incorporatedTo?: string;
  itemsPerPage?: number;
  location?: string;
  sicCodes?: string;
  startIndex?: number;
}

const HELP_EXAMPLES = [
  'ch search-advanced --location "County Durham" --company-status active --sic-codes 69201',
  'ch search-advanced --company-name-includes cleaning --location Sunderland --items-per-page 20',
  'ch search-advanced --incorporated-from 2024-01-01 --incorporated-to 2024-12-31 --json'
].join("\n  ");

const formatCompanyStatus = (
  companyStatus: string | null,
  context: HumanRenderContext
): string | null => {
  if (companyStatus === null) return null;

  const colours = createColours(context.ansiEnabled);
  const formattedStatus = humanizeEnumValue(companyStatus);

  if (companyStatus === "active") return colours.accentGreen(formattedStatus);
  if (companyStatus === "dissolved") return colours.dangerRed(formattedStatus);

  return colours.amber(formattedStatus);
};

const renderAdvancedSearchCompaniesHuman = (
  envelope: AdvancedSearchCompaniesEnvelope,
  context: HumanRenderContext
): string => {
  const colours = createColours(context.ansiEnabled);
  const activeFilters = Object.entries(envelope.input)
    .filter(([, value]) => value !== null)
    .map(([key, value]) => `${key}: ${value}`);
  const filterLine =
    activeFilters.length > 0 ? colours.dim(`Filters: ${activeFilters.join(" · ")}`) : null;
  const summary = envelope.pagination
    ? colours.dim(
        renderPaginationSummary(
          envelope.pagination.returnedCount,
          envelope.pagination.totalResults,
          envelope.pagination.fetchedAll
        )
      )
    : null;
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
            company.dateOfCreation !== null ? `Created ${company.dateOfCreation}` : null,
            company.dateOfCessation !== null ? `Ceased ${company.dateOfCessation}` : null
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

  return [filterLine, summary, ...companyBlocks]
    .filter((line): line is string => line !== null)
    .join("\n\n");
};

const hasAnyAdvancedFilter = (options: AdvancedSearchCompaniesCommandOptions): boolean =>
  [
    options.companyNameExcludes,
    options.companyNameIncludes,
    options.companyStatus,
    options.companySubtype,
    options.companyType,
    options.dissolvedFrom,
    options.dissolvedTo,
    options.incorporatedFrom,
    options.incorporatedTo,
    options.location,
    options.sicCodes
  ].some((value) => value !== undefined && value.trim().length > 0);

export const registerAdvancedSearchCompaniesCommand = (
  program: Command,
  dependencies: RuntimeDependencies
): void => {
  addListOptions(
    program
      .command("search-advanced")
      .description("Advanced company search by location, SIC code, status, dates, and name filters.")
      .option("--company-name-includes <text>", "Company name text that must be included.")
      .option("--company-name-excludes <text>", "Company name text that must be excluded.")
      .option("--company-status <status>", "Company status, for example active or dissolved.")
      .option("--company-type <type>", "Company type, for example ltd, plc, llp.")
      .option("--company-subtype <subtype>", "Company subtype filter.")
      .option("--location <location>", "Registered office location text.")
      .option("--sic-codes <codes>", "Comma-separated SIC codes, for example 69201,62012.")
      .option("--incorporated-from <date>", "Earliest incorporation date, YYYY-MM-DD.")
      .option("--incorporated-to <date>", "Latest incorporation date, YYYY-MM-DD.")
      .option("--dissolved-from <date>", "Earliest dissolution date, YYYY-MM-DD.")
      .option("--dissolved-to <date>", "Latest dissolution date, YYYY-MM-DD.")
      .option("--json", "Force JSON output.")
      .option("--text", "Force text output.")
      .addHelpText("after", `
Examples:
  ${HELP_EXAMPLES}`)
  ).action(async (options: AdvancedSearchCompaniesCommandOptions, command: Command) => {
    await executeCommand({
      command,
      commandName: "search-advanced",
      dependencies,
      execute: async ({ client }) => {
        if (!hasAnyAdvancedFilter(options)) {
          throw createCliError(
            "INVALID_INPUT",
            "At least one advanced search filter is required. Try --location, --sic-codes, --company-status, or --company-name-includes."
          );
        }

        const listOptions = resolveListOptions(options);
        const result = await fetchPaginatedItems<
          CompanySearchApiItem,
          CompanySearchApiResponse
        >({
          fetchPage: ({ itemsPerPage, startIndex }) =>
            client.searchCompaniesAdvanced({
              companyNameExcludes: options.companyNameExcludes,
              companyNameIncludes: options.companyNameIncludes,
              companyStatus: options.companyStatus,
              companySubtype: options.companySubtype,
              companyType: options.companyType,
              dissolvedFrom: options.dissolvedFrom,
              dissolvedTo: options.dissolvedTo,
              incorporatedFrom: options.incorporatedFrom,
              incorporatedTo: options.incorporatedTo,
              itemsPerPage,
              location: options.location,
              sicCodes: options.sicCodes,
              startIndex
            }),
          options: listOptions
        });

        return {
          command: "search-advanced",
          data: {
            companies: result.items.map(normalizeCompanySearchResult)
          },
          input: {
            companyNameExcludes: options.companyNameExcludes ?? null,
            companyNameIncludes: options.companyNameIncludes ?? null,
            companyStatus: options.companyStatus ?? null,
            companySubtype: options.companySubtype ?? null,
            companyType: options.companyType ?? null,
            dissolvedFrom: options.dissolvedFrom ?? null,
            dissolvedTo: options.dissolvedTo ?? null,
            incorporatedFrom: options.incorporatedFrom ?? null,
            incorporatedTo: options.incorporatedTo ?? null,
            location: options.location ?? null,
            sicCodes: options.sicCodes ?? null
          },
          pagination: result.pagination
        } satisfies AdvancedSearchCompaniesEnvelope;
      },
      renderHuman: renderAdvancedSearchCompaniesHuman
    });
  });
};
