import type { Command } from "commander";

import {
  formatDateOfBirth,
  renderKeyValueRows,
  renderPaginationSummary
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
import type { SearchPeopleEnvelope } from "../types/normalized.js";
import type { RuntimeDependencies } from "../types/cli.js";
import {
  addListOptions,
  executeCommand,
  parsePositiveInteger,
  resolveListOptions
} from "./shared.js";

const DEFAULT_MATCH_LIMIT = 10;

interface SearchPeopleCommandOptions {
  all?: boolean;
  itemsPerPage?: number;
  matchLimit?: number;
  startIndex?: number;
}

const renderSearchPeopleHuman = (envelope: SearchPeopleEnvelope): string => {
  const summary = renderPaginationSummary(
    envelope.data.results.length,
    envelope.data.totalSearchHits,
    envelope.pagination?.fetchedAll ?? false
  );

  const resultLines =
    envelope.data.results.length === 0
      ? ["No matching people found."]
      : envelope.data.results.flatMap((result, index) => {
          const appointmentLines =
            result.appointments.length === 0
              ? ["   Appointments: none found"]
              : result.appointments.map(
                  (appointment, appointmentIndex) =>
                    `   Appointment ${appointmentIndex + 1}: ${
                      appointment.companyName ?? "Unknown company"
                    } (${appointment.companyNumber ?? "unknown"}) | ${
                      appointment.officerRole ?? "role unknown"
                    } | appointed ${appointment.appointedOn ?? "unknown"}`
                );

          return [
            `${index + 1}. ${result.name ?? "Unknown person"}`,
            ...renderKeyValueRows([
              {
                label: "   Officer ID",
                value: result.officerId
              },
              {
                label: "   Date of birth",
                value: formatDateOfBirth(result.dateOfBirth)
              },
              {
                label: "   Appointment count",
                value:
                  result.appointmentCount !== null ? String(result.appointmentCount) : null
              },
              {
                label: "   Address",
                value: result.address?.formatted ?? null
              },
              {
                label: "   Description",
                value: result.description
              }
            ]),
            ...appointmentLines
          ];
        });

  return [summary, ...resultLines].join("\n");
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
