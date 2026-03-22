import type { Command } from "commander";

import { createColours } from "../lib/colours.js";
import { normalizeCompanyNumber } from "../lib/companyNumber.js";
import { normalizeOfficer } from "../lib/normalizers.js";
import { fetchPaginatedItems } from "../lib/pagination.js";
import {
  compactRowValues,
  formatDateOfBirth,
  renderPaginationSummary,
  renderWrappedText
} from "../lib/formatting.js";
import type { OfficerApiItem, OfficerListApiResponse } from "../types/api.js";
import type { HumanRenderContext, RuntimeDependencies } from "../types/cli.js";
import type { OfficersEnvelope } from "../types/normalized.js";
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

const renderOfficerSummaryLine = (
  envelope: OfficersEnvelope,
  context: HumanRenderContext
): string | null => {
  const colours = createColours(context.ansiEnabled);

  if (
    envelope.data.summary.activeCount === null &&
    envelope.data.summary.resignedCount === null
  ) {
    return null;
  }

  return [
    envelope.data.summary.activeCount !== null
      ? colours.accentGreen(`${envelope.data.summary.activeCount} active`)
      : null,
    envelope.data.summary.resignedCount !== null
      ? colours.dim(`${envelope.data.summary.resignedCount} resigned`)
      : null
  ]
    .filter((value): value is string => value !== null)
    .join(", ");
};

const renderOfficersHuman = (
  envelope: OfficersEnvelope,
  context: HumanRenderContext
): string => {
  const colours = createColours(context.ansiEnabled);
  const summaryLines = [
    colours.dim(
      renderPaginationSummary(
        envelope.pagination?.returnedCount ?? envelope.data.officers.length,
        envelope.pagination?.totalResults ?? null,
        envelope.pagination?.fetchedAll ?? false
      )
    ),
    renderOfficerSummaryLine(envelope, context)
  ].filter((line): line is string => line !== null);
  const officerBlocks =
    envelope.data.officers.length === 0
      ? [colours.dim("No officers found.")]
      : envelope.data.officers.map((officer) => {
          const resigned = officer.resignedOn !== null;
          const marker = resigned
            ? colours.dim("x")
            : colours.accentGreen("+");
          const officerName = resigned
            ? colours.strikethrough(colours.dim(officer.name ?? "Unknown officer"))
            : colours.bold(colours.bright(officer.name ?? "Unknown officer"));
          const header = [
            marker,
            officerName,
            colours.dim(`(${officer.officerRole ?? "role unknown"})`)
          ].join(" ");
          const datesLine = compactRowValues(
            officer.appointedOn !== null ? `Appointed ${officer.appointedOn}` : null,
            officer.resignedOn !== null ? `Resigned ${officer.resignedOn}` : null
          );
          const identityLine = compactRowValues(
            officer.nationality,
            formatDateOfBirth(officer.dateOfBirth)
          );

          return [
            header,
            ...(datesLine !== null
              ? renderWrappedText(datesLine, context, { indent: 2, style: colours.dim })
              : []),
            ...(identityLine !== null
              ? renderWrappedText(identityLine, context, { indent: 2, style: colours.dim })
              : []),
            ...renderWrappedText(officer.occupation, context, {
              indent: 2,
              style: colours.dim
            }),
            ...renderWrappedText(
              officer.address?.formatted ?? officer.principalOfficeAddress?.formatted ?? null,
              context,
              {
                indent: 2,
                style: colours.dim
              }
            )
          ].join("\n");
        });

  return [...summaryLines, ...((summaryLines.length > 0 && officerBlocks.length > 0) ? [""] : []), ...officerBlocks].join("\n\n");
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
