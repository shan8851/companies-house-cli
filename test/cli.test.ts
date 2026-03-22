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
  it("renders normalized JSON for company search", async () => {
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
      ["--json", "search", "Acme"],
      createTestRuntimeDependencies(fetchImplementation, io)
    );

    const output = JSON.parse(io.stdout) as {
      command: string;
      data: {
        companies: Array<{
          companyNumber: string;
          name: string;
        }>;
      };
    };

    expect(exitCode).toBe(0);
    expect(output.command).toBe("search");
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
      ["--json", "info", "12345678"],
      createTestRuntimeDependencies(fetchImplementation, io)
    );

    const output = JSON.parse(io.stdout) as {
      data: {
        company: {
          companyName: string;
          hasCharges: boolean;
        };
      };
    };

    expect(exitCode).toBe(0);
    expect(output.data.company.companyName).toBe("ACME LTD");
    expect(output.data.company.hasCharges).toBe(true);
  });

  it("renders normalized JSON for officers", async () => {
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
      ["--json", "officers", "12345678"],
      createTestRuntimeDependencies(fetchImplementation, io)
    );

    const output = JSON.parse(io.stdout) as {
      data: {
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
    expect(output.data.summary.activeCount).toBe(1);
    expect(output.data.officers[0]?.officerRole).toBe("director");
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
      input: {
        category: string;
      };
      data: {
        filings: Array<{
          category: string;
        }>;
      };
    };

    expect(exitCode).toBe(0);
    expect(output.input.category).toBe("accounts");
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
        filings: Array<{
          documentContentUrl: string | null;
        }>;
      };
      input: {
        includeLinks: boolean;
      };
    };

    expect(exitCode).toBe(0);
    expect(output.input.includeLinks).toBe(true);
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
      input: {
        companyNumber: string;
      };
    };

    expect(exitCode).toBe(0);
    expect(output.input.companyNumber).toBe("09215862");
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
      pagination: {
        fetchedAll: boolean;
        returnedCount: number;
      };
    };

    expect(exitCode).toBe(0);
    expect(output.pagination.fetchedAll).toBe(true);
    expect(output.pagination.returnedCount).toBe(2);
  });

  it("rejects --all with a non-zero --start-index", async () => {
    const io = {
      stderr: "",
      stdout: ""
    };

    const exitCode = await runCli(
      ["search", "Acme", "--all", "--start-index", "1"],
      createTestRuntimeDependencies(createQueuedFetch([]), io)
    );

    expect(exitCode).toBe(1);
    expect(io.stderr).toContain("--all cannot be combined");
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

  it("disables ANSI styling automatically for non-TTY output", async () => {
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
      createTestRuntimeDependencies(fetchImplementation, io, {
        stdoutColumns: 80,
        stdoutIsTTY: false
      })
    );

    expect(exitCode).toBe(0);
    expect(io.stdout).not.toMatch(ANSI_PATTERN);
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
      ["info", "12345678"],
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
      ["filings", "12345678"],
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
      ["psc", "12345678"],
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
      ["search-person", "Jane Director", "--match-limit", "1"],
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
      ["charges", "12345678"],
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
      ["search", "Acme"],
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
      ["insolvency", "12345678"],
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
