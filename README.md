# Adyen Platform Reporting

A full-stack reference implementation showing how a platform built on **Adyen for Platforms** should ingest, parse, and surface reporting data to both sub-merchants and internal operators.

---

## What this demonstrates

```
Adyen → REPORT_AVAILABLE webhook → fetch CSV → parser → Express API → React dashboard
           (simulated by local                ↑                              ↑
            CSV files at startup)       4 report types               Merchant View
                                                                      Platform View
```

The pipeline covers all four Adyen Balance Platform reports:

| Report | What it contains |
|---|---|
| Accounting Report | Full transaction lifecycle (received → authorised → captured/refunded) |
| Payout Report | Daily payout batches grouped by AccountHolder + date |
| Fee Report | Monthly fee breakdown by fee type |
| Statement Report | Per-merchant ledger with opening and closing balances |

---

## Architecture

```
/
├── server/                        Node.js + Express (port 3001)
│   ├── index.js                   Entry point — loads data, registers routes
│   ├── parsers/                   One parser per report type
│   │   ├── accountingReport.js    parseAll() + parseFinalStatus()
│   │   ├── payoutReport.js        parseBatches() — groups by AH + payout date
│   │   ├── feeReport.js           parseFees() — pre-computes byType summary
│   │   └── statementReport.js     parseStatement() — handles sentinel rows
│   ├── services/
│   │   ├── reportStore.js         Loads all CSVs at startup, exposes getters
│   │   └── logger.js              Timestamp-prefixed logger, silenced in test
│   ├── routes/                    One file per API endpoint
│   └── constants/merchants.js     AH → merchant name mapping
└── client/                        React + Vite + Tailwind + Recharts (port 5173)
    ├── src/pages/
    │   ├── MerchantDashboard.jsx  Per-merchant view with date range picker
    │   └── PlatformDashboard.jsx  Operator view — aggregate + profitability
    └── src/components/            One component per data panel
```

---

## Prerequisites

- Node.js 18+
- npm 9+

---

## Install

```bash
# Clone or unzip the project, then:
npm install          # installs root devDeps (concurrently, nodemon)
npm --prefix server install   # installs Express + csv-parse + cors
npm --prefix client install   # installs React + Vite + Tailwind + Recharts
```

---

## Run locally

```bash
npm run dev
```

Opens two processes:
- **Server**: http://localhost:3001 — parses CSVs and serves the API
- **Client**: http://localhost:5173 — Vite dev server with HMR, proxies `/api` to 3001

The server logs record counts on startup:
```
Accounting Report: 49,200 rows (10,999 final-status transactions)
Payout Report: 5,554 rows (155 payout batches)
Fee Report: 57 rows
Statement Report: 5,612 rows (5 merchants)
```

---

## Mock data

Pre-generated CSVs are in `server/mock/reports/`. The data covers **July 2024** and includes 5 sub-merchants:

| AccountHolder | BalanceAccount | Name |
|---|---|---|
| AH3000000000000000000001 | BA3000000000000000000001 | Bella Italia Restaurant |
| AH3000000000000000000002 | BA3000000000000000000002 | Tech Gadgets Store |
| AH3000000000000000000003 | BA3000000000000000000003 | Urban Fitness Studio |
| AH3000000000000000000004 | BA3000000000000000000004 | Green Garden Cafe |
| AH3000000000000000000005 | BA3000000000000000000005 | Swift Delivery Co |

---

## Report linkage

Every transaction links across the four reports via these keys:

| Key | Links |
|---|---|
| Transfer Id | Accounting ↔ Payout (transaction rows) |
| AccountHolder | Accounting ↔ Fee ↔ Statement |
| Psp Payment Psp Reference | Accounting capture row ↔ commission fee row |
| Payout Date | Groups payout batches in Payout Report |

The accounting report has 3 rows per Transfer Id (received → authorised → captured/refunded).
Only the final row has a Transaction Id populated — this is the deduplication signal.

---

## API endpoints

```
GET /api/transactions                     Final-status txns (platformPayment + bank)
GET /api/payouts                          Payout batches with transactions + disbursement
GET /api/fees                             Fee rows + pre-computed byType summary
GET /api/statement                        Per-merchant ledger with opening/closing balance
GET /api/platform/profitability           Commission vs fees vs profit by week
GET /api/platform/transaction-profitability   Per-txn margin analysis
GET /api/platform/user-profitability      Per-merchant volume + commission + profit
```

All routes accept optional query params: `balanceAccountId`, `startDate`, `endDate`.

Response envelope:
```json
{ "data": [...], "meta": { "count": 123, "filters": {} } }
```

---

## Replacing mock data with real Adyen reports

In production:

1. Adyen sends a `REPORT_AVAILABLE` webhook when a report is generated
2. Platform backend extracts the download URL from the webhook payload
3. Backend fetches the CSV via SFTP or the Report Download API
4. CSV is saved to `server/mock/reports/` (or streamed into the parser)
5. Restart the server — `reportStore.js` reloads all files at startup

The parsers require **zero changes** — they accept a file path and return the same structure regardless of how the CSV was fetched.

Adyen report docs:
- [Accounting Report](https://docs.adyen.com/platforms/reports-and-fees/balance-platform-accounting-report)
- [Payout Report](https://docs.adyen.com/platforms/reports-and-fees/payout-report)
- [Fee Report](https://docs.adyen.com/platforms/reports-and-fees/fee-report)
- [Statement Report](https://docs.adyen.com/platforms/reports-and-fees/statement-report)

---

## Known limitations

- **No authentication** — this is a local dev tool, all data is publicly accessible
- **Single month** — mock data covers July 2024 only
- **In-process cache** — report data is cached in memory; restarting the server re-parses from disk
- **Estimated per-transaction fees** — the Fee Report is monthly; per-transaction fee allocation is a proportional estimate (total fees ÷ transaction count per merchant)
- **Static merchant roster** — merchant names are hardcoded in `constants/merchants.js`; a production system would fetch these from the Adyen Management API
