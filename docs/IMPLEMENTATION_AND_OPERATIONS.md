# Implementation logic and operations guide

This document describes **how this reference codebase calculates metrics** (parsers, API routes, and key UI aggregations) and gives **practical guidance** for production: webhooks, storage, retention, and invoicing. It complements `CLAUDE.md` (product brief and conventions).

---

## 1. Data flow

1. **Startup:** `server/services/reportStore.js` reads four CSVs from `server/mock/reports/` and parses them synchronously. Parsed data stays in memory for the process lifetime.
2. **API:** Routes call getters (`getAccountingFinal`, `getAccountingAll`, …), apply query filters, map to JSON, return `{ data, meta }` (fees also returns `summary`).
3. **Production:** Replace file paths with webhook-triggered downloads; parsers can stay the same if the CSV shape matches Adyen’s reports.

---

## 2. Accounting report

**File:** `server/parsers/accountingReport.js`

| Topic | Behavior |
|--------|-----------|
| Row mapping | `transferId`, `txnId`, `accountHolder`, `balanceAccount`, `category`, `type`, `status`, `bookingDate`, `valueDate`, `currency`, `amount` (2 dp), `merchantRef`, `pspRef`, etc. |
| Dates | CSV `dd/MM/yyyy HH:mm` → UTC ISO strings. |
| `parseAll()` | All non-empty rows — used for platform profitability, transaction profitability joins, lifecycle. |
| `parseFinalStatus()` | Rows with **non-empty Transaction Id** only; **dedup by Transfer Id** (first occurrence wins in file order). Skips `received` / `authorised` rows that have no transaction id. |

---

## 3. Payout report

**File:** `server/parsers/payoutReport.js`

| Topic | Behavior |
|--------|-----------|
| Batch key | `AccountHolder` + **date part** of `Payout Date` (from raw string). |
| Disbursement | Row with `type === 'bankTransfer'` and `status === 'booked'` → `disbursement.transferId`, `amount` (from **Balance (PC)**), `bookedAt`. |
| Other rows | `transactions[]` with amounts, rolling balance, refs, dates. |

**Route:** `server/routes/payouts.js`

- Filters on `payoutDate` (not booking date of line items).
- **`totalAmount`:** `abs(disbursement.amount)` when present; else sum of `transactions[].amount`.
- **`transactionCount`:** length of `transactions` (disbursement excluded).

---

## 4. Fee report

**File:** `server/parsers/feeReport.js`

- Rows: `billingMonth`, `accountHolder`, `balanceAccount`, `feeType`, `feeName`, `currency`, `amount` from **Fee Amount**.
- **`computeSummary(rows)`:** sums by `feeType`, plus **`total`** = sum of all row amounts (credits and debits; net can be negative).

**Route:** `server/routes/fees.js`

- With **no** `balanceAccountId`: returns **cached** platform-wide summary from parse time.
- With **`balanceAccountId`**: filters rows and **recomputes** summary for the filtered set.
- Date filters apply to **`billingMonth`**.

---

## 5. Statement report

**File:** `server/parsers/statementReport.js`

| Topic | Behavior |
|--------|-----------|
| Sentinel rows | Empty **Category** (after trim) — not counted as transactions. |
| Opening balance | **First** sentinel per account holder: **`Amount`** column. |
| Closing balance | Each **subsequent** sentinel updates closing from **Ending Balance**, or **Starting Balance** if ending is missing/zero. |
| `transactions[]` | Only non-sentinel rows. |

**Route:** `server/routes/statement.js` — optional `balanceAccountId` only (no date filter on this endpoint).

---

## 6. `GET /api/transactions`

**File:** `server/routes/transactions.js`

- Source: **`getAccountingFinal()`**.
- **Categories included:** `platformPayment`, **`bank`**, **`card`** (`VISIBLE_CATEGORIES`).
- Internal accounting rows (fees, adjustments, etc.) are **omitted** from this endpoint.
- Sort: `bookingDate` descending.
- Filters: `balanceAccountId`, `startDate` / `endDate` on **bookingDate** (end inclusive end-of-day).

