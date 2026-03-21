import { describe, expect, it } from "vitest";

import { runCli } from "../src/cli.js";
import { createQueuedFetch, createTestRuntimeDependencies } from "./helpers.js";

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
