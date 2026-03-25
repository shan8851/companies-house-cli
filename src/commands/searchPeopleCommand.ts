import type { Command } from "commander";

import { createColours } from "../lib/colours.js";
import {
  compactRowValues,
  formatDateOfBirth,
  renderPaginationSummary,
  renderWrappedText,
  withFallback
} from "../lib/formatting.js";
import {
  extractOfficerId,
  normalizeOfficerAppointment,
  normalizePersonSearchResult
} from "../lib/normalizers.js";
import { fetchPaginatedItems } from "../lib/pagination.js";
import type {
  OfficerAppointmentApiItem,
  OfficerAppointmentListApiResponse,
  OfficerSearchApiItem,
  OfficerSearchApiResponse
} from "../types/api.js";
import type { HumanRenderContext, RuntimeDependencies } from "../types/cli.js";
import type { SearchPeopleEnvelope } from "../types/normalized.js";
import {
  addListOptions,
  executeCommand,
  parsePositiveInteger,
  resolveListOptions
} from "./shared.js";

const DEFAULT_MATCH_LIMIT = 10;

const SEARCH_PERSON_HELP_EXAMPLES = [
  'ch search-person "Nik Storonsky"',
  'ch search-person "Nik Storonsky" --match-limit 5',
  'ch search-person "Nik Storonsky" --items-per-page 20',
  'ch search-person "Nik Storonsky" --json'
].join("\n  ");

interface SearchPeopleCommandOptions {
  all?: boolean;
  itemsPerPage?: number;
  matchLimit?: number;
  startIndex?: number;
}

const renderSearchPeopleHuman = (
  envelope: SearchPeopleEnvelope,
  context: HumanRenderContext
): string => {
  const colours = createColours(context.ansiEnabled);
  const summary = colours.dim(
    renderPaginationSummary(
      envelope.data.results.length,
      envelope.data.totalSearchHits,
      envelope.pagination?.fetchedAll ?? false
    )
  );
  const resultBlocks =
    envelope.data.results.length === 0
      ? [colours.dim("No matching people found.")]
      : envelope.data.results.map((result) => {
          const metadata = compactRowValues(
            result.officerId !== null ? `Officer ID ${result.officerId}` : null,
            formatDateOfBirth(result.dateOfBirth)
          );
          const appointmentCountLabel =
            result.appointmentCount !== null
              ? `${result.appointmentCount} appointments`
              : "appointments unknown";
          const appointmentLines =
            result.appointments.length === 0
              ? [colours.dim("  No appointments found.")]
              : result.appointments.flatMap((appointment) => {
                  const appointmentHeader = [
                    colours.bold(
                      colours.bright(withFallback(appointment.companyName, "Unknown company"))
                    ),
                    colours.dim(`(${withFallback(appointment.officerRole, "role unknown")})`),
                    colours.cyan(`(${withFallback(appointment.companyNumber, "unknown")})`)
                  ].join(" ");
                  const appointmentMetadata = compactRowValues(
                    appointment.appointedOn !== null
                      ? `Appointed ${appointment.appointedOn}`
                      : null,
                    appointment.resignedOn !== null
                      ? `Resigned ${appointment.resignedOn}`
                      : null
                  );

                  return [
                    `  ${appointmentHeader}`,
                    ...(appointmentMetadata !== null
                      ? renderWrappedText(appointmentMetadata, context, {
                          indent: 4,
                          style: colours.dim
                        })
                      : [])
                  ];
                });

          return [
            [
              colours.bold(colours.bright(withFallback(result.name, "Unknown person"))),
              colours.cyan(`(${appointmentCountLabel})`)
            ].join(" "),
            ...(metadata !== null
              ? renderWrappedText(metadata, context, { indent: 2, style: colours.dim })
              : []),
            ...renderWrappedText(result.address?.formatted ?? null, context, {
              indent: 2,
              style: colours.dim
            }),
            ...renderWrappedText(result.description, context, {
              indent: 2,
              style: colours.dim
            }),
            ...appointmentLines
          ].join("\n");
        });

  return [summary, ...resultBlocks].join("\n\n");
};

export const registerSearchPeopleCommand = (
  program: Command,
  dependencies: RuntimeDependencies
): void => {
  addListOptions(
    program
      .command("search-person <query>")
      .description("Search officers and resolve their company appointments.")
      .option(
        "--match-limit <number>",
        "Number of officer matches to enrich with appointments.",
        parsePositiveInteger,
        DEFAULT_MATCH_LIMIT
      )
      .option("--json", "Force JSON output.")
      .option("--text", "Force text output.")
      .addHelpText("after", `\nExamples:\n  ${SEARCH_PERSON_HELP_EXAMPLES}`)
  ).action(async (query: string, options: SearchPeopleCommandOptions, command: Command) => {
    await executeCommand({
      command,
      commandName: "search-person",
      dependencies,
      execute: async ({ client }) => {
        const listOptions = resolveListOptions(options);
        const searchResults = await fetchPaginatedItems<
          OfficerSearchApiItem,
          OfficerSearchApiResponse
        >({
          fetchPage: ({ itemsPerPage, startIndex }) =>
            client.searchOfficers({
              itemsPerPage,
              query,
              startIndex
            }),
          options: listOptions
        });
        const matchLimit = options.matchLimit ?? DEFAULT_MATCH_LIMIT;
        const officerMatchesToEnrich = searchResults.items.slice(0, matchLimit);
        const enrichedResults = await Promise.all(
          officerMatchesToEnrich.map(async (officerSearchResult: OfficerSearchApiItem) => {
            const selfLink =
              typeof officerSearchResult.links?.self === "string"
                ? officerSearchResult.links.self
                : undefined;
            const officerId = extractOfficerId(selfLink);

            if (!officerId) {
              return normalizePersonSearchResult(officerSearchResult, []);
            }

            const appointments = await fetchPaginatedItems<
              OfficerAppointmentApiItem,
              OfficerAppointmentListApiResponse
            >({
              fetchPage: ({ itemsPerPage, startIndex }) =>
                client.listOfficerAppointments({
                  itemsPerPage,
                  officerId,
                  startIndex
                }),
              options: {
                all: true,
                itemsPerPage: 100,
                startIndex: 0
              }
            });

            return normalizePersonSearchResult(
              officerSearchResult,
              appointments.items.map(normalizeOfficerAppointment)
            );
          })
        );

        return {
          command: "search-person",
          data: {
            results: enrichedResults,
            totalSearchHits: searchResults.pagination.totalResults
          },
          input: {
            matchLimit,
            query
          },
          pagination: searchResults.pagination
        } satisfies SearchPeopleEnvelope;
      },
      renderHuman: renderSearchPeopleHuman
    });
  });
};
