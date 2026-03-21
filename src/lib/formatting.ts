import type {
  NormalizedAddress,
  NormalizedDateOfBirth
} from "../types/normalized.js";

const compactStrings = (values: Array<string | null | undefined>): string[] =>
  values.filter((value): value is string => typeof value === "string" && value.length > 0);

export const formatAddress = (address: NormalizedAddress | null): string | null =>
  address?.formatted ?? null;

export const formatDateOfBirth = (dateOfBirth: NormalizedDateOfBirth | null): string | null =>
  dateOfBirth?.formatted ?? null;

export const formatBoolean = (
  value: boolean | null,
  labels: {
    false: string;
    true: string;
  }
): string | null => {
  if (value === null) {
    return null;
  }

  return value ? labels.true : labels.false;
};

export const formatList = (values: string[]): string | null =>
  values.length > 0 ? values.join(", ") : null;

export const renderKeyValueRows = (
  rows: Array<{
    label: string;
    value: string | null;
  }>
): string[] =>
  rows
    .filter((row) => row.value !== null)
    .map((row) => `${row.label}: ${row.value}`);

export const renderSection = (title: string, lines: string[]): string | null => {
  if (lines.length === 0) {
    return null;
  }

  return [title, ...lines].join("\n");
};

export const joinSections = (sections: Array<string | null>): string =>
  sections.filter((section): section is string => section !== null).join("\n\n");

export const renderNumberedBlocks = (
  items: string[],
  renderItem: (item: string, index: number) => string[]
): string[] =>
  items.flatMap((item, index) => {
    const lines = renderItem(item, index);
    const [firstLine, ...restLines] = lines;

    if (!firstLine) {
      return [];
    }

    return [`${index + 1}. ${firstLine}`, ...restLines.map((line) => `   ${line}`)];
  });

export const withFallback = (value: string | null, fallback: string): string =>
  value ?? fallback;

export const compactRowValues = (...values: Array<string | null>): string | null => {
  const presentValues = compactStrings(values);

  return presentValues.length > 0 ? presentValues.join(" | ") : null;
};

export const renderPaginationSummary = (
  returnedCount: number,
  totalResults: number | null,
  fetchedAll: boolean
): string =>
  totalResults !== null
    ? fetchedAll
      ? `Fetched ${returnedCount} of ${totalResults} results.`
      : `Showing ${returnedCount} of ${totalResults} results.`
    : fetchedAll
      ? `Fetched ${returnedCount} results.`
      : `Showing ${returnedCount} results.`;
