const ANSI_ESCAPE_PATTERN = new RegExp(String.raw`\u001B\[[0-9;]*m`, "g");

const hexToRgb = (hex: string): [number, number, number] => {
  const normalizedHex = hex.replace("#", "");

  if (normalizedHex.length !== 6) {
    throw new Error(`Expected a 6-digit hex colour, received "${hex}".`);
  }

  const red = Number.parseInt(normalizedHex.slice(0, 2), 16);
  const green = Number.parseInt(normalizedHex.slice(2, 4), 16);
  const blue = Number.parseInt(normalizedHex.slice(4, 6), 16);

  return [red, green, blue];
};

const applyAnsi = (
  value: string,
  openCode: string,
  closeCode: string,
  ansiEnabled: boolean
): string => {
  if (!ansiEnabled || value.length === 0) {
    return value;
  }

  return `\u001B[${openCode}m${value}\u001B[${closeCode}m`;
};

const applyTrueColour = (value: string, hex: string, ansiEnabled: boolean): string => {
  const [red, green, blue] = hexToRgb(hex);

  return applyAnsi(value, `38;2;${red};${green};${blue}`, "39", ansiEnabled);
};

export interface ColourSet {
  accentGreen: (value: string) => string;
  amber: (value: string) => string;
  bright: (value: string) => string;
  bold: (value: string) => string;
  cyan: (value: string) => string;
  dangerRed: (value: string) => string;
  dim: (value: string) => string;
  strikethrough: (value: string) => string;
  underline: (value: string) => string;
}

export const createColours = (ansiEnabled: boolean): ColourSet => ({
  accentGreen: (value: string) => applyTrueColour(value, "#00703C", ansiEnabled),
  amber: (value: string) => applyTrueColour(value, "#F47738", ansiEnabled),
  bright: (value: string) => applyAnsi(value, "97", "39", ansiEnabled),
  bold: (value: string) => applyAnsi(value, "1", "22", ansiEnabled),
  cyan: (value: string) => applyTrueColour(value, "#0077AD", ansiEnabled),
  dangerRed: (value: string) => applyTrueColour(value, "#D4351C", ansiEnabled),
  dim: (value: string) => applyTrueColour(value, "#6B7280", ansiEnabled),
  strikethrough: (value: string) => applyAnsi(value, "9", "29", ansiEnabled),
  underline: (value: string) => applyAnsi(value, "4", "24", ansiEnabled)
});

export const stripAnsi = (value: string): string => value.replace(ANSI_ESCAPE_PATTERN, "");

export const visibleLength = (value: string): number => stripAnsi(value).length;
