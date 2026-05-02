import { useState, useEffect } from 'react';
import client from '../api/client.js';
import Spinner from './Spinner.jsx';
import { formatCurrency, formatDate } from '../utils.js';

const PAGE_SIZE = 25;

function Panel({ title, count, colorClass, children }) {
  return (
    <div className={`flex-1 rounded-lg border ${colorClass} overflow-hidden`}>
      <div className="px-4 py-3 border-b border-inherit">
        <h4 className="text-sm font-semibold">{title} ({count.toLocaleString()})</h4>
      </div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

export default function ReconcilePayments({ data }) {
  const [matchedPage, setMatchedPage] = useState(0);
  const [unmatchedPage, setUnmatchedPage] = useState(0);
  const [expanded, setExpanded] = useState(null);

  if (!data) return null;

  const { matched, unmatched } = data;
  const mTotal = Math.ceil(matched.length / PAGE_SIZE);
  const uTotal = Math.ceil(unmatched.length / PAGE_SIZE);
  const mRows = matched.slice(matchedPage * PAGE_SIZE, (matchedPage + 1) * PAGE_SIZE);
  const uRows = unmatched.slice(unmatchedPage * PAGE_SIZE, (unmatchedPage + 1) * PAGE_SIZE);

  if (unmatched.length === 0) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center text-green-700 font-medium">
        ✓ All payments reconciled — no gaps found.
      </div>
    );
  }

  return (
    <div className="flex gap-4">
      {/* Reconciled panel */}
      <Panel title="Reconciled" count={matched.length} colorClass="border-green-200 bg-white">
        <table className="w-full text-xs">
          <thead className="bg-green-50">
            <tr>
              <th className="text-left p-2 text-gray-500">Merchant Ref</th>
              <th className="text-left p-2 text-gray-500">Date</th>
              <th className="text-right p-2 text-gray-500">Amount</th>
              <th className="text-left p-2 text-gray-500">PA Status</th>
              <th className="text-left p-2 text-gray-500">BP Status</th>
            </tr>
          </thead>
          <tbody>
            {mRows.map((r, i) => (
              <tr key={i} className="border-t border-green-50">
                <td className="p-2 text-gray-700 truncate max-w-[140px]">{r.merchantRef}</td>
                <td className="p-2 text-gray-500">{formatDate(r.bookingDate)}</td>
                <td className="p-2 text-right font-mono text-gray-700">{formatCurrency(r.amount)}</td>
                <td className="p-2">
                  <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">{r.statusInPaymentAccounting}</span>
                </td>
                <td className="p-2">
                  <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-xs">{r.statusInBPAccounting}</span>
                </td>
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
      </Panel>

      {/* Gaps panel */}
      <Panel title="Gaps" count={unmatched.length} colorClass="border-red-200 bg-white">
        <table className="w-full text-xs">
          <thead className="bg-red-50">
            <tr>
              <th className="text-left p-2 text-gray-500">Merchant Ref</th>
              <th className="text-left p-2 text-gray-500">Date</th>
              <th className="text-right p-2 text-gray-500">Amount</th>
              <th className="text-left p-2 text-gray-500">Reason</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {uRows.map((r, i) => (
              <>
                <tr key={`gap-${i}`} className="border-t border-red-50 bg-red-50">
                  <td className="p-2 text-gray-700 truncate max-w-[140px]">{r.merchantRef}</td>
                  <td className="p-2 text-gray-500">{formatDate(r.bookingDate)}</td>
                  <td className="p-2 text-right font-mono text-gray-700">{formatCurrency(r.amount)}</td>
                  <td className="p-2 text-red-700 text-xs">{r.reason}</td>
                  <td className="p-2">
                    <button
                      onClick={() => setExpanded(expanded === i ? null : i)}
                      className="text-xs text-red-500 hover:underline"
                    >
                      {expanded === i ? 'Hide' : 'Details'}
                    </button>
                  </td>
                </tr>
                {expanded === i && (
                  <tr key={`exp-${i}`} className="bg-red-50">
                    <td colSpan={5} className="px-3 pb-3">
                      <pre className="text-xs text-gray-600 bg-white rounded p-2 border border-red-100 overflow-x-auto">
                        {JSON.stringify(r.rawPaymentAccountingRow, null, 2)}
                      </pre>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
        {uTotal > 1 && (
          <div className="flex justify-center gap-2 p-2 text-xs">
            <button onClick={() => setUnmatchedPage(p => Math.max(0, p - 1))} disabled={unmatchedPage === 0} className="px-2 py-1 border rounded disabled:opacity-40">←</button>
            <span>{unmatchedPage + 1}/{uTotal}</span>
            <button onClick={() => setUnmatchedPage(p => Math.min(uTotal - 1, p + 1))} disabled={unmatchedPage >= uTotal - 1} className="px-2 py-1 border rounded disabled:opacity-40">→</button>
          </div>
        )}
      </Panel>
    </div>
  );
}
