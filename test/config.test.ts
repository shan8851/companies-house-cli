import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { resolveCliConfig } from "../src/lib/config.js";
import { CompaniesHouseCliError } from "../src/lib/errors.js";

describe("resolveCliConfig", () => {
  it("prefers the environment variable over .env", () => {
    const tempDirectory = mkdtempSync(join(tmpdir(), "companies-house-cli-config-"));

    try {
      writeFileSync(tempDirectory + "/.env", "COMPANIES_HOUSE_API_KEY=from-dot-env\n", "utf8");

      const config = resolveCliConfig({
        cwd: tempDirectory,
        env: {
          COMPANIES_HOUSE_API_KEY: "from-env"
        }
      });

      expect(config.apiKey).toBe("from-env");
    } finally {
      rmSync(tempDirectory, {
        force: true,
        recursive: true
      });
    }
  });

  it("loads the API key from .env when the environment variable is unset", () => {
    const tempDirectory = mkdtempSync(join(tmpdir(), "companies-house-cli-config-"));

    try {
      writeFileSync(tempDirectory + "/.env", "COMPANIES_HOUSE_API_KEY=from-dot-env\n", "utf8");

      const config = resolveCliConfig({
        cwd: tempDirectory,
        env: {}
      });

      expect(config.apiKey).toBe("from-dot-env");
    } finally {
      rmSync(tempDirectory, {
        force: true,
        recursive: true
      });
    }
  });

  it("throws a helpful error when no API key is configured", () => {
    const tempDirectory = mkdtempSync(join(tmpdir(), "companies-house-cli-config-"));

    try {
      expect(() =>
        resolveCliConfig({
          cwd: tempDirectory,
          env: {}
        })
      ).toThrowError(CompaniesHouseCliError);
    } finally {
      rmSync(tempDirectory, {
        force: true,
        recursive: true
      });
    }
  });
});