---

## 7. `GET /api/platform/profitability`

**File:** `server/routes/platform/profitability.js`  
**Liable account:** `LIABLE_BALANCE_ACCOUNT` in `server/constants/merchants.js`

| Field | Calculation |
|--------|--------------|
| **totalCommission** | Sum of **positive** amounts on the **liable balance account** where `category === 'internal'` and `type === 'fee'`. |
| **totalFees** | **`getFees().summary.total`** — full Fee Report total (Adyen charges to the platform). |
| **netProfit** | `totalCommission - totalFees`. |
| **marginPercent** | `(netProfit / totalCommission) * 100` if commission &gt; 0, else `0`. |
| **byWeek[]** | Liable **all** rows grouped by ISO week (Monday start). Per week: positive internal/fee amounts → **commission**; negative internal/fee → **fees** as **absolute** sum; **profit** = commission − fees. |
| **liableAccountSummary** | **totalCredits:** sum of positive amounts on liable BA; **totalDebits:** sum of abs(negative amounts); **closingBalance:** credits − debits. |

**Chart vs headline:** The weekly series uses **liable-account internal/fee movements**. **`totalFees`** uses the **Fee Report**. They are different cost signals unless your data model aligns them by design — call this out in product copy if operators compare the two.

---

## 8. `GET /api/platform/user-profitability`

**File:** `server/routes/platform/userProfitability.js`

Per **account holder**, excluding the **platform liable account holder** (`LIABLE_ACCOUNT_HOLDER`).

| Field | Calculation |
|--------|--------------|
| **volume** | Sum of `amount` where `category === 'platformPayment'` and `status === 'captured'`. |
| **txnCount** | Count of those rows. |
| **commission** | Sum of **`abs(amount)`** for `internal` + `fee` + **`amount < 0`** on the sub-merchant account (commission debited from merchant). |
| **fees** | Sum of Fee Report **`amount`** for that **accountHolder**. |
| **profit** | `commission - fees`. |
| **effectiveRate** | `(profit / volume) * 100` (2 dp) if volume &gt; 0. |

Default sort: **profit** descending.

---

## 9. `GET /api/platform/transaction-profitability`

**File:** `server/routes/platform/transactionProfitability.js`

Commission is **not** joined by Transfer Id alone: fee rows can use a different transfer id than the capture.

1. **Captures:** From `getAccountingAll()`, rows with `platformPayment`, `captured`, and non-empty `txnId` — keyed by `transferId`.
2. **Commission fee lines:** `internal` + `fee` + `amount < 0` + not liable BA + **`pspRef` set** — map **`pspRef` → row**.
3. **Join:** Match capture’s **`pspRef`** to that map. **Commission** = `abs(feeRow.amount)`. Captures without a matching fee line are **dropped** from the response.
4. **Estimated cost per txn:** Total Fee Report amount for that **accountHolder** ÷ **number of captured txns** for that holder (flat monthly allocation).
5. **profit** = commission − estimated cost; **marginPercent** = `(profit / capture.amount) * 100`.

Default sort: **marginPercent** ascending (worst margin first).

---

## 10. Merchant dashboard KPIs (frontend)

**File:** `client/src/components/DailySalesSummary.jsx`

Uses `/api/transactions` and `/api/fees` with the same account + date params.

| KPI | Logic |
|-----|--------|
| Gross | Sum of `amount` where `type === 'capture'`. |
| Refunds | `abs(sum(amount))` where `type === 'refund'`. |
| Chargebacks | `abs(sum(amount))` where `type === 'chargeback'`. |
| Fees | `summary.total` from fees API. |
| Net | `gross - refunds - chargebacks - fees`. |

**Note:** Other dispute types (`secondChargeback`, `chargebackReversal`, …) are not folded into the “Chargebacks” card unless they appear as `type === 'chargeback'`. Align with finance if you need a broader dispute bucket.

