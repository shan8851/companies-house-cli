import { describe, expect, it } from "vitest";

import { runCli } from "../src/cli.js";
import { stripAnsi } from "../src/lib/colours.js";
import { createQueuedFetch, createTestRuntimeDependencies } from "./helpers.js";

const ANSI_PATTERN = new RegExp(String.raw`\u001B\[[0-9;]*m`);

const createHumanRuntimeDependencies = (
  fetchImplementation: typeof fetch,
  io: {
    stderr: string;
    stdout: string;
  },
  overrides?: Parameters<typeof createTestRuntimeDependencies>[2]
) =>
  createTestRuntimeDependencies(fetchImplementation, io, {
    stdoutColumns: 80,
    stdoutIsTTY: true,
    ...overrides
  });

describe("runCli", () => {
  it("defaults to JSON when stdout is not a TTY", async () => {
    const io = {
      stderr: "",
      stdout: ""
    };
    const fetchImplementation = createQueuedFetch([
      {
        assertUrl: (url) => {
          expect(url.pathname).toBe("/search/companies");
          expect(url.searchParams.get("q")).toBe("Acme");
          expect(url.searchParams.get("items_per_page")).toBe("10");
        },
        body: {
          items: [
            {
              address: {
                address_line_1: "1 Test Street",
                locality: "London",
                postal_code: "SW1A 1AA"
              },
              company_number: "12345678",
              company_status: "active",
              company_type: "ltd",
              date_of_creation: "2020-01-01",
              title: "ACME LTD"
            }
          ],
          total_results: 1
        }
      }
    ]);

    const exitCode = await runCli(
      ["search", "Acme"],
      createTestRuntimeDependencies(fetchImplementation, io)
    );

    const output = JSON.parse(io.stdout) as {
      command: string;
      ok: boolean;
      requestedAt: string;
      schemaVersion: string;
      data: {
        input: {
          query: string;
          restrictions: string | null;
        };
        pagination: {
          fetchedAll: boolean;
          returnedCount: number;
          totalResults: number | null;
        };
        companies: Array<{
          companyNumber: string;
          name: string;
        }>;
      };
    };

    expect(exitCode).toBe(0);
    expect(output.ok).toBe(true);
    expect(output.schemaVersion).toBe("1");
    expect(output.command).toBe("search");
    expect(output.requestedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(output.data.input).toEqual({
      query: "Acme",
      restrictions: null
    });
    expect(output.data.pagination).toEqual(
      expect.objectContaining({
        fetchedAll: false,
        returnedCount: 1,
        totalResults: 1
      })
    );
    expect(output.data.companies[0]).toEqual(
      expect.objectContaining({
        companyNumber: "12345678",
        name: "ACME LTD"
      })
    );
    expect(io.stderr).toBe("");
  });

  it("renders normalized JSON for company info", async () => {
    const io = {
      stderr: "",
      stdout: ""
    };
    const fetchImplementation = createQueuedFetch([
      {
        assertUrl: (url) => {
          expect(url.pathname).toBe("/company/12345678");
        },
        body: {
          company_name: "ACME LTD",
          company_number: "12345678",
          company_status: "active",
          has_charges: true,
          has_insolvency_history: false,
          registered_office_address: {
            address_line_1: "1 Test Street",
            locality: "London",
            postal_code: "SW1A 1AA"
          },
          type: "ltd"
        }
      }
    ]);

    const exitCode = await runCli(
      ["info", "12345678", "--json"],
      createTestRuntimeDependencies(fetchImplementation, io)
    );

    const output = JSON.parse(io.stdout) as {
      ok: boolean;
      data: {
        input: {
          companyNumber: string;
        };
        company: {
          companyName: string;
          hasCharges: boolean;
        };
      };
    };

    expect(exitCode).toBe(0);
    expect(output.ok).toBe(true);
    expect(output.data.input.companyNumber).toBe("12345678");
    expect(output.data.company.companyName).toBe("ACME LTD");
    expect(output.data.company.hasCharges).toBe(true);
    expect(output.data).not.toHaveProperty("pagination");
  });

  it("forces JSON output in TTY mode with --json", async () => {
    const io = {
      stderr: "",
      stdout: ""
    };
    const fetchImplementation = createQueuedFetch([
      {
        assertUrl: (url) => {
          expect(url.pathname).toBe("/company/12345678/officers");
        },
        body: {
          active_count: 1,
          items: [
            {
              appointed_on: "2020-01-01",
              name: "Jane Director",
              officer_role: "director"
            }
          ],
          resigned_count: 0,
          total_results: 1
        }
      }
    ]);

    const exitCode = await runCli(
      ["officers", "12345678", "--json"],
      createHumanRuntimeDependencies(fetchImplementation, io)
    );

    const output = JSON.parse(io.stdout) as {
      data: {
        input: {
          companyNumber: string;
        };
        pagination: {
          totalResults: number | null;
        };
        officers: Array<{
          name: string;
          officerRole: string;
        }>;
        summary: {
          activeCount: number;
        };
      };
    };

    expect(exitCode).toBe(0);
    expect(output.data.input.companyNumber).toBe("12345678");
    expect(output.data.pagination.totalResults).toBe(1);
    expect(output.data.summary.activeCount).toBe(1);
    expect(output.data.officers[0]?.officerRole).toBe("director");
    expect(io.stderr).toBe("");
  });

  it("keeps root-level --json as a compatibility alias", async () => {
    const io = {
      stderr: "",
      stdout: ""
    };
    const fetchImplementation = createQueuedFetch([
      {
        body: {
          company_name: "ACME LTD",
          company_number: "12345678",
          company_status: "active",
          type: "ltd"
        }
      }
    ]);

    const exitCode = await runCli(
      ["--json", "info", "12345678"],
      createTestRuntimeDependencies(fetchImplementation, io)
    );

    const output = JSON.parse(io.stdout) as {
      data: {
        input: {
          companyNumber: string;
        };
      };
    };

    expect(exitCode).toBe(0);
    expect(output.data.input.companyNumber).toBe("12345678");
  });

  it("keeps root-level --text as a compatibility alias", async () => {
    const io = {
      stderr: "",
      stdout: ""
    };
    const fetchImplementation = createQueuedFetch([
      {
        body: {
          items: [
            {
              company_number: "12345678",
              company_status: "active",
              title: "ACME LTD"
            }
          ],
          total_results: 1
        }
      }
    ]);

    const exitCode = await runCli(
      ["--text", "search", "Acme"],
      createTestRuntimeDependencies(fetchImplementation, io, {
        stdoutColumns: 80,
        stdoutIsTTY: false
      })
    );

    expect(exitCode).toBe(0);
    expect(io.stdout.trim()).not.toMatch(/^\{/);
    expect(io.stdout).toContain("ACME LTD (12345678)");
  });

  it("uses --type as an alias for filing category", async () => {
    const io = {
      stderr: "",
      stdout: ""
    };
    const fetchImplementation = createQueuedFetch([
      {
        assertUrl: (url) => {
          expect(url.pathname).toBe("/company/12345678/filing-history");
          expect(url.searchParams.get("category")).toBe("accounts");
        },
        body: {
          items: [
            {
              category: "accounts",
              date: "2024-01-31",
              description: "accounts-with-accounts-type-full",
              type: "AA"
            }
          ],
          total_count: 1
        }
      }
    ]);

    const exitCode = await runCli(
      ["--json", "filings", "12345678", "--type", "accounts"],
      createTestRuntimeDependencies(fetchImplementation, io)
    );

    const output = JSON.parse(io.stdout) as {
      data: {
        input: {
          category: string;
        };
        filings: Array<{
          category: string;
        }>;
      };
    };

    expect(exitCode).toBe(0);
    expect(output.data.input.category).toBe("accounts");
    expect(output.data.filings[0]?.category).toBe("accounts");
  });

  it("includes derived document content links for filings when requested", async () => {
    const io = {
      stderr: "",
      stdout: ""
    };
    const fetchImplementation = createQueuedFetch([
      {
        assertUrl: (url) => {
          expect(url.pathname).toBe("/company/12345678/filing-history");
        },
        body: {
          items: [
            {
              date: "2024-01-31",
              description: "accounts-with-accounts-type-full",
              links: {
                document_metadata: "/document/abc123"
              },
              type: "AA"
            }
          ],
          total_count: 1
        }
      }
    ]);

    const exitCode = await runCli(
      ["--json", "filings", "12345678", "--include-links"],
      createTestRuntimeDependencies(fetchImplementation, io)
    );

    const output = JSON.parse(io.stdout) as {
      data: {
        input: {
          includeLinks: boolean;
        };
        filings: Array<{
          documentContentUrl: string | null;
        }>;
      };
    };

    expect(exitCode).toBe(0);
    expect(output.data.input.includeLinks).toBe(true);
    expect(output.data.filings[0]?.documentContentUrl).toBe(
      "https://document-api.company-information.service.gov.uk/document/abc123/content"
    );
  });

  it("renders normalized JSON for PSC records", async () => {
    const io = {
      stderr: "",
      stdout: ""
    };
    const fetchImplementation = createQueuedFetch([
      {
        assertUrl: (url) => {
          expect(url.pathname).toBe("/company/12345678/persons-with-significant-control");
        },
        body: {
          active_count: 1,
          items: [
            {
              kind: "individual-person-with-significant-control",
              name: "Jane Owner",
              natures_of_control: ["ownership-of-shares-75-to-100-percent"],
              notified_on: "2020-01-01"
            }
          ],
          total_results: 1
        }
      }
    ]);

    const exitCode = await runCli(
      ["--json", "psc", "12345678"],
      createTestRuntimeDependencies(fetchImplementation, io)
    );

    const output = JSON.parse(io.stdout) as {
      data: {
        psc: Array<{
          name: string;
        }>;
      };
    };

    expect(exitCode).toBe(0);
    expect(output.data.psc[0]?.name).toBe("Jane Owner");
  });

  it("resolves appointments for person search", async () => {
    const io = {
      stderr: "",
      stdout: ""
    };
    const fetchImplementation = createQueuedFetch([
      {
        assertUrl: (url) => {
          expect(url.pathname).toBe("/search/officers");
          expect(url.searchParams.get("q")).toBe("Jane Director");
        },
        body: {
          items: [
            {
              appointment_count: 1,
              links: {
                self: "/officers/abc123/appointments"
              },
              title: "Jane Director"
            }
          ],
          total_results: 1
        }
      },
      {
        assertUrl: (url) => {
          expect(url.pathname).toBe("/officers/abc123/appointments");
        },
        body: {
          items: [
            {
              appointed_on: "2020-01-01",
              appointed_to: {
                company_name: "ACME LTD",
                company_number: "12345678",
                company_status: "active"
              },
              officer_role: "director"
            }
          ],
          total_results: 1
        }
      }
    ]);

    const exitCode = await runCli(
      ["--json", "search-person", "Jane Director", "--match-limit", "1"],
      createTestRuntimeDependencies(fetchImplementation, io)
    );

    const output = JSON.parse(io.stdout) as {
      data: {
        results: Array<{
          appointments: Array<{
            companyName: string;
          }>;
          officerId: string;
        }>;
      };
    };

    expect(exitCode).toBe(0);
    expect(output.data.results[0]?.officerId).toBe("abc123");
    expect(output.data.results[0]?.appointments[0]?.companyName).toBe("ACME LTD");
  });

  it("renders normalized JSON for charges", async () => {
    const io = {
      stderr: "",
      stdout: ""
    };
    const fetchImplementation = createQueuedFetch([
      {
        assertUrl: (url) => {
          expect(url.pathname).toBe("/company/12345678/charges");
        },
        body: {
          items: [
            {
              charge_code: "123456780001",
              created_on: "2020-01-01",
              particulars: {
                brief_description: "Fixed and floating charge.",
                type: "a-charge-on-land"
              },
              status: "outstanding"
            }
          ],
          total_count: 1
        }
      }
    ]);

    const exitCode = await runCli(
      ["--json", "charges", "12345678"],
      createTestRuntimeDependencies(fetchImplementation, io)
    );

    const output = JSON.parse(io.stdout) as {
      data: {
        charges: Array<{
          chargeCode: string;
        }>;
      };
    };

    expect(exitCode).toBe(0);
    expect(output.data.charges[0]?.chargeCode).toBe("123456780001");
  });

  it("left-pads short numeric company numbers before company requests", async () => {
    const io = {
      stderr: "",
      stdout: ""
    };
    const fetchImplementation = createQueuedFetch([
      {
        assertUrl: (url) => {
          expect(url.pathname).toBe("/company/09215862");
        },
        body: {
          company_name: "PADDED LTD",
          company_number: "09215862",
          company_status: "active",
          type: "ltd"
        }
      }
    ]);

    const exitCode = await runCli(
      ["--json", "info", "9215862"],
      createTestRuntimeDependencies(fetchImplementation, io)
    );

    const output = JSON.parse(io.stdout) as {
      data: {
        input: {
          companyNumber: string;
        };
      };
    };

    expect(exitCode).toBe(0);
    expect(output.data.input.companyNumber).toBe("09215862");
  });

  it("treats missing insolvency records as an empty result", async () => {
    const io = {
      stderr: "",
      stdout: ""
    };
    const fetchImplementation = createQueuedFetch([
      {
        assertUrl: (url) => {
          expect(url.pathname).toBe("/company/12345678/insolvency");
        },
        status: 404
      }
    ]);

    const exitCode = await runCli(
      ["--json", "insolvency", "12345678"],
      createTestRuntimeDependencies(fetchImplementation, io)
    );

    const output = JSON.parse(io.stdout) as {
      data: {
        cases: unknown[];
      };
    };

    expect(exitCode).toBe(0);
    expect(output.data.cases).toEqual([]);
    expect(io.stderr).toBe("");
  });

  it("fetches all pages with a 100-item default page size", async () => {
    const io = {
      stderr: "",
      stdout: ""
    };
    const fetchImplementation = createQueuedFetch([
      {
        assertUrl: (url) => {
          expect(url.searchParams.get("items_per_page")).toBe("100");
          expect(url.searchParams.get("start_index")).toBe("0");
        },
        body: {
          items: [
            {
              company_number: "12345678",
              title: "ACME LTD"
            }
          ],
          start_index: 0,
          total_results: 2
        }
      },
      {
        assertUrl: (url) => {
          expect(url.searchParams.get("items_per_page")).toBe("100");
          expect(url.searchParams.get("start_index")).toBe("100");
        },
        body: {
          items: [
            {
              company_number: "87654321",
              title: "BETA LTD"
            }
          ],
          start_index: 100,
          total_results: 2
        }
      }
    ]);

    const exitCode = await runCli(
      ["--json", "search", "Acme", "--all"],
      createTestRuntimeDependencies(fetchImplementation, io)
    );

    const output = JSON.parse(io.stdout) as {
      data: {
        pagination: {
          fetchedAll: boolean;
          returnedCount: number;
        };
      };
    };

    expect(exitCode).toBe(0);
    expect(output.data.pagination.fetchedAll).toBe(true);
    expect(output.data.pagination.returnedCount).toBe(2);
  });

  it("returns structured JSON errors to stdout for handled invalid input", async () => {
    const io = {
      stderr: "",
      stdout: ""
    };

    const exitCode = await runCli(
      ["search", "Acme", "--all", "--start-index", "1", "--json"],
      createTestRuntimeDependencies(createQueuedFetch([]), io)
    );

    const output = JSON.parse(io.stdout) as {
      command: string;
      error: {
        code: string;
        message: string;
        retryable: boolean;
      };
      ok: boolean;
      schemaVersion: string;
    };

    expect(exitCode).toBe(2);
    expect(output).toEqual(
      expect.objectContaining({
        command: "search",
        ok: false,
        schemaVersion: "1"
      })
    );
    expect(output.error).toEqual(
      expect.objectContaining({
        code: "INVALID_INPUT",
        message: "--all cannot be combined with a non-zero --start-index.",
        retryable: false
      })
    );
    expect(io.stderr).toBe("");
  });

  it("returns structured JSON errors for parse-time invalid input", async () => {
    const io = {
      stderr: "",
      stdout: ""
    };

    const exitCode = await runCli(
      ["search", "Acme", "--items-per-page", "foo", "--json"],
      createTestRuntimeDependencies(createQueuedFetch([]), io)
    );

    const output = JSON.parse(io.stdout) as {
      command: string;
      error: {
        code: string;
        message: string;
        retryable: boolean;
      };
      ok: boolean;
    };

    expect(exitCode).toBe(2);
    expect(output).toEqual(
      expect.objectContaining({
        command: "search",
        ok: false
      })
    );
    expect(output.error).toEqual(
      expect.objectContaining({
        code: "INVALID_INPUT",
        message: "Expected a positive integer.",
        retryable: false
      })
    );
    expect(io.stderr).toBe("");
  });

  it("rejects --json and --text together", async () => {
    const io = {
      stderr: "",
      stdout: ""
    };

    const exitCode = await runCli(
      ["search", "Acme", "--json", "--text"],
      createTestRuntimeDependencies(createQueuedFetch([]), io)
    );

    const output = JSON.parse(io.stdout) as {
      command: string;
      error: {
        code: string;
        message: string;
      };
      ok: boolean;
    };

    expect(exitCode).toBe(2);
    expect(output.command).toBe("search");
    expect(output.ok).toBe(false);
    expect(output.error).toEqual(
      expect.objectContaining({
        code: "INVALID_INPUT",
        message: "Choose either --json or --text, not both."
      })
    );
    expect(io.stderr).toBe("");
  });
});

describe("runCli human output", () => {
  it("renders styled company search output in TTY mode", async () => {
    const io = {
      stderr: "",
      stdout: ""
    };
    const fetchImplementation = createQueuedFetch([
      {
        body: {
          items: [
            {
              company_number: "12345678",
              company_status: "active",
              company_type: "ltd",
              date_of_creation: "2020-01-01",
              title: "ACME LTD"
            },
            {
              company_number: "87654321",
              company_status: "dissolved",
              title: "BETA LTD"
            }
          ],
          total_results: 2
        }
      }
    ]);

    const exitCode = await runCli(
      ["search", "Acme"],
      createHumanRuntimeDependencies(fetchImplementation, io)
    );
    const plainOutput = stripAnsi(io.stdout);

    expect(exitCode).toBe(0);
    expect(io.stdout).toMatch(ANSI_PATTERN);
    expect(plainOutput).toContain("Showing 2 of 2 results.");
    expect(plainOutput).toContain("ACME LTD (12345678)");
    expect(plainOutput).toContain("Active");
    expect(plainOutput).toContain("BETA LTD (87654321)");
    expect(plainOutput).toContain("Dissolved");
    expect(io.stderr).toBe("");
  });

  it("disables ANSI styling when --no-color is passed before the subcommand", async () => {
    const io = {
      stderr: "",
      stdout: ""
    };
    const fetchImplementation = createQueuedFetch([
      {
        body: {
          items: [
            {
              company_number: "12345678",
              company_status: "active",
              title: "ACME LTD"
            }
          ],
          total_results: 1
        }
      }
    ]);

    const exitCode = await runCli(
      ["--no-color", "search", "Acme"],
      createHumanRuntimeDependencies(fetchImplementation, io)
    );

    expect(exitCode).toBe(0);
    expect(io.stdout).not.toMatch(ANSI_PATTERN);
    expect(io.stdout).toContain("ACME LTD (12345678)");
  });

  it("disables ANSI styling when --no-color is passed after the subcommand", async () => {
    const io = {
      stderr: "",
      stdout: ""
    };
    const fetchImplementation = createQueuedFetch([
      {
        body: {
          items: [
            {
              company_number: "12345678",
              company_status: "active",
              title: "ACME LTD"
            }
          ],
          total_results: 1
        }
      }
    ]);

    const exitCode = await runCli(
      ["search", "Acme", "--no-color"],
      createHumanRuntimeDependencies(fetchImplementation, io)
    );

    expect(exitCode).toBe(0);
    expect(io.stdout).not.toMatch(ANSI_PATTERN);
    expect(io.stdout).toContain("ACME LTD (12345678)");
  });

  it("disables ANSI styling when NO_COLOR is set", async () => {
    const io = {
      stderr: "",
      stdout: ""
    };
    const fetchImplementation = createQueuedFetch([
      {
        body: {
          items: [
            {
              company_number: "12345678",
              company_status: "active",
              title: "ACME LTD"
            }
          ],
          total_results: 1
        }
      }
    ]);

    const exitCode = await runCli(
      ["search", "Acme"],
      createHumanRuntimeDependencies(fetchImplementation, io, {
        env: {
          COMPANIES_HOUSE_API_KEY: "test-api-key",
          NO_COLOR: ""
        }
      })
    );

    expect(exitCode).toBe(0);
    expect(io.stdout).not.toMatch(ANSI_PATTERN);
  });

  it("forces text output in non-TTY mode with --text", async () => {
    const io = {
      stderr: "",
      stdout: ""
    };
    const fetchImplementation = createQueuedFetch([
      {
        body: {
          items: [
            {
              company_number: "12345678",
              company_status: "active",
              title: "ACME LTD"
            }
          ],
          total_results: 1
        }
      }
    ]);

    const exitCode = await runCli(
      ["search", "Acme", "--text"],
      createTestRuntimeDependencies(fetchImplementation, io, {
        stdoutColumns: 80,
        stdoutIsTTY: false
      })
    );

    expect(exitCode).toBe(0);
    expect(io.stdout).not.toMatch(ANSI_PATTERN);
    expect(io.stdout.trim()).not.toMatch(/^\{/);
    expect(io.stdout).toContain("ACME LTD (12345678)");
  });

  it("renders grouped company info sections in human output", async () => {
    const io = {
      stderr: "",
      stdout: ""
    };
    const fetchImplementation = createQueuedFetch([
      {
        body: {
          accounts: {
            next_due: "2025-01-01",
            next_made_up_to: "2024-12-31",
            overdue: true
          },
          company_name: "ACME LTD",
          company_number: "12345678",
          company_status: "active",
          confirmation_statement: {
            next_due: "2025-02-01",
            next_made_up_to: "2025-01-31",
            overdue: false
          },
          date_of_creation: "2020-01-01",
          has_charges: true,
          has_insolvency_history: false,
          registered_office_address: {
            address_line_1: "1 Test Street",
            locality: "London",
            postal_code: "SW1A 1AA"
          },
          sic_codes: ["62012"],
          type: "ltd"
        }
      }
    ]);

    const exitCode = await runCli(
      ["info", "12345678", "--text"],
      createTestRuntimeDependencies(fetchImplementation, io, {
        stdoutColumns: 80,
        stdoutIsTTY: false
      })
    );
    const plainOutput = stripAnsi(io.stdout);

    expect(exitCode).toBe(0);
    expect(plainOutput).toContain("ACME LTD (12345678)");
    expect(plainOutput).toContain("Company Details");
    expect(plainOutput).toContain("Accounts");
    expect(plainOutput).toContain("Confirmation Statement");
    expect(plainOutput).toContain("Has charges: Yes");
    expect(plainOutput).toContain("Accounts overdue: Yes");
    expect(plainOutput).toContain("Confirmation overdue: No");
  });

  it("renders officer summaries and resigned styling in human output", async () => {
    const io = {
      stderr: "",
      stdout: ""
    };
    const fetchImplementation = createQueuedFetch([
      {
        body: {
          active_count: 2,
          items: [
            {
              appointed_on: "2020-01-01",
              name: "Jane Director",
              officer_role: "director"
            },
            {
              appointed_on: "2019-01-01",
              name: "John Former",
              officer_role: "secretary",
              resigned_on: "2024-01-01"
            }
          ],
          resigned_count: 1,
          total_results: 2
        }
      }
    ]);

    const exitCode = await runCli(
      ["officers", "12345678"],
      createHumanRuntimeDependencies(fetchImplementation, io)
    );
    const plainOutput = stripAnsi(io.stdout);

    expect(exitCode).toBe(0);
    expect(io.stdout).toContain("\u001B[9m");
    expect(plainOutput).toContain("2 active, 1 resigned");
    expect(plainOutput).toContain("+ Jane Director (director)");
    expect(plainOutput).toContain("x John Former (secretary)");
  });

  it("renders filing links only when --include-links is used", async () => {
    const ioWithoutLinks = {
      stderr: "",
      stdout: ""
    };
    const fetchWithoutLinks = createQueuedFetch([
      {
        body: {
          items: [
            {
              category: "accounts",
              date: "2024-01-31",
              description: "accounts-with-accounts-type-full",
              links: {
                document_metadata: "/document/abc123"
              },
              pages: 2,
              type: "AA"
            }
          ],
          total_count: 1
        }
      }
    ]);

    const withoutLinksExitCode = await runCli(
      ["filings", "12345678", "--text"],
      createTestRuntimeDependencies(fetchWithoutLinks, ioWithoutLinks, {
        stdoutColumns: 80,
        stdoutIsTTY: false
      })
    );

    expect(withoutLinksExitCode).toBe(0);
    expect(stripAnsi(ioWithoutLinks.stdout)).not.toContain("/document/abc123");

    const ioWithLinks = {
      stderr: "",
      stdout: ""
    };
    const fetchWithLinks = createQueuedFetch([
      {
        body: {
          items: [
            {
              category: "accounts",
              date: "2024-01-31",
              description: "accounts-with-accounts-type-full",
              links: {
                document_metadata: "/document/abc123"
              },
              pages: 2,
              type: "AA"
            }
          ],
          total_count: 1
        }
      }
    ]);

    const withLinksExitCode = await runCli(
      ["filings", "12345678", "--include-links"],
      createHumanRuntimeDependencies(fetchWithLinks, ioWithLinks)
    );
    const plainOutput = stripAnsi(ioWithLinks.stdout);

    expect(withLinksExitCode).toBe(0);
    expect(ioWithLinks.stdout).toContain("\u001B[4m");
    expect(plainOutput).toContain("/document/abc123");
    expect(plainOutput.replace(/\s+/g, "")).toContain(
      "https://document-api.company-information.service.gov.uk/document/abc123/content"
    );
  });

  it("renders PSC entries with indented control bullets", async () => {
    const io = {
      stderr: "",
      stdout: ""
    };
    const fetchImplementation = createQueuedFetch([
      {
        body: {
          active_count: 1,
          ceased_count: 0,
          items: [
            {
              kind: "individual-person-with-significant-control",
              name: "Jane Owner",
              natures_of_control: ["ownership-of-shares-75-to-100-percent"],
              notified_on: "2020-01-01"
            }
          ],
          total_results: 1
        }
      }
    ]);

    const exitCode = await runCli(
      ["psc", "12345678", "--text"],
      createTestRuntimeDependencies(fetchImplementation, io, {
        stdoutColumns: 80,
        stdoutIsTTY: false
      })
    );
    const plainOutput = stripAnsi(io.stdout);

    expect(exitCode).toBe(0);
    expect(plainOutput).toContain("1 active, 0 ceased");
    expect(plainOutput).toContain("Jane Owner");
    expect(plainOutput).toContain("Notified 2020-01-01");
    expect(plainOutput).toContain("- ownership-of-shares-75-to-100-percent");
  });

  it("renders search-person appointments with indented company lines", async () => {
    const io = {
      stderr: "",
      stdout: ""
    };
    const fetchImplementation = createQueuedFetch([
      {
        body: {
          items: [
            {
              appointment_count: 1,
              links: {
                self: "/officers/abc123/appointments"
              },
              title: "Jane Director"
            }
          ],
          total_results: 1
        }
      },
      {
        body: {
          items: [
            {
              appointed_on: "2020-01-01",
              appointed_to: {
                company_name: "ACME LTD",
                company_number: "12345678",
                company_status: "active"
              },
              officer_role: "director"
            }
          ],
          total_results: 1
        }
      }
    ]);

    const exitCode = await runCli(
      ["search-person", "Jane Director", "--match-limit", "1", "--text"],
      createTestRuntimeDependencies(fetchImplementation, io, {
        stdoutColumns: 80,
        stdoutIsTTY: false
      })
    );
    const plainOutput = stripAnsi(io.stdout);

    expect(exitCode).toBe(0);
    expect(plainOutput).toContain("Jane Director (1 appointments)");
    expect(plainOutput).toContain("  ACME LTD (director) (12345678)");
    expect(plainOutput).toContain("Appointed 2020-01-01");
  });

  it("wraps charge descriptions to the terminal width", async () => {
    const io = {
      stderr: "",
      stdout: ""
    };
    const fetchImplementation = createQueuedFetch([
      {
        body: {
          items: [
            {
              charge_code: "123456780001",
              created_on: "2020-01-01",
              delivered_on: "2020-01-02",
              particulars: {
                brief_description:
                  "Fixed and floating charge over all assets and undertakings of the company.",
                type: "a-charge-on-land"
              },
              status: "outstanding"
            }
          ],
          total_count: 1
        }
      }
    ]);

    const exitCode = await runCli(
      ["charges", "12345678", "--text"],
      createTestRuntimeDependencies(fetchImplementation, io, {
        stdoutColumns: 40,
        stdoutIsTTY: false
      })
    );
    const plainOutput = stripAnsi(io.stdout);

    expect(exitCode).toBe(0);
    expect(plainOutput).toContain("Charge 123456780001 Outstanding");
    plainOutput
      .trimEnd()
      .split("\n")
      .forEach((line) => {
        expect(line.length).toBeLessThanOrEqual(40);
      });
  });

  it("falls back to 80 columns when stdout width is unavailable", async () => {
    const io = {
      stderr: "",
      stdout: ""
    };
    const fetchImplementation = createQueuedFetch([
      {
        body: {
          items: [
            {
              company_number: "12345678",
              company_status: "active",
              description:
                "This is a deliberately long description that should wrap cleanly when the terminal width falls back to eighty columns automatically.",
              title: "ACME LTD"
            }
          ],
          total_results: 1
        }
      }
    ]);

    const exitCode = await runCli(
      ["search", "Acme", "--text"],
      createTestRuntimeDependencies(fetchImplementation, io, {
        stdoutColumns: 0,
        stdoutIsTTY: false
      })
    );

    expect(exitCode).toBe(0);
    stripAnsi(io.stdout)
      .trimEnd()
      .split("\n")
      .forEach((line) => {
        expect(line.length).toBeLessThanOrEqual(80);
      });
  });

  it("renders insolvency cases in human output", async () => {
    const io = {
      stderr: "",
      stdout: ""
    };
    const fetchImplementation = createQueuedFetch([
      {
        body: {
          cases: [
            {
              dates: [
                {
                  date: "2024-01-15",
                  type: "petition"
                }
              ],
              number: "CASE-123",
              practitioners: [
                {
                  name: "Jane Practitioner",
                  role: "administrator"
                }
              ],
              type: "administration"
            }
          ],
          status: "open"
        }
      }
    ]);

    const exitCode = await runCli(
      ["insolvency", "12345678", "--text"],
      createTestRuntimeDependencies(fetchImplementation, io, {
        stdoutColumns: 80,
        stdoutIsTTY: false
      })
    );
    const plainOutput = stripAnsi(io.stdout);

    expect(exitCode).toBe(0);
    expect(plainOutput).toContain("Status: open");
    expect(plainOutput).toContain("CASE-123 administration");
    expect(plainOutput).toContain("petition | 2024-01-15");
    expect(plainOutput).toContain("Jane Practitioner | administrator");
  });

  it("renders a clean dim message for missing insolvency history", async () => {
    const io = {
      stderr: "",
      stdout: ""
    };
    const fetchImplementation = createQueuedFetch([
      {
        status: 404
      }
    ]);

    const exitCode = await runCli(
      ["insolvency", "12345678"],
      createHumanRuntimeDependencies(fetchImplementation, io)
    );

    expect(exitCode).toBe(0);
    expect(io.stderr).toBe("");
    expect(io.stdout).toMatch(ANSI_PATTERN);
    expect(stripAnsi(io.stdout).trim()).toBe("No insolvency history.");
  });
});

describe("runCli help output", () => {
  it("prints top-level help with output guidance and examples", async () => {
    const io = {
      stderr: "",
      stdout: ""
    };

    const exitCode = await runCli(
      ["--help"],
      createTestRuntimeDependencies(createQueuedFetch([]), io)
    );

    expect(exitCode).toBe(0);
    expect(io.stdout).toContain("Output defaults to text in a TTY and JSON when piped.");
    expect(io.stdout).toContain("Examples:");
    expect(io.stdout).toContain('ch search "Revolut"');
    expect(io.stdout).toContain("ch info 09215862");
    expect(io.stdout).toContain("ch officers 09215862 --all");
    expect(io.stdout).toContain("ch filings 09215862 --type accounts --include-links");
    expect(io.stdout).toContain("ch psc 09215862");
    expect(io.stdout).toContain('ch search-person "Nik Storonsky"');
    expect(io.stdout).toContain("ch charges 09215862");
    expect(io.stdout).toContain("ch insolvency 09215862");
    expect(io.stdout).toContain('ch search "Revolut" | jq');
  });

  it("prints exact example lines for every subcommand", async () => {
    const helpCases = [
      {
        args: ["search", "--help"],
        examples: [
          'ch search "Revolut"',
          'ch search "Revolut" --items-per-page 5',
          'ch search "Revolut" --start-index 20',
          'ch search "Revolut" --json'
        ]
      },
      {
        args: ["info", "--help"],
        examples: [
          "ch info 09215862",
          "ch info 09215862 --json",
          "ch info 09215862 --text"
        ]
      },
      {
        args: ["officers", "--help"],
        examples: [
          "ch officers 09215862",
          "ch officers 09215862 --all",
          "ch officers 09215862 --items-per-page 50",
          "ch officers 09215862 --json"
        ]
      },
      {
        args: ["filings", "--help"],
        examples: [
          "ch filings 09215862",
          "ch filings 09215862 --type accounts",
          "ch filings 09215862 --type accounts --include-links",
          "ch filings 09215862 --all"
        ]
      },
      {
        args: ["psc", "--help"],
        examples: [
          "ch psc 09215862",
          "ch psc 09215862 --all",
          "ch psc 09215862 --items-per-page 50",
          "ch psc 09215862 --json"
        ]
      },
      {
        args: ["search-person", "--help"],
        examples: [
          'ch search-person "Nik Storonsky"',
          'ch search-person "Nik Storonsky" --match-limit 5',
          'ch search-person "Nik Storonsky" --items-per-page 20',
          'ch search-person "Nik Storonsky" --json'
        ]
      },
      {
        args: ["charges", "--help"],
        examples: [
          "ch charges 09215862",
          "ch charges 09215862 --all",
          "ch charges 09215862 --items-per-page 50",
          "ch charges 09215862 --json"
        ]
      },
      {
        args: ["insolvency", "--help"],
        examples: [
          "ch insolvency 09215862",
          "ch insolvency 09215862 --json"
        ]
      }
    ];

    for (const helpCase of helpCases) {
      const io = {
        stderr: "",
        stdout: ""
      };

      const exitCode = await runCli(
        helpCase.args,
        createTestRuntimeDependencies(createQueuedFetch([]), io)
      );

      expect(exitCode).toBe(0);
      expect(io.stdout).toContain("Examples:");
      helpCase.examples.forEach((example) => {
        expect(io.stdout).toContain(example);
      });
    }
  });
});
