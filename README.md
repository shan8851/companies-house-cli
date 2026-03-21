# 🏛️ companies-house-cli

[![npm version](https://img.shields.io/npm/v/@shan8851/companies-house-cli.svg)](https://www.npmjs.com/package/@shan8851/companies-house-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22-brightgreen.svg)](https://nodejs.org)

UK company data in your terminal. Built for AI agents, still useful for humans.

```bash
ch search "Revolut"                     # Find companies by name
ch info 09215862                        # Company profile
ch officers 09215862                    # Directors & secretaries
ch filings 09215862 --type accounts     # Filing history
ch psc 09215862                         # Beneficial owners
ch search-person "Nik Storonsky"        # Find a person across companies
```

## Install

```bash
npm install -g @shan8851/companies-house-cli
```

Or from source:

```bash
git clone https://github.com/shan8851/companies-house-cli.git
cd companies-house-cli
pnpm install && pnpm build
pnpm link --global
```

## API Key

A free API key is required. Takes 30 seconds:

1. Register at [developer.company-information.service.gov.uk](https://developer.company-information.service.gov.uk/)
2. Create an application → select **REST API key**
3. Set it:

```bash
export COMPANIES_HOUSE_API_KEY=your_key
# or add to .env in your project directory
```

## Commands

| Command | What it does |
| --- | --- |
| `ch search <query>` | Search companies by name |
| `ch info <number>` | Company profile — address, status, SIC codes, incorporation date |
| `ch officers <number>` | Directors, secretaries, appointments |
| `ch filings <number>` | Filing history with optional `--type` filter and `--include-links` |
| `ch psc <number>` | Persons with significant control (beneficial owners) |
| `ch search-person <name>` | Find a person across all UK companies with appointment enrichment |
| `ch charges <number>` | Registered charges and mortgages |
| `ch insolvency <number>` | Insolvency case history |

Company numbers are automatically zero-padded — `9215862` becomes `09215862`.

All list commands support `--items-per-page`, `--start-index`, and `--all` for pagination.

## Agent Integration

Add `--json` to any command for stable normalized output.

```bash
ch search "Revolut" --json
ch officers 09215862 --all --json | jq
```

Every response uses a stable envelope:

```json
{
  "command": "officers",
  "input": { "companyNumber": "09215862" },
  "pagination": { "startIndex": 0, "itemsPerPage": 10, "totalResults": 12 },
  "data": { "officers": [...] }
}
```

Works with [OpenClaw](https://github.com/openclaw/openclaw), Claude Desktop MCP, or any agent that can shell out.

## Examples

```bash
# Quick company lookup
$ ch search "Monzo"
07446590  Monzo Bank Limited              Active    LONDON
10561407  Monzo Support Limited           Active    LONDON

# Who runs Revolut?
$ ch officers 09215862
Nikolay Storonsky    Director    Appointed 2015-07-01    Active
Vladyslav Yatsenko   Director    Appointed 2015-07-01    Active
Martin Gilbert       Director    Appointed 2021-09-01    Active
...

# Get latest accounts with download links
$ ch filings 09215862 --type accounts --include-links
2024-12-15  Full accounts  accounts  [PDF: https://...]
2023-12-14  Full accounts  accounts  [PDF: https://...]
...

# Find someone across all UK companies
$ ch search-person "Tim Cook"
Tim Cook    Director    Apple (UK) Limited (03288373)
Tim Cook    Secretary   Cook Ventures Ltd (12345678)
...
```

## Development

```bash
pnpm typecheck    # Type check
pnpm lint         # ESLint
pnpm test         # Vitest
pnpm check        # All of the above
```

## License

MIT — Built by [@shan8851](https://x.com/shan8851)