---

## 11. Exception log (frontend)

**File:** `client/src/components/ExceptionLog.jsx`

Client-side filter on `/api/transactions` data:

- `type` in `manualCorrection`, `miscCost`, `depositCorrection`, **or**
- `type === 'bankTransfer'` and `status === 'refused'`.

---

## 12. Production: webhooks (`REPORT_AVAILABLE`)

1. **Verify** HMAC / signature per Adyen’s webhook docs before trusting the body.
2. **Idempotency:** Store notification id or report id; skip duplicates.
3. **Respond fast:** Acknowledge the webhook, then **enqueue** download + parse (queue worker).
4. **Download:** Report Download API or SFTP; stream to object storage and/or parse into a database.
5. **Audit:** Persist report type, creation date, file checksum, row counts, and link to stored raw file.

---

## 13. Production: storing report data

| Layer | Purpose |
|-------|--------|
| **Raw CSV (immutable)** | Replay after parser fixes, disputes, audits. |
| **Normalized tables** | Indexed queries by `balanceAccount`, `bookingDate`, `transferId`, `pspRef`. |
| **Aggregates (optional)** | Monthly merchant rollups if dashboards are heavy. |

Adapt `reportStore.js` to load from paths or streams supplied after each successful ingest instead of only at startup.

---

## 14. Production: retention and what to expose

- **Raw files:** Often **multi-year** retention for payments ledgers (check jurisdiction and scheme rules); **13+ months** is a common minimum for chargebacks and tax.
- **Merchant UI:** **12–24 months** online for statements and payouts; older periods on request or from cold storage.
- **Operators / risk:** Longer online or warehouse access as policy allows.
- **PII:** Minimize in reports; align with your DPA and privacy policy.

---

## 15. Production: generating invoices (platform → sub-merchant)

This repo does **not** generate invoices. A typical approach:

1. **Line items:** Commission (same basis as user-profitability — internal fee debits on merchant balance, or contract % on captures); allocated scheme/processing from Fee Report lines you attribute; accounting adjustments as separate lines.
2. **Period:** Align to **billing month** (fee report) and/or **capture calendar month** — document the rule in your contract.
3. **Compliance:** Invoice numbering, tax/VAT, place of supply — legal/product, not derivable from CSV alone.
4. **Delivery:** PDF + portal + email; store PDF hash and pointers to source report ids / file checksums.
5. **Reconciliation:** Export line-level backing data for finance and disputes.

---

## 16. Source file index

| Area | Path |
|------|------|
| Report loading | `server/services/reportStore.js` |
| Accounting | `server/parsers/accountingReport.js` |
| Payouts | `server/parsers/payoutReport.js` |
| Fees | `server/parsers/feeReport.js` |
| Statement | `server/parsers/statementReport.js` |
| Transactions API | `server/routes/transactions.js` |
| Platform profitability | `server/routes/platform/profitability.js` |
| User profitability | `server/routes/platform/userProfitability.js` |
| Transaction profitability | `server/routes/platform/transactionProfitability.js` |
| Merchant KPIs | `client/src/components/DailySalesSummary.jsx` |
| In-dashboard report → view mapping | `client/src/components/DashboardReportGuide.jsx` (`MerchantReportGuide`, `PlatformReportGuide`) |
| Project brief | `CLAUDE.md` |

---

## 17. Accessing this document from the app

Each dashboard includes a collapsible **Reporting guide** (`DashboardReportGuide.jsx`) that maps sections to Adyen reports, join keys, and API routes. With `npm run dev`, the dev server proxies `/docs` to the API server, which serves files from the repository `docs/` folder. Open **Implementation and methodology** in the app footer, or go to:

`/docs/IMPLEMENTATION_AND_OPERATIONS.md`

If you run the client alone without the proxy, add the same proxy rule or copy the file into `client/public/docs/` for static hosting.
