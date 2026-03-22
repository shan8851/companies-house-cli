import type { Command } from "commander";

import { createColours } from "../lib/colours.js";
import { normalizeCompanyNumber } from "../lib/companyNumber.js";
import {
  compactRowValues,
  formatDateOfBirth,
  renderBulletedList,
  renderPaginationSummary,
  renderWrappedText
} from "../lib/formatting.js";
import { normalizePsc } from "../lib/normalizers.js";
import { fetchPaginatedItems } from "../lib/pagination.js";
import type { PscApiItem, PscListApiResponse } from "../types/api.js";
import type { HumanRenderContext, RuntimeDependencies } from "../types/cli.js";
import type { PscEnvelope } from "../types/normalized.js";
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

const renderPscSummaryLine = (
  envelope: PscEnvelope,
  context: HumanRenderContext
): string | null => {
  const colours = createColours(context.ansiEnabled);

  if (envelope.data.summary.activeCount === null && envelope.data.summary.ceasedCount === null) {
    return null;
  }

  return [
    envelope.data.summary.activeCount !== null
      ? colours.accentGreen(`${envelope.data.summary.activeCount} active`)
      : null,
    envelope.data.summary.ceasedCount !== null
      ? colours.dim(`${envelope.data.summary.ceasedCount} ceased`)
      : null
  ]
    .filter((value): value is string => value !== null)
    .join(", ");
};

const renderPscHuman = (
  envelope: PscEnvelope,
  context: HumanRenderContext
): string => {
  const colours = createColours(context.ansiEnabled);
  const summaryLines = [
    colours.dim(
      renderPaginationSummary(
        envelope.pagination?.returnedCount ?? envelope.data.psc.length,
        envelope.pagination?.totalResults ?? null,
        envelope.pagination?.fetchedAll ?? false
      )
    ),
    renderPscSummaryLine(envelope, context)
  ].filter((line): line is string => line !== null);
  const pscBlocks =
    envelope.data.psc.length === 0
      ? [colours.dim("No persons with significant control found.")]
      : envelope.data.psc.map((psc) => {
          const metadata = compactRowValues(
            psc.kind,
            psc.notifiedOn !== null ? `Notified ${psc.notifiedOn}` : null,
            psc.ceasedOn !== null ? `Ceased ${psc.ceasedOn}` : null
          );
          const identityLine = compactRowValues(
            psc.nationality,
            psc.countryOfResidence,
            formatDateOfBirth(psc.dateOfBirth)
          );

          return [
            colours.bold(colours.bright(psc.name ?? psc.description ?? "Unknown PSC")),
            ...(metadata !== null
              ? renderWrappedText(metadata, context, { indent: 2, style: colours.dim })
              : []),
            ...(identityLine !== null
              ? renderWrappedText(identityLine, context, { indent: 2, style: colours.dim })
              : []),
            ...renderWrappedText(
              psc.address?.formatted ?? psc.principalOfficeAddress?.formatted ?? null,
              context,
              {
                indent: 2,
                style: colours.dim
              }
            ),
            ...renderBulletedList(psc.naturesOfControl, context, {
              bullet: "-",
              indent: 2,
              style: colours.dim
            })
          ].join("\n");
        });

  return [summaryLines.join("\n"), ...pscBlocks]
    .filter((block) => block.length > 0)
    .join("\n\n");
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
