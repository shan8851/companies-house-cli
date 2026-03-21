import { describe, expect, it } from "vitest";

import { createCompaniesHouseClient } from "../src/lib/companiesHouseClient.js";
import type { CompaniesHouseCliError } from "../src/lib/errors.js";

describe("createCompaniesHouseClient", () => {
  it("sends basic auth and query parameters", async () => {
    const requestCapture: {
      authorizationHeader?: string | null;
      requestedUrl?: URL;
    } = {};

    const client = createCompaniesHouseClient({
      apiKey: "secret-api-key",
      baseUrl: "https://api.company-information.service.gov.uk",
      fetchImplementation: (input, init) => {
        requestCapture.requestedUrl =
          input instanceof URL
            ? input
            : input instanceof Request
              ? new URL(input.url)
              : new URL(String(input));
        requestCapture.authorizationHeader = new Headers(init?.headers).get("Authorization");

        return Promise.resolve(
          new Response(
            JSON.stringify({
              items: [],
              total_results: 0
            }),
            {
              headers: {
                "content-type": "application/json"
              },
              status: 200
            }
          )
        );
      }
    });

    await client.searchCompanies({
      itemsPerPage: 5,
      query: "Acme",
      restrictions: "active-companies",
      startIndex: 10
    });

    const requestedUrl = requestCapture.requestedUrl;

    expect(requestedUrl).not.toBeNull();

    if (!requestedUrl) {
      throw new Error("Expected requestedUrl to be captured.");
    }

    expect(requestedUrl.pathname).toBe("/search/companies");
    expect(requestedUrl.searchParams.get("q")).toBe("Acme");
    expect(requestedUrl.searchParams.get("items_per_page")).toBe("5");
    expect(requestedUrl.searchParams.get("start_index")).toBe("10");
    expect(requestedUrl.searchParams.get("restrictions")).toBe("active-companies");
    expect(requestCapture.authorizationHeader).toBe(
      `Basic ${Buffer.from("secret-api-key:").toString("base64")}`
    );
  });

  it("returns null for insolvency when Companies House responds with 404", async () => {
    const client = createCompaniesHouseClient({
      apiKey: "secret-api-key",
      baseUrl: "https://api.company-information.service.gov.uk",
      fetchImplementation: () =>
        Promise.resolve(
          new Response(null, {
            status: 404
          })
        )
    });

    await expect(client.getInsolvency("12345678")).resolves.toBeNull();
  });

  it("maps unauthorized responses to a CLI error", async () => {
    const client = createCompaniesHouseClient({
      apiKey: "secret-api-key",
      baseUrl: "https://api.company-information.service.gov.uk",
      fetchImplementation: () =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              error: "Unauthorized"
            }),
            {
              headers: {
                "content-type": "application/json"
              },
              status: 401
            }
          )
        )
    });

    await expect(client.getCompanyProfile("12345678")).rejects.toEqual(
      expect.objectContaining<Partial<CompaniesHouseCliError>>({
        code: "unauthorized",
        statusCode: 401
      })
    );
  });
});
