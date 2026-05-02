import { useState } from 'react';
import { formatCurrency } from '../utils.js';

const PAGE_SIZE = 25;

function KpiCard({ label, value, sub }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-xl font-semibold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

export default function ReconcileFees({ data }) {
  const [discrepancyPage, setDiscrepancyPage] = useState(0);
  const [matchedPage, setMatchedPage] = useState(0);
  const [matchedExpanded, setMatchedExpanded] = useState(false);

  if (!data) return null;
  const { matched, discrepancies, summary } = data;

  const dTotal = Math.ceil(discrepancies.length / PAGE_SIZE);
  const mTotal = Math.ceil(matched.length / PAGE_SIZE);
  const dRows = discrepancies.slice(discrepancyPage * PAGE_SIZE, (discrepancyPage + 1) * PAGE_SIZE);
  const mRows = matched.slice(matchedPage * PAGE_SIZE, (matchedPage + 1) * PAGE_SIZE);

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-4 gap-4">
        <KpiCard label="Total Settled" value={summary.total.toLocaleString()} />
        <KpiCard label="Matched" value={summary.matched.toLocaleString()} />
        <KpiCard label="Discrepancies" value={summary.discrepancies.toLocaleString()} />
        <KpiCard
          label="Total Fee Variance"
          value={formatCurrency(summary.totalFeeVariance)}
          sub="Positive = PA charges more than BP records"
        />
      </div>

      {/* Discrepancies table */}
      {discrepancies.length > 0 ? (
        <div className="bg-white rounded-lg border border-red-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-red-200">
            <h4 className="text-sm font-semibold text-red-800">Fee Discrepancies ({discrepancies.length.toLocaleString()})</h4>
            <p className="text-xs text-gray-500 mt-0.5">
              PA fees = Interchange + Scheme Fees + Markup + Commission from Payment Accounting Settled rows.<br/>
              BP fees = absolute value of commission fee debits on the sub-merchant balance account.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-red-50">
                <tr>
                  <th className="text-left p-2 text-gray-500">Merchant Ref</th>
                  <th className="text-right p-2 text-gray-500">PA Fees</th>
                  <th className="text-right p-2 text-gray-500">BP Fees</th>
                  <th className="text-right p-2 text-gray-500">Variance</th>
                  <th className="text-right p-2 text-gray-500">Interchange</th>
                  <th className="text-right p-2 text-gray-500">Scheme</th>
                  <th className="text-right p-2 text-gray-500">Markup</th>
                </tr>
              </thead>
              <tbody>
                {dRows.map((r, i) => (
                  <tr key={i} className="border-t border-red-50 bg-red-50">
                    <td className="p-2 text-gray-700 truncate max-w-[160px]">{r.merchantRef}</td>
                    <td className="p-2 text-right font-mono">{formatCurrency(r.paymentAccountingFees)}</td>
                    <td className="p-2 text-right font-mono">{formatCurrency(r.bpAccountingFees)}</td>
                    <td className={`p-2 text-right font-mono font-medium ${r.variance > 0 ? 'text-red-600' : 'text-yellow-600'}`}>
                      {r.variance > 0 ? '+' : ''}{formatCurrency(r.variance)}
                    </td>
                    <td className="p-2 text-right font-mono text-gray-600">{formatCurrency(r.breakdown.interchange)}</td>
                    <td className="p-2 text-right font-mono text-gray-600">{formatCurrency(r.breakdown.schemeFees)}</td>
                    <td className="p-2 text-right font-mono text-gray-600">{formatCurrency(r.breakdown.markup)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {dTotal > 1 && (
              <div className="flex justify-center gap-2 p-2 text-xs">
                <button onClick={() => setDiscrepancyPage(p => Math.max(0, p - 1))} disabled={discrepancyPage === 0} className="px-2 py-1 border rounded disabled:opacity-40">←</button>
                <span>{discrepancyPage + 1}/{dTotal}</span>
                <button onClick={() => setDiscrepancyPage(p => Math.min(dTotal - 1, p + 1))} disabled={discrepancyPage >= dTotal - 1} className="px-2 py-1 border rounded disabled:opacity-40">→</button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center text-green-700 font-medium">
          ✓ All fee records match — no discrepancies found.
        </div>
      )}

      {/* Matched fees (collapsed by default) */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <button
          onClick={() => setMatchedExpanded(e => !e)}
          className="w-full px-4 py-3 text-left text-sm font-semibold text-gray-700 flex justify-between items-center hover:bg-gray-50"
        >
          <span>Matched Fees ({matched.length.toLocaleString()})</span>
          <span className="text-gray-400">{matchedExpanded ? '▲' : '▼'}</span>
        </button>
        {matchedExpanded && (
          <>
            <div className="px-4 pb-2 text-xs text-gray-500">
              <span className="font-medium">Interchange:</span> Cost charged by the card issuer. &nbsp;
              <span className="font-medium">Scheme Fees:</span> Cost charged by Visa/Mastercard. &nbsp;
              <span className="font-medium">Markup:</span> Additional processing margin.
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-t border-b border-gray-100">
                  <tr>
                    <th className="text-left p-2 text-gray-500">Merchant Ref</th>
                    <th className="text-right p-2 text-gray-500">Total Fees</th>
                    <th className="text-right p-2 text-gray-500">Interchange</th>
                    <th className="text-right p-2 text-gray-500">Scheme</th>
                    <th className="text-right p-2 text-gray-500">Markup</th>
                  </tr>
                </thead>
                <tbody>
                  {mRows.map((r, i) => (
                    <tr key={i} className="border-t border-gray-50">
                      <td className="p-2 text-gray-700 truncate max-w-[200px]">{r.merchantRef}</td>
                      <td className="p-2 text-right font-mono text-gray-700">{formatCurrency(r.paymentAccountingFees)}</td>
                      <td className="p-2 text-right font-mono text-gray-600">{formatCurrency(r.breakdown.interchange)}</td>
                      <td className="p-2 text-right font-mono text-gray-600">{formatCurrency(r.breakdown.schemeFees)}</td>
                      <td className="p-2 text-right font-mono text-gray-600">{formatCurrency(r.breakdown.markup)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {mTotal > 1 && (
                <div className="flex justify-center gap-2 p-2 text-xs">
                  <button onClick={() => setMatchedPage(p => Math.max(0, p - 1))} disabled={matchedPage === 0} className="px-2 py-1 border rounded disabled:opacity-40">←</button>
                  <span>{matchedPage + 1}/{mTotal}</span>
                  <button onClick={() => setMatchedPage(p => Math.min(mTotal - 1, p + 1))} disabled={matchedPage >= mTotal - 1} className="px-2 py-1 border rounded disabled:opacity-40">→</button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
