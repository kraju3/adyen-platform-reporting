/**
 * In-dashboard mapping: which Adyen Balance Platform reports and keys power each UI section.
 * Helps operators and engineers reproduce or extend these views on their own stack.
 */

import PropTypes from 'prop-types';

const METHODOLOGY_HREF = '/docs/IMPLEMENTATION_AND_OPERATIONS.md';

const guideRowShape = PropTypes.shape({
  section: PropTypes.string.isRequired,
  reports: PropTypes.string.isRequired,
  how: PropTypes.string.isRequired,
  api: PropTypes.string.isRequired,
});

const MERCHANT_ROWS = [
  {
    section: 'Sales KPIs (Gross, Refunds, Chargebacks, Fees, Net)',
    reports: 'Accounting Report (final-status rows) + Fee Report',
    how: 'Accounting: rows with Transaction Id set (one row per Transfer Id). Gross/refunds/chargebacks from type. Fees from monthly fee totals for the merchant. Net is computed in the browser from those inputs.',
    api: 'GET /api/transactions, GET /api/fees',
  },
  {
    section: 'Payout summary',
    reports: 'Payout Report',
    how: 'Group rows by AccountHolder + payout date. All lines except the last bankTransfer fund the batch; the bankTransfer + booked row is the disbursement. Transfer Id links back to Accounting.',
    api: 'GET /api/payouts',
  },
  {
    section: 'Fee breakdown chart',
    reports: 'Fee Report',
    how: 'Rows grouped by Fee Type; amounts are scheme/processing and other Adyen charges for the billing month.',
    api: 'GET /api/fees',
  },
  {
    section: 'Transaction table',
    reports: 'Accounting Report (final-status)',
    how: 'Same deduped rows as KPIs: platformPayment, bank, and card categories only (not internal fee ledger lines). Filter by booking date and type.',
    api: 'GET /api/transactions',
  },
  {
    section: 'Statement',
    reports: 'Statement Report',
    how: 'Per AccountHolder: opening sentinel (empty Category) → transaction lines → closing sentinel. Sentinels are excluded from transaction counts.',
    api: 'GET /api/statement',
  },
  {
    section: 'Dispute tracker',
    reports: 'Accounting Report (final-status)',
    how: 'Filter types chargeback, chargebackReversal, secondChargeback on the same transaction feed.',
    api: 'GET /api/transactions (client-side type filter)',
  },
];

const PLATFORM_ROWS = [
  {
    section: 'Platform KPIs & weekly chart',
    reports: 'Accounting Report (all rows, liable balance account) + Fee Report',
    how: 'Commission: positive internal/fee lines on the platform liable balance account. Total fees: sum of Fee Report (platform-wide). Weekly chart groups liable movements by week (see methodology doc for chart vs headline nuance).',
    api: 'GET /api/platform/profitability',
  },
  {
    section: 'Negative balance alert',
    reports: 'Statement Report',
    how: 'Closing balance from the last sentinel per merchant; flag any account with closing balance below zero.',
    api: 'GET /api/statement',
  },
  {
    section: 'User profitability table',
    reports: 'Accounting Report (final-status) + Fee Report',
    how: 'Volume and txn count from captured platform payments per AccountHolder. Commission from internal fee debits on each merchant account. Fees from Fee Report rows per AccountHolder. Platform liable holder excluded from merchant rows.',
    api: 'GET /api/platform/user-profitability',
  },
  {
    section: 'Transaction profitability table',
    reports: 'Accounting Report (all rows) + Fee Report',
    how: 'Each capture joined to its commission fee line by PSP reference (not always the same Transfer Id as the fee row). Per-transaction “cost” is the merchant’s total monthly fees divided by capture count (estimate).',
    api: 'GET /api/platform/transaction-profitability',
  },
  {
    section: 'Exception log',
    reports: 'Accounting Report (final-status)',
    how: 'Types manualCorrection, miscCost, depositCorrection, and bankTransfer with status refused — surfaced for finance review.',
    api: 'GET /api/transactions (client-side filter)',
  },
];

function ReportGuidePanel({ title, rows }) {
  return (
    <details className="bg-white border border-gray-200 rounded-lg group open:shadow-sm">
      <summary className="cursor-pointer list-none px-4 py-3 flex items-center justify-between gap-3 text-sm font-medium text-gray-800 hover:bg-gray-50 rounded-lg [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2">
          <span
            className="text-green-600 inline-block transition-transform duration-200 group-open:rotate-90"
            aria-hidden
          >
            ▶
          </span>
          {title}
        </span>
        <span className="text-xs font-normal text-gray-500 shrink-0">Reporting guide</span>
      </summary>
      <div className="px-4 pb-4 pt-0 border-t border-gray-100">
        <p className="text-xs text-gray-600 mt-3 mb-4">
          In production, subscribe to{' '}
          <code className="bg-gray-100 px-1 rounded text-[11px]">REPORT_AVAILABLE</code>, download each
          CSV when ready, then parse the same columns this app uses. Cross-report keys:{' '}
          <strong>Transfer Id</strong> (accounting ↔ payout), <strong>AccountHolder</strong> (accounting
          ↔ fees ↔ statement), <strong>PSP reference</strong> (capture ↔ commission fee line).
        </p>
        <div className="overflow-x-auto rounded border border-gray-100">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-gray-50 text-gray-600 border-b border-gray-100">
                <th className="p-2 font-semibold w-[18%]">Dashboard section</th>
                <th className="p-2 font-semibold w-[20%]">Adyen report(s)</th>
                <th className="p-2 font-semibold">How to build the view</th>
                <th className="p-2 font-semibold w-[22%]">API in this app</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.section} className="border-b border-gray-50 align-top hover:bg-gray-50/80">
                  <td className="p-2 text-gray-900 font-medium">{r.section}</td>
                  <td className="p-2 text-gray-700">{r.reports}</td>
                  <td className="p-2 text-gray-600 leading-relaxed">{r.how}</td>
                  <td className="p-2">
                    <code className="text-[11px] bg-gray-100 px-1.5 py-0.5 rounded text-gray-800 whitespace-nowrap">
                      {r.api}
                    </code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-gray-500">
          Full calculation definitions, parser rules, and operations (retention, webhooks, invoicing):{' '}
          <a
            href={METHODOLOGY_HREF}
            target="_blank"
            rel="noopener noreferrer"
            className="text-green-700 hover:underline"
          >
            Implementation and methodology
          </a>.
        </p>
      </div>
    </details>
  );
}

export function MerchantReportGuide() {
  return (
    <ReportGuidePanel
      title="How merchant views map to Adyen reports"
      rows={MERCHANT_ROWS}
    />
  );
}

export function PlatformReportGuide() {
  return (
    <ReportGuidePanel
      title="How platform views map to Adyen reports"
      rows={PLATFORM_ROWS}
    />
  );
}

ReportGuidePanel.propTypes = {
  title: PropTypes.string.isRequired,
  rows: PropTypes.arrayOf(guideRowShape).isRequired,
};
