import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { parse } from "dotenv";
import { z } from "zod";

import { createCliError } from "./errors.js";

const configSchema = z.object({
  apiKey: z.string().trim().min(1)
});

export interface CliConfig {
  apiKey: string;
  baseUrl: string;
}

export interface ResolveCliConfigOptions {
  cwd: string;
  env: NodeJS.ProcessEnv;
}

const COMPANIES_HOUSE_BASE_URL = "https://api.company-information.service.gov.uk";

const readApiKeyFromDotEnv = (cwd: string): string | undefined => {
  const dotEnvPath = resolve(cwd, ".env");

  if (!existsSync(dotEnvPath)) {
    return undefined;
  }

  const dotEnvContents = readFileSync(dotEnvPath, "utf8");
  const parsedDotEnv = parse(dotEnvContents);
  const apiKey = parsedDotEnv.COMPANIES_HOUSE_API_KEY;

  return typeof apiKey === "string" && apiKey.trim().length > 0 ? apiKey.trim() : undefined;
};

export const resolveCliConfig = ({
  cwd,
  env
}: ResolveCliConfigOptions): CliConfig => {
  const apiKey = env.COMPANIES_HOUSE_API_KEY?.trim() || readApiKeyFromDotEnv(cwd);

  const parsedConfig = configSchema.safeParse({
    apiKey
  });

  if (!parsedConfig.success) {
    throw createCliError(
      "AUTH_ERROR",
      "Missing COMPANIES_HOUSE_API_KEY. Set it in your environment or add it to a local .env file.",
    );
  }

  return {
    apiKey: parsedConfig.data.apiKey,
    baseUrl: COMPANIES_HOUSE_BASE_URL
  };
};
