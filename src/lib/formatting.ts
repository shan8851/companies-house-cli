import { createColours } from "./colours.js";
import type { HumanRenderContext } from "../types/cli.js";
import type {
  NormalizedAddress,
  NormalizedDateOfBirth
} from "../types/normalized.js";

const compactStrings = (values: Array<string | null | undefined>): string[] =>
  values.filter((value): value is string => typeof value === "string" && value.length > 0);

const breakLongToken = (token: string, maximumWidth: number): string[] => {
  if (token.length <= maximumWidth) {
    return [token];
  }

  return Array.from(
    {
      length: Math.ceil(token.length / maximumWidth)
    },
    (_value, index) => token.slice(index * maximumWidth, (index + 1) * maximumWidth)
  );
};

const getAvailableWidth = (terminalWidth: number, prefixLength: number): number =>
  Math.max(terminalWidth - prefixLength, 1);

const wrapPlainText = (
  value: string,
  options: {
    continuationPrefixLength: number;
    firstPrefixLength: number;
    terminalWidth: number;
  }
): string[] => {
  const paragraphs = value
    .split(/\r?\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);

  if (paragraphs.length === 0) {
    return [];
  }

  let isFirstLine = true;

  return paragraphs.flatMap((paragraph) => {
    const paragraphLines: string[] = [];
    let currentLine = "";
    const words = paragraph.split(/\s+/);

    words.forEach((word) => {
      let remainingWord = word;

      while (remainingWord.length > 0) {
        const prefixLength = isFirstLine
          ? options.firstPrefixLength
          : options.continuationPrefixLength;
        const availableWidth = getAvailableWidth(options.terminalWidth, prefixLength);

        if (
          currentLine.length > 0 &&
          currentLine.length + remainingWord.length + 1 <= availableWidth
        ) {
          currentLine = `${currentLine} ${remainingWord}`;
          remainingWord = "";
          continue;
        }

        if (currentLine.length > 0) {
          paragraphLines.push(currentLine);
          isFirstLine = false;
          currentLine = "";
          continue;
        }

        if (remainingWord.length <= availableWidth) {
          currentLine = remainingWord;
          remainingWord = "";
          continue;
        }

        const [tokenSegment, ...restSegments] = breakLongToken(remainingWord, availableWidth);

        paragraphLines.push(tokenSegment ?? remainingWord);
        isFirstLine = false;
        remainingWord = restSegments.join("");
      }
    });

    if (currentLine.length > 0) {
      paragraphLines.push(currentLine);
      isFirstLine = false;
    }

    return paragraphLines;
  });
};

const identity = (value: string): string => value;

export interface KeyValueRow {
  label: string;
  labelStyle?: (value: string) => string;
  value: string | null;
  valueStyle?: (value: string) => string;
}

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

export const humanizeEnumValue = (value: string): string =>
  value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());

export const renderWrappedText = (
  value: string | null,
  context: HumanRenderContext,
  options?: {
    hangingIndent?: number;
    indent?: number;
    style?: (value: string) => string;
  }
): string[] => {
  if (value === null) {
    return [];
  }

  const indent = options?.indent ?? 0;
  const hangingIndent = options?.hangingIndent ?? indent;
  const style = options?.style ?? identity;
  const wrappedLines = wrapPlainText(value, {
    continuationPrefixLength: hangingIndent,
    firstPrefixLength: indent,
    terminalWidth: context.terminalWidth
  });

  return wrappedLines.map((line, index) => {
    const prefix = " ".repeat(index === 0 ? indent : hangingIndent);

    return `${prefix}${style(line)}`;
  });
};

export const renderKeyValueRows = (
  rows: KeyValueRow[],
  context: HumanRenderContext,
  options?: {
    indent?: number;
  }
): string[] =>
  rows.flatMap((row) => {
    if (row.value === null) {
      return [];
    }

    const indent = options?.indent ?? 0;
    const firstPrefixLength = indent + row.label.length + 2;
    const continuationPrefixLength = firstPrefixLength;
    const labelStyle = row.labelStyle ?? identity;
    const valueStyle = row.valueStyle ?? identity;
    const wrappedValueLines = wrapPlainText(row.value, {
      continuationPrefixLength,
      firstPrefixLength,
      terminalWidth: context.terminalWidth
    });
    const [firstValueLine, ...continuationLines] = wrappedValueLines;

    if (!firstValueLine) {
      return [];
    }

    return [
      `${" ".repeat(indent)}${labelStyle(row.label)}: ${valueStyle(firstValueLine)}`,
      ...continuationLines.map(
        (valueLine) => `${" ".repeat(continuationPrefixLength)}${valueStyle(valueLine)}`
      )
    ];
  });

export const renderSection = (
  title: string,
  lines: string[],
  context: HumanRenderContext
): string | null => {
  if (lines.length === 0) {
    return null;
  }

  const colours = createColours(context.ansiEnabled);

  return [colours.bold(colours.bright(title)), ...lines].join("\n");
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

export const renderBulletedList = (
  values: string[],
  context: HumanRenderContext,
  options?: {
    bullet?: string;
    indent?: number;
    style?: (value: string) => string;
  }
): string[] => {
  const bullet = options?.bullet ?? "-";
  const indent = options?.indent ?? 0;
  const style = options?.style ?? identity;

  return values.flatMap((value) => {
    const firstPrefix = `${" ".repeat(indent)}${bullet} `;
    const continuationPrefixLength = firstPrefix.length;
    const wrappedLines = wrapPlainText(value, {
      continuationPrefixLength,
      firstPrefixLength: continuationPrefixLength,
      terminalWidth: context.terminalWidth
    });
    const [firstValueLine, ...continuationLines] = wrappedLines;

    if (!firstValueLine) {
      return [];
    }

    return [
      `${firstPrefix}${style(firstValueLine)}`,
      ...continuationLines.map(
        (continuationLine) => `${" ".repeat(continuationPrefixLength)}${style(continuationLine)}`
      )
    ];
  });
};

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
